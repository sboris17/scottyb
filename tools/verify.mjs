#!/usr/bin/env node
/**
 * Verifies the course itself.
 *
 * For every exercise it checks that:
 *   1. the reference solution passes every check,
 *   2. the starter code does NOT pass, and
 *   3. the content is structurally complete.
 *
 * Point 2 is the one that catches real rot: it is easy to write a check so loose
 * that the untouched starter satisfies it, and a learner would then be congratulated
 * for doing nothing.
 *
 * Run with: npm run verify
 */

import { buildProgram } from "../src/harness.js";
import { lessons } from "../curriculum/index.js";

/** Runs code against checks in this process, exactly as the browser runner does. */
function execute(code, tests) {
  try {
    const result = new Function(buildProgram(code, tests))();
    return { ok: true, output: result.output, results: result.results };
  } catch (error) {
    return { ok: false, error: error.name + ": " + error.message };
  }
}

const failures = [];
const warnings = [];
let exerciseCount = 0;
let checkCount = 0;

for (const lesson of lessons) {
  console.log("\n" + lesson.id + "  " + lesson.title);

  if (!lesson.sections || lesson.sections.length === 0) {
    failures.push(lesson.id + ": lesson has no teaching sections");
  }
  if (!lesson.summary) {
    failures.push(lesson.id + ": lesson has no summary");
  }

  for (const exercise of lesson.exercises) {
    exerciseCount += 1;
    checkCount += exercise.tests.length;
    const label = lesson.id + "/" + exercise.id;

    if (!exercise.prompt || !exercise.prompt.trim()) failures.push(label + ": no prompt");
    if (!exercise.tests || exercise.tests.length === 0) failures.push(label + ": no checks");
    if (!exercise.solution || !exercise.solution.trim()) failures.push(label + ": no reference solution");
    if (!exercise.hints || exercise.hints.length === 0) warnings.push(label + ": no hints");

    // 1. The reference solution must pass everything.
    const solved = execute(exercise.solution, exercise.tests);
    if (!solved.ok) {
      failures.push(label + ": the reference solution crashed - " + solved.error);
      console.log("  CRASH " + exercise.id + " - " + solved.error);
      continue;
    }

    const failed = solved.results.filter((result) => !result.passed);
    if (failed.length > 0) {
      for (const result of failed) {
        failures.push(label + ': solution fails check "' + result.name + '" - ' + result.message);
      }
      console.log("  FAIL  " + exercise.id + " - " + failed.length + "/" + solved.results.length + " checks fail");
      continue;
    }

    // 2. The starter must not already pass, or the exercise asks for nothing.
    const started = execute(exercise.starter, exercise.tests);
    const starterPasses = started.ok && started.results.every((result) => result.passed);
    if (starterPasses) {
      failures.push(label + ": the starter code already passes every check");
      console.log("  NOOP  " + exercise.id + " - starter code already passes");
      continue;
    }

    console.log("  ok    " + exercise.id + " (" + solved.results.length + " checks)");
  }
}

console.log(
  "\n" + lessons.length + " lessons, " + exerciseCount + " exercises, " + checkCount + " checks."
);

for (const warning of warnings) {
  console.log("warning: " + warning);
}

if (failures.length > 0) {
  console.log("\n" + failures.length + " problem(s):");
  for (const failure of failures) console.log("  - " + failure);
  process.exit(1);
}

console.log("All exercises verified.");
