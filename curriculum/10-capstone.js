export default {
  id: "10-capstone",
  title: "Capstone: Study Tracker",
  summary: "Build one real program, in four steps, using everything from the previous nine lessons.",
  minutes: 30,
  sections: [
    {
      heading: "What you are building",
      body: `
        <p>A small program that records study sessions and reports on them. Nothing here is new
        — it is variables, conditions, loops, functions, arrays and objects, working together.
        That combination is what an actual program is.</p>
        <p>The data is a <strong>log</strong>: an array of session objects.</p>
        <pre class="sample"><code>const log = [
  { subject: "maths", minutes: 45 },
  { subject: "french", minutes: 30 },
  { subject: "maths", minutes: 20 },
];</code></pre>
      `,
    },
    {
      heading: "How to work",
      body: `
        <p>Four exercises, each building on the last. Each one is checked on its own, so you can
        finish them in order without carrying your earlier code forward.</p>
        <p>Work the way you would on real code:</p>
        <ol>
          <li>Read the description and write down, in ordinary words, what the function must do.</li>
          <li>Ask what happens with an empty log, a single entry, and a repeated subject.</li>
          <li>Write the simplest version that could work.</li>
          <li>Run it. Read the failures. Fix the real cause rather than patching the symptom.</li>
        </ol>
        <p>If you get stuck, <code>console.log</code> inside the loop and watch what actually
        happens. The output panel is there for exactly that.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "capstone-1",
      title: "Record a session",
      prompt: `
        <p>Write <code>addSession(log, subject, minutes)</code>. It should add a new session
        object to the log and return the log.</p>
        <p>Two rules:</p>
        <ul>
          <li>The subject is stored in lower case with surrounding spaces removed, so
          <code>"  Maths "</code> is stored as <code>"maths"</code>.</li>
          <li>Sessions of zero or negative minutes are rejected: leave the log untouched and
          return it unchanged.</li>
        </ul>
        <pre class="sample"><code>addSession([], "Maths", 45)
// [{ subject: "maths", minutes: 45 }]</code></pre>
      `,
      starter: "function addSession(log, subject, minutes) {\n  \n}\n",
      solution: "function addSession(log, subject, minutes) {\n  if (minutes <= 0) return log;\n\n  log.push({ subject: subject.trim().toLowerCase(), minutes: minutes });\n  return log;\n}\n",
      hints: [
        "Reject the bad input first and return the log straight away — that keeps the rest simple.",
        "Tidy the subject with .trim().toLowerCase(), as in lesson 3.",
        "Push an object with the two keys, then return the log: log.push({ subject: cleaned, minutes: minutes });",
      ],
      tests: [
        { name: "addSession is a function", code: `assert.declared(() => addSession, "addSession"); assert.type(addSession, "function");` },
        { name: "it adds a session", code: `assert.deepEqual(addSession([], "maths", 45), [{ subject: "maths", minutes: 45 }]);` },
        { name: "the subject is tidied up", code: `assert.deepEqual(addSession([], "  Maths ", 45), [{ subject: "maths", minutes: 45 }]);` },
        {
          name: "it appends to an existing log",
          code: `const log = [{ subject: "french", minutes: 30 }]; addSession(log, "maths", 10); assert.equal(log.length, 2); assert.deepEqual(log[1], { subject: "maths", minutes: 10 });`,
        },
        { name: "zero minutes is rejected", code: `assert.deepEqual(addSession([], "maths", 0), []);` },
        { name: "negative minutes are rejected", code: `assert.deepEqual(addSession([], "maths", -5), []);` },
        { name: "it returns the log", code: `const log = []; assert.equal(addSession(log, "art", 5), log);` },
      ],
    },
    {
      id: "capstone-2",
      title: "Total and filter",
      prompt: `
        <p>Write two functions over a log:</p>
        <ul>
          <li><code>totalMinutes(log)</code> — every session's minutes added together.
          An empty log gives <code>0</code>.</li>
          <li><code>sessionsFor(log, subject)</code> — an array of just the sessions whose
          subject matches, in their original order. The match ignores capitals and surrounding
          spaces, so <code>"  MATHS "</code> finds the maths sessions.</li>
        </ul>
      `,
      starter: "function totalMinutes(log) {\n  \n}\n\nfunction sessionsFor(log, subject) {\n  \n}\n",
      solution: "function totalMinutes(log) {\n  let total = 0;\n  for (const session of log) {\n    total = total + session.minutes;\n  }\n  return total;\n}\n\nfunction sessionsFor(log, subject) {\n  const wanted = subject.trim().toLowerCase();\n  const found = [];\n  for (const session of log) {\n    if (session.subject === wanted) {\n      found.push(session);\n    }\n  }\n  return found;\n}\n",
      hints: [
        "totalMinutes is the accumulator pattern: start at 0, add session.minutes for each one.",
        "In sessionsFor, tidy the requested subject once, before the loop — not on every pass.",
        "Start with an empty array and push the sessions that match.",
      ],
      tests: [
        {
          name: "totalMinutes adds everything up",
          code: `assert.equal(totalMinutes([{ subject: "maths", minutes: 45 }, { subject: "french", minutes: 30 }]), 75);`,
        },
        { name: "an empty log totals 0", code: `assert.equal(totalMinutes([]), 0);` },
        { name: "one session totals its own minutes", code: `assert.equal(totalMinutes([{ subject: "art", minutes: 12 }]), 12);` },
        {
          name: "sessionsFor finds matching sessions",
          code: `const log = [{ subject: "maths", minutes: 45 }, { subject: "french", minutes: 30 }, { subject: "maths", minutes: 20 }]; assert.deepEqual(sessionsFor(log, "maths"), [{ subject: "maths", minutes: 45 }, { subject: "maths", minutes: 20 }]);`,
        },
        {
          name: "the search ignores case and spaces",
          code: `const log = [{ subject: "maths", minutes: 45 }]; assert.deepEqual(sessionsFor(log, "  MATHS "), [{ subject: "maths", minutes: 45 }]);`,
        },
        { name: "an unknown subject gives an empty array", code: `assert.deepEqual(sessionsFor([{ subject: "maths", minutes: 45 }], "history"), []);` },
        { name: "an empty log gives an empty array", code: `assert.deepEqual(sessionsFor([], "maths"), []);` },
      ],
    },
    {
      id: "capstone-3",
      title: "Group by subject",
      prompt: `
        <p>Write <code>minutesBySubject(log)</code> that returns an object mapping each subject
        to its total minutes:</p>
        <pre class="sample"><code>minutesBySubject([
  { subject: "maths", minutes: 45 },
  { subject: "french", minutes: 30 },
  { subject: "maths", minutes: 20 },
])
// { maths: 65, french: 30 }</code></pre>
        <p>An empty log gives an empty object, <code>{}</code>.</p>
        <p>This is the step that trips people up. For each session you have to ask: have I seen
        this subject before? If not, start it at 0; then add. Grouping is one of the handful of
        patterns that comes up in real code constantly, so it is worth getting into your fingers.</p>
      `,
      starter: "function minutesBySubject(log) {\n  const totals = {};\n\n  // For each session: start the subject at 0 if it is new, then add its minutes.\n\n  return totals;\n}\n",
      solution: "function minutesBySubject(log) {\n  const totals = {};\n\n  for (const session of log) {\n    if (totals[session.subject] === undefined) {\n      totals[session.subject] = 0;\n    }\n    totals[session.subject] = totals[session.subject] + session.minutes;\n  }\n\n  return totals;\n}\n",
      hints: [
        "The subject is in a variable, so you must use brackets: totals[session.subject], not totals.session.subject.",
        "A key that has never been set reads back as undefined — that is how you tell a new subject from a known one.",
        "Set it to 0 when it is new, then add on the same line every time: totals[s] = totals[s] + session.minutes;",
      ],
      tests: [
        { name: "minutesBySubject is a function", code: `assert.declared(() => minutesBySubject, "minutesBySubject"); assert.type(minutesBySubject, "function");` },
        {
          name: "it sums repeated subjects",
          code: `assert.deepEqual(minutesBySubject([{ subject: "maths", minutes: 45 }, { subject: "french", minutes: 30 }, { subject: "maths", minutes: 20 }]), { maths: 65, french: 30 });`,
        },
        { name: "an empty log gives an empty object", code: `assert.deepEqual(minutesBySubject([]), {});` },
        { name: "one session gives one key", code: `assert.deepEqual(minutesBySubject([{ subject: "art", minutes: 15 }]), { art: 15 });` },
        {
          name: "it handles three different subjects",
          code: `assert.deepEqual(minutesBySubject([{ subject: "a", minutes: 1 }, { subject: "b", minutes: 2 }, { subject: "c", minutes: 3 }]), { a: 1, b: 2, c: 3 });`,
        },
        {
          name: "no leftover subjects appear",
          code: `assert.deepEqual(Object.keys(minutesBySubject([{ subject: "maths", minutes: 5 }, { subject: "maths", minutes: 5 }])), ["maths"]);`,
        },
      ],
    },
    {
      id: "capstone-4",
      title: "The report",
      prompt: `
        <p>Finally, put it together. Write <code>report(log)</code> returning a printable
        summary string.</p>
        <p>For a log of maths 45, french 30, maths 20 it returns exactly:</p>
        <pre class="sample"><code>Study report
maths: 65 min
french: 30 min
Total: 95 min</code></pre>
        <p>The lines are joined with <code>\\n</code> (the newline character). Subjects appear
        in the order they were <strong>first studied</strong>, which is the order
        <code>Object.keys</code> gives you.</p>
        <p>For an empty log, return exactly:</p>
        <pre class="sample"><code>Study report
No sessions recorded.</code></pre>
        <p>You may write helper functions — in fact you should. Re-implement the grouping and
        totalling here, or call helpers you define above; both count.</p>
      `,
      starter: "function report(log) {\n  \n}\n",
      solution: "function minutesBySubject(log) {\n  const totals = {};\n  for (const session of log) {\n    if (totals[session.subject] === undefined) {\n      totals[session.subject] = 0;\n    }\n    totals[session.subject] = totals[session.subject] + session.minutes;\n  }\n  return totals;\n}\n\nfunction report(log) {\n  if (log.length === 0) {\n    return \"Study report\\nNo sessions recorded.\";\n  }\n\n  const totals = minutesBySubject(log);\n  const lines = [\"Study report\"];\n  let grandTotal = 0;\n\n  for (const subject of Object.keys(totals)) {\n    lines.push(`${subject}: ${totals[subject]} min`);\n    grandTotal = grandTotal + totals[subject];\n  }\n\n  lines.push(`Total: ${grandTotal} min`);\n  return lines.join(\"\\n\");\n}\n",
      hints: [
        "Deal with the empty log first and return that exact two-line string.",
        "Collect the lines in an array and join them at the end with \\n — much easier than gluing a string together as you go.",
        "Loop over Object.keys(totals) to build one line per subject, adding up the grand total as you go.",
      ],
      tests: [
        { name: "report is a function", code: `assert.declared(() => report, "report"); assert.type(report, "function");` },
        {
          name: "it reports a full log exactly",
          code: `assert.equal(report([{ subject: "maths", minutes: 45 }, { subject: "french", minutes: 30 }, { subject: "maths", minutes: 20 }]), "Study report\\nmaths: 65 min\\nfrench: 30 min\\nTotal: 95 min");`,
        },
        {
          name: "an empty log gives the empty report",
          code: `assert.equal(report([]), "Study report\\nNo sessions recorded.");`,
        },
        {
          name: "a single session reports correctly",
          code: `assert.equal(report([{ subject: "art", minutes: 15 }]), "Study report\\nart: 15 min\\nTotal: 15 min");`,
        },
        {
          name: "subjects keep first-studied order",
          code: `assert.equal(report([{ subject: "zoology", minutes: 10 }, { subject: "art", minutes: 5 }]), "Study report\\nzoology: 10 min\\nart: 5 min\\nTotal: 15 min");`,
        },
        {
          name: "the total counts every session",
          code: `const lines = report([{ subject: "a", minutes: 1 }, { subject: "b", minutes: 2 }, { subject: "a", minutes: 3 }]).split("\\n"); assert.equal(lines[lines.length - 1], "Total: 6 min");`,
        },
      ],
    },
  ],
};
