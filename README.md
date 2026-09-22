# EduMind AI

A personalized learning platform that rebuilds your study plan from how you actually perform. Quiz badly on recursion and recursion moves to the top of tomorrow's plan — automatically.

Built for Track 4 (Education).

```
client/   React + Vite      → deploys to Vercel
server/   Node + Express    → deploys to Render
          MongoDB (Mongoose) → MongoDB Atlas
```

---

## What's in it

| Feature | What it does |
|---|---|
| **Dashboard** | Streak, study hours, overall score, activity feed, weak-topic callouts |
| **AI Tutor** | Chat tutor that knows your year, subjects and weak topics. Saved sessions. |
| **Quiz Generator** | AI-written MCQs on any topic. Graded server-side, explanations for every answer. |
| **Study Planner** | Goals and tasks. One button rebuilds the week around your lowest scores. |
| **Progress Dashboard** | Trend line, subject bars, weak areas, habit tracking |
| **Career Guidance** | Role matches grounded in your measured averages, not generic advice |
| **Assignment Generator** | Full briefs with objectives, graded tasks and a marking scheme. Export as `.md`. |
| **Doubt Forum** | Post a question, get an AI answer instantly, classmates add better ones |

Plus JWT auth, light/dark mode, and a seeded demo dataset.

**The loop that matters:** score under 60% on a quiz → the server writes a revision task into your planner at priority 1 → it appears as today's focus on the dashboard. Nothing else in the app does this, and it's the thing worth showing judges.

---

## The fallback design

Every AI call has a deterministic fallback. No API key, rate limit hit, provider down — the app still works, serving seeded questions and pre-written explanations instead. The UI says so with an amber banner rather than pretending.

This is deliberate. Free AI tiers rate-limit, and a hackathon demo that dies on stage is worse than one that degrades honestly.

---

## Step 1 — Get the code running locally

You need **Node 18+** and a **MongoDB Atlas** account (both free).

```bash
git clone <your-repo-url> edumind-app
cd edumind-app
```

## Step 2 — MongoDB Atlas (free M0 cluster)

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register)
2. **Create** → **M0 Free** → pick the region closest to you → Create
3. **Database Access** → Add New Database User → username + password → *Read and write to any database*
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
   Render's outbound IPs aren't fixed on the free plan, so this is required.
5. **Database** → Connect → Drivers → copy the connection string

It looks like `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`.
Replace `<password>` with the real password and insert `/edumind` before the `?` so it targets a named database.

## Step 3 — Get a free AI API key

Pick one. **Groq is the default, and it's what actually runs Qwen for this project.**

| Provider | Where | Notes |
|---|---|---|
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | Free, no card, very fast. Default model is `qwen/qwen3.8-27b` — a real Qwen model, hosted on Groq's inference hardware. Switch models any time from Settings in the app. |
| **Google Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier on `gemini-2.0-flash`, no card. |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | One key, many free models, including a free Qwen (`qwen/qwen3-next-80b-a3b-instruct:free`). |

All three are wired up. Switch between them with the `AI_PROVIDER` env var — no code changes.

**On "uses Qwen as the AI engine":** the Groq default genuinely runs Qwen's weights — `GROQ_MODEL=qwen/qwen3.8-27b` is Alibaba's model, just served on Groq's infrastructure instead of Alibaba's own DashScope endpoint. That's faster and reuses one key. (`qwen/qwen3.6-27b` was the original default here but 404s as of 2026-09-18 — confirmed dead via Settings' live connection test, not just assumed.) If a rubric specifically checks that requests hit Alibaba Cloud directly, that's a different integration (Alibaba Cloud Model Studio / DashScope, OpenAI-compatible API, needs its own key) — ask if you need that wired up instead; the provider layer is built so swapping is a few lines, not a rewrite.

`/api/health` and the Settings page both show the exact model currently answering, so you (or a judge reading the code) can verify Qwen is actually what's reasoning, not just configured and unused.

> Never commit a key. `.env` is gitignored. If you ever paste one into a public repo, revoke it immediately — scanners find them within minutes.

> **If your key is already set and answers still look wrong:** check the Render logs first. `services/ai.js` logs every failed AI call with the exact status code and body — a decommissioned model, an expired key, and a malformed request all produce different logged errors, but from the browser they all just look like the offline fallback banner. Don't guess; read the log line.

## Step 4 — Run the backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env`:

```bash
MONGO_URI=mongodb+srv://...          # from step 2
JWT_SECRET=<run: openssl rand -hex 32>
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...                 # from step 3
CLIENT_URL=http://localhost:5173
```

Load the demo dataset, then start:

```bash
npm run seed    # wipes and repopulates — deterministic every time
npm run dev
```

You should see `EduMind API listening on :5000` and `AI provider: groq (key present)`.

Check it: <http://localhost:5000/api/health>

## Step 5 — Run the frontend

```bash
cd ../client
npm install
npm run dev
```

Open <http://localhost:5173>. Leave `VITE_API_URL` unset locally — Vite proxies `/api` to port 5000.

**Demo accounts** (password `edumind123` for all three):

```
sridhar@edumind.dev     ← full dataset, use this one
gayathri@edumind.dev
dhanush@edumind.dev
```

---

## Step 6 — Deploy the backend to Render

1. Push to GitHub.
2. [render.com](https://render.com) → **New** → **Web Service** → connect your repo
3. Configure:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
   - **Health Check Path**: `/api/health`
4. **Environment** → add:

   ```
   NODE_ENV=production
   MONGO_URI=<your Atlas string>
   JWT_SECRET=<long random string>
   AI_PROVIDER=groq
   GROQ_API_KEY=<your key>
   CLIENT_URL=<leave blank for now — you'll fill it in step 8>
   ```

5. Deploy. Note your URL: `https://edumind-api.onrender.com`

There's a `render.yaml` blueprint in `server/` if you prefer **New → Blueprint** instead of clicking through.

**Seed the production database** from your machine — point your local `.env` at the same Atlas cluster and run `npm run seed` once.

> **Free Render instances sleep after 15 minutes idle.** The first request after that takes 30–50 seconds to wake. Before you demo, open `/api/health` in a tab to warm it up. The frontend already shows a helpful timeout message, but don't let a judge be the one who wakes it.

## Step 7 — Deploy the frontend to Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same repo
2. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (auto-detected)
   - Build command and output directory are already set by `vercel.json`
3. **Environment Variables** → add:

   ```
   VITE_API_URL = https://edumind-api.onrender.com
   ```

   No trailing slash.
4. Deploy. You get `https://edumind-ai.vercel.app`.

> `VITE_` variables are baked in at build time, not read at runtime. If you change `VITE_API_URL` you must redeploy for it to take effect.

## Step 8 — Connect the two

Go back to Render → Environment → set:

```
CLIENT_URL=https://edumind-ai.vercel.app
```

Save. Render redeploys automatically.

The server also allows any `*.vercel.app` origin, so preview deployments work without extra config. You can comma-separate `CLIENT_URL` for several origins:

```
CLIENT_URL=http://localhost:5173,https://edumind-ai.vercel.app
```

---


## Verifying it worked

1. `https://your-api.onrender.com/api/health` → `{"status":"ok","aiConfigured":true}`
2. Open the Vercel URL, sign in with the demo account
3. Go to **Settings** — it shows API status, which provider is active, and whether the key is live
4. Generate a quiz. If the amber banner appears, your key isn't reaching the server.

---

## Demo script (four minutes)

1. **Dashboard** — point at the weak-topic callout. "This wasn't configured; it's computed from twelve quiz attempts."
2. **AI Tutor** — ask something off-script. Judges assume demos are canned; this proves it isn't.
3. **Quiz Generator** — generate on Recursion, **deliberately answer badly**.
4. **Watch the result screen** — a blue banner says a revision task was added to today's plan.
5. **Planner** — the task is there, marked *Auto*, at the top.
6. **Progress** — the new attempt is on the trend line and dragged the subject average down.
7. **Toggle dark mode** on the way out.

Steps 3–5 are the pitch. Everything else is table stakes.

---

## Common problems

| Symptom | Cause |
|---|---|
| `Network Error` in the browser | `VITE_API_URL` wrong, or you changed it without redeploying |
| CORS error in the console | `CLIENT_URL` on Render doesn't match your Vercel URL exactly |
| First request hangs ~40s | Render free instance waking up. Normal. |
| Amber "offline bank" banner, but Settings shows "Configured" | The key is valid but the model id is wrong or decommissioned — check Render's logs for the exact `[ai]` error line, not just the Settings page (which only checks the key exists, not that calls succeed) |
| `MongoServerError: bad auth` | Password not substituted, or special characters need URL-encoding |
| Login works, everything else 401 | `JWT_SECRET` changed between deploys, invalidating tokens. Sign in again. |
| Blank page on refresh at `/quiz` | `vercel.json` rewrites missing — it's included, check Root Directory is `client` |

---

## Project structure

```
server/src/
  models/index.js       All Mongoose schemas
  services/ai.js        Pluggable provider layer (groq | gemini | openrouter)
  services/prompts.js   Every prompt + deterministic fallbacks
  routes/               auth, tutor, quiz, planner, progress, career, assignments, doubts
  seed/dataset.js       The demo data — edit this to change what judges see
  seed/seed.js          Wipe and repopulate

client/src/
  context/              AuthContext (JWT), ThemeContext (dark mode)
  components/ui.jsx     Shared primitives + the markdown renderer
  components/Layout.jsx Sidebar, topbar, mobile drawer
  pages/                One file per screen
  styles.css            All design tokens — both themes live here
```

## Security notes

- Passwords hashed with bcrypt, never returned by any endpoint (`select: false`)
- Quiz answer keys are stripped before questions reach the browser — grading is server-side only, so you can't read the answers out of devtools
- Rate limiting on auth (40 per 15 min) and AI routes (20 per min)
- Model output is HTML-escaped before rendering, so a prompt injection can't inject markup
- Every route scopes queries to `req.user._id` — one account can't read another's data

## Editing the demo data

`server/src/seed/dataset.js` is the single source of truth. The attempt history is shaped so Recursion (40%) and SQL Joins (55%) read as the weak topics, which is what drives the planner narrative. Change the scores there and every screen follows.

Re-run `npm run seed` after editing.
