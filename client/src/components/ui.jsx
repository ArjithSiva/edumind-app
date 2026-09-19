import { motion } from "framer-motion";
import { AlertTriangle, Info, CheckCircle2, XCircle, ExternalLink, Search, BookOpen, Code2, GraduationCap, PlayCircle, FileText } from "lucide-react";

/* ------------------------------------------------------------ motion */
/** Standard entrance for a page. One orchestrated reveal, not per-card noise. */
export const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

/** Stagger children inside a grid. */
export const listMotion = {
  animate: { transition: { staggerChildren: 0.045 } },
};
export const itemMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export function Page({ children }) {
  return (
    <motion.div className="view" {...pageMotion}>
      {children}
    </motion.div>
  );
}

export function Card({ children, className = "", pad = true, ...rest }) {
  return (
    <div className={`card ${pad ? "pad" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Section({ title, sub, action, children }) {
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 className="sec-title">{title}</h3>
          {sub && <p className="sec-sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </>
  );
}

/* ----------------------------------------------------------- banners */
const BANNER_ICON = { info: Info, warn: AlertTriangle, error: XCircle, success: CheckCircle2 };

export function Banner({ kind = "info", children }) {
  const Icon = BANNER_ICON[kind] || Info;
  return (
    <motion.div className={`banner ${kind}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
      <Icon size={15} />
      <span>{children}</span>
    </motion.div>
  );
}

/** Shown when the server served fallback content instead of a live AI answer. */
export function FallbackNote({ source }) {
  if (!source || source === "ai") return null;
  return (
    <Banner kind="warn">
      Served from EduMind's offline bank — the AI provider didn't respond. Check that your
      API key is set on the server, or just carry on: everything below still works.
    </Banner>
  );
}

const RESOURCE_ICON = { docs: BookOpen, tutorial: FileText, course: GraduationCap, practice: Code2, video: PlayCircle, article: FileText };

/** A resource always links somewhere: to its real url when the server could
 *  verify one against a trusted-domain allowlist, otherwise to a search for
 *  it — so nothing here ever claims a page exists that might not. */
export function ResourceList({ resources, label = "Go deeper" }) {
  if (!resources?.length) return null;
  return (
    <div className="resource-list">
      <small className="muted" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </small>
      <div className="stack" style={{ gap: 6, marginTop: 7 }}>
        {resources.map((r, i) => {
          const Icon = RESOURCE_ICON[r.kind] || FileText;
          const href = r.url || `https://www.google.com/search?q=${encodeURIComponent(r.searchQuery || `${r.name} ${r.provider || ""}`)}`;
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="resource-item">
              <Icon size={13} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {r.name}
                {r.provider && <span className="muted"> · {r.provider}</span>}
              </span>
              {r.url ? <ExternalLink size={11} className="muted" /> : <Search size={11} className="muted" />}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="ring">
          <Icon size={23} />
        </div>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <span className="row" style={{ gap: 8, color: "var(--muted)", fontSize: 13 }}>
      <span className="spinner" />
      {label}
    </span>
  );
}

export function Typing() {
  return (
    <span className="typing">
      <i />
      <i />
      <i />
    </span>
  );
}

export function Skeleton({ h = 16, w = "100%", style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

/* ------------------------------------------------------- markdown ---
   A small renderer covering what the models actually emit: fenced code,
   headings, bullets, numbered lists, tables, bold, inline code and quotes.
   Everything is escaped before any tag is inserted, so model output can
   never inject HTML.
--------------------------------------------------------------------- */

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

export function markdownToHtml(md) {
  if (!md) return "";
  const blocks = [];

  // Pull fenced code out first so nothing inside it gets parsed.
  let text = String(md).replace(/```[\w+-]*\n?([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  const out = [];
  const lines = text.split("\n");
  let list = null;
  let inTable = false;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const ph = line.match(/^\u0000(\d+)\u0000$/);
    if (ph) {
      closeList();
      closeTable();
      out.push(blocks[+ph[1]]);
      continue;
    }

    if (!line) {
      closeList();
      closeTable();
      continue;
    }

    // Table: a row of pipes followed by a separator row.
    if (line.startsWith("|") && /^\|[\s:|-]+\|$/.test((lines[i + 1] || "").trim())) {
      closeList();
      const cells = line.split("|").slice(1, -1).map((c) => `<th>${inline(c.trim())}</th>`);
      out.push(`<table><thead><tr>${cells.join("")}</tr></thead><tbody>`);
      inTable = true;
      i++; // skip the separator
      continue;
    }
    if (inTable && line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => `<td>${inline(c.trim())}</td>`);
      out.push(`<tr>${cells.join("")}</tr>`);
      continue;
    }
    closeTable();

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(line)) {
      closeList();
      out.push("<hr>");
      continue;
    }

    if (line.startsWith(">")) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^[-*+]\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const want = ul ? "ul" : "ol";
      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeTable();
  return out.join("");
}

export function Markdown({ children, className = "" }) {
  return (
    <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(children) }} />
  );
}

/* ------------------------------------------------------------ helpers */
export function timeAgo(date) {
  if (!date) return "";
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const TONE_STYLE = {
  green: { background: "var(--green-soft)", color: "var(--green)" },
  blue: { background: "var(--brand-soft)", color: "var(--brand)" },
  amber: { background: "var(--amber-soft)", color: "var(--amber)" },
  violet: { background: "var(--violet-soft)", color: "var(--violet)" },
  purple: { background: "var(--violet-soft)", color: "var(--violet)" },
  red: { background: "var(--red-soft)", color: "var(--red)" },
};

/** Green above 75, amber 55-75, red below. Used on every score bar. */
export function scoreColor(pct) {
  if (pct >= 75) return "var(--green)";
  if (pct >= 55) return "var(--amber)";
  return "var(--red)";
}
