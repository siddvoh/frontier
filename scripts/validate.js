// scripts/validate.js
// Schema validator for Frontier data files (SPEC C10, C11, C16, C17, C55,
// C56, schemas 12.1-12.5). Hand-rolled, zero runtime dependencies (C5).
//
// Default targets (relative to the repo root, i.e. the parent of scripts/):
//   data/curated.json      -> schema 12.2 (curated input records)
//   data/events.json       -> schema 12.3 (events)
//   data/surprises.json    -> schema 12.5 (owner-authored surprises, C55);
//                             required on the default path, so a missing or
//                             invalid file fails loudly (C55)
//   docs/data/models.json  -> schemas 12.1 + amended 12.4 (artifact); the
//                             artifact check is skipped gracefully only when
//                             the file does not exist yet. When surprises are
//                             checked, the artifact must carry the required
//                             (possibly empty) `surprises` array and each
//                             surprise's two models must be non-null with
//                             differing values on the surprise field (C56).
//
// Testability override: a single optional argument (or the environment
// variable FRONTIER_DATA_DIR) names a fixture directory containing
// curated.json, events.json, and optionally surprises.json and models.json
// (fixture dirs without surprises.json skip that check gracefully, mirroring
// the W1.S3 artifact convention):
//   node scripts/validate.js tests/fixtures/w1s3/valid
//   FRONTIER_DATA_DIR=tests/fixtures/w1s3/valid node scripts/validate.js
//
// Exits nonzero on any violation and prints every violation found (C17).

import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ATTRIBUTION =
  'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai';

const MODEL_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9.]+)*$/;
const EVENT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// ---------------------------------------------------------------------------
// Primitive checks. Each returns violation strings into `errors`.
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isValidDateTimeString(value) {
  return DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function checkKeys(obj, required, allowed, path, errors) {
  for (const key of required) {
    if (!(key in obj)) errors.push(`${path}: missing required key "${key}"`);
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${path}: additional property "${key}" is not allowed`);
    }
  }
}

function checkNullableNumber(value, path, errors, opts) {
  if (value === null) return;
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${path}: must be a number or null`);
    return;
  }
  if (opts.integer && !Number.isInteger(value)) {
    errors.push(`${path}: must be an integer`);
  }
  if (value < opts.minimum) {
    errors.push(`${path}: must be >= ${opts.minimum} (got ${value})`);
  }
  if ("maximum" in opts && value > opts.maximum) {
    errors.push(`${path}: must be <= ${opts.maximum} (got ${value})`);
  }
}

function checkNonEmptyString(value, path, errors) {
  if (typeof value !== "string" || value.length < 1) {
    errors.push(`${path}: must be a non-empty string`);
  }
}

// Shared shape check for modelIds lists (events 12.3, surprises 12.5):
// array of unique strings, optionally of an exact length.
function checkModelIdList(list, path, errors, { exactLength } = {}) {
  if (!Array.isArray(list)) {
    errors.push(`${path}: must be an array of strings`);
    return;
  }
  if (exactLength !== undefined && list.length !== exactLength) {
    errors.push(
      `${path}: must contain exactly ${exactLength} model ids (got ${list.length})`
    );
  }
  const seen = new Set();
  list.forEach((entry, i) => {
    if (typeof entry !== "string") {
      errors.push(`${path}[${i}]: must be a string`);
    } else if (seen.has(entry)) {
      errors.push(
        `${path}[${i}]: duplicate entry ${JSON.stringify(entry)} (uniqueItems)`
      );
    } else {
      seen.add(entry);
    }
  });
}

// Shared referential check: every string entry must be a known model id.
function checkModelIdsExist(list, knownModelIds, path, errors) {
  if (!Array.isArray(list)) return;
  list.forEach((modelId, i) => {
    if (typeof modelId === "string" && !knownModelIds.has(modelId)) {
      errors.push(
        `${path}[${i}]: ${JSON.stringify(modelId)} is not an existing model id`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Schema 12.1 / 12.2: model record. `withPipelineFields` selects 12.1
// (artifact record, requires `epoch` and `sources`) versus 12.2 (curated).
// ---------------------------------------------------------------------------

const CURATED_KEYS = [
  "id",
  "name",
  "organization",
  "releaseDate",
  "epochName",
  "pricing",
  "contextWindow",
  "benchmarks",
  "openWeights",
];
const MODEL_KEYS = [...CURATED_KEYS, "epoch", "sources"];

function validateModelRecord(record, path, errors, withPipelineFields) {
  if (!isPlainObject(record)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = withPipelineFields ? MODEL_KEYS : CURATED_KEYS;
  checkKeys(record, keys, keys, path, errors);

  if ("id" in record) {
    if (typeof record.id !== "string" || !MODEL_ID_PATTERN.test(record.id)) {
      errors.push(
        `${path}.id: must be a string matching ^[a-z0-9]+(-[a-z0-9.]+)*$ (got ${JSON.stringify(record.id)})`
      );
    }
  }
  if ("name" in record) checkNonEmptyString(record.name, `${path}.name`, errors);
  if ("organization" in record) {
    checkNonEmptyString(record.organization, `${path}.organization`, errors);
  }
  if ("releaseDate" in record && record.releaseDate !== null) {
    if (
      typeof record.releaseDate !== "string" ||
      !isValidDateString(record.releaseDate)
    ) {
      errors.push(
        `${path}.releaseDate: must be a full-date string (YYYY-MM-DD) or null`
      );
    }
  }
  if ("epochName" in record) {
    if (record.epochName !== null && typeof record.epochName !== "string") {
      errors.push(`${path}.epochName: must be a string or null`);
    }
  }
  if ("pricing" in record) {
    validatePricing(record.pricing, `${path}.pricing`, errors);
  }
  if ("contextWindow" in record) {
    checkNullableNumber(record.contextWindow, `${path}.contextWindow`, errors, {
      integer: true,
      minimum: 1,
    });
  }
  if ("benchmarks" in record) {
    validateBenchmarks(record.benchmarks, `${path}.benchmarks`, errors);
  }
  if ("openWeights" in record) {
    if (record.openWeights !== null && typeof record.openWeights !== "boolean") {
      errors.push(`${path}.openWeights: must be a boolean or null`);
    }
  }
  if (withPipelineFields) {
    if ("epoch" in record) validateEpoch(record.epoch, `${path}.epoch`, errors);
    if ("sources" in record) {
      validateSources(record.sources, `${path}.sources`, errors);
    }
  }
}

function validatePricing(pricing, path, errors) {
  if (!isPlainObject(pricing)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = ["inputPerMTok", "outputPerMTok", "currency"];
  checkKeys(pricing, keys, keys, path, errors);
  if ("inputPerMTok" in pricing) {
    checkNullableNumber(pricing.inputPerMTok, `${path}.inputPerMTok`, errors, {
      minimum: 0,
    });
  }
  if ("outputPerMTok" in pricing) {
    checkNullableNumber(pricing.outputPerMTok, `${path}.outputPerMTok`, errors, {
      minimum: 0,
    });
  }
  if ("currency" in pricing && pricing.currency !== "USD") {
    errors.push(
      `${path}.currency: must be the constant "USD" (got ${JSON.stringify(pricing.currency)})`
    );
  }
}

function validateBenchmarks(benchmarks, path, errors) {
  if (!isPlainObject(benchmarks)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = ["gpqaDiamond", "swebenchVerified"];
  checkKeys(benchmarks, keys, keys, path, errors);
  for (const key of keys) {
    if (key in benchmarks) {
      checkNullableNumber(benchmarks[key], `${path}.${key}`, errors, {
        minimum: 0,
        maximum: 100,
      });
    }
  }
}

function validateEpoch(epoch, path, errors) {
  if (!isPlainObject(epoch)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = ["parameters", "trainingComputeFlop", "organization"];
  checkKeys(epoch, keys, keys, path, errors);
  for (const key of ["parameters", "trainingComputeFlop"]) {
    if (key in epoch) {
      checkNullableNumber(epoch[key], `${path}.${key}`, errors, { minimum: 0 });
    }
  }
  if ("organization" in epoch) {
    if (epoch.organization !== null && typeof epoch.organization !== "string") {
      errors.push(`${path}.organization: must be a string or null`);
    }
  }
}

function validateSources(sources, path, errors) {
  if (!isPlainObject(sources)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(sources)) {
    if (value !== "curated" && value !== "epoch") {
      errors.push(
        `${path}.${key}: must be "curated" or "epoch" (got ${JSON.stringify(value)})`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Schema 12.3: event.
// ---------------------------------------------------------------------------

function validateEvent(event, path, errors) {
  if (!isPlainObject(event)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = ["id", "date", "title", "body", "modelIds"];
  checkKeys(event, keys, keys, path, errors);

  if ("id" in event) {
    if (typeof event.id !== "string" || !EVENT_ID_PATTERN.test(event.id)) {
      errors.push(
        `${path}.id: must be a string matching ^[a-z0-9]+(-[a-z0-9]+)*$ (got ${JSON.stringify(event.id)})`
      );
    }
  }
  if ("date" in event) {
    if (typeof event.date !== "string" || !isValidDateString(event.date)) {
      errors.push(`${path}.date: must be a full-date string (YYYY-MM-DD)`);
    }
  }
  if ("title" in event) checkNonEmptyString(event.title, `${path}.title`, errors);
  if ("body" in event) checkNonEmptyString(event.body, `${path}.body`, errors);
  if ("modelIds" in event) {
    checkModelIdList(event.modelIds, `${path}.modelIds`, errors);
  }
}

// ---------------------------------------------------------------------------
// Schema 12.5: surprise (element of data/surprises.json and of the
// artifact's top-level `surprises` array). C55/C56.
// ---------------------------------------------------------------------------

export const SURPRISE_FIELDS = [
  "pricing.inputPerMTok",
  "pricing.outputPerMTok",
  "contextWindow",
  "benchmarks.gpqaDiamond",
  "benchmarks.swebenchVerified",
  "releaseDate",
];

const SURPRISE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function getFieldValue(record, dotPath) {
  return dotPath
    .split(".")
    .reduce((obj, key) => (isPlainObject(obj) ? obj[key] : undefined), record);
}

function validateSurprise(surprise, path, errors) {
  if (!isPlainObject(surprise)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const keys = ["id", "modelIds", "field", "note"];
  checkKeys(surprise, keys, keys, path, errors);

  if ("id" in surprise) {
    if (
      typeof surprise.id !== "string" ||
      !SURPRISE_ID_PATTERN.test(surprise.id)
    ) {
      errors.push(
        `${path}.id: must be a string matching ^[a-z0-9]+(-[a-z0-9]+)*$ (got ${JSON.stringify(surprise.id)})`
      );
    }
  }
  if ("modelIds" in surprise) {
    checkModelIdList(surprise.modelIds, `${path}.modelIds`, errors, {
      exactLength: 2,
    });
  }
  if ("field" in surprise && !SURPRISE_FIELDS.includes(surprise.field)) {
    errors.push(
      `${path}.field: must be one of ${SURPRISE_FIELDS.join(", ")} (got ${JSON.stringify(surprise.field)})`
    );
  }
  if ("note" in surprise) checkNonEmptyString(surprise.note, `${path}.note`, errors);
}

export function validateSurprises(surprises, knownModelIds, path = "surprises") {
  const errors = [];
  if (!Array.isArray(surprises)) {
    errors.push(`${path}: must be an array of surprise records`);
    return errors;
  }
  surprises.forEach((surprise, i) => {
    validateSurprise(surprise, `${path}[${i}]`, errors);
    if (isPlainObject(surprise)) {
      checkModelIdsExist(
        surprise.modelIds,
        knownModelIds,
        `${path}[${i}].modelIds`,
        errors
      );
    }
  });
  return errors;
}

// C56 artifact cross-check: for every surprise, both referenced models must
// be non-null on the surprise field, and the two values must differ. Runs
// only against a built artifact's models; existence violations are reported
// by validateSurprises, so unknown ids are skipped here.
export function checkSurprisesAgainstModels(surprises, models, path = "surprises") {
  const errors = [];
  if (!Array.isArray(surprises) || !Array.isArray(models)) return errors;
  const byId = new Map();
  for (const model of models) {
    if (isPlainObject(model) && typeof model.id === "string") {
      byId.set(model.id, model);
    }
  }
  surprises.forEach((surprise, i) => {
    if (
      !isPlainObject(surprise) ||
      !Array.isArray(surprise.modelIds) ||
      surprise.modelIds.length !== 2 ||
      !SURPRISE_FIELDS.includes(surprise.field)
    ) {
      return;
    }
    const values = surprise.modelIds.map((modelId) => {
      const model = byId.get(modelId);
      if (model === undefined) return undefined;
      return getFieldValue(model, surprise.field);
    });
    let allPresent = true;
    surprise.modelIds.forEach((modelId, j) => {
      if (!byId.has(modelId)) {
        allPresent = false;
        return;
      }
      if (values[j] === null || values[j] === undefined) {
        allPresent = false;
        errors.push(
          `${path}[${i}]: model ${JSON.stringify(modelId)} is null on field ${JSON.stringify(surprise.field)} in the artifact`
        );
      }
    });
    if (allPresent && values[0] === values[1]) {
      errors.push(
        `${path}[${i}]: both models have the same value ${JSON.stringify(values[0])} on field ${JSON.stringify(surprise.field)}; surprise values must differ`
      );
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Document-level validators (exported for direct unit use if desired).
// ---------------------------------------------------------------------------

export function validateCurated(curated) {
  const errors = [];
  if (!Array.isArray(curated)) {
    errors.push("curated: must be an array of curated model records");
    return errors;
  }
  curated.forEach((record, i) => {
    validateModelRecord(record, `curated[${i}]`, errors, false);
  });
  checkUniqueIds(curated, "curated", errors);
  return errors;
}

export function validateEvents(events, knownModelIds, path = "events") {
  const errors = [];
  if (!Array.isArray(events)) {
    errors.push(`${path}: must be an array of event records`);
    return errors;
  }
  events.forEach((event, i) => {
    validateEvent(event, `${path}[${i}]`, errors);
    if (isPlainObject(event)) {
      checkModelIdsExist(
        event.modelIds,
        knownModelIds,
        `${path}[${i}].modelIds`,
        errors
      );
    }
  });
  return errors;
}

// Amended 12.4: the artifact carries a top-level `surprises` array (possibly
// empty). `requireSurprises` makes the key required; it defaults to optional
// so pre-surprise fixture artifacts keep validating (W1.S3/W2.S1 suites).
// When the key is present its contents are always fully checked.
export function validateArtifact(artifact, { requireSurprises = false } = {}) {
  const errors = [];
  if (!isPlainObject(artifact)) {
    errors.push("artifact: must be an object");
    return errors;
  }
  const required = ["generatedAt", "attribution", "models", "events"];
  if (requireSurprises) required.push("surprises");
  const allowed = ["generatedAt", "attribution", "models", "events", "surprises"];
  checkKeys(artifact, required, allowed, "artifact", errors);

  if ("generatedAt" in artifact) {
    if (
      typeof artifact.generatedAt !== "string" ||
      !isValidDateTimeString(artifact.generatedAt)
    ) {
      errors.push(
        "artifact.generatedAt: must be an ISO 8601 date-time string"
      );
    }
  }
  if ("attribution" in artifact && artifact.attribution !== ATTRIBUTION) {
    errors.push(
      `artifact.attribution: must be the exact string ${JSON.stringify(ATTRIBUTION)} (got ${JSON.stringify(artifact.attribution)})`
    );
  }

  let artifactModelIds = new Set();
  if ("models" in artifact) {
    if (!Array.isArray(artifact.models)) {
      errors.push("artifact.models: must be an array");
    } else {
      if (artifact.models.length < 1) {
        errors.push("artifact.models: must contain at least 1 model");
      }
      artifact.models.forEach((record, i) => {
        validateModelRecord(record, `artifact.models[${i}]`, errors, true);
      });
      checkUniqueIds(artifact.models, "artifact.models", errors);
      checkSortedByIds(artifact.models, "artifact.models", errors);
      artifactModelIds = collectIds(artifact.models);
    }
  }
  if ("events" in artifact) {
    if (Array.isArray(artifact.events) && artifact.events.length < 1) {
      errors.push("artifact.events: must contain at least 1 event");
    }
    errors.push(
      ...validateEvents(artifact.events, artifactModelIds, "artifact.events")
    );
  }
  if ("surprises" in artifact) {
    errors.push(
      ...validateSurprises(
        artifact.surprises,
        artifactModelIds,
        "artifact.surprises"
      )
    );
    if (Array.isArray(artifact.models)) {
      errors.push(
        ...checkSurprisesAgainstModels(
          artifact.surprises,
          artifact.models,
          "artifact.surprises"
        )
      );
    }
  }
  return errors;
}

function collectIds(records) {
  const ids = new Set();
  for (const record of records) {
    if (isPlainObject(record) && typeof record.id === "string") {
      ids.add(record.id);
    }
  }
  return ids;
}

function checkUniqueIds(records, path, errors) {
  const seen = new Set();
  records.forEach((record, i) => {
    if (!isPlainObject(record) || typeof record.id !== "string") return;
    if (seen.has(record.id)) {
      errors.push(
        `${path}[${i}].id: duplicate model id ${JSON.stringify(record.id)}`
      );
    }
    seen.add(record.id);
  });
}

function checkSortedByIds(records, path, errors) {
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    if (!isPlainObject(prev) || !isPlainObject(curr)) continue;
    if (typeof prev.id !== "string" || typeof curr.id !== "string") continue;
    if (prev.id > curr.id) {
      errors.push(
        `${path}: not sorted by id (${JSON.stringify(prev.id)} appears before ${JSON.stringify(curr.id)})`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// File loading and CLI entry point.
// ---------------------------------------------------------------------------

function loadJson(filePath, label, errors) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    errors.push(`${label}: cannot read ${filePath} (${err.message})`);
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    errors.push(`${label}: invalid JSON in ${filePath} (${err.message})`);
    return undefined;
  }
}

function resolvePaths() {
  const override = process.argv[2] !== undefined
    ? process.argv[2]
    : process.env.FRONTIER_DATA_DIR;
  if (override !== undefined && override !== "") {
    const dir = resolve(override);
    return {
      curated: join(dir, "curated.json"),
      events: join(dir, "events.json"),
      surprises: join(dir, "surprises.json"),
      artifact: join(dir, "models.json"),
      isOverride: true,
    };
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return {
    curated: join(repoRoot, "data", "curated.json"),
    events: join(repoRoot, "data", "events.json"),
    surprises: join(repoRoot, "data", "surprises.json"),
    artifact: join(repoRoot, "docs", "data", "models.json"),
    isOverride: false,
  };
}

export function runValidation(paths) {
  const errors = [];

  const curated = loadJson(paths.curated, "curated", errors);
  const events = loadJson(paths.events, "events", errors);

  let curatedIds = new Set();
  if (curated !== undefined) {
    errors.push(...validateCurated(curated));
    if (Array.isArray(curated)) curatedIds = collectIds(curated);
  }
  if (events !== undefined) {
    errors.push(...validateEvents(events, curatedIds));
  }

  // Surprises (schema 12.5, C55/C56). Required on the default path so a
  // missing data/surprises.json fails loudly; override (fixture) dirs
  // without the file skip gracefully, mirroring the artifact convention.
  let surprisesChecked = false;
  let surprises;
  if (existsSync(paths.surprises) || !paths.isOverride) {
    surprisesChecked = true;
    surprises = loadJson(paths.surprises, "surprises", errors);
    if (surprises !== undefined) {
      errors.push(...validateSurprises(surprises, curatedIds));
    }
  }

  let artifactChecked = false;
  if (existsSync(paths.artifact)) {
    artifactChecked = true;
    const artifact = loadJson(paths.artifact, "artifact", errors);
    if (artifact !== undefined) {
      errors.push(
        ...validateArtifact(artifact, { requireSurprises: surprisesChecked })
      );
      // C56: the source surprises must reference models that are non-null
      // with differing values on the surprise field in the built artifact.
      if (surprises !== undefined && isPlainObject(artifact)) {
        errors.push(
          ...checkSurprisesAgainstModels(surprises, artifact.models)
        );
      }
    }
  }

  return { errors, artifactChecked, surprisesChecked };
}

function main() {
  const paths = resolvePaths();
  const { errors, artifactChecked, surprisesChecked } = runValidation(paths);

  if (!surprisesChecked) {
    console.log(
      `validate: ${paths.surprises} does not exist; skipping surprises check`
    );
  }
  if (!artifactChecked) {
    console.log(
      `validate: ${paths.artifact} does not exist yet; skipping artifact check`
    );
  }
  if (errors.length > 0) {
    for (const violation of errors) {
      console.error(`VIOLATION: ${violation}`);
    }
    console.error(`validate: FAILED with ${errors.length} violation(s)`);
    process.exit(1);
  }
  console.log(
    `validate: OK (curated, events${surprisesChecked ? ", surprises" : ""}${artifactChecked ? ", artifact" : ""})`
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
