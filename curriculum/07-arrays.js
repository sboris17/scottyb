export default {
  id: "07-arrays",
  title: "Arrays",
  summary: "Holding many values under one name, and doing something to each of them.",
  minutes: 15,
  sections: [
    {
      heading: "A list of values",
      body: `
        <p>An <strong>array</strong> is an ordered list, written in square brackets:</p>
        <pre class="sample"><code>const scores = [88, 92, 71];
const names = ["Ana", "Bo", "Chi"];
const empty = [];</code></pre>
        <p>Positions start at 0, exactly as with strings:</p>
        <pre class="sample"><code>console.log(scores[0]);                  // 88
console.log(scores.length);              // 3
console.log(scores[scores.length - 1]);  // 71 — the last one
console.log(scores[3]);                  // undefined — there is no fourth item</code></pre>
        <p>That last line is worth dwelling on. Reading past the end is not an error; you get
        <code>undefined</code> and the program carries on, which is why an off-by-one mistake
        can travel a long way before anything looks wrong.</p>
      `,
    },
    {
      heading: "Changing an array",
      body: `
        <pre class="sample"><code>const queue = ["a", "b"];

queue.push("c");      // add to the end       -> ["a", "b", "c"]
queue.pop();          // remove from the end  -> ["a", "b"]
queue.unshift("z");   // add to the start     -> ["z", "a", "b"]
queue.shift();        // remove from the start-> ["a", "b"]
queue[0] = "A";       // replace a position   -> ["A", "b"]</code></pre>
        <p>Notice these worked on a <code>const</code> array. <code>const</code> stops the
        <em>name</em> pointing at a different array; it does not freeze the contents. You can
        push all day, but <code>queue = []</code> is still an error.</p>
      `,
    },
    {
      heading: "Visiting every item",
      body: `
        <p>The counting loop works, and you will still see it everywhere:</p>
        <pre class="sample"><code>for (let i = 0; i < scores.length; i++) {
  console.log(scores[i]);
}</code></pre>
        <p>But when you do not actually need the position, <code>for...of</code> says what you
        mean with less to get wrong:</p>
        <pre class="sample"><code>for (const score of scores) {
  console.log(score);
}</code></pre>
        <p>No <code>i</code>, no <code>length</code>, no chance of an off-by-one. Use
        <code>for...of</code> unless you genuinely need the index.</p>
      `,
    },
    {
      heading: "Searching and joining",
      body: `
        <pre class="sample"><code>console.log(names.includes("Bo"));   // true
console.log(names.indexOf("Chi"));   // 2, or -1 when it is not there
console.log(names.join(", "));       // "Ana, Bo, Chi"
console.log(names.slice(0, 2));      // ["Ana", "Bo"] — a copy, original untouched</code></pre>
        <p><code>indexOf</code> returning <code>-1</code> for "not found" is a convention you
        will meet in many languages. Test it with <code>=== -1</code>, and remember that
        position <code>0</code> is falsy — <code>if (names.indexOf(x))</code> is a bug waiting
        to happen when <code>x</code> is the first item.</p>
      `,
    },
    {
      heading: "map, filter, reduce",
      body: `
        <p>Three methods cover most of what loops over arrays are for. Each takes a function
        and returns something new, leaving the original array alone.</p>
        <pre class="sample"><code>const numbers = [1, 2, 3, 4];

// map: same length, each item transformed
const doubled = numbers.map(function (n) { return n * 2; });   // [2, 4, 6, 8]

// filter: same items, only the ones that pass
const evens = numbers.filter(function (n) { return n % 2 === 0; });   // [2, 4]

// reduce: the whole array boiled down to one value
const total = numbers.reduce(function (runningTotal, n) {
  return runningTotal + n;
}, 0);                                                          // 10</code></pre>
        <p><code>reduce</code> takes a starting value — the <code>0</code> at the end — and a
        function that receives the total so far and the next item, returning the new total.
        It is the loop-with-an-accumulator from the last lesson, packaged up.</p>
        <p>These can be written more briefly with arrow functions:
        <code>numbers.map(n =&gt; n * 2)</code>. Same thing, less typing: parameters, an arrow,
        and an expression whose value is returned automatically.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "arrays-1",
      title: "Reach into a list",
      prompt: `
        <p>Given the array of planets provided, create three variables:</p>
        <ul>
          <li><code>first</code> — the first planet</li>
          <li><code>last</code> — the last planet, worked out from the array's length rather
          than typed as a number</li>
          <li><code>count</code> — how many planets there are</li>
        </ul>
        <p>Your code must still be correct if a planet is added to the list.</p>
      `,
      starter: "const planets = [\"Mercury\", \"Venus\", \"Earth\", \"Mars\"];\n\n// first, last and count go here\n",
      solution: "const planets = [\"Mercury\", \"Venus\", \"Earth\", \"Mars\"];\n\nconst first = planets[0];\nconst last = planets[planets.length - 1];\nconst count = planets.length;\n",
      hints: [
        "The first item is always at position 0.",
        "The last position is length - 1, because counting started at zero.",
        "count needs no calculation at all — .length is the answer.",
      ],
      tests: [
        { name: "first is Mercury", code: `assert.declared(() => first, "first"); assert.equal(first, "Mercury");` },
        { name: "last is Mars", code: `assert.declared(() => last, "last"); assert.equal(last, "Mars");` },
        { name: "count is 4", code: `assert.declared(() => count, "count"); assert.equal(count, 4);` },
        {
          name: "last is derived from the length, not hard-coded",
          code: `assert.ok(/last\\s*=\\s*planets\\s*\\[[^\\]]*length/.test(__SOURCE), "Work the last position out from planets.length rather than writing planets[3].");`,
        },
      ],
    },
    {
      id: "arrays-2",
      title: "Average a list of numbers",
      prompt: `
        <p>Write <code>average(numbers)</code> returning the mean of the array.</p>
        <p><code>average([2, 4, 6])</code> is <code>4</code>.</p>
        <p>Decide what an empty array should give before you write the code. Dividing by zero
        gives <code>NaN</code> — "not a number" — which will spread through every calculation
        that touches it. Return <code>0</code> for an empty array instead.</p>
      `,
      starter: "function average(numbers) {\n  \n}\n",
      solution: "function average(numbers) {\n  if (numbers.length === 0) return 0;\n\n  let total = 0;\n  for (const n of numbers) {\n    total = total + n;\n  }\n  return total / numbers.length;\n}\n",
      hints: [
        "Handle the empty array first and return 0 straight away.",
        "Add everything up with a loop (or reduce), then divide by how many there were.",
        "Divide by numbers.length, not by a number you typed in.",
      ],
      tests: [
        { name: "average is a function", code: `assert.declared(() => average, "average"); assert.type(average, "function");` },
        { name: "average([2, 4, 6]) is 4", code: `assert.close(average([2, 4, 6]), 4);` },
        { name: "average([10]) is 10", code: `assert.close(average([10]), 10);` },
        { name: "it handles decimals", code: `assert.close(average([1, 2]), 1.5);` },
        { name: "average([]) is 0, not NaN", code: `assert.equal(average([]), 0);` },
        { name: "it works with negatives", code: `assert.close(average([-4, 4]), 0);` },
      ],
    },
    {
      id: "arrays-3",
      title: "Select, then transform",
      prompt: `
        <p>Write <code>passingNames(students)</code>. Each student is an array of two items:
        a name and a score, like <code>["Ana", 88]</code>.</p>
        <p>Return an array of just the <strong>names</strong> of students who scored
        <strong>50 or more</strong>, in their original order.</p>
        <pre class="sample"><code>passingNames([["Ana", 88], ["Bo", 41], ["Chi", 50]])
// ["Ana", "Chi"]</code></pre>
        <p>Two steps: keep the ones that qualify, then turn each survivor into just its name.
        <code>filter</code> then <code>map</code> does it in one line, but a loop with
        <code>push</code> is equally correct.</p>
      `,
      starter: "function passingNames(students) {\n  \n}\n",
      solution: "function passingNames(students) {\n  const passing = students.filter(function (student) {\n    return student[1] >= 50;\n  });\n  return passing.map(function (student) {\n    return student[0];\n  });\n}\n",
      hints: [
        "For a student, student[0] is the name and student[1] is the score.",
        "50 exactly counts as passing, so the test is >= 50.",
        "With a loop: start with an empty array, push the name when the score qualifies, return it at the end.",
      ],
      tests: [
        { name: "passingNames is a function", code: `assert.declared(() => passingNames, "passingNames"); assert.type(passingNames, "function");` },
        {
          name: "picks out the passing names",
          code: `assert.deepEqual(passingNames([["Ana", 88], ["Bo", 41], ["Chi", 50]]), ["Ana", "Chi"]);`,
        },
        { name: "exactly 50 passes", code: `assert.deepEqual(passingNames([["Zed", 50]]), ["Zed"]);` },
        { name: "49 does not", code: `assert.deepEqual(passingNames([["Zed", 49]]), []);` },
        { name: "an empty list gives an empty list", code: `assert.deepEqual(passingNames([]), []);` },
        { name: "order is preserved", code: `assert.deepEqual(passingNames([["A", 90], ["B", 10], ["C", 70], ["D", 60]]), ["A", "C", "D"]);` },
        {
          name: "the original array is not modified",
          code: `const input = [["Ana", 88], ["Bo", 41]]; passingNames(input); assert.deepEqual(input, [["Ana", 88], ["Bo", 41]]);`,
        },
      ],
    },
  ],
};
