import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { activeProvider, activeModel, isQwen, aiConfigured, livePing, AVAILABLE_MODELS, modelFromRequest } from "./services/ai.js";

import authRoutes from "./routes/auth.js";
import tutorRoutes from "./routes/tutor.js";
import quizRoutes from "./routes/quiz.js";
import plannerRoutes from "./routes/planner.js";
import progressRoutes from "./routes/progress.js";
import careerRoutes from "./routes/career.js";
import assignmentRoutes from "./routes/assignments.js";
import doubtRoutes from "./routes/doubts.js";
import assessmentRoutes from "./routes/assessment.js";

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy

/* ----------------------------------------------------------------- CORS */
// Comma-separate CLIENT_URL to allow several origins (local + Vercel preview + prod).
const origins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                       // curl, Postman, health checks
    if (origins.includes(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true); // preview deploys
    cb(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

/* ---------------------------------------------------------- rate limits */
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000, max: 40,
  message: { message: "Too many attempts. Wait 15 minutes and try again." },
}));

// AI endpoints are the expensive ones — protect the free tier from a runaway loop.
// Bucketed per (IP, model) rather than just per IP: each Groq model carries its
// own quota, so a student who hits this cap on Qwen can switch models in
// Settings and get a fresh 20/minute allowance instead of waiting it out.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  keyGenerator: (req) => `${req.ip}:${req.get("x-ai-model") || "default"}`,
  message: { message: "You're going faster than the free tier allows for this model. Switch models in Settings, or wait a minute." },
});
["/api/tutor", "/api/quiz", "/api/career", "/api/assignments", "/api/assessment"].forEach((p) => app.use(p, aiLimiter));

/* -------------------------------------------------------------- routes */
app.get("/", (req, res) => res.json({ name: "EduMind AI API", version: "1.0.0", docs: "/api/health" }));

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  uptime: Math.round(process.uptime()),
  aiProvider: activeProvider(),
  aiModel: activeModel(),
  aiEngine: isQwen() ? "Qwen" : activeModel(),
  aiConfigured: aiConfigured(),
  availableModels: activeProvider() === "groq" ? AVAILABLE_MODELS : [],
  timestamp: new Date().toISOString(),
}));

// Deliberately separate from /api/health above: that route is what Render's
// own health-check monitor polls, so it stays instant and free. This one
// actually calls the AI provider — "aiConfigured" only proves a key exists
// in the environment, never that a real request succeeds against it, which
// is the exact gap that let this app report "Connected / Configured" while
// silently serving fallback content. Rate-limited (not the shared aiLimiter)
// and cached for 20s server-side so it can't be used to spend the free-tier
// quota that real student requests need.
const aiCheckLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: { message: "Too many connection tests. Wait a minute and try again." },
});
app.get("/api/health/ai-check", aiCheckLimiter, async (req, res) => {
  const result = await livePing({ force: req.query.force === "1", model: modelFromRequest(req) });
  res.json(result);
});

app.use("/api/auth", authRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/doubts", doubtRoutes);
app.use("/api/assessment", assessmentRoutes);

app.use(notFound);
app.use(errorHandler);

/* --------------------------------------------------------------- start */
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`EduMind API listening on :${PORT}`);
      console.log(`AI provider: ${activeProvider()} running ${activeModel()}${isQwen() ? " (Qwen)" : ""} (${aiConfigured() ? "key present" : "NO KEY — serving fallback content"})`);
      console.log(`Allowed origins: ${origins.join(", ")} + *.vercel.app`);
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
