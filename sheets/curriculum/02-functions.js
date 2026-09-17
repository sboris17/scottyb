export default {
  id: "02-functions",
  title: "Core Functions",
  summary: "SUM, AVERAGE, COUNT, MIN, MAX and ROUND — and the difference between COUNT and COUNTA.",
  minutes: 14,
  sections: [
    {
      heading: "A function is a named calculation",
      body: `
        <p>Adding four cells with <code>+</code> is fine. Adding four hundred is not. A
        <strong>function</strong> takes a whole range at once:</p>
        <pre class="sample"><code>=SUM(B2:B5)</code></pre>
        <p>Three parts: the name, brackets, and what goes inside — the
        <strong>arguments</strong>. Here the argument is a <strong>range</strong>:
        <code>B2:B5</code> means every cell from B2 down to B5. Ranges can be wide too —
        <code>B2:D10</code> is a rectangle, 3 columns by 9 rows.</p>
        <p>Ranges beat listing cells for a second reason: insert a row in the middle of
        B2:B5 and Sheets widens the range for you. <code>=B2+B3+B4+B5</code> would
        silently skip the new row.</p>
      `,
    },
    {
      heading: "The six you will use most",
      body: `
        <pre class="sample"><code>=SUM(B2:B9)       add everything up
=AVERAGE(B2:B9)   the mean
=COUNT(B2:B9)     how many cells hold a NUMBER
=COUNTA(B2:B9)    how many cells hold ANYTHING
=MIN(B2:B9)       the smallest
=MAX(B2:B9)       the largest</code></pre>
        <p>Most of these ignore text and blanks rather than complaining about them.
        <code>SUM</code> over a range containing the word "pending" adds the numbers and
        skips the word.</p>
      `,
    },
    {
      heading: "COUNT and COUNTA are not the same",
      body: `
        <p>This catches people out constantly, and it is worth being precise about:</p>
        <ul>
          <li><code>COUNT</code> counts <strong>numbers</strong>. Text, blanks and TRUE/FALSE
          are ignored. Dates count, because a date is a number.</li>
          <li><code>COUNTA</code> counts <strong>non-empty cells</strong> of any kind.</li>
          <li><code>COUNTBLANK</code> counts the empty ones.</li>
        </ul>
        <p>So over a column of 20 rows where 3 people have not yet submitted a score,
        <code>COUNT</code> gives 17 and <code>COUNTA</code> gives 20 if the gaps hold the
        word "pending", or 17 if they are truly empty. Which one you want depends on
        whether you are asking "how many scores?" or "how many people?"</p>
        <p>This also explains a classic mistake: <code>=SUM(B2:B21)/20</code> divides by
        the number of rows, but <code>=AVERAGE(B2:B21)</code> divides by the number of
        actual values. When there are gaps, those are different answers, and AVERAGE is
        nearly always the one you meant.</p>
      `,
    },
    {
      heading: "ROUND, and why money needs it",
      body: `
        <pre class="sample"><code>=ROUND(3.14159, 2)     3.14
=ROUND(1234.5, 0)      1235
=ROUND(1234.5, -2)     1200   negative places round to tens, hundreds...
=ROUNDUP(2.01, 1)      2.1    always away from zero
=ROUNDDOWN(2.99, 1)    2.9    always towards zero</code></pre>
        <p>Formatting a cell to two decimal places changes only what you see —
        underneath, the full number is still there, and totals will look like they are
        a penny out. <code>ROUND</code> changes the value itself. Use formatting for
        display and ROUND when the rounded number is the real answer, such as a tax
        figure someone will be invoiced for.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "functions-1",
      title: "Summarise a column",
      prompt: `
        <p>Eight days of takings are in B2:B9. Fill in the four summary cells:</p>
        <ul>
          <li><strong>B11</strong> — the total (<code>3610</code>)</li>
          <li><strong>B12</strong> — the average (<code>451.25</code>)</li>
          <li><strong>B13</strong> — the best day (<code>702</code>)</li>
          <li><strong>B14</strong> — the worst day (<code>198</code>)</li>
        </ul>
        <p>Use a range in each, not a list of eight cells.</p>
      `,
      rows: 16,
      columns: 4,
      data: {
        A1: "Day", B1: "Takings",
        A2: "Mon", B2: 412, A3: "Tue", B3: 388, A4: "Wed", B4: 505, A5: "Thu", B5: 198,
        A6: "Fri", B6: 702, A7: "Sat", B7: 640, A8: "Sun", B8: 421, A9: "Mon", B9: 344,
        A11: "Total", A12: "Average", A13: "Best day", A14: "Worst day",
      },
      formats: { B11: "number2", B12: "number2", B13: "number2", B14: "number2" },
      entryCells: ["B11", "B12", "B13", "B14"],
      solution: {
        B11: "=SUM(B2:B9)",
        B12: "=AVERAGE(B2:B9)",
        B13: "=MAX(B2:B9)",
        B14: "=MIN(B2:B9)",
      },
      hints: [
        "Each one is a function name, then the range B2:B9 in brackets.",
        "The best day is the largest number, so MAX; the worst is MIN.",
        "=SUM(B2:B9), =AVERAGE(B2:B9), =MAX(B2:B9), =MIN(B2:B9)",
      ],
      checks: [
        { type: "usesFunction", cell: "B11", any: ["SUM"], name: "B11 uses SUM" },
        { type: "value", cell: "B11", equals: 3610, name: "the total is 3610" },
        { type: "usesFunction", cell: "B12", any: ["AVERAGE"], name: "B12 uses AVERAGE" },
        { type: "value", cell: "B12", equals: 451.25, name: "the average is 451.25" },
        { type: "usesFunction", cell: "B13", any: ["MAX"], name: "B13 uses MAX" },
        { type: "value", cell: "B13", equals: 702, name: "the best day is 702" },
        { type: "usesFunction", cell: "B14", any: ["MIN"], name: "B14 uses MIN" },
        { type: "value", cell: "B14", equals: 198, name: "the worst day is 198" },
        { type: "robust", cell: "B11", changes: { B5: 1000 }, equals: 4412, name: "the total follows a changed day" },
        { type: "robust", cell: "B13", changes: { B5: 1000 }, equals: 1000, name: "so does the best day" },
      ],
    },
    {
      id: "functions-2",
      title: "COUNT or COUNTA?",
      prompt: `
        <p>Ten students were asked for a score. Some have not replied — their cell says
        <code>pending</code> — and two cells are genuinely empty.</p>
        <p>Fill in:</p>
        <ul>
          <li><strong>B13</strong> — how many <strong>scores</strong> have been given (<code>5</code>)</li>
          <li><strong>B14</strong> — how many students have <strong>replied at all</strong>,
          counting "pending" as a reply (<code>8</code>)</li>
          <li><strong>B15</strong> — how many cells are still <strong>empty</strong> (<code>2</code>)</li>
          <li><strong>B16</strong> — the average of the scores given (<code>68</code>)</li>
        </ul>
        <p>For B16, think about what AVERAGE divides by before you write it.</p>
      `,
      rows: 18,
      columns: 4,
      data: {
        A1: "Student", B1: "Score",
        A2: "Ada", B2: 72, A3: "Ben", B3: "pending", A4: "Cleo", B4: 55,
        A5: "Dan", B5: 90, A6: "Eve", B6: "pending", A7: "Fay", B7: 61,
        A8: "Gil", B8: "pending", A9: "Hana", B9: 62, A10: "Ivan", A11: "Jo",
        A13: "Scores given", A14: "Replied", A15: "Still empty", A16: "Average score",
      },
      entryCells: ["B13", "B14", "B15", "B16"],
      solution: {
        B13: "=COUNT(B2:B11)",
        B14: "=COUNTA(B2:B11)",
        B15: "=COUNTBLANK(B2:B11)",
        B16: "=AVERAGE(B2:B11)",
      },
      hints: [
        "COUNT sees only numbers; COUNTA sees anything that is not empty.",
        'The word "pending" is text, so it is invisible to COUNT but visible to COUNTA.',
        "AVERAGE already ignores text and blanks, so =AVERAGE(B2:B11) divides by 5, not 10.",
      ],
      checks: [
        { type: "usesFunction", cell: "B13", any: ["COUNT"], name: "B13 uses COUNT" },
        { type: "value", cell: "B13", equals: 5, name: "5 scores have been given" },
        { type: "usesFunction", cell: "B14", any: ["COUNTA"], name: "B14 uses COUNTA" },
        { type: "value", cell: "B14", equals: 8, name: "8 students have replied" },
        { type: "value", cell: "B15", equals: 2, name: "2 cells are still empty" },
        { type: "usesFunction", cell: "B16", any: ["AVERAGE"], name: "B16 uses AVERAGE" },
        { type: "value", cell: "B16", equals: 68, name: "the average of the five scores is 68" },
        { type: "robust", cell: "B13", changes: { B3: 80 }, equals: 6, name: "a new score raises the COUNT" },
        { type: "robust", cell: "B14", changes: { B3: 80 }, equals: 8, name: "but not the COUNTA — Ben had already replied" },
        { type: "robust", cell: "B16", changes: { B3: 80 }, equals: 70, name: "and the average moves to 70" },
      ],
    },
    {
      id: "functions-3",
      title: "Round the tax",
      prompt: `
        <p>The subtotal is in B2 and the VAT rate in B3.</p>
        <ul>
          <li><strong>B5</strong> — the VAT, <strong>rounded to 2 decimal places</strong>.
          The unrounded figure is 27.7794, so B5 should be exactly <code>27.78</code>.</li>
          <li><strong>B6</strong> — the total to pay: subtotal plus the rounded VAT
          (<code>166.67</code>).</li>
        </ul>
        <p>B6 must add B5, not recalculate the tax — otherwise the invoice total and the
        tax line disagree by a fraction of a penny, and somebody's accounts will not
        balance.</p>
      `,
      rows: 8,
      columns: 4,
      data: {
        A1: "Invoice 8812", A2: "Subtotal", B2: 138.89, A3: "VAT rate", B3: 0.2,
        A5: "VAT", A6: "Total",
      },
      formats: { B2: "number2", B3: "percent0", B5: "number2", B6: "number2" },
      entryCells: ["B5", "B6"],
      solution: { B5: "=ROUND(B2*B3,2)", B6: "=B2+B5" },
      hints: [
        "ROUND takes two arguments: the number, then how many decimal places.",
        "The VAT before rounding is B2*B3, so wrap that: =ROUND(B2*B3,2)",
        "For the total, add the rounded cell itself: =B2+B5",
      ],
      checks: [
        { type: "usesFunction", cell: "B5", any: ["ROUND"], name: "B5 uses ROUND" },
        { type: "value", cell: "B5", equals: 27.78, name: "the VAT is exactly 27.78" },
        { type: "value", cell: "B6", equals: 166.67, name: "the total is 166.67" },
        { type: "robust", cell: "B5", changes: { B2: 100 }, equals: 20, name: "a subtotal of 100 gives 20 VAT" },
        { type: "robust", cell: "B6", changes: { B2: 100 }, equals: 120, name: "and a total of 120" },
        { type: "robust", cell: "B5", changes: { B3: 0.05 }, equals: 6.94, name: "a 5% rate rounds 6.9445 to 6.94" },
      ],
    },
  ],
};
