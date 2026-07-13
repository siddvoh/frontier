// Shared constants and formatters (C20).
// MISSING is the single source of truth for rendering null stat values;
// no renderer may write a literal dash for this purpose (C20), and no
// formatter may substitute a value for null (C19).

export const MISSING = "—";

// Every formatter renders null/undefined as MISSING; this combinator is the
// single place that invariant lives.
function orMissing(format) {
  return (value) =>
    value === null || value === undefined ? MISSING : format(value);
}

/** Render any nullable value as text. */
export const fmtText = orMissing(String);

/** Render a nullable USD amount to two decimals, e.g. "$3.00". */
export const fmtUsd = orMissing((value) => "$" + value.toFixed(2));

/** Render a nullable integer with thousands separators. */
export const fmtInt = orMissing((value) => value.toLocaleString("en-US"));

/** Render a nullable 0-100 benchmark score to one decimal. */
export const fmtScore = orMissing((value) => value.toFixed(1));

/** Render a nullable ISO date string as-is. */
export const fmtDate = orMissing(String);

/** Render a nullable open-weights flag as "open" / "closed". */
export const fmtWeights = orMissing((value) => (value ? "open" : "closed"));
