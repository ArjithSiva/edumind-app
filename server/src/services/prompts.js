/**
 * Every prompt the app sends lives here, so tone stays consistent and you
 * can tune the product's voice in one file.
 *
 * `learner` is the req.user document — prompts are personalised with the
 * student's year, subjects and learning style, which is what makes this
 * "personalized learning" rather than a chat wrapper.
 */

export function learnerContext(user, extra = {}) {
  const bits = [
    `Year ${user.year} ${user.department} student at ${user.institution}`,
    `subjects: ${user.subjects.join(", ")}`,
    `prefers ${user.learningStyle} explanations`,
  ];
  if (extra.weakTopics?.length) bits.push(`currently weak at: ${extra.weakTopics.join(", ")}`);
  if (extra.focusSubject) bits.push(`has explicitly scoped this question to subject "${extra.focusSubject}"${extra.focusTopic ? `, topic "${extra.focusTopic}"` : ""} — answer strictly within that scope`);
  return bits.join("; ");
}

/** Cheap keyword match against a question/title — same technique used by
 *  fallbackTutorAnswer below, reused so both the AI path and the offline
 *  path can attach the same safe, curated resources for the same topic
 *  instead of the AI guessing at (and possibly inventing) a link inline.
 *  Returns null when nothing matches, so irrelevant messages get no
 *  resources block rather than a generic one bolted on regardless. */
export function detectTopicKeyword(text) {
  const s = String(text || "").toLowerCase();
  if (/recurs|factorial|fibonacci|base case/.test(s)) return "recursion";
  if (/dynamic programming|\bdp\b|memoiz/.test(s)) return "dynamic programming";
  if (/\bgraph\b|\bbfs\b|\bdfs\b|dijkstra/.test(s)) return "graph";
  if (/\btree\b|binary tree|\bbst\b/.test(s)) return "tree";
  if (/stack|queue|deque/.test(s)) return "stack";
  if (/big-?o|complexity\b|asymptotic/.test(s)) return "big-o";
  if (/\bjoin\b|\bsql\b|dbms|inner join|left join|normalization/.test(s)) return "sql";
  if (/react|javascript|\bjs\b|\bhtml\b|\bcss\b|frontend|front-end|node\.?js/.test(s)) return "web development";
  if (/\bpython\b|django|flask|numpy|pandas/.test(s)) return "python";
  if (/operating system|\bos\b\W|process|thread|deadlock|scheduling algorithm|semaphore/.test(s)) return "operating systems";
  if (/network|\btcp\b|\budp\b|\bhttp\b|osi model|routing|subnet/.test(s)) return "networks";
  if (/machine learning|neural|regression|classification|\bml\b/.test(s)) return "machine learning";
  if (/aptitude|profit and loss|time and work|percentage problem/.test(s)) return "aptitude";
  if (/loop|for |while|iterat|range\(/.test(s)) return "loop";
  return null;
}

export const tutorSystem = (user, extra) => `
You are the AI Tutor inside EduMind AI, a personalized learning platform.
The learner is a ${learnerContext(user, extra)}.

Explain the concept in this order:
1. A one-line plain-English definition.
2. How it actually works, step by step.
3. One short runnable code example in a fenced block (use Python unless the question implies another language).
4. One sentence on the mistake students most often make with this.

Rules: keep it under 250 words, use markdown (**bold**, - bullets, fenced code
blocks), never use headings, and never apologise for being an AI. If the learner
is weak at a topic you touch, connect the explanation back to it. Do not add
your own links or resource list — the app attaches verified resources
separately based on the topic.
`.trim();

const RESOURCE_RULES = `Only set "url" when it is a stable, canonical link you are completely certain is correct (an official docs homepage, a LeetCode tag page such as https://leetcode.com/tag/recursion/, MDN, W3Schools) — otherwise set "url" to null and rely on "searchQuery" instead. Never invent a specific course, certificate, or article URL. "kind" must be one of: docs, tutorial, course, practice, video, article.`;

export const quizPrompt = (topic, difficulty, count, user) => `
Write ${count} multiple-choice questions on "${topic}" at ${difficulty} difficulty
for a ${learnerContext(user)}.

Return ONLY a JSON object of this exact shape, with no preamble and no markdown fences:
{"questions":[{"q":"question text","options":["a","b","c","d"],"answerIndex":0,"explanation":"one sentence on why that option is correct"}]}

Requirements:
- Exactly 4 options per question.
- answerIndex is the 0-based index of the correct option.
- Wrong options must be plausible misconceptions, not obviously silly.
- Where the topic is code, include a small snippet inside the question text.
`.trim();

export const gradingPrompt = (assignment, submissionText) => `
Grade a student's submission against this assignment's brief and marking scheme.

--- Assignment ---
${assignment.content}

--- Student's submission ---
${submissionText}
--- end submission ---

Return ONLY this JSON, no fences or preamble:
{"score":78,"feedback":"two to three sentences of overall, specific feedback","strengths":["...","..."],"improvements":["...","..."]}

score is 0-100, weighted the way the marking scheme above weights it. Be
honest and specific — cite what the submission actually did or missed, don't
inflate the score to be encouraging, and don't give a perfect score unless
the submission genuinely earns it.
`.trim();

export const suggestTopicPrompt = (user, weakTopics, kind) => `
Suggest ONE specific, well-scoped ${kind} topic for a ${learnerContext(user, { weakTopics })}.

${weakTopics.length
    ? `They are weakest on: ${weakTopics.join(", ")}. Prefer one of these, phrased more specifically than the raw topic name — e.g. "SQL joins" becomes "SQL: writing correct multi-table JOIN queries".`
    : `No weak-topic data yet — pick something foundational and useful from their subjects: ${user.subjects.join(", ")}.`}

Return ONLY this JSON, no fences or preamble:
{"topic":"...","subject":"...","reason":"one short sentence on why this topic, tied to their data"}
`.trim();

export const plannerPrompt = (user, weakTopics, days) => `
Build a ${days}-day study plan for a ${learnerContext(user, { weakTopics })}.
They can study about ${user.dailyTargetMinutes} minutes a day.

Weak topics, hardest first: ${weakTopics.length ? weakTopics.join(", ") : "none recorded yet"}.

Put the weakest topics earliest and give them more time. Mix in one revision
block and one mixed-practice block.

Return ONLY this JSON, no fences or preamble:
{"tasks":[{"title":"...","subject":"...","topic":"...","dayOffset":0,"durationMinutes":45,"priority":1,"note":"one line on why this is scheduled here","resources":[{"name":"...","provider":"...","kind":"tutorial","url":null,"searchQuery":"..."}]}]}

dayOffset 0 means today. priority 1 is highest, 3 lowest. Only fill "resources"
(1-2 items) for tasks built around a weak topic — leave it as an empty array
for routine practice/revision blocks, so recommendations stay tied to what the
student actually struggles with. ${RESOURCE_RULES}
`.trim();

export const careerPrompt = (user, interests, strengths, perf) => `
Give career guidance to a ${learnerContext(user)}.
Stated interests: ${interests.join(", ") || "not specified"}.
Self-declared strengths: ${strengths.join(", ") || "not specified"}.
Measured quiz performance by subject: ${perf.map((p) => `${p.subject} ${p.average}%`).join(", ") || "no attempts yet"}.

Suggest 4 realistic roles for an Indian engineering graduate, grounded in the
performance data above rather than generic advice.

Return ONLY this JSON, no fences or preamble:
{"recommendations":[{"role":"...","match":85,"why":"two sentences tied to their actual data","skillsToLearn":["...","...","..."],"firstSteps":["...","...","..."],"resources":[{"name":"...","provider":"...","kind":"course","url":null,"searchQuery":"..."}],"certifications":[{"name":"...","provider":"Coursera|Microsoft|Meta|Google|AWS|IBM"}]}]}

match is 0-100. firstSteps must be things they can start this month. Fill
"resources" (2-3 items per role) with a mix of courses/certifications,
technologies to learn, practice-problem sets, or project ideas relevant to
that specific role. Fill "certifications" (1-2 items per role) with real,
well-known industry certifications from major platforms — Coursera, Microsoft,
Meta, Google, AWS, or IBM — naming the certification and which of those
providers it's from; never include a "url" for these, the app links to the
provider's real site itself. ${RESOURCE_RULES}
`.trim();

export const assignmentPrompt = (brief, type, subject, difficulty, user) => `
Create a ${difficulty} ${type} assignment on "${brief}" for the subject ${subject},
aimed at a ${learnerContext(user)}.

Write it in markdown with these sections:
- A one-paragraph scenario or brief
- Learning objectives (3-4 bullets)
- Tasks, numbered, increasing in difficulty
- Deliverables
- A marking scheme table with marks adding to 100
- Two hints that guide without giving answers

Return the markdown only. No preamble, no outer code fence.
`.trim();

export const doubtAnswerPrompt = (title, body, subject, user) => `
A student posted this doubt in the EduMind community forum.

Subject: ${subject}
Title: ${title}
Question: ${body}

Answer it directly and practically for a ${learnerContext(user)}. Under 200 words,
markdown, include a code example if it helps. If the question is ambiguous, answer
the most likely reading and say in one line what you assumed.
`.trim();

/* ------------------------------------------------------------- fallbacks */
/** Used whenever the AI provider is unreachable, so the demo never breaks. */

export const TUTOR_FALLBACK = {
  recursion: `**Recursion** is when a function solves a problem by calling itself on a smaller version of the same problem.

Every recursive function needs two parts:
- a **base case** — the smallest input, where it stops calling itself
- a **recursive case** — where it calls itself on something smaller

\`\`\`python
def factorial(n):
    if n <= 1:                    # base case — stop here
        return 1
    return n * factorial(n - 1)   # recursive case

print(factorial(5))               # 120
\`\`\`

Each call waits on the call stack until the base case returns, then the answers multiply back up.

The mistake students make most: forgetting the base case, or writing one the input never reaches — which gives you infinite recursion and a \`RecursionError\`.`,

  loop: `A **for loop** repeats a block of code once for every item in a sequence.

\`\`\`python
for fruit in ["apple", "banana", "cherry"]:
    print(fruit)

for i in range(3):        # 0, 1, 2
    print(i)
\`\`\`

\`range(n)\` gives numbers from 0 up to but **not including** n — that off-by-one is the single most common mistake with loops.`,

  stack: `A **stack** is last-in-first-out; a **queue** is first-in-first-out.

- **Stack** — like plates piled up. Add and remove from the same end. Used for undo, browser back, and the function call stack.
- **Queue** — like a line at a counter. Add at the back, remove from the front. Used for task scheduling and BFS.

\`\`\`python
stack = []
stack.append(1); stack.append(2)
print(stack.pop())        # 2 — last in, first out

from collections import deque
queue = deque([1, 2])
print(queue.popleft())    # 1 — first in, first out
\`\`\`

Avoid \`list.pop(0)\` as a queue — it's O(n) because every element shifts. Use \`deque\`.`,

  bigo: `**Big-O notation** describes how an algorithm's work grows as the input grows — not how many seconds it takes.

- **O(1)** — same work regardless of size (dict lookup)
- **O(log n)** — halving each step (binary search)
- **O(n)** — one pass over the input
- **O(n²)** — nested loops over the same list

\`\`\`python
def has_duplicate(nums):      # O(n) — one pass
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False
\`\`\`

The mistake students make: quoting the best case. Big-O describes the **worst case** unless you say otherwise.`,

  join: `A **SQL join** combines rows from two tables using a matching column.

- **INNER JOIN** — only rows that match in both tables
- **LEFT JOIN** — every row from the left table, plus matches from the right (\`NULL\` where there's no match)

\`\`\`sql
SELECT s.name, m.marks
FROM students s
LEFT JOIN marks m ON s.id = m.student_id;
\`\`\`

With \`LEFT JOIN\` a student who has no marks row still appears, with \`NULL\` marks. With \`INNER JOIN\` they vanish from the result — which is exactly the bug students hit when a count comes out lower than expected.`,

  _default: `Here's the short version.

Break the idea into three questions: **what is it**, **how does it work step by step**, and **when would I actually use it**. Answering those three in order is usually enough to make a concept stick.

\`\`\`python
# Try it, don't just read it — small examples beat long notes
for i in range(3):
    print("iteration", i)
\`\`\`

This is EduMind's offline response. Add an AI provider key on the server to get a full explanation on this exact topic.`,
};

export function fallbackTutorAnswer(question) {
  const key = detectTopicKeyword(question);
  const map = { recursion: "recursion", loop: "loop", stack: "stack", "big-o": "bigo", sql: "join" };
  return TUTOR_FALLBACK[map[key]] || TUTOR_FALLBACK._default;
}
