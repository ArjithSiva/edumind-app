import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Sparkles, Plus, Trash2, Target, CalendarDays, Clock, Zap, ArrowRight,
} from "lucide-react";
import { api, errMsg } from "../api";
import { Page, Card, Banner, Empty, Skeleton, formatDate, ResourceList } from "../components/ui";

const PRIORITY = {
  1: { label: "High", cls: "red" },
  2: { label: "Normal", cls: "blue" },
  3: { label: "Low", cls: "" },
};

export default function Planner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", subject: "", durationMinutes: 45 });

  const load = () =>
    api.get("/api/planner")
      .then(({ data }) => setData(data))
      .catch((err) => setError(errMsg(err)));

  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const { data: res } = await api.post("/api/planner/generate", { days: 7 });
      setNote(
        res.source === "ai"
          ? `Plan rebuilt around ${res.weakTopics.length || "your"} weak topic${res.weakTopics.length === 1 ? "" : "s"}.`
          : "Plan rebuilt using EduMind's scheduling rules — the AI provider didn't respond."
      );
      await load();
    } catch (err) {
      setError(errMsg(err, "Couldn't rebuild your plan."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task) {
    // Optimistic: flip locally first so the checkbox feels instant.
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t._id === task._id ? { ...t, completed: !t.completed } : t)),
    }));
    try {
      await api.patch(`/api/planner/tasks/${task._id}`, { completed: !task.completed });
      load();
    } catch (err) {
      setError(errMsg(err));
      load();
    }
  }

  async function removeTask(id) {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t._id !== id) }));
    try {
      await api.delete(`/api/planner/tasks/${id}`);
    } catch (err) {
      setError(errMsg(err));
      load();
    }
  }

  async function addTask(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    try {
      await api.post("/api/planner/tasks", { ...draft, topic: draft.title });
      setDraft({ title: "", subject: "", durationMinutes: 45 });
      setAdding(false);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (!data) {
    return (
      <Page>
        <div className="grid split">
          <Card><Skeleton h={22} w="40%" /><div style={{ height: 14 }} />
            {[0, 1, 2, 3].map((i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton h={42} /></div>)}
          </Card>
          <Card><Skeleton h={160} /></Card>
        </div>
      </Page>
    );
  }

  const { goals, tasks, focus, weakTopics } = data;
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}
      {note && <Banner kind="success">{note}</Banner>}

      <div className="grid split">
        <div className="stack">
          {/* --------------------------------------------------- goals */}
          <Card>
            <h3 className="sec-title">My goals</h3>
            <p className="sec-sub">What you're working towards</p>

            {goals.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No goals set yet.</p>
            ) : (
              goals.map((g, i) => (
                <div key={g._id} className="row" style={{
                  gap: 12, padding: "12px 0",
                  borderBottom: i < goals.length - 1 ? "1px solid var(--line)" : "none",
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 10, flex: "none", display: "grid",
                    placeItems: "center", background: "var(--brand-soft)", color: "var(--brand)",
                  }}><Target size={15} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 13.5 }}>{g.title}</b>
                    <small className="muted" style={{ fontSize: 11.5 }}>
                      {g.targetDate ? `Target: ${formatDate(g.targetDate)} · ` : ""}{g.progress}% there
                    </small>
                    <span style={{
                      display: "block", height: 5, background: "var(--line)",
                      borderRadius: 999, marginTop: 7, overflow: "hidden",
                    }}>
                      <motion.span initial={{ width: 0 }} animate={{ width: `${g.progress}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display: "block", height: "100%", borderRadius: 999, background: "var(--brand)" }} />
                    </span>
                  </span>
                  <span className={`tag ${g.status === "behind" ? "amber" : g.status === "done" ? "green" : "blue"}`}>
                    {g.status === "behind" ? "Behind" : g.status === "done" ? "Done" : "On track"}
                  </span>
                </div>
              ))
            )}
          </Card>

          {/* --------------------------------------------------- tasks */}
          <Card>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <h3 className="sec-title">Your study plan</h3>
                <p className="sec-sub" style={{ marginBottom: 0 }}>
                  {weakTopics.length
                    ? `Reordered around ${weakTopics.map((w) => w.topic).slice(0, 2).join(" and ")}`
                    : "Take a few quizzes and EduMind will reorder this around your results"}
                </p>
              </div>
              <button className="btn ghost sm" onClick={() => setAdding((a) => !a)}>
                <Plus size={14} /> Add
              </button>
            </div>

            <AnimatePresence>
              {adding && (
                <motion.form
                  onSubmit={addTask}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    padding: 13, border: "1px dashed var(--line-strong)",
                    borderRadius: 10, margin: "12px 0",
                  }}>
                    <div className="row wrap" style={{ gap: 9 }}>
                      <input className="input" style={{ flex: 2, minWidth: 180 }} autoFocus
                        placeholder="What will you study?" value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      <input className="input" style={{ flex: 1, minWidth: 110 }}
                        placeholder="Subject" value={draft.subject}
                        onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                      <button className="btn sm" type="submit">Add task</button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div style={{ marginTop: 10 }}>
              {pending.length === 0 && done.length === 0 ? (
                <Empty icon={CalendarDays} title="No tasks scheduled"
                  action={<button className="btn" onClick={generate} disabled={busy}>
                    {busy ? <><span className="spinner" /> Building…</> : <><Sparkles size={15} /> Build my plan</>}
                  </button>}>
                  EduMind will schedule your weakest topics first and spread the rest across the week.
                </Empty>
              ) : (
                <AnimatePresence initial={false}>
                  {[...pending, ...done].map((t) => (
                    <motion.div
                      key={t._id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -14 }}
                      transition={{ duration: 0.2 }}
                      className="row"
                      style={{ gap: 11, padding: "11px 0", borderBottom: "1px solid var(--line)" }}
                    >
                      <button
                        onClick={() => toggle(t)}
                        aria-label={t.completed ? "Mark as not done" : "Mark as done"}
                        style={{
                          width: 21, height: 21, borderRadius: 6, flex: "none",
                          display: "grid", placeItems: "center",
                          border: `1.5px solid ${t.completed ? "var(--green)" : "var(--line-strong)"}`,
                          background: t.completed ? "var(--green)" : "transparent",
                        }}
                      >
                        <AnimatePresence>
                          {t.completed && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                              style={{ display: "grid", placeItems: "center" }}>
                              <Check size={12} color="#fff" strokeWidth={3} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{
                          display: "block", fontSize: 13.5, fontWeight: 600,
                          textDecoration: t.completed ? "line-through" : "none",
                          color: t.completed ? "var(--muted)" : "var(--text)",
                        }}>{t.title}</b>
                        <small className="muted" style={{ fontSize: 11.5 }}>
                          {formatDate(t.scheduledFor)} · {t.durationMinutes} min
                          {t.note ? ` · ${t.note}` : ""}
                        </small>
                        {!t.completed && <ResourceList resources={t.resources} label="Resources" />}
                      </span>

                      {t.autoScheduled && !t.completed && (
                        <span className="tag violet" title="Scheduled by EduMind from your quiz results">
                          <Zap size={10} /> Auto
                        </span>
                      )}
                      {!t.completed && PRIORITY[t.priority].cls && (
                        <span className={`tag ${PRIORITY[t.priority].cls}`}>{PRIORITY[t.priority].label}</span>
                      )}

                      <button className="icon-btn" style={{ width: 28, height: 28, border: "none" }}
                        onClick={() => removeTask(t._id)} aria-label="Remove task">
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </Card>
        </div>

        {/* ---------------------------------------------------- aside */}
        <div className="stack">
          <div style={{
            background: "linear-gradient(155deg, var(--navy) 0%, var(--navy-2) 100%)",
            color: "#fff", borderRadius: "var(--r)", padding: 18,
          }}>
            <p style={{ margin: "0 0 3px", fontSize: 12, color: "#8fb0ff" }}>
              Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </p>
            <b style={{ display: "block", fontSize: 15, marginBottom: 10 }}>
              {focus ? focus.title : "Nothing scheduled"}
            </b>
            <p style={{ margin: "0 0 15px", fontSize: 12.5, color: "#b9c4e4", lineHeight: 1.6 }}>
              {focus?.note || "Build a plan and your weakest topic lands here first."}
            </p>
            {focus && (
              <div className="row" style={{ gap: 14, marginBottom: 15, fontSize: 12, color: "#9fb0da" }}>
                <span className="row" style={{ gap: 5 }}><Clock size={12} /> {focus.durationMinutes} min</span>
                <span className="row" style={{ gap: 5 }}><CalendarDays size={12} /> {focus.subject}</span>
              </div>
            )}
            <Link to="/tutor" className="btn" style={{ background: "#fff", color: "var(--navy)", width: "100%" }}>
              Start with the tutor <ArrowRight size={14} />
            </Link>
          </div>

          <Card>
            <h3 className="sec-title">Rebuild the plan</h3>
            <p className="sec-sub">
              EduMind reads your quiz history and reschedules the week so weak topics come first.
            </p>
            <button className="btn full" onClick={generate} disabled={busy}>
              {busy ? <><span className="spinner" /> Rebuilding…</> : <><Sparkles size={15} /> Rebuild my week</>}
            </button>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 11, marginBottom: 0 }}>
              Completed tasks and anything you added yourself are kept.
            </p>
          </Card>

          {weakTopics.length > 0 && (
            <Card>
              <h3 className="sec-title">Driving the schedule</h3>
              <p className="sec-sub">Your lowest averages</p>
              {weakTopics.map((w) => (
                <div key={w.topic} className="row" style={{ justifyContent: "space-between", padding: "7px 0" }}>
                  <span style={{ fontSize: 13 }}>{w.topic}</span>
                  <span className="tag amber">{w.avg}%</span>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <h3 className="sec-title">This week</h3>
            <div className="row" style={{ justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
              <span className="muted">Completed</span><b>{done.length} of {tasks.length}</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
              <span className="muted">Time planned</span>
              <b>{Math.round(pending.reduce((a, t) => a + t.durationMinutes, 0) / 6) / 10} hrs</b>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
