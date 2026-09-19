import { Router } from "express";
import { Doubt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { complete, aiConfigured, modelFromRequest } from "../services/ai.js";
import { doubtAnswerPrompt, fallbackTutorAnswer, detectTopicKeyword } from "../services/prompts.js";
import { resourcesFor, sanitizeResources } from "../services/resources.js";

const router = Router();
router.use(protect);

/** GET /api/doubts?subject=&resolved=&q= — the whole community feed */
router.get("/", asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.subject && req.query.subject !== "All") filter.subject = req.query.subject;
  if (req.query.resolved === "true") filter.resolved = true;
  if (req.query.resolved === "false") filter.resolved = false;
  if (req.query.mine === "true") filter.user = req.user._id;
  if (req.query.q) filter.$or = [
    { title: new RegExp(req.query.q, "i") },
    { body: new RegExp(req.query.q, "i") },
  ];

  const doubts = await Doubt.find(filter).sort({ resolved: 1, createdAt: -1 }).limit(60).lean();
  res.json({ doubts });
}));

/** GET /api/doubts/:id */
router.get("/:id", asyncHandler(async (req, res) => {
  const doubt = await Doubt.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).lean();
  if (!doubt) return res.status(404).json({ message: "Doubt not found" });
  res.json({ doubt });
}));

/**
 * POST /api/doubts  { title, body, subject, tags, askAI }
 * Posting with askAI=true gets an immediate AI answer, so nobody stares at
 * an unanswered question — peers can still add better answers underneath.
 */
router.post("/", asyncHandler(async (req, res) => {
  const { title, body, subject, tags } = req.body;
  if (!title?.trim() || !body?.trim())
    return res.status(400).json({ message: "A doubt needs both a title and a description" });

  const doubt = await Doubt.create({
    user: req.user._id, authorName: req.user.name,
    title: title.trim(), body: body.trim(),
    subject: subject || "General",
    tags: (tags || []).map(String).slice(0, 5),
  });

  if (req.body.askAI !== false) {
    let answer, isAI = true;
    try {
      if (!aiConfigured()) throw new Error("no key");
      answer = await complete({ prompt: doubtAnswerPrompt(title, body, doubt.subject, req.user), model: modelFromRequest(req) });
      if (!answer) throw new Error("empty");
    } catch (err) {
      console.error(`[doubts] falling back for doubt ${doubt._id}: ${err.message}`);
      answer = fallbackTutorAnswer(`${title} ${body}`);
    }
    const topicKeyword = detectTopicKeyword(`${title} ${body}`);
    const resources = topicKeyword ? sanitizeResources(resourcesFor(topicKeyword)) : [];
    doubt.answers.push({ authorName: "EduMind AI", isAI, body: answer, resources });
    await doubt.save();
  }

  res.status(201).json({ doubt });
}));

/** POST /api/doubts/:id/answers  { body } */
router.post("/:id/answers", asyncHandler(async (req, res) => {
  if (!req.body.body?.trim()) return res.status(400).json({ message: "Write an answer first" });
  const doubt = await Doubt.findById(req.params.id);
  if (!doubt) return res.status(404).json({ message: "Doubt not found" });

  doubt.answers.push({
    author: req.user._id, authorName: req.user.name, isAI: false, body: req.body.body.trim(),
  });
  await doubt.save();
  res.status(201).json({ doubt });
}));

/** POST /api/doubts/:id/answers/:answerId/upvote */
router.post("/:id/answers/:answerId/upvote", asyncHandler(async (req, res) => {
  const doubt = await Doubt.findById(req.params.id);
  if (!doubt) return res.status(404).json({ message: "Doubt not found" });
  const answer = doubt.answers.id(req.params.answerId);
  if (!answer) return res.status(404).json({ message: "Answer not found" });
  answer.upvotes += 1;
  await doubt.save();
  res.json({ doubt });
}));

/** PATCH /api/doubts/:id — mark resolved (author only) */
router.patch("/:id", asyncHandler(async (req, res) => {
  const doubt = await Doubt.findOne({ _id: req.params.id, user: req.user._id });
  if (!doubt) return res.status(404).json({ message: "You can only edit your own doubts" });
  if (req.body.resolved !== undefined) doubt.resolved = Boolean(req.body.resolved);
  if (req.body.title) doubt.title = req.body.title;
  if (req.body.body) doubt.body = req.body.body;
  await doubt.save();
  res.json({ doubt });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const r = await Doubt.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ message: "You can only delete your own doubts" });
  res.json({ message: "Doubt deleted" });
}));

export default router;
