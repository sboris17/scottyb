/**
 * The evaluator.
 *
 * Walks the AST from the parser against a context that can resolve references.
 * The one subtlety is broadcasting: when a range meets a scalar operator, or is
 * handed to an elementwise function, the result is an array — which is how
 * ARRAYFORMULA and the spilling functions do their work.
 */

import {
  ERR, err, isError, isBlank, firstError,
  toNumber, toText, toBoolean, equalValues, compareValues,
} from "./values.js";

import { FUNCTIONS, SCALAR_FUNCTIONS, PARTIAL_BROADCAST, isArrayValue } from "./functions.js";

function dimensions(value) {
  if (!isArrayValue(value)) return { rows: 1, columns: 1 };
  return { rows: value.length, columns: Math.max(...value.map((row) => row.length), 0) };
}

function at(value, row, column) {
  if (!isArrayValue(value)) return value;
  const line = value[value.length === 1 ? 0 : row];
  if (line === undefined) return err(ERR.NA, "the ranges are different sizes");
  const cell = line[line.length === 1 ? 0 : column];
  return cell === undefined ? err(ERR.NA, "the ranges are different sizes") : cell;
}

/** Applies `fn` elementwise across any array arguments. */
function broadcast(values, fn) {
  const anyArray = values.some(isArrayValue);
  if (!anyArray) return fn(values);

  let rows = 1;
  let columns = 1;
  for (const value of values) {
    const size = dimensions(value);
    rows = Math.max(rows, size.rows);
    columns = Math.max(columns, size.columns);
  }
  if (rows * columns > 20000) return err(ERR.NUM, "that would produce too many cells");

  const output = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let column = 0; column < columns; column++) {
      line.push(fn(values.map((value) => at(value, row, column))));
    }
    output.push(line);
  }
  return output;
}

/* --------------------------------------------------------------- operators */

function arithmetic(op, left, right) {
  const a = toNumber(left);
  if (isError(a)) return a;
  const b = toNumber(right);
  if (isError(b)) return b;

  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/":
      if (b === 0) return err(ERR.DIV0, "a formula tried to divide by zero");
      return a / b;
    case "^": {
      const result = Math.pow(a, b);
      return Number.isFinite(result) ? result : err(ERR.NUM, "that power is out of range");
    }
    default: return err(ERR.ERROR, `unknown operator ${op}`);
  }
}

function applyBinary(op, left, right) {
  const found = firstError(left, right);
  if (found) return found;

  if (op === "&") {
    const a = toText(left);
    if (isError(a)) return a;
    const b = toText(right);
    if (isError(b)) return b;
    return a + b;
  }
  if (op === "=") return equalValues(left, right);
  if (op === "<>") return !equalValues(left, right);
  if (op === "<") return compareValues(left, right) < 0;
  if (op === "<=") return compareValues(left, right) <= 0;
  if (op === ">") return compareValues(left, right) > 0;
  if (op === ">=") return compareValues(left, right) >= 0;
  return arithmetic(op, left, right);
}

/* -------------------------------------------------------------- evaluation */

export function evaluate(ast, context) {
  switch (ast.type) {
    case "number": return ast.value;
    case "string": return ast.value;
    case "boolean": return ast.value;
    case "missing": return null;
    case "error": return err(ast.value, "this formula refers to a cell that is off the sheet");

    case "ref": {
      if (ast.row === null) {
        // A bare column reference only reaches here inside a range; treat it as the
        // used extent of that column.
        return context.getRange(ast.col, 0, ast.col, context.lastRow());
      }
      return context.getCell(ast.col, ast.row);
    }

    case "range": {
      const startRow = ast.start.row === null ? 0 : ast.start.row;
      const endRow = ast.end.row === null ? context.lastRow() : ast.end.row;
      const startColumn = Math.min(ast.start.col, ast.end.col);
      const endColumn = Math.max(ast.start.col, ast.end.col);
      return context.getRange(startColumn, Math.min(startRow, endRow), endColumn, Math.max(startRow, endRow));
    }

    case "array": {
      const rows = ast.rows.map((row) => row.map((item) => {
        const value = evaluate(item, context);
        return isArrayValue(value) ? at(value, 0, 0) : value;
      }));
      return rows;
    }

    case "unary": {
      const operand = evaluate(ast.operand, context);
      return broadcast([operand], ([value]) => {
        const found = firstError(value);
        if (found) return found;
        const number = toNumber(value);
        if (isError(number)) return number;
        return ast.op === "-" ? -number : number;
      });
    }

    case "percent": {
      const operand = evaluate(ast.operand, context);
      return broadcast([operand], ([value]) => {
        const number = toNumber(value);
        return isError(number) ? number : number / 100;
      });
    }

    case "binary": {
      const left = evaluate(ast.left, context);
      const right = evaluate(ast.right, context);
      return broadcast([left, right], ([a, b]) => applyBinary(ast.op, a, b));
    }

    case "name":
      return err(ERR.NAME, `"${ast.name}" is not a function or a cell reference`);

    case "call":
      return evaluateCall(ast, context);

    default:
      return err(ERR.ERROR, "that formula could not be worked out");
  }
}

function evaluateCall(ast, context) {
  const name = ast.name;

  if (name === "ROW") {
    if (ast.args.length === 0) return context.position.row + 1;
    const target = ast.args[0];
    if (target.type === "ref") return target.row + 1;
    if (target.type === "range") return target.start.row + 1;
    return err(ERR.VALUE, "ROW needs a cell reference");
  }
  if (name === "COLUMN") {
    if (ast.args.length === 0) return context.position.col + 1;
    const target = ast.args[0];
    if (target.type === "ref") return target.col + 1;
    if (target.type === "range") return target.start.col + 1;
    return err(ERR.VALUE, "COLUMN needs a cell reference");
  }

  const spec = FUNCTIONS[name];
  if (!spec) {
    return err(ERR.NAME, `${name} is not a function this course knows. Check the spelling.`);
  }
  if (ast.args.length < spec.min) {
    return err(ERR.VALUE, `${name} needs at least ${spec.min} argument${spec.min === 1 ? "" : "s"}`);
  }
  if (ast.args.length > spec.max) {
    return err(ERR.VALUE, `${name} takes at most ${spec.max} argument${spec.max === 1 ? "" : "s"}`);
  }

  if (spec.lazy) {
    const thunks = ast.args.map((argument) => {
      let cached;
      let done = false;
      return () => {
        if (!done) { cached = evaluate(argument, context); done = true; }
        return cached;
      };
    });

    // A lazy function still needs to broadcast when its arguments are ranges,
    // as in ARRAYFORMULA(IF(A2:A9>10,"over","under")).
    if (SCALAR_FUNCTIONS.has(name)) {
      const values = thunks.map((thunk) => thunk());
      if (values.some(isArrayValue)) {
        return broadcast(values, (scalars) => {
          if (!spec.catchesErrors) {
            const found = firstError(...scalars);
            if (found) return found;
          }
          return spec.fn(scalars.map((value) => () => value), context);
        });
      }
    }
    return spec.fn(thunks, context);
  }

  const values = ast.args.map((argument) => evaluate(argument, context));

  if (!spec.catchesErrors) {
    for (const value of values) {
      if (isError(value)) return value;
    }
  }

  const spreadOver = PARTIAL_BROADCAST[name];
  if (spreadOver && spreadOver.some((index) => isArrayValue(values[index]))) {
    // Only the listed arguments vary; the rest are passed whole to every call.
    const varying = spreadOver.map((index) => values[index]);
    return broadcast(varying, (scalars) => {
      const call = values.slice();
      spreadOver.forEach((index, position) => { call[index] = scalars[position]; });
      const found = firstError(...scalars);
      if (found) return found;
      return spec.fn(call, context);
    });
  }

  if (SCALAR_FUNCTIONS.has(name) && values.some(isArrayValue)) {
    return broadcast(values, (scalars) => {
      if (!spec.catchesErrors) {
        const found = firstError(...scalars);
        if (found) return found;
      }
      return spec.fn(scalars, context);
    });
  }

  return spec.fn(values, context);
}
