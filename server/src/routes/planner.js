import { Router } from "express";
import { Task, Goal, Attempt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { completeJSON, aiConfigured, modelFromRequest } from "../services/ai.js";
import { plannerPrompt } from "../services/prompts.js";
import { resourcesFor, sanitizeResources } from "../services/resources.js";

const router = Router();
router.use(protect);

async function weakTopics(userId) {
  const rows = await Attempt.aggregate([
    { $match: { user: userId } },
    { $group: { _id: { topic: "$topic", subject: "$subject" }, avg: { $avg: "$percentage" } } },
    { $sort: { avg: 1 } },
    { $limit: 5 },
  ]);
  return rows.filter((r) => r.avg < 70).map((r) => ({
    topic: r._id.topic, subject: r._id.subject, avg: Math.round(r.avg),
  }));
}

/** GET /api/planner — goals + tasks + today's focus */
router.get("/", asyncHandler(async (req, res) => {
  const [goals, tasks] = await Promise.all([
    Goal.find({ user: req.user._id }).sort({ createdAt: 1 }).lean(),
    Task.find({ user: req.user._id }).sort({ priority: 1, scheduledFor: 1 }).lean(),
  ]);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);

  const today = tasks.filter(
    (t) => !t.completed && new Date(t.scheduledFor) >= startOfDay && new Date(t.scheduledFor) < endOfDay
  );
  const focus = today[0] || tasks.find((t) => !t.completed) || null;

  res.json({ goals, tasks, today, focus, weakTopics: await weakTopics(req.user._id) });
}));

/** POST /api/planner/generate  { days } — AI rebuilds the plan around weak topics */
router.post("/generate", asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.body.days, 10) || 7, 3), 14);
  const weak = await weakTopics(req.user._id);
  const weakNames = weak.map((w) => `${w.topic} (${w.avg}%)`);

  let tasks = null, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: plannerPrompt(req.user, weakNames, days), model: modelFromRequest(req) });
    const list = Array.isArray(data) ? data : data.tasks;
    tasks = (list || []).filter((t) => t?.title).slice(0, days * 2).map((t) => {
      const isWeak = weak.some((w) => w.topic && String(t.topic || t.title).toLowerCase().includes(w.topic.toLowerCase()));
      let resources = sanitizeResources(t.resources, { limit: 2 });
      // If this task is built around a weak topic but the model gave nothing
      // usable, top it up from the curated set rather than leaving it empty.
      if (isWeak && !resources.length) resources = resourcesFor(t.topic || t.title, t.subject);
      return {
        user: req.user._id,
        title: String(t.title),
        subject: String(t.subject || req.user.subjects[0]),
        topic: String(t.topic || t.title),
        scheduledFor: new Date(Date.now() + (Number(t.dayOffset) || 0) * 864e5),
        durationMinutes: Math.min(Math.max(Number(t.durationMinutes) || 45, 15), 180),
        priority: Math.min(Math.max(Number(t.priority) || 2, 1), 3),
        autoScheduled: true,
        note: String(t.note || ""),
        resources,
      };
    });
    if (!tasks.length) throw new Error("empty plan");
  } catch (err) {
    console.error(`[planner] falling back to rules-based plan for user ${req.user._id}: ${err.message}`);
    // Deterministic planner: weak topics first, then a pass over every subject.
    source = "rules";
    const queue = [
      ...weak.map((w) => ({ title: `Revise ${w.topic}`, subject: w.subject, topic: w.topic, priority: 1,
        note: `Scheduled first — your average here is ${w.avg}%`, resources: resourcesFor(w.topic, w.subject) })),
      ...req.user.subjects.map((s) => ({ title: `Practice ${s}`, subject: s, topic: s, priority: 2,
        note: "Regular practice block", resources: [] })),
      { title: "Mixed practice: 10 MCQs across all subjects", subject: req.user.subjects[0],
        topic: "Revision", priority: 3, note: "Weekly mixed revision", resources: [] },
    ].slice(0, days);

    tasks = queue.map((t, i) => ({
      ...t, user: req.user._id,
      scheduledFor: new Date(Date.now() + i * 864e5),
      durationMinutes: req.user.dailyTargetMinutes, autoScheduled: true,
    }));
  }

  // Replace only the un-completed auto-scheduled tasks; keep manual and done ones.
  await Task.deleteMany({ user: req.user._id, completed: false, autoScheduled: true });
  const created = await Task.insertMany(tasks);
  res.status(201).json({ tasks: created, source, weakTopics: weak });
}));

/** POST /api/planner/tasks */
router.post("/tasks", asyncHandler(async (req, res) => {
  const { title, subject, topic, scheduledFor, durationMinutes, priority } = req.body;
  if (!title) return res.status(400).json({ message: "Give the task a title" });
  const task = await Task.create({
    user: req.user._id, title, subject, topic,
    scheduledFor: scheduledFor || new Date(),
    durationMinutes: durationMinutes || 45, priority: priority || 2,
  });
  res.status(201).json({ task });
}));

/** PATCH /api/planner/tasks/:id — toggle done, edit fields */
router.patch("/tasks/:id", asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (req.body.completed !== undefined) {
    task.completed = Boolean(req.body.completed);
    task.completedAt = task.completed ? new Date() : undefined;
    if (task.completed) {
      req.user.studyMinutes += task.durationMinutes;
      await req.user.save({ validateBeforeSave: false });
    }
  }
  ["title", "subject", "topic", "priority", "durationMinutes", "scheduledFor"].forEach((k) => {
    if (req.body[k] !== undefined) task[k] = req.body[k];
  });
  await task.save();
  res.json({ task });
}));

router.delete("/tasks/:id", asyncHandler(async (req, res) => {
  const r = await Task.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ message: "Task not found" });
  res.json({ message: "Task removed" });
}));

/** Goals */
router.post("/goals", asyncHandler(async (req, res) => {
  const { title, targetDate } = req.body;
  if (!title) return res.status(400).json({ message: "Give the goal a title" });
  res.status(201).json({ goal: await Goal.create({ user: req.user._id, title, targetDate }) });
}));

router.patch("/goals/:id", asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ message: "Goal not found" });
  ["title", "targetDate", "progress", "status"].forEach((k) => {
    if (req.body[k] !== undefined) goal[k] = req.body[k];
  });
  await goal.save();
  res.json({ goal });
}));

router.delete("/goals/:id", asyncHandler(async (req, res) => {
  await Goal.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ message: "Goal removed" });
}));

export default router;
