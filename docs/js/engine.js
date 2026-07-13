/**
 * Scenario engine: pure functions only (C22).
 * No DOM access, no fetch, no globals; imports nothing outside docs/js/.
 * No stat value is ever defaulted, estimated, or imputed: null stays null
 * and null-field models are excluded from any computation that needs the
 * field (C19, C21).
 */

/**
 * Nullable constraints applied during qualification (C22, C24).
 *
 * @typedef {Object} ScenarioConstraints
 * @property {boolean|null} openWeightsOnly requires openWeights === true
 * @property {number|null} minContextTokens requires non-null contextWindow >= min
 * @property {string|null} releasedOnOrAfter ISO date; requires non-null releaseDate in range
 * @property {string|null} releasedOnOrBefore ISO date; requires non-null releaseDate in range
 */

/**
 * Scenario input shape, exact per C22.
 *
 * @typedef {Object} ScenarioInput
 * @property {number} budgetUsdPerMonth USD per month
 * @property {"coding"|"reasoning"|"longdoc"} task
 * @property {number} inputMTokPerMonth millions of input tokens per month
 * @property {number} outputMTokPerMonth millions of output tokens per month
 * @property {ScenarioConstraints} constraints
 */

/**
 * Computed cost with shown math (C26).
 *
 * @typedef {Object} ScenarioCost
 * @property {number} inputCost
 * @property {number} outputCost
 * @property {number} totalCost
 * @property {string} formula
 */

/**
 * Machine-readable exclusion reasons (C27), in qualification-check order.
 * A non-qualifying model carries the first failing reason in this order.
 */
export const EXCLUSION_REASONS = Object.freeze([
  "missing_price",
  "over_budget",
  "constraint_open_weights",
  "constraint_context",
  "constraint_date",
  "missing_ranking_field",
]);

/**
 * Ranking field per task (C25). All rank descending.
 */
export const TASKS = Object.freeze(["coding", "reasoning", "longdoc"]);

function fmt(value) {
  return value.toFixed(2);
}

/**
 * Cost per C23: cost = inputMTokPerMonth * pricing.inputPerMTok +
 * outputMTokPerMonth * pricing.outputPerMTok (USD/month).
 * Computable only when both prices are non-null; returns null otherwise.
 *
 * @param {{ pricing: { inputPerMTok: number|null, outputPerMTok: number|null } }} model
 * @param {ScenarioInput} input
 * @returns {ScenarioCost|null}
 */
export function computeCost(model, input) {
  const inPrice = model.pricing.inputPerMTok;
  const outPrice = model.pricing.outputPerMTok;
  if (inPrice === null || outPrice === null) return null;
  const inputCost = input.inputMTokPerMonth * inPrice;
  const outputCost = input.outputMTokPerMonth * outPrice;
  const totalCost = inputCost + outputCost;
  const formula =
    `${fmt(input.inputMTokPerMonth)} Mtok x $${fmt(inPrice)}` +
    ` + ${fmt(input.outputMTokPerMonth)} Mtok x $${fmt(outPrice)}` +
    ` = $${fmt(totalCost)}/mo`;
  return { inputCost, outputCost, totalCost, formula };
}

/**
 * The value a task ranks by (C25): coding -> benchmarks.swebenchVerified,
 * reasoning -> benchmarks.gpqaDiamond, longdoc -> contextWindow.
 * Null when the model lacks the field; never substituted (C21).
 *
 * @param {Object} model
 * @param {"coding"|"reasoning"|"longdoc"} task
 * @returns {number|null}
 */
export function rankingValue(model, task) {
  if (task === "coding") return model.benchmarks.swebenchVerified;
  if (task === "reasoning") return model.benchmarks.gpqaDiamond;
  if (task === "longdoc") return model.contextWindow;
  throw new Error(`unknown task: ${task}`);
}

/**
 * Qualification per C24. Returns null when the model qualifies, or the
 * first failing C27 reason (in EXCLUSION_REASONS order) when it does not.
 *
 * @param {Object} model
 * @param {ScenarioInput} input
 * @returns {string|null}
 */
export function exclusionReason(model, input) {
  const cost = computeCost(model, input);
  if (cost === null) return "missing_price";
  if (cost.totalCost > input.budgetUsdPerMonth) return "over_budget";

  const c = input.constraints;
  if (c.openWeightsOnly === true && model.openWeights !== true) {
    return "constraint_open_weights";
  }
  if (c.minContextTokens !== null) {
    if (model.contextWindow === null || model.contextWindow < c.minContextTokens) {
      return "constraint_context";
    }
  }
  if (c.releasedOnOrAfter !== null || c.releasedOnOrBefore !== null) {
    if (model.releaseDate === null) return "constraint_date";
    if (c.releasedOnOrAfter !== null && model.releaseDate < c.releasedOnOrAfter) {
      return "constraint_date";
    }
    if (c.releasedOnOrBefore !== null && model.releaseDate > c.releasedOnOrBefore) {
      return "constraint_date";
    }
  }
  if (rankingValue(model, input.task) === null) return "missing_ranking_field";
  return null;
}

/**
 * Total, deterministic order per C25: ranking field descending, then lower
 * computed cost, then newer releaseDate (a null date orders after any
 * date), then id ascending.
 */
function compareResults(a, b) {
  if (a.rankingValue !== b.rankingValue) return b.rankingValue - a.rankingValue;
  if (a.cost.totalCost !== b.cost.totalCost) return a.cost.totalCost - b.cost.totalCost;
  const da = a.model.releaseDate;
  const db = b.model.releaseDate;
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da > db ? -1 : 1;
  }
  if (a.model.id !== b.model.id) return a.model.id < b.model.id ? -1 : 1;
  return 0;
}

/**
 * Runs a scenario over a model list. Pure: mutates neither argument.
 *
 * @param {Object[]} models
 * @param {ScenarioInput} input
 * @returns {{
 *   qualified: Array<{ rank: number, model: Object, rankingValue: number,
 *                      cost: ScenarioCost }>,
 *   excluded: Array<{ model: Object, reason: string }>
 * }}
 */
export function evaluateScenario(models, input) {
  const qualified = [];
  const excluded = [];
  for (const model of models) {
    const reason = exclusionReason(model, input);
    if (reason !== null) {
      excluded.push({ model, reason });
      continue;
    }
    qualified.push({
      model,
      rankingValue: rankingValue(model, input.task),
      cost: computeCost(model, input),
    });
  }
  qualified.sort(compareResults);
  return {
    qualified: qualified.map((entry, index) => ({ rank: index + 1, ...entry })),
    excluded,
  };
}
