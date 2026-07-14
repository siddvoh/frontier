/**
 * Game question generator: pure functions only (SPEC section 17).
 * No DOM, no fetch, no storage, no ambient randomness; the seeded PRNG
 * below is the only source of choice (C58, C19). Imports nothing outside
 * docs/js/; the scenario templates reuse the engine so reveal formulas are
 * the exact C26 strings (C60).
 */

import { computeCost } from "../engine.js";

export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The daily seed per C58: `xmur3(utcDateString)()` where utcDateString is
 * YYYY-MM-DD in UTC.
 *
 * @param {string} utcDateString
 * @returns {number}
 */
export function dailySeed(utcDateString) {
  return xmur3(utcDateString)();
}

/**
 * The eight template ids, exactly per C59, in the fixed enumeration order
 * used for candidate pools.
 */
export const TEMPLATE_IDS = Object.freeze([
  "stat-input-price",
  "stat-output-price",
  "stat-context",
  "stat-gpqa",
  "stat-swebench",
  "stat-released-first",
  "scen-input-heavy",
  "scen-output-heavy",
]);

/** Stat field read per stat template (the six C59 / schema 12.5 fields). */
const STAT_FIELDS = Object.freeze({
  "stat-input-price": "pricing.inputPerMTok",
  "stat-output-price": "pricing.outputPerMTok",
  "stat-context": "contextWindow",
  "stat-gpqa": "benchmarks.gpqaDiamond",
  "stat-swebench": "benchmarks.swebenchVerified",
  "stat-released-first": "releaseDate",
});

const STAT_PROMPTS = Object.freeze({
  "stat-input-price": "Which costs more per input Mtok?",
  "stat-output-price": "Which costs more per output Mtok?",
  "stat-context": "Which is higher on context window?",
  "stat-gpqa": "Which is higher on GPQA Diamond?",
  "stat-swebench": "Which is higher on SWE-bench Verified?",
  "stat-released-first": "Which released first?",
});

/** Monthly volumes (Mtok) per scenario template, exact per C59. */
const SCEN_VOLUMES = Object.freeze({
  "scen-input-heavy": Object.freeze({ inputMTok: 50, outputMTok: 5 }),
  "scen-output-heavy": Object.freeze({ inputMTok: 5, outputMTok: 50 }),
});

const SCEN_PROMPTS = Object.freeze({
  "scen-input-heavy":
    "Input-heavy month (50 Mtok in, 5 Mtok out): which model fits the budget?",
  "scen-output-heavy":
    "Output-heavy month (5 Mtok in, 50 Mtok out): which model fits the budget?",
});

function statValue(model, field) {
  if (field === "pricing.inputPerMTok") return model.pricing.inputPerMTok;
  if (field === "pricing.outputPerMTok") return model.pricing.outputPerMTok;
  if (field === "contextWindow") return model.contextWindow;
  if (field === "benchmarks.gpqaDiamond") return model.benchmarks.gpqaDiamond;
  if (field === "benchmarks.swebenchVerified") {
    return model.benchmarks.swebenchVerified;
  }
  if (field === "releaseDate") return model.releaseDate;
  throw new Error(`unknown field: ${field}`);
}

/** `${templateId}:${idLow}:${idHigh}` with model ids lexicographic (C59). */
function questionId(templateId, modelA, modelB) {
  const [idLow, idHigh] =
    modelA.id < modelB.id ? [modelA.id, modelB.id] : [modelB.id, modelA.id];
  return `${templateId}:${idLow}:${idHigh}`;
}

/**
 * The C22 input a scenario template evaluates; task is always longdoc
 * (C59). The budget is a placeholder: computeCost never reads it, and the
 * question's real budget is derived from the two costs afterwards.
 */
function scenarioInput(templateId) {
  const volumes = SCEN_VOLUMES[templateId];
  return {
    budgetUsdPerMonth: 0,
    task: "longdoc",
    inputMTokPerMonth: volumes.inputMTok,
    outputMTokPerMonth: volumes.outputMTok,
    constraints: {
      openWeightsOnly: null,
      minContextTokens: null,
      releasedOnOrAfter: null,
      releasedOnOrBefore: null,
    },
  };
}

/**
 * Builds one question (C59) with optionA/optionB in the given display
 * order, or returns null when the pair is not valid for the template
 * (null field, equal values, uncomputable or equal costs, null context).
 *
 * @param {string} templateId one of TEMPLATE_IDS
 * @param {Object} modelA displayed as option A
 * @param {Object} modelB displayed as option B
 * @returns {{ id: string, templateId: string, prompt: string,
 *   optionA: string, optionB: string, correctIndex: 0|1,
 *   revealData: Object }|null}
 */
export function makeQuestion(templateId, modelA, modelB) {
  const field = STAT_FIELDS[templateId];
  if (field !== undefined) {
    const valueA = statValue(modelA, field);
    const valueB = statValue(modelB, field);
    if (valueA === null || valueB === null || valueA === valueB) return null;
    const correctIndex =
      templateId === "stat-released-first"
        ? (valueA < valueB ? 0 : 1)
        : (valueA > valueB ? 0 : 1);
    return {
      id: questionId(templateId, modelA, modelB),
      templateId,
      prompt: STAT_PROMPTS[templateId],
      optionA: modelA.id,
      optionB: modelB.id,
      correctIndex,
      revealData: { field, valueA, valueB },
    };
  }
  if (SCEN_VOLUMES[templateId] === undefined) {
    throw new Error(`unknown template: ${templateId}`);
  }
  if (modelA.contextWindow === null || modelB.contextWindow === null) {
    return null;
  }
  const input = scenarioInput(templateId);
  const costA = computeCost(modelA, input);
  const costB = computeCost(modelB, input);
  if (costA === null || costB === null) return null;
  if (costA.totalCost === costB.totalCost) return null;
  // Exact unrounded midpoint: costLow < budget < costHigh, so exactly one
  // model qualifies per C24 (C59).
  const budget = (costA.totalCost + costB.totalCost) / 2;
  return {
    id: questionId(templateId, modelA, modelB),
    templateId,
    prompt: SCEN_PROMPTS[templateId],
    optionA: modelA.id,
    optionB: modelB.id,
    correctIndex: costA.totalCost < costB.totalCost ? 0 : 1,
    revealData: {
      budget,
      inputMTok: input.inputMTokPerMonth,
      outputMTok: input.outputMTokPerMonth,
      costA: costA.totalCost,
      costB: costB.totalCost,
      formulaA: costA.formula,
      formulaB: costB.formula,
    },
  };
}

/**
 * All valid (unordered pair, template) candidates, enumerated in artifact
 * order: models sorted by id, pairs (i < j), templates in TEMPLATE_IDS
 * order (C61). Each candidate is unique by (pair, templateId).
 */
function enumerateCandidates(artifact) {
  const models = [...artifact.models].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const surprises = artifact.surprises ?? [];
  const candidates = [];
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      for (const templateId of TEMPLATE_IDS) {
        if (makeQuestion(templateId, models[i], models[j]) === null) continue;
        candidates.push({
          templateId,
          a: models[i],
          b: models[j],
          surprise: isSurprisePair(surprises, templateId, models[i], models[j]),
        });
      }
    }
  }
  return candidates;
}

/**
 * A surprise-derived question is the stat question whose (pair, field)
 * matches a surprises entry (C62).
 */
function isSurprisePair(surprises, templateId, modelA, modelB) {
  const field = STAT_FIELDS[templateId];
  if (field === undefined) return false;
  return surprises.some(
    (s) =>
      s.field === field &&
      s.modelIds.includes(modelA.id) &&
      s.modelIds.includes(modelB.id),
  );
}

/** Fisher-Yates shuffle driven only by the seeded rng. */
function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Builds the display-ordered question for a candidate; rng flips A/B. */
function orient(candidate, rng) {
  return rng() < 0.5
    ? makeQuestion(candidate.templateId, candidate.b, candidate.a)
    : makeQuestion(candidate.templateId, candidate.a, candidate.b);
}

/**
 * Deterministic daily question list (C61): same seed and artifact yield a
 * deep-equal list. Selection is unique by (unordered pair, templateId);
 * count is min(10, poolSize); the seeded rng is the only source of choice,
 * including A/B display order. When the artifact's surprises yield at
 * least 2 valid questions the list contains at least 2 of them; when
 * fewer, all valid ones (C62).
 *
 * @param {number} seed typically dailySeed(utcDateString)
 * @param {{ models: Object[], surprises: Object[] }} artifact
 * @returns {Object[]} question objects per C59
 */
export function generateDaily(seed, artifact) {
  const rng = mulberry32(seed);
  const candidates = enumerateCandidates(artifact);
  const count = Math.min(10, candidates.length);
  const surprisePool = candidates.filter((c) => c.surprise);
  const guaranteed = shuffle(surprisePool, rng).slice(
    0,
    Math.min(2, surprisePool.length, count),
  );
  const rest = candidates.filter((c) => !guaranteed.includes(c));
  const filler = shuffle(rest, rng).slice(0, count - guaranteed.length);
  const selection = shuffle([...guaranteed, ...filler], rng);
  return selection.map((candidate) => orient(candidate, rng));
}

/**
 * Endless mode: an infinite question sequence drawn from mulberry32(seed)
 * over the artifact's candidate pool; reproducible for a fixed seed (C63).
 * Immediate repeats are skipped when the pool has more than one candidate.
 *
 * @param {number} seed from the `?seed=` hash param when present, else
 *   Date.now() at session start (the caller supplies it; this module
 *   never reads the clock)
 * @param {{ models: Object[], surprises: Object[] }} artifact
 * @returns {Generator<Object>} question objects per C59
 */
export function* endlessQuestions(seed, artifact) {
  const rng = mulberry32(seed);
  const candidates = enumerateCandidates(artifact);
  if (candidates.length === 0) return;
  let last = null;
  while (true) {
    let candidate = candidates[Math.floor(rng() * candidates.length)];
    while (candidates.length > 1 && candidate === last) {
      candidate = candidates[Math.floor(rng() * candidates.length)];
    }
    last = candidate;
    yield orient(candidate, rng);
  }
}
