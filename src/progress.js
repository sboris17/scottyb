/**
 * Progress and saved work, kept in localStorage.
 *
 * Two separate things are stored: which exercises are complete, and the code the
 * learner last had in each editor. The second matters more than it sounds — losing
 * half-written work to an accidental refresh is exactly the kind of thing that makes
 * someone give up on a course.
 *
 * Every access is wrapped: private browsing, blocked site data and `file://` in some
 * browsers all make localStorage throw rather than simply return nothing. The course
 * has to keep working without it, just without remembering anything.
 */

const COMPLETED_KEY = "coding101.completed.v1";
const DRAFTS_KEY = "coding101.drafts.v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function completedIds() {
  const stored = read(COMPLETED_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export function isComplete(exerciseId) {
  return completedIds().includes(exerciseId);
}

export function markComplete(exerciseId) {
  const ids = completedIds();
  if (!ids.includes(exerciseId)) {
    ids.push(exerciseId);
    write(COMPLETED_KEY, ids);
  }
}

export function getDraft(exerciseId) {
  const drafts = read(DRAFTS_KEY, {});
  return Object.prototype.hasOwnProperty.call(drafts, exerciseId) ? drafts[exerciseId] : null;
}

export function saveDraft(exerciseId, code) {
  const drafts = read(DRAFTS_KEY, {});
  drafts[exerciseId] = code;
  write(DRAFTS_KEY, drafts);
}

export function clearDraft(exerciseId) {
  const drafts = read(DRAFTS_KEY, {});
  delete drafts[exerciseId];
  write(DRAFTS_KEY, drafts);
}

/** Wipes everything. Used by the "start over" control on the home page. */
export function resetAll() {
  try {
    localStorage.removeItem(COMPLETED_KEY);
    localStorage.removeItem(DRAFTS_KEY);
  } catch (error) {
    /* nothing to clear */
  }
}

/** True when progress can actually be persisted here. */
export function storageAvailable() {
  try {
    const probe = "coding101.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}
