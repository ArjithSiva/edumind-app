import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessagesSquare, Plus, Sparkles, ThumbsUp, Eye, CheckCircle2, Search, ArrowLeft,
} from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { Page, Card, Banner, Empty, Markdown, Skeleton, timeAgo, ResourceList } from "../components/ui";

const FILTERS = ["All", "Open", "Resolved", "Mine"];

export default function Doubts() {
  const { user } = useAuth();
  const [doubts, setDoubts] = useState(null);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", subject: "General" });
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subjects = ["General", ...(user?.subjects || [])];

  function params() {
    const p = {};
    if (filter === "Open") p.resolved = "false";
    if (filter === "Resolved") p.resolved = "true";
    if (filter === "Mine") p.mine = "true";
    if (query.trim()) p.q = query.trim();
    return p;
  }

  const load = () =>
    api.get("/api/doubts", { params: params() })
      .then(({ data }) => setDoubts(data.doubts))
      .catch((err) => setError(errMsg(err)));

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0); // debounce the search box
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query]);

  async function post(e) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/doubts", { ...draft, askAI: true });
      setActive(data.doubt);
      setDraft({ title: "", body: "", subject: "General" });
      setComposing(false);
      load();
    } catch (err) {
      setError(errMsg(err, "Couldn't post your doubt."));
    } finally {
      setBusy(false);
    }
  }

  async function reply(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    try {
      const { data } = await api.post(`/api/doubts/${active._id}/answers`, { body: answer });
      setActive(data.doubt);
      setAnswer("");
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function upvote(answerId) {
    try {
      const { data } = await api.post(`/api/doubts/${active._id}/answers/${answerId}/upvote`);
      setActive(data.doubt);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function toggleResolved() {
    try {
      const { data } = await api.patch(`/api/doubts/${active._id}`, { resolved: !active.resolved });
      setActive(data.doubt);
      load();
    } catch (err) {
      setError(errMsg(err, "Only the person who posted can resolve a doubt."));
    }
  }

  /* -------------------------------------------------------- detail view */
  if (active) {
    const mine = active.user === user?._id || active.user?._id === user?._id;
    return (
      <Page>
        {error && <Banner kind="error">{error}</Banner>}

        <button className="btn outline sm" onClick={() => setActive(null)} style={{ marginBottom: 14 }}>
          <ArrowLeft size={14} /> Back to all doubts
        </button>

        <Card className="raised" style={{ marginBottom: 16 }}>
          <div className="row wrap" style={{ gap: 7, marginBottom: 10 }}>
            <span className="tag blue">{active.subject}</span>
            {active.resolved && <span className="tag green"><CheckCircle2 size={11} /> Resolved</span>}
            <span className="tag"><Eye size={11} /> {active.views}</span>
            {active.tags?.map((t) => <span key={t} className="tag">#{t}</span>)}
          </div>

          <h2 style={{ fontSize: 19, marginBottom: 8 }}>{active.title}</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-2)", margin: "0 0 14px" }}>
            {active.body}
          </p>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
            <span className="muted">Asked by {active.authorName} · {timeAgo(active.createdAt)}</span>
            {mine && (
              <button className="btn ghost sm" onClick={toggleResolved}>
                {active.resolved ? "Reopen" : "Mark resolved"}
              </button>
            )}
          </div>
        </Card>

        <h3 className="sec-title" style={{ marginBottom: 12 }}>
          {active.answers.length} answer{active.answers.length === 1 ? "" : "s"}
        </h3>

        <div className="stack" style={{ marginBottom: 16 }}>
          {active.answers
            .slice()
            .sort((a, b) => b.upvotes - a.upvotes)
            .map((a) => (
              <motion.div key={a._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card style={a.isAI ? { borderColor: "var(--brand-border)" } : undefined}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 11 }}>
                    <div className="row" style={{ gap: 9 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 9, flex: "none",
                        display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 700, color: "#fff",
                        background: a.isAI ? "linear-gradient(135deg, var(--brand), #7a46e0)" : "var(--navy)",
                      }}>
                        {a.isAI ? <Sparkles size={13} /> : a.authorName?.[0]?.toUpperCase() || "?"}
                      </span>
                      <span>
                        <b style={{ display: "block", fontSize: 13 }}>{a.authorName}</b>
                        <small className="muted" style={{ fontSize: 11 }}>
                          {a.isAI ? "Answered instantly" : timeAgo(a.createdAt)}
                        </small>
                      </span>
                    </div>
                    <button className="btn outline sm" onClick={() => upvote(a._id)}>
                      <ThumbsUp size={13} /> {a.upvotes}
                    </button>
                  </div>
                  <Markdown>{a.body}</Markdown>
                  <ResourceList resources={a.resources} />
                </Card>
              </motion.div>
            ))}
        </div>

        <Card>
          <h3 className="sec-title">Add your answer</h3>
          <p className="sec-sub">Helping someone else is the fastest way to find out if you actually understand it</p>
          <form onSubmit={reply}>
            <label className="field">
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4}
                placeholder="Explain it the way you'd want it explained to you…" aria-label="Your answer" />
            </label>
            <button className="btn" type="submit" disabled={!answer.trim()}>Post answer</button>
          </form>
        </Card>
      </Page>
    );
  }

  /* ---------------------------------------------------------- list view */
  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}

      <div className="row wrap" style={{ justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div className="row wrap" style={{ gap: 7 }}>
          {FILTERS.map((f) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 9 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)",
            }} />
            <input className="input" style={{ paddingLeft: 32, width: 210 }} value={query}
              onChange={(e) => setQuery(e.target.value)} placeholder="Search doubts" aria-label="Search doubts" />
          </div>
          <button className="btn" onClick={() => setComposing((c) => !c)}>
            <Plus size={15} /> Ask
          </button>
        </div>
      </div>

      <AnimatePresence>
        {composing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 16 }}>
            <Card className="raised">
              <h3 className="sec-title">Ask the community</h3>
              <p className="sec-sub">You'll get an AI answer straight away — classmates can add better ones underneath</p>
              <form onSubmit={post}>
                <label className="field">
                  <label htmlFor="dtitle">What's the question?</label>
                  <input id="dtitle" value={draft.title} autoFocus
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Why does my recursive function hit RecursionError?" />
                </label>
                <label className="field">
                  <label htmlFor="dbody">Give some detail</label>
                  <textarea id="dbody" rows={4} value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    placeholder="What you tried, what happened, what you expected…" />
                </label>
                <label className="field">
                  <label htmlFor="dsub">Subject</label>
                  <select id="dsub" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                    {subjects.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <div className="row" style={{ gap: 9 }}>
                  <button className="btn" type="submit" disabled={busy || !draft.title.trim() || !draft.body.trim()}>
                    {busy ? <><span className="spinner" /> Posting…</> : "Post doubt"}
                  </button>
                  <button className="btn outline" type="button" onClick={() => setComposing(false)}>Cancel</button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!doubts ? (
        <div className="stack">{[0, 1, 2].map((i) => <Card key={i}><Skeleton h={72} /></Card>)}</div>
      ) : doubts.length === 0 ? (
        <Card>
          <Empty icon={MessagesSquare} title="No doubts here yet"
            action={<button className="btn" onClick={() => setComposing(true)}>Ask the first question</button>}>
            {filter === "Mine"
              ? "You haven't posted anything yet."
              : "Post a question and EduMind answers it immediately, then classmates can weigh in."}
          </Empty>
        </Card>
      ) : (
        <div className="stack">
          {doubts.map((d) => (
            <motion.div key={d._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
              <Card onClick={() => setActive(d)} style={{ cursor: "pointer" }}>
                <div className="row wrap" style={{ gap: 7, marginBottom: 8 }}>
                  <span className="tag blue">{d.subject}</span>
                  {d.resolved && <span className="tag green"><CheckCircle2 size={11} /> Resolved</span>}
                  {d.answers.some((a) => a.isAI) && <span className="tag violet"><Sparkles size={10} /> AI answered</span>}
                </div>
                <h3 style={{ fontSize: 15, marginBottom: 6 }}>{d.title}</h3>
                <p className="muted" style={{
                  margin: "0 0 11px", fontSize: 13, lineHeight: 1.6,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>{d.body}</p>
                <div className="row" style={{ gap: 15, fontSize: 11.5, color: "var(--muted)" }}>
                  <span>{d.authorName}</span>
                  <span>{timeAgo(d.createdAt)}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <MessagesSquare size={12} /> {d.answers.length}
                  </span>
                  <span className="row" style={{ gap: 4 }}><Eye size={12} /> {d.views}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </Page>
  );
}
