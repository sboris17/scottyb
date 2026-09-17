export default {
  id: "05-loops",
  title: "Loops & Repetition",
  summary: "Doing something many times without writing it many times.",
  minutes: 14,
  sections: [
    {
      heading: "Why loops",
      body: `
        <p>Printing 1 to 5 by hand is tedious. Printing 1 to 10,000 by hand is impossible.
        A <strong>loop</strong> writes the instruction once and repeats it.</p>
        <p>Every loop needs three things, and forgetting any one of them is the classic bug:
        a <strong>starting point</strong>, a <strong>condition to keep going</strong>, and a
        <strong>change</strong> that eventually makes the condition false.</p>
      `,
    },
    {
      heading: "while",
      body: `
        <p><code>while</code> puts all three in plain sight:</p>
        <pre class="sample"><code>let count = 1;            // start
while (count <= 5) {      // keep going while this is true
  console.log(count);
  count = count + 1;      // change
}</code></pre>
        <p>Delete that last line and <code>count</code> stays 1 forever, the condition stays
        true forever, and the program never stops. This course cuts your code off after a few
        seconds if that happens — outside the course, your browser tab simply freezes.</p>
      `,
    },
    {
      heading: "for",
      body: `
        <p>Because that pattern is so common, <code>for</code> packs the three parts onto one
        line, separated by semicolons:</p>
        <pre class="sample"><code>for (let i = 1; i <= 5; i++) {
  console.log(i);
}</code></pre>
        <p>Read it as: <em>start with i at 1; keep going while i is at most 5; after each
        pass, add one to i</em>. <code>i++</code> is shorthand for <code>i = i + 1</code>.</p>
        <p>The name <code>i</code> is a convention, short for index. Counting from
        <code>0</code> while <code>i &lt; n</code> is even more common, because that matches
        how positions in text and lists are numbered:</p>
        <pre class="sample"><code>const word = "code";
for (let i = 0; i < word.length; i++) {
  console.log(word[i]);   // c, o, d, e
}</code></pre>
        <p>Note <code>&lt;</code> rather than <code>&lt;=</code> there. With
        <code>&lt;=</code> the loop runs one time too many and reads a position that does not
        exist. This is the <strong>off-by-one error</strong>, and it will find you sooner or later.</p>
      `,
    },
    {
      heading: "Accumulating a result",
      body: `
        <p>Loops are rarely just for printing. The common shape is: set up a variable before
        the loop, update it inside, use it after.</p>
        <pre class="sample"><code>let total = 0;
for (let i = 1; i <= 4; i++) {
  total = total + i;
}
console.log(total);   // 10</code></pre>
        <p><code>total</code> must be declared <em>outside</em> the loop. Declare it inside and
        it is created fresh on every pass, forgetting everything, and you end up with just the
        last value.</p>
      `,
    },
    {
      heading: "break and continue",
      body: `
        <p><code>break</code> leaves the loop immediately. <code>continue</code> skips the rest
        of this pass and starts the next one.</p>
        <pre class="sample"><code>for (let i = 1; i <= 10; i++) {
  if (i % 3 === 0) continue;   // skip multiples of three
  if (i > 7) break;            // stop entirely past seven
  console.log(i);              // 1, 2, 4, 5, 7
}</code></pre>
        <p>Both are useful and both can make a loop hard to follow. Use them when they make
        the intent clearer, not to be clever.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "loops-1",
      title: "Countdown",
      prompt: `
        <p>Print a countdown from 5 down to 1, one number per line, then the word
        <code>Liftoff!</code> on its own line at the end.</p>
        <p>Six lines in total. Use a loop — do not write six <code>console.log</code> lines.</p>
      `,
      starter: "// Count down from 5, then print Liftoff!\n",
      solution: "for (let i = 5; i >= 1; i = i - 1) {\n  console.log(i);\n}\nconsole.log(\"Liftoff!\");\n",
      hints: [
        "To count down, start high and subtract instead of adding.",
        "The condition keeps the loop alive while i is still at least 1: i >= 1.",
        "Liftoff! is printed after the loop finishes, so that line goes outside the braces.",
      ],
      tests: [
        { name: "prints six lines", code: `assert.printedCount(6);` },
        { name: "counts 5 down to 1 then lifts off", code: `assert.printedLines(["5", "4", "3", "2", "1", "Liftoff!"]);` },
        {
          name: "uses a loop",
          code: `assert.ok(/\\b(for|while)\\b/.test(__SOURCE), "Use a for or while loop rather than repeating console.log.");`,
        },
      ],
    },
    {
      id: "loops-2",
      title: "Add them up",
      prompt: `
        <p>Write <code>sumTo(n)</code> that returns the total of every whole number from 1 to
        <code>n</code>. So <code>sumTo(4)</code> is <code>1 + 2 + 3 + 4</code>, which is
        <code>10</code>.</p>
        <p>Think about <code>sumTo(0)</code> before you finish: there are no numbers to add,
        so the answer is <code>0</code>. A loop that never runs gives you that for free —
        as long as your starting total is right.</p>
      `,
      starter: "function sumTo(n) {\n  \n}\n",
      solution: "function sumTo(n) {\n  let total = 0;\n  for (let i = 1; i <= n; i++) {\n    total = total + i;\n  }\n  return total;\n}\n",
      hints: [
        "Declare the running total before the loop, starting at 0.",
        "Loop from 1 up to and including n, so the condition is i <= n.",
        "Return the total after the loop, not inside it — returning inside stops after the first pass.",
      ],
      tests: [
        { name: "sumTo is a function", code: `assert.declared(() => sumTo, "sumTo"); assert.type(sumTo, "function");` },
        { name: "sumTo(4) is 10", code: `assert.equal(sumTo(4), 10);` },
        { name: "sumTo(1) is 1", code: `assert.equal(sumTo(1), 1);` },
        { name: "sumTo(0) is 0", code: `assert.equal(sumTo(0), 0);` },
        { name: "sumTo(100) is 5050", code: `assert.equal(sumTo(100), 5050);` },
      ],
    },
    {
      id: "loops-3",
      title: "Count the vowels",
      prompt: `
        <p>Write <code>countVowels(text)</code> that returns how many vowels
        (<code>a e i o u</code>) the text contains. Capital letters count too, so
        <code>countVowels("Education")</code> is <code>5</code>.</p>
        <p>Text with no vowels gives <code>0</code>.</p>
      `,
      starter: "function countVowels(text) {\n  \n}\n",
      solution: "function countVowels(text) {\n  const vowels = \"aeiou\";\n  let count = 0;\n  const lower = text.toLowerCase();\n  for (let i = 0; i < lower.length; i++) {\n    if (vowels.includes(lower[i])) {\n      count = count + 1;\n    }\n  }\n  return count;\n}\n",
      hints: [
        "Lower-case the whole text once at the start and you only have to check five letters, not ten.",
        "Loop over every position: for (let i = 0; i < text.length; i++).",
        'To test one character, ask whether "aeiou" includes it.',
      ],
      tests: [
        { name: "countVowels is a function", code: `assert.declared(() => countVowels, "countVowels"); assert.type(countVowels, "function");` },
        { name: 'countVowels("Education") is 5', code: `assert.equal(countVowels("Education"), 5);` },
        { name: 'countVowels("rhythm") is 0', code: `assert.equal(countVowels("rhythm"), 0);` },
        { name: 'countVowels("") is 0', code: `assert.equal(countVowels(""), 0);` },
        { name: "capitals count", code: `assert.equal(countVowels("AEIOU"), 5);` },
        { name: "spaces and punctuation are not vowels", code: `assert.equal(countVowels("a e, i!"), 3);` },
      ],
    },
  ],
};
