import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import {
  User, Quiz, Attempt, Goal, Task, Doubt, Assignment, ChatMessage, CareerPlan,
} from "../models/index.js";
import {
  DEMO_PASSWORD, USERS, QUIZ_BANK, GOALS, TASKS, ATTEMPTS,
  DOUBTS, ASSIGNMENTS, CAREER_INTERESTS, CAREER_STRENGTHS,
} from "./dataset.js";

const daysFromNow = (n) => new Date(Date.now() + n * 864e5);
const daysAgo = (n) => new Date(Date.now() - n * 864e5);

async function run() {
  await connectDB();
  const wipe = !process.argv.includes("--keep");

  if (wipe) {
    console.log("Clearing existing collections...");
    await Promise.all([
      User.deleteMany({}), Quiz.deleteMany({}), Attempt.deleteMany({}),
      Goal.deleteMany({}), Task.deleteMany({}), Doubt.deleteMany({}),
      Assignment.deleteMany({}), ChatMessage.deleteMany({}), CareerPlan.deleteMany({}),
    ]);
  }

  /* ---------------------------------------------------------------- users */
  // create() (not insertMany) so the pre-save hook hashes each password.
  const users = [];
  for (const u of USERS) {
    const { isPrimary, ...rest } = u;
    users.push(await User.create({ ...rest, password: DEMO_PASSWORD, lastActiveDate: new Date() }));
  }
  const primary = users[0];
  console.log(`Created ${users.length} users`);

  /* ----------------------------------------------------------- quiz bank */
  const bank = await Quiz.insertMany(
    QUIZ_BANK.map((q) => ({ ...q, user: null, source: "bank" }))
  );
  const bankByTopic = Object.fromEntries(bank.map((q) => [q.topic, q]));
  console.log(`Created ${bank.length} public quizzes (${bank.reduce((a, q) => a + q.questions.length, 0)} questions)`);

  /* -------------------------------------------------------------- goals */
  await Goal.insertMany(
    GOALS.map((g) => ({
      user: primary._id, title: g.title, targetDate: daysFromNow(g.daysOut),
      progress: g.progress, status: g.status,
    }))
  );

  /* -------------------------------------------------------------- tasks */
  await Task.insertMany(
    TASKS.map((t) => ({
      user: primary._id, title: t.title, subject: t.subject, topic: t.topic,
      scheduledFor: daysFromNow(t.dayOffset), durationMinutes: t.durationMinutes,
      priority: t.priority, completed: Boolean(t.completed),
      completedAt: t.completed ? daysFromNow(t.dayOffset) : undefined,
      autoScheduled: Boolean(t.autoScheduled), note: t.note,
    }))
  );
  console.log(`Created ${GOALS.length} goals and ${TASKS.length} tasks for ${primary.name}`);

  /* ----------------------------------------------------------- attempts */
  // Attempts reference a real quiz so "retake this" works from the history.
  const attempts = ATTEMPTS.map((a) => {
    const quiz = bankByTopic[a.topic] || bank[0];
    return {
      user: primary._id, quiz: quiz._id, topic: a.topic, subject: a.subject,
      answers: [], score: a.score, total: a.total,
      percentage: Math.round((a.score / a.total) * 100),
      durationSeconds: 180 + ((a.score * 37) % 240), // deterministic, not random
      createdAt: daysAgo(a.daysAgo), updatedAt: daysAgo(a.daysAgo),
    };
  });
  await Attempt.insertMany(attempts, { timestamps: false });
  console.log(`Created ${attempts.length} quiz attempts`);

  /* ------------------------------------------------------------- doubts */
  await Doubt.insertMany(
    DOUBTS.map((d, i) => ({
      user: users[d.authorIndex]._id,
      authorName: users[d.authorIndex].name,
      title: d.title, body: d.body, subject: d.subject, tags: d.tags,
      resolved: d.resolved, views: d.views,
      answers: d.answers.map((a) => ({
        authorName: a.authorName, isAI: a.isAI, body: a.body, upvotes: a.upvotes,
        author: a.isAI ? undefined : users[(d.authorIndex + 1) % users.length]._id,
      })),
      createdAt: daysAgo(DOUBTS.length - i),
    })),
    { timestamps: false }
  );
  console.log(`Created ${DOUBTS.length} community doubts`);

  /* --------------------------------------------------------- assignments */
  await Assignment.insertMany(
    ASSIGNMENTS.map((a) => ({
      user: primary._id, title: a.title, subject: a.subject, type: a.type,
      difficulty: a.difficulty, brief: a.brief, content: a.content,
      dueDate: daysFromNow(a.dayOffset), status: a.status,
    }))
  );

  /* -------------------------------------------------------- tutor history */
  const sessionId = "seed-session-recursion";
  await ChatMessage.insertMany(
    [
      { role: "user", content: "Explain recursion with a simple example" },
      {
        role: "assistant",
        content:
          "**Recursion** is when a function solves a problem by calling itself on a smaller version of the same problem.\n\nEvery recursive function needs two parts:\n- a **base case** — the smallest input, where it stops calling itself\n- a **recursive case** — where it calls itself on something smaller\n\n```python\ndef factorial(n):\n    if n <= 1:                    # base case\n        return 1\n    return n * factorial(n - 1)   # recursive case\n\nprint(factorial(5))               # 120\n```\n\nEach call waits on the call stack until the base case returns, then the answers multiply back up.\n\nThe mistake students make most: forgetting the base case, or writing one the input never reaches.",
      },
    ].map((m, i) => ({
      user: primary._id, sessionId, role: m.role, content: m.content,
      topic: "Recursion", createdAt: daysAgo(1 - i * 0.01),
    })),
    { timestamps: false }
  );

  /* -------------------------------------------------------------- career */
  await CareerPlan.create({
    user: primary._id,
    interests: CAREER_INTERESTS,
    strengths: CAREER_STRENGTHS,
    recommendations: [],
  });

  console.log("\n─────────────────────────────────────────────");
  console.log("  Seed complete. Demo accounts:\n");
  users.forEach((u) => console.log(`    ${u.email.padEnd(26)} ${DEMO_PASSWORD}`));
  console.log("\n  Sign in as the first account for the full dataset.");
  console.log("─────────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
