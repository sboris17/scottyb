export default {
  id: "02-variables",
  title: "Variables & Values",
  summary: "Giving names to values so you can reuse them, change them, and reason about them.",
  minutes: 12,
  sections: [
    {
      heading: "A name for a value",
      body: `
        <p>A <strong>variable</strong> is a name attached to a value. You create one with
        <code>let</code> or <code>const</code>:</p>
        <pre class="sample"><code>let score = 0;
const playerName = "Sam";</code></pre>
        <p>Read <code>=</code> as "gets" or "is set to", never as "equals". It is an
        instruction — <em>put this value in this box</em> — not a statement of fact.</p>
        <p>Once a variable exists, using its name is the same as using its value:</p>
        <pre class="sample"><code>const price = 12;
console.log(price);      // prints 12
console.log(price * 2);  // prints 24</code></pre>
      `,
    },
    {
      heading: "let vs const",
      body: `
        <p>The difference is whether the name is allowed to point at something else later.</p>
        <ul>
          <li><code>let</code> — this value will change. Counters, running totals, anything
          that gets updated as the program runs.</li>
          <li><code>const</code> — this name keeps pointing at the same value. Trying to
          reassign it is an error the computer catches for you.</li>
        </ul>
        <pre class="sample"><code>let lives = 3;
lives = lives - 1;   // fine: lives is now 2

const pi = 3.14159;
pi = 3;              // TypeError: Assignment to constant variable.</code></pre>
        <p>Reach for <code>const</code> first and switch to <code>let</code> only when you
        find you need to reassign. A name that cannot change is one less thing to track.</p>
      `,
    },
    {
      heading: "Updating a variable",
      body: `
        <p>This line confuses everyone exactly once:</p>
        <pre class="sample"><code>score = score + 10;</code></pre>
        <p>As maths it is nonsense. As an instruction it is clear: <em>work out
        <code>score + 10</code>, then put the answer back into <code>score</code></em>.
        The right-hand side is evaluated first, always. Because this is so common there
        is a shorthand: <code>score += 10;</code> means the same thing.</p>
      `,
    },
    {
      heading: "Three kinds of value",
      body: `
        <p>For now you need three <strong>types</strong>:</p>
        <ul>
          <li><strong>number</strong> — <code>7</code>, <code>-3</code>, <code>0.5</code>.
          One type for whole numbers and decimals alike.</li>
          <li><strong>string</strong> — <code>"hello"</code>. Text, in quotes.</li>
          <li><strong>boolean</strong> — <code>true</code> or <code>false</code>. Exactly two
          possible values, and no quotes: <code>"true"</code> is a string, not a boolean.</li>
        </ul>
        <p>You can ask what something is with <code>typeof</code>:</p>
        <pre class="sample"><code>console.log(typeof 7);        // "number"
console.log(typeof "7");      // "string"
console.log(typeof true);     // "boolean"</code></pre>
        <p>The difference between <code>7</code> and <code>"7"</code> matters: <code>7 + 7</code>
        is <code>14</code>, but <code>"7" + "7"</code> is <code>"77"</code>. With strings,
        <code>+</code> means "join together", and that trips up more beginners than any
        other single thing in this lesson.</p>
      `,
    },
    {
      heading: "Arithmetic",
      body: `
        <p><code>+</code> add, <code>-</code> subtract, <code>*</code> multiply,
        <code>/</code> divide, and <code>%</code> — the <strong>remainder</strong> left after
        division. <code>7 % 2</code> is <code>1</code>. Remainder looks obscure now; it turns
        out to be how you test whether a number is even, wrap a value around a clock face, or
        take every third item.</p>
        <p>Normal precedence applies — <code>*</code> and <code>/</code> before <code>+</code>
        and <code>-</code> — and brackets override it: <code>(2 + 3) * 4</code> is <code>20</code>.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "variables-1",
      title: "Declare three variables",
      prompt: `
        <p>Create three variables with exactly these names and values:</p>
        <ul>
          <li><code>city</code> — the string <code>"Lisbon"</code></li>
          <li><code>population</code> — the number <code>548000</code></li>
          <li><code>isCoastal</code> — the boolean <code>true</code></li>
        </ul>
        <p>Watch the types: the number and the boolean must not be in quotes.</p>
      `,
      starter: `const city = ;\n// population and isCoastal go here\n`,
      solution: `const city = "Lisbon";\nconst population = 548000;\nconst isCoastal = true;\n`,
      hints: [
        "Each one is a line like: const name = value;",
        'Only the city is text, so only the city gets quotes.',
        "true is typed bare — no quotes, all lowercase.",
      ],
      tests: [
        { name: "city is the string Lisbon", code: `assert.declared(() => city, "city"); assert.equal(city, "Lisbon");` },
        {
          name: "population is the number 548000",
          code: `assert.declared(() => population, "population"); assert.type(population, "number"); assert.equal(population, 548000);`,
        },
        {
          name: "isCoastal is the boolean true",
          code: `assert.declared(() => isCoastal, "isCoastal"); assert.type(isCoastal, "boolean"); assert.equal(isCoastal, true);`,
        },
      ],
    },
    {
      id: "variables-2",
      title: "Work out a total",
      prompt: `
        <p>A shop sells notebooks at 4.50 each. Someone buys 6, and there is a flat delivery
        charge of 3.00.</p>
        <p>Using the variables already declared, create a variable named <code>total</code>
        holding the full amount to pay. Calculate it from the other variables — do not type
        the answer in directly. If the price changes tomorrow, your program should still be right.</p>
      `,
      starter: `const pricePerNotebook = 4.5;\nconst quantity = 6;\nconst delivery = 3;\n\n// Create \`total\` from the three variables above.\n`,
      solution: `const pricePerNotebook = 4.5;\nconst quantity = 6;\nconst delivery = 3;\n\nconst total = pricePerNotebook * quantity + delivery;\n`,
      hints: [
        "First work out the cost of the notebooks, then add the delivery.",
        "Multiplication happens before addition, so you do not need brackets here.",
        "const total = pricePerNotebook * quantity + delivery;",
      ],
      tests: [
        { name: "total exists and is a number", code: `assert.declared(() => total, "total"); assert.type(total, "number");` },
        { name: "total is 30", code: `assert.close(total, 30, 1e-9);` },
        {
          name: "total is calculated, not hard-coded",
          code: `assert.notOk(/total\\s*=\\s*30\\b/.test(__SOURCE), "Build total out of the other variables rather than typing the answer in.");`,
        },
      ],
    },
    {
      id: "variables-3",
      title: "Keep a running total",
      prompt: `
        <p>A player starts with a <code>score</code> of 0. Three things happen, in order:</p>
        <ol>
          <li>They collect a coin: <strong>+10</strong></li>
          <li>They hit a hazard: <strong>-4</strong></li>
          <li>They finish the level, doubling whatever they have</li>
        </ol>
        <p>Update <code>score</code> step by step so it ends at the right value. Do not
        collapse it into one line — write it as three updates, the way the events actually
        happened.</p>
      `,
      starter: `let score = 0;\n\n// 1. coin: +10\n\n// 2. hazard: -4\n\n// 3. level complete: doubled\n\nconsole.log(score);\n`,
      solution: `let score = 0;\n\nscore = score + 10;\n\nscore = score - 4;\n\nscore = score * 2;\n\nconsole.log(score);\n`,
      hints: [
        "Each step looks like: score = score <something>;",
        "The right-hand side is worked out first, then stored back into score.",
        "Doubling is score = score * 2, which you could also write as score *= 2.",
      ],
      tests: [
        { name: "score ends at 12", code: `assert.declared(() => score, "score"); assert.equal(score, 12);` },
        { name: "the final score is printed", code: `assert.printed("12");` },
      ],
    },
  ],
};
