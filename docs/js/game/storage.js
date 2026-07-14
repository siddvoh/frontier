// Game persistence (C64, C65, C66; schema 12.6).
// The single localStorage access point in docs/js: exactly one key,
// `frontier.game.v1`, holding JSON per schema 12.6. Every read validates
// the stored value against the schema and degrades to the fresh default
// on corrupt JSON, wrong version, missing value, or a missing/throwing
// localStorage; no export ever throws to the caller.

export const STORAGE_KEY = "frontier.game.v1";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(date) {
  return typeof date === "string" && DATE_KEY_RE.test(date);
}

/** The fresh default state per section 12.6. */
export function defaultState() {
  return { version: 1, endless: { best: 0 }, daily: {} };
}

// ---------- defensive localStorage access ----------

function storageArea() {
  try {
    // Accessing localStorage itself can throw (disabled storage).
    const area = globalThis.localStorage;
    return area && typeof area.getItem === "function" ? area : null;
  } catch {
    return null;
  }
}

function readRaw() {
  const area = storageArea();
  if (area === null) return null;
  try {
    return area.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(value) {
  const area = storageArea();
  if (area === null) return false;
  try {
    area.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    // Quota errors and the like are swallowed; play continues in-memory.
    return false;
  }
}

// ---------- schema 12.6 validation ----------

function isPlainObject(value) {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function hasExactKeys(obj, keys) {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

function isValidDailyRecord(record) {
  return (
    isPlainObject(record) &&
    hasExactKeys(record, ["questionIds", "picks", "correct", "completed"]) &&
    Array.isArray(record.questionIds) &&
    record.questionIds.every((id) => typeof id === "string") &&
    Array.isArray(record.picks) &&
    record.picks.every((p) => p === 0 || p === 1) &&
    Array.isArray(record.correct) &&
    record.correct.every((c) => typeof c === "boolean") &&
    typeof record.completed === "boolean"
  );
}

/** True iff `state` matches schema 12.6 (GameStorageV1) exactly. */
export function isValidState(state) {
  return (
    isPlainObject(state) &&
    hasExactKeys(state, ["version", "endless", "daily"]) &&
    state.version === 1 &&
    isPlainObject(state.endless) &&
    hasExactKeys(state.endless, ["best"]) &&
    Number.isInteger(state.endless.best) &&
    state.endless.best >= 0 &&
    isPlainObject(state.daily) &&
    Object.entries(state.daily).every(
      ([date, record]) => DATE_KEY_RE.test(date) && isValidDailyRecord(record)
    )
  );
}

// ---------- state round-trip ----------

/**
 * Read the persisted state. Any failure (missing key, corrupt JSON,
 * wrong version, schema violation, throwing storage) yields the fresh
 * default; never throws.
 */
export function loadState() {
  const raw = readRaw();
  if (typeof raw !== "string") return defaultState();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultState();
  }
  return isValidState(parsed) ? parsed : defaultState();
}

/**
 * Persist `state` if it matches schema 12.6. Returns true when the value
 * was written; false (never a throw) otherwise.
 */
export function saveState(state) {
  if (!isValidState(state)) return false;
  let raw;
  try {
    raw = JSON.stringify(state);
  } catch {
    return false;
  }
  return writeRaw(raw);
}

// ---------- streak helpers (C64) ----------

/** Best endless streak ever reached (persisted across sessions). */
export function getBestStreak() {
  return loadState().endless.best;
}

/**
 * Record a correct endless answer. Returns the incremented running
 * streak; persists it as the new best when it exceeds the stored best.
 */
export function recordCorrect(currentStreak) {
  const streak =
    Number.isInteger(currentStreak) && currentStreak >= 0
      ? currentStreak + 1
      : 1;
  const state = loadState();
  if (streak > state.endless.best) {
    state.endless.best = streak;
    saveState(state);
  }
  return streak;
}

/**
 * Record a wrong endless answer. The running streak resets to 0 and play
 * continues; the persisted best is untouched.
 */
export function recordWrong() {
  return 0;
}

// ---------- daily records (12.6, C67 groundwork) ----------

/**
 * The daily record for a UTC date string ("YYYY-MM-DD"), or null when
 * none is stored. The record has the shape
 * { questionIds: string[], picks: (0|1)[], correct: boolean[],
 *   completed: boolean }.
 */
export function getDailyRecord(date) {
  if (!isDateKey(date)) return null;
  const record = loadState().daily[date];
  return record === undefined ? null : record;
}

/**
 * Write the daily record for a UTC date string. Returns true when
 * persisted; false (never a throw) for an invalid date key, an invalid
 * record shape, or failing storage.
 */
export function saveDailyRecord(date, record) {
  if (!isDateKey(date)) return false;
  if (!isValidDailyRecord(record)) return false;
  const state = loadState();
  state.daily[date] = record;
  return saveState(state);
}
