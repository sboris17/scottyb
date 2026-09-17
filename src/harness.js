/**
 * The test harness.
 *
 * This module is the single source of truth for *how* a learner's code is run
 * and checked. The browser (src/runner.js) and the CI verifier (tools/verify.mjs)
 * both build their program with `buildProgram`, so an exercise that passes in the
 * browser passes in CI, and vice versa.
 *
 * The harness is emitted as source text rather than imported as a module because
 * the learner's code has to share a scope with the assertions that check it: a
 * `function addTwo(...)` typed at the top level must be visible to the test that
 * calls `addTwo(2)`.
 */

/** Source for the sandbox preamble: console capture, value formatting, assertions. */
export const HARNESS_SOURCE = `
"use strict";

const __output = [];

function __format(value, depth) {
  depth = depth || 0;
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "function") return "[function " + (value.name || "anonymous") + "]";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return String(value) + "n";
  if (typeof value === "symbol") return value.toString();
  if (depth > 4) return "...";
  if (Array.isArray(value)) {
    return "[" + value.map(function (item) { return __format(item, depth + 1); }).join(", ") + "]";
  }
  if (value instanceof Error) return value.name + ": " + value.message;
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  return "{ " + keys.map(function (key) {
    return key + ": " + __format(value[key], depth + 1);
  }).join(", ") + " }";
}

/** Quoted form, used in failure messages so "2" and 2 are told apart. */
function __show(value) {
  return typeof value === "string" ? JSON.stringify(value) : __format(value, 1);
}

const console = {
  log: function () {
    __output.push(Array.prototype.map.call(arguments, function (a) { return __format(a, 0); }).join(" "));
  },
};
console.info = console.log;
console.warn = console.log;
console.error = console.log;
console.debug = console.log;

/** The learner-visible record of everything printed so far. */
const output = __output;

function __fail(message) {
  const error = new Error(message);
  error.__assertion = true;
  throw error;
}

function __deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(function (key) {
    return Object.prototype.hasOwnProperty.call(b, key) && __deepEqual(a[key], b[key]);
  });
}

const assert = {
  equal: function (actual, expected, message) {
    if (actual !== expected && !(Number.isNaN(actual) && Number.isNaN(expected))) {
      __fail(message || ("expected " + __show(expected) + " but got " + __show(actual)));
    }
  },
  notEqual: function (actual, unexpected, message) {
    if (actual === unexpected) __fail(message || ("expected something other than " + __show(unexpected)));
  },
  deepEqual: function (actual, expected, message) {
    if (!__deepEqual(actual, expected)) {
      __fail(message || ("expected " + __show(expected) + " but got " + __show(actual)));
    }
  },
  close: function (actual, expected, tolerance, message) {
    tolerance = tolerance === undefined ? 1e-9 : tolerance;
    if (typeof actual !== "number" || Math.abs(actual - expected) > tolerance) {
      __fail(message || ("expected roughly " + __show(expected) + " but got " + __show(actual)));
    }
  },
  ok: function (value, message) {
    if (!value) __fail(message || ("expected a truthy value but got " + __show(value)));
  },
  notOk: function (value, message) {
    if (value) __fail(message || ("expected a falsy value but got " + __show(value)));
  },
  type: function (value, expectedType, message) {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== expectedType) {
      __fail(message || ("expected a " + expectedType + " but got a " + actualType + " (" + __show(value) + ")"));
    }
  },
  includes: function (haystack, needle, message) {
    const present = Array.isArray(haystack)
      ? haystack.some(function (item) { return __deepEqual(item, needle); })
      : typeof haystack === "string" && haystack.indexOf(needle) !== -1;
    if (!present) __fail(message || (__show(haystack) + " does not contain " + __show(needle)));
  },
  throws: function (fn, message) {
    let threw = false;
    try { fn(); } catch (error) { threw = true; }
    if (!threw) __fail(message || "expected the code to throw an error, but it did not");
  },
  /** Checks a binding exists at all; \`fn\` is a thunk like \`() => total\`. */
  declared: function (fn, name) {
    try {
      fn();
    } catch (error) {
      if (error instanceof ReferenceError) {
        __fail("no variable named " + (name || "that") + " was declared");
      }
      throw error;
    }
  },
  /** Asserts some printed line contains \`text\`. */
  printed: function (text, message) {
    const found = __output.some(function (line) { return line.indexOf(String(text)) !== -1; });
    if (!found) {
      __fail(message || ("nothing printed contained " + __show(text) +
        (__output.length ? ". Printed: " + __output.map(__show).join(", ") : ". Nothing was printed at all.")));
    }
  },
  /** Asserts the printed lines are exactly these, in order. */
  printedLines: function (expected, message) {
    if (!__deepEqual(__output, expected)) {
      __fail(message || ("expected the printed lines to be " + __show(expected) + " but they were " + __show(__output)));
    }
  },
  printedCount: function (count, message) {
    if (__output.length !== count) {
      __fail(message || ("expected " + count + " printed line(s) but got " + __output.length));
    }
  },
  fail: function (message) {
    __fail(message || "failed");
  },
};

const __results = [];

function __test(name, fn) {
  try {
    fn();
    __results.push({ name: name, passed: true });
  } catch (error) {
    __results.push({
      name: name,
      passed: false,
      message: error && error.message ? error.message : String(error),
      assertion: Boolean(error && error.__assertion),
    });
  }
}
`;

/**
 * Builds the full program text: harness, then learner code, then each test.
 *
 * @param {string} userCode  Code as typed by the learner.
 * @param {Array<{name: string, code: string}>} tests
 * @returns {string} Source for a function body returning `{ output, results }`.
 */
export function buildProgram(userCode, tests) {
  const testSource = (tests || [])
    .map((test) => `__test(${JSON.stringify(test.name)}, function () {\n${test.code}\n});`)
    .join("\n");

  return `${HARNESS_SOURCE}
// The learner's own source text, so a check can look at *how* something was
// written — e.g. that an answer was calculated rather than typed in literally.
const __SOURCE = ${JSON.stringify(userCode)};
// ---- learner code ----
${userCode}
// ---- checks ----
${testSource}
return { output: __output, results: __results };`;
}

/** Number of lines the harness occupies, so reported error lines can be adjusted. */
export const HARNESS_LINE_OFFSET = HARNESS_SOURCE.split("\n").length + 1;
