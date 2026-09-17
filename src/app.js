/**
 * The course UI.
 *
 * A very small hash router with two views — the home page and a lesson page — plus
 * the exercise widget, which is where all the interesting behaviour lives.
 *
 * Deliberately dependency-free: no framework, no bundler, no CDN. The whole course
 * runs from a file:// double-click or any static host, offline, forever.
 */

import { lessons, findLesson, totalExercises } from "../curriculum/index.js";
import { run, workersAvailable } from "./runner.js";
import * as progress from "./progress.js";

const view = document.getElementById("view");
const nav = document.getElementById("lesson-nav");
const meterFill = document.getElementById("progress-fill");
const progressCount = document.getElementById("progress-count");

/* ------------------------------------------------------------------ helpers */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Sets trusted lesson markup.
 *
 * The HTML here comes from the curriculum modules, which ship with the course —
 * it is authored content, not learner input. Learner input is only ever put on
 * the page via textContent, never this.
 */
function setLessonHtml(node, html) {
  node.innerHTML = html;
  return node;
}

function lessonNumber(lesson) {
  return String(lessons.indexOf(lesson) + 1).padStart(2, "0");
}

function completedInLesson(lesson) {
  return lesson.exercises.filter((exercise) => progress.isComplete(exercise.id)).length;
}

function totalCompleted() {
  return lessons.reduce((sum, lesson) => sum + completedInLesson(lesson), 0);
}

/* ------------------------------------------------------------- chrome / nav */

function renderProgress() {
  const done = totalCompleted();
  const percent = totalExercises === 0 ? 0 : Math.round((done / totalExercises) * 100);
  meterFill.style.width = percent + "%";
  meterFill.dataset.complete = String(done === totalExercises && done > 0);
  progressCount.textContent = done + " / " + totalExercises + " exercises";
}

function renderNav(activeLessonId) {
  nav.textContent = "";
  for (const lesson of lessons) {
    const done = completedInLesson(lesson);
    const link = el("a", "nav-item");
    link.href = "#/lesson/" + lesson.id;
    if (lesson.id === activeLessonId) link.setAttribute("aria-current", "page");

    link.append(el("span", "nav-item__num", lessonNumber(lesson)));
    link.append(el("span", "nav-item__title", lesson.title));

    if (done > 0) {
      const complete = done === lesson.exercises.length;
      const tick = el("span", "nav-item__tick", complete ? "done" : done + "/" + lesson.exercises.length);
      tick.dataset.state = complete ? "complete" : "partial";
      link.append(tick);
    }
    nav.append(link);
  }
}

/* ---------------------------------------------------------------- home view */

function renderHome() {
  const page = el("div");

  const header = el("header", "lesson-header");
  header.append(el("p", "eyebrow", "Coding 101"));
  header.append(el("h1", null, "Learn to program, one small win at a time"));
  header.append(
    el(
      "p",
      "lede",
      "Ten short lessons and " + totalExercises +
        " exercises you solve in the page. Write code, press Run, and find out immediately whether it works."
    )
  );
  page.append(header);

  const intro = el("div", "prose");
  setLessonHtml(
    intro,
    `<p>This course assumes you have never written a line of code. It uses
     <strong>JavaScript</strong>, because it runs everywhere without installing
     anything — but what you learn here (variables, conditions, loops, functions,
     data) is how every language works. The punctuation differs; the ideas do not.</p>
     <p>Work through the lessons in order. Each one explains an idea and then asks you
     to use it. Your code is checked against real tests, the same ones the course's own
     build runs — so a green result genuinely means it works, not that it looks about right.</p>
     <p>Your progress and your code are saved in this browser, so you can stop
     mid-lesson and pick it up later.</p>`
  );
  page.append(intro);

  if (!progress.storageAvailable()) {
    page.append(
      el(
        "p",
        "notice",
        "Heads up: this browser is blocking local storage (private mode, or site data turned off), so progress will not be remembered between visits. Everything else works normally."
      )
    );
  }

  if (!workersAvailable()) {
    page.append(
      el(
        "p",
        "notice",
        "You are running the course straight from a file, so your code runs on the page itself and cannot be interrupted. If you write a loop that never ends, the tab will freeze and you will need to reload it. Serving the folder over http (see the README) avoids that."
      )
    );
  }

  const grid = el("div", "card-grid");
  for (const lesson of lessons) {
    const done = completedInLesson(lesson);
    const complete = done === lesson.exercises.length;

    const card = el("a", "card");
    card.href = "#/lesson/" + lesson.id;

    const top = el("div", "card__top");
    top.append(el("span", "card__num", "Lesson " + lessonNumber(lesson)));
    const status = el("span", "card__status", complete ? "complete" : done + "/" + lesson.exercises.length);
    status.dataset.complete = String(complete);
    top.append(status);

    card.append(top);
    card.append(el("div", "card__title", lesson.title));
    card.append(el("div", "card__summary", lesson.summary));
    grid.append(card);
  }
  page.append(grid);

  const start = el("div", "controls");
  const begin = el("button", "primary", totalCompleted() > 0 ? "Continue where you left off" : "Start lesson 1");
  begin.addEventListener("click", () => {
    const next = lessons.find((lesson) => completedInLesson(lesson) < lesson.exercises.length) || lessons[0];
    location.hash = "#/lesson/" + next.id;
  });
  start.append(begin);

  if (totalCompleted() > 0) {
    const reset = el("button", "ghost", "Start over");
    reset.addEventListener("click", () => {
      if (confirm("Clear all progress and saved code? This cannot be undone.")) {
        progress.resetAll();
        render();
      }
    });
    start.append(reset);
  }
  page.append(start);

  return page;
}

/* -------------------------------------------------------------- lesson view */

function renderLesson(lesson) {
  const index = lessons.indexOf(lesson);
  const page = el("div");

  const header = el("header", "lesson-header");
  header.append(
    el("p", "eyebrow", "Lesson " + lessonNumber(lesson) + " of " + lessons.length + " · about " + lesson.minutes + " min")
  );
  header.append(el("h1", null, lesson.title));
  header.append(el("p", "lede", lesson.summary));
  page.append(header);

  for (const section of lesson.sections) {
    const block = el("section", "section");
    block.append(el("h2", null, section.heading));
    block.append(setLessonHtml(el("div", "prose"), section.body));
    page.append(block);
  }

  const exercisesHeading = el("h2", null, lesson.exercises.length === 1 ? "Exercise" : "Exercises");
  page.append(exercisesHeading);

  lesson.exercises.forEach((exercise, position) => {
    page.append(renderExercise(exercise, position + 1, lesson.exercises.length));
  });

  const pager = el("nav", "pager");
  const previous = el("a", index === 0 ? "is-hidden" : "", index === 0 ? "" : "← " + lessons[index - 1].title);
  previous.href = index === 0 ? "#/" : "#/lesson/" + lessons[index - 1].id;
  const next = el("a", index === lessons.length - 1 ? "is-hidden" : "", index === lessons.length - 1 ? "" : lessons[index + 1].title + " →");
  next.href = index === lessons.length - 1 ? "#/" : "#/lesson/" + lessons[index + 1].id;
  pager.append(previous, next);
  page.append(pager);

  return page;
}

/* ---------------------------------------------------------- exercise widget */

function renderExercise(exercise, position, count) {
  const card = el("article", "exercise");
  card.id = "ex-" + exercise.id;
  card.dataset.complete = String(progress.isComplete(exercise.id));

  const head = el("div", "exercise__head");
  head.append(el("span", "exercise__badge", "Exercise " + position + " of " + count));
  head.append(el("h3", "exercise__title", exercise.title));
  const doneBadge = el("span", "exercise__done", "Solved");
  doneBadge.hidden = !progress.isComplete(exercise.id);
  head.append(doneBadge);
  card.append(head);

  const body = el("div", "exercise__body");
  body.append(setLessonHtml(el("div", "prose exercise__prompt"), exercise.prompt));

  /* --- editor --- */
  const editor = el("div", "editor");
  const gutter = el("div", "editor__gutter");
  const area = document.createElement("textarea");
  area.className = "editor__area";
  area.spellcheck = false;
  area.autocapitalize = "off";
  area.setAttribute("autocorrect", "off");
  area.setAttribute("aria-label", "Code editor for " + exercise.title);
  area.value = progress.getDraft(exercise.id) ?? exercise.starter;

  function syncGutter() {
    const lineCount = area.value.split("\n").length;
    const wanted = Math.max(lineCount, 5);
    const numbers = [];
    for (let line = 1; line <= wanted; line++) numbers.push(line);
    gutter.textContent = numbers.join("\n");
    gutter.style.whiteSpace = "pre";
    area.style.height = "auto";
    area.style.height = Math.max(area.scrollHeight, 130) + "px";
  }

  // Tab should indent, not escape the editor; Enter should keep the current indent.
  area.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      check();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const start = area.selectionStart;
      const end = area.selectionEnd;
      area.value = area.value.slice(0, start) + "  " + area.value.slice(end);
      area.selectionStart = area.selectionEnd = start + 2;
      syncGutter();
    } else if (event.key === "Enter") {
      const start = area.selectionStart;
      const lineStart = area.value.lastIndexOf("\n", start - 1) + 1;
      const indentMatch = area.value.slice(lineStart, start).match(/^[ \t]*/);
      const indent = indentMatch ? indentMatch[0] : "";
      const openingBrace = area.value.slice(lineStart, start).trimEnd().endsWith("{");
      const extra = openingBrace ? "  " : "";
      if (indent || extra) {
        event.preventDefault();
        const insertion = "\n" + indent + extra;
        area.value = area.value.slice(0, start) + insertion + area.value.slice(area.selectionEnd);
        area.selectionStart = area.selectionEnd = start + insertion.length;
        syncGutter();
      }
    }
  });

  area.addEventListener("input", () => {
    syncGutter();
    progress.saveDraft(exercise.id, area.value);
  });

  area.addEventListener("scroll", () => {
    gutter.scrollTop = area.scrollTop;
  });

  editor.append(gutter, area);
  body.append(editor);

  /* --- controls --- */
  const controls = el("div", "controls");
  const runButton = el("button", "primary", "Run checks");
  const hintButton = el("button", null, "Hint");
  const resetButton = el("button", "ghost", "Reset");
  const solutionButton = el("button", "ghost", "Show solution");
  solutionButton.hidden = true;

  controls.append(runButton, hintButton, resetButton, solutionButton);
  controls.append(el("span", "controls__spacer"));
  const kbd = el("span", "kbd-hint");
  setLessonHtml(kbd, "<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run");
  controls.append(kbd);
  body.append(controls);

  const hints = el("div", "hints");
  body.append(hints);

  const results = el("div", "results");
  results.setAttribute("aria-live", "polite");
  body.append(results);

  /* --- behaviour --- */
  let hintsShown = 0;
  let attempts = 0;

  hintButton.addEventListener("click", () => {
    if (hintsShown >= exercise.hints.length) return;
    const hint = el("div", "hint");
    hint.append(el("strong", "hint__label", "Hint " + (hintsShown + 1) + " of " + exercise.hints.length));
    hint.append(document.createTextNode(exercise.hints[hintsShown]));
    hints.append(hint);
    hintsShown += 1;
    if (hintsShown >= exercise.hints.length) {
      hintButton.disabled = true;
      hintButton.textContent = "No more hints";
      solutionButton.hidden = false;
    } else {
      hintButton.textContent = "Another hint";
    }
  });

  resetButton.addEventListener("click", () => {
    area.value = exercise.starter;
    progress.clearDraft(exercise.id);
    results.textContent = "";
    syncGutter();
    area.focus();
  });

  solutionButton.addEventListener("click", () => {
    if (!confirm("Show the worked solution? Try running your own attempt first — a failing run teaches more than a correct answer you read.")) return;
    area.value = exercise.solution;
    progress.saveDraft(exercise.id, area.value);
    syncGutter();
    results.textContent = "";
    const note = el("div", "notice", "This is one worked solution — there are usually several good ones. Read it, then press Run checks to see it pass.");
    results.append(note);
  });

  function check() {
    runButton.disabled = true;
    runButton.textContent = "Running…";
    results.textContent = "";

    run(area.value, exercise.tests).then((outcome) => {
      runButton.disabled = false;
      runButton.textContent = "Run checks";
      attempts += 1;
      if (attempts >= 2 && exercise.hints.length > 0) solutionButton.hidden = false;
      showOutcome(outcome);
    });
  }

  function showOutcome(outcome) {
    results.textContent = "";

    // The code never finished: syntax error, thrown error, or a timeout.
    if (!outcome.ok) {
      const banner = el("div", "banner banner--fail");
      banner.append(
        document.createTextNode(
          outcome.timedOut ? "Your code did not finish." : "Your code could not run."
        )
      );
      banner.append(el("span", "banner__detail", outcome.error.name + ": " + outcome.error.message));
      results.append(banner);

      if (!outcome.timedOut) {
        results.append(
          el(
            "div",
            "notice",
            "Errors like this stop the program before anything runs. Check for a missing bracket, brace or quotation mark, and look at the line above the one you suspect."
          )
        );
      }
      return;
    }

    const passed = outcome.results.filter((result) => result.passed).length;
    const total = outcome.results.length;
    const allPassed = passed === total && total > 0;

    const banner = el("div", "banner " + (allPassed ? "banner--pass" : "banner--fail"));
    banner.textContent = allPassed
      ? "All " + total + " checks passed. Nicely done."
      : passed + " of " + total + " checks passed.";
    results.append(banner);

    const list = el("ul", "checks");
    for (const result of outcome.results) {
      const item = el("li");
      item.dataset.passed = String(result.passed);
      item.append(el("span", "checks__mark", result.passed ? "✓" : "✗"));
      const detail = el("span");
      detail.append(el("span", "checks__name", result.name));
      if (!result.passed) detail.append(el("span", "checks__why", result.message));
      item.append(detail);
      list.append(item);
    }
    results.append(list);

    // Anything the learner printed, shown whether or not the checks passed —
    // console.log is the main debugging tool at this stage.
    const outputBox = el("div", "output");
    outputBox.append(el("div", "output__label", "Output"));
    if (outcome.output.length === 0) {
      outputBox.append(el("pre", "output__lines output__empty", "Nothing was printed."));
    } else {
      outputBox.append(el("pre", "output__lines", outcome.output.join("\n")));
    }
    results.append(outputBox);

    if (allPassed) {
      const wasComplete = progress.isComplete(exercise.id);
      progress.markComplete(exercise.id);
      card.dataset.complete = "true";
      doneBadge.hidden = false;
      if (!wasComplete) {
        renderProgress();
        renderNav(currentLessonId());
      }
    }
  }

  runButton.addEventListener("click", check);

  // The textarea is sized from its content, which needs the element to be in the
  // document first — so measure once the browser has laid it out.
  requestAnimationFrame(syncGutter);

  card.append(body);
  return card;
}

/* ------------------------------------------------------------------- router */

function currentLessonId() {
  const match = location.hash.match(/^#\/lesson\/([\w-]+)/);
  return match ? match[1] : null;
}

function render() {
  const lessonId = currentLessonId();
  const lesson = lessonId ? findLesson(lessonId) : null;

  view.textContent = "";
  if (lessonId && !lesson) {
    location.replace("#/");
    return;
  }

  view.append(lesson ? renderLesson(lesson) : renderHome());
  renderNav(lesson ? lesson.id : null);
  renderProgress();
  document.title = lesson ? lesson.title + " · Coding 101" : "Coding 101";

  // A fresh view starts at the top, except when linking straight to an exercise.
  const exerciseTarget = location.hash.split("#")[2];
  if (exerciseTarget) {
    const node = document.getElementById(exerciseTarget);
    if (node) node.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

window.addEventListener("hashchange", render);

if (!location.hash) location.replace("#/");
render();
