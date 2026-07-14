// Daily share string builder and copy helper (C68, C69).
// Pure module: no storage access, no fetch, no imports outside docs/js/.
// Consumed by the daily results screen (W8.S2).

export const LAUNCH_DATE = "2026-07-15";

const MS_PER_DAY = 86400000;
const SQUARE_CORRECT = "\u{1F7E9}"; // green square
const SQUARE_WRONG = "\u{1F7E5}"; // red square

// Milliseconds at UTC midnight for a "YYYY-MM-DD" string.
function utcMs(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Day number for a UTC date string per C68: launch day is #1.
 * `N = floor((Date.UTC(today) - Date.UTC(LAUNCH)) / 86400000) + 1`
 */
export function dayNumber(dateString) {
  return Math.floor((utcMs(dateString) - utcMs(LAUNCH_DATE)) / MS_PER_DAY) + 1;
}

/**
 * Build the exact C68 share string for a completed daily record.
 *
 * `record.correct` is the per-question correctness array in question order
 * (schema 12.6); `dateString` is the record's UTC date "YYYY-MM-DD".
 * Returns `Frontier #${N} ${X}/${M}` + "\n" + M squares, where each square
 * is U+1F7E9 when correct and U+1F7E5 when wrong.
 */
export function buildShareString(record, dateString) {
  const marks = record.correct;
  const total = marks.length;
  const correctCount = marks.filter(Boolean).length;
  const squares = marks
    .map((isCorrect) => (isCorrect ? SQUARE_CORRECT : SQUARE_WRONG))
    .join("");
  return `Frontier #${dayNumber(dateString)} ${correctCount}/${total}\n${squares}`;
}

/**
 * Copy `text` to the clipboard per C69 and report the copied state.
 *
 * Uses `navigator.clipboard.writeText` when available; otherwise selects
 * the string in a readonly textarea and attempts
 * `document.execCommand("copy")`. Resolves `true` when the text was copied
 * (the button's copied state), `false` otherwise. Never rejects.
 *
 * `env` is injectable for tests; it defaults to the real globals.
 */
export async function copyShareString(text, env = {}) {
  const nav = env.navigator ?? globalThis.navigator;
  const doc = env.document ?? globalThis.document;

  if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  if (!doc || typeof doc.execCommand !== "function") return false;
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  doc.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = doc.execCommand("copy") === true;
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}
