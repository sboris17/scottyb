export default {
  id: "04-logic",
  title: "Logic: IF and friends",
  summary: "Making a cell decide for itself — IF, IFS, AND, OR, and catching errors before they spread.",
  minutes: 15,
  sections: [
    {
      heading: "IF",
      body: `
        <p><code>IF</code> takes three arguments: a question, what to do when the answer is
        yes, and what to do when it is no.</p>
        <pre class="sample"><code>=IF(B2>=50, "Pass", "Fail")</code></pre>
        <p>The question has to be something that comes out true or false. The comparisons
        available are <code>=</code>, <code>&lt;&gt;</code> (not equal), <code>&lt;</code>,
        <code>&gt;</code>, <code>&lt;=</code> and <code>&gt;=</code>.</p>
        <p>The two results can be anything — text, a number, or another calculation:</p>
        <pre class="sample"><code>=IF(B2>100, B2*0.9, B2)          a discount over 100
=IF(C2="", "Missing", C2)        a placeholder for blanks</code></pre>
        <p>Note <code>C2=""</code> for "is this cell empty". <code>ISBLANK(C2)</code> says
        the same thing more clearly, and is worth preferring.</p>
      `,
    },
    {
      heading: "More than two outcomes",
      body: `
        <p>Nesting IFs inside each other works and is how it was done for years:</p>
        <pre class="sample"><code>=IF(B2>=90,"A",IF(B2>=80,"B",IF(B2>=70,"C","D")))</code></pre>
        <p>It is also where an afternoon disappears counting brackets. <code>IFS</code>
        does the same job as a flat list of condition-and-result pairs:</p>
        <pre class="sample"><code>=IFS(B2>=90,"A", B2>=80,"B", B2>=70,"C", TRUE,"D")</code></pre>
        <p>Conditions are tested top to bottom and <strong>the first true one wins</strong>,
        so order matters: put <code>B2>=90</code> before <code>B2>=70</code> or every high
        score comes out as a C. The final <code>TRUE</code> is a catch-all that is always
        true, which is how you supply a default — without it, a score of 65 gives
        <code>#N/A</code>.</p>
      `,
    },
    {
      heading: "AND, OR, NOT",
      body: `
        <p>When a decision depends on more than one thing:</p>
        <pre class="sample"><code>=IF(AND(B2>=50, C2="submitted"), "Pass", "Fail")
=IF(OR(B2>=90, C2="distinction"), "Honours", "")
=IF(NOT(ISBLANK(B2)), "Received", "Waiting")</code></pre>
        <p><code>AND</code> needs everything to be true; <code>OR</code> needs at least one.
        Both take as many arguments as you like.</p>
        <p>Watch the shape: it is <code>AND(B2>=50, C2="x")</code>, with two complete
        comparisons. Writing <code>AND(B2>=50, "x")</code> does not compare anything to C2 —
        a very common slip.</p>
      `,
    },
    {
      heading: "IFERROR",
      body: `
        <p>Errors spread. One <code>#DIV/0!</code> in a column makes the total
        <code>#DIV/0!</code> too, and a dashboard full of red.</p>
        <pre class="sample"><code>=IFERROR(B2/C2, 0)
=IFERROR(VLOOKUP(A2,Prices!A:B,2,FALSE), "Not listed")</code></pre>
        <p><code>IFERROR</code> gives the first argument's value unless it is an error, in
        which case it gives the second. Used well it turns an expected gap into a sensible
        blank. Used carelessly it hides real mistakes — wrapping everything in
        <code>IFERROR(..., 0)</code> means you will never find out that your lookup range
        was wrong. Only catch errors you are expecting.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "logic-1",
      title: "Pass or fail",
      prompt: `
        <p>Column C should say <code>Pass</code> when the score in column B is
        <strong>50 or more</strong>, and <code>Fail</code> otherwise.</p>
        <p>Write it in <strong>C2</strong>; the column fills down.</p>
        <p>Watch the boundary: 50 exactly is a pass.</p>
      `,
      rows: 11,
      columns: 5,
      data: {
        A1: "Student", B1: "Score", C1: "Result",
        A2: "Ada", B2: 72, A3: "Ben", B3: 49, A4: "Cleo", B4: 50,
        A5: "Dan", B5: 91, A6: "Eve", B6: 12, A7: "Fay", B7: 68,
        A8: "Gil", B8: 55, A9: "Hana", B9: 38,
      },
      entryCells: ["C2"],
      fills: [{ from: "C2", to: "C9" }],
      solution: { C2: '=IF(B2>=50,"Pass","Fail")' },
      hints: [
        'IF takes three parts: the test, the answer when true, the answer when false.',
        '"50 or more" is >=50, not >50.',
        '=IF(B2>=50,"Pass","Fail")',
      ],
      checks: [
        { type: "usesFunction", cell: "C2", any: ["IF", "IFS"], name: "C2 uses IF" },
        { type: "value", cell: "C2", equals: "Pass", name: "72 is a Pass" },
        { type: "value", cell: "C3", equals: "Fail", name: "49 is a Fail" },
        { type: "value", cell: "C4", equals: "Pass", name: "exactly 50 is a Pass" },
        {
          type: "block", from: "C2:C9", name: "the whole column is right",
          equals: [["Pass"], ["Fail"], ["Pass"], ["Pass"], ["Fail"], ["Pass"], ["Pass"], ["Fail"]],
        },
        { type: "robust", cell: "C9", changes: { B9: 100 }, equals: "Pass", name: "raising a score changes its result" },
      ],
    },
    {
      id: "logic-2",
      title: "Grade bands",
      prompt: `
        <p>Now turn each score into a grade:</p>
        <ul>
          <li><code>A</code> for 90 and above</li>
          <li><code>B</code> for 80 to 89</li>
          <li><code>C</code> for 70 to 79</li>
          <li><code>D</code> for 50 to 69</li>
          <li><code>F</code> below 50</li>
        </ul>
        <p>Write it in <strong>D2</strong> and let it fill down. Either nested
        <code>IF</code>s or <code>IFS</code> will do — <code>IFS</code> is easier to read.</p>
        <p>Do not forget the catch-all for the F case.</p>
      `,
      rows: 11,
      columns: 6,
      data: {
        A1: "Student", B1: "Score", C1: "Result", D1: "Grade",
        A2: "Ada", B2: 72, C2: "Pass", A3: "Ben", B3: 49, C3: "Fail",
        A4: "Cleo", B4: 50, C4: "Pass", A5: "Dan", B5: 91, C5: "Pass",
        A6: "Eve", B6: 12, C6: "Fail", A7: "Fay", B7: 68, C7: "Pass",
        A8: "Gil", B8: 85, C8: "Pass", A9: "Hana", B9: 38, C9: "Fail",
      },
      entryCells: ["D2"],
      fills: [{ from: "D2", to: "D9" }],
      solution: { D2: '=IFS(B2>=90,"A",B2>=80,"B",B2>=70,"C",B2>=50,"D",TRUE,"F")' },
      hints: [
        "Test the highest band first and work downwards — the first true condition wins.",
        "Because the earlier tests already ran, you never need B2>=80 AND B2<90.",
        'End with TRUE,"F" so that anything left over gets an F.',
      ],
      checks: [
        { type: "usesFunction", cell: "D2", any: ["IFS", "IF"], name: "D2 uses IF or IFS" },
        { type: "value", cell: "D2", equals: "C", name: "72 is a C" },
        { type: "value", cell: "D5", equals: "A", name: "91 is an A" },
        { type: "value", cell: "D8", equals: "B", name: "85 is a B" },
        { type: "value", cell: "D4", equals: "D", name: "exactly 50 is a D" },
        { type: "value", cell: "D6", equals: "F", name: "12 is an F" },
        {
          type: "block", from: "D2:D9", name: "the whole grade column is right",
          equals: [["C"], ["F"], ["D"], ["A"], ["F"], ["D"], ["B"], ["F"]],
        },
        { type: "robust", cell: "D2", changes: { B2: 90 }, equals: "A", name: "exactly 90 is an A" },
        { type: "robust", cell: "D2", changes: { B2: 89 }, equals: "B", name: "89 is a B — the bands do not overlap" },
      ],
    },
    {
      id: "logic-3",
      title: "Two conditions, and a safe division",
      prompt: `
        <p>Two jobs on this sheet of sales reps.</p>
        <p><strong>D2</strong> (fills down): a rep earns a bonus when they made
        <strong>at least 20 sales</strong> <em>and</em> their region is
        <strong>North</strong>. Show <code>Bonus</code> or an empty string
        <code>""</code>.</p>
        <p><strong>E2</strong> (fills down): the average value per sale — revenue divided by
        sales. Two reps made no sales at all, and dividing by zero would put
        <code>#DIV/0!</code> down the column. Show <code>0</code> for those instead.</p>
      `,
      rows: 11,
      columns: 7,
      data: {
        A1: "Rep", B1: "Region", C1: "Sales", D1: "Bonus", E1: "Per sale", F1: "Revenue",
        A2: "Ana", B2: "North", C2: 24, F2: 4800,
        A3: "Bo", B3: "South", C3: 31, F3: 6200,
        A4: "Chi", B4: "North", C4: 12, F4: 2400,
        A5: "Dee", B5: "North", C5: 20, F5: 5000,
        A6: "Eze", B6: "East", C6: 0, F6: 0,
        A7: "Fen", B7: "North", C7: 0, F7: 0,
        A8: "Gus", B8: "South", C8: 45, F8: 11250,
        A9: "Hal", B9: "North", C9: 38, F9: 7600,
      },
      formats: { "E2:E9": "number2", "F2:F9": "number2" },
      entryCells: ["D2", "E2"],
      fills: [{ from: "D2", to: "D9" }, { from: "E2", to: "E9" }],
      solution: {
        D2: '=IF(AND(C2>=20,B2="North"),"Bonus","")',
        E2: "=IFERROR(F2/C2,0)",
      },
      hints: [
        'Both things must be true, so the test is AND(C2>=20, B2="North").',
        'Each side of AND is a full comparison — B2="North", not just "North".',
        "For the division, wrap it: =IFERROR(F2/C2,0)",
      ],
      checks: [
        { type: "usesFunction", cell: "D2", all: ["AND"], name: "D2 uses AND" },
        { type: "value", cell: "D2", equals: "Bonus", name: "Ana (North, 24) gets a bonus" },
        { type: "value", cell: "D3", equals: "", name: "Bo made 31 sales but is not in the North" },
        { type: "value", cell: "D4", equals: "", name: "Chi is in the North but made only 12 sales" },
        { type: "value", cell: "D5", equals: "Bonus", name: "exactly 20 sales qualifies" },
        { type: "usesFunction", cell: "E2", any: ["IFERROR", "IF"], name: "E2 guards against dividing by zero" },
        { type: "value", cell: "E2", equals: 200, name: "Ana averages 200 per sale" },
        { type: "value", cell: "E6", equals: 0, name: "Eze made no sales, so shows 0 rather than an error" },
        { type: "noError", cell: "E7", name: "and neither row shows #DIV/0!" },
        {
          type: "block", from: "E2:E9", tolerance: 0.001, name: "the per-sale column is right",
          equals: [[200], [200], [200], [250], [0], [0], [250], [200]],
        },
        { type: "robust", cell: "D4", changes: { C4: 25 }, equals: "Bonus", name: "giving Chi 25 sales earns the bonus" },
        { type: "robust", cell: "E6", changes: { C6: 4, F6: 1000 }, equals: 250, name: "once Eze makes sales the average appears" },
      ],
    },
  ],
};
