export default {
  id: "07-text",
  title: "Working with Text",
  summary: "Cleaning up messy data and pulling the useful part out of a string.",
  minutes: 16,
  sections: [
    {
      heading: "Data arrives dirty",
      body: `
        <p>Text typed by humans has stray spaces, random capitals and inconsistent
        formats. Before you can group, count or look anything up, it has to be made
        consistent — and a lookup that fails because of a trailing space is one of the
        most annoying half-hours in spreadsheet work.</p>
        <pre class="sample"><code>=TRIM("  ada   lovelace ")   "ada lovelace"
=UPPER("ada")                "ADA"
=LOWER("ADA")                "ada"
=PROPER("ada lovelace")      "Ada Lovelace"</code></pre>
        <p><code>TRIM</code> removes spaces from both ends and collapses runs of spaces in
        the middle down to one. It is the first thing to reach for when a lookup
        mysteriously says <code>#N/A</code> even though you can see the value right there.</p>
      `,
    },
    {
      heading: "Joining",
      body: `
        <p><code>&amp;</code> glues text together:</p>
        <pre class="sample"><code>=A2&" "&B2                    Ada Lovelace
="Invoice "&C2&" — "&D2       note the spaces inside the quotes</code></pre>
        <p><code>CONCATENATE(A2," ",B2)</code> does the same thing with more typing.
        <code>TEXTJOIN</code> earns its keep when you have a list and a separator:</p>
        <pre class="sample"><code>=TEXTJOIN(", ", TRUE, A2:A9)   joins a whole range
                               TRUE means skip the empty cells</code></pre>
      `,
    },
    {
      heading: "Taking a string apart",
      body: `
        <pre class="sample"><code>=LEN("ORD-2024-0117")           13 characters
=LEFT("ORD-2024-0117", 3)       "ORD"
=RIGHT("ORD-2024-0117", 4)      "0117"
=MID("ORD-2024-0117", 5, 4)     "2024"  -- start at 5, take 4</code></pre>
        <p><code>MID</code> counts from 1, not 0: the first character is position 1.</p>
        <p>Fixed positions only work when the format never varies. When it does, find the
        landmark first:</p>
        <pre class="sample"><code>=FIND("@", B2)                  where the @ is
=LEFT(B2, FIND("@",B2)-1)       everything before it
=MID(B2, FIND("@",B2)+1, LEN(B2))   everything after it</code></pre>
        <p>The <code>-1</code> and <code>+1</code> are the whole trick: LEFT should stop
        one short of the @, and MID should start one past it. Get them wrong and you keep
        the @ or lose a character — check your answer against a real value rather than
        assuming.</p>
        <p>Passing a length to <code>MID</code> that runs past the end of the text is
        harmless, which is why <code>LEN(B2)</code> is a safe way to say "all the rest".</p>
        <p><code>FIND</code> is case-sensitive and <code>SEARCH</code> is not. Both report
        <code>#VALUE!</code> when the thing is not there, so wrap them in
        <code>IFERROR</code> if a miss is expected.</p>
      `,
    },
    {
      heading: "Text that looks like a number",
      body: `
        <p>Everything the text functions return is <strong>text</strong>, even when it
        looks numeric. <code>MID("ORD-2024-0117",5,4)</code> gives the text
        <code>"2024"</code>, which will not sort or sum as a year.</p>
        <p><code>VALUE</code> converts it: <code>=VALUE(MID(A2,5,4))</code> gives the number
        2024. Conversely, <code>TEXT</code> turns a number into formatted text —
        <code>=TEXT(A2,"dd/mm/yyyy")</code> — which is how you put a tidy date inside a
        sentence built with <code>&amp;</code>.</p>
        <p><code>SPLIT</code> cuts a string into several cells at once:
        <code>=SPLIT(A2,"-")</code> spreads ORD, 2024 and 0117 across three columns. It is
        covered properly in lesson 9, because what it returns is an array.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "text-1",
      title: "Clean up the names",
      prompt: `
        <p>These names arrived from a web form with stray spaces and shouted capitals.</p>
        <p>In <strong>C2</strong> (fills down), produce a tidy full name: first name, a
        space, surname — each properly capitalised and with the spaces cleaned up.</p>
        <p>C2 should be exactly <code>Ada Lovelace</code>, with one space and no others.</p>
      `,
      rows: 9,
      columns: 5,
      data: {
        A1: "First", B1: "Last", C1: "Full name",
        A2: "  ada ", B2: "LOVELACE",
        A3: "alan", B3: "  turing",
        A4: " GRACE  ", B4: "hopper",
        A5: "katherine", B5: "JOHNSON ",
        A6: " edsger", B6: "dijkstra ",
      },
      entryCells: ["C2"],
      fills: [{ from: "C2", to: "C6" }],
      solution: { C2: '=PROPER(TRIM(A2))&" "&PROPER(TRIM(B2))' },
      hints: [
        "TRIM removes the stray spaces; PROPER fixes the capitals.",
        'Join the two with & and a literal space in quotes: " "',
        '=PROPER(TRIM(A2))&" "&PROPER(TRIM(B2))',
      ],
      checks: [
        { type: "usesFunction", cell: "C2", all: ["TRIM"], name: "C2 uses TRIM" },
        { type: "usesFunction", cell: "C2", all: ["PROPER"], name: "C2 uses PROPER" },
        { type: "display", cell: "C2", equals: "Ada Lovelace", name: "C2 is exactly \"Ada Lovelace\"" },
        {
          type: "block", from: "C2:C6", name: "every name comes out tidy",
          equals: [["Ada Lovelace"], ["Alan Turing"], ["Grace Hopper"], ["Katherine Johnson"], ["Edsger Dijkstra"]],
        },
        { type: "robust", cell: "C2", changes: { A2: "  MARY " }, equals: "Mary Lovelace", name: "a new messy name is cleaned too" },
      ],
    },
    {
      id: "text-2",
      title: "Split an email address",
      prompt: `
        <p>Pull the two halves of each address apart.</p>
        <ul>
          <li><strong>B2</strong> (fills down) — everything <em>before</em> the @
          (<code>ada.lovelace</code>)</li>
          <li><strong>C2</strong> (fills down) — everything <em>after</em> it
          (<code>northwind.example</code>)</li>
        </ul>
        <p>The addresses are all different lengths, so counting characters will not do.
        Find the @ and work from there.</p>
      `,
      rows: 8,
      columns: 5,
      data: {
        A1: "Email", B1: "User", C1: "Domain",
        A2: "ada.lovelace@northwind.example",
        A3: "a.turing@bletchley.example",
        A4: "grace@navy.example",
        A5: "k.johnson@nasa.example",
      },
      columnWidths: { A: 230 },
      entryCells: ["B2", "C2"],
      fills: [{ from: "B2", to: "B5" }, { from: "C2", to: "C5" }],
      solution: {
        B2: '=LEFT(A2,FIND("@",A2)-1)',
        C2: '=MID(A2,FIND("@",A2)+1,LEN(A2))',
      },
      hints: [
        'FIND("@",A2) gives the position of the @ sign.',
        "LEFT should stop one character short of it, so subtract 1.",
        "MID should start one character past it, so add 1 — and LEN(A2) as the length safely means \"all the rest\".",
      ],
      checks: [
        { type: "usesFunction", cell: "B2", any: ["FIND", "SEARCH"], name: "B2 finds the @ rather than counting characters" },
        { type: "value", cell: "B2", equals: "ada.lovelace", name: "the user part is right" },
        { type: "value", cell: "C2", equals: "northwind.example", name: "the domain part is right" },
        {
          type: "block", from: "B2:B5", name: "every user name comes out",
          equals: [["ada.lovelace"], ["a.turing"], ["grace"], ["k.johnson"]],
        },
        {
          type: "block", from: "C2:C5", name: "every domain comes out",
          equals: [["northwind.example"], ["bletchley.example"], ["navy.example"], ["nasa.example"]],
        },
        { type: "robust", cell: "B2", changes: { A2: "x@y.example" }, equals: "x", name: "a much shorter address still splits correctly" },
        { type: "robust", cell: "C2", changes: { A2: "x@y.example" }, equals: "y.example", name: "and so does its domain" },
      ],
    },
    {
      id: "text-3",
      title: "Take a reference code apart",
      prompt: `
        <p>Every reference has the shape <code>ORD-2024-0117</code>: three letters, a
        four-digit year, and a four-digit sequence number.</p>
        <ul>
          <li><strong>B2</strong> — the three-letter prefix (<code>ORD</code>)</li>
          <li><strong>C2</strong> — the year <strong>as a number</strong>, not text
          (<code>2024</code>)</li>
          <li><strong>D2</strong> — a short code: the prefix, a hyphen, and the last four
          digits (<code>ORD-0117</code>)</li>
        </ul>
        <p>All three fill down. For C2, remember that the text functions hand back text —
        the check insists on a real number.</p>
      `,
      rows: 8,
      columns: 6,
      data: {
        A1: "Reference", B1: "Prefix", C1: "Year", D1: "Short code",
        A2: "ORD-2024-0117",
        A3: "INV-2023-0899",
        A4: "ORD-2024-1002",
        A5: "CRD-2022-0045",
      },
      columnWidths: { A: 140 },
      entryCells: ["B2", "C2", "D2"],
      fills: [{ from: "B2", to: "B5" }, { from: "C2", to: "C5" }, { from: "D2", to: "D5" }],
      solution: {
        B2: "=LEFT(A2,3)",
        C2: "=VALUE(MID(A2,5,4))",
        D2: '=B2&"-"&RIGHT(A2,4)',
      },
      hints: [
        "The prefix is the first three characters, so LEFT with 3.",
        "The year starts at position 5 and is 4 long: MID(A2,5,4). Wrap it in VALUE to make it a number.",
        'The short code joins three things with &: B2, the text "-", and RIGHT(A2,4).',
      ],
      checks: [
        { type: "value", cell: "B2", equals: "ORD", name: "the prefix is ORD" },
        { type: "value", cell: "C2", equals: 2024, name: "the year is 2024" },
        { type: "usesFunction", cell: "C2", any: ["VALUE"], name: "C2 converts the year to a number" },
        { type: "value", cell: "D2", equals: "ORD-0117", name: "the short code is ORD-0117" },
        {
          type: "block", from: "C2:C5", name: "the years are all numbers",
          equals: [[2024], [2023], [2024], [2022]],
        },
        {
          type: "block", from: "D2:D5", name: "every short code is right",
          equals: [["ORD-0117"], ["INV-0899"], ["ORD-1002"], ["CRD-0045"]],
        },
        { type: "robust", cell: "C2", changes: { A2: "ORD-1999-0117" }, equals: 1999, name: "a different year is read correctly" },
        { type: "robust", cell: "D2", changes: { A2: "XYZ-2024-9999" }, equals: "XYZ-9999", name: "a different reference rebuilds correctly" },
      ],
    },
  ],
};
