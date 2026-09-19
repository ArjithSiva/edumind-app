import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, X, ArrowRight, BookOpen } from "lucide-react";
import { api, errMsg } from "../api";
import { Card, Banner } from "../components/ui";

const LEVEL_COPY = {
  Beginner: "We'll start with the fundamentals and build up from there.",
  Intermediate: "You've got a solid base — we'll mix in some sharper practice.",
  Advanced: "You're ahead of the curve — we'll lean into harder material early.",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("start"); // start | question | flash | done | unavailable | error
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null); // { quizId, question, subject, difficulty, step, totalSteps }
  const [tally, setTally] = useState({});
  const [flash, setFlash] = useState(null); // boolean — was the last answer correct
  const [result, setResult] = useState(null);

  function skip() {
    navigate("/", { replace: true });
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/assessment/start");
      setCurrent(data);
      setTally({});
      setPhase("question");
    } catch (err) {
      if (err?.response?.status === 503) setPhase("unavailable");
      else setError(errMsg(err, "Couldn't start the assessment."));
    } finally {
      setBusy(false);
    }
  }

  async function answer(index) {
    if (busy || !current) return;
    setBusy(true);
    try {
      const { data } = await api.post("/api/assessment/answer", {
        quizId: current.quizId, answerIndex: index, step: current.step, tally,
      });
      setFlash(data.wasCorrect);
      setPhase("flash");
      setTimeout(() => {
        if (data.done) {
          setResult(data);
          setPhase("done");
        } else {
          setTally(data.tally);
          setCurrent(data);
          setPhase("question");
        }
      }, 700);
    } catch (err) {
      setError(errMsg(err, "Couldn't submit that answer."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 24px" }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 460 }}>
        <div className="row" style={{ gap: 10, marginBottom: 22, justifyContent: "center" }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
            <BookOpen size={17} />
          </span>
          <b style={{ fontFamily: "var(--display)", fontSize: 17 }}>EduMind AI</b>
        </div>

        <Card className="raised">
          {error && <Banner kind="error">{error}</Banner>}

          {phase === "start" && (
            <div style={{ textAlign: "center" }}>
              <div className="ring" style={{ margin: "0 auto 16px" }}><Sparkles size={22} /></div>
              <h2 style={{ fontSize: 19, marginBottom: 8 }}>Quick placement check</h2>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 22px" }}>
                Five questions across your subjects. The difficulty adjusts as you answer, so
                we can gauge your level and point your first study plan at the right spots —
                it takes about two minutes.
              </p>
              <button className="btn full" onClick={start} disabled={busy}>
                {busy ? <><span className="spinner" /> Starting…</> : <>Start assessment <ArrowRight size={15} /></>}
              </button>
              <button className="btn ghost full" style={{ marginTop: 10 }} onClick={skip}>
                Skip for now
              </button>
            </div>
          )}

          {phase === "unavailable" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 17, marginBottom: 8 }}>Assessment isn't available right now</h2>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
                No AI key is configured and the seeded question bank is empty on this server.
                That's fine — you can jump straight in, and everything still works.
              </p>
              <button className="btn full" onClick={skip}>Go to dashboard</button>
            </div>
          )}

          {(phase === "question" || phase === "flash") && current && (
            <div>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <span className="tag violet">{current.subject}</span>
                <small className="muted" style={{ fontSize: 11.5 }}>
                  Question {current.step} of {current.totalSteps} · {current.difficulty}
                </small>
              </div>

              <AnimatePresence mode="wait">
                {phase === "flash" ? (
                  <motion.div key="flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ textAlign: "center", padding: "28px 0" }}>
                    <div className="ring" style={{
                      background: flash ? "var(--green-soft)" : "var(--amber-soft)",
                      color: flash ? "var(--green)" : "var(--amber)",
                    }}>
                      {flash ? <Check size={20} /> : <X size={20} />}
                    </div>
                    <b style={{ fontSize: 14 }}>{flash ? "Correct" : "Not quite"}</b>
                  </motion.div>
                ) : (
                  <motion.div key={current.quizId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 16, fontWeight: 500 }}>
                      {current.question.q}
                    </p>
                    <div className="stack" style={{ gap: 8 }}>
                      {current.question.options.map((opt, i) => (
                        <button key={i} disabled={busy} onClick={() => answer(i)}
                          className="row"
                          style={{
                            padding: "12px 13px", borderRadius: 10, textAlign: "left", fontSize: 13.5,
                            border: "1px solid var(--line)", background: "var(--surface)",
                            cursor: busy ? "default" : "pointer", width: "100%",
                          }}>
                          <span style={{
                            width: 23, height: 23, borderRadius: "50%", flex: "none",
                            display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
                            border: "1.5px solid var(--line-strong)", color: "var(--muted)",
                          }}>{String.fromCharCode(65 + i)}</span>
                          <span>{opt}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button className="btn ghost full" style={{ marginTop: 18 }} onClick={skip} disabled={busy}>
                Skip for now
              </button>
            </div>
          )}

          {phase === "done" && result && (
            <div style={{ textAlign: "center" }}>
              <div className="ring" style={{ margin: "0 auto 14px" }}><Sparkles size={22} /></div>
              <h2 style={{ fontSize: 19, marginBottom: 4 }}>You're placed at {result.level}</h2>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 18px" }}>
                {LEVEL_COPY[result.level] || "Your study plan will build from here."}
              </p>

              {result.strengths?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <small className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Strengths</small>
                  <div className="row wrap" style={{ gap: 6, justifyContent: "center", marginTop: 6 }}>
                    {result.strengths.map((s) => <span key={s} className="tag green">{s}</span>)}
                  </div>
                </div>
              )}
              {result.weaknesses?.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <small className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Added to your plan first</small>
                  <div className="row wrap" style={{ gap: 6, justifyContent: "center", marginTop: 6 }}>
                    {result.weaknesses.map((s) => <span key={s} className="tag amber">{s}</span>)}
                  </div>
                </div>
              )}

              <button className="btn full" onClick={skip}>Go to dashboard <ArrowRight size={15} /></button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
