import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Sparkles, RotateCcw, ArrowRight, CalendarPlus } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { Page, Card, Banner, Empty, Markdown, timeAgo, scoreColor } from "../components/ui";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Quiz() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);

  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);

  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("ai");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestReason, setSuggestReason] = useState("");
  const startedAt = useRef(null);

  const loadHistory = () =>
    api.get("/api/quiz/history/all").then(({ data }) => setHistory(data.attempts)).catch(() => {});

  useEffect(() => { loadHistory(); }, []);

  // Suggest the weakest topic as the default, so the obvious action is the useful one.
  useEffect(() => {
    api.get("/api/progress")
      .then(({ data }) => setTopic(data.weakAreas?.[0]?.topic || data.topics?.[0]?.topic || "Python fundamentals"))
      .catch(() => setTopic("Python fundamentals"));
  }, []);

  async function suggestTopic() {
    setSuggesting(true);
    setSuggestReason("");
    try {
      const { data } = await api.get("/api/quiz/suggest-topic");
      setTopic(data.topic);
      setSuggestReason(data.reason);
    } catch (err) {
      setError(errMsg(err, "Couldn't suggest a topic."));
    } finally {
      setSuggesting(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await api.post("/api/quiz/generate", { topic, difficulty, count });
      setQuiz(data.quiz);
      setSource(data.source);
      setIndex(0);
      setAnswers([]);
      setPicked(null);
      startedAt.current = Date.now();
    } catch (err) {
      setError(errMsg(err, "Couldn't build that quiz."));
    } finally {
      setBusy(false);
    }
  }

  async function choose(k) {
    if (picked !== null) return;
    setPicked(k);
    const next = [...answers];
    next[index] = k;
    setAnswers(next);

    // Answers are never sent to the browser, so grading happens server-side in
    // one submit at the end. Full per-question feedback comes back with it.
    if (index + 1 < quiz.questions.length) {
      setTimeout(() => {
        setIndex((i) => i + 1);
        setPicked(null);
      }, 220);
    } else {
      await submit(next);
    }
  }

  async function submit(finalAnswers) {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/quiz/${quiz._id}/submit`, {
        answers: finalAnswers,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      setResult(data);
      loadHistory();
    } catch (err) {
      setError(errMsg(err, "Couldn't submit your answers."));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    setPicked(null);
    setIndex(0);
  }

  const q = quiz?.questions?.[index];
  const progress = quiz ? ((index + (picked !== null ? 1 : 0)) / quiz.questions.length) * 100 : 0;

  return (
    <Page>
      <div className="grid split-narrow">
        {/* ------------------------------------------------- controls */}
        <div className="stack">
          <Card>
            <h3 className="sec-title">Build a quiz</h3>
            <p className="sec-sub">Questions are written for your year and subjects</p>

            <label className="field">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="topic" style={{ margin: 0 }}>Topic</label>
                <button type="button" className="link-btn" onClick={suggestTopic} disabled={suggesting}>
                  <Sparkles size={11} /> {suggesting ? "Thinking…" : "Suggest a topic"}
                </button>
              </div>
              <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Recursion" />
              <span className="hint">{suggestReason || "Pre-filled with your weakest topic."}</span>
            </label>

            <label className="field">
              <label htmlFor="diff">Difficulty</label>
              <select id="diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>

            <label className="field">
              <label htmlFor="count">Number of questions</label>
              <select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <button className="btn full" onClick={generate} disabled={busy}>
              {busy && !result ? <><span className="spinner" /> Writing questions…</> : <><Sparkles size={15} /> Generate quiz</>}
            </button>
          </Card>

          {history.length > 0 && (
            <Card>
              <h3 className="sec-title">Your attempts</h3>
              <p className="sec-sub">Last {Math.min(history.length, 6)} quizzes</p>
              <div className="stack" style={{ gap: 2 }}>
                {history.slice(0, 6).map((a) => (
                  <div key={a._id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{
                        display: "block", fontSize: 12.5, fontWeight: 600,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{a.topic}</b>
                      <small className="muted" style={{ fontSize: 11 }}>{timeAgo(a.createdAt)}</small>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: scoreColor(a.percentage) }}>
                      {a.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ---------------------------------------------------- quiz */}
        <Card style={{ minHeight: 380 }}>
          {error && <Banner kind="error">{error}</Banner>}
          {source === "bank" && quiz && !result && (
            <Banner kind="warn">
              These came from the seeded question bank — the AI provider didn't respond.
              The quiz still grades and still updates your progress.
            </Banner>
          )}

          <AnimatePresence mode="wait">
            {/* ---------- results ---------- */}
            {result ? (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}>
                <div style={{ textAlign: "center", padding: "22px 10px 8px" }}>
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    style={{
                      fontSize: 46, fontWeight: 700, fontFamily: "var(--display)",
                      letterSpacing: "-0.03em", lineHeight: 1, color: scoreColor(result.percentage),
                    }}
                  >
                    {result.score}/{result.total}
                  </motion.div>
                  <p className="muted" style={{ margin: "10px 0 0", fontSize: 13.5 }}>
                    {result.percentage}% ·{" "}
                    {result.percentage >= 80
                      ? "Strong. This isn't your weak spot any more."
                      : result.percentage >= 50
                      ? "Getting there. Worth one more pass with the tutor."
                      : "This needs work — it's been moved to the top of your plan."}
                  </p>
                </div>

                {result.scheduledTask && (
                  <Banner kind="info">
                    <span>
                      <CalendarPlus size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                      Added <strong>{result.scheduledTask.title}</strong> to today's plan automatically.
                    </span>
                  </Banner>
                )}

                <div className="stack" style={{ gap: 12, marginTop: 8 }}>
                  {quiz.questions.map((question, i) => {
                    const r = result.results[i];
                    return (
                      <div key={i} style={{
                        padding: 14, borderRadius: 11,
                        background: r.correct ? "var(--green-soft)" : "var(--red-soft)",
                      }}>
                        <div className="row" style={{ alignItems: "flex-start", gap: 9, marginBottom: 8 }}>
                          <span className={`tag ${r.correct ? "green" : "red"}`} style={{ flex: "none" }}>
                            {r.correct ? "Correct" : "Missed"}
                          </span>
                          <b style={{ fontSize: 13, fontWeight: 600, whiteSpace: "pre-wrap" }}>{question.q}</b>
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: 12.5 }}>
                          <span className="muted">Answer: </span>
                          <strong>{LETTERS[r.answerIndex]}. {question.options[r.answerIndex]}</strong>
                          {!r.correct && answers[i] !== undefined && (
                            <span className="muted"> · you picked {LETTERS[answers[i]]}</span>
                          )}
                        </p>
                        {r.explanation && (
                          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
                            {r.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="row wrap" style={{ gap: 9, justifyContent: "center", marginTop: 18 }}>
                  <button className="btn ghost" onClick={reset}><RotateCcw size={14} /> Another quiz</button>
                  <Link to="/tutor" className="btn">Learn this with the tutor <ArrowRight size={14} /></Link>
                </div>
              </motion.div>
            ) : quiz && q ? (
              /* ---------- in progress ---------- */
              <motion.div key={`q-${index}`} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.22 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <b style={{ fontSize: 14.5 }}>{quiz.topic}</b>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                    Question {index + 1} of {quiz.questions.length}
                  </span>
                </div>

                <div style={{ height: 5, background: "var(--line)", borderRadius: 999, overflow: "hidden", marginBottom: 18 }}>
                  <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }}
                    style={{ height: "100%", background: "var(--brand)", borderRadius: 999 }} />
                </div>

                <p style={{ fontSize: 14.5, fontWeight: 600, margin: "0 0 15px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {q.q}
                </p>

                <div className="stack" style={{ gap: 8 }}>
                  {q.options.map((opt, k) => (
                    <motion.button
                      key={k}
                      onClick={() => choose(k)}
                      disabled={picked !== null || busy}
                      whileHover={picked === null ? { x: 3 } : {}}
                      transition={{ duration: 0.14 }}
                      className="row"
                      style={{
                        padding: "12px 13px", borderRadius: 10, textAlign: "left", fontSize: 13.5,
                        border: `1px solid ${picked === k ? "var(--brand)" : "var(--line)"}`,
                        background: picked === k ? "var(--brand-soft)" : "var(--surface)",
                        cursor: picked !== null ? "default" : "pointer",
                      }}
                    >
                      <span style={{
                        width: 23, height: 23, borderRadius: "50%", flex: "none",
                        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${picked === k ? "var(--brand)" : "var(--line-strong)"}`,
                        background: picked === k ? "var(--brand)" : "transparent",
                        color: picked === k ? "#fff" : "var(--muted)",
                      }}>{LETTERS[k]}</span>
                      <span>{opt}</span>
                    </motion.button>
                  ))}
                </div>

                <p className="muted" style={{ fontSize: 12, marginTop: 14, textAlign: "right" }}>
                  {busy ? "Grading…" : "Answers and explanations appear after the last question."}
                </p>
              </motion.div>
            ) : (
              /* ---------- idle ---------- */
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Empty icon={HelpCircle} title="No quiz yet">
                  Pick a topic on the left and generate a set. Every answer is explained,
                  and a weak score reschedules that topic in your planner automatically.
                </Empty>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </Page>
  );
}
