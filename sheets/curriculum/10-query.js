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
  id: "10-query",
  title: "QUERY, and a Dashboard",
  summary: "The one function that has no equivalent in Excel — then a capstone that uses everything.",
  minutes: 30,
  sections: [
    {
      heading: "A small language inside a cell",
      body: `
        <p><code>QUERY</code> takes a range and a sentence describing what you want from
        it, written in a language very close to SQL. What would take four helper columns
        and a pivot table becomes one formula.</p>
        <pre class="sample"><code>=QUERY(A1:F13, "select B, E where A = 'North'", 1)</code></pre>
        <p>Three arguments: the data, the query, and how many rows at the top are headers —
        almost always <code>1</code>. Give the header count explicitly; leaving it out
        makes Sheets guess, and it guesses wrong on data whose first row happens to look
        like a heading.</p>
        <p>The result is a block, so it spills, and it carries a header row of its own.</p>
      `,
    },
    {
      heading: "The clauses",
      body: `
        <p>Clauses must appear in this order, and all of them are optional:</p>
        <pre class="sample"><code>select A, B, sum(E)     which columns, and any totals
where E > 1000          which rows
group by A              one output row per distinct value
order by sum(E) desc    how to sort
limit 5                 how many rows to keep
label sum(E) 'Revenue'  rename the headings</code></pre>
        <p>Columns are referred to by their <strong>letter within the range</strong> —
        <code>A</code>, <code>B</code>, <code>C</code> — not by their heading. If the range
        starts at column C, then <code>A</code> in the query means column C on the sheet,
        which is the single most confusing thing about QUERY.</p>
        <p>Text values in the query go in <strong>single</strong> quotes, because the whole
        query is already wrapped in double ones:</p>
        <pre class="sample"><code>"select B where A = 'North'"</code></pre>
        <p>To compare against a cell instead, break out of the string and join with
        <code>&amp;</code>: <code>"select B where A = '"&H1&"'"</code>. Fiddly, but it is
        what makes a query respond to a drop-down.</p>
      `,
    },
    {
      heading: "Grouping",
      body: `
        <p><code>group by</code> is where QUERY earns its place. The aggregates are
        <code>sum</code>, <code>avg</code>, <code>count</code>, <code>max</code> and
        <code>min</code>.</p>
        <pre class="sample"><code>=QUERY(A1:F13, "select A, sum(E) group by A", 1)</code></pre>
        <p>One row per region, with its total — a pivot table in a single cell, which
        updates itself when the data changes.</p>
        <p>The rule that catches everyone: <strong>every column in <code>select</code> must
        either be grouped by or wrapped in an aggregate.</strong> Asking for
        <code>select A, B, sum(E) group by A</code> is a contradiction — there are several
        different B values inside each group, so there is no single answer to give.</p>
        <p>Grouped results come back sorted by the grouping column unless you say
        otherwise. Note also that the default heading is <code>sum Revenue</code>, which is
        what <code>label</code> is for.</p>
      `,
    },
    {
      heading: "Also worth knowing",
      body: `
        <ul>
          <li><code>where B contains 'an'</code>, <code>starts with</code>,
          <code>ends with</code> and <code>matches</code> (a regular expression) for text.</li>
          <li><code>where E is null</code> / <code>is not null</code> for blanks.</li>
          <li><code>and</code>, <code>or</code>, <code>not</code> and brackets combine
          conditions.</li>
          <li>Dates need the <code>date</code> keyword:
          <code>where B &gt; date '2024-03-01'</code>.</li>
        </ul>
        <p class="notice">This course implements a large subset of the real QUERY language.
        <code>pivot</code>, <code>format</code> and <code>options</code> are not supported,
        and say so plainly rather than returning something wrong.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "query-1",
      title: "Select and filter",
      prompt: `
        <p>In <strong>H2</strong>, write one <code>QUERY</code> that returns the
        <strong>rep</strong> and <strong>revenue</strong> columns for orders from the
        <strong>North</strong>.</p>
        <p>The result should be a header row (<code>Rep</code>, <code>Revenue</code>)
        followed by four rows: Ana 1068, Chi 712, Ana 360, Chi 590.</p>
        <p>Remember: column letters, single quotes around North, and <code>1</code> as the
        third argument.</p>
      `,
      rows: 16,
      columns: 11,
      data: { ...ORDERS, H1: "North orders" },
      columnWidths: { H: 110 },
      entryCells: ["H2"],
      solution: { H2: '=QUERY(A1:F13,"select B, E where A = \'North\'",1)' },
      hints: [
        "The rep is column B and the revenue is column E within the range A1:F13.",
        "The whole query is one piece of text in double quotes; North goes in single quotes inside it.",
        '=QUERY(A1:F13,"select B, E where A = \'North\'",1)',
      ],
      checks: [
        { type: "usesFunction", cell: "H2", any: ["QUERY"], name: "H2 uses QUERY" },
        {
          type: "spill", cell: "H2", name: "the four North orders come back with their headings",
          equals: [
            ["Rep", "Revenue"],
            ["Ana", 1068],
            ["Chi", 712],
            ["Ana", 360],
            ["Chi", 590],
          ],
        },
        { type: "robust", cell: "I3", changes: { E2: 2000 }, equals: 2000, name: "the result follows the underlying data" },
        { type: "robust", cell: "H3", changes: { A3: "North" }, equals: "Ana", name: "a new North order joins the list" },
      ],
    },
    {
      id: "query-2",
      title: "Group and total",
      prompt: `
        <p>In <strong>H2</strong>, produce a revenue total for each region: one row per
        region, with the region in the first column and its total revenue in the second.</p>
        <p>Rename the total's heading to <code>Revenue</code> — by default it would say
        <code>sum Revenue</code>.</p>
        <p>The result should read: headings, then East 2082, North 2730, South 3784, West
        2945.</p>
      `,
      rows: 16,
      columns: 11,
      data: { ...ORDERS, H1: "Revenue by region" },
      columnWidths: { H: 140 },
      entryCells: ["H2"],
      solution: { H2: '=QUERY(A1:F13,"select A, sum(E) group by A label sum(E) \'Revenue\'",1)' },
      hints: [
        "Select the region and the total: select A, sum(E)",
        "Then tell it what to group on: group by A",
        "label comes last: label sum(E) 'Revenue'",
      ],
      checks: [
        { type: "usesFunction", cell: "H2", any: ["QUERY"], name: "H2 uses QUERY" },
        {
          type: "spill", cell: "H2", name: "each region appears once with its total",
          equals: [
            ["Region", "Revenue"],
            ["East", 2082],
            ["North", 2730],
            ["South", 3784],
            ["West", 2945],
          ],
        },
        { type: "robust", cell: "I3", changes: { E5: 1480 }, equals: 3082, name: "the East total follows its rows" },
      ],
    },
    {
      id: "query-3",
      title: "Sort and trim",
      prompt: `
        <p>In <strong>H2</strong>, produce a "top three orders" table: the
        <strong>rep</strong>, <strong>product</strong> and <strong>revenue</strong> of the
        three largest orders, biggest first.</p>
        <p>Expect Fen's chair at 2225, then Dee's chair at 1602, then Bo's desk at 1475.</p>
      `,
      rows: 16,
      columns: 11,
      data: { ...ORDERS, H1: "Top three orders" },
      columnWidths: { H: 130 },
      entryCells: ["H2"],
      solution: { H2: '=QUERY(A1:F13,"select B, C, E order by E desc limit 3",1)' },
      hints: [
        "Three columns: select B, C, E",
        "Biggest first is order by E desc",
        "Then keep only three rows: limit 3",
      ],
      checks: [
        { type: "usesFunction", cell: "H2", any: ["QUERY"], name: "H2 uses QUERY" },
        {
          type: "spill", cell: "H2", name: "the three biggest orders come back in order",
          equals: [
            ["Rep", "Product", "Revenue"],
            ["Fen", "Chair", 2225],
            ["Dee", "Chair", 1602],
            ["Bo", "Desk", 1475],
          ],
        },
        { type: "robust", cell: "H3", changes: { E7: 9999 }, equals: "Ana", name: "a new biggest order takes the top row" },
        { type: "robust", cell: "J5", changes: { E7: 9999 }, equals: 1602, name: "and the rest shuffle down" },
      ],
    },
    {
      id: "query-4",
      title: "Capstone: the sales dashboard",
      prompt: `
        <p>Everything at once. Build the four pieces of a small dashboard.</p>
        <ul>
          <li><strong>I2</strong> — total revenue from <strong>Shipped</strong> orders only
          (<code>8334</code>).</li>
          <li><strong>I3</strong> — how many different reps appear in the data
          (<code>6</code>).</li>
          <li><strong>I4</strong> — the name of the rep behind the single largest order
          (<code>Fen</code>). Work it out from the data — do not read it off and type it in,
          because the check will change the numbers.</li>
          <li><strong>H7</strong> — a QUERY listing the rep, product and revenue of every
          <strong>Pending</strong> order, largest first.</li>
        </ul>
        <p>For I4, one function finds the largest revenue, a second finds which row it is
        on, and a third fetches the rep from that row.</p>
      `,
      rows: 16,
      columns: 11,
      data: {
        ...ORDERS,
        H2: "Shipped revenue", H3: "Distinct reps", H4: "Top rep",
        H6: "Pending orders",
      },
      formats: { "E2:E13": "number2", I2: "number2" },
      columnWidths: { H: 140 },
      entryCells: ["I2", "I3", "I4", "H7"],
      solution: {
        I2: '=SUMIF(F2:F13,"Shipped",E2:E13)',
        I3: "=COUNTUNIQUE(B2:B13)",
        I4: "=INDEX(B2:B13,MATCH(MAX(E2:E13),E2:E13,0))",
        H7: '=QUERY(A1:F13,"select B, C, E where F = \'Pending\' order by E desc",1)',
      },
      hints: [
        "I2 is a SUMIF: test the status column, add the revenue column.",
        "I4 nests three functions: MAX finds the biggest revenue, MATCH finds its row, INDEX pulls the rep from that row.",
        "H7 needs where F = 'Pending' and order by E desc.",
      ],
      checks: [
        { type: "value", cell: "I2", equals: 8334, name: "shipped revenue is 8334" },
        { type: "value", cell: "I3", equals: 6, name: "there are 6 reps" },
        { type: "value", cell: "I4", equals: "Fen", name: "the top rep is Fen" },
        { type: "referencesCells", cell: "I4", name: "the top rep is worked out, not typed in" },
        {
          type: "spill", cell: "H7", name: "the pending orders are listed, largest first",
          equals: [
            ["Rep", "Product", "Revenue"],
            ["Bo", "Chair", 890],
            ["Fen", "Lamp", 720],
            ["Chi", "Chair", 712],
          ],
        },
        { type: "robust", cell: "I2", changes: { F5: "Pending" }, equals: 7854, name: "unshipping an order lowers the shipped total" },
        { type: "robust", cell: "I4", changes: { E7: 5000 }, equals: "Ana", name: "a new biggest order changes the top rep" },
        { type: "robust", cell: "H8", changes: { E9: 100 }, equals: "Fen", name: "the pending list re-sorts when revenue changes" },
      ],
    },
  ],
};
