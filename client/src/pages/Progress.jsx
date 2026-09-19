import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell,
} from "recharts";
import {
  CheckCircle2, Clock, AlertTriangle, Flame, TrendingUp, MessagesSquare, BarChart3,
} from "lucide-react";
import { api, errMsg } from "../api";
import { useTheme } from "../context/ThemeContext";
import {
  Page, Card, Banner, Empty, Skeleton, timeAgo, TONE_STYLE, scoreColor, listMotion, itemMotion,
} from "../components/ui";

export default function Progress() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/progress")
      .then(({ data }) => setData(data))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (error) return <Page><Banner kind="error">{error}</Banner></Page>;

  if (!data) {
    return (
      <Page>
        <div className="grid g4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton h={48} /></Card>)}
        </div>
        <Card><Skeleton h={240} /></Card>
      </Page>
    );
  }

  const s = data.summary;
  const hasData = s.quizzesCompleted > 0;

  const axis = isDark ? "#7d88a3" : "#6b7488";
  const grid = isDark ? "#222b45" : "#e4e9f4";

  const trend = data.trend.map((t, i) => ({
    name: `Q${i + 1}`,
    score: t.percentage,
    topic: t.topic,
  }));

  if (!hasData) {
    return (
      <Page>
        <Card>
          <Empty icon={BarChart3} title="No results to chart yet"
            action={<Link to="/quiz" className="btn">Take your first quiz</Link>}>
            Every quiz you take feeds this dashboard — subject averages, a trend line,
            and the weak topics that drive your study plan.
          </Empty>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      {/* --------------------------------------------------------- stats */}
      <motion.div className="grid g4" style={{ marginBottom: 16 }}
        variants={listMotion} initial="initial" animate="animate">
        <motion.div variants={itemMotion}>
          <Card className="row" style={{ gap: 14 }}>
            <Ring value={s.overall} />
            <span>
              <small className="muted" style={{ display: "block", fontSize: 11.5 }}>Overall progress</small>
              <b style={{ fontSize: 21, fontFamily: "var(--display)" }}>{s.overall}%</b>
              <small className="muted" style={{ display: "block", fontSize: 11 }}>
                Quiz average + plan adherence
              </small>
            </span>
          </Card>
        </motion.div>

        <StatCard icon={CheckCircle2} tone="blue" label="Quizzes completed"
          value={s.quizzesCompleted} sub={`${s.quizAverage}% average`} />
        <StatCard icon={Clock} tone="violet" label="Study hours"
          value={s.studyHours} sub={`${s.tasksCompleted} of ${s.tasksTotal} tasks done`} />
        <StatCard icon={AlertTriangle} tone="amber" label="Weak areas"
          value={s.weakAreaCount} sub={s.weakAreaCount ? "Scheduled first in your plan" : "Nothing below 60%"} />
      </motion.div>

      {/* --------------------------------------------------------- trend */}
      <Card style={{ marginBottom: 16 }}>
        <h3 className="sec-title">Score trend</h3>
        <p className="sec-sub">Every quiz you've taken, oldest first</p>
        <div style={{ height: 232, marginLeft: -12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7a46e0" />
                  <stop offset="100%" stopColor="#2f5bea" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke={axis} fontSize={11.5} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke={axis} fontSize={11.5} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}%`} width={42} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: 10, fontSize: 12.5, boxShadow: "var(--shadow)", color: "var(--text)",
                }}
                labelStyle={{ color: "var(--muted)", marginBottom: 3 }}
                formatter={(v, _n, p) => [`${v}%`, p.payload.topic]}
              />
              <Line type="monotone" dataKey="score" stroke="url(#lineGrad)" strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 0, fill: "var(--brand)" }}
                activeDot={{ r: 5.5 }} animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid split">
        {/* ------------------------------------------------- subjects */}
        <Card>
          <h3 className="sec-title">Subject performance</h3>
          <p className="sec-sub">Average across every quiz, by subject</p>
          <div style={{ height: Math.max(180, data.subjects.length * 46), marginLeft: -6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.subjects} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke={axis} fontSize={11.5}
                  tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="subject" stroke={axis} fontSize={12}
                  tickLine={false} axisLine={false} width={116} />
                <Tooltip
                  cursor={{ fill: "color-mix(in srgb, var(--brand) 8%, transparent)" }}
                  contentStyle={{
                    background: "var(--surface)", border: "1px solid var(--line)",
                    borderRadius: 10, fontSize: 12.5, color: "var(--text)",
                  }}
                  formatter={(v, _n, p) => [`${v}% over ${p.payload.attempts} attempts`, "Average"]}
                />
                <Bar dataKey="average" radius={[0, 6, 6, 0]} animationDuration={800} barSize={17}>
                  {data.subjects.map((sub) => (
                    <Cell key={sub.subject} fill={scoreColor(sub.average)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="stack">
          {data.weakAreas.length > 0 && (
            <Card>
              <h3 className="sec-title">Needs attention</h3>
              <p className="sec-sub">Anything averaging under 60%</p>
              {data.weakAreas.map((w) => (
                <div key={w.topic} className="row" style={{
                  alignItems: "flex-start", gap: 10, padding: 12,
                  borderRadius: 10, background: "var(--amber-soft)", marginBottom: 8,
                }}>
                  <AlertTriangle size={15} style={{ color: "var(--amber)", flex: "none", marginTop: 2 }} />
                  <span>
                    <b style={{ display: "block", fontSize: 13 }}>{w.topic}</b>
                    <small className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                      Averaging {w.average}% across {w.attempts} attempt{w.attempts > 1 ? "s" : ""} —
                      already moved to the top of your plan.
                    </small>
                  </span>
                </div>
              ))}
              <Link to="/tutor" className="btn ghost full" style={{ marginTop: 6 }}>
                Work through these with the tutor
              </Link>
            </Card>
          )}

          <Card>
            <h3 className="sec-title">Habits</h3>
            <p className="sec-sub">How consistently you're showing up</p>
            {[
              { icon: Flame, tone: "amber", label: "Current streak", value: `${s.streak} days` },
              { icon: TrendingUp, tone: "green", label: "Plan adherence", value: `${s.taskCompletionRate}%` },
              { icon: MessagesSquare, tone: "violet", label: "Questions asked", value: s.questionsAsked },
              { icon: CheckCircle2, tone: "blue", label: "Assignments generated", value: s.assignments },
            ].map((h) => (
              <div key={h.label} className="row" style={{ gap: 11, padding: "9px 0" }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 9, flex: "none",
                  display: "grid", placeItems: "center", ...TONE_STYLE[h.tone],
                }}><h.icon size={14} /></span>
                <span style={{ flex: 1, fontSize: 13 }}>{h.label}</span>
                <b style={{ fontSize: 14 }}>{h.value}</b>
              </div>
            ))}
          </Card>

          <Card>
            <h3 className="sec-title">Recent attempts</h3>
            <p className="sec-sub">Your last few quizzes</p>
            {data.recentAttempts.slice(0, 6).map((a, i, arr) => (
              <div key={a._id} className="row" style={{
                padding: "9px 0",
                borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
              }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{
                    display: "block", fontSize: 12.5, fontWeight: 600,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{a.topic}</b>
                  <small className="muted" style={{ fontSize: 11 }}>
                    {a.subject} · {timeAgo(a.createdAt)}
                  </small>
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: scoreColor(a.percentage) }}>
                  {a.percentage}%
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}

function StatCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <motion.div variants={itemMotion}>
      <Card className="row" style={{ gap: 13 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, flex: "none",
          display: "grid", placeItems: "center", ...TONE_STYLE[tone],
        }}><Icon size={17} /></span>
        <span style={{ minWidth: 0 }}>
          <small className="muted" style={{ display: "block", fontSize: 11.5 }}>{label}</small>
          <b style={{ fontSize: 21, fontFamily: "var(--display)", letterSpacing: "-0.02em" }}>{value}</b>
          {sub && <small className="muted" style={{ display: "block", fontSize: 11 }}>{sub}</small>}
        </span>
      </Card>
    </motion.div>
  );
}

/** Animated SVG progress ring. */
function Ring({ value }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <span style={{ width: 54, height: 54, position: "relative", flex: "none" }}>
      <svg width="54" height="54" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="27" cy="27" r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
        <motion.circle
          cx="27" cy="27" r={r} stroke={scoreColor(value)} strokeWidth="6" fill="none"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: 12.5, fontWeight: 700,
      }}>{value}%</span>
    </span>
  );
}
