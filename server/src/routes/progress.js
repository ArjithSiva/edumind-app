import { Router } from "express";
import { Attempt, Task, ChatMessage, Assignment, Doubt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();
router.use(protect);

/** GET /api/progress — everything the dashboard needs, in one call */
router.get("/", asyncHandler(async (req, res) => {
  const uid = req.user._id;

  const [bySubject, byTopic, attempts, tasks, trendRaw, chats, assignments, doubts] = await Promise.all([
    Attempt.aggregate([
      { $match: { user: uid } },
      { $group: { _id: "$subject", average: { $avg: "$percentage" }, attempts: { $sum: 1 } } },
      { $sort: { average: -1 } },
    ]),
    Attempt.aggregate([
      { $match: { user: uid } },
      { $group: { _id: "$topic", average: { $avg: "$percentage" }, attempts: { $sum: 1 } } },
      { $sort: { average: 1 } },
    ]),
    Attempt.find({ user: uid }).sort({ createdAt: -1 }).limit(10).lean(),
    Task.find({ user: uid }).lean(),
    Attempt.find({ user: uid }).sort({ createdAt: 1 }).select("percentage createdAt topic").lean(),
    ChatMessage.countDocuments({ user: uid, role: "user" }),
    Assignment.countDocuments({ user: uid }),
    Doubt.countDocuments({ user: uid }),
  ]);

  const completed = tasks.filter((t) => t.completed);
  const quizAvg = attempts.length
    ? Math.round(trendRaw.reduce((a, b) => a + b.percentage, 0) / trendRaw.length) : 0;
  const taskRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

  // Overall = 60% quiz average, 40% plan adherence. Shown on the dashboard ring.
  const overall = Math.round(quizAvg * 0.6 + taskRate * 0.4);

  const weakAreas = byTopic
    .filter((t) => t.average < 60 && t._id)
    .slice(0, 4)
    .map((t) => ({ topic: t._id, average: Math.round(t.average), attempts: t.attempts }));

  res.json({
    summary: {
      overall,
      quizAverage: quizAvg,
      quizzesCompleted: trendRaw.length,
      studyHours: Math.round((req.user.studyMinutes / 60) * 10) / 10,
      weakAreaCount: weakAreas.length,
      tasksCompleted: completed.length,
      tasksTotal: tasks.length,
      taskCompletionRate: taskRate,
      streak: req.user.streak,
      questionsAsked: chats,
      assignments,
      doubts,
    },
    subjects: bySubject.map((s) => ({
      subject: s._id, average: Math.round(s.average), attempts: s.attempts,
    })),
    topics: byTopic.map((t) => ({
      topic: t._id, average: Math.round(t.average), attempts: t.attempts,
    })),
    weakAreas,
    trend: trendRaw.slice(-12).map((a) => ({
      date: a.createdAt, percentage: a.percentage, topic: a.topic,
    })),
    recentAttempts: attempts,
  });
}));

/** GET /api/progress/activity — the home feed */
router.get("/activity", asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const [attempts, tasks, chats, assignments] = await Promise.all([
    Attempt.find({ user: uid }).sort({ createdAt: -1 }).limit(5).lean(),
    Task.find({ user: uid, completed: true }).sort({ completedAt: -1 }).limit(5).lean(),
    ChatMessage.find({ user: uid, role: "user" }).sort({ createdAt: -1 }).limit(5).lean(),
    Assignment.find({ user: uid }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const feed = [
    ...attempts.map((a) => ({
      type: "quiz", tone: a.percentage >= 60 ? "green" : "amber",
      text: `Completed a quiz on ${a.topic} — scored ${a.score}/${a.total}`,
      at: a.createdAt,
    })),
    ...tasks.map((t) => ({
      type: "task", tone: "blue",
      text: `Finished the ${t.topic || t.title} study block`,
      at: t.completedAt || t.updatedAt,
    })),
    ...chats.map((c) => ({
      type: "tutor", tone: "purple",
      text: `Asked the tutor: ${c.content.length > 55 ? c.content.slice(0, 52) + "..." : c.content}`,
      at: c.createdAt,
    })),
    ...assignments.map((a) => ({
      type: "assignment", tone: "amber",
      text: `Generated the assignment "${a.title}"`,
      at: a.createdAt,
    })),
  ]
    .filter((f) => f.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  res.json({ feed });
}));

export default router;
