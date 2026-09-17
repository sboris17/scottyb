/**
 * Progress and saved work for the Sheets course.
 *
 * Same defensive approach as the coding course: every localStorage access is
 * wrapped, because private browsing and blocked site data make it throw rather
 * than simply return nothing. The course must keep working without it.
 *
 * The keys are namespaced separately from the coding course so the two never
 * tread on each other.
 */

const COMPLETED_KEY = "sheets101.completed.v1";
const WORK_KEY = "sheets101.work.v1";

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

/** The cells a learner has filled in for an exercise. */
export function getWork(exerciseId) {
  const all = read(WORK_KEY, {});
  return all && typeof all === "object" && all[exerciseId] ? all[exerciseId] : null;
}

export function saveWork(exerciseId, entries) {
  const all = read(WORK_KEY, {});
  all[exerciseId] = entries;
  write(WORK_KEY, all);
}

export function clearWork(exerciseId) {
  const all = read(WORK_KEY, {});
  delete all[exerciseId];
  write(WORK_KEY, all);
}

export function resetAll() {
  try {
    localStorage.removeItem(COMPLETED_KEY);
    localStorage.removeItem(WORK_KEY);
  } catch (error) {
    /* nothing to clear */
  }
}

export function storageAvailable() {
  try {
    const probe = "sheets101.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}
