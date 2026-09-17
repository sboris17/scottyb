import { ymdToSerial as day } from "../src/values.js";

export default {
  id: "08-dates",
  title: "Dates",
  summary: "Why dates are secretly numbers, and the functions that make them behave.",
  minutes: 16,
  sections: [
    {
      heading: "A date is a number wearing a costume",
      body: `
        <p>Underneath, a date is a count of days since 30 December 1899. 1 January 2024 is
        the number <strong>45292</strong>. The date you see is that number in a date
        format — change the cell's format to plain number and the disguise falls off.</p>
        <p>Two useful consequences follow immediately:</p>
        <ul>
          <li><strong>You can do arithmetic on dates.</strong> <code>=B2+30</code> is thirty
          days later. <code>=C2-B2</code> is the number of days between two dates, because
          subtracting one count of days from another gives a count of days.</li>
          <li><strong>Sorting and comparing just work</strong> — <code>&gt;</code> on dates
          means "later than".</li>
        </ul>
        <p>If a date is sitting on the <em>left</em> of its cell, Sheets has stored it as
        text, and none of this will work. That is the first thing to check when date
        arithmetic gives nonsense.</p>
        <p class="notice">In this course <code>TODAY()</code> always reports
        <strong>17 June 2024</strong>, so that exercises give the same answer whenever you
        take them. In a real sheet it is genuinely today, and changes overnight.</p>
      `,
    },
    {
      heading: "Building and taking apart",
      body: `
        <pre class="sample"><code>=TODAY()                    today's date
=DATE(2024, 3, 15)          15 March 2024
=YEAR(B2)  =MONTH(B2)  =DAY(B2)
=WEEKDAY(B2)                1 = Sunday
=WEEKDAY(B2, 2)             1 = Monday, which is usually what you want</code></pre>
        <p><code>DATE</code> handles overflow sensibly, which is more useful than it
        sounds: <code>DATE(2024,13,1)</code> is January 2025, and
        <code>DATE(2024,3,0)</code> is the last day of February. That means you can do
        month arithmetic without special-casing December.</p>
      `,
    },
    {
      heading: "Month ends and month steps",
      body: `
        <pre class="sample"><code>=EOMONTH(B2, 0)     the last day of B2's month
=EOMONTH(B2, 1)     the last day of next month
=EOMONTH(B2, -1)    the last day of last month
=EDATE(B2, 3)       the same day, three months on</code></pre>
        <p><code>EDATE</code> is careful where naive arithmetic is not: three months after
        31 January is 30 April, not the 31st of a month that has 30 days. Adding 90 days
        would give you a different answer again, and a worse one.</p>
        <p>For "the first of next month", use <code>=EOMONTH(B2,0)+1</code>.</p>
      `,
    },
    {
      heading: "Differences",
      body: `
        <pre class="sample"><code>=C2-B2                      days between, plainly
=DATEDIF(B2, C2, "D")       the same
=DATEDIF(B2, C2, "M")       whole months between
=DATEDIF(B2, C2, "Y")       whole years — this is how you calculate an age
=NETWORKDAYS(B2, C2)        working days, excluding weekends</code></pre>
        <p><code>DATEDIF</code> counts <strong>completed</strong> units, which is exactly
        what you want for an age or a length of service. Its start date must come first,
        or it reports an error.</p>
        <p><code>NETWORKDAYS</code> counts both endpoints and skips Saturdays and Sundays.
        A third argument can take a range of public holidays to skip as well.</p>
        <p>Finally, <code>TEXT</code> formats a date into readable text:
        <code>=TEXT(B2,"mmm yyyy")</code> gives <code>Mar 2024</code>, which is how you get
        a month label to group by.</p>
      `,
    },
  ],
  exercises: [
    {
      id: "dates-1",
      title: "Due dates",
      prompt: `
        <p>Each invoice has an issue date and payment terms in days.</p>
        <ul>
          <li><strong>D2</strong> (fills down) — the due date: the issue date plus the
          terms. The first one falls on <strong>14/04/2024</strong>.</li>
          <li><strong>G2</strong> — how many days separate the earliest and latest issue
          dates (<code>142</code>). Use MAX and MIN rather than picking the rows by eye;
          a new invoice should not break it.</li>
        </ul>
      `,
      rows: 9,
      columns: 8,
      data: {
        A1: "Invoice", B1: "Issued", C1: "Terms (days)", D1: "Due",
        A2: "INV-101", B2: "2024-03-15", C2: 30,
        A3: "INV-102", B3: "2024-05-01", C3: 14,
        A4: "INV-103", B4: "2024-06-10", C4: 30,
        A5: "INV-104", B5: "2024-01-20", C5: 60,
        F1: "Spread of issue dates", F2: "Days",
      },
      formats: { "B2:B5": "date", "D2:D5": "date" },
      columnWidths: { C: 110, F: 160 },
      entryCells: ["D2", "G2"],
      fills: [{ from: "D2", to: "D5" }],
      solution: { D2: "=B2+C2", G2: "=MAX(B2:B5)-MIN(B2:B5)" },
      hints: [
        "A date plus a number of days is just addition — no function needed.",
        "For the spread, the latest date minus the earliest is a count of days.",
        "=MAX(B2:B5)-MIN(B2:B5)",
      ],
      checks: [
        { type: "value", cell: "D2", equals: day(2024, 4, 14), name: "INV-101 is due on 14 April 2024" },
        { type: "display", cell: "D2", equals: "14/04/2024", name: "and it displays as a date" },
        {
          type: "block", from: "D2:D5", name: "every due date is right",
          equals: [[day(2024, 4, 14)], [day(2024, 5, 15)], [day(2024, 7, 10)], [day(2024, 3, 20)]],
        },
        { type: "value", cell: "G2", equals: 142, name: "the issue dates span 142 days" },
        { type: "robust", cell: "D3", changes: { C3: 45 }, equals: day(2024, 6, 15), name: "longer terms push the due date out" },
        { type: "robust", cell: "G2", changes: { B4: "2024-12-31" }, equals: 346, name: "a later invoice widens the spread" },
      ],
    },
    {
      id: "dates-2",
      title: "Month ends and anniversaries",
      prompt: `
        <p>A list of subscriptions. For each one:</p>
        <ul>
          <li><strong>C2</strong> (fills down) — the last day of the month it started in.
          The first is <strong>31/01/2024</strong>.</li>
          <li><strong>D2</strong> (fills down) — the renewal date, twelve months after the
          start. The first is <strong>31/01/2025</strong>.</li>
          <li><strong>E2</strong> (fills down) — how many <strong>complete months</strong>
          have passed between the start date and today. The first is <code>4</code>.</li>
        </ul>
        <p>Watch D3: the subscription starting 31 August cannot renew on 31 February, and
        the right function handles that for you.</p>
      `,
      rows: 9,
      columns: 7,
      data: {
        A1: "Customer", B1: "Started", C1: "First month end", D1: "Renews", E1: "Months so far",
        A2: "Northwind", B2: "2024-01-31",
        A3: "Bletchley", B3: "2023-08-31",
        A4: "Navy Yard", B4: "2024-02-29",
        A5: "Ada Corp", B5: "2022-11-15",
      },
      formats: { "B2:B5": "date", "C2:C5": "date", "D2:D5": "date" },
      columnWidths: { C: 140, E: 120 },
      entryCells: ["C2", "D2", "E2"],
      fills: [{ from: "C2", to: "C5" }, { from: "D2", to: "D5" }, { from: "E2", to: "E5" }],
      solution: {
        C2: "=EOMONTH(B2,0)",
        D2: "=EDATE(B2,12)",
        E2: '=DATEDIF(B2,TODAY(),"M")',
      },
      hints: [
        "EOMONTH with an offset of 0 means the end of this date's own month.",
        "EDATE moves by whole months and copes with short ones — twelve months is EDATE(B2,12).",
        'DATEDIF counts completed units: =DATEDIF(B2,TODAY(),"M")',
      ],
      checks: [
        { type: "usesFunction", cell: "C2", any: ["EOMONTH"], name: "C2 uses EOMONTH" },
        { type: "value", cell: "C2", equals: day(2024, 1, 31), name: "January ends on the 31st" },
        { type: "value", cell: "C4", equals: day(2024, 2, 29), name: "February 2024 ends on the 29th — it is a leap year" },
        { type: "usesFunction", cell: "D2", any: ["EDATE"], name: "D2 uses EDATE" },
        { type: "value", cell: "D2", equals: day(2025, 1, 31), name: "Northwind renews on 31 January 2025" },
        { type: "value", cell: "D3", equals: day(2024, 8, 31), name: "Bletchley renews on 31 August 2024" },
        { type: "usesFunction", cell: "E2", any: ["DATEDIF"], name: "E2 uses DATEDIF" },
        {
          type: "block", from: "E2:E5", name: "the elapsed months are right",
          equals: [[4], [9], [3], [19]],
        },
        { type: "robust", cell: "D2", changes: { B2: "2024-08-31" }, equals: day(2025, 8, 31), name: "a different start moves the renewal" },
        { type: "robust", cell: "C2", changes: { B2: "2024-04-02" }, equals: day(2024, 4, 30), name: "and the month end follows it" },
      ],
    },
    {
      id: "dates-3",
      title: "Working days and a readable label",
      prompt: `
        <p>Back to the invoices.</p>
        <ul>
          <li><strong>E2</strong> (fills down) — the number of <strong>working days</strong>
          between the issue date and the due date, weekends excluded. The first is
          <code>21</code>.</li>
          <li><strong>F2</strong> (fills down) — a month label for the issue date, in the
          form <code>Mar 2024</code>. This is the column you would later group a report by.</li>
        </ul>
      `,
      rows: 9,
      columns: 7,
      data: {
        A1: "Invoice", B1: "Issued", C1: "Due", E1: "Working days", F1: "Month",
        A2: "INV-101", B2: "2024-03-15", C2: "2024-04-14",
        A3: "INV-102", B3: "2024-05-01", C3: "2024-05-15",
        A4: "INV-103", B4: "2024-06-10", C4: "2024-07-10",
        A5: "INV-104", B5: "2024-01-20", C5: "2024-03-20",
      },
      formats: { "B2:B5": "date", "C2:C5": "date" },
      columnWidths: { E: 130 },
      entryCells: ["E2", "F2"],
      fills: [{ from: "E2", to: "E5" }, { from: "F2", to: "F5" }],
      solution: {
        E2: "=NETWORKDAYS(B2,C2)",
        F2: '=TEXT(B2,"mmm yyyy")',
      },
      hints: [
        "NETWORKDAYS takes the two dates and skips Saturdays and Sundays for you.",
        'TEXT takes the value and a format: =TEXT(B2,"mmm yyyy")',
        'Three letters of m gives the short month name; four would give the full one.',
      ],
      checks: [
        { type: "usesFunction", cell: "E2", any: ["NETWORKDAYS"], name: "E2 uses NETWORKDAYS" },
        { type: "value", cell: "E2", equals: 21, name: "INV-101 spans 21 working days" },
        {
          type: "block", from: "E2:E5", name: "the working-day counts are right",
          equals: [[21], [11], [23], [43]],
        },
        { type: "usesFunction", cell: "F2", any: ["TEXT"], name: "F2 uses TEXT" },
        { type: "value", cell: "F2", equals: "Mar 2024", name: "the label reads Mar 2024" },
        {
          type: "block", from: "F2:F5", name: "every month label is right",
          equals: [["Mar 2024"], ["May 2024"], ["Jun 2024"], ["Jan 2024"]],
        },
        { type: "robust", cell: "F2", changes: { B2: "2023-12-01" }, equals: "Dec 2023", name: "a different date relabels correctly" },
        { type: "robust", cell: "E3", changes: { C3: "2024-05-08" }, equals: 6, name: "a nearer due date shortens the working-day count" },
      ],
    },
  ],
};
