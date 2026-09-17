export default {
  id: "01-grid",
  title: "The Grid",
  summary: "Cells, references and your first formulas — and why a formula beats a typed-in answer every time.",
  minutes: 12,
  sections: [
    {
      heading: "Everything has an address",
      body: `
        <p>A spreadsheet is a grid. Columns have letters, rows have numbers, and every
        cell has an address made of the two: <code>B7</code> is column B, row 7. That
        address is called a <strong>reference</strong>, and it is the single idea the
        rest of this course is built on.</p>
        <p>A cell holds one of three things:</p>
        <ul>
          <li>a <strong>number</strong> — <code>4.5</code>, <code>1200</code>, or a date</li>
          <li><strong>text</strong> — <code>North</code>, <code>Invoice 203</code></li>
          <li>a <strong>formula</strong> — anything starting with <code>=</code></li>
        </ul>
        <p>Numbers sit to the right of their cell by default and text sits to the left.
        That is a useful accident: if a number you typed is hugging the left edge,
        Sheets thinks it is text, and your sums will quietly ignore it.</p>
      `,
    },
    {
      heading: "The equals sign changes everything",
      body: `
        <p>Type <code>4*6</code> into a cell and you get the text "4*6". Type
        <code>=4*6</code> and you get 24. The <code>=</code> tells Sheets "what follows
        is a question, work it out".</p>
        <pre class="sample"><code>=4*6
=B2*C2
=(B2+B3)*0.2</code></pre>
        <p>The second one is the interesting one. Instead of numbers it uses
        <strong>references</strong>, so it means "whatever is in B2, multiplied by
        whatever is in C2". Change B2 and the answer updates by itself.</p>
        <p>This is the whole point of a spreadsheet, and it is the habit that separates
        someone who uses Sheets from someone who is really just using a calculator with
        a grid on it. <strong>Never type an answer you could calculate.</strong> The
        exercises in this course check that you haven't: they change the inputs behind
        your back and make sure your answer follows.</p>
      `,
    },
    {
      heading: "Arithmetic",
      body: `
        <p><code>+</code> add, <code>-</code> subtract, <code>*</code> multiply,
        <code>/</code> divide, <code>^</code> raise to a power, <code>%</code> percent.</p>
        <p>Multiplication and division happen before addition and subtraction, and
        brackets override that:</p>
        <pre class="sample"><code>=2+3*4        24 is wrong; this is 14
=(2+3)*4      20</code></pre>
        <p>A percentage is just a number: <code>10%</code> is <code>0.1</code>. So a 10%
        discount on the value in B2 is <code>=B2*10%</code>, or <code>=B2*0.1</code> —
        the same thing. To take the discount off, <code>=B2*(1-10%)</code>.</p>
      `,
    },
    {
      heading: "Getting around",
      body: `
        <ul>
          <li>Click a cell to select it. What it really contains — the formula, not the
          answer — appears in the formula bar above the grid.</li>
          <li><kbd>Enter</kbd> confirms and moves down; <kbd>Tab</kbd> confirms and moves
          right; <kbd>Esc</kbd> abandons the edit.</li>
          <li>Arrow keys move around the grid.</li>
        </ul>
        <p>In the exercises below, the cells you need to fill in are outlined. The
        supplied data is locked, so you cannot break it by accident.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "grid-1",
      title: "Your first formula",
      prompt: `
        <p>The order below needs a line total: the price multiplied by the quantity.</p>
        <p>Put a formula in <strong>D2</strong> that multiplies B2 by C2. It should come
        to <strong>27</strong>.</p>
        <p>Use the references, not the numbers — <code>=4.5*6</code> gives the right
        answer today and the wrong one tomorrow.</p>
      `,
      rows: 6,
      columns: 5,
      data: {
        A1: "Item", B1: "Price", C1: "Quantity", D1: "Line total",
        A2: "Notebook", B2: 4.5, C2: 6,
      },
      formats: { B2: "number2", D2: "number2" },
      entryCells: ["D2"],
      solution: { D2: "=B2*C2" },
      hints: [
        "Start the cell with = so Sheets knows it is a formula.",
        "Multiply with *. You want the price cell times the quantity cell.",
        "The formula is =B2*C2",
      ],
      checks: [
        { type: "isFormula", cell: "D2", name: "D2 holds a formula" },
        { type: "value", cell: "D2", equals: 27, name: "D2 comes to 27" },
        { type: "referencesCells", cell: "D2", name: "the formula refers to cells, not typed numbers" },
        { type: "robust", cell: "D2", changes: { C2: 10 }, equals: 45, name: "changing the quantity to 10 updates the total to 45" },
        { type: "robust", cell: "D2", changes: { B2: 10 }, equals: 60, name: "changing the price to 10 updates the total to 60" },
      ],
    },
    {
      id: "grid-2",
      title: "Brackets and percentages",
      prompt: `
        <p>Work out what the customer actually pays, in <strong>B6</strong>:</p>
        <ol>
          <li>take the subtotal in B2,</li>
          <li>take off the discount rate in B3 (it is stored as 0.1, meaning 10%),</li>
          <li>then add the delivery charge in B4.</li>
        </ol>
        <p>The answer is <strong>116</strong>. Delivery is charged after the discount, so
        it must not be discounted — get the brackets right.</p>
      `,
      rows: 8,
      columns: 4,
      data: {
        A1: "Order 4471", A2: "Subtotal", B2: 120, A3: "Discount rate", B3: 0.1,
        A4: "Delivery", B4: 8, A6: "To pay",
      },
      formats: { B3: "percent0", B2: "number2", B4: "number2", B6: "number2" },
      entryCells: ["B6"],
      solution: { B6: "=B2*(1-B3)+B4" },
      hints: [
        "The discounted subtotal is B2 minus B2*B3 — or, more neatly, B2*(1-B3).",
        "Delivery is added afterwards, so it sits outside the brackets.",
        "=B2*(1-B3)+B4",
      ],
      checks: [
        { type: "isFormula", cell: "B6", name: "B6 holds a formula" },
        { type: "value", cell: "B6", equals: 116, name: "B6 comes to 116" },
        { type: "robust", cell: "B6", changes: { B2: 200 }, equals: 188, name: "a subtotal of 200 gives 188" },
        { type: "robust", cell: "B6", changes: { B3: 0.25 }, equals: 98, name: "a 25% discount gives 98" },
        { type: "robust", cell: "B6", changes: { B4: 0 }, equals: 108, name: "free delivery gives 108 — delivery is not discounted" },
      ],
    },
    {
      id: "grid-3",
      title: "Make the total live",
      prompt: `
        <p>Four expenses are listed in B2:B5. Someone has added them up in their head and
        typed <code>60</code> into B7. That number is already wrong once anything changes.</p>
        <p>Replace it with a formula that adds the four cells together. Use
        <code>+</code> — the <code>SUM</code> function is the next lesson.</p>
        <p>The total is still 60 today. The difference is that now it will stay right.</p>
      `,
      rows: 9,
      columns: 4,
      data: {
        A1: "Expense", B1: "Amount",
        A2: "Travel", B2: 12,
        A3: "Materials", B3: 18,
        A4: "Postage", B4: 7,
        A5: "Refreshments", B5: 23,
        A7: "Total",
      },
      formats: { B2: "number2", B3: "number2", B4: "number2", B5: "number2", B7: "number2" },
      entryCells: ["B7"],
      starter: { B7: "60" },
      solution: { B7: "=B2+B3+B4+B5" },
      hints: [
        "Delete the 60 and start again with =",
        "Add the four cells one at a time, joined with +.",
        "=B2+B3+B4+B5",
      ],
      checks: [
        { type: "isFormula", cell: "B7", name: "B7 holds a formula rather than a typed number" },
        { type: "value", cell: "B7", equals: 60, name: "B7 still totals 60" },
        { type: "referencesCells", cell: "B7", name: "the formula refers to the expense cells" },
        { type: "robust", cell: "B7", changes: { B3: 0 }, equals: 42, name: "setting Materials to 0 drops the total to 42" },
        { type: "robust", cell: "B7", changes: { B2: 100, B5: 0 }, equals: 125, name: "changing two amounts updates the total" },
      ],
    },
  ],
};
