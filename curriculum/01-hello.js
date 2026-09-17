export default {
  id: "01-hello",
  title: "Hello, Code",
  summary: "What a program actually is, how to make the computer say something, and why order matters.",
  minutes: 10,
  sections: [
    {
      heading: "A program is a list of instructions",
      body: `
        <p>That is the whole idea. A program is a list of instructions, written down in
        an order, that a computer carries out one at a time from top to bottom. It does
        not skip ahead, it does not guess what you meant, and it does not get bored.</p>
        <p>The language you will use here is <strong>JavaScript</strong>. It runs in every
        web browser, which is why this course needs nothing installed. Everything you
        learn — variables, conditions, loops, functions — works the same way in Python,
        Java, Go, and every other language you might learn next. Only the punctuation changes.</p>
      `,
    },
    {
      heading: "Making the computer speak",
      body: `
        <p>The first instruction worth knowing prints something so you can see it:</p>
        <pre class="sample"><code>console.log("Hello, world!");</code></pre>
        <p>Read it left to right. <code>console.log</code> is the name of a built-in
        instruction that means "print this where I can see it". The parentheses hold the
        thing you want printed. The quotation marks say "this is a piece of text, not a
        command". The semicolon ends the statement, like a full stop.</p>
        <p>Text in quotes is called a <strong>string</strong>. The quotes are not part of
        it — <code>"Hello"</code> is five characters, not seven. You can use double quotes
        or single quotes as long as you match them.</p>
      `,
    },
    {
      heading: "Order is everything",
      body: `
        <p>These two programs are not the same:</p>
        <pre class="sample"><code>console.log("Good morning");
console.log("Good night");</code></pre>
        <pre class="sample"><code>console.log("Good night");
console.log("Good morning");</code></pre>
        <p>Both are valid. Both run. One of them is wrong, and the computer has no opinion
        about which. This is the part beginners underestimate: the machine does exactly what
        you wrote, which is not always what you meant. Most of programming is closing that gap.</p>
      `,
    },
    {
      heading: "Notes to humans",
      body: `
        <p>Anything after <code>//</code> on a line is a <strong>comment</strong>. The
        computer ignores it completely; it is there for the next person to read your code,
        who is very often you in three weeks.</p>
        <pre class="sample"><code>// Greet the customer by name
console.log("Welcome back!");</code></pre>
        <p>Good comments explain <em>why</em>, not <em>what</em>. A comment saying
        "print a greeting" above a line that prints a greeting is noise.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "hello-1",
      title: "Your first line",
      prompt: `
        <p>Print the exact text <code>Hello, world!</code> — capital H, a comma, a space,
        and an exclamation mark.</p>
        <p>Every programmer alive has written this line. Yours is now one of them.</p>
      `,
      starter: `// Replace this comment with your code.\n`,
      solution: `console.log("Hello, world!");\n`,
      hints: [
        "Use console.log(...) with your text inside the parentheses.",
        "The text has to be inside quotation marks, or JavaScript will think it is a command.",
        'The whole line is: console.log("Hello, world!");',
      ],
      tests: [
        { name: "prints exactly one line", code: `assert.printedCount(1);` },
        { name: 'the line is "Hello, world!"', code: `assert.printedLines(["Hello, world!"]);` },
      ],
    },
    {
      id: "hello-2",
      title: "Three lines, in order",
      prompt: `
        <p>Print these three lines, in this order:</p>
        <pre class="sample"><code>Ada Lovelace
1815
She wrote the first algorithm.</code></pre>
        <p>One <code>console.log</code> per line. Notice that the year has no quotes around
        it in the expected output — but you can still print it as text for now.</p>
      `,
      starter: `console.log("Ada Lovelace");\n// Two more lines to go.\n`,
      solution: `console.log("Ada Lovelace");\nconsole.log(1815);\nconsole.log("She wrote the first algorithm.");\n`,
      hints: [
        "Three separate console.log statements, each on its own line.",
        "They run top to bottom, so write them in the order you want them to appear.",
        "Numbers do not need quotes: console.log(1815) works.",
      ],
      tests: [
        { name: "prints three lines", code: `assert.printedCount(3);` },
        {
          name: "the lines are correct and in order",
          code: `assert.printedLines(["Ada Lovelace", "1815", "She wrote the first algorithm."]);`,
        },
      ],
    },
    {
      id: "hello-3",
      title: "Fix the broken program",
      prompt: `
        <p>The program below is meant to print a two-line countdown:</p>
        <pre class="sample"><code>Ready?
Go!</code></pre>
        <p>It does not. There are two problems: the lines come out in the wrong order, and
        one of them is missing its quotation marks. Fix both.</p>
        <p>Reading broken code and working out what is wrong is not a detour from
        programming — it is most of the job.</p>
      `,
      starter: `console.log(Go!);\nconsole.log("Ready?");\n`,
      solution: `console.log("Ready?");\nconsole.log("Go!");\n`,
      hints: [
        "Which line should the computer reach first? Put that one first.",
        'Go! is text, so it needs quotes around it: "Go!"',
        'The finished program is console.log("Ready?"); then console.log("Go!");',
      ],
      tests: [
        { name: "prints two lines", code: `assert.printedCount(2);` },
        { name: "prints Ready? then Go!", code: `assert.printedLines(["Ready?", "Go!"]);` },
      ],
    },
  ],
};
