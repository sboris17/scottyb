export default {
  id: "06-functions",
  title: "Functions",
  summary: "Packaging a piece of work under a name so you can use it anywhere, and trust it everywhere.",
  minutes: 15,
  sections: [
    {
      heading: "Naming a piece of work",
      body: `
        <p>A <strong>function</strong> is a named block of instructions that you can run
        whenever you like, with different inputs each time.</p>
        <pre class="sample"><code>function greet(name) {
  return "Hello, " + name + "!";
}

console.log(greet("Yusuf"));   // Hello, Yusuf!
console.log(greet("Mei"));     // Hello, Mei!</code></pre>
        <p>Three parts to notice:</p>
        <ul>
          <li><strong>Definition</strong> — <code>function greet(name) { ... }</code> describes
          the work but does not do it. Defining a function runs nothing.</li>
          <li><strong>Parameter</strong> — <code>name</code> is a placeholder. It gets its value
          when the function is called, and it exists only inside the braces.</li>
          <li><strong>Call</strong> — <code>greet("Yusuf")</code> actually runs it. The
          parentheses are what make it happen; <code>greet</code> on its own is just the
          function itself, sitting there unused.</li>
        </ul>
      `,
    },
    {
      heading: "return is not print",
      body: `
        <p>This is the single biggest stumbling block in this lesson, so it is worth being blunt:</p>
        <ul>
          <li><code>console.log(x)</code> shows <code>x</code> to a human. The program cannot
          use what was shown.</li>
          <li><code>return x</code> hands <code>x</code> back to whatever called the function,
          so the program can carry on working with it.</li>
        </ul>
        <pre class="sample"><code>function doubleBad(n) { console.log(n * 2); }
function doubleGood(n) { return n * 2; }

const a = doubleBad(5);    // prints 10, but a is undefined
const b = doubleGood(5);   // prints nothing, but b is 10
console.log(b + 1);        // 11 — you can keep computing</code></pre>
        <p>A function with no <code>return</code> gives back <code>undefined</code>. When a
        test says it expected <code>3</code> and got <code>undefined</code>, a missing
        <code>return</code> is the first thing to check.</p>
        <p><code>return</code> also ends the function immediately. Anything written after it
        never runs.</p>
      `,
    },
    {
      heading: "Several parameters, and defaults",
      body: `
        <pre class="sample"><code>function rectangleArea(width, height) {
  return width * height;
}
console.log(rectangleArea(3, 4));   // 12</code></pre>
        <p>Arguments are matched by <strong>position</strong>, not by name: the first value goes
        to the first parameter. <code>rectangleArea(4, 3)</code> passes 4 as the width.</p>
        <p>A parameter can have a default for when the caller leaves it out:</p>
        <pre class="sample"><code>function priceAfterDiscount(price, percentOff = 10) {
  return price - price * (percentOff / 100);
}
console.log(priceAfterDiscount(200));       // 180 — uses the default
console.log(priceAfterDiscount(200, 25));   // 150</code></pre>
      `,
    },
    {
      heading: "Scope: what is visible where",
      body: `
        <p>Variables declared inside a function exist only inside it. Outside, the name is not
        merely empty — it does not exist at all:</p>
        <pre class="sample"><code>function tally() {
  const secret = 42;
  return secret;
}
console.log(secret);   // ReferenceError: secret is not defined</code></pre>
        <p>This is a feature. It means you can name a variable <code>total</code> inside a
        function without wondering whether some other part of the program already uses that
        name. Each function gets a clean desk.</p>
      `,
    },
    {
      heading: "Small functions, combined",
      body: `
        <p>Functions can call other functions, and that is how real programs are built: small
        pieces that each do one thing, assembled into bigger ones.</p>
        <pre class="sample"><code>function isVowel(character) {
  return "aeiou".includes(character.toLowerCase());
}

function countVowels(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (isVowel(text[i])) count++;
  }
  return count;
}</code></pre>
        <p>Compare that with the version you wrote in the last lesson. The logic is the same,
        but now "is this a vowel" has a name, can be tested on its own, and can be reused. When
        a function starts feeling hard to hold in your head, that is the signal to pull a piece
        of it out and give it a name.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "functions-1",
      title: "Return, do not print",
      prompt: `
        <p>Both functions below are broken in the same way: they print their answer instead of
        returning it, so nothing else in the program can use the result.</p>
        <p>Fix both.</p>
      `,
      starter: "function triple(n) {\n  console.log(n * 3);\n}\n\nfunction fullName(first, last) {\n  console.log(first + \" \" + last);\n}\n",
      solution: "function triple(n) {\n  return n * 3;\n}\n\nfunction fullName(first, last) {\n  return first + \" \" + last;\n}\n",
      hints: [
        "Replace console.log(...) with return ... in each function.",
        "Keep the calculation exactly as it is — only the way the answer leaves the function changes.",
        'triple becomes return n * 3; and fullName becomes return first + " " + last;',
      ],
      tests: [
        { name: "triple(5) returns 15", code: `assert.equal(triple(5), 15);` },
        { name: "triple(0) returns 0", code: `assert.equal(triple(0), 0);` },
        { name: 'fullName("Ada", "Lovelace") returns "Ada Lovelace"', code: `assert.equal(fullName("Ada", "Lovelace"), "Ada Lovelace");` },
        { name: "the results can be used in further calculations", code: `assert.equal(triple(2) + triple(3), 15);` },
        { name: "nothing is printed", code: `assert.printedCount(0);` },
      ],
    },
    {
      id: "functions-2",
      title: "A default parameter",
      prompt: `
        <p>Write <code>applyTax(amount, ratePercent)</code> that returns the amount with tax
        added. When the caller does not say what the rate is, use <strong>20</strong>.</p>
        <p>So <code>applyTax(100)</code> is <code>120</code>, and <code>applyTax(100, 5)</code>
        is <code>105</code>.</p>
      `,
      starter: "function applyTax(amount, ratePercent) {\n  \n}\n",
      solution: "function applyTax(amount, ratePercent = 20) {\n  return amount + amount * (ratePercent / 100);\n}\n",
      hints: [
        "The default goes in the parameter list itself: function applyTax(amount, ratePercent = 20)",
        "A percentage becomes a fraction by dividing by 100.",
        "return amount + amount * (ratePercent / 100);",
      ],
      tests: [
        { name: "applyTax is a function", code: `assert.declared(() => applyTax, "applyTax"); assert.type(applyTax, "function");` },
        { name: "applyTax(100, 5) is 105", code: `assert.close(applyTax(100, 5), 105);` },
        { name: "applyTax(100) uses the 20% default", code: `assert.close(applyTax(100), 120);` },
        { name: "applyTax(50) is 60", code: `assert.close(applyTax(50), 60);` },
        { name: "a rate of 0 adds nothing", code: `assert.close(applyTax(80, 0), 80);` },
      ],
    },
    {
      id: "functions-3",
      title: "Build one function out of another",
      prompt: `
        <p>Write two functions:</p>
        <ul>
          <li><code>reverse(text)</code> — returns the text backwards, so
          <code>reverse("abc")</code> is <code>"cba"</code>.</li>
          <li><code>isPalindrome(text)</code> — returns <code>true</code> when the text reads
          the same backwards, ignoring capitals and spaces. So <code>"Never odd or even"</code>
          is a palindrome.</li>
        </ul>
        <p><code>isPalindrome</code> must call <code>reverse</code> rather than repeating its
        logic. Strip the spaces and lower-case the text before comparing.</p>
      `,
      starter: "function reverse(text) {\n  \n}\n\nfunction isPalindrome(text) {\n  // Tidy the text, then compare it with its reverse.\n}\n",
      solution: "function reverse(text) {\n  let result = \"\";\n  for (let i = text.length - 1; i >= 0; i--) {\n    result = result + text[i];\n  }\n  return result;\n}\n\nfunction isPalindrome(text) {\n  const cleaned = text.toLowerCase().split(\" \").join(\"\");\n  return cleaned === reverse(cleaned);\n}\n",
      hints: [
        "To reverse, build up a new string by looping from the last position back to 0.",
        'To remove every space: text.split(" ").join("") — break it apart on spaces, then glue it back with nothing between.',
        "Then isPalindrome is a single comparison: cleaned === reverse(cleaned).",
      ],
      tests: [
        { name: "reverse is a function", code: `assert.declared(() => reverse, "reverse"); assert.type(reverse, "function");` },
        { name: 'reverse("abc") is "cba"', code: `assert.equal(reverse("abc"), "cba");` },
        { name: "reverse of an empty string is empty", code: `assert.equal(reverse(""), "");` },
        { name: "isPalindrome is a function", code: `assert.declared(() => isPalindrome, "isPalindrome"); assert.type(isPalindrome, "function");` },
        { name: '"racecar" is a palindrome', code: `assert.equal(isPalindrome("racecar"), true);` },
        { name: '"hello" is not', code: `assert.equal(isPalindrome("hello"), false);` },
        { name: '"Never odd or even" is, ignoring case and spaces', code: `assert.equal(isPalindrome("Never odd or even"), true);` },
        {
          name: "isPalindrome calls reverse",
          code: `assert.ok(/reverse\\s*\\(/.test(__SOURCE.split("function isPalindrome")[1] || ""), "Call reverse() from inside isPalindrome instead of repeating the logic.");`,
        },
      ],
    },
  ],
};
