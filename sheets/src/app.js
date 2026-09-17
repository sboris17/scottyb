/**
 * The Sheets course UI.
 *
 * Same shape as the coding course next door: a tiny hash router, a home page and
 * a lesson page, with the interesting behaviour in the exercise widget. Here the
 * widget wraps a live spreadsheet rather than a code editor.
 */

import { lessons, findLesson, totalExercises } from "../curriculum/index.js";
import { Grid } from "./grid.js";
import { runChecks } from "./checker.js";
import * as progress from "./progress.js";

const view = document.getElementById("view");
const nav = document.getElementById("lesson-nav");
const meterFill = document.getElementById("progress-fill");
const progressCount = document.getElementById("progress-count");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Lesson prose is authored content that ships with the course, not learner input. */
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
  header.append(el("p", "eyebrow", "Google Sheets 101"));
  header.append(el("h1", null, "Get properly good at Google Sheets"));
  header.append(
    el("p", "lede",
      "Ten lessons and " + totalExercises +
      " exercises worked in a live spreadsheet. Type real formulas, press Check, and find out at once whether they hold up.")
  );
  page.append(header);

  const intro = el("div", "prose");
  setLessonHtml(
    intro,
    `<p>This is a certification-style course: it starts at "what is a cell" and finishes
     at <code>QUERY</code>, <code>ARRAYFORMULA</code> and a working dashboard. It assumes
     nothing, and it does not skip the parts that actually catch people out — VLOOKUP's
     approximate-match default, the difference between COUNT and COUNTA, and why your
     filled formula turns to zeros halfway down the column.</p>
     <p>The grid in each exercise is a real spreadsheet: a formula engine with around a
     hundred functions, recalculation, spilling arrays and the same error values you get
     in Sheets. Nothing is simulated with pre-baked answers.</p>
     <p><strong>Every check is run twice.</strong> Once on your sheet, and once after
     quietly changing the inputs behind it — so a formula passes and a typed-in answer
     does not. That is the single habit that separates a spreadsheet from a calculator,
     and this course refuses to let you skip it.</p>`
  );
  page.append(intro);

  if (!progress.storageAvailable()) {
    page.append(el("p", "notice",
      "This browser is blocking local storage, so progress will not be remembered between visits. Everything else works normally."));
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

  const controls = el("div", "controls");
  const begin = el("button", "primary", totalCompleted() > 0 ? "Continue where you left off" : "Start lesson 1");
  begin.addEventListener("click", () => {
    const next = lessons.find((lesson) => completedInLesson(lesson) < lesson.exercises.length) || lessons[0];
    location.hash = "#/lesson/" + next.id;
  });
  controls.append(begin);

  if (totalCompleted() > 0) {
    const reset = el("button", "ghost", "Start over");
    reset.addEventListener("click", () => {
      if (confirm("Clear all progress and saved work? This cannot be undone.")) {
        progress.resetAll();
        render();
      }
    });
    controls.append(reset);
  }
  page.append(controls);
  return page;
}

/* -------------------------------------------------------------- lesson view */

function renderLesson(lesson) {
  const index = lessons.indexOf(lesson);
  const page = el("div");

  const header = el("header", "lesson-header");
  header.append(el("p", "eyebrow",
    "Lesson " + lessonNumber(lesson) + " of " + lessons.length + " · about " + lesson.minutes + " min"));
  header.append(el("h1", null, lesson.title));
  header.append(el("p", "lede", lesson.summary));
  page.append(header);

  for (const section of lesson.sections) {
    const block = el("section", "section");
    block.append(el("h2", null, section.heading));
    block.append(setLessonHtml(el("div", "prose"), section.body));
    page.append(block);
  }

  page.append(el("h2", null, lesson.exercises.length === 1 ? "Exercise" : "Exercises"));
  lesson.exercises.forEach((exercise, position) => {
    page.append(renderExercise(exercise, position + 1, lesson.exercises.length));
  });

  const pager = el("nav", "pager");
  const previous = el("a", index === 0 ? "is-hidden" : "", index === 0 ? "" : "← " + lessons[index - 1].title);
  previous.href = index === 0 ? "#/" : "#/lesson/" + lessons[index - 1].id;
  const next = el("a", index === lessons.length - 1 ? "is-hidden" : "",
    index === lessons.length - 1 ? "" : lessons[index + 1].title + " →");
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

  /* --- formula bar --- */
  const bar = el("div", "formulabar");
  const refBox = el("span", "formulabar__ref", "A1");
  const fx = el("span", "formulabar__fx", "fx");
  const input = document.createElement("input");
  input.className = "formulabar__input";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Formula bar");
  bar.append(refBox, fx, input);
  body.append(bar);

  const note = el("div", "cellnote");
  body.append(note);

  /* --- the sheet --- */
  const surface = el("div", "gridwrap");
  surface.tabIndex = 0;
  surface.setAttribute("role", "application");
  surface.setAttribute("aria-label", "Spreadsheet for " + exercise.title);
  body.append(surface);

  // A key to the cell colours — without it the tinted cells are just decoration.
  const key = el("div", "gridkey");
  const legend = [
    ["entry", "you fill this in"],
    ["locked", "supplied data, locked"],
    ["filled", (exercise.fills && exercise.fills.length) ? "filled down automatically" : "spilled from a formula"],
  ];
  for (const [kind, label] of legend) {
    const item = el("span", "gridkey__item");
    const swatch = el("span", "gridkey__swatch");
    swatch.dataset.kind = kind;
    item.append(swatch, document.createTextNode(label));
    key.append(item);
  }
  body.append(key);

  const startingEntries = progress.getWork(exercise.id) || { ...(exercise.starter || {}) };

  const grid = new Grid(surface, exercise, startingEntries, (entries, event) => {
    // Moving the cursor changes nothing worth saving; edits and commits do.
    if (!event || (!event.editing && !event.selection)) {
      progress.saveWork(exercise.id, entries);
    }
    syncBar();
  });
  grid.attachKeyboard(surface);

  function syncBar() {
    refBox.textContent = grid.selectedRef();
    if (document.activeElement !== input) input.value = grid.selectedInput();
    const editable = grid.selectedIsEditable();
    input.readOnly = !editable;
    input.placeholder = editable ? "Type a value or a formula starting with =" : "";
    bar.dataset.readonly = String(!editable);
    const description = grid.selectedNote();
    note.textContent = description || "";
    note.hidden = !description;
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      grid.setEntry(grid.selectedRef(), input.value.trim());
      grid.move(0, 1);
      syncBar();
    } else if (event.key === "Escape") {
      event.preventDefault();
      syncBar();
      surface.focus();
    }
  });
  input.addEventListener("blur", syncBar);

  syncBar();

  /* --- controls --- */
  const controls = el("div", "controls");
  const checkButton = el("button", "primary", "Check my sheet");
  const hintButton = el("button", null, "Hint");
  const resetButton = el("button", "ghost", "Reset");
  const solutionButton = el("button", "ghost", "Show solution");
  solutionButton.hidden = true;
  controls.append(checkButton, hintButton, resetButton, solutionButton);
  body.append(controls);

  const hints = el("div", "hints");
  body.append(hints);

  const results = el("div", "results");
  results.setAttribute("aria-live", "polite");
  body.append(results);

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
    progress.clearWork(exercise.id);
    grid.reset({ ...(exercise.starter || {}) });
    results.textContent = "";
    syncBar();
  });

  solutionButton.addEventListener("click", () => {
    if (!confirm("Show the worked solution? A failed check teaches more than a correct answer you read.")) return;
    grid.reset({ ...(exercise.starter || {}), ...exercise.solution });
    results.textContent = "";
    results.append(el("div", "notice",
      "This is one worked solution — there is usually more than one good answer. Read it, then press Check my sheet."));
    syncBar();
  });

  checkButton.addEventListener("click", () => {
    grid.commitEdit();
    attempts += 1;
    if (attempts >= 2 && exercise.hints.length > 0) solutionButton.hidden = false;

    const outcome = runChecks(grid.sheet, exercise.checks);
    results.textContent = "";

    const passed = outcome.filter((result) => result.passed).length;
    const total = outcome.length;
    const allPassed = passed === total;

    const banner = el("div", "banner " + (allPassed ? "banner--pass" : "banner--fail"));
    banner.textContent = allPassed
      ? "All " + total + " checks passed. Nicely done."
      : passed + " of " + total + " checks passed.";
    results.append(banner);

    const list = el("ul", "checks");
    for (const result of outcome) {
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
  });

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
  document.title = lesson ? lesson.title + " · Google Sheets 101" : "Google Sheets 101";

  const target = location.hash.split("#")[2];
  if (target) {
    const node = document.getElementById(target);
    if (node) node.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

window.addEventListener("hashchange", render);
if (!location.hash) location.replace("#/");
render();
