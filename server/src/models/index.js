import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

const resourceSchema = new Schema(
  {
    name: { type: String, required: true },
    provider: String,
    kind: { type: String, enum: ["docs", "tutorial", "course", "practice", "video", "article"], default: "article" },
    url: String, // only ever set to a trusted-host URL — see services/resources.js
    searchQuery: String,
  },
  { _id: false }
);

/* ------------------------------------------------------------------ User */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["student", "teacher"], default: "student" },
    institution: { type: String, default: "Sri Sairam Engineering College" },
    department: { type: String, default: "CSE (IoT)" },
    year: { type: Number, default: 2 },
    // Learning profile — drives personalization across every feature
    subjects: { type: [String], default: ["Python", "Data Structures", "Web Development", "DBMS"] },
    learningStyle: {
      type: String,
      enum: ["visual", "reading", "hands-on", "mixed"],
      default: "hands-on",
    },
    dailyTargetMinutes: { type: Number, default: 60 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    studyMinutes: { type: Number, default: 0 },
    // Set once by the adaptive placement assessment right after registration —
    // see routes/assessment.js. Absent for accounts created before this existed
    // or that skipped it; every read of it must handle that.
    assessment: {
      level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      completedAt: Date,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

/* ------------------------------------------------------------- Chat / Tutor */
const chatMessageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    topic: { type: String },
    resources: { type: [resourceSchema], default: [] },
  },
  { timestamps: true }
);

/* -------------------------------------------------------------------- Quiz */
const questionSchema = new Schema(
  {
    q: { type: String, required: true },
    options: { type: [String], required: true, validate: (v) => v.length >= 2 },
    answerIndex: { type: Number, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true }, // null = seeded/public bank
    topic: { type: String, required: true },
    subject: { type: String, required: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    questions: { type: [questionSchema], required: true },
    source: { type: String, enum: ["ai", "bank"], default: "bank" },
  },
  { timestamps: true }
);

const attemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    topic: String,
    subject: String,
    answers: { type: [Number], default: [] },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ----------------------------------------------------------------- Planner */
const goalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    targetDate: Date,
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ["on-track", "behind", "done"], default: "on-track" },
  },
  { timestamps: true }
);

const taskSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    subject: String,
    topic: String,
    scheduledFor: { type: Date, default: Date.now },
    durationMinutes: { type: Number, default: 45 },
    priority: { type: Number, default: 2, min: 1, max: 3 }, // 1 = highest
    completed: { type: Boolean, default: false },
    completedAt: Date,
    autoScheduled: { type: Boolean, default: false }, // true when the AI planner moved it up
    note: String,
    resources: { type: [resourceSchema], default: [] },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------- Assignments */
const assignmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    subject: String,
    type: {
      type: String,
      enum: ["essay", "coding", "case-study", "lab-report", "worksheet"],
      default: "worksheet",
    },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    brief: String,
    content: { type: String, required: true }, // markdown
    dueDate: Date,
    status: { type: String, enum: ["draft", "in-progress", "submitted"], default: "draft" },
    submission: {
      text: String,
      score: Number,
      feedback: String,
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      source: { type: String, enum: ["ai", "rules"] },
      submittedAt: Date,
    },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------ Doubt forum */
const answerSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, default: "EduMind AI" },
    isAI: { type: Boolean, default: false },
    body: { type: String, required: true },
    upvotes: { type: Number, default: 0 },
    resources: { type: [resourceSchema], default: [] },
  },
  { timestamps: true }
);

const doubtSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorName: String,
    title: { type: String, required: true },
    body: { type: String, required: true },
    subject: { type: String, default: "General" },
    tags: { type: [String], default: [] },
    resolved: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true }
);

/* ---------------------------------------------------------------- Career */
const careerPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    interests: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    recommendations: {
      type: [
        {
          role: String,
          match: Number,
          why: String,
          skillsToLearn: [String],
          firstSteps: [String],
          resources: { type: [resourceSchema], default: [] },
          certifications: { type: [resourceSchema], default: [] },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
export const ChatMessage = model("ChatMessage", chatMessageSchema);
export const Quiz = model("Quiz", quizSchema);
export const Attempt = model("Attempt", attemptSchema);
export const Goal = model("Goal", goalSchema);
export const Task = model("Task", taskSchema);
export const Assignment = model("Assignment", assignmentSchema);
export const Doubt = model("Doubt", doubtSchema);
export const CareerPlan = model("CareerPlan", careerPlanSchema);
