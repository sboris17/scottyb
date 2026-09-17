#!/usr/bin/env node
/**
 * Verifies the Sheets course.
 *
 * For every exercise:
 *   1. the reference solution passes every check,
 *   2. the starting state does NOT pass — otherwise the exercise asks for nothing,
 *   3. the content is structurally complete,
 *   4. every cell the solution fills is one the learner is allowed to edit, and
 *      every cell named as editable is actually used.
 *
 * Point 4 matters here in a way it did not in the coding course: an exercise whose
 * answer belongs in a locked cell is impossible, and one that offers an editable
 * cell it never checks is just confusing.
 */

import { lessons } from "../curriculum/index.js";
import { buildSheet, runChecks } from "../src/checker.js";
import { Sheet } from "../src/sheet.js";

const failures = [];
const warnings = [];
let exerciseCount = 0;
let checkCount = 0;

for (const lesson of lessons) {
  console.log("\n" + lesson.id + "  " + lesson.title);

  if (!lesson.sections || lesson.sections.length === 0) failures.push(lesson.id + ": no teaching sections");
  if (!lesson.summary) failures.push(lesson.id + ": no summary");

  for (const exercise of lesson.exercises) {
    exerciseCount += 1;
    checkCount += exercise.checks.length;
    const label = lesson.id + "/" + exercise.id;

    if (!exercise.prompt || !exercise.prompt.trim()) failures.push(label + ": no prompt");
    if (!exercise.checks || exercise.checks.length === 0) failures.push(label + ": no checks");
    if (!exercise.solution || Object.keys(exercise.solution).length === 0) failures.push(label + ": no reference solution");
    if (!exercise.entryCells || exercise.entryCells.length === 0) failures.push(label + ": no entry cells");
    if (!exercise.hints || exercise.hints.length === 0) warnings.push(label + ": no hints");
    for (const check of exercise.checks || []) {
      if (!check.name) failures.push(label + ": a check has no name");
    }

    // Every answer must go somewhere the learner can actually type.
    const entry = new Set(exercise.entryCells || []);
    for (const reference of Object.keys(exercise.solution || {})) {
      if (!entry.has(reference)) {
        failures.push(`${label}: the solution writes to ${reference}, which is not listed as an entry cell`);
      }
    }
    for (const reference of exercise.entryCells || []) {
      if (!(reference in (exercise.solution || {}))) {
        warnings.push(`${label}: ${reference} is offered as an entry cell but the solution never fills it`);
      }
      const probe = new Sheet({ cells: exercise.data || {}, locked: exercise.locked || Object.keys(exercise.data || {}) });
      if (probe.isLocked(reference)) {
        failures.push(`${label}: entry cell ${reference} is locked, so the exercise cannot be completed`);
      }
    }

    // 1. The reference solution must pass everything.
    let solvedResults;
    try {
      const sheet = buildSheet(exercise, { ...(exercise.starter || {}), ...exercise.solution });
      solvedResults = runChecks(sheet, exercise.checks);
    } catch (error) {
      failures.push(`${label}: checking the solution threw - ${error.message}`);
      console.log("  CRASH " + exercise.id + " - " + error.message);
      continue;
    }

    const failed = solvedResults.filter((result) => !result.passed);
    if (failed.length > 0) {
      for (const result of failed) {
        failures.push(`${label}: solution fails "${result.name}" - ${result.message}`);
      }
      console.log("  FAIL  " + exercise.id + " - " + failed.length + "/" + solvedResults.length + " checks fail");
      continue;
    }

    // 2. The starting state must not already pass.
    const startedSheet = buildSheet(exercise, exercise.starter || {});
    const startedResults = runChecks(startedSheet, exercise.checks);
    if (startedResults.every((result) => result.passed)) {
      failures.push(label + ": the starting state already passes every check");
      console.log("  NOOP  " + exercise.id + " - nothing to do");
      continue;
    }

    console.log("  ok    " + exercise.id + " (" + solvedResults.length + " checks)");
  }
}

console.log("\n" + lessons.length + " lessons, " + exerciseCount + " exercises, " + checkCount + " checks.");
for (const warning of warnings) console.log("warning: " + warning);

if (failures.length > 0) {
  console.log("\n" + failures.length + " problem(s):");
  for (const failure of failures) console.log("  - " + failure);
  process.exit(1);
}
console.log("All exercises verified.");
