# Google Sheets 101

A certification-style Google Sheets course. **Ten lessons, 31 exercises, 203
automated checks** — every one worked in a live spreadsheet running in the browser,
with no installation, no Google account and no network access.

## Try it

```bash
open sheets/index.html        # macOS (xdg-open on Linux, start on Windows)
npm run serve                 # or serve the repo and visit /sheets/
```

## What it covers

| # | Lesson | Ground covered |
|---|--------|----------------|
| 01 | The Grid | References, `=`, arithmetic, why a formula beats a typed answer |
| 02 | Core Functions | SUM, AVERAGE, MIN/MAX, COUNT vs COUNTA, ROUND |
| 03 | References That Travel | Relative vs absolute, filling down, what `$` is for |
| 04 | Logic | IF, IFS, nested IFs, AND/OR/NOT, IFERROR |
| 05 | Counting and Summing on Conditions | COUNTIF(S), SUMIF(S), AVERAGEIF(S), criteria syntax |
| 06 | Lookups | VLOOKUP and its traps, INDEX/MATCH, XLOOKUP |
| 07 | Working with Text | TRIM/PROPER, LEFT/RIGHT/MID, FIND, `&`, VALUE |
| 08 | Dates | Date serial numbers, EOMONTH/EDATE, DATEDIF, NETWORKDAYS, TEXT |
| 09 | One Formula, Many Answers | ARRAYFORMULA, FILTER, SORT, UNIQUE, SEQUENCE, spilling |
| 10 | QUERY, and a Dashboard | The QUERY language, then a capstone dashboard |

Lessons 1–9 have three exercises each; lesson 10 has four.

## How it works

Each exercise is a real spreadsheet: a formula engine with about a hundred
functions, recalculation, spilling array results, and the same error values Sheets
produces. Nothing is faked with pre-baked answers — type `=SUMIF(A2:A13,"North",E2:E13)`
and it is genuinely evaluated.

Cells come in three kinds, shown by the key under each grid:

- **Entry** (outlined) — where your answer goes.
- **Supplied** (grey) — the lesson's data, locked so you cannot break it by accident.
- **Filled** (tinted) — written for you. Either the top cell of a column filled down,
  or a cell covered by a spilling formula. Click one and the formula bar shows what
  your formula actually became there, which is how lesson 3 makes `$` concrete.

### Checks are run twice

Every check runs on your sheet, and then again after **quietly changing the inputs
behind it**. Typing `27` into a total passes a value check; it fails when the price
changes to 10 and the total does not become 60.

That is the whole difference between a spreadsheet and a calculator, and it is the
single habit a certification course most needs to build. The checks enforce it:

```
✗ changing the quantity to 10 updates the total to 45
  with C2 to 10, D2 should become 45 but it is 27.
  A typed-in answer will not update — use a formula that reads the cells.
```

## Repository layout

```
index.html              The page shell
assets/styles.css       All styling (light and dark)
src/values.js           Value model: types, coercion, comparison, dates, display
src/parser.js           Formula tokenizer and parser
src/evaluate.js         Evaluator, including array broadcasting
src/functions.js        ~100 spreadsheet functions
src/query.js            The QUERY language
src/sheet.js            Cells, recalculation, spilling, cycle detection
src/fill.js             Copying formulas, and what `$` does when they move
src/checker.js          Declarative exercise checks
src/grid.js             The editable grid
src/progress.js         localStorage persistence, defensively wrapped
src/app.js              Router and lesson rendering
curriculum/*.js         The lessons — plain data, one module each
tools/engine-tests.mjs  200 assertions pinning the engine to real Sheets behaviour
tools/verify.mjs        Verifies the course itself
```

## Verifying

```bash
npm run test:engine      # 200 engine assertions
npm run verify:sheets    # every exercise
npm run verify           # both courses, everything
```

`tools/engine-tests.mjs` pins the engine to what Google Sheets actually does,
including the awkward corners: `MOD(-7,3)` is 2, text sorts after numbers, a blank
cell equals both `0` and `""`, `VLOOKUP` defaults to approximate matching, and
`DATE(2024,13,1)` rolls into 2025.

`tools/verify.mjs` checks, for all 31 exercises, that the reference solution passes
every check, that the starting state does **not** pass, that answers go in cells the
learner can actually edit, and that every lesson is structurally complete.

## Known simplifications

Honest about its own edges, since a course that lies to you is worse than one that
stops short:

- **One sheet per exercise.** No tabs, so no `Sheet2!A1` references.
- **`TODAY()` is fixed at 17 June 2024**, so exercises give the same answer whenever
  you take them.
- **Array broadcasting is always on.** In real Sheets some expressions need an
  explicit `ARRAYFORMULA`; here they would work without it. The lesson teaches the
  wrapper and the checks require it, because that is the habit that travels.
- **QUERY supports** `select`, `where`, `group by`, `order by`, `limit`, `offset` and
  `label`, with aggregates and the text operators. `pivot`, `format` and `options`
  report that they are unsupported rather than returning something wrong.
- **No formatting UI, charts, conditional formatting, data validation or pivot
  tables.** Those are worth learning; they are not formula skills, and they are not
  what this course is for.
- **`TEXT()` understands a common subset** of format strings, not the full grammar.

## Adding a lesson

1. Copy a file in `curriculum/`. A lesson needs `id`, `title`, `summary`, `minutes`,
   `sections` and `exercises`.
2. An exercise needs `data` (the supplied cells), `entryCells`, `solution`, `hints`,
   `checks`, and optionally `formats`, `fills`, `starter` and `columnWidths`.
3. Import it in `curriculum/index.js`.
4. Run `npm run verify:sheets`.

### Check types

| Type | Checks |
|------|--------|
| `value` | a cell equals a value (`tolerance` for floats) |
| `display` | a cell *shows* exact text, formatting included |
| `block` | a rectangular range equals a grid of values |
| `spill` | a formula's spilled block equals a grid of values |
| `isFormula` | the cell holds a formula, not a typed value |
| `usesFunction` | the formula uses `any` / `all` of the named functions |
| `avoidsFunction` | the formula does not use the named functions |
| `referencesCells` | the formula reads cells rather than literals |
| `noError` | the cell is not showing an error |
| `robust` | **change inputs, recalculate, and require the answer to follow** |
| `robustBlock` | the same, for a whole range |
