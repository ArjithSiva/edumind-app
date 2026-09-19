import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, Plus, Trash2, MessageSquare } from "lucide-react";
import { api, errMsg } from "../api";
import { useAuth } from "../context/AuthContext";
import { Page, Card, Banner, Markdown, Typing, Empty, timeAgo, ResourceList } from "../components/ui";

const STARTERS = [
  "Explain recursion with a simple example",
  "Difference between a stack and a queue",
  "Why do we need Big-O notation?",
  "When should I use a LEFT JOIN instead of INNER JOIN?",
];

export default function Tutor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("ai");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  const scroller = useRef(null);
  const inputRef = useRef(null);

  const loadSessions = () =>
    api.get("/api/tutor/sessions").then(({ data }) => setSessions(data.sessions)).catch(() => {});

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    // Session default — set once when subjects are known, never overwritten
    // after that so a per-message change (below) sticks until the student
    // changes it again.
    if (user?.subjects?.length) setFilterSubject((s) => s || user.subjects[0]);
  }, [user]);

  useEffect(() => {
    // Keep the newest message in view as answers arrive.
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function openSession(id) {
    setError("");
    try {
      const { data } = await api.get(`/api/tutor/sessions/${id}`);
      setMessages(data.messages.map((m) => ({ role: m.role, content: m.content, resources: m.resources })));
      setSessionId(id);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setError("");
    inputRef.current?.focus();
  }

  async function deleteSession(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/api/tutor/sessions/${id}`);
      if (id === sessionId) newChat();
      loadSessions();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function ask(question) {
    const q = question.trim();
    if (!q || busy) return;

    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);

    try {
      const { data } = await api.post("/api/tutor/ask", {
        question: q, sessionId, subject: filterSubject || undefined, topic: filterTopic.trim() || undefined,
      });
      setSessionId(data.sessionId);
      setSource(data.source);
      setMessages((m) => [...m, { role: "assistant", content: data.answer, resources: data.resources }]);
      loadSessions();
    } catch (err) {
      setError(errMsg(err, "The tutor didn't answer. Try again."));
      setMessages((m) => m.slice(0, -1));
      setInput(q); // give the question back rather than losing it
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Page>
      <div className="grid split-narrow">
        {/* ------------------------------------------------- history */}
        <Card>
          <button className="btn full" onClick={newChat} style={{ marginBottom: 14 }}>
            <Plus size={15} /> New chat
          </button>

          <p className="sec-sub" style={{ marginBottom: 10 }}>Past conversations</p>

          {sessions.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Nothing yet. Ask your first question and it'll be saved here.
            </p>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => openSession(s.sessionId)}
                  className="row"
                  style={{
                    padding: "9px 10px", borderRadius: 9, textAlign: "left", width: "100%",
                    background: s.sessionId === sessionId ? "var(--brand-soft)" : "transparent",
                    color: s.sessionId === sessionId ? "var(--brand)" : "var(--text)",
                  }}
                >
                  <MessageSquare size={14} style={{ flex: "none", opacity: 0.7 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "block", fontSize: 12.5, fontWeight: 500,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{s.title}</span>
                    <small className="muted" style={{ fontSize: 11 }}>{timeAgo(s.updatedAt)}</small>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => deleteSession(s.sessionId, e)}
                    onKeyDown={(e) => e.key === "Enter" && deleteSession(s.sessionId, e)}
                    style={{ color: "var(--muted)", display: "grid", placeItems: "center", padding: 2 }}
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------- chat */}
        <Card style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 136px)", minHeight: 460 }}>
          {error && <Banner kind="error">{error}</Banner>}
          {source === "fallback" && messages.length > 0 && (
            <Banner kind="warn">
              That answer came from EduMind's offline bank — the AI provider didn't respond.
              Set an API key on the server for answers written to your exact question.
            </Banner>
          )}

          <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "2px 2px 12px" }}>
            {messages.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                <Empty icon={Lightbulb} title="What would you like to understand?">
                  Ask in your own words. Explanations are tuned to your year, your subjects
                  and the topics you've been scoring badly on.
                </Empty>
                <div className="row wrap" style={{ gap: 8, justifyContent: "center", maxWidth: 560, marginTop: -18 }}>
                  {STARTERS.map((s) => (
                    <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="row"
                      style={{
                        alignItems: "flex-start", gap: 10, maxWidth: 820,
                        flexDirection: m.role === "user" ? "row-reverse" : "row",
                        marginLeft: m.role === "user" ? "auto" : 0,
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 9, flex: "none",
                        display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 700,
                        background: m.role === "user" ? "var(--brand)" : "var(--navy)",
                        color: "#fff",
                      }}>
                        {m.role === "user" ? (user?.name?.[0] || "S").toUpperCase() : "AI"}
                      </span>

                      <div style={{
                        padding: "12px 14px", borderRadius: 12,
                        background: m.role === "user" ? "var(--brand)" : "var(--surface-2)",
                        color: m.role === "user" ? "#fff" : "var(--text)",
                        border: m.role === "user" ? "none" : "1px solid var(--line)",
                        borderTopRightRadius: m.role === "user" ? 4 : 12,
                        borderTopLeftRadius: m.role === "user" ? 12 : 4,
                        minWidth: 0,
                      }}>
                        {m.role === "user"
                          ? <span style={{ fontSize: 13.5 }}>{m.content}</span>
                          : <>
                              <Markdown>{m.content}</Markdown>
                              <ResourceList resources={m.resources} />
                            </>}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {busy && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="row" style={{ gap: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 9, background: "var(--navy)", color: "#fff",
                      display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 700, flex: "none",
                    }}>AI</span>
                    <div style={{
                      padding: "14px", borderRadius: 12, borderTopLeftRadius: 4,
                      background: "var(--surface-2)", border: "1px solid var(--line)",
                    }}>
                      <Typing />
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="row" style={{ gap: 8, paddingTop: 10, marginTop: 4 }}>
            <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
              className="input" style={{ maxWidth: 150, fontSize: 12.5 }} aria-label="Scope to subject">
              <option value="">Any subject</option>
              {(user?.subjects || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}
              className="input" placeholder="Topic (optional) — e.g. Recursion"
              style={{ flex: 1, minWidth: 0, fontSize: 12.5 }} aria-label="Scope to topic" />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="row"
            style={{ gap: 9, paddingTop: 10, borderTop: "1px solid var(--line)" }}
          >
            <input
              ref={inputRef}
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              aria-label="Your question"
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || !input.trim()} aria-label="Send">
              {busy ? <span className="spinner" /> : <Send size={16} />}
            </button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
