/**
 * The function library.
 *
 * Each entry is { min, max, lazy?, catchesErrors?, fn }.
 *   lazy          arguments arrive as thunks, so IF does not evaluate the branch
 *                 it does not take — which is what stops IF(A1=0,0,1/A1) erroring.
 *   catchesErrors the function sees error values instead of having them
 *                 propagated automatically (IFERROR, ISERROR).
 *
 * Range and array values are plain 2D JavaScript arrays throughout, which is what
 * lets FILTER / SORT / UNIQUE / SEQUENCE hand back something the sheet can spill.
 */

import {
  ERR, err, isError, isBlank, firstError,
  toNumber, toText, toBoolean,
  compareValues, equalValues,
  ymdToSerial, serialParts, dateToSerial,
} from "./values.js";

import { runQuery } from "./query.js";

/* ------------------------------------------------------------------ helpers */

export function isArrayValue(value) {
  return Array.isArray(value);
}

/** Every scalar in an argument list, ranges flattened row by row. */
function flat(args) {
  const out = [];
  const push = (value) => {
    if (isArrayValue(value)) value.forEach((row) => row.forEach(push));
    else out.push(value);
  };
  args.forEach(push);
  return out;
}

/** Numeric values only. Text and blanks are skipped, as SUM and AVERAGE do. */
function numbers(args) {
  const out = [];
  for (const value of flat(args)) {
    if (isError(value)) return value;
    if (isBlank(value)) continue;
    if (typeof value === "number") out.push(value);
    else if (typeof value === "boolean") continue; // booleans in ranges are ignored
    // text in a range is ignored rather than an error, matching Sheets
  }
  return out;
}

/** Numeric coercion for a direct argument, where text like "5" is accepted. */
function num(value) {
  return toNumber(isArrayValue(value) ? topLeft(value) : value);
}

function text(value) {
  return toText(isArrayValue(value) ? topLeft(value) : value);
}

function bool(value) {
  return toBoolean(isArrayValue(value) ? topLeft(value) : value);
}

function topLeft(array) {
  if (!isArrayValue(array)) return array;
  const row = array[0] || [];
  return row.length ? row[0] : null;
}

/** Wraps a scalar as a 1x1 array; leaves arrays alone. */
function as2d(value) {
  return isArrayValue(value) ? value : [[value]];
}

function columnOf(array, index) {
  return array.map((row) => (index < row.length ? row[index] : null));
}

function isRectangular(array) {
  return isArrayValue(array) && array.length > 0;
}

/* ------------------------------------------------------- criteria (the IFs) */

const COMPARATOR = /^\s*(<=|>=|<>|=|<|>)\s*(.*)$/s;

function wildcardToRegExp(pattern) {
  // * and ? are the only wildcards; everything else is literal.
  let source = "";
  for (const character of pattern) {
    if (character === "*") source += ".*";
    else if (character === "?") source += ".";
    else source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + source + "$", "i");
}

/**
 * Turns a COUNTIF/SUMIF criterion into a predicate.
 * Handles ">100", "<>done", "a*", a bare value, and a cell holding any of those.
 */
export function makeCriteria(criterion) {
  const raw = isArrayValue(criterion) ? topLeft(criterion) : criterion;

  if (typeof raw === "string") {
    const match = COMPARATOR.exec(raw);
    if (match) {
      const operator = match[1];
      const rest = match[2];
      const asNumber = rest.trim() === "" ? null : toNumber(rest);
      const target = isError(asNumber) || rest.trim() === "" ? rest : asNumber;
      return (value) => {
        const order = compareValues(value, target);
        switch (operator) {
          case "=": return equalValues(value, target);
          case "<>": return !equalValues(value, target);
          case "<": return order < 0;
          case "<=": return order <= 0;
          case ">": return order > 0;
          case ">=": return order >= 0;
          default: return false;
        }
      };
    }
    if (raw.includes("*") || raw.includes("?")) {
      const pattern = wildcardToRegExp(raw);
      return (value) => (isBlank(value) ? false : pattern.test(toText(value)));
    }
  }

  return (value) => equalValues(value, raw);
}

/** Shared engine for SUMIFS / COUNTIFS / AVERAGEIFS. */
function conditionalRows(pairs, length) {
  const keep = [];
  for (let index = 0; index < length; index++) {
    let matches = true;
    for (const [values, predicate] of pairs) {
      if (!predicate(index < values.length ? values[index] : null)) {
        matches = false;
        break;
      }
    }
    if (matches) keep.push(index);
  }
  return keep;
}

function flatRange(value) {
  return flat([value]);
}

/* --------------------------------------------------------- rounding helpers */

function roundTo(value, places, mode) {
  const factor = Math.pow(10, places);
  const scaled = value * factor;
  // Nudge away from binary-float noise before rounding: 2.675*100 is 267.49999...
  const corrected = Number(scaled.toPrecision(15));
  let rounded;
  if (mode === "up") rounded = corrected < 0 ? Math.floor(corrected) : Math.ceil(corrected);
  else if (mode === "down") rounded = corrected < 0 ? Math.ceil(corrected) : Math.floor(corrected);
  else rounded = corrected < 0 ? -Math.round(-corrected) : Math.round(corrected);
  return rounded / factor;
}

/* --------------------------------------------------------------- TEXT format */

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A deliberately small subset of format strings — the ones the course teaches. */
function applyTextFormat(value, format) {
  const isDateFormat = /d|m|y/i.test(format) && !/[0#]/.test(format);

  if (isDateFormat) {
    const serial = num(value);
    if (isError(serial)) return serial;
    const { year, month, day } = serialParts(serial);
    const weekday = serialParts(serial).weekday - 1;
    return format
      .replace(/yyyy/gi, String(year))
      .replace(/yy/gi, pad(year % 100, 2))
      .replace(/mmmm/gi, MONTH_NAMES[month - 1])
      .replace(/mmm/gi, MONTH_NAMES[month - 1].slice(0, 3))
      .replace(/mm/gi, pad(month, 2))
      .replace(/dddd/gi, DAY_NAMES[weekday])
      .replace(/ddd/gi, DAY_NAMES[weekday].slice(0, 3))
      .replace(/dd/gi, pad(day, 2))
      .replace(/\bd\b/gi, String(day))
      .replace(/\bm\b/gi, String(month));
  }

  const number = num(value);
  if (isError(number)) return number;

  if (format.includes("%")) {
    const decimals = (format.split(".")[1] || "").replace(/[^0#]/g, "").length;
    return (number * 100).toFixed(decimals) + "%";
  }

  const decimals = (format.split(".")[1] || "").replace(/[^0#]/g, "").length;
  const fixed = Math.abs(number).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = format.includes(",") ? groupThousands(whole) : whole;
  const sign = number < 0 ? "-" : "";
  const prefix = format.startsWith("$") || format.startsWith("£") ? format[0] : "";
  return sign + prefix + grouped + (fraction ? "." + fraction : "");
}

/* ------------------------------------------------------------ the functions */

export const FUNCTIONS = {};

function define(names, spec) {
  for (const name of [].concat(names)) FUNCTIONS[name] = spec;
}

/* --- maths and statistics --- */

define("SUM", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  return values.reduce((total, value) => total + value, 0);
} });

define("PRODUCT", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  return values.length === 0 ? 0 : values.reduce((total, value) => total * value, 1);
} });

define("AVERAGE", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  if (values.length === 0) return err(ERR.DIV0, "AVERAGE found no numbers to average");
  return values.reduce((total, value) => total + value, 0) / values.length;
} });

define("MEDIAN", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  if (values.length === 0) return err(ERR.NUM, "MEDIAN found no numbers");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
} });

define("MIN", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  return values.length === 0 ? 0 : Math.min(...values);
} });

define("MAX", { min: 1, max: Infinity, fn: (args) => {
  const values = numbers(args);
  if (isError(values)) return values;
  return values.length === 0 ? 0 : Math.max(...values);
} });

define("COUNT", { min: 1, max: Infinity, fn: (args) => {
  let count = 0;
  for (const value of flat(args)) {
    if (isError(value)) continue;
    if (typeof value === "number") count += 1;
  }
  return count;
} });

define("COUNTA", { min: 1, max: Infinity, fn: (args) => {
  let count = 0;
  for (const value of flat(args)) if (!isBlank(value)) count += 1;
  return count;
} });

define("COUNTBLANK", { min: 1, max: Infinity, fn: (args) => {
  let count = 0;
  for (const value of flat(args)) if (isBlank(value) || value === "") count += 1;
  return count;
} });

define("COUNTUNIQUE", { min: 1, max: Infinity, fn: (args) => {
  const seen = new Set();
  for (const value of flat(args)) {
    if (isBlank(value)) continue;
    seen.add(typeof value === "string" ? value.toLowerCase() : value);
  }
  return seen.size;
} });

define("ABS", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : Math.abs(n); } });
define("SQRT", { min: 1, max: 1, fn: ([value]) => {
  const n = num(value);
  if (isError(n)) return n;
  return n < 0 ? err(ERR.NUM, "SQRT cannot take the root of a negative number") : Math.sqrt(n);
} });
define("INT", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : Math.floor(n); } });
define("SIGN", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : Math.sign(n); } });

define("POWER", { min: 2, max: 2, fn: ([base, exponent]) => {
  const b = num(base); const e = num(exponent);
  return isError(b) ? b : isError(e) ? e : Math.pow(b, e);
} });

define("MOD", { min: 2, max: 2, fn: ([value, divisor]) => {
  const a = num(value); const b = num(divisor);
  if (isError(a)) return a;
  if (isError(b)) return b;
  if (b === 0) return err(ERR.DIV0, "MOD cannot divide by zero");
  return a - b * Math.floor(a / b); // sign follows the divisor, as in Sheets
} });

define("ROUND", { min: 1, max: 2, fn: ([value, places]) => {
  const n = num(value); const p = places === undefined ? 0 : num(places);
  return isError(n) ? n : isError(p) ? p : roundTo(n, p, "half");
} });
define("ROUNDUP", { min: 1, max: 2, fn: ([value, places]) => {
  const n = num(value); const p = places === undefined ? 0 : num(places);
  return isError(n) ? n : isError(p) ? p : roundTo(n, p, "up");
} });
define("ROUNDDOWN", { min: 1, max: 2, fn: ([value, places]) => {
  const n = num(value); const p = places === undefined ? 0 : num(places);
  return isError(n) ? n : isError(p) ? p : roundTo(n, p, "down");
} });
define("MROUND", { min: 2, max: 2, fn: ([value, factor]) => {
  const n = num(value); const f = num(factor);
  if (isError(n)) return n;
  if (isError(f)) return f;
  return f === 0 ? 0 : Math.round(n / f) * f;
} });
define("CEILING", { min: 1, max: 2, fn: ([value, factor]) => {
  const n = num(value); const f = factor === undefined ? 1 : num(factor);
  if (isError(n)) return n;
  if (isError(f)) return f;
  return f === 0 ? 0 : Math.ceil(n / f) * f;
} });
define("FLOOR", { min: 1, max: 2, fn: ([value, factor]) => {
  const n = num(value); const f = factor === undefined ? 1 : num(factor);
  if (isError(n)) return n;
  if (isError(f)) return f;
  return f === 0 ? 0 : Math.floor(n / f) * f;
} });

define("SUMPRODUCT", { min: 1, max: Infinity, fn: (args) => {
  const arrays = args.map((arg) => flat([arg]));
  const length = arrays[0].length;
  if (arrays.some((array) => array.length !== length)) {
    return err(ERR.VALUE, "SUMPRODUCT needs ranges of the same size");
  }
  let total = 0;
  for (let index = 0; index < length; index++) {
    let product = 1;
    for (const array of arrays) {
      const value = array[index];
      if (isError(value)) return value;
      product *= typeof value === "number" ? value : typeof value === "boolean" ? (value ? 1 : 0) : 0;
    }
    total += product;
  }
  return total;
} });

define("LARGE", { min: 2, max: 2, fn: ([range, n]) => {
  const values = numbers([range]);
  if (isError(values)) return values;
  const k = num(n);
  if (isError(k)) return k;
  const sorted = [...values].sort((a, b) => b - a);
  return k < 1 || k > sorted.length ? err(ERR.NUM, "LARGE was asked for a rank that does not exist") : sorted[k - 1];
} });

define("SMALL", { min: 2, max: 2, fn: ([range, n]) => {
  const values = numbers([range]);
  if (isError(values)) return values;
  const k = num(n);
  if (isError(k)) return k;
  const sorted = [...values].sort((a, b) => a - b);
  return k < 1 || k > sorted.length ? err(ERR.NUM, "SMALL was asked for a rank that does not exist") : sorted[k - 1];
} });

define("RANK", { min: 2, max: 3, fn: ([value, range, ascending]) => {
  const target = num(value);
  if (isError(target)) return target;
  const values = numbers([range]);
  if (isError(values)) return values;
  const wantAscending = ascending === undefined ? false : Boolean(bool(ascending));
  const sorted = [...values].sort((a, b) => (wantAscending ? a - b : b - a));
  const index = sorted.findIndex((item) => item === target);
  return index === -1 ? err(ERR.NA, "RANK could not find that value in the range") : index + 1;
} });

/* --- logic --- */

define("IF", { min: 2, max: 3, lazy: true, fn: (thunks) => {
  const condition = bool(thunks[0]());
  if (isError(condition)) return condition;
  if (condition) return thunks[1]();
  return thunks.length > 2 ? thunks[2]() : false;
} });

define("IFS", { min: 2, max: Infinity, lazy: true, fn: (thunks) => {
  for (let index = 0; index + 1 < thunks.length; index += 2) {
    const condition = bool(thunks[index]());
    if (isError(condition)) return condition;
    if (condition) return thunks[index + 1]();
  }
  return err(ERR.NA, "IFS found no condition that was true");
} });

define("SWITCH", { min: 3, max: Infinity, lazy: true, fn: (thunks) => {
  const subject = thunks[0]();
  if (isError(subject)) return subject;
  let index = 1;
  for (; index + 1 < thunks.length; index += 2) {
    if (equalValues(subject, thunks[index]())) return thunks[index + 1]();
  }
  // A final odd argument is the default.
  return index < thunks.length ? thunks[index]() : err(ERR.NA, "SWITCH found no matching case");
} });

define("IFERROR", { min: 1, max: 2, lazy: true, catchesErrors: true, fn: (thunks) => {
  const value = thunks[0]();
  if (!isError(value) && !isError(firstError(value))) return value;
  return thunks.length > 1 ? thunks[1]() : "";
} });

define("IFNA", { min: 2, max: 2, lazy: true, catchesErrors: true, fn: (thunks) => {
  const value = thunks[0]();
  if (isError(value) && value.type === ERR.NA) return thunks[1]();
  return value;
} });

define("AND", { min: 1, max: Infinity, fn: (args) => {
  for (const value of flat(args)) {
    if (isBlank(value)) continue;
    const truth = toBoolean(value);
    if (isError(truth)) return truth;
    if (!truth) return false;
  }
  return true;
} });

define("OR", { min: 1, max: Infinity, fn: (args) => {
  for (const value of flat(args)) {
    if (isBlank(value)) continue;
    const truth = toBoolean(value);
    if (isError(truth)) return truth;
    if (truth) return true;
  }
  return false;
} });

define("NOT", { min: 1, max: 1, fn: ([value]) => { const b = bool(value); return isError(b) ? b : !b; } });

define("XOR", { min: 1, max: Infinity, fn: (args) => {
  let count = 0;
  for (const value of flat(args)) {
    const truth = toBoolean(value);
    if (isError(truth)) return truth;
    if (truth) count += 1;
  }
  return count % 2 === 1;
} });

define("TRUE", { min: 0, max: 0, fn: () => true });
define("FALSE", { min: 0, max: 0, fn: () => false });
define("NA", { min: 0, max: 0, fn: () => err(ERR.NA, "NA() always reports #N/A") });

define("ISBLANK", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => isBlank(isArrayValue(value) ? topLeft(value) : value) });
define("ISNUMBER", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => typeof (isArrayValue(value) ? topLeft(value) : value) === "number" });
define("ISTEXT", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => typeof (isArrayValue(value) ? topLeft(value) : value) === "string" });
define("ISLOGICAL", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => typeof (isArrayValue(value) ? topLeft(value) : value) === "boolean" });
define("ISERROR", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => Boolean(firstError(value)) });
define("ISNA", { min: 1, max: 1, catchesErrors: true, fn: ([value]) => {
  const found = firstError(value);
  return Boolean(found && found.type === ERR.NA);
} });
define("ISEVEN", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : Math.trunc(n) % 2 === 0; } });
define("ISODD", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : Math.abs(Math.trunc(n) % 2) === 1; } });

/* --- conditional aggregates --- */

define("COUNTIF", { min: 2, max: 2, fn: ([range, criterion]) => {
  const predicate = makeCriteria(criterion);
  return flatRange(range).filter((value) => predicate(value)).length;
} });

define("COUNTIFS", { min: 2, max: Infinity, fn: (args) => {
  if (args.length % 2 !== 0) return err(ERR.VALUE, "COUNTIFS needs a criterion for every range");
  const pairs = [];
  let length = 0;
  for (let index = 0; index < args.length; index += 2) {
    const values = flatRange(args[index]);
    length = Math.max(length, values.length);
    pairs.push([values, makeCriteria(args[index + 1])]);
  }
  return conditionalRows(pairs, length).length;
} });

define("SUMIF", { min: 2, max: 3, fn: ([range, criterion, sumRange]) => {
  const test = flatRange(range);
  const target = sumRange === undefined ? test : flatRange(sumRange);
  const predicate = makeCriteria(criterion);
  let total = 0;
  for (let index = 0; index < test.length; index++) {
    if (!predicate(test[index])) continue;
    const value = index < target.length ? target[index] : null;
    if (isError(value)) return value;
    if (typeof value === "number") total += value;
  }
  return total;
} });

define("SUMIFS", { min: 3, max: Infinity, fn: (args) => {
  const target = flatRange(args[0]);
  const rest = args.slice(1);
  if (rest.length % 2 !== 0) return err(ERR.VALUE, "SUMIFS needs a criterion for every range");
  const pairs = [];
  for (let index = 0; index < rest.length; index += 2) {
    pairs.push([flatRange(rest[index]), makeCriteria(rest[index + 1])]);
  }
  let total = 0;
  for (const index of conditionalRows(pairs, target.length)) {
    const value = target[index];
    if (isError(value)) return value;
    if (typeof value === "number") total += value;
  }
  return total;
} });

define("AVERAGEIF", { min: 2, max: 3, fn: ([range, criterion, averageRange]) => {
  const test = flatRange(range);
  const target = averageRange === undefined ? test : flatRange(averageRange);
  const predicate = makeCriteria(criterion);
  const picked = [];
  for (let index = 0; index < test.length; index++) {
    if (!predicate(test[index])) continue;
    const value = index < target.length ? target[index] : null;
    if (isError(value)) return value;
    if (typeof value === "number") picked.push(value);
  }
  if (picked.length === 0) return err(ERR.DIV0, "AVERAGEIF matched no numbers");
  return picked.reduce((total, value) => total + value, 0) / picked.length;
} });

define("AVERAGEIFS", { min: 3, max: Infinity, fn: (args) => {
  const target = flatRange(args[0]);
  const rest = args.slice(1);
  const pairs = [];
  for (let index = 0; index < rest.length; index += 2) {
    pairs.push([flatRange(rest[index]), makeCriteria(rest[index + 1])]);
  }
  const picked = [];
  for (const index of conditionalRows(pairs, target.length)) {
    const value = target[index];
    if (isError(value)) return value;
    if (typeof value === "number") picked.push(value);
  }
  if (picked.length === 0) return err(ERR.DIV0, "AVERAGEIFS matched no numbers");
  return picked.reduce((total, value) => total + value, 0) / picked.length;
} });

define("MAXIFS", { min: 3, max: Infinity, fn: (args) => {
  const target = flatRange(args[0]);
  const rest = args.slice(1);
  const pairs = [];
  for (let index = 0; index < rest.length; index += 2) pairs.push([flatRange(rest[index]), makeCriteria(rest[index + 1])]);
  const picked = conditionalRows(pairs, target.length).map((index) => target[index]).filter((value) => typeof value === "number");
  return picked.length ? Math.max(...picked) : 0;
} });

define("MINIFS", { min: 3, max: Infinity, fn: (args) => {
  const target = flatRange(args[0]);
  const rest = args.slice(1);
  const pairs = [];
  for (let index = 0; index < rest.length; index += 2) pairs.push([flatRange(rest[index]), makeCriteria(rest[index + 1])]);
  const picked = conditionalRows(pairs, target.length).map((index) => target[index]).filter((value) => typeof value === "number");
  return picked.length ? Math.min(...picked) : 0;
} });

/* --- lookup --- */

define("VLOOKUP", { min: 3, max: 4, fn: ([key, range, index, isSorted]) => {
  const table = as2d(range);
  const columnIndex = num(index);
  if (isError(columnIndex)) return columnIndex;
  if (columnIndex < 1) return err(ERR.VALUE, "VLOOKUP's column number must be 1 or more");
  if (!isRectangular(table) || columnIndex > table[0].length) {
    return err(ERR.REF, `VLOOKUP was asked for column ${columnIndex}, but the range is only ${table[0] ? table[0].length : 0} wide`);
  }
  const searchKey = isArrayValue(key) ? topLeft(key) : key;
  const approximate = isSorted === undefined ? true : Boolean(bool(isSorted));

  if (!approximate) {
    for (const row of table) {
      if (equalValues(row[0], searchKey)) return row[columnIndex - 1];
    }
    return err(ERR.NA, `VLOOKUP could not find ${JSON.stringify(toText(searchKey))}`);
  }

  let best = null;
  for (const row of table) {
    if (compareValues(row[0], searchKey) <= 0) best = row;
    else break;
  }
  return best ? best[columnIndex - 1] : err(ERR.NA, "VLOOKUP found nothing at or below that value");
} });

define("HLOOKUP", { min: 3, max: 4, fn: ([key, range, index, isSorted]) => {
  const table = as2d(range);
  const rowIndex = num(index);
  if (isError(rowIndex)) return rowIndex;
  if (rowIndex < 1 || rowIndex > table.length) return err(ERR.REF, "HLOOKUP was asked for a row outside the range");
  const searchKey = isArrayValue(key) ? topLeft(key) : key;
  const approximate = isSorted === undefined ? true : Boolean(bool(isSorted));
  const header = table[0] || [];

  if (!approximate) {
    for (let column = 0; column < header.length; column++) {
      if (equalValues(header[column], searchKey)) return table[rowIndex - 1][column];
    }
    return err(ERR.NA, "HLOOKUP could not find that value in the first row");
  }
  let best = -1;
  for (let column = 0; column < header.length; column++) {
    if (compareValues(header[column], searchKey) <= 0) best = column;
    else break;
  }
  return best === -1 ? err(ERR.NA, "HLOOKUP found nothing at or below that value") : table[rowIndex - 1][best];
} });

define("MATCH", { min: 2, max: 3, fn: ([key, range, type]) => {
  const values = flatRange(range);
  const searchKey = isArrayValue(key) ? topLeft(key) : key;
  const mode = type === undefined ? 1 : num(type);
  if (isError(mode)) return mode;

  if (mode === 0) {
    for (let index = 0; index < values.length; index++) {
      if (equalValues(values[index], searchKey)) return index + 1;
    }
    return err(ERR.NA, `MATCH could not find ${JSON.stringify(toText(searchKey))}. Did you mean to pass 0 for an exact match?`);
  }
  let best = -1;
  for (let index = 0; index < values.length; index++) {
    const order = compareValues(values[index], searchKey);
    if (mode === 1 ? order <= 0 : order >= 0) best = index;
    else break;
  }
  return best === -1 ? err(ERR.NA, "MATCH found nothing suitable") : best + 1;
} });

define("INDEX", { min: 1, max: 3, fn: ([range, row, column]) => {
  const table = as2d(range);
  const rowIndex = row === undefined ? 0 : num(row);
  const columnIndex = column === undefined ? 0 : num(column);
  if (isError(rowIndex)) return rowIndex;
  if (isError(columnIndex)) return columnIndex;

  if (rowIndex === 0 && columnIndex === 0) return table;
  if (rowIndex === 0) {
    if (columnIndex > (table[0] || []).length) return err(ERR.REF, "INDEX was asked for a column outside the range");
    const column = table.map((line) => [line[columnIndex - 1]]);
    return column.length === 1 ? column[0][0] : column;
  }
  if (rowIndex > table.length) return err(ERR.REF, `INDEX was asked for row ${rowIndex}, but the range has only ${table.length}`);
  if (columnIndex === 0) {
    // A whole row of a one-column range is a single value, not a 1x1 array.
    const line = table[rowIndex - 1];
    return line.length === 1 ? line[0] : [line];
  }
  const line = table[rowIndex - 1];
  if (columnIndex > line.length) return err(ERR.REF, "INDEX was asked for a column outside the range");
  return line[columnIndex - 1];
} });

define("XLOOKUP", { min: 3, max: 5, fn: ([key, lookupRange, resultRange, missing, matchMode]) => {
  const keys = flatRange(lookupRange);
  const resultTable = as2d(resultRange);
  const resultIsRow = resultTable.length === 1 && resultTable[0].length === keys.length;
  const searchKey = isArrayValue(key) ? topLeft(key) : key;
  const mode = matchMode === undefined ? 0 : num(matchMode);

  let found = -1;
  for (let index = 0; index < keys.length; index++) {
    if (mode === 0 && equalValues(keys[index], searchKey)) { found = index; break; }
    if (mode === -1 && compareValues(keys[index], searchKey) <= 0) found = index;
    if (mode === 1 && compareValues(keys[index], searchKey) >= 0 && found === -1) found = index;
  }
  if (found === -1) {
    if (missing !== undefined) return missing;
    return err(ERR.NA, `XLOOKUP could not find ${JSON.stringify(toText(searchKey))}`);
  }
  if (resultIsRow) return resultTable[0][found];
  const line = resultTable[found];
  if (!line) return err(ERR.NA, "XLOOKUP's result range is shorter than its lookup range");
  return line.length === 1 ? line[0] : [line];
} });

define(["ROWS"], { min: 1, max: 1, fn: ([range]) => as2d(range).length });
define(["COLUMNS"], { min: 1, max: 1, fn: ([range]) => (as2d(range)[0] || []).length });

/* --- text --- */

define("LEN", { min: 1, max: 1, fn: ([value]) => { const t = text(value); return isError(t) ? t : t.length; } });
define("UPPER", { min: 1, max: 1, fn: ([value]) => { const t = text(value); return isError(t) ? t : t.toUpperCase(); } });
define("LOWER", { min: 1, max: 1, fn: ([value]) => { const t = text(value); return isError(t) ? t : t.toLowerCase(); } });
define("TRIM", { min: 1, max: 1, fn: ([value]) => {
  const t = text(value);
  return isError(t) ? t : t.trim().replace(/\s+/g, " ");
} });
define("PROPER", { min: 1, max: 1, fn: ([value]) => {
  const t = text(value);
  if (isError(t)) return t;
  return t.toLowerCase().replace(/(^|[^A-Za-z'])([a-z])/g, (whole, before, letter) => before + letter.toUpperCase());
} });

define("LEFT", { min: 1, max: 2, fn: ([value, count]) => {
  const t = text(value); const n = count === undefined ? 1 : num(count);
  return isError(t) ? t : isError(n) ? n : t.slice(0, Math.max(0, n));
} });
define("RIGHT", { min: 1, max: 2, fn: ([value, count]) => {
  const t = text(value); const n = count === undefined ? 1 : num(count);
  if (isError(t)) return t;
  if (isError(n)) return n;
  return n <= 0 ? "" : t.slice(Math.max(0, t.length - n));
} });
define("MID", { min: 3, max: 3, fn: ([value, start, count]) => {
  const t = text(value); const s = num(start); const n = num(count);
  if (isError(t)) return t;
  if (isError(s)) return s;
  if (isError(n)) return n;
  if (s < 1) return err(ERR.VALUE, "MID's starting position must be 1 or more");
  return t.slice(s - 1, s - 1 + Math.max(0, n));
} });

define("FIND", { min: 2, max: 3, fn: ([needle, haystack, start]) => {
  const n = text(needle); const h = text(haystack);
  const from = start === undefined ? 1 : num(start);
  if (isError(n)) return n;
  if (isError(h)) return h;
  if (isError(from)) return from;
  const index = h.indexOf(n, from - 1);
  return index === -1 ? err(ERR.VALUE, `FIND could not find ${JSON.stringify(n)}`) : index + 1;
} });

define("SEARCH", { min: 2, max: 3, fn: ([needle, haystack, start]) => {
  const n = text(needle); const h = text(haystack);
  const from = start === undefined ? 1 : num(start);
  if (isError(n)) return n;
  if (isError(h)) return h;
  if (isError(from)) return from;
  const index = h.toLowerCase().indexOf(n.toLowerCase(), from - 1);
  return index === -1 ? err(ERR.VALUE, `SEARCH could not find ${JSON.stringify(n)}`) : index + 1;
} });

define("SUBSTITUTE", { min: 3, max: 4, fn: ([value, find, replace, occurrence]) => {
  const t = text(value); const f = text(find); const r = text(replace);
  if (isError(t)) return t;
  if (isError(f)) return f;
  if (isError(r)) return r;
  if (f === "") return t;
  if (occurrence === undefined) return t.split(f).join(r);
  const which = num(occurrence);
  if (isError(which)) return which;
  let count = 0;
  let index = t.indexOf(f);
  while (index !== -1) {
    count += 1;
    if (count === which) return t.slice(0, index) + r + t.slice(index + f.length);
    index = t.indexOf(f, index + f.length);
  }
  return t;
} });

define("REPLACE", { min: 4, max: 4, fn: ([value, start, count, replacement]) => {
  const t = text(value); const s = num(start); const n = num(count); const r = text(replacement);
  if (isError(t)) return t;
  if (isError(s)) return s;
  if (isError(n)) return n;
  if (isError(r)) return r;
  return t.slice(0, s - 1) + r + t.slice(s - 1 + n);
} });

define("REPT", { min: 2, max: 2, fn: ([value, count]) => {
  const t = text(value); const n = num(count);
  if (isError(t)) return t;
  if (isError(n)) return n;
  return n <= 0 ? "" : t.repeat(Math.min(Math.floor(n), 1000));
} });

define(["CONCATENATE", "CONCAT"], { min: 1, max: Infinity, fn: (args) => {
  let out = "";
  for (const value of flat(args)) {
    const t = toText(value);
    if (isError(t)) return t;
    out += t;
  }
  return out;
} });

define("TEXTJOIN", { min: 3, max: Infinity, fn: (args) => {
  const separator = text(args[0]);
  if (isError(separator)) return separator;
  const skipEmpty = bool(args[1]);
  if (isError(skipEmpty)) return skipEmpty;
  const parts = [];
  for (const value of flat(args.slice(2))) {
    if (skipEmpty && (isBlank(value) || value === "")) continue;
    const t = toText(value);
    if (isError(t)) return t;
    parts.push(t);
  }
  return parts.join(separator);
} });

define("JOIN", { min: 2, max: Infinity, fn: (args) => {
  const separator = text(args[0]);
  if (isError(separator)) return separator;
  return flat(args.slice(1)).map((value) => toText(value)).join(separator);
} });

define("SPLIT", { min: 2, max: 4, fn: ([value, delimiter, splitByEach, removeEmpty]) => {
  const t = text(value); const d = text(delimiter);
  if (isError(t)) return t;
  if (isError(d)) return d;
  const byEach = splitByEach === undefined ? true : Boolean(bool(splitByEach));
  const dropEmpty = removeEmpty === undefined ? true : Boolean(bool(removeEmpty));
  let parts;
  if (byEach && d.length > 1) {
    const pattern = new RegExp("[" + d.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&") + "]");
    parts = t.split(pattern);
  } else {
    parts = t.split(d);
  }
  if (dropEmpty) parts = parts.filter((part) => part !== "");
  return [parts.map((part) => {
    const asNumber = toNumber(part);
    return isError(asNumber) ? part : asNumber;
  })];
} });

define("VALUE", { min: 1, max: 1, fn: ([value]) => num(value) });

define("TEXT", { min: 2, max: 2, fn: ([value, format]) => {
  const f = text(format);
  if (isError(f)) return f;
  return applyTextFormat(isArrayValue(value) ? topLeft(value) : value, f);
} });

define("EXACT", { min: 2, max: 2, fn: ([a, b]) => {
  const left = text(a); const right = text(b);
  return isError(left) ? left : isError(right) ? right : left === right;
} });

/* --- dates --- */

define("TODAY", { min: 0, max: 0, fn: (args, context) => context.today });

define("DATE", { min: 3, max: 3, fn: ([year, month, day]) => {
  const y = num(year); const m = num(month); const d = num(day);
  return isError(y) ? y : isError(m) ? m : isError(d) ? d : ymdToSerial(y, m, d);
} });

define("YEAR", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : serialParts(n).year; } });
define("MONTH", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : serialParts(n).month; } });
define("DAY", { min: 1, max: 1, fn: ([value]) => { const n = num(value); return isError(n) ? n : serialParts(n).day; } });
define("WEEKDAY", { min: 1, max: 2, fn: ([value, type]) => {
  const n = num(value);
  if (isError(n)) return n;
  const weekday = serialParts(n).weekday; // 1 = Sunday
  const mode = type === undefined ? 1 : num(type);
  if (mode === 2) return weekday === 1 ? 7 : weekday - 1; // 1 = Monday
  if (mode === 3) return weekday === 1 ? 6 : weekday - 2; // 0 = Monday
  return weekday;
} });

define("DAYS", { min: 2, max: 2, fn: ([end, start]) => {
  const e = num(end); const s = num(start);
  return isError(e) ? e : isError(s) ? s : e - s;
} });

define("EDATE", { min: 2, max: 2, fn: ([start, months]) => {
  const s = num(start); const m = num(months);
  if (isError(s)) return s;
  if (isError(m)) return m;
  const parts = serialParts(s);
  const lastDay = new Date(Date.UTC(parts.year, parts.month - 1 + m + 1, 0)).getUTCDate();
  return ymdToSerial(parts.year, parts.month + m, Math.min(parts.day, lastDay));
} });

define("EOMONTH", { min: 2, max: 2, fn: ([start, months]) => {
  const s = num(start); const m = num(months);
  if (isError(s)) return s;
  if (isError(m)) return m;
  const parts = serialParts(s);
  return dateToSerial(new Date(Date.UTC(parts.year, parts.month + m, 0)));
} });

define("DATEDIF", { min: 3, max: 3, fn: ([start, end, unit]) => {
  const s = num(start); const e = num(end); const u = text(unit);
  if (isError(s)) return s;
  if (isError(e)) return e;
  if (isError(u)) return u;
  if (e < s) return err(ERR.NUM, "DATEDIF's start date must come before its end date");
  const a = serialParts(s);
  const b = serialParts(e);
  const unitUpper = u.toUpperCase();
  if (unitUpper === "D") return e - s;
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) months -= 1;
  if (unitUpper === "M") return months;
  if (unitUpper === "Y") return Math.floor(months / 12);
  if (unitUpper === "MD") {
    const previous = new Date(Date.UTC(b.year, b.month - 1, 0)).getUTCDate();
    return b.day >= a.day ? b.day - a.day : b.day + previous - a.day;
  }
  if (unitUpper === "YM") return months % 12;
  return err(ERR.NUM, `DATEDIF does not know the unit "${u}"`);
} });

define("NETWORKDAYS", { min: 2, max: 3, fn: ([start, end, holidays]) => {
  const s = num(start); const e = num(end);
  if (isError(s)) return s;
  if (isError(e)) return e;
  const holidaySet = new Set(holidays === undefined ? [] : flatRange(holidays).filter((value) => typeof value === "number"));
  const step = e >= s ? 1 : -1;
  let count = 0;
  for (let serial = s; step > 0 ? serial <= e : serial >= e; serial += step) {
    const weekday = serialParts(serial).weekday; // 1 = Sunday, 7 = Saturday
    if (weekday === 1 || weekday === 7) continue;
    if (holidaySet.has(serial)) continue;
    count += 1;
  }
  return step > 0 ? count : -count;
} });

/* --- arrays, and the Google-only tools --- */

define("ARRAYFORMULA", { min: 1, max: 1, fn: ([value]) => value });

define("TRANSPOSE", { min: 1, max: 1, fn: ([range]) => {
  const table = as2d(range);
  const width = Math.max(...table.map((row) => row.length), 0);
  const out = [];
  for (let column = 0; column < width; column++) {
    out.push(table.map((row) => (column < row.length ? row[column] : null)));
  }
  return out;
} });

define("FLATTEN", { min: 1, max: Infinity, fn: (args) => flat(args).map((value) => [value]) });

define("SEQUENCE", { min: 1, max: 4, fn: ([rows, columns, start, step]) => {
  const rowCount = num(rows);
  const columnCount = columns === undefined ? 1 : num(columns);
  const from = start === undefined ? 1 : num(start);
  const by = step === undefined ? 1 : num(step);
  for (const value of [rowCount, columnCount, from, by]) if (isError(value)) return value;
  if (rowCount < 1 || columnCount < 1) return err(ERR.VALUE, "SEQUENCE needs at least one row and one column");
  if (rowCount * columnCount > 5000) return err(ERR.NUM, "SEQUENCE was asked for too many cells");
  const out = [];
  let current = from;
  for (let row = 0; row < rowCount; row++) {
    const line = [];
    for (let column = 0; column < columnCount; column++) {
      line.push(current);
      current += by;
    }
    out.push(line);
  }
  return out;
} });

define("UNIQUE", { min: 1, max: 3, fn: ([range]) => {
  const table = as2d(range);
  const seen = new Set();
  const out = [];
  for (const row of table) {
    const key = JSON.stringify(row.map((value) => (typeof value === "string" ? value.toLowerCase() : value)));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.length ? out : [[null]];
} });

define("SORT", { min: 1, max: Infinity, fn: (args) => {
  const table = as2d(args[0]).map((row) => row.slice());
  const keys = [];
  for (let index = 1; index + 1 < args.length + 1 && index < args.length; index += 2) {
    const column = num(args[index]);
    if (isError(column)) return column;
    const ascending = args[index + 1] === undefined ? true : Boolean(bool(args[index + 1]));
    keys.push({ column: column - 1, ascending });
  }
  if (keys.length === 0) keys.push({ column: 0, ascending: true });

  const sorted = table.slice().sort((left, right) => {
    for (const key of keys) {
      const order = compareValues(left[key.column], right[key.column]);
      if (order !== 0) return key.ascending ? order : -order;
    }
    return 0;
  });
  return sorted;
} });

define("FILTER", { min: 2, max: Infinity, fn: (args) => {
  const table = as2d(args[0]);
  const conditions = args.slice(1).map((condition) => flat([condition]));
  const out = [];
  for (let index = 0; index < table.length; index++) {
    let keep = true;
    for (const condition of conditions) {
      const value = index < condition.length ? condition[index] : null;
      if (isError(value)) return value;
      const truth = toBoolean(value);
      if (isError(truth)) return truth;
      if (!truth) { keep = false; break; }
    }
    if (keep) out.push(table[index]);
  }
  return out.length ? out : err(ERR.NA, "FILTER found no rows matching the condition");
} });

define("QUERY", { min: 2, max: 3, fn: ([range, queryText, headers]) => {
  const table = as2d(range);
  const statement = text(queryText);
  if (isError(statement)) return statement;
  const headerRows = headers === undefined ? -1 : num(headers);
  if (isError(headerRows)) return headerRows;
  return runQuery(table, statement, headerRows);
} });

/** Names the evaluator resolves itself (they need the calling cell's position). */
export const POSITIONAL_FUNCTIONS = new Set(["ROW", "COLUMN"]);

/**
 * Functions that apply elementwise when handed a range or array.
 *
 * ARRAYFORMULA(UPPER(A2:A9)) works because UPPER is in here; SUM is not, because
 * SUM is meant to consume the whole range at once.
 */
export const SCALAR_FUNCTIONS = new Set([
  "ABS", "SQRT", "INT", "SIGN", "POWER", "MOD", "ROUND", "ROUNDUP", "ROUNDDOWN",
  "MROUND", "CEILING", "FLOOR",
  "LEN", "UPPER", "LOWER", "TRIM", "PROPER", "LEFT", "RIGHT", "MID", "FIND",
  "SEARCH", "SUBSTITUTE", "REPLACE", "REPT", "VALUE", "TEXT", "EXACT",
  "DATE", "YEAR", "MONTH", "DAY", "WEEKDAY", "EDATE", "EOMONTH", "DAYS", "DATEDIF",
  "IF", "IFS", "IFERROR", "IFNA", "SWITCH", "NOT",
  "ISBLANK", "ISNUMBER", "ISTEXT", "ISLOGICAL", "ISERROR", "ISNA", "ISEVEN", "ISODD",
]);

/**
 * Functions that broadcast over SOME arguments only.
 *
 * ARRAYFORMULA(VLOOKUP(A2:A9, Prices!A:B, 2, FALSE)) has to repeat the lookup once
 * per search key while handing the whole table to each call — so only argument 0
 * is spread. Broadcasting every argument would slice the table into single cells.
 */
export const PARTIAL_BROADCAST = {
  VLOOKUP: [0],
  HLOOKUP: [0],
  XLOOKUP: [0],
  MATCH: [0],
};
