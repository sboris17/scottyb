/**
 * A subset of the Google Visualisation query language, used by QUERY().
 *
 * Supported:
 *   select A, B, sum(C)          columns, * , and the aggregates sum/avg/count/max/min
 *   where C > 10 and A = 'x'     = != <> < > <= >=, contains, starts with, ends with,
 *                                matches, like, is null, is not null, and/or/not, ( )
 *   group by A
 *   order by sum(C) desc, A
 *   limit 5 / offset 2
 *   label A 'Name', sum(C) 'Total'
 *
 * Not supported (and reported as such rather than silently ignored): pivot, format,
 * options, and scalar functions such as year(). That covers what the course teaches
 * while keeping the failure mode honest.
 */

import { ERR, err, isBlank, compareValues, toText, toNumber, isError } from "./values.js";
import { indexToColumn, columnToIndex } from "./parser.js";

const KEYWORDS = new Set([
  "select", "where", "group", "by", "order", "limit", "offset", "label",
  "asc", "desc", "and", "or", "not", "is", "null", "contains", "starts",
  "ends", "with", "matches", "like", "pivot", "format", "options", "date",
  "true", "false",
]);

const AGGREGATES = new Set(["sum", "avg", "count", "max", "min"]);

class QueryError {
  constructor(message) {
    this.message = message;
  }
}

/* ---------------------------------------------------------------- tokenizer */

function tokenize(source) {
  const tokens = [];
  let position = 0;

  while (position < source.length) {
    const rest = source.slice(position);
    const character = rest[0];

    if (/\s/.test(character)) { position += 1; continue; }

    if (character === "'" || character === '"') {
      const end = rest.indexOf(character, 1);
      if (end === -1) throw new QueryError("a quoted value is missing its closing quote");
      tokens.push({ kind: "string", value: rest.slice(1, end) });
      position += end + 1;
      continue;
    }

    const number = /^\d+\.?\d*/.exec(rest);
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      position += number[0].length;
      continue;
    }

    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      const lower = word[0].toLowerCase();
      tokens.push({ kind: KEYWORDS.has(lower) ? "keyword" : "word", value: word[0], lower });
      position += word[0].length;
      continue;
    }

    const operator = ["<=", ">=", "!=", "<>", "=", "<", ">"].find((op) => rest.startsWith(op));
    if (operator) { tokens.push({ kind: "op", value: operator }); position += operator.length; continue; }

    if (character === "(") { tokens.push({ kind: "lparen" }); position += 1; continue; }
    if (character === ")") { tokens.push({ kind: "rparen" }); position += 1; continue; }
    if (character === ",") { tokens.push({ kind: "comma" }); position += 1; continue; }
    if (character === "*") { tokens.push({ kind: "star" }); position += 1; continue; }

    throw new QueryError(`"${character}" is not valid in a query`);
  }
  return tokens;
}

/* ------------------------------------------------------------------- parser */

class QueryParser {
  constructor(tokens, width) {
    this.tokens = tokens;
    this.position = 0;
    this.width = width;
  }

  peek(offset) { return this.tokens[this.position + (offset || 0)] || null; }
  next() { return this.tokens[this.position++] || null; }
  atKeyword(...words) {
    const token = this.peek();
    return Boolean(token && token.kind === "keyword" && words.includes(token.lower));
  }
  eatKeyword(word) {
    if (this.atKeyword(word)) { this.next(); return true; }
    return false;
  }
  expectKeyword(word) {
    if (!this.eatKeyword(word)) throw new QueryError(`expected "${word}"`);
  }

  /** A column identifier: A, B, ... or Col1, Col2, ... */
  parseColumn() {
    const token = this.next();
    if (!token || (token.kind !== "word" && token.kind !== "keyword")) {
      throw new QueryError("expected a column letter such as A");
    }
    const colMatch = /^Col(\d+)$/i.exec(token.value);
    if (colMatch) {
      const index = Number(colMatch[1]) - 1;
      if (index < 0 || index >= this.width) {
        throw new QueryError(`the range has no column ${token.value}`);
      }
      return index;
    }
    if (!/^[A-Za-z]{1,3}$/.test(token.value)) {
      throw new QueryError(`"${token.value}" is not a column letter`);
    }
    const index = columnToIndex(token.value);
    if (index >= this.width) {
      throw new QueryError(`the query asks for column ${token.value.toUpperCase()}, but the range is only ${this.width} column(s) wide`);
    }
    return index;
  }

  /** A select/order item: a plain column, or an aggregate over one. */
  parseItem() {
    const token = this.peek();
    if (token && (token.kind === "word" || token.kind === "keyword") &&
        AGGREGATES.has(token.lower || token.value.toLowerCase()) &&
        this.peek(1) && this.peek(1).kind === "lparen") {
      const aggregate = (token.lower || token.value.toLowerCase());
      this.next();
      this.next(); // (
      const column = this.parseColumn();
      const closing = this.next();
      if (!closing || closing.kind !== "rparen") throw new QueryError(`${aggregate}( is missing its closing bracket`);
      return { aggregate, column };
    }
    return { aggregate: null, column: this.parseColumn() };
  }

  parseValue() {
    if (this.atKeyword("date")) {
      this.next();
      const literal = this.next();
      if (!literal || literal.kind !== "string") throw new QueryError("date must be followed by a quoted date");
      const parsed = toNumber(literal.value);
      if (isError(parsed)) throw new QueryError(`"${literal.value}" is not a date the query understands`);
      return parsed;
    }
    const token = this.next();
    if (!token) throw new QueryError("expected a value");
    if (token.kind === "string") return token.value;
    if (token.kind === "number") return token.value;
    if (token.kind === "keyword" && token.lower === "true") return true;
    if (token.kind === "keyword" && token.lower === "false") return false;
    throw new QueryError(`expected a value, found "${token.value !== undefined ? token.value : token.kind}"`);
  }

  parseCondition() {
    if (this.peek() && this.peek().kind === "lparen") {
      this.next();
      const inner = this.parseOr();
      const closing = this.next();
      if (!closing || closing.kind !== "rparen") throw new QueryError("a bracket in where is not closed");
      return inner;
    }
    if (this.eatKeyword("not")) {
      return { kind: "not", operand: this.parseCondition() };
    }

    const column = this.parseColumn();

    if (this.eatKeyword("is")) {
      const negated = this.eatKeyword("not");
      this.expectKeyword("null");
      return { kind: "isNull", column, negated };
    }
    if (this.eatKeyword("contains")) return { kind: "contains", column, value: this.parseValue() };
    if (this.eatKeyword("matches")) return { kind: "matches", column, value: this.parseValue() };
    if (this.eatKeyword("like")) return { kind: "like", column, value: this.parseValue() };
    if (this.eatKeyword("starts")) { this.expectKeyword("with"); return { kind: "starts", column, value: this.parseValue() }; }
    if (this.eatKeyword("ends")) { this.expectKeyword("with"); return { kind: "ends", column, value: this.parseValue() }; }

    const operator = this.next();
    if (!operator || operator.kind !== "op") throw new QueryError("expected a comparison such as > or =");
    return { kind: "compare", column, operator: operator.value, value: this.parseValue() };
  }

  parseAnd() {
    let left = this.parseCondition();
    while (this.atKeyword("and")) {
      this.next();
      left = { kind: "and", left, right: this.parseCondition() };
    }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.atKeyword("or")) {
      this.next();
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  parse() {
    const plan = { select: null, where: null, groupBy: [], orderBy: [], limit: null, offset: null, labels: [] };

    if (this.eatKeyword("select")) {
      if (this.peek() && this.peek().kind === "star") {
        this.next();
        plan.select = "*";
      } else {
        plan.select = [this.parseItem()];
        while (this.peek() && this.peek().kind === "comma") {
          this.next();
          plan.select.push(this.parseItem());
        }
      }
    } else {
      plan.select = "*";
    }

    if (this.eatKeyword("where")) plan.where = this.parseOr();

    if (this.atKeyword("group")) {
      this.next();
      this.expectKeyword("by");
      plan.groupBy.push(this.parseColumn());
      while (this.peek() && this.peek().kind === "comma") {
        this.next();
        plan.groupBy.push(this.parseColumn());
      }
    }

    if (this.atKeyword("pivot")) throw new QueryError("this course's QUERY does not support pivot");

    if (this.atKeyword("order")) {
      this.next();
      this.expectKeyword("by");
      for (;;) {
        const item = this.parseItem();
        let descending = false;
        if (this.eatKeyword("desc")) descending = true;
        else this.eatKeyword("asc");
        plan.orderBy.push({ ...item, descending });
        if (this.peek() && this.peek().kind === "comma") { this.next(); continue; }
        break;
      }
    }

    if (this.eatKeyword("limit")) {
      const token = this.next();
      if (!token || token.kind !== "number") throw new QueryError("limit needs a number");
      plan.limit = token.value;
    }

    if (this.eatKeyword("offset")) {
      const token = this.next();
      if (!token || token.kind !== "number") throw new QueryError("offset needs a number");
      plan.offset = token.value;
    }

    if (this.eatKeyword("label")) {
      for (;;) {
        const item = this.parseItem();
        const label = this.next();
        if (!label || label.kind !== "string") throw new QueryError("label needs a quoted name");
        plan.labels.push({ item, label: label.value });
        if (this.peek() && this.peek().kind === "comma") { this.next(); continue; }
        break;
      }
    }

    if (this.atKeyword("format") || this.atKeyword("options")) {
      throw new QueryError("this course's QUERY does not support format or options");
    }

    if (this.position < this.tokens.length) {
      const leftover = this.peek();
      throw new QueryError(`there is something unexpected after the query: "${leftover.value !== undefined ? leftover.value : leftover.kind}"`);
    }
    return plan;
  }
}

/* ---------------------------------------------------------------- execution */

function matchesCondition(condition, row) {
  switch (condition.kind) {
    case "and": return matchesCondition(condition.left, row) && matchesCondition(condition.right, row);
    case "or": return matchesCondition(condition.left, row) || matchesCondition(condition.right, row);
    case "not": return !matchesCondition(condition.operand, row);
    case "isNull": {
      const blank = isBlank(row[condition.column]) || row[condition.column] === "";
      return condition.negated ? !blank : blank;
    }
    case "contains": return toText(row[condition.column]).toLowerCase().includes(String(condition.value).toLowerCase());
    case "starts": return toText(row[condition.column]).toLowerCase().startsWith(String(condition.value).toLowerCase());
    case "ends": return toText(row[condition.column]).toLowerCase().endsWith(String(condition.value).toLowerCase());
    case "like": {
      const pattern = String(condition.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
      return new RegExp("^" + pattern + "$", "i").test(toText(row[condition.column]));
    }
    case "matches":
      try {
        return new RegExp("^" + String(condition.value) + "$").test(toText(row[condition.column]));
      } catch (error) {
        return false;
      }
    case "compare": {
      const order = compareValues(row[condition.column], condition.value);
      switch (condition.operator) {
        case "=": return order === 0;
        case "!=": case "<>": return order !== 0;
        case "<": return order < 0;
        case "<=": return order <= 0;
        case ">": return order > 0;
        case ">=": return order >= 0;
        default: return false;
      }
    }
    default: return false;
  }
}

function aggregate(name, values) {
  const nums = values.filter((value) => typeof value === "number");
  switch (name) {
    case "sum": return nums.reduce((total, value) => total + value, 0);
    case "avg": return nums.length ? nums.reduce((total, value) => total + value, 0) / nums.length : null;
    case "count": return values.filter((value) => !isBlank(value) && value !== "").length;
    case "max": return nums.length ? Math.max(...nums) : null;
    case "min": return nums.length ? Math.min(...nums) : null;
    default: return null;
  }
}

function itemKey(item) {
  return (item.aggregate || "") + ":" + item.column;
}

function defaultHeader(item, headers) {
  const base = headers[item.column] !== undefined && headers[item.column] !== null && headers[item.column] !== ""
    ? toText(headers[item.column])
    : indexToColumn(item.column);
  return item.aggregate ? `${item.aggregate} ${base}` : base;
}

/** Decides whether the first row is a header when the caller said "guess" (-1). */
function guessHeaderRows(table) {
  if (table.length < 2) return 0;
  const first = table[0];
  const allText = first.every((value) => typeof value === "string" && value !== "");
  if (!allText) return 0;
  const restHasNonText = table.slice(1).some((row) => row.some((value) => typeof value !== "string" && !isBlank(value)));
  return restHasNonText ? 1 : 0;
}

export function runQuery(table, statement, headerRows) {
  const width = Math.max(...table.map((row) => row.length), 0);
  const padded = table.map((row) => {
    const copy = row.slice();
    while (copy.length < width) copy.push(null);
    return copy;
  });

  let plan;
  try {
    plan = new QueryParser(tokenize(statement), width).parse();
  } catch (error) {
    if (error instanceof QueryError) return err(ERR.VALUE, `QUERY: ${error.message}`);
    return err(ERR.VALUE, "QUERY could not read that query");
  }

  const headerCount = headerRows === -1 || headerRows === undefined ? guessHeaderRows(padded) : Math.max(0, headerRows);
  const headerRow = headerCount > 0 ? padded[headerCount - 1] : [];
  const headers = [];
  for (let index = 0; index < width; index++) headers.push(headerRow[index]);
  let rows = padded.slice(headerCount);

  if (plan.where) {
    try {
      rows = rows.filter((row) => matchesCondition(plan.where, row));
    } catch (error) {
      return err(ERR.VALUE, "QUERY: the where clause could not be applied");
    }
  }

  const selectItems = plan.select === "*"
    ? Array.from({ length: width }, (unused, index) => ({ aggregate: null, column: index }))
    : plan.select;

  const hasAggregate = selectItems.some((item) => item.aggregate) ||
    plan.orderBy.some((item) => item.aggregate);

  let resultRows;
  let rowValueFor;

  if (plan.groupBy.length > 0) {
    const groups = new Map();
    for (const row of rows) {
      const key = JSON.stringify(plan.groupBy.map((column) => {
        const value = row[column];
        return typeof value === "string" ? value.toLowerCase() : value;
      }));
      if (!groups.has(key)) groups.set(key, { first: row, rows: [] });
      groups.get(key).rows.push(row);
    }
    const computed = [];
    for (const group of groups.values()) {
      const values = new Map();
      for (const item of [...selectItems, ...plan.orderBy]) {
        if (values.has(itemKey(item))) continue;
        values.set(
          itemKey(item),
          item.aggregate
            ? aggregate(item.aggregate, group.rows.map((row) => row[item.column]))
            : group.first[item.column]
        );
      }
      computed.push(values);
    }
    resultRows = computed;
    rowValueFor = (holder, item) => holder.get(itemKey(item));
  } else if (hasAggregate) {
    const values = new Map();
    for (const item of [...selectItems, ...plan.orderBy]) {
      values.set(
        itemKey(item),
        item.aggregate ? aggregate(item.aggregate, rows.map((row) => row[item.column])) : (rows[0] ? rows[0][item.column] : null)
      );
    }
    resultRows = [values];
    rowValueFor = (holder, item) => holder.get(itemKey(item));
  } else {
    resultRows = rows;
    rowValueFor = (row, item) => row[item.column];
  }

  // Grouped results come back sorted by the grouping columns unless the query
  // says otherwise, which is what Sheets does.
  if (plan.groupBy.length > 0 && plan.orderBy.length === 0) {
    const groupItems = plan.groupBy.map((column) => ({ aggregate: null, column }));
    resultRows = resultRows.slice().sort((left, right) => {
      for (const item of groupItems) {
        const order = compareValues(rowValueFor(left, item), rowValueFor(right, item));
        if (order !== 0) return order;
      }
      return 0;
    });
  }

  if (plan.orderBy.length > 0) {
    resultRows = resultRows.slice().sort((left, right) => {
      for (const item of plan.orderBy) {
        const order = compareValues(rowValueFor(left, item), rowValueFor(right, item));
        if (order !== 0) return item.descending ? -order : order;
      }
      return 0;
    });
  }

  if (plan.offset !== null) resultRows = resultRows.slice(plan.offset);
  if (plan.limit !== null) resultRows = resultRows.slice(0, plan.limit);

  const labelled = new Map();
  for (const entry of plan.labels) labelled.set(itemKey(entry.item), entry.label);

  const output = [];
  if (headerCount > 0) {
    output.push(selectItems.map((item) => {
      const key = itemKey(item);
      return labelled.has(key) ? labelled.get(key) : defaultHeader(item, headers);
    }));
  }
  for (const row of resultRows) {
    output.push(selectItems.map((item) => {
      const value = rowValueFor(row, item);
      return value === undefined ? null : value;
    }));
  }

  return output.length ? output : [[null]];
}
