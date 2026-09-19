# EduMind AI — Handoff (paste this whole file as your first message in the new chat)

This gives a fresh Claude session everything it needs without re-explaining
from scratch. It replaces the original `Handsoff.md` — that file is now
outdated; this one reflects the real, current state after a full debugging
and feature-build session.

---

## 1. What this is

EduMind AI — a personalized learning platform, originally a Track 4
(Education) hackathon project for Sri Sairam Engineering College. Reads a
student's quiz results and rebuilds their study plan around whatever they're
actually getting wrong.

Architecture unchanged: `client/` React+Vite on Vercel, `server/` Node+Express
on Render, MongoDB Atlas. AI via a pluggable provider layer
(`server/src/services/ai.js`) — `groq | gemini | openrouter`, one env var,
zero code changes. Currently on Groq.

**EnterPro is still untouched** — out of scope for this whole session, same
as before. Its section from the original handoff still applies verbatim if
you need it; not repeated here.

---

## 2. The actual root cause of the original bug (important — read this)

The original symptom: Settings said "Qwen — Connected / Configured" while
every real AI feature silently served offline/seeded content.

**Cause, confirmed by the user's own live test, not guessed:** the app was
hardcoded to `GROQ_MODEL=qwen/qwen3.6-27b`. That model 404s on this account —
`"The model qwen/qwen3.6-27b does not exist or you do not have access to
it."` The API key was always fine. Every single AI call was failing on a
dead model name, and the old health check only verified the key *existed*,
never that a real call *succeeded* — so it lied.

**Fixed**: default model is now `qwen/qwen3.8-27b`, live-tested working by
the user. A genuine live-request health check now exists (see §4).

**Open, unresolved contradiction, worth knowing:** Groq's own docs
(`console.groq.com/docs/deprecations` and `/docs/models`) still list
`qwen/qwen3.6-27b` as current and even recommend it as a migration target for
other deprecated models — yet it 404s on this account right now. Don't trust
Groq's docs alone for what's actually callable; always verify with the live
connection test in Settings before adding or trusting a model id. This bit
us once already this session — see §4.

**A second near-miss, already caught and fixed:** `llama-3.1-8b-instant` was
briefly added to the model switcher and shipped in one interim zip. A later
check found Groq's deprecation page confirms it (and `llama-3.3-70b-versatile`,
already known dead) was shut down for free/developer accounts on 2026-08-16.
It's been removed. **If you're the assistant reading this in a new chat:
don't re-add it, and don't add any new model to `AVAILABLE_MODELS` without
the user live-testing it first via Settings.**

---

## 3. Current AI config

```
AI_PROVIDER=groq
GROQ_API_KEY=<user's key>
GROQ_MODEL=qwen/qwen3.8-27b
```

**Action the user still owns**: update `GROQ_MODEL` to `qwen/qwen3.8-27b` in
**Render's** environment variables (not Vercel) and redeploy, if not already
done. Everything in the code defaults to this now, but the env var (if set)
overrides the code default.

Model switcher (Settings page): lets a student switch between
`qwen/qwen3.8-27b` (default, Qwen), `openai/gpt-oss-120b`,
`openai/gpt-oss-20b` — all three personally live-tested working on this
account. Switching sends an `X-AI-Model` header, validated server-side
against this exact list (`server/src/services/ai.js` → `AVAILABLE_MODELS`,
`isValidModelOverride`, `modelFromRequest`). The rate limiter
(`aiLimiter` in `server.js`) buckets per `(IP, model)`, so switching models
gives a fresh 20/min allowance instead of waiting one out.

---

## 4. Live AI health check (replaces the old lying one)

- `GET /api/health` — fast, cheap, what Render's own uptime monitor polls.
  Reports config only (provider, model, whether a key is *present*).
- `GET /api/health/ai-check` — actually calls the model. Rate-limited
  (5/min) and cached (20s) so it can't burn the free-tier quota. Returns
  `{ok, provider, model, error, latencyMs}` — `error` is the literal
  upstream text (401/404/429/etc.), not a guess.
- Settings has a "Test live connection" button wired to this. **This is the
  ground truth for whether a model actually works on this account** — more
  reliable than Groq's own docs, per §2.

---

## 5. Everything built this session (on top of the original 9 screens)

**Diagnostics / reliability**
- Real live-request health check (§4), replacing the key-presence-only check.
- `console.error` logging added to every AI fallback path and to two
  previously-silent JSON-parse failure branches in `ai.js` — every fallback
  now leaves a traceable log line naming the feature and the real error.
- Model switcher (§3).

**Resource recommendations** — Tutor, Doubts, Study Planner, and Career
Guidance now suggest real learning resources. Design principle throughout:
**never trust a model-supplied URL blindly.**
  - `server/src/services/resources.js` — `sanitizeResources()` only keeps a
    `url` if its hostname is on a small trusted allowlist (LeetCode, MDN,
    W3Schools, official docs, etc.); otherwise it's dropped and the frontend
    shows a "search for this" link instead (`ResourceList` component in
    `client/src/components/ui.jsx`) — never a link that might not exist.
  - Tutor/Doubts: resources are matched by **keyword detection against the
    question** (`detectTopicKeyword` in `prompts.js`), not asked of the
    model at all — guarantees no hallucinated links ever reach chat, and
    keeps resources off messages with no clear topic match.
  - Planner/Career: the model *is* asked for resources (JSON schema), then
    sanitized. Fallback (no AI) uses the same curated static set.
  - **Career certifications** are a separate concept from generic resources:
    `sanitizeCertifications()` always overrides whatever URL the model
    proposes with the real platform homepage (Coursera, Microsoft Learn,
    Google, AWS) — verified via web search this session, never a specific
    course page. See `CERT_PLATFORM_HOMEPAGE` in `resources.js`.

**Adaptive placement assessment** — new `/onboarding` route, shown once
right after registration (`client/src/pages/Onboarding.jsx`,
`server/src/routes/assessment.js`). 5 AI-generated questions, difficulty
escalates/de-escalates per answer, cycles through the student's subjects.
Grading always server-side (same secure pattern as the real quiz — answers
never reach the browser). On completion: estimates a level, strengths,
weaknesses; seeds priority-1 study tasks for weak subjects. Falls back to
the seeded question bank if AI is down. "Skip for now" always available.
Stateless by design — see the comment block at the top of `assessment.js`
for why (it never pollutes the regular `Attempt` stats used elsewhere).

**AI-suggested topics** — `GET /api/quiz/suggest-topic` and
`GET /api/assignments/suggest-topic`: AI picks a specific, well-scoped topic
tied to the student's weakest area (falls back to just naming the weakest
topic directly if AI is down). Small "Suggest a topic" buttons in both UIs.

**Assignment submission + AI scoring** — new panel under each assignment.
Type an answer or upload a `.txt`/`.md` file (read client-side via
`FileReader`, appended into the textarea — **no file ever touches the
server**, so there's no upload storage to manage). AI grades against that
assignment's own brief/marking scheme, returns a score/100 + strengths +
improvements. Fallback (no AI): an honest length-based estimate, explicitly
labeled as not a real content review. New `submission` field on the
`Assignment` schema. Known gap: "Submit a revised answer" only clears the
view client-side — there's no dedicated delete-submission endpoint, but the
next real submit cleanly overwrites it server-side, so nothing is lost.

**AI Tutor subject/topic filter** — dropdown + text field above the chat
input. Subject defaults once to the student's first subject (session
default), both editable before any message (per-message override, per the
user's explicit choice). An explicit topic takes priority over keyword
detection when picking which resources to attach.

**Streak** — now a real card in the sidebar (flame icon, count, tiered
encouragement copy) instead of a small topbar tag. The topbar version was
removed entirely per explicit request — streak now lives only in the
sidebar.

**Login/Register cleanup** — pre-filled Sridhar demo credentials and the
visible demo-box removed from Login; the "Sridhar T" example placeholder
removed from Register's name field.

**Desktop layout fix** — `.view` (the main content column) now has
`margin: 0 auto` and a wider `max-width: 1400px`, so leftover space on wide
screens is split evenly on both sides instead of dumping it all on the right
edge (confirmed by the user: the dead space was on the right, not the left
as first assumed — centering fixes it regardless of which side it's on).

**Favicon** — brand-colored "E" monogram SVG (`client/public/favicon.svg`),
gradient matches the sidebar/login brand mark (`#2f5bea` → `#7a46e0`).

---

## 6. What's genuinely NOT done / not verified

- **No end-to-end test against a live database or a live Groq key** — every
  change this session was verified by: `node --check` on every backend file,
  actually booting `server.js` far enough to reach (and fail cleanly on) the
  Mongo connection stage, and `npm run build` on the client after every
  batch of changes. Nothing has been run against real seeded data or a real
  AI response yet. **First thing to do in a new session once redeployed:
  click "Test live connection" in Settings, then actually use Tutor/Quiz/
  Planner/Career once each and confirm they say `source: "ai"` not
  `"fallback"`.**
- Assignments/Quiz don't have "resources" recommendations (Tutor/Planner/
  Career/Doubts do) — skipped to keep scope sane, not because it wouldn't
  fit; easy to add the same way if wanted.
- No dedicated delete-submission endpoint for assignments (see §5).
- The EnterPro deployment target hasn't been touched at all this session —
  still exactly where the original handoff left it.
- Model list (§3) is deliberately conservative (3 models, all personally
  live-tested) rather than exhaustive — don't pad it without testing.

---

## 7. Demo accounts (unchanged, still seeded)

All password `edumind123`:
```
sridhar@edumind.dev     ← full dataset, use this one
gayathri@edumind.dev
dhanush@edumind.dev
```
No longer pre-filled or shown on the login page itself (removed per request)
— still work exactly the same to log in manually.

---

## 8. New/changed files this session

```
server/src/services/resources.js     NEW — resource sanitization + curated fallback sets
server/src/routes/assessment.js      NEW — adaptive placement assessment
client/src/pages/Onboarding.jsx      NEW — assessment UI, shown once after registration
client/public/favicon.svg            NEW — brand favicon

server/src/services/ai.js            live-ping health check, model switcher, AVAILABLE_MODELS
server/src/server.js                 /api/health/ai-check, per-model rate limiting, route mounts
server/src/models/index.js           resourceSchema; resources/certifications/submission/assessment fields
server/src/services/prompts.js       detectTopicKeyword, RESOURCE_RULES, suggestTopicPrompt, gradingPrompt,
                                      learnerContext extended with focusSubject/focusTopic
server/src/routes/tutor.js           resources, subject/topic filter, error logging
server/src/routes/doubts.js          resources, error logging
server/src/routes/planner.js         resources per task, error logging
server/src/routes/career.js          resources + certifications, error logging
server/src/routes/quiz.js            suggest-topic route, error logging
server/src/routes/assignments.js     suggest-topic route, submit+grade route, error logging

client/src/components/ui.jsx         ResourceList component
client/src/components/Layout.jsx     sidebar StreakCard; topbar streak chip removed
client/src/pages/Settings.jsx        live connection test, model picker, reactive AI-engine label
client/src/pages/Login.jsx           demo credentials/demo-box removed
client/src/pages/Register.jsx        placeholder cleanup; redirects to /onboarding
client/src/pages/Tutor.jsx           subject/topic filter, resources rendering
client/src/pages/Planner.jsx         resources rendering per task
client/src/pages/Career.jsx          resources + certifications rendering
client/src/pages/Quiz.jsx            suggest-topic button
client/src/pages/Assignments.jsx     suggest-topic button, submission + AI review panel
client/src/App.jsx                   /onboarding route
client/src/api.js                    X-AI-Model header interceptor
client/src/styles.css                streak card, resource list, link-btn, centered .view, generalized .ring
client/index.html                    favicon link tag
server/.env.example, README.md       qwen3.6 → qwen3.8 references updated
```

Everything else is exactly as the original `Handsoff.md` described it
(deployment steps, Render/Vercel config, verification checklist — refer to
the repo's root `README.md` for those, not repeated here).

---

## 9. Suggested next steps, in order

1. Redeploy with `GROQ_MODEL=qwen/qwen3.8-27b` on Render (if not already).
2. Click "Test live connection" in Settings — confirm `ok: true`.
3. Use Tutor, Quiz, Planner, Career, Doubts once each — confirm each response
   says `source: "ai"`, not `"fallback"`.
4. Try the onboarding assessment end to end as a fresh registration.
5. Try an assignment submission (typed + one `.txt` upload) and confirm real
   AI feedback comes back, not the length-based fallback.
6. From there: decide whether to extend resources to Assignments/Quiz, add a
   delete-submission endpoint, or finally start on EnterPro.
