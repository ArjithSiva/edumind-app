import { Router } from "express";
import { User, Goal, Task } from "../models/index.js";
import { protect, signToken } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();
const shape = (u) => ({
  _id: u._id, name: u.name, email: u.email, role: u.role,
  institution: u.institution, department: u.department, year: u.year,
  subjects: u.subjects, learningStyle: u.learningStyle,
  dailyTargetMinutes: u.dailyTargetMinutes, streak: u.streak, studyMinutes: u.studyMinutes,
});

/** POST /api/auth/register */
router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, department, year, subjects, learningStyle } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Name, email and password are all required" });
  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ message: "That email is already registered" });

  const user = await User.create({
    name, email, password, department, year,
    ...(subjects?.length ? { subjects } : {}),
    ...(learningStyle ? { learningStyle } : {}),
  });

  // Give every new account a starting plan so no screen is ever empty.
  await Goal.create({
    user: user._id, title: `Build a strong foundation in ${user.subjects[0]}`,
    targetDate: new Date(Date.now() + 60 * 864e5), progress: 5,
  });
  await Task.insertMany(
    user.subjects.slice(0, 3).map((s, i) => ({
      user: user._id, title: `Get started with ${s}`, subject: s, topic: "Fundamentals",
      scheduledFor: new Date(Date.now() + i * 864e5), durationMinutes: 45, priority: i + 1,
      note: "Starter task — take a quiz and EduMind will replan around your results",
    }))
  );

  res.status(201).json({ token: signToken(user._id), user: shape(user) });
}));

/** POST /api/auth/login */
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Enter your email and password" });

  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ message: "Email or password is incorrect" });

  // Streak: consecutive calendar days with a login.
  const today = new Date().toDateString();
  const last = user.lastActiveDate ? new Date(user.lastActiveDate).toDateString() : null;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    user.streak = last === yesterday ? user.streak + 1 : 1;
    user.lastActiveDate = new Date();
    await user.save({ validateBeforeSave: false });
  }

  res.json({ token: signToken(user._id), user: shape(user) });
}));

/** GET /api/auth/me */
router.get("/me", protect, (req, res) => res.json({ user: shape(req.user) }));

/** PUT /api/auth/me — update the learning profile */
router.put("/me", protect, asyncHandler(async (req, res) => {
  const allowed = ["name", "department", "year", "subjects", "learningStyle", "dailyTargetMinutes"];
  allowed.forEach((k) => { if (req.body[k] !== undefined) req.user[k] = req.body[k]; });
  await req.user.save();
  res.json({ user: shape(req.user) });
}));

export default router;
