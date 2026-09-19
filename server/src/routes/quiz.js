import { Router } from "express";
import { Quiz, Attempt, Task } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { completeJSON, aiConfigured, modelFromRequest } from "../services/ai.js";
import { quizPrompt, suggestTopicPrompt } from "../services/prompts.js";

const router = Router();
router.use(protect);

/** Strip answers before sending a quiz to the browser. */
const forClient = (quiz) => ({
  _id: quiz._id, topic: quiz.topic, subject: quiz.subject,
  difficulty: quiz.difficulty, source: quiz.source,
  questions: quiz.questions.map((q) => ({ q: q.q, options: q.options })),
});

function guessSubject(topic, subjects) {
  const t = String(topic).toLowerCase();
  return subjects.find((s) => t.includes(s.toLowerCase())) || subjects[0] || "General";
}

/** GET /api/quiz/suggest-topic — one AI-picked topic tied to weak areas,
 *  for the "Suggest a topic" button next to the topic field. */
router.get("/suggest-topic", asyncHandler(async (req, res) => {
  const rows = await Attempt.aggregate([
    { $match: { user: req.user._id } },
    { $group: { _id: "$topic", subject: { $first: "$subject" }, avg: { $avg: "$percentage" } } },
    { $match: { avg: { $lt: 60 } } },
    { $sort: { avg: 1 } },
    { $limit: 3 },
  ]);
  const weakTopics = rows.map((r) => r._id).filter(Boolean);

  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: suggestTopicPrompt(req.user, weakTopics, "quiz"), model: modelFromRequest(req) });
    if (!data?.topic) throw new Error("no usable topic");
    return res.json({
      topic: String(data.topic).slice(0, 120),
      subject: guessSubject(data.subject || data.topic, req.user.subjects),
      reason: String(data.reason || "").slice(0, 200),
      source: "ai",
    });
  } catch (err) {
    console.error(`[quiz] suggest-topic falling back for user ${req.user._id}: ${err.message}`);
    const pick = rows[0];
    const topic = pick?._id || req.user.subjects[0] || "Python fundamentals";
    return res.json({
      topic, subject: guessSubject(pick?.subject || topic, req.user.subjects),
      reason: pick ? `Your average here is ${Math.round(pick.avg)}%.` : "A good place to start.",
      source: "rules",
    });
  }
}));

/** POST /api/quiz/generate  { topic, difficulty, count } */
router.post("/generate", asyncHandler(async (req, res) => {
  const topic = (req.body.topic || "").trim() || "Python fundamentals";
  const difficulty = ["Easy", "Medium", "Hard"].includes(req.body.difficulty) ? req.body.difficulty : "Medium";
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 3), 10);
  const subject = guessSubject(topic, req.user.subjects);

  let questions = null, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: quizPrompt(topic, difficulty, count, req.user), model: modelFromRequest(req) });
    const list = Array.isArray(data) ? data : data.questions;
    questions = (list || [])
      .filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        q: String(q.q),
        options: q.options.map(String),
        answerIndex: Math.max(0, Math.min(Number(q.answerIndex) || 0, q.options.length - 1)),
        explanation: String(q.explanation || ""),
      }))
      .slice(0, count);
    if (!questions.length) throw new Error("no usable questions");
  } catch (err) {
    console.error(`[quiz] falling back to seeded bank for "${topic}": ${err.message}`);
    source = "bank";
    // Serve the closest seeded quiz so the demo still works without a key.
    const bank =
      (await Quiz.findOne({ user: null, topic: new RegExp(topic.split(/[\s—-]+/)[0], "i") })) ||
      (await Quiz.findOne({ user: null, subject })) ||
      (await Quiz.findOne({ user: null }));
    if (!bank) return res.status(503).json({ message: "No AI key configured and the question bank is empty. Run `npm run seed`." });
    questions = bank.questions.slice(0, count);
  }

  const quiz = await Quiz.create({
    user: req.user._id, topic, subject, difficulty, questions, source,
  });
  res.status(201).json({ quiz: forClient(quiz), source });
}));

/** GET /api/quiz/bank — the seeded public question bank */
router.get("/bank", asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find({ user: null }).lean();
  res.json({ quizzes: quizzes.map(forClient) });
}));

/** GET /api/quiz/:id */
router.get("/:id", asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });
  res.json({ quiz: forClient(quiz) });
}));

/**
 * POST /api/quiz/:id/submit  { answers: number[], durationSeconds }
 * Grades server-side, then closes the loop: a weak score schedules a
 * revision task at the top of the planner.
 */
router.post("/:id/submit", asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const results = quiz.questions.map((q, i) => ({
    correct: answers[i] === q.answerIndex,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
  }));
  const score = results.filter((r) => r.correct).length;
  const total = quiz.questions.length;
  const percentage = Math.round((score / total) * 100);

  const attempt = await Attempt.create({
    user: req.user._id, quiz: quiz._id, topic: quiz.topic, subject: quiz.subject,
    answers, score, total, percentage,
    durationSeconds: Number(req.body.durationSeconds) || 0,
  });

  let scheduled = null;
  if (percentage < 60) {
    const existing = await Task.findOne({
      user: req.user._id, topic: quiz.topic, completed: false, autoScheduled: true,
    });
    if (!existing) {
      scheduled = await Task.create({
        user: req.user._id,
        title: `Revise ${quiz.topic}`,
        subject: quiz.subject, topic: quiz.topic,
        scheduledFor: new Date(), durationMinutes: 45, priority: 1, autoScheduled: true,
        note: `Added automatically — you scored ${percentage}% on this topic`,
      });
    }
  }

  res.json({ attempt, results, score, total, percentage, scheduledTask: scheduled });
}));

/** GET /api/quiz/history/all */
router.get("/history/all", asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ attempts });
}));

export default router;
