import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, HelpCircle, CalendarDays, BarChart3, Compass, FileText,
  MessagesSquare, CheckCircle2, Flame, Clock, Target, ArrowRight, AlertTriangle,
} from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Page, Card, Banner, Skeleton, timeAgo, TONE_STYLE, listMotion, itemMotion, scoreColor,
} from "../components/ui";

const MODULES = [
  { to: "/tutor", icon: BookOpen, label: "AI Tutor", copy: "Ask anything, get it explained at your level", tone: "blue" },
  { to: "/quiz", icon: HelpCircle, label: "Quiz Generator", copy: "Practice questions on any topic, graded instantly", tone: "violet" },
  { to: "/planner", icon: CalendarDays, label: "Study Planner", copy: "A schedule built around your weak topics", tone: "green" },
  { to: "/progress", icon: BarChart3, label: "Progress", copy: "Track what's improving and what still isn't", tone: "amber" },
];

const SHORTCUTS = [
  { to: "/career", icon: Compass, label: "Career Guidance" },
  { to: "/assignments", icon: FileText, label: "Assignments" },
  { to: "/doubts", icon: MessagesSquare, label: "Doubt Forum" },
];

const FEED_ICON = { quiz: CheckCircle2, task: BookOpen, tutor: MessagesSquare, assignment: FileText };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [planner, setPlanner] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get("/api/progress"),
      api.get("/api/progress/activity"),
      api.get("/api/planner"),
    ])
      .then(([p, a, pl]) => {
        if (!alive) return;
        setData(p.data);
        setFeed(a.data.feed);
        setPlanner(pl.data);
      })
      .catch((err) => alive && setError(errMsg(err)));
    return () => { alive = false; };
  }, []);

  const s = data?.summary;
  const focus = planner?.focus;
  const weakest = data?.weakAreas?.[0];
  const firstName = (user?.name || "there").split(" ")[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}

      {/* ---------------------------------------------------------- hero */}
      <Card className="raised" style={{ marginBottom: 16, overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(900px 220px at 88% -40%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div className="row wrap" style={{ justifyContent: "space-between", gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 22 }}>{greeting}, {firstName}</h2>
              <p className="muted" style={{ margin: "5px 0 0", fontSize: 13.5, maxWidth: "60ch" }}>
                {weakest
                  ? <>Your weakest topic right now is <strong style={{ color: "var(--text)" }}>{weakest.topic}</strong> at {weakest.average}%. Fifteen minutes today moves the needle more than an hour on something you already know.</>
                  : "Take your first quiz and EduMind will start building your plan around the results."}
              </p>
            </div>
            {s && (
              <div className="row" style={{ gap: 18 }}>
                <Stat icon={Flame} tone="amber" label="Day streak" value={s.streak} />
                <Stat icon={Clock} tone="violet" label="Study hours" value={s.studyHours} />
                <Stat icon={Target} tone="green" label="Overall" value={`${s.overall}%`} />
              </div>
            )}
          </div>

          <motion.div className="grid g4" style={{ marginTop: 20 }} variants={listMotion} initial="initial" animate="animate">
            {MODULES.map((m) => (
              <motion.button
                key={m.to}
                variants={itemMotion}
                onClick={() => navigate(m.to)}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.16 }}
                style={{
                  textAlign: "left", padding: 15, borderRadius: 12,
                  background: TONE_STYLE[m.tone].background,
                  border: "1px solid transparent",
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center",
                  background: "var(--surface)", color: TONE_STYLE[m.tone].color, marginBottom: 10,
                }}>
                  <m.icon size={16} />
                </span>
                <b style={{ display: "block", fontSize: 13.5, marginBottom: 3, color: "var(--text)" }}>{m.label}</b>
                <small style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>{m.copy}</small>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </Card>

      {/* --------------------------------------------------------- body */}
      <div className="grid split">
        <div className="stack">
          <Card>
            <h3 className="sec-title">Recent activity</h3>
            <p className="sec-sub">Everything you've done across EduMind</p>
            {!data ? (
              <div className="stack" style={{ gap: 10 }}>
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={34} />)}
              </div>
            ) : feed.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Nothing yet. <Link to="/quiz">Take a quiz</Link> and it'll show up here.
              </p>
            ) : (
              <motion.div variants={listMotion} initial="initial" animate="animate">
                {feed.map((f, i) => {
                  const Icon = FEED_ICON[f.type] || CheckCircle2;
                  return (
                    <motion.div key={i} variants={itemMotion} className="row"
                      style={{
                        padding: "10px 2px",
                        borderBottom: i < feed.length - 1 ? "1px solid var(--line)" : "none",
                      }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                        flex: "none", ...TONE_STYLE[f.tone],
                      }}>
                        <Icon size={13} />
                      </span>
                      <span style={{ flex: 1, fontSize: 13 }}>{f.text}</span>
                      <time className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{timeAgo(f.at)}</time>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </Card>

          {data?.subjects?.length > 0 && (
            <Card>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 className="sec-title">Where you stand</h3>
                  <p className="sec-sub" style={{ marginBottom: 0 }}>Average quiz score by subject</p>
                </div>
                <Link to="/progress" className="btn ghost sm">Full breakdown</Link>
              </div>
              <div className="stack" style={{ gap: 13 }}>
                {data.subjects.slice(0, 4).map((sub) => (
                  <div key={sub.subject}>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                      <b style={{ fontWeight: 600 }}>{sub.subject}</b>
                      <span className="muted" style={{ fontWeight: 600, fontSize: 12.5 }}>{sub.average}%</span>
                    </div>
                    <div style={{ height: 7, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${sub.average}%` }}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: "100%", borderRadius: 999, background: scoreColor(sub.average) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="stack">
          {/* today's focus */}
          <div style={{
            background: "linear-gradient(155deg, var(--navy) 0%, var(--navy-2) 100%)",
            color: "#fff", borderRadius: "var(--r)", padding: 18, boxShadow: "var(--shadow)",
          }}>
            <div className="row" style={{ gap: 6, marginBottom: 12 }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} style={{
                  width: 26, height: 30, borderRadius: 7, display: "grid", placeItems: "center",
                  fontSize: 10.5, fontWeight: 600,
                  background: i < (s?.streak || 0) ? "var(--brand)" : "rgba(255,255,255,.12)",
                  color: i < (s?.streak || 0) ? "#fff" : "#8a97bd",
                }}>{d}</span>
              ))}
            </div>
            <b style={{ display: "block", fontSize: 14.5, marginBottom: 5 }}>
              {focus ? focus.title : "Nothing scheduled today"}
            </b>
            <p style={{ margin: "0 0 15px", fontSize: 12.5, color: "#b9c4e4", lineHeight: 1.6 }}>
              {focus?.note || "Generate a plan and EduMind will schedule your weakest topics first."}
            </p>
            <Link to="/planner" className="btn" style={{ background: "#fff", color: "var(--navy)", width: "100%" }}>
              Open today's plan <ArrowRight size={14} />
            </Link>
          </div>

          {data?.weakAreas?.length > 0 && (
            <Card>
              <h3 className="sec-title">Needs attention</h3>
              <p className="sec-sub">Topics EduMind pushed up your plan</p>
              {data.weakAreas.slice(0, 3).map((w) => (
                <div key={w.topic} className="row" style={{
                  alignItems: "flex-start", gap: 10, padding: 11,
                  borderRadius: 10, background: "var(--amber-soft)", marginBottom: 8,
                }}>
                  <AlertTriangle size={15} style={{ color: "var(--amber)", flex: "none", marginTop: 2 }} />
                  <span>
                    <b style={{ display: "block", fontSize: 13 }}>{w.topic}</b>
                    <small className="muted" style={{ fontSize: 11.5 }}>
                      Averaging {w.average}% across {w.attempts} attempt{w.attempts > 1 ? "s" : ""}
                    </small>
                  </span>
                </div>
              ))}
              <Link to="/tutor" className="btn ghost full" style={{ marginTop: 6 }}>
                Learn these with the tutor
              </Link>
            </Card>
          )}

          <Card>
            <h3 className="sec-title">Also available</h3>
            <p className="sec-sub">The rest of the toolkit</p>
            <div className="stack" style={{ gap: 8 }}>
              {SHORTCUTS.map((sc) => (
                <Link key={sc.to} to={sc.to} className="row" style={{
                  padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)",
                  color: "var(--text)", textDecoration: "none", fontSize: 13.5, fontWeight: 500,
                }}>
                  <sc.icon size={15} style={{ color: "var(--brand)" }} />
                  {sc.label}
                  <ArrowRight size={14} style={{ marginLeft: "auto", color: "var(--muted)" }} />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Stat({ icon: Icon, tone, label, value }) {
  return (
    <div className="row" style={{ gap: 9 }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
        flex: "none", ...TONE_STYLE[tone],
      }}>
        <Icon size={16} />
      </span>
      <span>
        <small className="muted" style={{ display: "block", fontSize: 11.5 }}>{label}</small>
        <b style={{ fontSize: 18, fontFamily: "var(--display)", letterSpacing: "-0.02em" }}>{value}</b>
      </span>
    </div>
  );
}
