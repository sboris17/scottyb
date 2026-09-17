/**
 * Exercise checking.
 *
 * Checks are declarative data in the lesson files, so the same definitions drive
 * the browser and the CI verifier.
 *
 * The important one is `robust`: it changes an input, recalculates, and insists the
 * answer follows. That is the spreadsheet equivalent of refusing to accept a
 * hard-coded answer — typing 4250 into the total passes a value check and fails
 * this one, which is exactly the habit a certification course should be breaking.
 */

import { isError, isBlank, toText, displayValue } from "./values.js";
import { Sheet } from "./sheet.js";
import { expandReference } from "./sheet.js";
import { expandEntries } from "./fill.js";

function show(value) {
  if (isError(value)) return value.type;
  if (isBlank(value)) return "(empty)";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return JSON.stringify(value.map((row) => row.map((cell) => (isError(cell) ? cell.type : cell))));
  return String(value);
}

function numbersMatch(actual, expected, tolerance) {
  const slack = tolerance === undefined ? 1e-9 : tolerance;
  return typeof actual === "number" && Math.abs(actual - expected) <= slack;
}

function valuesMatch(actual, expected, tolerance) {
  if (typeof expected === "number") return numbersMatch(actual, expected, tolerance);
  if (typeof expected === "string") {
    return typeof actual === "string" && actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  if (typeof expected === "boolean") return actual === expected;
  if (expected === null) return isBlank(actual);
  return false;
}

function gridMatch(actual, expected, tolerance) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  for (let row = 0; row < expected.length; row++) {
    const expectedRow = expected[row];
    const actualRow = actual[row];
    if (!Array.isArray(actualRow) || actualRow.length !== expectedRow.length) return false;
    for (let column = 0; column < expectedRow.length; column++) {
      if (!valuesMatch(actualRow[column], expectedRow[column], tolerance)) return false;
    }
  }
  return true;
}

/** Reads a rectangular block of values, e.g. "D2:D8". */
function readBlock(sheet, reference) {
  const cells = expandReference(reference);
  if (cells.length === 0) return [];
  const rows = [...new Set(cells.map((cell) => cell.row))].sort((a, b) => a - b);
  const columns = [...new Set(cells.map((cell) => cell.col))].sort((a, b) => a - b);
  return rows.map((row) => columns.map((col) => sheet.getCellValue(col, row)));
}

/** Runs one check and returns { name, passed, message }. */
function runCheck(sheet, check) {
  const name = check.name;

  switch (check.type) {
    case "value": {
      const actual = sheet.valueAt(check.cell);
      if (isError(actual)) {
        return { name, passed: false, message: `${check.cell} is showing ${actual.type} — ${actual.detail || "the formula could not be worked out"}` };
      }
      if (!valuesMatch(actual, check.equals, check.tolerance)) {
        return { name, passed: false, message: `${check.cell} should be ${show(check.equals)} but it is ${show(actual)}` };
      }
      return { name, passed: true };
    }

    case "display": {
      const actual = sheet.displayAt(check.cell);
      if (actual !== check.equals) {
        return { name, passed: false, message: `${check.cell} should show ${JSON.stringify(check.equals)} but it shows ${JSON.stringify(actual)}` };
      }
      return { name, passed: true };
    }

    case "block": {
      const actual = readBlock(sheet, check.from);
      const firstError = actual.flat().find((value) => isError(value));
      if (firstError) {
        return { name, passed: false, message: `${check.from} contains ${firstError.type} — ${firstError.detail || "a formula could not be worked out"}` };
      }
      if (!gridMatch(actual, check.equals, check.tolerance)) {
        return { name, passed: false, message: `${check.from} should be ${show(check.equals)} but it is ${show(actual)}` };
      }
      return { name, passed: true };
    }

    case "spill": {
      const actual = sheet.spilledBlockAt(check.cell);
      const anchor = sheet.valueAt(check.cell);
      if (isError(anchor)) {
        return { name, passed: false, message: `${check.cell} is showing ${anchor.type} — ${anchor.detail || "the formula could not be worked out"}` };
      }
      if (!gridMatch(actual, check.equals, check.tolerance)) {
        return { name, passed: false, message: `${check.cell} should spill ${show(check.equals)} but it spills ${show(actual)}` };
      }
      return { name, passed: true };
    }

    case "isFormula": {
      const formula = sheet.formulaAt(check.cell);
      if (formula === null) {
        const typed = sheet.getInput(check.cell);
        return {
          name,
          passed: false,
          message: typed
            ? `${check.cell} holds the typed value ${JSON.stringify(typed)}. It needs a formula — start it with =`
            : `${check.cell} is empty. It needs a formula, starting with =`,
        };
      }
      return { name, passed: true };
    }

    case "usesFunction": {
      const used = sheet.functionsAt(check.cell);
      const wanted = [].concat(check.any || check.all || []);
      if (check.all) {
        const missing = wanted.filter((fn) => !used.has(fn));
        if (missing.length) {
          return { name, passed: false, message: `${check.cell} needs to use ${missing.join(" and ")}` };
        }
      } else if (!wanted.some((fn) => used.has(fn))) {
        const list = wanted.length === 1 ? wanted[0] : wanted.slice(0, -1).join(", ") + " or " + wanted[wanted.length - 1];
        return { name, passed: false, message: `${check.cell} needs to use ${list}` };
      }
      return { name, passed: true };
    }

    case "avoidsFunction": {
      const used = sheet.functionsAt(check.cell);
      const banned = [].concat(check.functions || []);
      const found = banned.filter((fn) => used.has(fn));
      if (found.length) {
        return { name, passed: false, message: `${check.cell} should not use ${found.join(" or ")} for this one` };
      }
      return { name, passed: true };
    }

    case "referencesCells": {
      if (!sheet.referencesCellsAt(check.cell)) {
        return { name, passed: false, message: `${check.cell} should refer to cells rather than having the numbers typed into it` };
      }
      return { name, passed: true };
    }

    case "noError": {
      const actual = sheet.valueAt(check.cell);
      if (isError(actual)) {
        return { name, passed: false, message: `${check.cell} is showing ${actual.type} — ${actual.detail || ""}`.trim() };
      }
      return { name, passed: true };
    }

    /**
     * Change an input, recalculate, and require the answer to follow.
     * This is what separates a formula from a typed-in number.
     */
    case "robust": {
      const copy = sheet.clone();
      for (const [reference, value] of Object.entries(check.changes)) {
        copy.setInput(reference, value);
      }
      const actual = copy.valueAt(check.cell);
      if (isError(actual)) {
        return { name, passed: false, message: `after changing ${Object.keys(check.changes).join(", ")}, ${check.cell} shows ${actual.type}` };
      }
      if (!valuesMatch(actual, check.equals, check.tolerance)) {
        const described = Object.entries(check.changes)
          .map(([reference, value]) => `${reference} to ${JSON.stringify(value)}`)
          .join(" and ");
        return {
          name,
          passed: false,
          message: `with ${described}, ${check.cell} should become ${show(check.equals)} but it is ${show(actual)}. A typed-in answer will not update — use a formula that reads the cells.`,
        };
      }
      return { name, passed: true };
    }

    /** Like `robust`, but for a whole block of formulas. */
    case "robustBlock": {
      const copy = sheet.clone();
      for (const [reference, value] of Object.entries(check.changes)) copy.setInput(reference, value);
      const actual = readBlock(copy, check.from);
      if (!gridMatch(actual, check.equals, check.tolerance)) {
        const described = Object.entries(check.changes)
          .map(([reference, value]) => `${reference} to ${JSON.stringify(value)}`)
          .join(" and ");
        return {
          name,
          passed: false,
          message: `with ${described}, ${check.from} should become ${show(check.equals)} but it is ${show(actual)}`,
        };
      }
      return { name, passed: true };
    }

    case "unchanged": {
      for (const reference of [].concat(check.cells)) {
        const expected = check.expected[reference];
        const actual = sheet.getInput(reference);
        if (actual !== String(expected)) {
          return { name, passed: false, message: `${reference} was changed. Leave the supplied data alone and work in the answer cells.` };
        }
      }
      return { name, passed: true };
    }

    default:
      return { name: name || "unknown check", passed: false, message: `unknown check type "${check.type}"` };
  }
}

/** Runs every check for an exercise against the learner's sheet. */
export function runChecks(sheet, checks) {
  return checks.map((check) => {
    try {
      return runCheck(sheet, check);
    } catch (error) {
      return { name: check.name, passed: false, message: `the check could not run: ${error.message}` };
    }
  });
}

/** Builds a sheet for an exercise: the supplied data, plus whatever is typed in. */
export function buildSheet(exercise, entries) {
  const sheet = new Sheet({
    cells: { ...exercise.data },
    formats: exercise.formats || {},
    locked: exercise.locked || Object.keys(exercise.data || {}),
    rows: exercise.rows || 14,
    columns: exercise.columns || 7,
    columnWidths: exercise.columnWidths || {},
  });
  for (const [reference, value] of Object.entries(expandEntries(exercise, entries || {}))) {
    sheet.setInput(reference, value, { silent: true });
  }
  sheet.invalidate();
  return sheet;
}
