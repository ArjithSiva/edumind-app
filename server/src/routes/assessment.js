import { Router } from "express";
import { Quiz, Task } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { completeJSON, aiConfigured, modelFromRequest } from "../services/ai.js";
import { quizPrompt } from "../services/prompts.js";
import { resourcesFor } from "../services/resources.js";

/**
 * Adaptive placement assessment, run once right after registration (see
 * item 5 of the feature request): a short, difficulty-adjusting quiz that
 * estimates a level and per-subject strengths/weaknesses, then seeds the
 * student's first study-plan tasks from the weak spots it finds.
 *
 * Deliberately stateless: each question is a real, single-question Quiz
 * document (same model and grading pattern as the regular quiz feature —
 * see quiz.js), so the correct answer is never sent to the browser and
 * grading is always server-authoritative. Progress between steps (which
 * step we're on, the running per-subject tally) is round-tripped through
 * the client instead of a server-side session store — this keeps the route
 * simple and stateless, and the only thing that would be "cheated" by a
 * tampered tally is the final self-reported level shown back to the same
 * student, used only to seed non-binding starter tasks. Nothing graded,
 * shared, or persisted elsewhere depends on it.
 */

const router = Router();
router.use(protect);

const TOTAL_STEPS = 5;
const LADDER = ["Easy", "Medium", "Hard"];

function nextDifficulty(current, wasCorrect) {
  const i = LADDER.indexOf(current);
  if (i === -1) return "Medium";
  if (wasCorrect === true) return LADDER[Math.min(i + 1, LADDER.length - 1)];
  if (wasCorrect === false) return LADDER[Math.max(i - 1, 0)];
  return current;
}

function levelFromPercentage(pct) {
  if (pct >= 75) return "Advanced";
  if (pct >= 45) return "Intermediate";
  return "Beginner";
}

const forClientQuestion = (quiz) => ({
  q: quiz.questions[0].q,
  options: quiz.questions[0].options,
});

/** One diagnostic question: AI first, the seeded question bank as a
 *  fallback, so onboarding never dead-ends without a live key. Always
 *  materialized as its own single-question Quiz doc, tagged so it never
 *  shows up as a real quiz anywhere else in the app (nothing queries
 *  Quiz.find({user}) outside this file — only by _id). */
async function makeQuestion(user, subject, difficulty, model) {
  let questions = null, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: quizPrompt(subject, difficulty, 1, user), model });
    const list = Array.isArray(data) ? data : data.questions;
    questions = (list || [])
      .filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        q: String(q.q),
        options: q.options.map(String),
        answerIndex: Math.max(0, Math.min(Number(q.answerIndex) || 0, q.options.length - 1)),
        explanation: String(q.explanation || ""),
      }))
      .slice(0, 1);
    if (!questions.length) throw new Error("no usable question");
  } catch (err) {
    console.error(`[assessment] falling back to seeded bank for "${subject}": ${err.message}`);
    source = "bank";
    const bank = (await Quiz.findOne({ user: null, subject })) || (await Quiz.findOne({ user: null }));
    if (!bank || !bank.questions?.length) return null;
    questions = [bank.questions[Math.floor(Math.random() * bank.questions.length)]];
  }
  return Quiz.create({ user: user._id, topic: `Diagnostic: ${subject}`, subject, difficulty, questions, source });
}

/** POST /api/assessment/start — first question, always Medium difficulty. */
router.post("/start", asyncHandler(async (req, res) => {
  const subject = req.user.subjects[0] || "Aptitude";
  const quiz = await makeQuestion(req.user, subject, "Medium", modelFromRequest(req));
  if (!quiz) {
    return res.status(503).json({ message: "No AI key configured and the question bank is empty. Skip the assessment for now — you can still use the app." });
  }
  res.status(201).json({
    quizId: quiz._id, question: forClientQuestion(quiz),
    subject, difficulty: "Medium", step: 1, totalSteps: TOTAL_STEPS,
  });
}));

/**
 * POST /api/assessment/answer  { quizId, answerIndex, step, tally }
 * Grades the given question, decides the next difficulty, and either
 * returns the next question or — on the last step — finalizes the
 * assessment and seeds starter tasks for whatever came back weak.
 */
router.post("/answer", asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.body.quizId, user: req.user._id });
  if (!quiz) return res.status(404).json({ message: "Assessment question not found or already answered" });

  const q = quiz.questions[0];
  const answerIndex = Number(req.body.answerIndex);
  const wasCorrect = answerIndex === q.answerIndex;
  const subject = quiz.subject;
  const step = Number(req.body.step) || 1;

  const tally = { ...(req.body.tally && typeof req.body.tally === "object" ? req.body.tally : {}) };
  const prev = tally[subject] || { correct: 0, total: 0 };
  tally[subject] = { correct: prev.correct + (wasCorrect ? 1 : 0), total: prev.total + 1 };

  if (step >= TOTAL_STEPS) {
    const subjectScores = Object.entries(tally).map(([s, t]) => ({
      subject: s, percentage: Math.round((t.correct / t.total) * 100),
    }));
    const totalCorrect = Object.values(tally).reduce((a, t) => a + t.correct, 0);
    const totalCount = Object.values(tally).reduce((a, t) => a + t.total, 0);
    const overall = totalCount ? Math.round((totalCorrect / totalCount) * 100) : 50;
    const level = levelFromPercentage(overall);
    const strengths = subjectScores.filter((s) => s.percentage >= 70).map((s) => s.subject);
    const weaknesses = subjectScores.filter((s) => s.percentage < 50).map((s) => s.subject);

    req.user.assessment = { level, strengths, weaknesses, completedAt: new Date() };
    await req.user.save();

    // Give the study plan an immediate, visible head start on whatever this
    // just surfaced, rather than waiting for the student's first real quiz.
    for (const w of weaknesses.slice(0, 3)) {
      const exists = await Task.findOne({ user: req.user._id, topic: w, autoScheduled: true, completed: false });
      if (!exists) {
        await Task.create({
          user: req.user._id, title: `Strengthen ${w} fundamentals`, subject: w, topic: w,
          scheduledFor: new Date(), durationMinutes: req.user.dailyTargetMinutes || 45,
          priority: 1, autoScheduled: true, note: "Added from your placement assessment",
          resources: resourcesFor(w, w),
        });
      }
    }

    return res.json({ done: true, wasCorrect, level, strengths, weaknesses, subjectScores, overall });
  }

  const nextSubject = req.user.subjects[step % req.user.subjects.length] || subject;
  const difficulty = nextDifficulty(quiz.difficulty, wasCorrect);
  const nextQuiz = await makeQuestion(req.user, nextSubject, difficulty, modelFromRequest(req));
  if (!nextQuiz) {
    return res.json({
      done: true, wasCorrect, level: "Intermediate", strengths: [], weaknesses: [], subjectScores: [], overall: null,
      note: "Stopped early — no more questions were available, but nothing you've done so far is lost.",
    });
  }
  res.json({
    done: false, wasCorrect, quizId: nextQuiz._id, question: forClientQuestion(nextQuiz),
    subject: nextSubject, difficulty, step: step + 1, totalSteps: TOTAL_STEPS, tally,
  });
}));

export default router;
