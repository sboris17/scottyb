/**
 * The editable grid.
 *
 * Deliberately a real <table>: it gets column alignment, row heights and screen
 * reader semantics for free, and an exercise-sized sheet is nowhere near big
 * enough to need virtual scrolling.
 *
 * Three kinds of cell:
 *   supplied   the lesson's data — locked, so it cannot be broken by accident
 *   entry      what the learner fills in, outlined
 *   filled     written automatically by a fill range, or covered by a spill;
 *              read-only, but clicking one shows the formula it actually became,
 *              which is how lesson 3 makes the dollar sign concrete
 */

import { Sheet, formatA1, parseA1 } from "./sheet.js";
import { indexToColumn } from "./parser.js";
import { expandEntries, filledCells } from "./fill.js";
import { isError } from "./values.js";

const DEFAULT_WIDTH = 92;

export class Grid {
  constructor(container, exercise, entries, onChange) {
    this.container = container;
    this.exercise = exercise;
    this.entries = { ...entries };
    this.onChange = onChange || (() => {});
    this.selected = exercise.entryCells && exercise.entryCells.length
      ? parseA1(exercise.entryCells[0])
      : { col: 0, row: 0 };
    this.editing = null;
    this.filled = filledCells(exercise);
    this.entrySet = new Set(exercise.entryCells || []);
    this.rebuild();
    this.render();
  }

  /** Re-applies the entries (fills included) and recalculates. */
  rebuild() {
    this.sheet = new Sheet({
      cells: { ...this.exercise.data },
      formats: this.exercise.formats || {},
      locked: this.exercise.locked || Object.keys(this.exercise.data || {}),
      rows: this.exercise.rows || 14,
      columns: this.exercise.columns || 7,
    });
    for (const [reference, value] of Object.entries(expandEntries(this.exercise, this.entries))) {
      this.sheet.setInput(reference, value, { silent: true });
    }
    this.sheet.invalidate();
  }

  isEditable(reference) {
    return this.entrySet.has(reference);
  }

  /** True when this cell is showing part of another cell's spilled result. */
  isSpilled(col, row) {
    return this.sheet.spillOwners.has(col + "," + row);
  }

  render() {
    const previousScroll = this.container.scrollLeft;
    this.container.textContent = "";

    const table = document.createElement("table");
    table.className = "grid";

    const widths = this.exercise.columnWidths || {};

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "grid__corner";
    headRow.append(corner);
    for (let col = 0; col < this.sheet.columnCount; col++) {
      const th = document.createElement("th");
      th.className = "grid__colhead";
      th.textContent = indexToColumn(col);
      th.style.width = (widths[indexToColumn(col)] || DEFAULT_WIDTH) + "px";
      if (col === this.selected.col) th.dataset.active = "true";
      headRow.append(th);
    }
    head.append(headRow);
    table.append(head);

    const body = document.createElement("tbody");
    for (let row = 0; row < this.sheet.rowCount; row++) {
      const tr = document.createElement("tr");
      const rowHead = document.createElement("th");
      rowHead.className = "grid__rowhead";
      rowHead.textContent = String(row + 1);
      if (row === this.selected.row) rowHead.dataset.active = "true";
      tr.append(rowHead);

      for (let col = 0; col < this.sheet.columnCount; col++) {
        tr.append(this.renderCell(col, row));
      }
      body.append(tr);
    }
    table.append(body);
    this.container.append(table);
    this.container.scrollLeft = previousScroll;

    if (this.editing) this.mountEditor();
  }

  renderCell(col, row) {
    const reference = formatA1(col, row);
    const td = document.createElement("td");
    td.className = "grid__cell";
    td.dataset.ref = reference;

    const value = this.sheet.getCellValue(col, row);
    const editable = this.isEditable(reference);

    if (editable) td.dataset.entry = "true";
    else if (this.filled.has(reference) && this.sheet.getInput(reference)) td.dataset.filled = "true";
    else if (this.isSpilled(col, row)) td.dataset.spilled = "true";
    else if (this.sheet.isLocked(reference)) td.dataset.locked = "true";

    if (this.selected.col === col && this.selected.row === row) td.dataset.selected = "true";

    if (isError(value)) {
      td.dataset.align = "left";
      td.dataset.error = "true";
      td.textContent = value.type;
      td.title = value.detail || "";
    } else {
      td.dataset.align = typeof value === "number" ? "right" : typeof value === "boolean" ? "center" : "left";
      td.textContent = this.sheet.display(col, row);
    }

    td.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.commitEdit();
      this.selected = { col, row };
      this.render();
      this.focusSurface();
      this.onChange(this.entries, { selection: true });
    });

    td.addEventListener("dblclick", () => {
      if (!editable) return;
      this.selected = { col, row };
      this.beginEdit();
    });

    return td;
  }

  focusSurface() {
    if (this.surface) this.surface.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------- editing */

  beginEdit(initialText) {
    const reference = formatA1(this.selected.col, this.selected.row);
    if (!this.isEditable(reference)) return;
    this.editing = {
      ref: reference,
      text: initialText === undefined ? this.sheet.getInput(reference) : initialText,
      fresh: initialText !== undefined,
    };
    this.render();
    this.onChange(this.entries, { editing: true });
  }

  mountEditor() {
    const td = this.container.querySelector(`[data-ref="${this.editing.ref}"]`);
    if (!td) return;
    td.textContent = "";
    td.dataset.editing = "true";

    const input = document.createElement("input");
    input.className = "grid__editor";
    input.value = this.editing.text;
    input.spellcheck = false;
    input.setAttribute("aria-label", "Edit " + this.editing.ref);
    td.append(input);

    input.addEventListener("input", () => {
      this.editing.text = input.value;
      this.onChange(this.entries, { editing: true, draft: input.value });
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.commitEdit();
        this.move(0, 1);
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.commitEdit();
        this.move(event.shiftKey ? -1 : 1, 0);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.editing = null;
        this.render();
        this.focusSurface();
        this.onChange(this.entries, {});
      }
      event.stopPropagation();
    });

    input.focus();
    if (this.editing.fresh) input.setSelectionRange(input.value.length, input.value.length);
    else input.select();
  }

  commitEdit() {
    if (!this.editing) return;
    const { ref, text } = this.editing;
    this.editing = null;
    const trimmed = text.trim();
    if (trimmed === "") delete this.entries[ref];
    else this.entries[ref] = trimmed;
    this.rebuild();
    this.render();
    this.onChange(this.entries, { committed: ref });
  }

  move(deltaCol, deltaRow) {
    const col = Math.max(0, Math.min(this.sheet.columnCount - 1, this.selected.col + deltaCol));
    const row = Math.max(0, Math.min(this.sheet.rowCount - 1, this.selected.row + deltaRow));
    this.selected = { col, row };
    this.render();
    this.focusSurface();
    this.onChange(this.entries, { selection: true });
  }

  /** What the formula bar should show for the selected cell. */
  selectedInput() {
    const reference = formatA1(this.selected.col, this.selected.row);
    if (this.editing && this.editing.ref === reference) return this.editing.text;
    return this.sheet.getInput(reference);
  }

  selectedRef() {
    return formatA1(this.selected.col, this.selected.row);
  }

  selectedIsEditable() {
    return this.isEditable(this.selectedRef());
  }

  /** Describes the selected cell for the strip under the formula bar. */
  selectedNote() {
    const reference = this.selectedRef();
    if (this.isEditable(reference)) return null;
    if (this.filled.has(reference) && this.sheet.getInput(reference)) {
      return "Filled automatically from the top of the column — this is what your formula became here.";
    }
    if (this.isSpilled(this.selected.col, this.selected.row)) {
      const owner = this.sheet.spillOwners.get(this.selected.col + "," + this.selected.row);
      const [col, row] = owner.split(",").map(Number);
      return `Part of the result spilled from ${formatA1(col, row)}.`;
    }
    if (this.sheet.getInput(reference)) return "Supplied data — locked so you cannot change it by accident.";
    return null;
  }

  /** Wires up keyboard handling on the element that holds keyboard focus. */
  attachKeyboard(surface) {
    this.surface = surface;
    surface.addEventListener("keydown", (event) => {
      if (this.editing) return;

      switch (event.key) {
        case "ArrowUp": event.preventDefault(); return this.move(0, -1);
        case "ArrowDown": event.preventDefault(); return this.move(0, 1);
        case "ArrowLeft": event.preventDefault(); return this.move(-1, 0);
        case "ArrowRight": event.preventDefault(); return this.move(1, 0);
        case "Tab": event.preventDefault(); return this.move(event.shiftKey ? -1 : 1, 0);
        case "Enter": case "F2":
          event.preventDefault();
          return this.beginEdit();
        case "Delete": case "Backspace": {
          event.preventDefault();
          const reference = this.selectedRef();
          if (!this.isEditable(reference)) return;
          delete this.entries[reference];
          this.rebuild();
          this.render();
          this.onChange(this.entries, { committed: reference });
          return;
        }
        default:
          break;
      }

      // Typing a printable character starts an edit, replacing what was there.
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.beginEdit(event.key);
      }
    });
  }

  /** Puts the exercise back to its starting state. */
  reset(entries) {
    this.entries = { ...entries };
    this.editing = null;
    this.rebuild();
    this.render();
    this.onChange(this.entries, { reset: true });
  }

  setEntry(reference, value) {
    if (value === "" || value === null || value === undefined) delete this.entries[reference];
    else this.entries[reference] = value;
    this.rebuild();
    this.render();
    this.onChange(this.entries, { committed: reference });
  }
}
