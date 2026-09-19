import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Server, LogOut, Check, Sparkles, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Page, Card, Banner } from "../components/ui";

const SUBJECTS = ["Python", "Data Structures", "Web Development", "DBMS",
  "Operating Systems", "Networks", "Machine Learning", "Aptitude"];

const STYLES = [
  { id: "hands-on", label: "Hands-on" },
  { id: "visual", label: "Visual" },
  { id: "reading", label: "Reading" },
  { id: "mixed", label: "Mixed" },
];

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", department: "", year: 2, dailyTargetMinutes: 60, learningStyle: "hands-on",
  });
  const [subjects, setSubjects] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [liveCheck, setLiveCheck] = useState(null); // null | "checking" | result object
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("edumind-ai-model") || "");
  // Reactive to the model picker below — health.aiEngine only reflects the
  // server's env default, so switching models here would otherwise leave
  // this row lying about what's actually about to answer.
  const effectiveModel = selectedModel || health?.aiModel || "";
  const effectiveLabel = health?.availableModels?.find((m) => m.id === effectiveModel)?.label || effectiveModel;
  const effectiveIsQwen = /qwen/i.test(effectiveModel);

  function chooseModel(id) {
    setSelectedModel(id);
    localStorage.setItem("edumind-ai-model", id);
    setLiveCheck(null); // old result was for a different model — don't show it as current
  }

  async function testLiveConnection() {
    setLiveCheck("checking");
    try {
      const { data } = await api.get("/api/health/ai-check");
      setLiveCheck(data);
    } catch (err) {
      setLiveCheck({ ok: false, error: errMsg(err, "Couldn't reach the connection test itself.") });
    }
  }

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name, department: user.department, year: user.year,
      dailyTargetMinutes: user.dailyTargetMinutes, learningStyle: user.learningStyle,
    });
    setSubjects(user.subjects || []);
  }, [user]);

  useEffect(() => {
    api.get("/api/health").then(({ data }) => setHealth(data)).catch(() => setHealth({ status: "unreachable" }));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleSubject = (s) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function save(e) {
    e.preventDefault();
    if (!subjects.length) return setError("Keep at least one subject — your plan is built from these.");
    setBusy(true);
    setError("");
    try {
      await updateProfile({
        ...form, year: Number(form.year),
        dailyTargetMinutes: Number(form.dailyTargetMinutes), subjects,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(errMsg(err, "Couldn't save your changes."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Profile saved. New quizzes and plans will use these settings.</Banner>}

      <div className="grid split">
        <Card>
          <h3 className="sec-title">Learning profile</h3>
          <p className="sec-sub">
            These shape every explanation, quiz and study block EduMind generates.
          </p>

          <form onSubmit={save}>
            <label className="field">
              <label htmlFor="sname">Name</label>
              <input id="sname" value={form.name} onChange={set("name")} />
            </label>

            <div className="grid g2" style={{ gap: 12 }}>
              <label className="field">
                <label htmlFor="sdept">Department</label>
                <input id="sdept" value={form.department} onChange={set("department")} />
              </label>
              <label className="field">
                <label htmlFor="syear">Year</label>
                <select id="syear" value={form.year} onChange={set("year")}>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </label>
            </div>

            <div className="field">
              <label>Subjects</label>
              <div className="row wrap" style={{ gap: 7 }}>
                {[...new Set([...SUBJECTS, ...subjects])].map((s) => (
                  <button key={s} type="button" className={`chip ${subjects.includes(s) ? "on" : ""}`}
                    onClick={() => toggleSubject(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>How you learn best</label>
              <div className="row wrap" style={{ gap: 7 }}>
                {STYLES.map((s) => (
                  <button key={s.id} type="button"
                    className={`chip ${form.learningStyle === s.id ? "on" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, learningStyle: s.id }))}>{s.label}</button>
                ))}
              </div>
            </div>

            <label className="field">
              <label htmlFor="starget">Daily study target</label>
              <select id="starget" value={form.dailyTargetMinutes} onChange={set("dailyTargetMinutes")}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
              <span className="hint">Used when EduMind sizes your daily study blocks.</span>
            </label>

            <button className="btn" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" /> Saving…</> : saved ? <><Check size={15} /> Saved</> : "Save changes"}
            </button>
          </form>
        </Card>

        <div className="stack">
          <Card>
            <h3 className="sec-title">Appearance</h3>
            <p className="sec-sub">Dark mode follows your system setting until you pick one</p>
            <div className="row" style={{ gap: 9 }}>
              <button className={`chip ${theme === "light" ? "on" : ""}`} onClick={() => setTheme("light")}>
                <Sun size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Light
              </button>
              <button className={`chip ${theme === "dark" ? "on" : ""}`} onClick={() => setTheme("dark")}>
                <Moon size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Dark
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="sec-title">Server</h3>
            <p className="sec-sub">Useful when something isn't loading</p>
            {!health ? (
              <span className="muted" style={{ fontSize: 13 }}>Checking…</span>
            ) : (
              <>
                <Row label="API status" value={
                  <span className={`tag ${health.status === "ok" ? "green" : "red"}`}>
                    {health.status === "ok" ? "Connected" : "Unreachable"}
                  </span>
                } />
                {health.status === "ok" && (
                  <>
                    <Row label="AI engine" value={
                      <span className={`tag ${effectiveIsQwen ? "violet" : "blue"}`}>
                        {effectiveIsQwen && <Sparkles size={11} />} {effectiveIsQwen ? "Qwen" : effectiveLabel}
                      </span>
                    } />
                    <Row label="Served via" value={<span className="tag blue">{health.aiProvider}</span>} />
                    <Row label="Model" value={<code style={{ fontSize: 12 }}>{selectedModel || health.aiModel}</code>} />
                    <Row label="API key" value={
                      <span className={`tag ${health.aiConfigured ? "green" : "amber"}`}>
                        {health.aiConfigured ? "Present" : "Missing — using fallbacks"}
                      </span>
                    } />
                  </>
                )}
              </>
            )}
            {health && !health.aiConfigured && health.status === "ok" && (
              <p className="muted" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
                Every feature still works — you'll get EduMind's seeded content instead of
                answers written for your exact question. Add a key on the server to switch it on.
              </p>
            )}

            {health?.availableModels?.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <p className="sec-sub" style={{ margin: "0 0 8px" }}>
                  AI model — each one has its own rate limit. Hit "going faster than the free
                  tier allows"? Switch models here instead of waiting.
                </p>
                <div className="row wrap" style={{ gap: 7 }}>
                  {health.availableModels.map((m) => {
                    const isCurrent = selectedModel ? selectedModel === m.id : m.id === health.aiModel;
                    return (
                      <button key={m.id} type="button" title={m.note}
                        className={`chip ${isCurrent ? "on" : ""}`}
                        onClick={() => chooseModel(m.id)}>
                        {m.note?.startsWith("Qwen") && <Sparkles size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />}
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, maxWidth: 200 }}>
                  "Present" only means the key exists — this actually calls {effectiveIsQwen ? "Qwen" : effectiveLabel || "the AI"}.
                </span>
                <button type="button" className="btn ghost" style={{ fontSize: 12.5, padding: "6px 10px" }}
                  disabled={liveCheck === "checking"} onClick={testLiveConnection}>
                  {liveCheck === "checking"
                    ? <><Loader2 size={13} className="spin" /> Testing…</>
                    : <><Zap size={13} /> Test live connection</>}
                </button>
              </div>
              {liveCheck && liveCheck !== "checking" && (
                <div style={{ marginTop: 10 }}>
                  <span className={`tag ${liveCheck.ok ? "green" : "red"}`}>
                    {liveCheck.ok ? <><Check size={11} /> Live request succeeded</> : <><AlertTriangle size={11} /> Live request failed</>}
                  </span>
                  {liveCheck.ok ? (
                    <p className="muted" style={{ fontSize: 11.5, marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
                      {effectiveIsQwen ? "Qwen" : effectiveLabel || "The model"} replied in {liveCheck.latencyMs}ms
                      {liveCheck.cached ? " (cached result — click again to force a fresh call)" : ""}.
                    </p>
                  ) : (
                    <p className="muted" style={{ fontSize: 11.5, marginTop: 8, marginBottom: 0, lineHeight: 1.6, wordBreak: "break-word" }}>
                      Reason: <code style={{ fontSize: 11 }}>{liveCheck.error}</code>
                      {liveCheck.cached ? " (cached — click again to re-test)" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="sec-title">Account</h3>
            <p className="sec-sub">{user?.email}</p>
            <button className="btn danger full" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut size={15} /> Sign out
            </button>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
      <span className="muted">{label}</span>
      {value}
    </div>
  );
}
