/**
 * The sheet model: cells in, values out.
 *
 * Evaluation is lazy and memoised, with a "currently computing" set to catch
 * circular references. Small sheets make that simpler and quite fast enough.
 *
 * Spilling: a formula whose result is an array occupies the cells below and to
 * the right of it. Those cells hold no input of their own, so reading one means
 * finding the formula that spilled into it — which is what `ensureSpillsCovering`
 * does. A spill landing on a cell that already has content is a #REF!, exactly as
 * in Sheets.
 */

import { ERR, err, isError, isBlank, displayValue, ymdToSerial, parseDateText, toNumber } from "./values.js";
import { parseFormula, parseA1, formatA1, functionsUsed, referencesCells } from "./parser.js";
import { evaluate } from "./evaluate.js";
import { isArrayValue } from "./functions.js";

/** The date TODAY() reports, fixed so that exercises are reproducible. */
export const COURSE_TODAY = ymdToSerial(2024, 6, 17);

function key(col, row) {
  return col + "," + row;
}

/**
 * Interprets what a learner (or a lesson) typed into a cell.
 * Numbers, percentages, dates and TRUE/FALSE become typed values; the rest is text.
 */
export function parseInput(input) {
  if (input === null || input === undefined) return { kind: "blank" };
  if (typeof input === "number" || typeof input === "boolean") return { kind: "literal", value: input };

  const text = String(input);
  if (text === "") return { kind: "blank" };
  if (text.startsWith("=")) return { kind: "formula", source: text.slice(1) };

  // A leading apostrophe forces text, as in Sheets.
  if (text.startsWith("'")) return { kind: "literal", value: text.slice(1) };

  const upper = text.trim().toUpperCase();
  if (upper === "TRUE") return { kind: "literal", value: true };
  if (upper === "FALSE") return { kind: "literal", value: false };

  if (/^\s*-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(text)) {
    return { kind: "literal", value: Number(text.trim()) };
  }
  if (/^\s*-?(\d+\.?\d*|\.\d+)\s*%\s*$/.test(text)) {
    return { kind: "literal", value: Number(text.replace("%", "").trim()) / 100 };
  }
  const asDate = parseDateText(text);
  if (asDate !== null) return { kind: "literal", value: asDate, format: "date" };

  return { kind: "literal", value: text };
}

export class Sheet {
  /**
   * @param {object} options
   * @param {object} options.cells    { A1: "Region", B2: 42, C2: "=SUM(A1:A5)" }
   * @param {object} options.formats  { "B2:B9": "currency" } or { B2: "date" }
   * @param {number} options.rows     visible row count
   * @param {number} options.columns  visible column count
   */
  constructor(options) {
    const settings = options || {};
    this.rowCount = settings.rows || 12;
    this.columnCount = settings.columns || 6;
    this.today = settings.today === undefined ? COURSE_TODAY : settings.today;
    this.columnWidths = settings.columnWidths || {};

    this.inputs = new Map();
    this.formats = new Map();
    this.locked = new Set();

    for (const [reference, value] of Object.entries(settings.cells || {})) {
      this.setInput(reference, value, { silent: true });
    }
    for (const [reference, format] of Object.entries(settings.formats || {})) {
      for (const cell of expandReference(reference)) {
        this.formats.set(key(cell.col, cell.row), format);
      }
    }
    // Cells the learner is not meant to change (the supplied data).
    for (const reference of settings.locked || []) {
      for (const cell of expandReference(reference)) this.locked.add(key(cell.col, cell.row));
    }

    this.invalidate();
  }

  invalidate() {
    this.values = new Map();
    this.spills = new Map();
    this.spillOwners = new Map();
    this.computing = new Set();
    this.evaluatedAnchors = new Set();
  }

  /* --------------------------------------------------------------- content */

  setInput(reference, value, options) {
    const cell = parseA1(reference);
    if (!cell) throw new Error(`"${reference}" is not a cell reference`);
    const cellKey = key(cell.col, cell.row);
    if (value === null || value === undefined || value === "") this.inputs.delete(cellKey);
    else this.inputs.set(cellKey, String(value));
    if (!options || !options.silent) this.invalidate();
  }

  getInput(reference) {
    const cell = parseA1(reference);
    if (!cell) return "";
    return this.inputs.get(key(cell.col, cell.row)) || "";
  }

  isLocked(reference) {
    const cell = parseA1(reference);
    return cell ? this.locked.has(key(cell.col, cell.row)) : false;
  }

  getFormat(col, row) {
    return this.formats.get(key(col, row)) || null;
  }

  /** The last row that holds anything, used for whole-column references. */
  lastRow() {
    let last = 0;
    for (const cellKey of this.inputs.keys()) {
      const row = Number(cellKey.split(",")[1]);
      if (row > last) last = row;
    }
    return Math.max(last, this.rowCount - 1);
  }

  /* ------------------------------------------------------------ evaluation */

  context(position) {
    return {
      today: this.today,
      position,
      lastRow: () => this.lastRow(),
      getCell: (col, row) => this.getCellValue(col, row),
      getRange: (c1, r1, c2, r2) => this.getRangeValues(c1, r1, c2, r2),
    };
  }

  getCellValue(col, row) {
    const cellKey = key(col, row);
    if (this.values.has(cellKey)) return this.values.get(cellKey);

    const input = this.inputs.get(cellKey);
    if (input === undefined) {
      // No content of its own — it may be inside something else's spill.
      this.ensureSpillsCovering(col, row);
      if (this.spills.has(cellKey)) return this.spills.get(cellKey);
      return null;
    }

    if (this.computing.has(cellKey)) {
      return err(ERR.CYCLE, `${formatA1(col, row)} depends on itself`);
    }

    const parsed = parseInput(input);
    if (parsed.kind === "blank") {
      this.values.set(cellKey, null);
      return null;
    }
    if (parsed.kind === "literal") {
      if (parsed.format && !this.formats.has(cellKey)) this.formats.set(cellKey, parsed.format);
      this.values.set(cellKey, parsed.value);
      return parsed.value;
    }

    this.computing.add(cellKey);
    let value;
    try {
      const parsedFormula = parseFormula(parsed.source);
      value = parsedFormula.ok
        ? evaluate(parsedFormula.ast, this.context({ col, row }))
        : parsedFormula.error;
    } finally {
      this.computing.delete(cellKey);
    }

    if (isArrayValue(value)) {
      value = this.placeSpill(col, row, value);
    }

    this.values.set(cellKey, value);
    this.evaluatedAnchors.add(cellKey);
    return value;
  }

  /**
   * Records an array result across the cells it covers and returns the value the
   * anchor cell itself shows.
   */
  placeSpill(col, row, array) {
    const height = array.length;
    const width = Math.max(...array.map((line) => line.length), 0);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (r === 0 && c === 0) continue;
        const targetKey = key(col + c, row + r);
        if (this.inputs.has(targetKey)) {
          return err(
            ERR.REF,
            `this result needs ${height} row(s) by ${width} column(s), but ${formatA1(col + c, row + r)} already has something in it`
          );
        }
      }
    }

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const line = array[r] || [];
        const value = c < line.length ? line[c] : null;
        if (r === 0 && c === 0) continue;
        const targetKey = key(col + c, row + r);
        this.spills.set(targetKey, value);
        this.spillOwners.set(targetKey, key(col, row));
      }
    }
    const first = array[0] || [];
    return first.length ? first[0] : null;
  }

  /**
   * Makes sure any formula that could spill into (col,row) has been worked out.
   * Only anchors above and to the left can reach it, so the search is cheap.
   */
  ensureSpillsCovering(col, row) {
    for (const cellKey of this.inputs.keys()) {
      if (this.evaluatedAnchors.has(cellKey)) continue;
      if (this.computing.has(cellKey)) continue;
      const [anchorCol, anchorRow] = cellKey.split(",").map(Number);
      if (anchorCol > col || anchorRow > row) continue;
      if (anchorCol === col && anchorRow === row) continue;
      const input = this.inputs.get(cellKey);
      if (!input.startsWith("=")) continue;
      this.getCellValue(anchorCol, anchorRow);
      if (this.spills.has(key(col, row))) return;
    }
  }

  getRangeValues(c1, r1, c2, r2) {
    const out = [];
    for (let row = r1; row <= r2; row++) {
      const line = [];
      for (let col = c1; col <= c2; col++) line.push(this.getCellValue(col, row));
      out.push(line);
    }
    return out;
  }

  /* ---------------------------------------------------------------- reading */

  valueAt(reference) {
    const cell = parseA1(reference);
    if (!cell) return err(ERR.REF, `"${reference}" is not a cell reference`);
    return this.getCellValue(cell.col, cell.row);
  }

  displayAt(reference) {
    const cell = parseA1(reference);
    if (!cell) return "";
    return this.display(cell.col, cell.row);
  }

  display(col, row) {
    const value = this.getCellValue(col, row);
    let format = this.getFormat(col, row);
    if (!format) {
      // A spilled cell inherits the format of the formula that produced it.
      const owner = this.spillOwners.get(key(col, row));
      if (owner) {
        const [ownerCol, ownerRow] = owner.split(",").map(Number);
        format = this.getFormat(ownerCol, ownerRow);
      }
    }
    return displayValue(value, format);
  }

  /** Everything that is currently showing, for checks and for debugging. */
  snapshot() {
    const out = {};
    for (let row = 0; row < this.rowCount; row++) {
      for (let col = 0; col < this.columnCount; col++) {
        const value = this.getCellValue(col, row);
        if (!isBlank(value)) out[formatA1(col, row)] = isError(value) ? value.type : value;
      }
    }
    return out;
  }

  /** The formula in a cell, without its leading "=", or null if it holds no formula. */
  formulaAt(reference) {
    const input = this.getInput(reference);
    return input.startsWith("=") ? input.slice(1) : null;
  }

  /** Function names used by the formula in a cell. */
  functionsAt(reference) {
    const source = this.formulaAt(reference);
    if (source === null) return new Set();
    const parsed = parseFormula(source);
    return parsed.ok ? functionsUsed(parsed.ast) : new Set();
  }

  /** True when the formula in a cell mentions at least one cell or range. */
  referencesCellsAt(reference) {
    const source = this.formulaAt(reference);
    if (source === null) return false;
    const parsed = parseFormula(source);
    return parsed.ok ? referencesCells(parsed.ast) : false;
  }

  /**
   * Works out a formula without placing it in a cell, returning an array result
   * whole rather than just the value its anchor would show.
   */
  evaluateSource(source, position) {
    const parsed = parseFormula(source.startsWith("=") ? source.slice(1) : source);
    if (!parsed.ok) return parsed.error;
    return evaluate(parsed.ast, this.context(position || { col: 0, row: 0 }));
  }

  /** The block a spilling formula produced, read back off the sheet. */
  spilledBlockAt(reference) {
    const anchor = parseA1(reference);
    if (!anchor) return [];
    const anchorKey = key(anchor.col, anchor.row);
    this.getCellValue(anchor.col, anchor.row);
    let height = 1;
    let width = 1;
    for (const [cellKey, owner] of this.spillOwners.entries()) {
      if (owner !== anchorKey) continue;
      const [col, row] = cellKey.split(",").map(Number);
      height = Math.max(height, row - anchor.row + 1);
      width = Math.max(width, col - anchor.col + 1);
    }
    return this.getRangeValues(anchor.col, anchor.row, anchor.col + width - 1, anchor.row + height - 1);
  }

  /** A copy with the same content, used to test a formula against changed inputs. */
  clone() {
    const copy = new Sheet({
      rows: this.rowCount,
      columns: this.columnCount,
      today: this.today,
      columnWidths: this.columnWidths,
    });
    copy.inputs = new Map(this.inputs);
    copy.formats = new Map(this.formats);
    copy.locked = new Set(this.locked);
    copy.invalidate();
    return copy;
  }
}

/** "B2" or "B2:D5" -> the list of cells it covers. */
export function expandReference(reference) {
  const parts = String(reference).split(":");
  if (parts.length === 1) {
    const cell = parseA1(parts[0]);
    return cell ? [cell] : [];
  }
  const start = parseA1(parts[0]);
  const end = parseA1(parts[1]);
  if (!start || !end) return [];
  const cells = [];
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
    for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export { formatA1, parseA1 };
