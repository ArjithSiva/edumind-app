import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Sparkles, GraduationCap, Footprints } from "lucide-react";
import { api, errMsg } from "../api";
import { Page, Card, Banner, Empty, FallbackNote, listMotion, itemMotion, scoreColor, ResourceList } from "../components/ui";

const INTERESTS = [
  "Backend development", "Frontend development", "IoT and embedded systems",
  "Machine learning", "Data analytics", "Cybersecurity", "Cloud and DevOps",
  "Mobile apps", "Product management", "Research and higher studies",
];

const STRENGTHS = [
  "Python", "Problem solving", "Building end-to-end projects", "Debugging",
  "Maths and logic", "Writing and documentation", "Design sense", "Teamwork",
  "Public speaking", "Fast learning",
];

export default function Career() {
  const [interests, setInterests] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [plan, setPlan] = useState(null);
  const [perf, setPerf] = useState([]);
  const [source, setSource] = useState("ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/career")
      .then(({ data }) => {
        if (!data.plan) return;
        setInterests(data.plan.interests || []);
        setStrengths(data.plan.strengths || []);
        if (data.plan.recommendations?.length) setPlan(data.plan);
      })
      .catch(() => {});
  }, []);

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/career/generate", { interests, strengths });
      setPlan(data.plan);
      setPerf(data.performance);
      setSource(data.source);
    } catch (err) {
      setError(errMsg(err, "Couldn't generate guidance."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      {error && <Banner kind="error">{error}</Banner>}
      <FallbackNote source={source} />

      <div className="grid split-narrow">
        <div className="stack">
          <Card>
            <h3 className="sec-title">Tell us about you</h3>
            <p className="sec-sub">
              Your quiz results are already factored in — these two lists are the part
              EduMind can't measure.
            </p>

            <div className="field">
              <label>What interests you?</label>
              <div className="row wrap" style={{ gap: 7 }}>
                {INTERESTS.map((i) => (
                  <button key={i} className={`chip ${interests.includes(i) ? "on" : ""}`}
                    onClick={() => toggle(interests, setInterests, i)}>{i}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>What are you good at?</label>
              <div className="row wrap" style={{ gap: 7 }}>
                {STRENGTHS.map((s) => (
                  <button key={s} className={`chip ${strengths.includes(s) ? "on" : ""}`}
                    onClick={() => toggle(strengths, setStrengths, s)}>{s}</button>
                ))}
              </div>
            </div>

            <button className="btn full" onClick={generate} disabled={busy}>
              {busy ? <><span className="spinner" /> Thinking it through…</> : <><Sparkles size={15} /> Get guidance</>}
            </button>
          </Card>

          {perf.length > 0 && (
            <Card>
              <h3 className="sec-title">Data behind the advice</h3>
              <p className="sec-sub">Your measured averages</p>
              {perf.map((p) => (
                <div key={p.subject} className="row" style={{ justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
                  <span>{p.subject}</span>
                  <b style={{ color: scoreColor(p.average) }}>{p.average}%</b>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          {!plan ? (
            <Card>
              <Empty icon={Compass} title="No guidance generated yet">
                Pick a few interests and strengths, then generate. Recommendations are
                grounded in your actual quiz averages, not generic advice — so they'll
                change as your scores do.
              </Empty>
            </Card>
          ) : (
            <motion.div className="stack" variants={listMotion} initial="initial" animate="animate">
              {plan.recommendations.map((r) => (
                <motion.div key={r.role} variants={itemMotion}>
                  <Card className="raised">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 16.5, marginBottom: 4 }}>{r.role}</h3>
                        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: "62ch" }}>
                          {r.why}
                        </p>
                      </div>
                      <MatchBadge value={r.match} />
                    </div>

                    <div className="grid g2" style={{ marginTop: 16, gap: 14 }}>
                      <div>
                        <div className="row" style={{ gap: 6, marginBottom: 8, color: "var(--brand)" }}>
                          <GraduationCap size={14} />
                          <b style={{ fontSize: 12.5 }}>Skills to build</b>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, lineHeight: 1.75, color: "var(--text-2)" }}>
                          {r.skillsToLearn.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className="row" style={{ gap: 6, marginBottom: 8, color: "var(--green)" }}>
                          <Footprints size={14} />
                          <b style={{ fontSize: 12.5 }}>Start this month</b>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, lineHeight: 1.75, color: "var(--text-2)" }}>
                          {r.firstSteps.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                    </div>
                    <ResourceList resources={r.resources} label="Recommended resources" />
                    <ResourceList resources={r.certifications} label="Certifications to consider" />
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </Page>
  );
}

function MatchBadge({ value }) {
  return (
    <div style={{ textAlign: "center", flex: "none" }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{
          fontSize: 22, fontWeight: 700, fontFamily: "var(--display)",
          letterSpacing: "-0.02em", color: scoreColor(value), lineHeight: 1,
        }}
      >
        {value}%
      </motion.div>
      <small className="muted" style={{ fontSize: 10.5 }}>match</small>
    </div>
  );
}
