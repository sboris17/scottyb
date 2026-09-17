/**
 * Formula tokenizer and parser.
 *
 * Produces an AST for the evaluator. Precedence, lowest to highest:
 *   comparison (= <> < > <= >=)  ->  & concatenation  ->  + -  ->  * /
 *   ->  unary + -  ->  ^  ->  trailing %  ->  primary
 *
 * That is the spreadsheet order, and it differs from most programming languages
 * in putting concatenation between comparison and addition.
 */

import { err, ERR } from "./values.js";

/* ------------------------------------------------------------ A1 references */

export function columnToIndex(letters) {
  let index = 0;
  for (const character of letters.toUpperCase()) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

export function indexToColumn(index) {
  let letters = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** "B7" or "$B$7" -> { col, row, colAbs, rowAbs }. Rows are 0-based internally. */
export function parseA1(text) {
  const match = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(text.trim());
  if (!match) return null;
  return {
    colAbs: match[1] === "$",
    col: columnToIndex(match[2]),
    rowAbs: match[3] === "$",
    row: Number(match[4]) - 1,
  };
}

export function formatA1(col, row) {
  return indexToColumn(col) + (row + 1);
}

/* ---------------------------------------------------------------- tokenizer */

const CELL_REF = /^\$?[A-Za-z]{1,3}\$?\d+/;
const COLUMN_REF = /^\$?[A-Za-z]{1,3}(?![A-Za-z0-9_])/;
const NUMBER = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.]*/;

const TWO_CHAR_OPS = ["<=", ">=", "<>"];
const ONE_CHAR_OPS = ["+", "-", "*", "/", "^", "&", "=", "<", ">", "%"];

class ParseError {
  constructor(message) {
    this.message = message;
  }
}

function tokenize(source) {
  const tokens = [];
  let position = 0;

  while (position < source.length) {
    const rest = source.slice(position);
    const character = rest[0];

    if (/\s/.test(character)) {
      position += 1;
      continue;
    }

    const errorLiteral = /^#(DIV\/0!|N\/A|VALUE!|REF!|NAME\?|NUM!|ERROR!|CYCLE!)/.exec(rest);
    if (errorLiteral) {
      tokens.push({ kind: "error", value: errorLiteral[0] });
      position += errorLiteral[0].length;
      continue;
    }

    if (character === '"') {
      let index = 1;
      let text = "";
      while (index < rest.length) {
        if (rest[index] === '"') {
          if (rest[index + 1] === '"') {
            // "" inside a string literal is an escaped quote.
            text += '"';
            index += 2;
            continue;
          }
          break;
        }
        text += rest[index];
        index += 1;
      }
      if (index >= rest.length) throw new ParseError("a text value is missing its closing quotation mark");
      tokens.push({ kind: "string", value: text });
      position += index + 1;
      continue;
    }

    const number = NUMBER.exec(rest);
    if (number && /\d|\./.test(character)) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      position += number[0].length;
      continue;
    }

    // A cell reference, unless it is really a function name such as LOG10(.
    const cell = CELL_REF.exec(rest);
    if (cell) {
      const after = rest.slice(cell[0].length).replace(/^\s*/, "");
      if (!after.startsWith("(")) {
        tokens.push({ kind: "cell", value: cell[0] });
        position += cell[0].length;
        continue;
      }
    }

    // A whole-column reference only counts as one inside a range: A:A, not A.
    const column = COLUMN_REF.exec(rest);
    if (column) {
      const after = rest.slice(column[0].length).replace(/^\s*/, "");
      const previous = tokens[tokens.length - 1];
      if (after.startsWith(":") || (previous && previous.kind === "colon")) {
        tokens.push({ kind: "column", value: column[0] });
        position += column[0].length;
        continue;
      }
    }

    const identifier = IDENTIFIER.exec(rest);
    if (identifier) {
      tokens.push({ kind: "identifier", value: identifier[0] });
      position += identifier[0].length;
      continue;
    }

    if (character === "(") { tokens.push({ kind: "lparen" }); position += 1; continue; }
    if (character === ")") { tokens.push({ kind: "rparen" }); position += 1; continue; }
    if (character === "{") { tokens.push({ kind: "lbrace" }); position += 1; continue; }
    if (character === "}") { tokens.push({ kind: "rbrace" }); position += 1; continue; }
    if (character === ",") { tokens.push({ kind: "comma" }); position += 1; continue; }
    if (character === ";") { tokens.push({ kind: "semicolon" }); position += 1; continue; }
    if (character === ":") { tokens.push({ kind: "colon" }); position += 1; continue; }

    const twoChar = TWO_CHAR_OPS.find((op) => rest.startsWith(op));
    if (twoChar) { tokens.push({ kind: "op", value: twoChar }); position += 2; continue; }

    if (ONE_CHAR_OPS.includes(character)) {
      tokens.push({ kind: "op", value: character });
      position += 1;
      continue;
    }

    throw new ParseError(`"${character}" is not something a formula can contain`);
  }

  return tokens;
}

/* ------------------------------------------------------------------- parser */

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  peek(offset) {
    return this.tokens[this.position + (offset || 0)] || null;
  }

  next() {
    return this.tokens[this.position++] || null;
  }

  expect(kind, description) {
    const token = this.next();
    if (!token || token.kind !== kind) {
      throw new ParseError(`expected ${description}`);
    }
    return token;
  }

  isOp(value, offset) {
    const token = this.peek(offset);
    return token && token.kind === "op" && token.value === value;
  }

  parseExpression() {
    return this.parseComparison();
  }

  parseComparison() {
    let left = this.parseConcat();
    while (["=", "<>", "<", ">", "<=", ">="].some((op) => this.isOp(op))) {
      const op = this.next().value;
      left = { type: "binary", op, left, right: this.parseConcat() };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAdditive();
    while (this.isOp("&")) {
      this.next();
      left = { type: "binary", op: "&", left, right: this.parseAdditive() };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value;
      left = { type: "binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/")) {
      const op = this.next().value;
      left = { type: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.isOp("-") || this.isOp("+")) {
      const op = this.next().value;
      return { type: "unary", op, operand: this.parseUnary() };
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePostfix();
    if (this.isOp("^")) {
      this.next();
      // Right-associative, and -2^2 is -(2^2) because unary binds looser.
      return { type: "binary", op: "^", left: base, right: this.parseUnary() };
    }
    return base;
  }

  parsePostfix() {
    let node = this.parsePrimary();
    while (this.isOp("%")) {
      this.next();
      node = { type: "percent", operand: node };
    }
    return node;
  }

  parseRefFrom(token) {
    // token is a cell or column reference; a following colon makes it a range.
    if (this.peek() && this.peek().kind === "colon") {
      this.next();
      const endToken = this.next();
      if (!endToken || (endToken.kind !== "cell" && endToken.kind !== "column")) {
        throw new ParseError("a range needs a cell on both sides of the colon, like A1:B10");
      }
      return { type: "range", start: refNode(token), end: refNode(endToken) };
    }
    if (token.kind === "column") {
      throw new ParseError(`"${token.value}" is not a cell reference — did you mean ${token.value}1?`);
    }
    return refNode(token);
  }

  parsePrimary() {
    const token = this.next();
    if (!token) throw new ParseError("the formula ends too soon");

    if (token.kind === "number") return { type: "number", value: token.value };
    if (token.kind === "error") return { type: "error", value: token.value };
    if (token.kind === "string") return { type: "string", value: token.value };
    if (token.kind === "cell" || token.kind === "column") return this.parseRefFrom(token);

    if (token.kind === "identifier") {
      const upper = token.value.toUpperCase();
      if (this.peek() && this.peek().kind === "lparen") {
        this.next();
        const args = [];
        if (this.peek() && this.peek().kind === "rparen") {
          this.next();
          return { type: "call", name: upper, args };
        }
        for (;;) {
          // A missing argument, as in IF(A1,,"no"), is a blank placeholder.
          if (this.peek() && (this.peek().kind === "comma" || this.peek().kind === "rparen")) {
            args.push({ type: "missing" });
          } else {
            args.push(this.parseExpression());
          }
          const separator = this.next();
          if (!separator) throw new ParseError(`${upper} is missing its closing bracket`);
          if (separator.kind === "rparen") break;
          if (separator.kind !== "comma" && separator.kind !== "semicolon") {
            throw new ParseError(`${upper}'s arguments must be separated by commas`);
          }
        }
        return { type: "call", name: upper, args };
      }
      if (upper === "TRUE") return { type: "boolean", value: true };
      if (upper === "FALSE") return { type: "boolean", value: false };
      return { type: "name", name: token.value };
    }

    if (token.kind === "lparen") {
      const inner = this.parseExpression();
      this.expect("rparen", "a closing bracket");
      return inner;
    }

    if (token.kind === "lbrace") {
      const rows = [[]];
      if (this.peek() && this.peek().kind === "rbrace") {
        this.next();
        return { type: "array", rows: [[]] };
      }
      for (;;) {
        rows[rows.length - 1].push(this.parseExpression());
        const separator = this.next();
        if (!separator) throw new ParseError("an array is missing its closing brace");
        if (separator.kind === "rbrace") break;
        if (separator.kind === "comma") continue;
        if (separator.kind === "semicolon") { rows.push([]); continue; }
        throw new ParseError("an array's items must be separated by commas or semicolons");
      }
      return { type: "array", rows };
    }

    if (token.kind === "op") throw new ParseError(`"${token.value}" has nothing to work on`);
    throw new ParseError("the formula could not be read");
  }
}

function refNode(token) {
  if (token.kind === "cell") {
    const parsed = parseA1(token.value);
    return { type: "ref", ...parsed };
  }
  const letters = token.value.replace(/\$/g, "");
  return { type: "ref", col: columnToIndex(letters), row: null, colAbs: token.value.startsWith("$"), rowAbs: false };
}

/**
 * Parses a formula body (no leading "=").
 * Returns { ok: true, ast } or { ok: false, error } with a learner-readable reason.
 */
export function parseFormula(source) {
  try {
    const tokens = tokenize(source);
    if (tokens.length === 0) throw new ParseError("the formula is empty");
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();
    if (parser.position < tokens.length) {
      throw new ParseError("there is something left over at the end of the formula");
    }
    return { ok: true, ast };
  } catch (error) {
    if (error instanceof ParseError) {
      return { ok: false, error: err(ERR.ERROR, error.message) };
    }
    return { ok: false, error: err(ERR.ERROR, "the formula could not be read") };
  }
}

/** Collects every function name used, for checks that insist on a given function. */
export function functionsUsed(ast, found) {
  const names = found || new Set();
  if (!ast || typeof ast !== "object") return names;
  if (ast.type === "call") names.add(ast.name);
  for (const key of Object.keys(ast)) {
    const value = ast[key];
    if (Array.isArray(value)) value.forEach((item) => functionsUsed(item, names));
    else if (value && typeof value === "object") functionsUsed(value, names);
  }
  return names;
}

/** True when the formula mentions at least one cell or range. */
export function referencesCells(ast) {
  if (!ast || typeof ast !== "object") return false;
  if (ast.type === "ref" || ast.type === "range") return true;
  return Object.keys(ast).some((key) => {
    const value = ast[key];
    if (Array.isArray(value)) return value.some((item) => referencesCells(item));
    return value && typeof value === "object" ? referencesCells(value) : false;
  });
}
