const PRICE_LIST = {
  G1: "Code", H1: "Product", I1: "Price",
  G2: "CH-01", H2: "Chair", I2: 89,
  G3: "DK-02", H3: "Desk", I3: 295,
  G4: "KB-05", H4: "Keyboard", I4: 32.5,
  G5: "LP-03", H5: "Lamp", I5: 24,
  G6: "MN-04", H6: "Monitor", I6: 145,
};

export default {
  id: "06-lookups",
  title: "Lookups",
  summary: "Fetching a value from another table — VLOOKUP, its traps, and the INDEX/MATCH pairing that avoids them.",
  minutes: 18,
  sections: [
    {
      heading: "The problem lookups solve",
      body: `
        <p>Real data lives in more than one table. Orders record a product
        <em>code</em>; prices live in a price list. Joining the two by hand is the sort of
        job that takes an afternoon and introduces a dozen errors.</p>
        <p>A lookup does it in one formula: <em>find this code in that table, and bring me
        back the price next to it.</em></p>
      `,
    },
    {
      heading: "VLOOKUP",
      body: `
        <pre class="sample"><code>=VLOOKUP(search_key, range, column_number, is_sorted)</code></pre>
        <pre class="sample"><code>=VLOOKUP(A2, $G$2:$I$6, 3, FALSE)</code></pre>
        <p>Read it as: take the code in A2, look down the <strong>first column</strong> of
        G2:I6 for it, and when you find it, return the value from the
        <strong>third column</strong> of that range.</p>
        <p>Four things to get right, each of which breaks it:</p>
        <ul>
          <li><strong>The key must be in the first column of the range.</strong> VLOOKUP
          always searches column one. It cannot look leftwards.</li>
          <li><strong>The column number is counted from the range, not the sheet.</strong>
          In <code>G2:I6</code>, column 3 is I. If the range started at H it would be
          something else.</li>
          <li><strong>Pin the range with <code>$</code></strong> or filling the formula
          down will slide the price list off the bottom of itself.</li>
          <li><strong>Always pass FALSE</strong> — see below.</li>
        </ul>
      `,
    },
    {
      heading: "The FALSE that everyone forgets",
      body: `
        <p>The last argument decides how VLOOKUP matches:</p>
        <ul>
          <li><code>FALSE</code> — exact match. If the code is not there, you get
          <code>#N/A</code>, which is the honest answer.</li>
          <li><code>TRUE</code>, or leaving it off — <strong>approximate</strong> match. It
          assumes the first column is sorted and returns the largest value that is not
          greater than your key.</li>
        </ul>
        <p>Approximate is the default, which is unfortunate, because on unsorted data it
        does not report a problem — it returns the wrong row and looks perfectly happy. A
        price list that has been re-sorted by product name will silently start pricing
        chairs as lamps.</p>
        <p>Approximate matching is genuinely useful for banding — finding which tax bracket
        or postage tier a value falls into, against a sorted table of thresholds. That is
        the only time to use it, and then you use it deliberately.</p>
      `,
    },
    {
      heading: "INDEX and MATCH",
      body: `
        <p><code>MATCH</code> finds <em>where</em> something is; <code>INDEX</code> fetches
        <em>what is</em> at a position. Together they do everything VLOOKUP does, without
        its limitations.</p>
        <pre class="sample"><code>=MATCH("LP-03", $G$2:$G$6, 0)      3  -- the third row
=INDEX($I$2:$I$6, 3)               24 -- the third price
=INDEX($I$2:$I$6, MATCH(A2,$G$2:$G$6,0))</code></pre>
        <p>The <code>0</code> in MATCH means exact match, and is as necessary as VLOOKUP's
        FALSE, for the same reason.</p>
        <p>Why bother? Because the lookup column and the result column are named
        separately, so the result can be to the <strong>left</strong> of the key —
        impossible for VLOOKUP. It also survives someone inserting a column into the middle
        of the table, which silently breaks every VLOOKUP whose column number no longer
        points where it did.</p>
      `,
    },
    {
      heading: "XLOOKUP",
      body: `
        <pre class="sample"><code>=XLOOKUP(A2, $G$2:$G$6, $I$2:$I$6, "Not listed")</code></pre>
        <p>Newer, and simpler than either: the key, the column to search, the column to
        return, and optionally what to show when nothing matches. It defaults to exact
        matching, will look leftwards, and has the "not found" case built in instead of
        needing IFERROR.</p>
        <p>Use XLOOKUP in your own sheets. Learn VLOOKUP anyway, because you will spend the
        rest of your life reading other people's.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "lookups-1",
      title: "Price up an order",
      prompt: `
        <p>The order lines in column A hold product codes. The price list is in
        <strong>G2:I6</strong>.</p>
        <p>In <strong>C2</strong> (fills down), use <code>VLOOKUP</code> to fetch each
        code's price from the list. Then in <strong>D2</strong> (fills down), multiply the
        quantity by the price.</p>
        <p>C2 should be <code>24</code> and D2 should be <code>240</code>.</p>
        <p>Remember to pin the price-list range, and to ask for an exact match.</p>
      `,
      rows: 10,
      columns: 10,
      data: {
        ...PRICE_LIST,
        A1: "Code", B1: "Qty", C1: "Unit price", D1: "Line total",
        A2: "LP-03", B2: 10,
        A3: "CH-01", B3: 4,
        A4: "KB-05", B4: 12,
        A5: "DK-02", B5: 2,
        A6: "MN-04", B6: 3,
      },
      formats: { "I2:I6": "number2", "C2:C6": "number2", "D2:D6": "number2" },
      entryCells: ["C2", "D2"],
      fills: [{ from: "C2", to: "C6" }, { from: "D2", to: "D6" }],
      solution: {
        C2: "=VLOOKUP(A2,$G$2:$I$6,3,FALSE)",
        D2: "=B2*C2",
      },
      hints: [
        "The code to look for is in A2; the table to look in is G2:I6.",
        "Price is the third column of that range, so the column number is 3.",
        "Pin the range so it does not slide as the formula fills: $G$2:$I$6. End with FALSE.",
      ],
      checks: [
        { type: "usesFunction", cell: "C2", any: ["VLOOKUP", "XLOOKUP", "INDEX"], name: "C2 uses a lookup" },
        { type: "value", cell: "C2", equals: 24, name: "the lamp costs 24" },
        {
          type: "block", from: "C2:C6", tolerance: 0.001, name: "every line finds its price",
          equals: [[24], [89], [32.5], [295], [145]],
        },
        {
          type: "block", from: "D2:D6", tolerance: 0.001, name: "and every line total is right",
          equals: [[240], [356], [390], [590], [435]],
        },
        { type: "robust", cell: "C3", changes: { I2: 100 }, equals: 100, name: "changing the price list updates the order" },
        { type: "robust", cell: "C2", changes: { A2: "MN-04" }, equals: 145, name: "changing a code fetches a different price" },
        { type: "robust", cell: "D2", changes: { B2: 3 }, equals: 72, name: "the line total follows the quantity" },
      ],
    },
    {
      id: "lookups-2",
      title: "When the code is not there",
      prompt: `
        <p>Two of these order lines use codes that are not in the price list, and one uses
        a code that is. Right now the column would show <code>#N/A</code> twice.</p>
        <p>In <strong>C2</strong> (fills down), look the price up and show
        <code>Not listed</code> when the code cannot be found.</p>
        <p>The column should read: <code>24</code>, <code>Not listed</code>,
        <code>89</code>, <code>Not listed</code>, <code>295</code>.</p>
        <p>Note what <code>#N/A</code> was telling you. It is not noise — it is the sheet
        reporting a genuine gap in your data, and you should only silence it once you have
        decided the gap is expected.</p>
      `,
      rows: 10,
      columns: 10,
      data: {
        ...PRICE_LIST,
        A1: "Code", B1: "Qty", C1: "Unit price",
        A2: "LP-03", B2: 10,
        A3: "ZZ-99", B3: 4,
        A4: "CH-01", B4: 12,
        A5: "XX-00", B5: 2,
        A6: "DK-02", B6: 3,
      },
      formats: { "I2:I6": "number2" },
      entryCells: ["C2"],
      fills: [{ from: "C2", to: "C6" }],
      solution: { C2: '=IFERROR(VLOOKUP(A2,$G$2:$I$6,3,FALSE),"Not listed")' },
      hints: [
        "Write the working VLOOKUP first, then wrap it.",
        'IFERROR takes the thing to try, then what to show if it fails: =IFERROR(<the lookup>,"Not listed")',
        '=IFERROR(VLOOKUP(A2,$G$2:$I$6,3,FALSE),"Not listed")',
      ],
      checks: [
        { type: "usesFunction", cell: "C2", any: ["IFERROR", "IFNA", "XLOOKUP"], name: "C2 handles the missing case" },
        { type: "value", cell: "C2", equals: 24, name: "a known code still gets its price" },
        { type: "value", cell: "C3", equals: "Not listed", name: "ZZ-99 shows Not listed" },
        { type: "value", cell: "C5", equals: "Not listed", name: "XX-00 does too" },
        {
          type: "block", from: "C2:C6", name: "the whole column reads correctly",
          equals: [[24], ["Not listed"], [89], ["Not listed"], [295]],
        },
        { type: "robust", cell: "C3", changes: { A3: "MN-04" }, equals: 145, name: "correcting a code makes the price appear" },
        { type: "robust", cell: "C2", changes: { A2: "QQ-11" }, equals: "Not listed", name: "and breaking a good code shows Not listed" },
      ],
    },
    {
      id: "lookups-3",
      title: "Look to the left",
      prompt: `
        <p>Now the other way round: column A holds product <strong>names</strong>, and you
        need each one's <strong>code</strong>.</p>
        <p>In the price list, the name is in column H and the code is in column G — the
        answer is to the <em>left</em> of the thing you are searching for, so
        <code>VLOOKUP</code> cannot do this at all.</p>
        <p>Use <code>INDEX</code> and <code>MATCH</code> in <strong>B2</strong> (fills
        down). B2 should be <code>MN-04</code>.</p>
        <p><code>MATCH</code> finds which row the name is on; <code>INDEX</code> pulls that
        row out of the code column.</p>
      `,
      rows: 10,
      columns: 10,
      data: {
        ...PRICE_LIST,
        A1: "Product", B1: "Code",
        A2: "Monitor", A3: "Chair", A4: "Lamp", A5: "Desk", A6: "Keyboard",
      },
      formats: { "I2:I6": "number2" },
      entryCells: ["B2"],
      fills: [{ from: "B2", to: "B6" }],
      solution: { B2: "=INDEX($G$2:$G$6,MATCH(A2,$H$2:$H$6,0))" },
      hints: [
        "Start with MATCH on its own: =MATCH(A2,$H$2:$H$6,0) tells you which row the name is on.",
        "Then INDEX pulls that position out of the code column: =INDEX($G$2:$G$6, <that row>)",
        "Put them together: =INDEX($G$2:$G$6,MATCH(A2,$H$2:$H$6,0)). Do not forget the 0.",
      ],
      checks: [
        { type: "usesFunction", cell: "B2", any: ["INDEX", "XLOOKUP"], name: "B2 uses INDEX/MATCH or XLOOKUP" },
        { type: "value", cell: "B2", equals: "MN-04", name: "Monitor is MN-04" },
        {
          type: "block", from: "B2:B6", name: "every product finds its code",
          equals: [["MN-04"], ["CH-01"], ["LP-03"], ["DK-02"], ["KB-05"]],
        },
        { type: "robust", cell: "B2", changes: { A2: "Desk" }, equals: "DK-02", name: "changing the product changes the code" },
        { type: "robust", cell: "B3", changes: { G2: "CH-99" }, equals: "CH-99", name: "editing the price list updates the answer" },
      ],
    },
  ],
};
