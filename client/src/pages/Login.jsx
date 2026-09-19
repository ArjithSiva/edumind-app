import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Target, TrendingUp, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/ui";

const POINTS = [
  { icon: Target, title: "A plan that reacts to your scores", body: "Score badly on recursion and it moves to the top of tomorrow's plan. Automatically." },
  { icon: TrendingUp, title: "Progress you can actually read", body: "Subject averages, weak topics and a trend line built from every quiz you've taken." },
  { icon: Users, title: "Never stuck on a doubt", body: "Post a question and get an AI answer straight away — classmates can add better ones underneath." },
];

export default function Login() {
  const { login, errMsg } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(errMsg(err, "Couldn't sign you in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="row" style={{ gap: 10, marginBottom: 26 }}>
            <span className="mark" style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}>
              <BookOpen size={17} />
            </span>
            <b style={{ fontFamily: "var(--display)", fontSize: 17 }}>EduMind AI</b>
          </div>

          <h2>Learning that adapts to how you actually perform.</h2>
          <p>
            Most study apps give everyone the same plan. EduMind reads your quiz results
            and rebuilds your week around the topics you're getting wrong.
          </p>

          <div className="auth-points">
            {POINTS.map((p, i) => (
              <motion.div
                key={p.title}
                className="auth-point"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.09, duration: 0.4 }}
              >
                <span className="dot"><p.icon size={15} /></span>
                <span><b>{p.title}</b><small>{p.body}</small></span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </aside>

      <div className="auth-panel">
        <motion.form
          className="auth-form"
          onSubmit={submit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1>Welcome back</h1>
          <p>Sign in to pick up where you left off.</p>

          {error && <Banner kind="error">{error}</Banner>}

          <label className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button className="btn full" type="submit" disabled={busy}>
            {busy ? <><span className="spinner" /> Signing in…</> : "Sign in"}
          </button>

          <p className="muted" style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
