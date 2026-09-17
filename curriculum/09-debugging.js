export default {
  id: "09-debugging",
  title: "Debugging & Errors",
  summary: "What to do when it does not work — which is most of the time, for everyone.",
  minutes: 14,
  sections: [
    {
      heading: "Broken code is the normal state",
      body: `
        <p>Experienced programmers do not write working code first time. They write code that
        is wrong in ways they can find quickly. The skill is not avoiding bugs — it is
        narrowing down where one lives, fast.</p>
      `,
    },
    {
      heading: "Read the error",
      body: `
        <p>An error message is not the computer complaining. It is the most specific help you
        will get all day, and beginners routinely skip past it.</p>
        <ul>
          <li><strong>SyntaxError</strong> — the code could not even be read. A missing bracket,
          brace or quote. Nothing ran at all. Look at the line reported <em>and the one above
          it</em>, since an unclosed bracket is usually noticed late.</li>
          <li><strong>ReferenceError: x is not defined</strong> — you used a name that does not
          exist here. A typo, or a variable declared inside a different set of braces.</li>
          <li><strong>TypeError: x.foo is not a function</strong> — the value is not the kind of
          thing you assumed. Often a misspelled method, or a variable holding
          <code>undefined</code> because something earlier returned nothing.</li>
          <li><strong>TypeError: Cannot read properties of undefined</strong> — you reached into
          something that is not there: an array position past the end, or a key that does not exist.</li>
        </ul>
      `,
    },
    {
      heading: "The silent bugs",
      body: `
        <p>Worse than an error is code that runs happily and gives a wrong answer. Four causes
        account for most of them:</p>
        <ul>
          <li><strong>Off-by-one</strong> — <code>&lt;=</code> where <code>&lt;</code> belonged,
          starting at 1 instead of 0, forgetting that the last position is
          <code>length - 1</code>.</li>
          <li><strong>Type confusion</strong> — <code>"5" + 1</code> is <code>"51"</code>.
          Anything from a text box is a string until you convert it with <code>Number(...)</code>.</li>
          <li><strong>A missing <code>return</code></strong> — the function computes the right
          answer and throws it away, so the caller gets <code>undefined</code>.</li>
          <li><strong>Scope</strong> — declaring the accumulator inside the loop, so it resets
          on every pass.</li>
        </ul>
      `,
    },
    {
      heading: "How to actually find it",
      body: `
        <ol>
          <li><strong>Reproduce it.</strong> Find the smallest input that shows the problem. A
          bug you can trigger on demand is half solved.</li>
          <li><strong>Print things.</strong> <code>console.log</code> the values just before the
          line you suspect. Label them: <code>console.log("total so far:", total)</code>.
          Watching a variable change is often enough on its own.</li>
          <li><strong>Bisect.</strong> Is the value right halfway through? That tells you which
          half to look at. Repeat. Ten lines becomes one line in three or four steps.</li>
          <li><strong>Check your assumptions.</strong> The bug is almost always in the line you
          were most confident about. Print the thing you are sure of and be wrong about it.</li>
          <li><strong>Test the edges.</strong> Empty string, empty array, zero, negatives, one
          item, the first and last positions. Bugs cluster at boundaries.</li>
        </ol>
        <p>And when you are truly stuck, explain the code out loud, line by line, to someone
        else — or to a rubber duck. Saying "and then this returns the total" and noticing that
        it does not is such a reliable technique that it has a name: rubber duck debugging.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "debug-1",
      title: "Off by one",
      prompt: `
        <p><code>lastCharacter(text)</code> is supposed to return the final character of a
        string, but it returns <code>undefined</code> every time.</p>
        <p>Find the reason and fix it. Change as little as possible.</p>
        <p><em>Empty text should give an empty string — that part already works, and your fix
        must not break it.</em></p>
      `,
      starter: "function lastCharacter(text) {\n  if (text.length === 0) return \"\";\n  return text[text.length];\n}\n",
      solution: "function lastCharacter(text) {\n  if (text.length === 0) return \"\";\n  return text[text.length - 1];\n}\n",
      hints: [
        'For "cat", what is text.length? And what is the highest position that actually exists?',
        "Positions run from 0 to length - 1, so position `length` is one past the end.",
        "Subtract one: return text[text.length - 1];",
      ],
      tests: [
        { name: 'lastCharacter("cat") is "t"', code: `assert.equal(lastCharacter("cat"), "t");` },
        { name: 'lastCharacter("a") is "a"', code: `assert.equal(lastCharacter("a"), "a");` },
        { name: "empty text gives an empty string", code: `assert.equal(lastCharacter(""), "");` },
        { name: "it works on longer text", code: `assert.equal(lastCharacter("debugging"), "g");` },
      ],
    },
    {
      id: "debug-2",
      title: "The wrong kind of value",
      prompt: `
        <p><code>totalPrice</code> takes prices that arrived from a web form, so they are
        <strong>strings</strong>. It is meant to add them up, but
        <code>totalPrice(["10", "5"])</code> returns <code>"0105"</code> instead of
        <code>15</code>.</p>
        <p>Fix it so it returns a proper number.</p>
        <p><code>Number("10")</code> converts a string to the number <code>10</code>.</p>
      `,
      starter: "function totalPrice(prices) {\n  let total = 0;\n  for (const price of prices) {\n    total = total + price;\n  }\n  return total;\n}\n",
      solution: "function totalPrice(prices) {\n  let total = 0;\n  for (const price of prices) {\n    total = total + Number(price);\n  }\n  return total;\n}\n",
      hints: [
        "With strings, + joins instead of adding — that is where 0105 comes from.",
        "Convert each price to a number before adding it.",
        "total = total + Number(price);",
      ],
      tests: [
        { name: 'totalPrice(["10", "5"]) is 15', code: `assert.equal(totalPrice(["10", "5"]), 15);` },
        { name: "the result is a number, not a string", code: `assert.type(totalPrice(["10", "5"]), "number");` },
        { name: "an empty list totals 0", code: `assert.equal(totalPrice([]), 0);` },
        { name: "decimals work too", code: `assert.close(totalPrice(["1.5", "2.25"]), 3.75);` },
        { name: "it still works on real numbers", code: `assert.equal(totalPrice([1, 2, 3]), 6);` },
      ],
    },
    {
      id: "debug-3",
      title: "Two bugs at once",
      prompt: `
        <p><code>longestWord(sentence)</code> should return the longest word in a sentence.
        It has <strong>two</strong> separate bugs:</p>
        <ul>
          <li>It returns after looking at the very first word.</li>
          <li>The accumulator is reset on every pass through the loop.</li>
        </ul>
        <p>Fix both. If several words tie for longest, return the first of them.</p>
      `,
      starter: "function longestWord(sentence) {\n  const words = sentence.split(\" \");\n  for (const word of words) {\n    let longest = \"\";\n    if (word.length > longest.length) {\n      longest = word;\n    }\n    return longest;\n  }\n}\n",
      solution: "function longestWord(sentence) {\n  const words = sentence.split(\" \");\n  let longest = \"\";\n  for (const word of words) {\n    if (word.length > longest.length) {\n      longest = word;\n    }\n  }\n  return longest;\n}\n",
      hints: [
        "A variable that has to survive the whole loop must be declared before the loop starts.",
        "The return belongs after the loop, so every word gets a chance to be examined.",
        "Using > (not >=) when comparing lengths is what keeps the first of several ties.",
      ],
      tests: [
        { name: "longestWord is a function", code: `assert.declared(() => longestWord, "longestWord"); assert.type(longestWord, "function");` },
        { name: "finds the longest word", code: `assert.equal(longestWord("the quick brown foxes"), "quick");` },
        { name: "the longest can be last", code: `assert.equal(longestWord("a bb ccc"), "ccc");` },
        { name: "the longest can be first", code: `assert.equal(longestWord("ccc bb a"), "ccc");` },
        { name: "ties keep the first word", code: `assert.equal(longestWord("cat dog"), "cat");` },
        { name: "a single word is returned as is", code: `assert.equal(longestWord("solo"), "solo");` },
        { name: "an empty sentence gives an empty string", code: `assert.equal(longestWord(""), "");` },
      ],
    },
  ],
};
