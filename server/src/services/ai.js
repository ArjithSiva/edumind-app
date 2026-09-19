/**
 * Pluggable AI provider layer.
 *
 * One function — complete({ prompt, system, json }) — talks to whichever
 * provider AI_PROVIDER names. Every provider has a free tier, so you can
 * switch with a single env var if one rate-limits you mid-demo.
 *
 * If no key is configured, or the call fails, `complete` throws an
 * AIUnavailable error. Callers catch it and serve deterministic fallback
 * content from the seeded bank, so the app never shows a dead screen.
 */

export class AIUnavailable extends Error {
  constructor(message = "AI provider unavailable") {
    super(message);
    this.name = "AIUnavailable";
    this.status = 503;
  }
}

const TIMEOUT_MS = 30000;

async function postJSON(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      // Logged here, not just thrown, because every call site catches this
      // and falls back to seeded content — without this line a dead API key,
      // a decommissioned model, or a bad request all look identical to
      // "working fine" from the outside. Check these logs on Render first.
      console.error(`[ai] ${url} -> ${res.status}: ${text.slice(0, 500)}`);
      throw new AIUnavailable(`${res.status} ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof AIUnavailable) throw err;
    console.error(`[ai] request to ${url} failed:`, err.message);
    throw new AIUnavailable(err.name === "AbortError" ? "AI request timed out" : err.message);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------ providers */

const providers = {
  /**
   * Groq — OpenAI-compatible chat completions, fastest free option.
   *
   * Default model is qwen/qwen3.8-27b: a real Qwen model (Alibaba's weights),
   * served on Groq's inference hardware instead of Alibaba's own DashScope
   * endpoint. qwen/qwen3.6-27b was the original default here and is a real,
   * documented Groq model id, but live-tested 404 ("does not exist or you
   * do not have access to it") on this account on 2026-09-18 — likely
   * retired/tier-gated after Groq's qwen3-32b migration wave earlier in
   * 2026. That single dead default was the actual root cause of this app
   * silently serving fallback content while Settings said "Configured": the
   * key was fine, every real call 404'd. qwen3.8-27b live-tested working.
   * If your hackathon rubric specifically checks for traffic hitting
   * Alibaba Cloud directly, switching GROQ_MODEL isn't enough — you'd need
   * a genuine DashScope integration instead. If it just checks "is Qwen
   * doing the reasoning", this satisfies it and costs you nothing extra.
   */
  async groq({ prompt, system, json, model }) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new AIUnavailable("GROQ_API_KEY is not set");
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const data = await postJSON(
      "https://api.groq.com/openai/v1/chat/completions",
      { Authorization: `Bearer ${key}` },
      {
        model: model || process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
        messages,
        temperature: json ? 0.3 : 0.6,
        max_tokens: 1400,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }
    );
    return data.choices?.[0]?.message?.content?.trim() || "";
  },

  /** Google Gemini — generateContent endpoint. */
  async gemini({ prompt, system, json }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new AIUnavailable("GEMINI_API_KEY is not set");
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

    const data = await postJSON(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {},
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: json ? 0.3 : 0.6,
          maxOutputTokens: 1400,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }
    );
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim() || "";
  },

  /** OpenRouter — OpenAI-compatible, many free models behind one key. */
  async openrouter({ prompt, system, json }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new AIUnavailable("OPENROUTER_API_KEY is not set");
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const data = await postJSON(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "EduMind AI",
      },
      {
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
        messages,
        temperature: json ? 0.3 : 0.6,
        max_tokens: 1400,
      }
    );
    return data.choices?.[0]?.message?.content?.trim() || "";
  },
};

/* --------------------------------------------------------------- public */

export function activeProvider() {
  return (process.env.AI_PROVIDER || "groq").toLowerCase();
}

/**
 * Models a student can pick between in Settings when the active provider is
 * Groq. Switching gives the app a fresh rate-limit bucket (see aiLimiter in
 * server.js and the "no key" note below) instead of making the student wait
 * out EduMind's own throttle. Qwen 3.8 27B stays first/default so the
 * hackathon's "uses Qwen" requirement holds unless a student deliberately
 * picks something else.
 *
 * Every id below was live-tested against this account's real key via
 * Settings' "Test live connection" on 2026-09-18 and confirmed working —
 * deliberately not padded with anything unverified. llama-3.1-8b-instant
 * was considered and dropped: Groq's own deprecation page confirms it (and
 * llama-3.3-70b-versatile) was shut down for free/developer tier accounts
 * on 2026-08-16, with openai/gpt-oss-20b as Groq's own recommended
 * replacement — already in this list. Don't add a model here on the
 * strength of it appearing in Groq's docs alone: qwen/qwen3.6-27b is still
 * listed as current and recommended in those same docs, and it 404s on
 * this account right now regardless. Verify with the live-connection test
 * before trusting a new id, not the docs.
 */
export const AVAILABLE_MODELS = [
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", note: "Qwen — default, satisfies the track requirement" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Strongest non-Qwen option — rate-limit escape hatch" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Not Qwen — fastest option" },
];

export function isValidModelOverride(id) {
  return activeProvider() === "groq" && AVAILABLE_MODELS.some((m) => m.id === id);
}

/** Reads the student's chosen model (sent as the X-AI-Model header by the
 *  frontend) and returns it only if it's one of AVAILABLE_MODELS — never
 *  hands an arbitrary client-supplied string to the provider. Returns
 *  undefined when absent/invalid, which every call site treats as "use the
 *  server's GROQ_MODEL default". */
export function modelFromRequest(req) {
  const requested = req.get("x-ai-model");
  return isValidModelOverride(requested) ? requested : undefined;
}

/** The actual model id in use — shown in /api/health and Settings so it's
 *  obvious to anyone reading the app (or judging it) which engine answered.
 *  Pass a student's chosen override to reflect what THEY will actually get. */
export function activeModel(override) {
  const p = activeProvider();
  if (p === "groq") {
    if (override && isValidModelOverride(override)) return override;
    return process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  }
  if (p === "gemini") return process.env.GEMINI_MODEL || "gemini-2.0-flash";
  if (p === "openrouter") return process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  return "unknown";
}

/** True when the running model is a Qwen model, regardless of which
 *  transport (Groq, DashScope, OpenRouter) is serving it. */
export function isQwen(override) {
  return /qwen/i.test(activeModel(override));
}

export function aiConfigured() {
  const p = activeProvider();
  if (p === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (p === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (p === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  return false;
}

/**
 * @param {{prompt:string, system?:string, json?:boolean, model?:string}} opts
 * @returns {Promise<string>} raw text from the model
 */
export async function complete(opts) {
  const name = activeProvider();
  const fn = providers[name];
  if (!fn) throw new AIUnavailable(`Unknown AI_PROVIDER "${name}"`);
  return fn(opts);
}

/**
 * Ask for JSON and parse it defensively. Models sometimes wrap output in
 * markdown fences or add a sentence of preamble — strip both before parsing.
 */
export async function completeJSON(opts) {
  const raw = await complete({ ...opts, json: true });
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to slicing out the outermost array or object.
    const start = cleaned.search(/[[{]/);
    const openChar = cleaned[start];
    const closeChar = openChar === "[" ? "]" : "}";
    const end = cleaned.lastIndexOf(closeChar);
    if (start === -1 || end === -1) {
      // This branch was previously silent — a 200 OK from the provider with a
      // body that isn't JSON at all looked identical to "everything's fine"
      // in the logs. Log it so it shows up next to the postJSON errors below.
      console.error(`[ai] completeJSON: model did not return JSON. Raw (first 300 chars): ${cleaned.slice(0, 300)}`);
      throw new AIUnavailable("Model did not return JSON");
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (err) {
      console.error(`[ai] completeJSON: could not parse extracted JSON (${err.message}). Raw (first 300 chars): ${cleaned.slice(0, 300)}`);
      throw new AIUnavailable("Could not parse model JSON: " + err.message);
    }
  }
}

/* ------------------------------------------------------------- live ping */

/**
 * Actually calls the configured provider with a trivial prompt and reports
 * whether it worked. This is the one thing `aiConfigured()` can never tell
 * you: a key can be present, correctly spelled, and still fail on every real
 * request (expired, wrong model, rate-limited, wrong account tier). Settings
 * calls this (via /api/health/ai-check) so "connected" means a request
 * actually succeeded, not just that an env var exists.
 *
 * Cached briefly so repeated page loads / an eager frontend don't spend the
 * free-tier quota on ping traffic instead of real student requests.
 */
let _pingCache = new Map(); // `${provider}:${model}` -> { at, result }
const PING_CACHE_MS = 20_000;

function keyEnvVarFor(provider) {
  if (provider === "groq") return "GROQ_API_KEY";
  if (provider === "gemini") return "GEMINI_API_KEY";
  if (provider === "openrouter") return "OPENROUTER_API_KEY";
  return "the provider's API key";
}

export async function livePing({ force = false, model: overrideModel } = {}) {
  const provider = activeProvider();
  const model = activeModel(overrideModel);
  const cacheKey = `${provider}:${model}`;
  const cached = _pingCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.at < PING_CACHE_MS) {
    return { ...cached.result, cached: true };
  }

  const startedAt = Date.now();
  let result;

  if (!providers[provider]) {
    result = { ok: false, provider, model, error: `Unknown AI_PROVIDER "${provider}"`, latencyMs: 0 };
  } else if (!aiConfigured()) {
    result = { ok: false, provider, model, error: `${keyEnvVarFor(provider)} is not set on the server`, latencyMs: 0 };
  } else {
    try {
      const text = await complete({
        system: "You are a connectivity check. Reply with exactly one word and nothing else.",
        prompt: "Reply with the single word: pong",
        model: provider === "groq" ? model : undefined,
      });
      result = text
        ? { ok: true, provider, model, sample: text.slice(0, 80), latencyMs: Date.now() - startedAt }
        : { ok: false, provider, model, error: "Provider returned an empty response", latencyMs: Date.now() - startedAt };
    } catch (err) {
      // err.message here is whatever postJSON logged above (HTTP status + body,
      // or a timeout) — the exact reason, not a guess.
      result = { ok: false, provider, model, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }

  _pingCache.set(cacheKey, { at: Date.now(), result });
  return { ...result, cached: false, checkedAt: new Date().toISOString() };
}
