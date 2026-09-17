/**
 * The value model.
 *
 * A cell value is one of:
 *   null        blank
 *   number      including dates, which are serial numbers (see below)
 *   string      text
 *   boolean     TRUE / FALSE
 *   SheetError  #DIV/0! and friends
 *
 * Coercion follows Google Sheets rather than strict typing, because the point of
 * the course is to teach what Sheets actually does. Notably: "5"+1 is 6, blanks
 * are 0 in arithmetic and "" in text, TRUE is 1, and text comparison ignores case.
 */

export const ERR = {
  DIV0: "#DIV/0!",
  NA: "#N/A",
  VALUE: "#VALUE!",
  REF: "#REF!",
  NAME: "#NAME?",
  NUM: "#NUM!",
  ERROR: "#ERROR!",
  CYCLE: "#CYCLE!",
};

export class SheetError {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail || "";
  }
  toString() {
    return this.type;
  }
}

export function err(type, detail) {
  return new SheetError(type, detail);
}

export function isError(value) {
  return value instanceof SheetError;
}

export function isBlank(value) {
  return value === null || value === undefined;
}

/** Throws are not used for errors; they are returned. This propagates the first one found. */
export function firstError(...values) {
  for (const value of values) {
    if (isError(value)) return value;
    if (Array.isArray(value)) {
      for (const row of value) {
        const found = firstError(...row);
        if (found) return found;
      }
    }
  }
  return null;
}

const NUMERIC_TEXT = /^\s*-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/;
const PERCENT_TEXT = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*%\s*$/;

/**
 * Number coercion. Returns a SheetError rather than throwing, so callers can
 * propagate it the way a spreadsheet does.
 */
export function toNumber(value) {
  if (isError(value)) return value;
  if (isBlank(value)) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    if (NUMERIC_TEXT.test(value)) return Number(value.trim());
    const percent = value.match(PERCENT_TEXT);
    if (percent) return Number(percent[1]) / 100;
    const asDate = parseDateText(value);
    if (asDate !== null) return asDate;
    return err(ERR.VALUE, `"${value}" is text, not a number`);
  }
  return err(ERR.VALUE, "expected a number");
}

export function toText(value) {
  if (isError(value)) return value;
  if (isBlank(value)) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return formatNumberForText(value);
  return String(value);
}

export function toBoolean(value) {
  if (isError(value)) return value;
  if (isBlank(value)) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    return err(ERR.VALUE, `"${value}" is not TRUE or FALSE`);
  }
  return err(ERR.VALUE, "expected a boolean");
}

/** How a number appears when concatenated into text. */
function formatNumberForText(number) {
  if (Number.isInteger(number)) return String(number);
  // Spreadsheets show up to ~10 significant decimals and drop trailing zeros.
  return String(Number(number.toPrecision(12)));
}

/* --------------------------------------------------------------- comparison */

/** Sort ranking: numbers before text before booleans, as in Sheets. */
function typeRank(value) {
  if (typeof value === "number") return 0;
  if (typeof value === "string") return 1;
  if (typeof value === "boolean") return 2;
  return -1; // blank sorts first
}

/**
 * Three-way comparison used by <, >, SORT and friends.
 * Text is compared case-insensitively, which is what Sheets does.
 */
export function compareValues(a, b) {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank && bBlank) return 0;

  // A blank compared with a typed value takes on that type's empty value.
  if (aBlank) a = typeof b === "number" ? 0 : typeof b === "boolean" ? false : "";
  if (bBlank) b = typeof a === "number" ? 0 : typeof a === "boolean" ? false : "";

  const rankA = typeRank(a);
  const rankB = typeRank(b);
  if (rankA !== rankB) return rankA < rankB ? -1 : 1;

  if (typeof a === "number") return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === "boolean") return a === b ? 0 : a === false ? -1 : 1;

  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Equality for the = operator and for lookup matching. */
export function equalValues(a, b) {
  if (isBlank(a) && isBlank(b)) return true;
  // Sheets treats a blank as equal to both 0 and "".
  if (isBlank(a)) return b === 0 || b === "" || b === false;
  if (isBlank(b)) return a === 0 || a === "" || a === false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (typeof a === "boolean" || typeof b === "boolean") return a === b;
  if (typeof a === "number" && typeof b === "string") return false;
  if (typeof a === "string" && typeof b === "number") return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/* -------------------------------------------------------------------- dates */

/**
 * Dates are serial numbers: day 0 is 30 December 1899, so 1 is 31/12/1899 and
 * 45292 is 1 January 2024. This is the spreadsheet convention (including the
 * historical 1900 leap-year quirk being absent in Sheets' own reckoning, which
 * uses a true proleptic count from that epoch).
 */
const EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

export function serialToDate(serial) {
  return new Date(EPOCH_UTC + Math.round(serial * MS_PER_DAY));
}

export function dateToSerial(date) {
  return Math.round((date.getTime() - EPOCH_UTC) / MS_PER_DAY);
}

export function ymdToSerial(year, month, day) {
  // Month and day overflow roll over, exactly as DATE() does in Sheets.
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH_UTC) / MS_PER_DAY);
}

export function serialParts(serial) {
  const date = serialToDate(serial);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay() + 1, // 1 = Sunday, matching WEEKDAY's default
  };
}

const ISO_DATE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/;
const SLASH_DATE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;

/** Parses the date text forms the course uses. Returns a serial, or null. */
export function parseDateText(text) {
  const iso = text.match(ISO_DATE);
  if (iso) return ymdToSerial(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = text.match(SLASH_DATE);
  // Written as DD/MM/YYYY, the form the course's sample data uses.
  if (slash) return ymdToSerial(Number(slash[3]), Number(slash[2]), Number(slash[1]));
  return null;
}

/* ------------------------------------------------------------------ display */

function pad(number, width) {
  return String(number).padStart(width, "0");
}

/**
 * Renders a value for the grid. `format` comes from the lesson data and is
 * deliberately a small vocabulary rather than a full format-string parser.
 */
export function displayValue(value, format) {
  if (isError(value)) return value.type;
  if (isBlank(value)) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (typeof value === "number") {
    if (format === "date") {
      const { year, month, day } = serialParts(value);
      return `${pad(day, 2)}/${pad(month, 2)}/${year}`;
    }
    if (format === "percent") return (value * 100).toFixed(1) + "%";
    if (format === "percent0") return Math.round(value * 100) + "%";
    if (format === "currency") return formatThousands(value.toFixed(2));
    if (format === "currency0") return formatThousands(Math.round(value).toFixed(0));
    if (format === "number2") return value.toFixed(2);
    if (format === "number1") return value.toFixed(1);
    if (format === "integer") return formatThousands(Math.round(value).toFixed(0));

    if (Number.isInteger(value)) return String(value);
    // Long binary-float tails are noise to a learner; show a sane precision.
    const rounded = Number(value.toPrecision(10));
    return String(rounded);
  }

  return String(value);
}

function formatThousands(fixed) {
  const [whole, fraction] = fixed.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + grouped + (fraction ? "." + fraction : "");
}
