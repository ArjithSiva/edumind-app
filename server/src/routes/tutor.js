import { Router } from "express";
import { randomUUID } from "crypto";
import { ChatMessage, Attempt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { complete, aiConfigured, modelFromRequest } from "../services/ai.js";
import { tutorSystem, fallbackTutorAnswer, detectTopicKeyword } from "../services/prompts.js";
import { resourcesFor, sanitizeResources } from "../services/resources.js";

const router = Router();
router.use(protect);

/** Topics the learner is scoring badly on — fed into the tutor's system prompt. */
async function weakTopicsFor(userId) {
  const rows = await Attempt.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$topic", avg: { $avg: "$percentage" } } },
    { $match: { avg: { $lt: 60 } } },
    { $sort: { avg: 1 } },
    { $limit: 3 },
  ]);
  return rows.map((r) => r._id).filter(Boolean);
}

/** GET /api/tutor/sessions — list past chats */
router.get("/sessions", asyncHandler(async (req, res) => {
  const rows = await ChatMessage.aggregate([
    { $match: { user: req.user._id } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: "$sessionId",
        title: { $first: "$content" },
        updatedAt: { $last: "$createdAt" },
        count: { $sum: 1 },
    } },
    { $sort: { updatedAt: -1 } },
    { $limit: 20 },
  ]);
  res.json({ sessions: rows.map((r) => ({
    sessionId: r._id,
    title: r.title.length > 60 ? r.title.slice(0, 57) + "..." : r.title,
    updatedAt: r.updatedAt, count: r.count,
  })) });
}));

/** GET /api/tutor/sessions/:id — full transcript */
router.get("/sessions/:id", asyncHandler(async (req, res) => {
  const messages = await ChatMessage.find({ user: req.user._id, sessionId: req.params.id })
    .sort({ createdAt: 1 }).lean();
  res.json({ messages });
}));

/** POST /api/tutor/ask  { question, sessionId?, subject?, topic? }
 *  subject/topic are an optional explicit scope from the filter above the
 *  input box — session-default but overridable per message (see Tutor.jsx). */
router.post("/ask", asyncHandler(async (req, res) => {
  const { question, subject, topic } = req.body;
  if (!question || !question.trim())
    return res.status(400).json({ message: "Type a question first" });

  const sessionId = req.body.sessionId || randomUUID();
  await ChatMessage.create({ user: req.user._id, sessionId, role: "user", content: question });

  const weakTopics = await weakTopicsFor(req.user._id);
  const history = await ChatMessage.find({ user: req.user._id, sessionId })
    .sort({ createdAt: -1 }).limit(6).lean();

  const context = history.reverse().slice(0, -1)
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`).join("\n\n");

  let answer, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    answer = await complete({
      system: tutorSystem(req.user, { weakTopics, focusSubject: subject, focusTopic: topic }),
      prompt: context ? `Earlier in this conversation:\n${context}\n\nNow the student asks: ${question}` : question,
      model: modelFromRequest(req),
    });
    if (!answer) throw new Error("empty response");
  } catch (err) {
    console.error(`[tutor] falling back for user ${req.user._id}: ${err.message}`);
    answer = fallbackTutorAnswer(question);
    source = "fallback";
  }

  // An explicit subject/topic filter is a stronger signal than guessing from
  // the question text, so it takes priority; keyword detection is still the
  // fallback for messages sent with no filter set.
  const explicitTopic = (topic || "").trim();
  const topicKeyword = detectTopicKeyword(question);
  const resources = explicitTopic
    ? sanitizeResources(resourcesFor(explicitTopic, subject))
    : (topicKeyword ? sanitizeResources(resourcesFor(topicKeyword)) : []);

  await ChatMessage.create({ user: req.user._id, sessionId, role: "assistant", content: answer, resources });
  res.json({ sessionId, answer, source, weakTopics, resources });
}));

/** DELETE /api/tutor/sessions/:id */
router.delete("/sessions/:id", asyncHandler(async (req, res) => {
  await ChatMessage.deleteMany({ user: req.user._id, sessionId: req.params.id });
  res.json({ message: "Chat deleted" });
}));

export default router;
