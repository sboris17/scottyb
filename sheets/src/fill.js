/**
 * Copying formulas from one cell to another.
 *
 * When a formula moves, its relative references move with it and its absolute
 * ($) references stay put. That is the entire lesson behind the dollar sign, and
 * it only becomes real once you can actually fill a formula down a column — so the
 * course does the fill for you when you type into the top cell of a filled range.
 *
 * The rewrite is done on the formula text rather than by rebuilding it from the
 * AST, so what the learner typed comes back looking the way they wrote it.
 */

import { columnToIndex, indexToColumn } from "./parser.js";

const REFERENCE = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;

/**
 * Shifts the relative references in a formula by the given offset.
 *
 * @param {string} source   the formula, with or without its leading "="
 * @param {number} deltaCol columns to move by
 * @param {number} deltaRow rows to move by
 */
export function translateFormula(source, deltaCol, deltaRow) {
  const hasEquals = source.startsWith("=");
  const body = hasEquals ? source.slice(1) : source;

  let output = "";
  let index = 0;
  let inString = false;

  while (index < body.length) {
    const character = body[index];

    if (inString) {
      output += character;
      if (character === '"') {
        // A doubled quote is an escaped quote, not the end of the string.
        if (body[index + 1] === '"') { output += '"'; index += 2; continue; }
        inString = false;
      }
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      index += 1;
      continue;
    }

    REFERENCE.lastIndex = index;
    const match = REFERENCE.exec(body);
    if (match && match.index === index) {
      const after = body.slice(index + match[0].length).replace(/^\s*/, "");
      // LOG10( looks like a reference but is a function name.
      if (after.startsWith("(")) {
        output += match[0];
        index += match[0].length;
        continue;
      }
      const [, colDollar, letters, rowDollar, digits] = match;
      const col = colDollar ? columnToIndex(letters) : columnToIndex(letters) + deltaCol;
      const row = rowDollar ? Number(digits) - 1 : Number(digits) - 1 + deltaRow;

      if (col < 0 || row < 0) {
        output += "#REF!";
      } else {
        output += colDollar + indexToColumn(col) + rowDollar + (row + 1);
      }
      index += match[0].length;
      continue;
    }

    output += character;
    index += 1;
  }

  return (hasEquals ? "=" : "") + output;
}

/** "D2" -> { col, row } without pulling in the whole parser surface. */
function cellOf(reference) {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(reference.trim());
  if (!match) return null;
  return { col: columnToIndex(match[1]), row: Number(match[2]) - 1 };
}

/**
 * Applies an exercise's fill ranges: whatever is in the range's first cell is
 * copied across the rest, translated as a copy-paste would translate it.
 *
 * Both the grid and the verifier call this, so the sheet a learner sees and the
 * sheet CI checks are built the same way.
 */
export function expandEntries(exercise, entries) {
  const expanded = { ...entries };
  for (const fill of exercise.fills || []) {
    const from = cellOf(fill.from);
    const to = cellOf(fill.to);
    if (!from || !to) continue;

    const source = expanded[fill.from];
    for (let row = from.row; row <= to.row; row++) {
      for (let col = from.col; col <= to.col; col++) {
        if (row === from.row && col === from.col) continue;
        const reference = indexToColumn(col) + (row + 1);
        if (!source) {
          delete expanded[reference];
          continue;
        }
        expanded[reference] = String(source).startsWith("=")
          ? translateFormula(String(source), col - from.col, row - from.row)
          : source;
      }
    }
  }
  return expanded;
}

/** The cells a fill range covers apart from its first, which the grid shows as filled. */
export function filledCells(exercise) {
  const cells = new Set();
  for (const fill of exercise.fills || []) {
    const from = cellOf(fill.from);
    const to = cellOf(fill.to);
    if (!from || !to) continue;
    for (let row = from.row; row <= to.row; row++) {
      for (let col = from.col; col <= to.col; col++) {
        if (row === from.row && col === from.col) continue;
        cells.add(indexToColumn(col) + (row + 1));
      }
    }
  }
  return cells;
}
