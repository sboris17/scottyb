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
  id: "05-criteria",
  title: "Counting and Summing on Conditions",
  summary: "COUNTIF, SUMIF and their plural cousins — answering questions about a subset of your data.",
  minutes: 16,
  sections: [
    {
      heading: "The question behind the function",
      body: `
        <p><code>SUM</code> answers "what is the total?". Real questions are narrower:
        <em>what did the North region make? how many orders are still pending? what is the
        average order value over £1,000?</em></p>
        <p>The <code>IF</code> family answers those, and they are the functions that turn a
        list of rows into a report.</p>
        <pre class="sample"><code>=COUNTIF(A2:A13, "North")              how many North rows
=SUMIF(A2:A13, "North", E2:E13)        their total revenue
=AVERAGEIF(A2:A13, "North", E2:E13)    their average</code></pre>
      `,
    },
    {
      heading: "SUMIF's argument order is a trap",
      body: `
        <p>Read it carefully:</p>
        <pre class="sample"><code>=SUMIF(range_to_test, criterion, range_to_add)</code></pre>
        <p>The range you <strong>test</strong> comes first and the range you
        <strong>add up</strong> comes last. That is the opposite way round from
        <code>SUMIFS</code>, which puts the range to add first:</p>
        <pre class="sample"><code>=SUMIFS(range_to_add, test1, criterion1, test2, criterion2, ...)</code></pre>
        <p>There is no good reason for the inconsistency; it is simply how they are, and
        getting them the wrong way round is the most common cause of a SUMIF that returns
        zero. If you would rather learn one shape, <code>SUMIFS</code> works perfectly well
        with a single condition.</p>
        <p>Leaving the third argument off <code>SUMIF</code> adds up the tested range
        itself, which is what you want for <code>=SUMIF(E2:E13,"&gt;1000")</code>.</p>
      `,
    },
    {
      heading: "Writing criteria",
      body: `
        <p>A criterion is more than a value. Comparisons go <strong>inside quotation
        marks</strong>, which looks wrong the first few times:</p>
        <pre class="sample"><code>"North"        equal to North (capitals do not matter)
">1000"        greater than 1000
">="&H2        greater than or equal to whatever is in H2
"<>Cancelled"  anything except Cancelled
"Ch*"          starts with Ch        (* is any number of characters)
"??-01"        five characters ending in -01   (? is exactly one)</code></pre>
        <p>The third one is the pattern to remember: to compare against a
        <strong>cell</strong>, the operator stays in quotes and is joined to the reference
        with <code>&amp;</code>. <code>"&gt;=H2"</code> looks for the literal text
        "&gt;=H2" and finds nothing.</p>
      `,
    },
    {
      heading: "Several conditions at once",
      body: `
        <pre class="sample"><code>=COUNTIFS(C2:C13,"Chair", F2:F13,"Shipped")
=SUMIFS(E2:E13, A2:A13,"North", F2:F13,"Shipped")
=AVERAGEIFS(E2:E13, A2:A13,"South", D2:D13,">=10")</code></pre>
        <p>Every condition must be true for a row to count — they are joined by AND, and
        there is no OR version. To count Chairs <em>or</em> Desks, add two COUNTIFs
        together.</p>
        <p>All the ranges must be the same height. If the test range is A2:A13 and the sum
        range is E2:E20, the rows stop lining up and the answer is quietly wrong.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "criteria-1",
      title: "Count and total a subset",
      prompt: `
        <p>Using the order list, fill in the three summary cells:</p>
        <ul>
          <li><strong>I2</strong> — how many orders came from the North (<code>4</code>)</li>
          <li><strong>I3</strong> — the total revenue from the North (<code>2730</code>)</li>
          <li><strong>I4</strong> — how many orders were for 15 units or more (<code>5</code>)</li>
        </ul>
        <p>For I4 the criterion is a comparison, so it goes in quotes.</p>
      `,
      rows: 15,
      columns: 10,
      data: {
        ...ORDERS,
        H1: "Summary", H2: "North orders", H3: "North revenue", H4: "Orders of 15+ units",
      },
      formats: { "E2:E13": "number2", I3: "number2" },
      entryCells: ["I2", "I3", "I4"],
      solution: {
        I2: '=COUNTIF(A2:A13,"North")',
        I3: '=SUMIF(A2:A13,"North",E2:E13)',
        I4: '=COUNTIF(D2:D13,">=15")',
      },
      hints: [
        'COUNTIF takes the range then the criterion: =COUNTIF(A2:A13,"North")',
        "SUMIF tests one range and adds a different one — the range to add goes last.",
        'A comparison criterion lives inside the quotes: ">=15"',
      ],
      checks: [
        { type: "usesFunction", cell: "I2", any: ["COUNTIF", "COUNTIFS"], name: "I2 uses COUNTIF" },
        { type: "value", cell: "I2", equals: 4, name: "there are 4 North orders" },
        { type: "usesFunction", cell: "I3", any: ["SUMIF", "SUMIFS"], name: "I3 uses SUMIF" },
        { type: "value", cell: "I3", equals: 2730, name: "the North made 2730" },
        { type: "value", cell: "I4", equals: 5, name: "5 orders were 15 units or more" },
        { type: "robust", cell: "I2", changes: { A5: "North" }, equals: 5, name: "moving an order to the North raises the count" },
        { type: "robust", cell: "I3", changes: { E2: 0 }, equals: 1662, name: "and the total follows a changed revenue" },
        { type: "robust", cell: "I4", changes: { D3: 15 }, equals: 6, name: "exactly 15 units counts" },
      ],
    },
    {
      id: "criteria-2",
      title: "Comparisons and averages",
      prompt: `
        <p>Three more, and one of them has a catch:</p>
        <ul>
          <li><strong>I2</strong> — how many orders were worth more than 1000
          (<code>4</code>)</li>
          <li><strong>I3</strong> — the total revenue of just those orders
          (<code>6370</code>). You only need two arguments for this one.</li>
          <li><strong>I4</strong> — the average revenue of South orders (<code>946</code>)</li>
          <li><strong>I5</strong> — how many orders were <em>not</em> cancelled
          (<code>11</code>)</li>
        </ul>
      `,
      rows: 15,
      columns: 10,
      data: {
        ...ORDERS,
        H1: "Summary", H2: "Orders over 1000", H3: "Revenue over 1000",
        H4: "South average", H5: "Not cancelled",
      },
      formats: { "E2:E13": "number2", I3: "number2", I4: "number2" },
      entryCells: ["I2", "I3", "I4", "I5"],
      solution: {
        I2: '=COUNTIF(E2:E13,">1000")',
        I3: '=SUMIF(E2:E13,">1000")',
        I4: '=AVERAGEIF(A2:A13,"South",E2:E13)',
        I5: '=COUNTIF(F2:F13,"<>Cancelled")',
      },
      hints: [
        'For I3, the range you are testing is also the range you want to add, so SUMIF needs only two arguments.',
        'AVERAGEIF has the same shape as SUMIF: test range, criterion, range to average.',
        '"Not equal to" is written "<>Cancelled", inside the quotes.',
      ],
      checks: [
        { type: "value", cell: "I2", equals: 4, name: "4 orders were over 1000" },
        { type: "value", cell: "I3", equals: 6370, name: "those orders total 6370" },
        { type: "usesFunction", cell: "I4", any: ["AVERAGEIF", "AVERAGEIFS"], name: "I4 uses AVERAGEIF" },
        { type: "value", cell: "I4", equals: 946, name: "the South averages 946" },
        { type: "value", cell: "I5", equals: 11, name: "11 orders were not cancelled" },
        { type: "robust", cell: "I2", changes: { E5: 5000 }, equals: 5, name: "a bigger order joins the count" },
        { type: "robust", cell: "I5", changes: { F2: "Cancelled" }, equals: 10, name: "cancelling an order lowers the count" },
        { type: "robust", cell: "I4", changes: { E3: 1275 }, equals: 896, name: "the South average follows its rows" },
      ],
    },
    {
      id: "criteria-3",
      title: "Build a region report",
      prompt: `
        <p>Two jobs.</p>
        <p><strong>I2</strong> (fills down to I5): the total revenue for the region named
        beside it in column H. One formula, filled down all four rows — so the ranges must
        be pinned with <code>$</code> while the region reference shifts.</p>
        <p>North should be <code>2730</code>, South <code>3784</code>, East
        <code>2082</code>, West <code>2945</code>.</p>
        <p><strong>I8</strong>: revenue from orders that are both in the North
        <em>and</em> Shipped (<code>2018</code>). That needs <code>SUMIFS</code>, whose
        arguments are the other way round.</p>
      `,
      rows: 16,
      columns: 10,
      data: {
        ...ORDERS,
        H1: "Region", I1: "Revenue",
        H2: "North", H3: "South", H4: "East", H5: "West",
        H7: "North and shipped", H8: "Revenue",
      },
      formats: { "E2:E13": "number2", "I2:I5": "number2", I8: "number2" },
      entryCells: ["I2", "I8"],
      fills: [{ from: "I2", to: "I5" }],
      solution: {
        I2: "=SUMIF($A$2:$A$13,H2,$E$2:$E$13)",
        I8: '=SUMIFS($E$2:$E$13,$A$2:$A$13,"North",$F$2:$F$13,"Shipped")',
      },
      hints: [
        "The criterion is the cell next to the formula, so H2 stays relative and shifts down.",
        "Both ranges point at the same fixed block every time, so pin them: $A$2:$A$13 and $E$2:$E$13.",
        "SUMIFS puts the range to add FIRST, then pairs of range and criterion.",
      ],
      checks: [
        { type: "isFormula", cell: "I2", name: "I2 holds a formula" },
        { type: "value", cell: "I2", equals: 2730, name: "North is 2730" },
        {
          type: "block", from: "I2:I5", name: "all four regions total correctly",
          equals: [[2730], [3784], [2082], [2945]],
        },
        { type: "usesFunction", cell: "I8", any: ["SUMIFS"], name: "I8 uses SUMIFS" },
        { type: "value", cell: "I8", equals: 2018, name: "North and Shipped comes to 2018" },
        { type: "robust", cell: "I5", changes: { E8: 1000 }, equals: 1720, name: "the West total follows its rows" },
        { type: "robust", cell: "I8", changes: { F4: "Shipped" }, equals: 2730, name: "shipping the pending North order raises the SUMIFS total" },
        {
          type: "robustBlock", from: "I2:I5", changes: { A2: "West" }, name: "moving an order between regions moves its revenue",
          equals: [[1662], [3784], [2082], [4013]],
        },
      ],
    },
  ],
};
