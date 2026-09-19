import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sparkles, Trash2, Copy, Check, Download } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Page, Card, Banner, Empty, Markdown, FallbackNote, formatDate, timeAgo,
} from "../components/ui";

const TYPES = [
  { id: "worksheet", label: "Worksheet" },
  { id: "coding", label: "Coding task" },
  { id: "essay", label: "Essay" },
  { id: "case-study", label: "Case study" },
  { id: "lab-report", label: "Lab report" },
];

const STATUS = { draft: "", "in-progress": "blue", submitted: "green" };

export default function Assignments() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({
    brief: "", type: "worksheet", subject: "", difficulty: "Medium",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("ai");
  const [copied, setCopied] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestReason, setSuggestReason] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (user?.subjects?.length) setForm((f) => ({ ...f, subject: f.subject || user.subjects[0] }));
  }, [user]);

  const load = () =>
    api.get("/api/assignments")
      .then(({ data }) => {
        setList(data.assignments);
        setActive((a) => a || data.assignments[0] || null);
      })
      .catch((err) => setError(errMsg(err)));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // Switching to a different saved assignment starts the submission box fresh.
    setSubmissionText("");
    setSubmitError("");
  }, [active?._id]);

  async function suggestTopic() {
    setSuggesting(true);
    setSuggestReason("");
    try {
      const { data } = await api.get("/api/assignments/suggest-topic");
      setForm((f) => ({ ...f, brief: data.topic, subject: data.subject || f.subject }));
      setSuggestReason(data.reason);
    } catch (err) {
      setError(errMsg(err, "Couldn't suggest a topic."));
    } finally {
      setSuggesting(false);
    }
  }

  async function generate(e) {
    e.preventDefault();
    if (!form.brief.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/assignments/generate", form);
      setSource(data.source);
      setActive(data.assignment);
      setForm((f) => ({ ...f, brief: "" }));
      load();
    } catch (err) {
      setError(errMsg(err, "Couldn't generate that assignment."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/api/assignments/${id}`);
      if (active?._id === id) setActive(null);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function setStatus(status) {
    try {
      const { data } = await api.patch(`/api/assignments/${active._id}`, { status });
      setActive(data.assignment);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  function copy() {
    navigator.clipboard.writeText(active.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function download() {
    const blob = new Blob([active.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setSubmitError("Only .txt or .md files are supported — paste the text in directly for anything else.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSubmissionText((t) => (t ? t + "\n\n" + reader.result : String(reader.result)));
    reader.onerror = () => setSubmitError("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = ""; // allow re-uploading the same file name later
  }

  async function submitAnswer() {
    if (!submissionText.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data } = await api.post(`/api/assignments/${active._id}/submit`, { text: submissionText });
      setActive(data.assignment);
      load();
    } catch (err) {
      setSubmitError(errMsg(err, "Couldn't submit that for review."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}
      <FallbackNote source={source} />

      <div className="grid split-narrow">
        <div className="stack">
          <Card>
            <h3 className="sec-title">New assignment</h3>
            <p className="sec-sub">Describe the topic — EduMind writes the brief, tasks and marking scheme</p>

            <form onSubmit={generate}>
              <label className="field">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="brief" style={{ margin: 0 }}>What should it cover?</label>
                  <button type="button" className="link-btn" onClick={suggestTopic} disabled={suggesting}>
                    <Sparkles size={11} /> {suggesting ? "Thinking…" : "Suggest a topic"}
                  </button>
                </div>
                <textarea id="brief" value={form.brief} rows={3}
                  onChange={(e) => setForm({ ...form, brief: e.target.value })}
                  placeholder="e.g. Binary search trees — insertion, deletion and traversal" />
                {suggestReason && <span className="hint">{suggestReason}</span>}
              </label>

              <label className="field">
                <label htmlFor="atype">Format</label>
                <select id="atype" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>

              <div className="grid g2" style={{ gap: 12 }}>
                <label className="field">
                  <label htmlFor="asub">Subject</label>
                  <select id="asub" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                    {(user?.subjects || []).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="field">
                  <label htmlFor="adiff">Difficulty</label>
                  <select id="adiff" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    {["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
              </div>

              <button className="btn full" type="submit" disabled={busy || !form.brief.trim()}>
                {busy ? <><span className="spinner" /> Writing it…</> : <><Sparkles size={15} /> Generate assignment</>}
              </button>
            </form>
          </Card>

          {list.length > 0 && (
            <Card>
              <h3 className="sec-title">Saved</h3>
              <p className="sec-sub">{list.length} assignment{list.length > 1 ? "s" : ""}</p>
              <div className="stack" style={{ gap: 4 }}>
                {list.map((a) => (
                  <button key={a._id} onClick={() => setActive(a)} className="row"
                    style={{
                      padding: "9px 10px", borderRadius: 9, textAlign: "left", width: "100%",
                      background: active?._id === a._id ? "var(--brand-soft)" : "transparent",
                    }}>
                    <FileText size={14} style={{
                      flex: "none", color: active?._id === a._id ? "var(--brand)" : "var(--muted)",
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: "block", fontSize: 12.5, fontWeight: 500,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        color: active?._id === a._id ? "var(--brand)" : "var(--text)",
                      }}>{a.title}</span>
                      <small className="muted" style={{ fontSize: 11 }}>
                        {a.subject} · {timeAgo(a.createdAt)}
                      </small>
                    </span>
                    <span role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); remove(a._id); }}
                      onKeyDown={(e) => e.key === "Enter" && remove(a._id)}
                      style={{ color: "var(--muted)", display: "grid", placeItems: "center" }}
                      title="Delete">
                      <Trash2 size={13} />
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card style={{ minHeight: 400 }}>
          <AnimatePresence mode="wait">
            {!active ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Empty icon={FileText} title="Nothing selected">
                  Describe a topic on the left and EduMind writes a full assignment —
                  scenario, objectives, graded tasks and a marking scheme that adds to 100.
                </Empty>
              </motion.div>
            ) : (
              <motion.div key={active._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 17, marginBottom: 5 }}>{active.title}</h2>
                    <div className="row wrap" style={{ gap: 7 }}>
                      <span className="tag blue">{active.subject}</span>
                      <span className="tag">{TYPES.find((t) => t.id === active.type)?.label || active.type}</span>
                      <span className="tag">{active.difficulty}</span>
                      {active.dueDate && <span className="tag amber">Due {formatDate(active.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 7 }}>
                    <button className="icon-btn" onClick={copy} title="Copy markdown" aria-label="Copy markdown">
                      {copied ? <Check size={15} color="var(--green)" /> : <Copy size={15} />}
                    </button>
                    <button className="icon-btn" onClick={download} title="Download as .md" aria-label="Download">
                      <Download size={15} />
                    </button>
                  </div>
                </div>

                <div className="row" style={{ gap: 7, margin: "14px 0 18px" }}>
                  {Object.keys(STATUS).map((st) => (
                    <button key={st} className={`chip ${active.status === st ? "on" : ""}`}
                      onClick={() => setStatus(st)}>
                      {st === "in-progress" ? "In progress" : st[0].toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                  <Markdown>{active.content}</Markdown>
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 18 }}>
                  {active.submission ? (
                    <div>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <h3 className="sec-title" style={{ margin: 0 }}>Your submission</h3>
                        <span className="tag" style={{
                          background: "var(--brand-soft)", color: "var(--brand)", fontSize: 15, fontWeight: 700,
                        }}>{active.submission.score}/100</span>
                      </div>
                      {active.submission.source === "rules" && (
                        <Banner kind="warn">This score is a rough length-based estimate, not a real content review — the AI provider wasn't reachable when this was graded.</Banner>
                      )}
                      <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{active.submission.feedback}</p>
                      {active.submission.strengths?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <small className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Strengths</small>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                            {active.submission.strengths.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {active.submission.improvements?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <small className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>To improve</small>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                            {active.submission.improvements.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      <details>
                        <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>View your submitted answer</summary>
                        <p style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 8 }}>{active.submission.text}</p>
                      </details>
                      <button className="btn ghost" style={{ marginTop: 14, fontSize: 12.5 }}
                        onClick={() => setActive((a) => ({ ...a, submission: null }))}>
                        Submit a revised answer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <h3 className="sec-title" style={{ margin: 0 }}>Submit your answer</h3>
                        <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
                          <FileText size={11} /> Upload .txt / .md
                        </button>
                        <input ref={fileRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: "none" }} />
                      </div>
                      {submitError && <Banner kind="error">{submitError}</Banner>}
                      <textarea value={submissionText} onChange={(e) => setSubmissionText(e.target.value)}
                        rows={8} placeholder="Type your answer here, or upload a .txt / .md file…"
                        className="input" style={{ width: "100%", resize: "vertical", fontSize: 13 }} />
                      <button className="btn full" style={{ marginTop: 10 }}
                        onClick={submitAnswer} disabled={submitting || !submissionText.trim()}>
                        {submitting ? <><span className="spinner" /> Reviewing…</> : <><Sparkles size={15} /> Submit for AI review</>}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </Page>
  );
}
