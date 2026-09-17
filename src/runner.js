/**
 * Runs learner code in the browser.
 *
 * Preferred path: a Web Worker built from a blob URL. That gives us a hard
 * timeout — a beginner's first `while` loop is very often an infinite one, and
 * terminating a worker is the only way to recover from that without the learner
 * losing their work to a frozen tab.
 *
 * Fallback path: run inline on the main thread. Blob workers are blocked under
 * the `file://` protocol, and opening index.html directly is a supported way to
 * use this course, so we degrade rather than fail. Inline runs cannot be
 * interrupted, hence the loud warning in the UI.
 */

import { buildProgram } from "./harness.js";

const TIMEOUT_MS = 4000;

const WORKER_SOURCE = `
self.onmessage = function (event) {
  var program = event.data.program;
  try {
    var result = new Function(program)();
    self.postMessage({ ok: true, output: result.output, results: result.results });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: { name: error.name || "Error", message: error.message || String(error) },
    });
  }
};
`;

let workerUrl = null;
let workersUsable = null;

function getWorkerUrl() {
  if (workerUrl === null) {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  }
  return workerUrl;
}

/** True when a Worker can actually be constructed here (not under file://). */
export function workersAvailable() {
  if (workersUsable !== null) return workersUsable;
  try {
    const probe = new Worker(getWorkerUrl());
    probe.terminate();
    workersUsable = true;
  } catch (error) {
    workersUsable = false;
  }
  return workersUsable;
}

function runInWorker(program) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(getWorkerUrl());
    } catch (error) {
      resolve(runInline(program));
      return;
    }

    const timer = setTimeout(() => {
      worker.terminate();
      resolve({
        ok: false,
        timedOut: true,
        error: {
          name: "TimeoutError",
          message:
            "Your code ran for more than " + TIMEOUT_MS / 1000 +
            " seconds and was stopped. This almost always means a loop never reaches its stopping point.",
        },
      });
    }, TIMEOUT_MS);

    worker.onmessage = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({
        ok: false,
        error: { name: "Error", message: event.message || "Something went wrong while running your code." },
      });
    };

    worker.postMessage({ program });
  });
}

function runInline(program) {
  try {
    const result = new Function(program)();
    return { ok: true, output: result.output, results: result.results };
  } catch (error) {
    return {
      ok: false,
      error: { name: error.name || "Error", message: error.message || String(error) },
    };
  }
}

/**
 * Runs `code` against `tests`.
 *
 * @returns {Promise<{ok: boolean, output?: string[], results?: object[], error?: object, timedOut?: boolean}>}
 *   `ok: false` means the code never finished — a syntax error, a thrown error
 *   outside a test, or a timeout. `ok: true` means it ran; individual checks may
 *   still have failed, which is reported per-test in `results`.
 */
export function run(code, tests) {
  const program = buildProgram(code, tests || []);
  return workersAvailable() ? runInWorker(program) : Promise.resolve(runInline(program));
}

/** Runs code with no checks — used by the free-form scratchpad. */
export function runScratch(code) {
  return run(code, []);
}
