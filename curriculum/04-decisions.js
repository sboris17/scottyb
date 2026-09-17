export default {
  id: "04-decisions",
  title: "Making Decisions",
  summary: "Teaching a program to take different paths depending on what is true.",
  minutes: 14,
  sections: [
    {
      heading: "if",
      body: `
        <p>So far every line has run, every time. <code>if</code> changes that: the code in
        the braces runs only when the condition in the parentheses is true.</p>
        <pre class="sample"><code>const temperature = 31;

if (temperature > 30) {
  console.log("Stay in the shade.");
}</code></pre>
        <p>Add <code>else</code> for the other case, and <code>else if</code> for as many
        further cases as you need:</p>
        <pre class="sample"><code>if (temperature > 30) {
  console.log("Hot");
} else if (temperature > 15) {
  console.log("Mild");
} else {
  console.log("Cold");
}</code></pre>
        <p>The branches are checked top to bottom and <strong>the first match wins</strong>;
        the rest are skipped entirely. That is why order matters: if you put
        <code>temperature > 15</code> first, a temperature of 31 matches it and never reaches
        the "Hot" branch. Order your conditions from most specific to most general.</p>
      `,
    },
    {
      heading: "Comparing values",
      body: `
        <ul>
          <li><code>===</code> is the same as &nbsp;·&nbsp; <code>!==</code> is not the same as</li>
          <li><code>&gt;</code> <code>&lt;</code> greater / less than</li>
          <li><code>&gt;=</code> <code>&lt;=</code> greater / less than or equal to</li>
        </ul>
        <p>Each of these produces a boolean — <code>true</code> or <code>false</code>. You can
        store that in a variable like any other value:</p>
        <pre class="sample"><code>const isAdult = age >= 18;</code></pre>
        <p><strong>Use <code>===</code>, not <code>==</code>.</strong> JavaScript also has
        <code>==</code>, which quietly converts types before comparing, so
        <code>"5" == 5</code> is <code>true</code> and <code>0 == ""</code> is <code>true</code>.
        That is a bug generator. <code>===</code> compares without converting:
        <code>"5" === 5</code> is <code>false</code>, which is the answer you almost always want.</p>
      `,
    },
    {
      heading: "Combining conditions",
      body: `
        <ul>
          <li><code>&amp;&amp;</code> — <strong>and</strong>. True only when both sides are true.</li>
          <li><code>||</code> — <strong>or</strong>. True when at least one side is true.</li>
          <li><code>!</code> — <strong>not</strong>. Flips true to false and back.</li>
        </ul>
        <pre class="sample"><code>if (age >= 13 && age <= 19) {
  console.log("Teenager");
}

if (day === "Saturday" || day === "Sunday") {
  console.log("Weekend");
}

if (!isLoggedIn) {
  console.log("Please sign in.");
}</code></pre>
        <p>A trap: <code>day === "Saturday" || "Sunday"</code> looks reasonable in English and
        is wrong in code. Each side of <code>||</code> must be a complete comparison. You have
        to say <code>day === "Saturday" || day === "Sunday"</code>.</p>
      `,
    },
    {
      heading: "Returning early",
      body: `
        <p>Inside a function, <code>return</code> hands back a value and stops immediately —
        nothing after it runs. That lets you write decisions without piling up
        <code>else</code> branches:</p>
        <pre class="sample"><code>function describe(score) {
  if (score >= 90) return "excellent";
  if (score >= 50) return "a pass";
  return "not yet";
}</code></pre>
        <p>No <code>else</code> is needed: if the first <code>return</code> runs, the function
        is already finished. This style stays readable as the number of cases grows.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "decisions-1",
      title: "Grade a score",
      prompt: `
        <p>Write <code>grade(score)</code> returning a single letter:</p>
        <ul>
          <li><code>"A"</code> for 90 and above</li>
          <li><code>"B"</code> for 80–89</li>
          <li><code>"C"</code> for 70–79</li>
          <li><code>"F"</code> for anything below 70</li>
        </ul>
        <p>Mind the boundaries. Exactly 90 is an A, and exactly 80 is a B — these edges are
        where this kind of code goes wrong.</p>
      `,
      starter: "function grade(score) {\n  \n}\n",
      solution: "function grade(score) {\n  if (score >= 90) return \"A\";\n  if (score >= 80) return \"B\";\n  if (score >= 70) return \"C\";\n  return \"F\";\n}\n",
      hints: [
        "Check the highest band first, then work downwards.",
        "Because the earlier checks already returned, you never need to write score >= 80 && score < 90.",
        'The last case needs no condition at all — just return "F".',
      ],
      tests: [
        { name: "grade is a function", code: `assert.declared(() => grade, "grade"); assert.type(grade, "function");` },
        { name: "95 is an A", code: `assert.equal(grade(95), "A");` },
        { name: "exactly 90 is an A", code: `assert.equal(grade(90), "A");` },
        { name: "exactly 80 is a B", code: `assert.equal(grade(80), "B");` },
        { name: "89 is a B", code: `assert.equal(grade(89), "B");` },
        { name: "75 is a C", code: `assert.equal(grade(75), "C");` },
        { name: "69 is an F", code: `assert.equal(grade(69), "F");` },
        { name: "0 is an F", code: `assert.equal(grade(0), "F");` },
      ],
    },
    {
      id: "decisions-2",
      title: "Two conditions at once",
      prompt: `
        <p>A fairground ride has a rule: you may ride if you are at least 140cm tall,
        <strong>or</strong> if you are at least 120cm and accompanied by an adult. Under
        120cm, nobody rides.</p>
        <p>Write <code>canRide(heightCm, withAdult)</code> returning <code>true</code> or
        <code>false</code>. <code>withAdult</code> is a boolean.</p>
        <p>Return the boolean itself — not the strings <code>"true"</code> or <code>"yes"</code>.</p>
      `,
      starter: "function canRide(heightCm, withAdult) {\n  \n}\n",
      solution: "function canRide(heightCm, withAdult) {\n  if (heightCm >= 140) return true;\n  if (heightCm >= 120 && withAdult) return true;\n  return false;\n}\n",
      hints: [
        "There are two separate ways to be allowed on — handle them as two checks.",
        "The second way needs both things to be true, which is &&.",
        "withAdult is already a boolean, so you can write it directly in the condition: no need for withAdult === true.",
      ],
      tests: [
        { name: "canRide is a function", code: `assert.declared(() => canRide, "canRide"); assert.type(canRide, "function");` },
        { name: "150cm alone can ride", code: `assert.equal(canRide(150, false), true);` },
        { name: "exactly 140cm alone can ride", code: `assert.equal(canRide(140, false), true);` },
        { name: "130cm alone cannot ride", code: `assert.equal(canRide(130, false), false);` },
        { name: "130cm with an adult can ride", code: `assert.equal(canRide(130, true), true);` },
        { name: "exactly 120cm with an adult can ride", code: `assert.equal(canRide(120, true), true);` },
        { name: "119cm with an adult cannot ride", code: `assert.equal(canRide(119, true), false);` },
        { name: "it returns real booleans", code: `assert.type(canRide(150, false), "boolean"); assert.type(canRide(100, false), "boolean");` },
      ],
    },
    {
      id: "decisions-3",
      title: "Describe a number",
      prompt: `
        <p>Write <code>describeNumber(n)</code> that returns:</p>
        <ul>
          <li><code>"zero"</code> when n is 0</li>
          <li><code>"positive even"</code> / <code>"positive odd"</code> when n is above 0</li>
          <li><code>"negative even"</code> / <code>"negative odd"</code> when n is below 0</li>
        </ul>
        <p>Remember <code>%</code>: <code>n % 2</code> is 0 when n divides evenly by two.
        Careful with negatives — in JavaScript <code>-3 % 2</code> is <code>-1</code>, not
        <code>1</code>, so testing <code>n % 2 === 1</code> will let you down. Test for
        <strong>even</strong> instead: <code>n % 2 === 0</code>.</p>
      `,
      starter: "function describeNumber(n) {\n  \n}\n",
      solution: "function describeNumber(n) {\n  if (n === 0) return \"zero\";\n\n  let sign = \"negative\";\n  if (n > 0) {\n    sign = \"positive\";\n  }\n\n  let parity = \"odd\";\n  if (n % 2 === 0) {\n    parity = \"even\";\n  }\n\n  return `${sign} ${parity}`;\n}\n",
      hints: [
        "Deal with zero first and return straight away — it is the only case with no sign.",
        "Then you have two independent questions: is it positive or negative, and is it even or odd.",
        'Work out the two words separately and join them with a space, or write out all four combinations as ifs — both are fine.',
      ],
      tests: [
        { name: "describeNumber is a function", code: `assert.declared(() => describeNumber, "describeNumber"); assert.type(describeNumber, "function");` },
        { name: "0 is zero", code: `assert.equal(describeNumber(0), "zero");` },
        { name: "4 is positive even", code: `assert.equal(describeNumber(4), "positive even");` },
        { name: "7 is positive odd", code: `assert.equal(describeNumber(7), "positive odd");` },
        { name: "-8 is negative even", code: `assert.equal(describeNumber(-8), "negative even");` },
        { name: "-3 is negative odd", code: `assert.equal(describeNumber(-3), "negative odd");` },
        { name: "-1 is negative odd", code: `assert.equal(describeNumber(-1), "negative odd");` },
      ],
    },
  ],
};
