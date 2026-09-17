export default {
  id: "03-strings",
  title: "Strings & Text",
  summary: "Joining, measuring, slicing and reshaping text — the data most programs spend their day on.",
  minutes: 12,
  sections: [
    {
      heading: "Joining text together",
      body: `
        <p>The clumsy way is <code>+</code>:</p>
        <pre class="sample"><code>const name = "Rosa";
console.log("Hello, " + name + "!");   // Hello, Rosa!</code></pre>
        <p>Count the quotes and spaces carefully — the space after the comma is inside the
        string, and leaving it out is the single most common typo in beginner code.</p>
        <p>The better way is a <strong>template literal</strong>: backticks instead of
        quotes, with <code>\${...}</code> marking a slot to fill in.</p>
        <pre class="sample"><code>console.log(\`Hello, \${name}!\`);            // Hello, Rosa!
console.log(\`\${name} has \${3 * 2} points.\`);  // Rosa has 6 points.</code></pre>
        <p>Anything can go in the slot, including arithmetic. Template literals are easier
        to read and much harder to get wrong, so prefer them.</p>
      `,
    },
    {
      heading: "Asking a string about itself",
      body: `
        <p>Every string carries a <code>.length</code>:</p>
        <pre class="sample"><code>console.log("hello".length);   // 5
console.log("".length);        // 0</code></pre>
        <p>And individual characters are reachable by position with <code>[]</code>. Positions
        start at <strong>0</strong>, not 1 — a convention you will meet everywhere:</p>
        <pre class="sample"><code>const word = "code";
console.log(word[0]);   // "c"
console.log(word[3]);   // "e"
console.log(word[word.length - 1]);   // "e" — the last one, whatever the length</code></pre>
        <p>That last line is worth memorising. The final position is always
        <code>length - 1</code>, because counting started at zero.</p>
      `,
    },
    {
      heading: "Methods: instructions a string knows",
      body: `
        <p>A <strong>method</strong> is an instruction attached to a value, called with a dot:</p>
        <pre class="sample"><code>const messy = "  Hello There  ";

console.log(messy.trim());              // "Hello There" — outer spaces gone
console.log(messy.toUpperCase());       // "  HELLO THERE  "
console.log(messy.toLowerCase());       // "  hello there  "
console.log("hello".includes("ell"));   // true
console.log("hello".indexOf("l"));      // 2 — position of the first match
console.log("hello".slice(1, 4));       // "ell" — from 1 up to, not including, 4
console.log("a,b,c".split(","));        // ["a", "b", "c"]
console.log("hi".repeat(3));            // "hihihi"</code></pre>
        <p>One rule underlies all of these: <strong>strings never change</strong>. Each method
        returns a <em>new</em> string and leaves the original untouched. So this does nothing:</p>
        <pre class="sample"><code>let word = "quiet";
word.toUpperCase();          // the result is thrown away
console.log(word);           // still "quiet"

word = word.toUpperCase();   // keep the result
console.log(word);           // "QUIET"</code></pre>
      `,
    },
    {
      heading: "slice, precisely",
      body: `
        <p><code>slice(start, end)</code> takes characters from <code>start</code> up to
        <strong>but not including</strong> <code>end</code>. The gap between the two numbers
        is how many characters you get: <code>slice(1, 4)</code> gives 3 characters.</p>
        <p>Given one argument it runs to the end — <code>"hello".slice(2)</code> is
        <code>"llo"</code> — and a negative number counts back from the end:
        <code>"hello".slice(-2)</code> is <code>"lo"</code>.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "strings-1",
      title: "A proper greeting",
      prompt: `
        <p>Create a variable <code>greeting</code> containing exactly:</p>
        <pre class="sample"><code>Good evening, Mara. You have 3 messages.</code></pre>
        <p>Build it from the variables provided, using a template literal. Nothing should be
        typed in literally that could be read from a variable — change <code>name</code> to
        <code>"Ines"</code> and your line should still produce a correct sentence.</p>
      `,
      starter: "const name = \"Mara\";\nconst messageCount = 3;\n\n// const greeting = ...\n",
      solution: "const name = \"Mara\";\nconst messageCount = 3;\n\nconst greeting = `Good evening, ${name}. You have ${messageCount} messages.`;\n",
      hints: [
        "Wrap the whole sentence in backticks ` rather than quotes.",
        "Each slot looks like ${name} — a dollar sign, braces, and the variable name.",
        "Mind the punctuation: a comma after evening, a full stop after the name, and a full stop at the end.",
      ],
      tests: [
        { name: "greeting exists and is a string", code: `assert.declared(() => greeting, "greeting"); assert.type(greeting, "string");` },
        {
          name: "the sentence is exactly right",
          code: `assert.equal(greeting, "Good evening, Mara. You have 3 messages.");`,
        },
        {
          name: "it is built from the variables, not typed out",
          code: "assert.ok(/[$][{]\\s*name\\s*[}]/.test(__SOURCE) && /[$][{]\\s*messageCount\\s*[}]/.test(__SOURCE), \"Use ${name} and ${messageCount} inside a template literal.\");",
        },
      ],
    },
    {
      id: "strings-2",
      title: "Initials",
      prompt: `
        <p>Write a function <code>initials(fullName)</code> that takes a name like
        <code>"grace hopper"</code> and returns the initials in capitals, separated by a
        full stop and joined up: <code>"G.H"</code>.</p>
        <p>You can assume exactly two words separated by one space.</p>
        <p><em>Functions get a lesson of their own shortly. For now: the code between the
        braces runs when the function is called, and <code>return</code> hands a value back.</em></p>
      `,
      starter: "function initials(fullName) {\n  // Split the name, take the first letter of each part,\n  // upper-case them, and join with a full stop.\n}\n",
      solution: "function initials(fullName) {\n  const parts = fullName.split(\" \");\n  const first = parts[0][0].toUpperCase();\n  const last = parts[1][0].toUpperCase();\n  return `${first}.${last}`;\n}\n",
      hints: [
        'fullName.split(" ") gives you an array of the two words.',
        "The first character of a word is word[0]; remember positions start at 0.",
        "toUpperCase() returns a new string — you have to use its result.",
      ],
      tests: [
        { name: "initials is a function", code: `assert.declared(() => initials, "initials"); assert.type(initials, "function");` },
        { name: 'initials("grace hopper") is "G.H"', code: `assert.equal(initials("grace hopper"), "G.H");` },
        { name: 'initials("ada lovelace") is "A.L"', code: `assert.equal(initials("ada lovelace"), "A.L");` },
        { name: "it works on names that are already capitalised", code: `assert.equal(initials("Alan Turing"), "A.T");` },
      ],
    },
    {
      id: "strings-3",
      title: "Tidy up the input",
      prompt: `
        <p>Real input is messy. Users type stray spaces and random capitals.</p>
        <p>Write <code>normalise(text)</code> that returns the text with surrounding
        whitespace removed and everything in lower case, so that
        <code>normalise("  HeLLo  ")</code> gives <code>"hello"</code>.</p>
        <p>Then write <code>isEmpty(text)</code> that returns <code>true</code> when the text
        is nothing but whitespace (or empty), and <code>false</code> otherwise.</p>
      `,
      starter: "function normalise(text) {\n  \n}\n\nfunction isEmpty(text) {\n  \n}\n",
      solution: "function normalise(text) {\n  return text.trim().toLowerCase();\n}\n\nfunction isEmpty(text) {\n  return text.trim().length === 0;\n}\n",
      hints: [
        "Methods can be chained: text.trim().toLowerCase() trims first, then lower-cases the result.",
        "For isEmpty, trim the text and then look at its .length.",
        "A length of 0 means empty: return text.trim().length === 0;",
      ],
      tests: [
        { name: "normalise trims and lower-cases", code: `assert.equal(normalise("  HeLLo  "), "hello");` },
        { name: "normalise leaves clean text alone", code: `assert.equal(normalise("ok"), "ok");` },
        { name: "normalise handles inner spaces", code: `assert.equal(normalise("  Two Words "), "two words");` },
        { name: "isEmpty is true for spaces only", code: `assert.equal(isEmpty("   "), true);` },
        { name: "isEmpty is true for an empty string", code: `assert.equal(isEmpty(""), true);` },
        { name: "isEmpty is false for real text", code: `assert.equal(isEmpty(" hi "), false);` },
      ],
    },
  ],
};
