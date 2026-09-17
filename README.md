# Interactive courses

Two self-contained, zero-install courses. Both run in the browser from static files
— no build step, no accounts, no network access — and both check your work against
real assertions rather than comparing it to an expected answer.

| Course | What it teaches | Size |
|--------|-----------------|------|
| **[Coding 101](index.html)** (below) | Programming from scratch, in JavaScript | 10 lessons, 31 exercises, 159 checks |
| **[Google Sheets 101](sheets/)** | Spreadsheets from `=` to `QUERY` | 10 lessons, 31 exercises, 203 checks |

`npm run verify` checks both. See [`sheets/README.md`](sheets/README.md) for the
Sheets course, which ships its own formula engine.

---

# Coding 101

A hands-on introduction to programming for people who have never written a line of
code. **Ten lessons, 31 exercises, 159 automated checks** — all running in the
browser, with no installation, no accounts and no network access.

## Try it

Any one of these works:

```bash
# 1. Just open it
open index.html            # macOS  (xdg-open on Linux, start on Windows)

# 2. Or serve it, which is slightly better (see "A note on the two run modes")
npm run serve              # then visit http://localhost:8000
```

There is no build step and nothing to install. The whole course is static files.

## What it covers

| # | Lesson | Idea |
|---|--------|------|
| 01 | Hello, Code | Programs as ordered instructions; printing; comments |
| 02 | Variables & Values | `let` / `const`, reassignment, number / string / boolean |
| 03 | Strings & Text | Template literals, indexing, methods, immutability |
| 04 | Making Decisions | `if` / `else if` / `else`, `===`, `&&` `||` `!`, early return |
| 05 | Loops & Repetition | `for`, `while`, accumulators, off-by-one, `break` / `continue` |
| 06 | Functions | Parameters, `return` vs printing, defaults, scope, composition |
| 07 | Arrays | Indexing, mutation, `for...of`, `map` / `filter` / `reduce` |
| 08 | Objects | Keys and values, nesting, arrays of objects, `Object.keys` |
| 09 | Debugging & Errors | Reading error messages, the four silent bugs, how to bisect |
| 10 | Capstone | A study tracker built in four steps from everything above |

Lessons 1–9 have three exercises each; the capstone has four. Every exercise is
checked against real assertions — not a text comparison of your code — so a green
result means your solution genuinely works, including on the edge cases.

## How the exercises work

Each exercise gives you an editor with starter code. Write your answer, press
**Run checks** (or `Ctrl`/`Cmd` + `Enter`), and you get:

- a pass/fail line for every individual check, with a specific message on failure
  (`expected 3 but got undefined`, not `wrong`);
- everything your code printed, so `console.log` works as a debugging tool from
  lesson 1 onwards;
- progressive hints, one at a time, and a worked solution once you have tried twice
  or used every hint.

Progress and your in-progress code are saved to `localStorage`, so you can stop
mid-lesson and come back. If storage is unavailable (private browsing, blocked site
data) the course still runs, it just will not remember anything — and says so.

## A note on the two run modes

When the page is **served over http**, your code runs in a Web Worker with a
four-second timeout. An accidental infinite loop — extremely common when you are
learning `while` — is stopped and explained, and your work survives.

When the page is opened **directly from a file** (`file://`), browsers block workers,
so the code runs on the page itself and cannot be interrupted. Everything works, but
an infinite loop will freeze the tab and cost you a reload. The home page warns you
when you are in this mode. `npm run serve` avoids it.

## Repository layout

```
index.html            The page shell
assets/styles.css     All styling (light and dark, no frameworks)
src/harness.js        Sandbox preamble + assertions; builds the program to run
src/runner.js         Browser execution: Web Worker w/ timeout, inline fallback
src/progress.js       localStorage persistence, defensively wrapped
src/app.js            Router, lesson rendering, the exercise widget
curriculum/*.js       The lessons — plain data, one module each
tools/verify.mjs      Verifies the course itself (see below)
```

The curriculum is deliberately plain data with no dependency on the UI, which is why
the same lesson files can be rendered in a browser and verified in CI.

## Verifying the course

```bash
npm run verify:code    # this course
npm run verify         # both courses
```

This runs in CI on every push and checks, for all 31 exercises:

1. **The reference solution passes every check.** A lesson whose own answer no longer
   works is a broken lesson.
2. **The starter code does _not_ pass.** This is the check that catches real rot — it
   is easy to write an assertion loose enough that untouched starter code satisfies
   it, and a learner would then be congratulated for doing nothing.
3. **The content is structurally complete** — every exercise has a prompt, hints, a
   solution and at least one check; every lesson has a summary and teaching sections.

`tools/verify.mjs` and the browser build their program with the same
`buildProgram()` from `src/harness.js`, so an exercise that passes in one passes in
the other.

## Adding a lesson

1. Copy an existing file in `curriculum/` and edit it. A lesson needs `id`, `title`,
   `summary`, `minutes`, `sections` (heading + HTML body) and `exercises`.
2. An exercise needs `id`, `title`, `prompt`, `starter`, `solution`, `hints` and
   `tests` — each test being `{ name, code }`, where `code` uses the `assert` API.
3. Import it in `curriculum/index.js` and add it to the `lessons` array.
4. Run `npm run verify`. It will tell you if the solution fails or the starter passes.

### The assert API

Available inside any test's `code`, alongside the learner's own variables and
functions:

| Call | Checks |
|------|--------|
| `assert.equal(actual, expected)` | strict `===` equality |
| `assert.notEqual(actual, unexpected)` | strict inequality |
| `assert.deepEqual(actual, expected)` | arrays / objects, compared by value |
| `assert.close(actual, expected, tolerance?)` | floating-point comparison |
| `assert.ok(value)` / `assert.notOk(value)` | truthiness |
| `assert.type(value, "number")` | `typeof`, with `"array"` recognised |
| `assert.includes(haystack, needle)` | substring or array membership |
| `assert.throws(fn)` | the function throws |
| `assert.declared(() => name, "name")` | a variable exists, with a friendly message |
| `assert.printed(text)` | some printed line contains `text` |
| `assert.printedLines([...])` | the printed lines exactly, in order |
| `assert.printedCount(n)` | how many lines were printed |

`__SOURCE` holds the learner's code as text, for the occasional check that an answer
was worked out rather than typed in literally. Use it sparingly — checking behaviour
is almost always better than checking how something was written.
