import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/ui";

const SUBJECTS = ["Python", "Data Structures", "Web Development", "DBMS",
  "Operating Systems", "Networks", "Machine Learning", "Aptitude"];

const STYLES = [
  { id: "hands-on", label: "Hands-on", hint: "Show me code I can run" },
  { id: "visual", label: "Visual", hint: "Diagrams and analogies" },
  { id: "reading", label: "Reading", hint: "Written explanations" },
  { id: "mixed", label: "Mixed", hint: "A bit of everything" },
];

export default function Register() {
  const { register, errMsg } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", email: "", password: "", department: "CSE (IoT)", year: 2,
  });
  const [subjects, setSubjects] = useState(["Python", "Data Structures", "Web Development", "DBMS"]);
  const [learningStyle, setStyle] = useState("hands-on");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleSubject = (s) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!subjects.length) return setError("Pick at least one subject — your whole plan is built from these.");
    setBusy(true);
    try {
      await register({ ...form, year: Number(form.year), subjects, learningStyle });
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(errMsg(err, "Couldn't create your account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }} style={{ position: "relative", zIndex: 1 }}>
          <div className="row" style={{ gap: 10, marginBottom: 26 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}>
              <BookOpen size={17} />
            </span>
            <b style={{ fontFamily: "var(--display)", fontSize: 17 }}>EduMind AI</b>
          </div>
          <h2>Tell us what you're studying.</h2>
          <p>
            The subjects and learning style you pick here shape every explanation,
            quiz and study block EduMind generates for you. You can change them later.
          </p>
        </motion.div>
      </aside>

      <div className="auth-panel">
        <motion.form className="auth-form" onSubmit={submit}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1>Create your account</h1>
          <p>Takes about thirty seconds.</p>

          {error && <Banner kind="error">{error}</Banner>}

          <label className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" value={form.name} onChange={set("name")} required placeholder="Full name" />
          </label>

          <label className="field">
            <label htmlFor="remail">Email</label>
            <input id="remail" type="email" value={form.email} onChange={set("email")} required
              autoComplete="email" placeholder="you@college.edu" />
          </label>

          <label className="field">
            <label htmlFor="rpassword">Password</label>
            <input id="rpassword" type="password" value={form.password} onChange={set("password")}
              required minLength={6} autoComplete="new-password" />
            <span className="hint">At least 6 characters.</span>
          </label>

          <div className="grid g2" style={{ gap: 12 }}>
            <label className="field">
              <label htmlFor="dept">Department</label>
              <input id="dept" value={form.department} onChange={set("department")} />
            </label>
            <label className="field">
              <label htmlFor="year">Year</label>
              <select id="year" value={form.year} onChange={set("year")}>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </label>
          </div>

          <div className="field">
            <label>Subjects you're studying</label>
            <div className="row wrap" style={{ gap: 7 }}>
              {SUBJECTS.map((s) => (
                <button key={s} type="button" className={`chip ${subjects.includes(s) ? "on" : ""}`}
                  onClick={() => toggleSubject(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>How do you learn best?</label>
            <div className="row wrap" style={{ gap: 7 }}>
              {STYLES.map((s) => (
                <button key={s.id} type="button" title={s.hint}
                  className={`chip ${learningStyle === s.id ? "on" : ""}`}
                  onClick={() => setStyle(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>

          <button className="btn full" type="submit" disabled={busy}>
            {busy ? <><span className="spinner" /> Creating account…</> : "Create account"}
          </button>

          <p className="muted" style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
