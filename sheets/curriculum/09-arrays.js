const ORDERS = {
  A1: "Region", B1: "Rep", C1: "Product", D1: "Units", E1: "Revenue", F1: "Status",
  A2: "North", B2: "Ana", C2: "Chair", D2: 12, E2: 1068, F2: "Shipped",
  A3: "South", B3: "Bo", C3: "Desk", D3: 5, E3: 1475, F3: "Shipped",
  A4: "North", B4: "Chi", C4: "Chair", D4: 8, E4: 712, F4: "Pending",
  A5: "East", B5: "Dee", C5: "Lamp", D5: 20, E5: 480, F5: "Shipped",
  A6: "South", B6: "Eze", C6: "Desk", D6: 3, E6: 885, F6: "Cancelled",
  A7: "North", B7: "Ana", C7: "Lamp", D7: 15, E7: 360, F7: "Shipped",
  A8: "West", B8: "Fen", C8: "Chair", D8: 25, E8: 2225, F8: "Shipped",
  A9: "South", B9: "Bo", C9: "Chair", D9: 10, E9: 890, F9: "Pending",
  A10: "North", B10: "Chi", C10: "Desk", D10: 2, E10: 590, F10: "Shipped",
  A11: "East", B11: "Dee", C11: "Chair", D11: 18, E11: 1602, F11: "Shipped",
  A12: "West", B12: "Fen", C12: "Lamp", D12: 30, E12: 720, F12: "Pending",
  A13: "South", B13: "Eze", C13: "Chair", D13: 6, E13: 534, F13: "Shipped",
};

export default {
  id: "09-arrays",
  title: "One Formula, Many Answers",
  summary: "ARRAYFORMULA, FILTER, SORT, UNIQUE and SEQUENCE — the Google Sheets functions Excel spent years catching up with.",
  minutes: 18,
  sections: [
    {
      heading: "Results that spill",
      body: `
        <p>Everything so far has put one answer in one cell. Some functions return a whole
        block of answers, and Sheets lets that block <strong>spill</strong> out of the cell
        you wrote the formula in, filling the cells below and to the right.</p>
        <pre class="sample"><code>=SEQUENCE(5)          fills five cells with 1,2,3,4,5
=UNIQUE(A2:A13)       fills as many cells as there are distinct values
=SORT(A2:A13)         fills the same number of cells as it read</code></pre>
        <p>Only the top-left cell holds the formula. Click any of the others and you will
        see they are empty — they are showing a result that belongs to the cell above.
        Delete the formula and the whole block disappears.</p>
        <p>Because the block needs somewhere to go, <strong>anything already in its way is
        a problem</strong>. Sheets reports <code>#REF!</code> and refuses rather than
        overwriting your data. When you see that, clear the cells below the formula.</p>
      `,
    },
    {
      heading: "ARRAYFORMULA",
      body: `
        <p>A column of a thousand <code>=B2*C2</code> formulas is a thousand things to
        maintain, and one wrong row is invisible. <code>ARRAYFORMULA</code> does the whole
        column from a single cell:</p>
        <pre class="sample"><code>=ARRAYFORMULA(D2:D13 * E2:E13)
=ARRAYFORMULA(UPPER(B2:B13))
=ARRAYFORMULA(IF(E2:E13>1000, "Large", "Small"))</code></pre>
        <p>Give it ranges where you would have given single cells, and it works down them
        in step. One formula, one place to fix, and new rows are covered automatically if
        you use whole-column ranges.</p>
        <p class="notice">Google Sheets increasingly applies this automatically, so some of
        these work without the wrapper. Writing <code>ARRAYFORMULA</code> explicitly is
        still the clearer habit, and the exercises here ask for it.</p>
      `,
    },
    {
      heading: "FILTER",
      body: `
        <pre class="sample"><code>=FILTER(A2:E13, A2:A13="North")
=FILTER(A2:E13, A2:A13="North", F2:F13="Shipped")
=FILTER(B2:B13, E2:E13>1000)</code></pre>
        <p>The first argument is what to return; everything after it is a condition. Rows
        where every condition is true come back, in their original order, and everything
        else is left out.</p>
        <p>The conditions must be exactly as tall as the range being filtered — that is the
        single most common cause of <code>FILTER</code> refusing to work.</p>
        <p>When nothing matches you get <code>#N/A</code>, which is worth wrapping:
        <code>=IFERROR(FILTER(...), "No matches")</code>.</p>
      `,
    },
    {
      heading: "UNIQUE, SORT, SEQUENCE and friends",
      body: `
        <pre class="sample"><code>=UNIQUE(A2:A13)              each distinct value, once
=SORT(A2:A13)                sorted ascending
=SORT(A2:E13, 5, FALSE)      sort the block by its 5th column, descending
=SORT(UNIQUE(A2:A13))        they nest, innermost first
=COUNTUNIQUE(B2:B13)         how many distinct values (a single number)
=SEQUENCE(10)                1 to 10
=TRANSPOSE(A2:A13)           turn a column into a row</code></pre>
        <p><code>SORT</code>'s second argument is a column number counted <em>within the
        range</em>, and the third is TRUE for ascending or FALSE for descending.</p>
        <p><code>SORT(UNIQUE(...))</code> is the standard way to build a tidy list of
        categories to report against — and unlike copying and de-duplicating by hand, it
        updates itself when a new category appears.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "arrays-1",
      title: "A whole column from one cell",
      prompt: `
        <p>Two single formulas, each filling a whole column.</p>
        <ul>
          <li><strong>H2</strong> — the revenue per unit for every order: revenue divided
          by units, all twelve rows, from one formula. H2 should be <code>89</code> and the
          block should end at H13.</li>
          <li><strong>J2</strong> — the numbers 1 to 12, as a single formula.</li>
        </ul>
        <p>Do not fill anything down: write one formula in each cell and let it spill.</p>
      `,
      rows: 16,
      columns: 12,
      data: { ...ORDERS, H1: "Per unit", J1: "Row" },
      formats: { "E2:E13": "number2" },
      entryCells: ["H2", "J2"],
      solution: {
        H2: "=ARRAYFORMULA(E2:E13/D2:D13)",
        J2: "=SEQUENCE(12)",
      },
      hints: [
        "Wrap the division in ARRAYFORMULA and give it the two ranges instead of two cells.",
        "=ARRAYFORMULA(E2:E13/D2:D13)",
        "SEQUENCE(12) produces twelve rows of numbers starting at 1.",
      ],
      checks: [
        { type: "usesFunction", cell: "H2", any: ["ARRAYFORMULA"], name: "H2 uses ARRAYFORMULA" },
        { type: "value", cell: "H2", equals: 89, name: "the first order is 89 per unit" },
        {
          type: "spill", cell: "H2", tolerance: 0.001, name: "all twelve rows spill from the one formula",
          equals: [[89], [295], [89], [24], [295], [24], [89], [89], [295], [89], [24], [89]],
        },
        { type: "usesFunction", cell: "J2", any: ["SEQUENCE"], name: "J2 uses SEQUENCE" },
        {
          type: "spill", cell: "J2", name: "J2 spills 1 to 12",
          equals: [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12]],
        },
        { type: "robust", cell: "H2", changes: { D2: 6 }, equals: 178, name: "changing the units updates the spilled block" },
      ],
    },
    {
      id: "arrays-2",
      title: "A tidy list of categories",
      prompt: `
        <p>You need a list of regions to build a report against — each region once, in
        alphabetical order, and updating itself if a new one turns up.</p>
        <ul>
          <li><strong>H2</strong> — the distinct regions, sorted: <code>East</code>,
          <code>North</code>, <code>South</code>, <code>West</code>. One formula.</li>
          <li><strong>J2</strong> — how many distinct <em>reps</em> there are
          (<code>6</code>). A single number, not a list.</li>
        </ul>
        <p>For H2, two functions nest: get the distinct values first, then sort them.</p>
      `,
      rows: 16,
      columns: 12,
      data: { ...ORDERS, H1: "Regions", J1: "Distinct reps" },
      columnWidths: { J: 130 },
      entryCells: ["H2", "J2"],
      solution: {
        H2: "=SORT(UNIQUE(A2:A13))",
        J2: "=COUNTUNIQUE(B2:B13)",
      },
      hints: [
        "UNIQUE(A2:A13) gives each region once; SORT puts them in order.",
        "Nest them — the inner one runs first: =SORT(UNIQUE(A2:A13))",
        "COUNTUNIQUE gives a count rather than a list.",
      ],
      checks: [
        { type: "usesFunction", cell: "H2", all: ["UNIQUE", "SORT"], name: "H2 uses UNIQUE and SORT" },
        {
          type: "spill", cell: "H2", name: "the four regions come out in order",
          equals: [["East"], ["North"], ["South"], ["West"]],
        },
        { type: "usesFunction", cell: "J2", any: ["COUNTUNIQUE"], name: "J2 uses COUNTUNIQUE" },
        { type: "value", cell: "J2", equals: 6, name: "there are 6 distinct reps" },
        { type: "robust", cell: "J2", changes: { B2: "Zed" }, equals: 7, name: "a new rep raises the count" },
      ],
    },
    {
      id: "arrays-3",
      title: "Pull out the rows you want",
      prompt: `
        <p>In <strong>H2</strong>, use one <code>FILTER</code> to show the rep, product,
        units and revenue (columns B to E) for every order that is <strong>both</strong> in
        the North <strong>and</strong> Shipped.</p>
        <p>Three orders qualify, so the result is a block three rows tall and four columns
        wide, starting with <code>Ana</code>, <code>Chair</code>, <code>12</code>,
        <code>1068</code>.</p>
        <p>Do not sort or rearrange — FILTER keeps the original order.</p>
      `,
      rows: 16,
      columns: 12,
      data: { ...ORDERS, H1: "North, shipped" },
      columnWidths: { H: 110 },
      entryCells: ["H2"],
      solution: { H2: '=FILTER(B2:E13,A2:A13="North",F2:F13="Shipped")' },
      hints: [
        "The first argument is the block to return: B2:E13.",
        'Then one condition per test: A2:A13="North", then F2:F13="Shipped".',
        '=FILTER(B2:E13,A2:A13="North",F2:F13="Shipped")',
      ],
      checks: [
        { type: "usesFunction", cell: "H2", any: ["FILTER"], name: "H2 uses FILTER" },
        {
          type: "spill", cell: "H2", name: "the three matching orders come out, four columns wide",
          equals: [
            ["Ana", "Chair", 12, 1068],
            ["Ana", "Lamp", 15, 360],
            ["Chi", "Desk", 2, 590],
          ],
        },
        { type: "robust", cell: "H2", changes: { F4: "Shipped" }, equals: "Ana", name: "shipping another North order keeps the first row in place" },
        { type: "robust", cell: "K3", changes: { F4: "Shipped" }, equals: 712, name: "and the newly shipped order joins the block" },
      ],
    },
  ],
};
