import { Router } from "express";
import { Assignment, Attempt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { complete, completeJSON, aiConfigured, modelFromRequest } from "../services/ai.js";
import { assignmentPrompt, suggestTopicPrompt, gradingPrompt } from "../services/prompts.js";

function guessSubject(topic, subjects) {
  const t = String(topic).toLowerCase();
  return subjects.find((s) => t.includes(s.toLowerCase())) || subjects[0] || "General";
}

const router = Router();
router.use(protect);

const TYPES = ["essay", "coding", "case-study", "lab-report", "worksheet"];

/** Deterministic template used when no AI key is configured. */
function fallbackAssignment(brief, type, subject, difficulty) {
  return `## Brief

You have been asked to work on **${brief}** as part of your ${subject} coursework. Treat this as a ${difficulty.toLowerCase()}-level ${type.replace("-", " ")} and assume your reader knows the subject but not your solution.

## Learning objectives

- Explain the core ideas behind ${brief} in your own words
- Apply those ideas to a problem you have not seen worked out
- Justify the trade-offs in the approach you chose
- Communicate the result clearly enough for a peer to reproduce it

## Tasks

1. **Summarise** the key concepts in ${brief} in under 200 words, without copying a definition.
2. **Work through** one concrete example end to end, showing every intermediate step.
3. **Extend** the example to a harder case and explain what breaks and why.
4. **Compare** your approach with one alternative, and say when each is the better choice.

## Deliverables

- A written report (800-1200 words) or a documented source file
- Your worked example with all steps visible
- A short reflection on what you found hardest

## Marking scheme

| Criterion | Marks |
|---|---|
| Correctness of the core concept | 30 |
| Quality of the worked example | 25 |
| Handling of the extended case | 20 |
| Comparison and justification | 15 |
| Clarity and presentation | 10 |
| **Total** | **100** |

## Hints

- Start with the simplest case that is still interesting, then add complexity one step at a time.
- If you cannot explain a step to a classmate in one sentence, you have not understood it yet — go back to that step before moving on.

*Generated offline by EduMind. Add an AI provider key on the server for assignments written specifically to your brief.*`;
}

/** GET /api/assignments */
router.get("/", asyncHandler(async (req, res) => {
  const assignments = await Assignment.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ assignments });
}));

/** GET /api/assignments/suggest-topic — one AI-picked brief tied to weak areas. */
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
    const data = await completeJSON({ prompt: suggestTopicPrompt(req.user, weakTopics, "assignment"), model: modelFromRequest(req) });
    if (!data?.topic) throw new Error("no usable topic");
    return res.json({
      topic: String(data.topic).slice(0, 160),
      subject: guessSubject(data.subject || data.topic, req.user.subjects),
      reason: String(data.reason || "").slice(0, 200),
      source: "ai",
    });
  } catch (err) {
    console.error(`[assignments] suggest-topic falling back for user ${req.user._id}: ${err.message}`);
    const pick = rows[0];
    const topic = pick?._id || req.user.subjects[0] || "Fundamentals review";
    return res.json({
      topic, subject: guessSubject(pick?.subject || topic, req.user.subjects),
      reason: pick ? `Your average here is ${Math.round(pick.avg)}%.` : "A good place to start.",
      source: "rules",
    });
  }
}));

/** GET /api/assignments/:id */
router.get("/:id", asyncHandler(async (req, res) => {
  const a = await Assignment.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!a) return res.status(404).json({ message: "Assignment not found" });
  res.json({ assignment: a });
}));

/** POST /api/assignments/generate  { brief, type, subject, difficulty, dueDate } */
router.post("/generate", asyncHandler(async (req, res) => {
  const brief = (req.body.brief || "").trim();
  if (!brief) return res.status(400).json({ message: "Describe what the assignment should cover" });

  const type = TYPES.includes(req.body.type) ? req.body.type : "worksheet";
  const subject = req.body.subject || req.user.subjects[0];
  const difficulty = ["Easy", "Medium", "Hard"].includes(req.body.difficulty) ? req.body.difficulty : "Medium";

  let content, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    content = await complete({ prompt: assignmentPrompt(brief, type, subject, difficulty, req.user), model: modelFromRequest(req) });
    if (!content || content.length < 120) throw new Error("too short");
  } catch (err) {
    console.error(`[assignments] falling back to template for user ${req.user._id}: ${err.message}`);
    source = "template";
    content = fallbackAssignment(brief, type, subject, difficulty);
  }

  const assignment = await Assignment.create({
    user: req.user._id,
    title: brief.length > 70 ? brief.slice(0, 67) + "..." : brief,
    subject, type, difficulty, brief, content,
    dueDate: req.body.dueDate || new Date(Date.now() + 7 * 864e5),
  });
  res.status(201).json({ assignment, source });
}));

/** PATCH /api/assignments/:id */
router.patch("/:id", asyncHandler(async (req, res) => {
  const a = await Assignment.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) return res.status(404).json({ message: "Assignment not found" });
  ["title", "status", "dueDate", "content"].forEach((k) => {
    if (req.body[k] !== undefined) a[k] = req.body[k];
  });
  await a.save();
  res.json({ assignment: a });
}));

/** Deterministic fallback grading — deliberately does NOT pretend to assess
 *  correctness (it can't); it's an honest effort-based estimate, clearly
 *  labelled as such, rather than a fabricated content review. */
function fallbackGrading(submissionText) {
  const words = submissionText.trim().split(/\s+/).filter(Boolean).length;
  const score = Math.max(40, Math.min(75, Math.round(40 + words / 15)));
  return {
    score,
    feedback: `This is a rough, length-based estimate only (${words} words) — the AI provider is unavailable right now, so this isn't a real review of what you wrote. Ask for a re-grade once an AI key is configured on the server.`,
    strengths: words > 150 ? ["Submission is a reasonable length for this brief"] : [],
    improvements: ["Get this re-graded once AI grading is available — this score doesn't reflect correctness"],
  };
}

/** POST /api/assignments/:id/submit  { text }
 *  "text" is either typed directly or read client-side from an uploaded
 *  .txt/.md file — no file ever touches the server, so there's no storage
 *  or cleanup to manage, just the same JSON body as typing it. */
router.post("/:id/submit", asyncHandler(async (req, res) => {
  const a = await Assignment.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) return res.status(404).json({ message: "Assignment not found" });

  const text = (req.body.text || "").trim();
  if (!text) return res.status(400).json({ message: "Write or upload an answer first" });
  if (text.length > 20000) return res.status(400).json({ message: "That submission is too long (20,000 character limit)" });

  let graded, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: gradingPrompt(a, text), model: modelFromRequest(req) });
    if (typeof data?.score !== "number") throw new Error("no usable score");
    graded = {
      score: Math.max(0, Math.min(100, Math.round(data.score))),
      feedback: String(data.feedback || "").slice(0, 800),
      strengths: (data.strengths || []).map(String).slice(0, 5),
      improvements: (data.improvements || []).map(String).slice(0, 5),
    };
  } catch (err) {
    console.error(`[assignments] grading falling back for assignment ${a._id}: ${err.message}`);
    source = "rules";
    graded = fallbackGrading(text);
  }

  a.submission = { text, ...graded, source, submittedAt: new Date() };
  a.status = "submitted";
  await a.save();
  res.json({ assignment: a, source });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const r = await Assignment.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) return res.status(404).json({ message: "Assignment not found" });
  res.json({ message: "Assignment deleted" });
}));

export default router;
