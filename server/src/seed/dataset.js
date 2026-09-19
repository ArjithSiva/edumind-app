/**
 * The predetermined dataset.
 *
 * Everything here is deterministic — re-running `npm run seed` always produces
 * exactly the same database, so your demo looks identical every time you show
 * it. Edit this file to change what judges see.
 */

export const DEMO_PASSWORD = "edumind123";

export const USERS = [
  {
    name: "Sridhar T",
    email: "sridhar@edumind.dev",
    department: "CSE (IoT)",
    year: 2,
    subjects: ["Python", "Data Structures", "Web Development", "DBMS"],
    learningStyle: "hands-on",
    dailyTargetMinutes: 60,
    streak: 4,
    studyMinutes: 1110, // 18.5 hours
    isPrimary: true,
  },
  {
    name: "Gayathri C",
    email: "gayathri@edumind.dev",
    department: "CSE (IoT)",
    year: 2,
    subjects: ["Python", "Data Structures", "DBMS", "Operating Systems"],
    learningStyle: "visual",
    dailyTargetMinutes: 45,
    streak: 7,
    studyMinutes: 840,
  },
  {
    name: "Dhanush S",
    email: "dhanush@edumind.dev",
    department: "CSE (IoT)",
    year: 2,
    subjects: ["Web Development", "Python", "Networks"],
    learningStyle: "reading",
    dailyTargetMinutes: 90,
    streak: 2,
    studyMinutes: 660,
  },
];

/* ------------------------------------------------- public question bank */
/* user: null means this quiz is shared, and is what the app falls back to
   when no AI key is configured. */

export const QUIZ_BANK = [
  {
    topic: "Python — Loops and Iteration",
    subject: "Python",
    difficulty: "Medium",
    questions: [
      {
        q: "What is the output of:\n\nprint(2 ** 3 ** 2)",
        options: ["64", "512", "12", "36"],
        answerIndex: 1,
        explanation: "** is right-associative, so it evaluates as 2 ** (3 ** 2) = 2 ** 9 = 512, not (2 ** 3) ** 2.",
      },
      {
        q: "How many times does the body of this loop run?\n\nfor i in range(1, 10, 3):\n    print(i)",
        options: ["3 times", "4 times", "9 times", "10 times"],
        answerIndex: 0,
        explanation: "range(1, 10, 3) yields 1, 4 and 7 — it stops before 10, so the body runs three times.",
      },
      {
        q: "Which loop construct runs its body at least once in Python?",
        options: ["while", "do-while", "for", "None — Python has no do-while"],
        answerIndex: 3,
        explanation: "Python has no do-while. You emulate it with `while True:` plus a `break` at the end of the body.",
      },
      {
        q: "What does the `else` clause on a Python for loop do?",
        options: [
          "Runs if the loop body never executed",
          "Runs when the loop finishes without hitting break",
          "Runs when the loop raises an exception",
          "It is a syntax error",
        ],
        answerIndex: 1,
        explanation: "A for/else runs the else block only when the loop completed normally — a `break` skips it. It's most useful in search loops.",
      },
      {
        q: "Which is the idiomatic way to loop with an index in Python?",
        options: [
          "for i in range(len(items)):",
          "for i, item in enumerate(items):",
          "i = 0; while i < len(items):",
          "for item in items.keys():",
        ],
        answerIndex: 1,
        explanation: "enumerate() gives you the index and the value together, without the off-by-one risk of manual indexing.",
      },
    ],
  },
  {
    topic: "Recursion",
    subject: "Data Structures",
    difficulty: "Medium",
    questions: [
      {
        q: "Which part of a recursive function stops it from calling itself forever?",
        options: ["The recursive case", "The return statement", "The base case", "The call stack"],
        answerIndex: 2,
        explanation: "The base case returns a value directly instead of recursing. Without one you get infinite recursion and a RecursionError.",
      },
      {
        q: "What is the time complexity of naive recursive Fibonacci?",
        options: ["O(n)", "O(n log n)", "O(2^n)", "O(n²)"],
        answerIndex: 2,
        explanation: "Each call spawns two more, so the call tree roughly doubles at every level — exponential. Memoisation brings it down to O(n).",
      },
      {
        q: "What happens when recursion goes too deep in Python?",
        options: [
          "It silently returns None",
          "RecursionError is raised",
          "The interpreter switches to iteration",
          "It runs forever with no error",
        ],
        answerIndex: 1,
        explanation: "Python caps the call stack (around 1000 frames by default) and raises RecursionError rather than crashing the process.",
      },
      {
        q: "Which problem is the most natural fit for recursion?",
        options: [
          "Summing a flat list of numbers",
          "Traversing a binary tree",
          "Reading lines from a file",
          "Incrementing a counter",
        ],
        answerIndex: 1,
        explanation: "A tree is defined recursively — each node holds subtrees of the same shape — so the code mirrors the data structure.",
      },
      {
        q: "In this function, what is wrong?\n\ndef count(n):\n    return n + count(n - 1)",
        options: [
          "It should use a while loop",
          "There is no base case",
          "The parameter should be a list",
          "Nothing — it works fine",
        ],
        answerIndex: 1,
        explanation: "Nothing stops the recursion, so it descends past zero into negative numbers until the stack is exhausted.",
      },
    ],
  },
  {
    topic: "Stacks and Queues",
    subject: "Data Structures",
    difficulty: "Easy",
    questions: [
      {
        q: "Which data structure does the function call stack use?",
        options: ["Queue (FIFO)", "Stack (LIFO)", "Linked list", "Binary heap"],
        answerIndex: 1,
        explanation: "Calls are pushed on and popped off the top — last in, first out — which is why the most recent call finishes first.",
      },
      {
        q: "What does list.pop(0) cost on a Python list of n items?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
        answerIndex: 2,
        explanation: "Removing from the front shifts every remaining element left. Use collections.deque and popleft() for O(1).",
      },
      {
        q: "Which real-world process behaves like a queue?",
        options: ["Browser back button", "Undo in a text editor", "A printer job spooler", "Balancing brackets"],
        answerIndex: 2,
        explanation: "Print jobs are served in the order they arrive — first in, first out. The other three are all LIFO, so they're stacks.",
      },
      {
        q: "A stack is used to check balanced brackets. What signals invalid input?",
        options: [
          "The stack is empty at the end",
          "A closing bracket arrives when the stack is empty",
          "The stack ever holds more than one item",
          "The first character is an opening bracket",
        ],
        answerIndex: 1,
        explanation: "A closing bracket with nothing to match against means the input is unbalanced. A non-empty stack at the end is the other failure.",
      },
    ],
  },
  {
    topic: "SQL Joins",
    subject: "DBMS",
    difficulty: "Medium",
    questions: [
      {
        q: "Which join keeps every row from the left table even with no match on the right?",
        options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"],
        answerIndex: 1,
        explanation: "LEFT JOIN preserves all left-table rows and fills the right-hand columns with NULL where there is no match.",
      },
      {
        q: "Students has 10 rows; Marks has 6 rows, one per student. How many rows does an INNER JOIN on student_id return?",
        options: ["6", "10", "16", "60"],
        answerIndex: 0,
        explanation: "INNER JOIN keeps only matching pairs, so the four students with no marks row disappear from the result.",
      },
      {
        q: "What does a CROSS JOIN produce?",
        options: [
          "Rows matching on the primary key",
          "The Cartesian product of both tables",
          "Only unmatched rows",
          "A syntax error without an ON clause",
        ],
        answerIndex: 1,
        explanation: "Every row of the first table is paired with every row of the second — m × n rows. It needs no ON clause.",
      },
      {
        q: "Why does COUNT(*) sometimes drop after you add a WHERE clause on a LEFT JOIN's right table?",
        options: [
          "WHERE runs before the join",
          "Filtering on a NULL column silently removes the unmatched rows",
          "LEFT JOIN becomes RIGHT JOIN",
          "COUNT ignores NULLs by design",
        ],
        answerIndex: 1,
        explanation: "A WHERE on the right table filters out the NULL-filled rows, quietly turning your LEFT JOIN into an INNER JOIN. Put the condition in the ON clause instead.",
      },
    ],
  },
  {
    topic: "Big-O and Complexity",
    subject: "Data Structures",
    difficulty: "Hard",
    questions: [
      {
        q: "What is the average-case complexity of a dictionary lookup in Python?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        answerIndex: 0,
        explanation: "Dicts are hash tables — the key hashes straight to a bucket. Worst case degrades to O(n) with pathological collisions.",
      },
      {
        q: "Which complexity describes binary search?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        answerIndex: 1,
        explanation: "Each comparison discards half the remaining range, so the number of steps is the number of times n can be halved.",
      },
      {
        q: "Unless stated otherwise, Big-O describes which case?",
        options: ["Best case", "Average case", "Worst case", "Amortised case"],
        answerIndex: 2,
        explanation: "Big-O is an upper bound, so it describes the worst case by convention. Quoting the best case is the most common student error.",
      },
      {
        q: "What is the complexity of this code?\n\nfor i in nums:\n    for j in nums:\n        print(i, j)",
        options: ["O(n)", "O(2n)", "O(n²)", "O(n log n)"],
        answerIndex: 2,
        explanation: "The inner loop runs n times for each of the n outer iterations, giving n × n total operations.",
      },
    ],
  },
  {
    topic: "React Fundamentals",
    subject: "Web Development",
    difficulty: "Medium",
    questions: [
      {
        q: "Why does React need a `key` prop on list items?",
        options: [
          "To style each item uniquely",
          "To let React match elements across re-renders",
          "To make the list sortable",
          "It is optional and has no effect",
        ],
        answerIndex: 1,
        explanation: "Keys let React identify which items changed, moved or were removed, so it can reuse DOM nodes instead of rebuilding the list.",
      },
      {
        q: "What is wrong with using an array index as a React key on a reorderable list?",
        options: [
          "Indexes are strings, not numbers",
          "The index changes when items move, so state attaches to the wrong row",
          "React forbids numeric keys",
          "Nothing — it is the recommended approach",
        ],
        answerIndex: 1,
        explanation: "After a reorder, index 0 points at a different item, so React reuses the wrong DOM node and input state jumps between rows.",
      },
      {
        q: "When does a useEffect with an empty dependency array run?",
        options: [
          "On every render",
          "Once after the first render",
          "Only when props change",
          "Never",
        ],
        answerIndex: 1,
        explanation: "An empty array means no dependencies ever change, so the effect runs once on mount — the usual place to fetch initial data.",
      },
      {
        q: "Why should you not mutate state directly with state.push(x)?",
        options: [
          "push is deprecated",
          "The reference does not change, so React skips the re-render",
          "It throws a TypeError in strict mode",
          "Arrays cannot be stored in state",
        ],
        answerIndex: 1,
        explanation: "React compares references to decide whether to re-render. Mutating in place keeps the same reference, so the UI never updates. Use setState([...state, x]).",
      },
    ],
  },
];

/* ---------------------------------------------------- per-user seed data */

export const GOALS = [
  { title: "Improve Python and data structures", daysOut: 76, progress: 62, status: "on-track" },
  { title: "Clear the campus placement aptitude round", daysOut: 120, progress: 38, status: "behind" },
];

export const TASKS = [
  { title: "Python — loops and iteration", subject: "Python", topic: "Python — Loops and Iteration",
    dayOffset: -2, durationMinutes: 45, priority: 2, completed: true, note: "Scored 90% on the follow-up quiz" },
  { title: "Revise Recursion — base cases and the call stack", subject: "Data Structures", topic: "Recursion",
    dayOffset: 0, durationMinutes: 45, priority: 1, autoScheduled: true,
    note: "Moved to today automatically — your average here is 40%" },
  { title: "Data Structures — stacks and queues", subject: "Data Structures", topic: "Stacks and Queues",
    dayOffset: 1, durationMinutes: 60, priority: 2, note: "Builds directly on recursion" },
  { title: "SQL joins — inner vs left", subject: "DBMS", topic: "SQL Joins",
    dayOffset: 2, durationMinutes: 45, priority: 1, autoScheduled: true,
    note: "Second weakest topic — scheduled before the weekend" },
  { title: "React — components and state", subject: "Web Development", topic: "React Fundamentals",
    dayOffset: 3, durationMinutes: 60, priority: 3, note: "Your strongest area — keeping it warm" },
  { title: "Mixed practice: 10 MCQs across all subjects", subject: "Python", topic: "Revision",
    dayOffset: 4, durationMinutes: 30, priority: 3, note: "Weekly mixed revision block" },
];

/** Attempt history — deliberately shaped so Recursion and DBMS read as weak. */
export const ATTEMPTS = [
  { topic: "Python — Loops and Iteration", subject: "Python", score: 9, total: 10, daysAgo: 11 },
  { topic: "Python — Loops and Iteration", subject: "Python", score: 8, total: 10, daysAgo: 9 },
  { topic: "React Fundamentals", subject: "Web Development", score: 8, total: 10, daysAgo: 8 },
  { topic: "Stacks and Queues", subject: "Data Structures", score: 7, total: 10, daysAgo: 7 },
  { topic: "Recursion", subject: "Data Structures", score: 4, total: 10, daysAgo: 6 },
  { topic: "SQL Joins", subject: "DBMS", score: 6, total: 10, daysAgo: 5 },
  { topic: "Big-O and Complexity", subject: "Data Structures", score: 7, total: 10, daysAgo: 4 },
  { topic: "React Fundamentals", subject: "Web Development", score: 9, total: 10, daysAgo: 3 },
  { topic: "SQL Joins", subject: "DBMS", score: 5, total: 10, daysAgo: 2 },
  { topic: "Python — Loops and Iteration", subject: "Python", score: 9, total: 10, daysAgo: 2 },
  { topic: "Recursion", subject: "Data Structures", score: 4, total: 10, daysAgo: 1 },
  { topic: "Stacks and Queues", subject: "Data Structures", score: 8, total: 10, daysAgo: 0 },
];

export const DOUBTS = [
  {
    authorIndex: 1,
    title: "Why does my recursive function hit RecursionError even with a base case?",
    body: "I wrote a factorial function with `if n == 0: return 1` as the base case, but calling it with a float like 5.5 still crashes. What am I missing?",
    subject: "Data Structures",
    tags: ["recursion", "python", "debugging"],
    resolved: true,
    views: 34,
    answers: [
      {
        authorName: "EduMind AI",
        isAI: true,
        upvotes: 12,
        body: "Your base case checks `n == 0`, but 5.5 never lands exactly on 0 — it goes 5.5, 4.5, 3.5 … 0.5, -0.5 and straight past it.\n\nUse `if n <= 0:` instead, or validate the input:\n\n```python\ndef factorial(n):\n    if not isinstance(n, int) or n < 0:\n        raise ValueError(\"factorial needs a non-negative integer\")\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n```\n\nThe general rule: a base case must be reachable from every legal input, not just the ones you had in mind.",
      },
      {
        authorName: "Dhanush S",
        isAI: false,
        upvotes: 5,
        body: "Ran into exactly this last week. Using `<=` instead of `==` in base cases has saved me every time since.",
      },
    ],
  },
  {
    authorIndex: 2,
    title: "LEFT JOIN vs INNER JOIN — when does it actually matter?",
    body: "My query returns 6 rows with INNER JOIN and 10 with LEFT JOIN on the same tables. I understand the definitions but I never know which one I should reach for.",
    subject: "DBMS",
    tags: ["sql", "joins"],
    resolved: false,
    views: 21,
    answers: [
      {
        authorName: "EduMind AI",
        isAI: true,
        upvotes: 8,
        body: "Ask one question: **do I still care about the left row if there's no match?**\n\n- Listing every student and their marks, including students who haven't sat the exam → **LEFT JOIN**. You want the four students with no marks row to appear, with NULL marks.\n- Calculating the class average → **INNER JOIN**. Students with no marks would skew the count.\n\nThe gotcha: adding `WHERE marks.score > 40` to a LEFT JOIN silently turns it back into an INNER JOIN, because NULL fails the comparison. Put that condition in the `ON` clause instead if you want to keep the unmatched rows.",
      },
    ],
  },
  {
    authorIndex: 0,
    title: "Is it worth learning Redux in 2026, or is Context enough?",
    body: "Building a mid-size React app for a hackathon. I've used useContext for auth and theme so far. At what point does it become worth pulling in a real state library?",
    subject: "Web Development",
    tags: ["react", "state-management"],
    resolved: false,
    views: 47,
    answers: [
      {
        authorName: "EduMind AI",
        isAI: true,
        upvotes: 15,
        body: "For a hackathon app, Context is almost always enough — and one less thing to explain to judges.\n\nContext starts to hurt when:\n- Many components read one slice of a large object, so every update re-renders all of them\n- You need time-travel debugging or middleware\n- Server state (caching, refetching, stale data) becomes the real problem\n\nThat last one is the usual culprit, and Redux isn't the answer to it — TanStack Query is. Reach for Zustand before Redux if you do need a client store; it's about 20 lines of setup versus Redux's boilerplate.\n\nFor what you're describing, stay on Context and ship.",
      },
    ],
  },
  {
    authorIndex: 1,
    title: "How do I actually measure Big-O for my own code?",
    body: "I can recognise O(n) and O(n²) in textbook examples, but when I look at my own functions with a few nested conditionals I have no idea where to start.",
    subject: "Data Structures",
    tags: ["complexity", "big-o"],
    resolved: true,
    views: 29,
    answers: [
      {
        authorName: "EduMind AI",
        isAI: true,
        upvotes: 11,
        body: "Ignore conditionals almost entirely — they're constant-time branches. Count **loops over the input** and **recursive calls**.\n\nA practical procedure:\n1. Find the deepest nesting of loops that each run n times → that's your exponent.\n2. Check whether any loop's bound shrinks (halving → log n).\n3. Look inside every call you make — `x in my_list` is a hidden O(n) loop, `x in my_set` is O(1).\n4. Drop constants and lower-order terms.\n\nStep 3 is where most people's estimates go wrong. A single `in` on a list inside a loop quietly makes an O(n) function O(n²).",
      },
    ],
  },
];

export const ASSIGNMENTS = [
  {
    title: "Implement a recursive directory-size calculator",
    subject: "Python",
    type: "coding",
    difficulty: "Medium",
    brief: "Recursion applied to nested data structures",
    dayOffset: 5,
    status: "in-progress",
    content: `## Brief

You are writing a small utility that reports how much disk space a folder tree uses. The folder structure is given to you as nested dictionaries, where a number is a file's size in KB and a dictionary is a subfolder.

## Learning objectives

- Identify the recursive structure hidden inside a nested data type
- Write a base case that every legal input can reach
- Reason about the depth of the call stack for real inputs
- Compare a recursive solution against an explicit-stack iterative one

## Tasks

1. **Write** \`total_size(tree)\` returning the sum of all file sizes at any depth.
2. **Extend** it to \`largest_folder(tree)\` returning the name of the subfolder using the most space.
3. **Handle** a tree 5000 levels deep without crashing. Explain what you changed and why.
4. **Rewrite** task 1 iteratively using an explicit stack, and compare the two.

## Deliverables

- A single \`.py\` file with all four functions and docstrings
- Three test cases, including one empty folder and one deeply nested tree
- A 200-word note comparing the recursive and iterative versions

## Marking scheme

| Criterion | Marks |
|---|---|
| Correct recursion with a reachable base case | 30 |
| largest_folder implementation | 20 |
| Deep-tree handling and explanation | 20 |
| Iterative rewrite | 20 |
| Tests and documentation | 10 |
| **Total** | **100** |

## Hints

- The base case is not "the folder is empty" — it's "this value is a number, not a dictionary".
- For task 3, look up \`sys.setrecursionlimit\` first, then ask yourself why the iterative version never needed it.`,
  },
];

export const CAREER_INTERESTS = ["Backend development", "IoT and embedded systems", "Machine learning"];
export const CAREER_STRENGTHS = ["Python", "Building end-to-end projects", "Debugging"];
