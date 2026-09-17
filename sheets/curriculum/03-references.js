const ORDER_DATA = {
  A1: "Item", B1: "Qty", C1: "Price", D1: "Line total", E1: "Commission",
  A2: "Desk chair", B2: 4, C2: 89,
  A3: "Monitor", B3: 6, C3: 145,
  A4: "Keyboard", B4: 12, C4: 32.5,
  A5: "Mouse", B5: 12, C5: 18.75,
  A6: "Lamp", B6: 5, C6: 24,
  A7: "Cable", B7: 30, C7: 4.2,
  A8: "Dock", B8: 3, C8: 129,
  A9: "Stand", B9: 7, C9: 41,
};

const LINE_TOTALS = { D2: 356, D3: 870, D4: 390, D5: 225, D6: 120, D7: 126, D8: 387, D9: 287 };

export default {
  id: "03-references",
  title: "References That Travel",
  summary: "Relative and absolute references, and what the dollar sign is actually for.",
  minutes: 15,
  sections: [
    {
      heading: "A formula is a set of directions",
      body: `
        <p>When you write <code>=B2*C2</code> in D2, Sheets does not really record "B2
        times C2". It records "the cell two to my left, times the cell one to my left".
        The reference is <strong>relative</strong> to where the formula lives.</p>
        <p>That is why copying a formula down a column works. Copy <code>=B2*C2</code>
        from D2 into D3 and it becomes <code>=B3*C3</code> — the directions are the same,
        so the addresses shift. Write the formula once, fill it down a thousand rows, and
        every row does the right thing.</p>
        <p class="notice">In the exercises below, columns marked as filled work the same
        way: type the formula into the top cell and the rest of the column follows, exactly
        as dragging the little blue square in the corner of a cell does in Sheets.</p>
      `,
    },
    {
      heading: "When shifting is wrong",
      body: `
        <p>Now suppose every line needs multiplying by one commission rate, sitting in
        H2. In E2 you write <code>=D2*H2</code>. Fill it down and:</p>
        <pre class="sample"><code>E2:  =D2*H2     correct
E3:  =D3*H3     H3 is empty, so this is zero
E4:  =D4*H4     also zero
</code></pre>
        <p>The <code>D2</code> part was supposed to move. The <code>H2</code> part was not.
        Sheets cannot tell the difference — unless you say so.</p>
      `,
    },
    {
      heading: "The dollar sign pins a reference",
      body: `
        <p>A <code>$</code> means "do not shift this part when the formula is copied".</p>
        <pre class="sample"><code>H2      both parts shift          (relative)
$H$2    neither part shifts        (absolute)
H$2     the row is pinned, the column shifts
$H2     the column is pinned, the row shifts</code></pre>
        <p>So the fix is <code>=D2*$H$2</code>. Fill that down and every row multiplies its
        own line total by the one rate in H2.</p>
        <p>The rule of thumb: <strong>if a reference points at a single fixed cell that
        every row should use, pin it.</strong> If it points at this row's own data, leave
        it alone. Pressing <kbd>F4</kbd> while editing a reference in Sheets cycles through
        the four forms.</p>
        <p>The half-pinned forms are for filling in two directions at once — a
        multiplication table where the row headings are in column A and the column headings
        are in row 1 needs <code>=$A2*B$1</code>. Rare, but when you need it nothing else
        will do.</p>
      `,
    },
    {
      heading: "Named ranges, briefly",
      body: `
        <p>Sheets lets you name a cell or range (Data → Named ranges) and write
        <code>=D2*CommissionRate</code> instead of <code>=D2*$H$2</code>. Names are
        always absolute, and they make formulas far easier to read months later. This
        course sticks to <code>$</code> notation because that is what you will meet in
        other people's spreadsheets, but reach for names in your own work.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "references-1",
      title: "Fill a column down",
      prompt: `
        <p>Column D needs each line's total: quantity times price.</p>
        <p>Write the formula in <strong>D2</strong> only. The rest of the column fills
        itself, the way dragging the fill handle would.</p>
        <p>D2 should come to <code>356</code> and the column should end with
        <code>287</code> in D9.</p>
      `,
      rows: 12,
      columns: 6,
      data: { ...ORDER_DATA },
      formats: { "C2:C9": "number2", "D2:D9": "number2" },
      entryCells: ["D2"],
      fills: [{ from: "D2", to: "D9" }],
      solution: { D2: "=B2*C2" },
      hints: [
        "This row's quantity times this row's price.",
        "Use plain references with no dollar signs — every part of this formula should shift as it fills.",
        "=B2*C2",
      ],
      checks: [
        { type: "isFormula", cell: "D2", name: "D2 holds a formula" },
        { type: "value", cell: "D2", equals: 356, name: "D2 is 356" },
        {
          type: "block", from: "D2:D9", name: "the whole column fills correctly",
          equals: [[356], [870], [390], [225], [120], [126], [387], [287]],
        },
        { type: "robust", cell: "D5", changes: { B5: 20 }, equals: 375, name: "changing a quantity updates that row only" },
        { type: "robust", cell: "D9", changes: { C9: 50 }, equals: 350, name: "changing a price updates its row" },
      ],
    },
    {
      id: "references-2",
      title: "Pin the rate",
      prompt: `
        <p>Every line pays commission at the rate in <strong>H2</strong> (6%).</p>
        <p>Write a formula in <strong>E2</strong> that multiplies this row's line total by
        that rate, and make sure it still works when it fills down the column.</p>
        <p>E2 should be <code>21.36</code>, and E9 should be <code>17.22</code>. If the
        bottom of the column comes out as zeros, the rate reference is shifting when it
        should not be.</p>
      `,
      rows: 12,
      columns: 8,
      data: {
        ...ORDER_DATA, ...LINE_TOTALS,
        G1: "Commission rate", H2: 0.06, G2: "Rate",
      },
      formats: { "C2:C9": "number2", "D2:D9": "number2", "E2:E9": "number2", H2: "percent0" },
      entryCells: ["E2"],
      fills: [{ from: "E2", to: "E9" }],
      solution: { E2: "=D2*$H$2" },
      hints: [
        "The line total should shift as the formula fills; the rate should not.",
        "Put a dollar sign before both parts of the rate reference: $H$2",
        "=D2*$H$2",
      ],
      checks: [
        { type: "isFormula", cell: "E2", name: "E2 holds a formula" },
        { type: "value", cell: "E2", equals: 21.36, tolerance: 0.001, name: "E2 is 21.36" },
        {
          type: "block", from: "E2:E9", tolerance: 0.001, name: "the commission column is right all the way down",
          equals: [[21.36], [52.2], [23.4], [13.5], [7.2], [7.56], [23.22], [17.22]],
        },
        { type: "robust", cell: "E9", changes: { H2: 0.1 }, equals: 28.7, tolerance: 0.001, name: "raising the rate to 10% updates the bottom of the column" },
        { type: "robust", cell: "E2", changes: { H2: 0.1 }, equals: 35.6, tolerance: 0.001, name: "and the top of it" },
      ],
    },
    {
      id: "references-3",
      title: "Find the missing dollar signs",
      prompt: `
        <p>This sheet converts each line total into euros. The rate is in
        <strong>H2</strong>, and someone has already written the formula in
        <strong>D2</strong> — but the bottom of the column is full of zeros.</p>
        <p>Work out why, and fix D2 so the whole column converts properly. D2 is already
        correct at <code>416.52</code>; it is D3 downwards that is broken.</p>
        <p>Read the filled formulas as you go: clicking a filled cell shows what it
        actually became.</p>
      `,
      rows: 12,
      columns: 8,
      data: {
        A1: "Item", B1: "Total (GBP)", C1: "", D1: "Total (EUR)",
        A2: "Desk chair", B2: 356, A3: "Monitor", B3: 870, A4: "Keyboard", B4: 390,
        A5: "Mouse", B5: 225, A6: "Lamp", B6: 120, A7: "Cable", B7: 126,
        A8: "Dock", B8: 387, A9: "Stand", B9: 287,
        G1: "EUR per GBP", H2: 1.17, G2: "Rate",
      },
      formats: { "B2:B9": "number2", "D2:D9": "number2", H2: "number2" },
      entryCells: ["D2"],
      fills: [{ from: "D2", to: "D9" }],
      starter: { D2: "=B2*H2" },
      solution: { D2: "=B2*$H$2" },
      hints: [
        "Click D4 and look at the formula it was filled with. What is it multiplying by?",
        "H2 shifted to H3, H4, H5 as the formula filled, and those cells are empty.",
        "Pin the rate: =B2*$H$2",
      ],
      checks: [
        { type: "value", cell: "D2", equals: 416.52, tolerance: 0.001, name: "D2 is still 416.52" },
        {
          type: "block", from: "D2:D9", tolerance: 0.001, name: "every row converts, not just the first",
          equals: [[416.52], [1017.9], [456.3], [263.25], [140.4], [147.42], [452.79], [335.79]],
        },
        { type: "robust", cell: "D6", changes: { H2: 2 }, equals: 240, name: "changing the rate updates the middle of the column" },
        { type: "robust", cell: "D9", changes: { B9: 100 }, equals: 117, tolerance: 0.001, name: "changing a total updates its own row" },
      ],
    },
  ],
};
