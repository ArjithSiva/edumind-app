/**
 * Resource recommendations ("go learn this SQL joins tutorial", "try these
 * LeetCode problems") shown in the Tutor, Study Planner and Career Guidance.
 *
 * Two safety rules, because a model asked for "a course link" will
 * occasionally invent one that looks plausible and doesn't exist:
 *   1. `sanitizeResources` only keeps a `url` when its hostname is on
 *      TRUSTED_HOSTS below — a short list of sites stable and well-known
 *      enough that their homepage/tag-page URLs are safe to hardcode
 *      confidently. Everything else keeps the resource (name + provider)
 *      but drops the url, so the frontend renders it as a search prompt
 *      instead of a link that might 404.
 *   2. STATIC_RESOURCES is a small curated set used when there's no AI
 *      (fallback mode) or when the AI returns nothing usable, so a
 *      recommendation is still there — never a fabricated one.
 */

const TRUSTED_HOSTS = new Set([
  "leetcode.com",
  "developer.mozilla.org",
  "docs.python.org",
  "www.w3schools.com",
  "react.dev",
  "geeksforgeeks.org",
  "www.geeksforgeeks.org",
  "www.freecodecamp.org",
  "docs.oracle.com",
  "nodejs.org",
  "expressjs.com",
  "git-scm.com",
  "www.postgresql.org",
  "www.mongodb.com",
  "en.wikipedia.org",
  "www.w3.org",
  // Certification platform homepages only — see sanitizeCertifications below,
  // which strips any deeper path a model proposes and keeps just the host's
  // real top-level landing page.
  "www.coursera.org",
  "coursera.org",
  "learn.microsoft.com",
  "grow.google",
  "aws.amazon.com",
]);

const KINDS = new Set(["docs", "tutorial", "course", "practice", "video", "article"]);

function safeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return TRUSTED_HOSTS.has(u.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** Cleans a model-supplied (or hand-written) resource list into a safe,
 *  consistent shape. Never trusts `url` unless it survives safeUrl(). */
export function sanitizeResources(list, { limit = 4 } = {}) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.name)
    .slice(0, limit)
    .map((r) => ({
      name: String(r.name).slice(0, 80),
      provider: r.provider ? String(r.provider).slice(0, 60) : "",
      kind: KINDS.has(r.kind) ? r.kind : "article",
      url: safeUrl(r.url),
      searchQuery: r.searchQuery
        ? String(r.searchQuery).slice(0, 120)
        : `${r.name} ${r.provider || ""}`.trim(),
    }));
}

/** Verified, stable top-level landing pages — never a specific course or
 *  exam page, per how certifications are shown in this app: named plainly,
 *  linked to the real platform, never implying a specific page was checked.
 *  Matched by provider name substring, case-insensitive. */
const CERT_PLATFORM_HOMEPAGE = [
  { match: /meta/i, url: "https://www.coursera.org/meta" },
  { match: /microsoft/i, url: "https://learn.microsoft.com/en-us/credentials/" },
  { match: /google/i, url: "https://grow.google/certificates/" },
  { match: /aws|amazon/i, url: "https://aws.amazon.com/certification/" },
  { match: /ibm|coursera/i, url: "https://www.coursera.org/" },
];

function certHomepage(provider) {
  const hit = CERT_PLATFORM_HOMEPAGE.find((p) => p.match.test(String(provider || "")));
  return hit ? hit.url : null;
}

/** Same shape and limits as sanitizeResources, but for certifications: the
 *  url is never taken from the model — it's always replaced with the
 *  provider's real homepage (or dropped to a search link if the provider
 *  isn't one of the platforms above), so a certification can never point at
 *  a specific course page that might not exist. */
export function sanitizeCertifications(list, { limit = 3 } = {}) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.name)
    .slice(0, limit)
    .map((r) => ({
      name: String(r.name).slice(0, 90),
      provider: r.provider ? String(r.provider).slice(0, 40) : "",
      kind: "course",
      url: certHomepage(r.provider),
      searchQuery: `${r.name} ${r.provider || ""} certification`.trim(),
    }));
}

/** Curated, hand-verified — used for fallback mode and as a top-up when the
 *  AI returns fewer resources than a topic deserves. Keys are matched with
 *  loose substring matching in resourcesFor() below. */
const STATIC_RESOURCES = {
  "recursion": [
    { name: "Recursion", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/recursion/", searchQuery: "leetcode recursion problems" },
    { name: "Recursion in Python", provider: "GeeksforGeeks", kind: "tutorial", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks recursion in python" },
  ],
  "sql": [
    { name: "SQL Joins", provider: "W3Schools", kind: "docs", url: "https://www.w3schools.com/sql/sql_join.asp", searchQuery: "w3schools sql joins" },
    { name: "Database", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/database/", searchQuery: "leetcode database problems" },
  ],
  "join": [
    { name: "SQL Joins", provider: "W3Schools", kind: "docs", url: "https://www.w3schools.com/sql/sql_join.asp", searchQuery: "w3schools sql joins" },
  ],
  "dbms": [
    { name: "SQL Tutorial", provider: "W3Schools", kind: "docs", url: "https://www.w3schools.com/sql/", searchQuery: "w3schools sql tutorial" },
    { name: "Database", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/database/", searchQuery: "leetcode database problems" },
  ],
  "data structures": [
    { name: "Data Structures", provider: "GeeksforGeeks", kind: "tutorial", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks data structures" },
    { name: "Array & Hashing", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/array/", searchQuery: "leetcode array problems" },
  ],
  "stack": [
    { name: "Stack", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/stack/", searchQuery: "leetcode stack problems" },
  ],
  "queue": [
    { name: "Queue", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/queue/", searchQuery: "leetcode queue problems" },
  ],
  "tree": [
    { name: "Binary Tree", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/binary-tree/", searchQuery: "leetcode binary tree problems" },
  ],
  "graph": [
    { name: "Graph", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/graph/", searchQuery: "leetcode graph problems" },
  ],
  "dynamic programming": [
    { name: "Dynamic Programming", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/tag/dynamic-programming/", searchQuery: "leetcode dynamic programming problems" },
  ],
  "big-o": [
    { name: "Big-O Cheat Sheet", provider: "GeeksforGeeks", kind: "article", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks big o notation" },
  ],
  "python": [
    { name: "Python Docs", provider: "python.org", kind: "docs", url: "https://docs.python.org/3/", searchQuery: "python official documentation" },
    { name: "Python Practice", provider: "LeetCode", kind: "practice", url: "https://leetcode.com/", searchQuery: "leetcode python problems" },
  ],
  "web development": [
    { name: "JavaScript", provider: "MDN", kind: "docs", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", searchQuery: "MDN javascript guide" },
    { name: "React", provider: "react.dev", kind: "docs", url: "https://react.dev/", searchQuery: "react official docs" },
    { name: "Responsive Web Design", provider: "freeCodeCamp", kind: "course", url: "https://www.freecodecamp.org/", searchQuery: "freecodecamp responsive web design" },
  ],
  "operating systems": [
    { name: "Operating Systems", provider: "GeeksforGeeks", kind: "tutorial", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks operating systems notes" },
  ],
  "networks": [
    { name: "Computer Networks", provider: "GeeksforGeeks", kind: "tutorial", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks computer networks notes" },
  ],
  "machine learning": [
    { name: "Machine Learning", provider: "GeeksforGeeks", kind: "tutorial", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks machine learning basics" },
  ],
  "aptitude": [
    { name: "Quantitative Aptitude", provider: "GeeksforGeeks", kind: "practice", url: "https://www.geeksforgeeks.org/", searchQuery: "geeksforgeeks quantitative aptitude" },
  ],
};

/** Loose match: tries the topic first, then the subject, then a generic
 *  GeeksforGeeks search built from whichever name is available. Always
 *  returns at least one resource — never an empty array — so a task or
 *  answer that names a topic always has something to point at. */
export function resourcesFor(topic, subject) {
  const key = String(topic || "").toLowerCase();
  const subjKey = String(subject || "").toLowerCase();

  for (const [k, v] of Object.entries(STATIC_RESOURCES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  for (const [k, v] of Object.entries(STATIC_RESOURCES)) {
    if (subjKey.includes(k) || k.includes(subjKey)) return v;
  }
  const label = topic || subject || "this topic";
  return [{
    name: label, provider: "GeeksforGeeks", kind: "tutorial", url: null,
    searchQuery: `geeksforgeeks ${label}`.trim(),
  }];
}
