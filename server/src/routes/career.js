import { Router } from "express";
import { CareerPlan, Attempt } from "../models/index.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { completeJSON, aiConfigured, modelFromRequest } from "../services/ai.js";
import { careerPrompt } from "../services/prompts.js";
import { resourcesFor, sanitizeResources, sanitizeCertifications } from "../services/resources.js";

const router = Router();
router.use(protect);

/** Seeded role library — used when no AI key is configured. */
const ROLE_LIBRARY = [
  { role: "Backend Engineer", drivers: ["Python", "DBMS", "Data Structures"],
    why: "Your strongest measured subjects are the ones backend interviews test hardest: language fundamentals, data structures and database querying.",
    skillsToLearn: ["Node.js or Django REST APIs", "SQL query optimisation", "Docker basics", "System design fundamentals"],
    firstSteps: ["Build one CRUD API with auth and deploy it", "Solve 20 array and hashmap problems", "Write a README that explains your schema choices"],
    certifications: [{ name: "AWS Certified Cloud Practitioner", provider: "AWS" }, { name: "Meta Back-End Developer Professional Certificate", provider: "Meta" }] },
  { role: "Full-Stack Developer", drivers: ["Web Development", "Python", "DBMS"],
    why: "You already ship working interfaces alongside server logic, which is the exact combination product teams hire for at entry level.",
    skillsToLearn: ["React state management", "REST and JWT auth patterns", "CI/CD with GitHub Actions", "Responsive CSS"],
    firstSteps: ["Ship one full-stack app to a real URL", "Add tests to an existing project", "Rebuild a product you use, badly, then improve it"],
    certifications: [{ name: "Meta Front-End Developer Professional Certificate", provider: "Meta" }, { name: "Microsoft Certified: Azure Fundamentals (AZ-900)", provider: "Microsoft" }] },
  { role: "IoT / Embedded Systems Engineer", drivers: ["Python", "Data Structures"],
    why: "Your branch is CSE (IoT), and embedded roles reward exactly the low-level, constraint-aware thinking your coursework already covers.",
    skillsToLearn: ["Embedded C", "MQTT and edge protocols", "ESP32 / Raspberry Pi projects", "Sensor data pipelines"],
    firstSteps: ["Build a sensor-to-dashboard pipeline end to end", "Publish the wiring diagram and firmware", "Read one datasheet fully"],
    certifications: [{ name: "Microsoft Certified: Azure Fundamentals (AZ-900)", provider: "Microsoft" }, { name: "AWS Certified Cloud Practitioner", provider: "AWS" }] },
  { role: "Data Analyst", drivers: ["DBMS", "Python"],
    why: "Analytics converts your SQL and Python work into business questions, and it is the shortest bridge from your current subjects to a paid role.",
    skillsToLearn: ["Pandas and NumPy", "Window functions in SQL", "Power BI or Tableau", "Statistics for A/B testing"],
    firstSteps: ["Clean one messy public dataset and publish the notebook", "Recreate a company dashboard from open data", "Write up one insight in plain English"],
    certifications: [{ name: "Google Data Analytics Professional Certificate", provider: "Google" }, { name: "IBM Data Analyst Professional Certificate", provider: "IBM" }] },
  { role: "Machine Learning Engineer", drivers: ["Python", "Data Structures"],
    why: "Your Python scores are consistently your highest, which is the prerequisite most ML candidates are actually missing.",
    skillsToLearn: ["Linear algebra and probability", "scikit-learn then PyTorch", "Feature engineering", "Model deployment with FastAPI"],
    firstSteps: ["Train and deploy one model behind an API", "Reproduce a paper's baseline", "Learn to read a confusion matrix properly"],
    certifications: [{ name: "Google AI Professional Certificate", provider: "Google" }, { name: "IBM Data Science Professional Certificate", provider: "IBM" }] },
];

function fallbackRecommendations(perf, user) {
  const scoreOf = (s) => perf.find((p) => p.subject === s)?.average ?? 55;
  return ROLE_LIBRARY
    .map((r) => {
      const avg = r.drivers.reduce((a, d) => a + scoreOf(d), 0) / r.drivers.length;
      return { role: r.role, match: Math.round(Math.min(96, avg * 0.9 + 15)),
        why: r.why, skillsToLearn: r.skillsToLearn, firstSteps: r.firstSteps,
        resources: resourcesFor(r.skillsToLearn[0], r.drivers[0]),
        certifications: sanitizeCertifications(r.certifications) };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, 4);
}

/** GET /api/career — last saved plan */
router.get("/", asyncHandler(async (req, res) => {
  const plan = await CareerPlan.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ plan });
}));

/** POST /api/career/generate  { interests: [], strengths: [] } */
router.post("/generate", asyncHandler(async (req, res) => {
  const interests = (req.body.interests || []).map(String).slice(0, 8);
  const strengths = (req.body.strengths || []).map(String).slice(0, 8);

  const rows = await Attempt.aggregate([
    { $match: { user: req.user._id } },
    { $group: { _id: "$subject", avg: { $avg: "$percentage" } } },
  ]);
  const perf = rows.map((r) => ({ subject: r._id, average: Math.round(r.avg) }));

  let recommendations = null, source = "ai";
  try {
    if (!aiConfigured()) throw new Error("no key");
    const data = await completeJSON({ prompt: careerPrompt(req.user, interests, strengths, perf), model: modelFromRequest(req) });
    const list = Array.isArray(data) ? data : data.recommendations;
    recommendations = (list || []).filter((r) => r?.role).slice(0, 5).map((r) => ({
      role: String(r.role),
      match: Math.min(100, Math.max(0, Number(r.match) || 70)),
      why: String(r.why || ""),
      skillsToLearn: (r.skillsToLearn || []).map(String).slice(0, 6),
      firstSteps: (r.firstSteps || []).map(String).slice(0, 5),
      resources: sanitizeResources(r.resources, { limit: 3 }),
      certifications: sanitizeCertifications(r.certifications, { limit: 3 }),
    }));
    if (!recommendations.length) throw new Error("empty");
  } catch (err) {
    console.error(`[career] falling back to rules-based recommendations for user ${req.user._id}: ${err.message}`);
    source = "rules";
    recommendations = fallbackRecommendations(perf, req.user);
  }

  const plan = await CareerPlan.create({
    user: req.user._id, interests, strengths, recommendations,
  });
  res.status(201).json({ plan, source, performance: perf });
}));

export default router;
