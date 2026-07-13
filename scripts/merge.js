// scripts/merge.js
// Merge pipeline (SPEC C12-C16, C18, C19). Reads the curated master file,
// the events file, the committed Epoch CSV snapshot, and the logical-to-CSV
// column map, then writes exactly one artifact: docs/data/models.json.
//
// Rules enforced here:
//   - curated.json is master: every curated record appears, nothing else.
//   - Join on exact, case-sensitive epochName equality; unmatched Epoch rows
//     are ignored; on conflict the curated value wins.
//   - Only the mapped enrichment fields are copied from the CSV, and every
//     CSV header name comes from the column map file, never from this file.
//   - Empty CSV fields become null. No stat value is ever defaulted.
//
// Testability override: a single optional argument (or the environment
// variable FRONTIER_DATA_DIR) names a directory containing curated.json,
// events.json, epoch_notable_ai_models.csv, and epoch-columns.json; the
// artifact is then written to models.json inside that same directory.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "./lib/csv.js";
import { ATTRIBUTION, validateCurated, validateEvents } from "./validate.js";

// Logical enrichment keys expected in the column map (values are the CSV
// header names; C12 forbids hardcoding those here).
const COLUMN_KEYS = [
  "modelName",
  "releaseDate",
  "parameters",
  "trainingComputeFlop",
  "organization",
];

// ---------------------------------------------------------------------------
// CSV cell conversion. "" always maps to null; nothing is ever defaulted.
// ---------------------------------------------------------------------------

function cellString(value) {
  return value === "" ? null : value;
}

function cellNumber(value, label) {
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${label}: CSV value ${JSON.stringify(value)} is not numeric`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Merge core (pure; exported for unit tests).
// ---------------------------------------------------------------------------

function indexEpochRows(csvText, columns) {
  const { header, rows } = parse(csvText);
  for (const key of COLUMN_KEYS) {
    const columnName = columns[key];
    if (typeof columnName !== "string" || columnName === "") {
      throw new Error(`epoch-columns: missing mapping for logical key "${key}"`);
    }
    if (!header.includes(columnName)) {
      throw new Error(
        `epoch-columns: mapped column ${JSON.stringify(columnName)} for "${key}" is absent from the CSV header`
      );
    }
  }
  const byName = new Map();
  for (const row of rows) {
    const name = row[columns.modelName];
    if (!byName.has(name)) byName.set(name, row);
  }
  return byName;
}

function tagIfPresent(sources, dotPath, value, source) {
  if (value !== null) sources[dotPath] = source;
}

function mergeRecord(record, epochRow, columns) {
  const epoch = { parameters: null, trainingComputeFlop: null, organization: null };
  let releaseDate = record.releaseDate;
  let releaseDateSource = "curated";

  if (epochRow !== undefined) {
    epoch.parameters = cellNumber(
      epochRow[columns.parameters],
      `${record.id}.epoch.parameters`
    );
    epoch.trainingComputeFlop = cellNumber(
      epochRow[columns.trainingComputeFlop],
      `${record.id}.epoch.trainingComputeFlop`
    );
    epoch.organization = cellString(epochRow[columns.organization]);
    if (releaseDate === null) {
      const epochDate = cellString(epochRow[columns.releaseDate]);
      if (epochDate !== null) {
        releaseDate = epochDate;
        releaseDateSource = "epoch";
      }
    }
  }

  const sources = {};
  tagIfPresent(sources, "releaseDate", releaseDate, releaseDateSource);
  tagIfPresent(sources, "pricing.inputPerMTok", record.pricing.inputPerMTok, "curated");
  tagIfPresent(sources, "pricing.outputPerMTok", record.pricing.outputPerMTok, "curated");
  tagIfPresent(sources, "contextWindow", record.contextWindow, "curated");
  tagIfPresent(sources, "benchmarks.gpqaDiamond", record.benchmarks.gpqaDiamond, "curated");
  tagIfPresent(sources, "benchmarks.swebenchVerified", record.benchmarks.swebenchVerified, "curated");
  tagIfPresent(sources, "openWeights", record.openWeights, "curated");
  tagIfPresent(sources, "epoch.parameters", epoch.parameters, "epoch");
  tagIfPresent(sources, "epoch.trainingComputeFlop", epoch.trainingComputeFlop, "epoch");
  tagIfPresent(sources, "epoch.organization", epoch.organization, "epoch");

  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    releaseDate,
    epochName: record.epochName,
    pricing: {
      inputPerMTok: record.pricing.inputPerMTok,
      outputPerMTok: record.pricing.outputPerMTok,
      currency: record.pricing.currency,
    },
    contextWindow: record.contextWindow,
    benchmarks: {
      gpqaDiamond: record.benchmarks.gpqaDiamond,
      swebenchVerified: record.benchmarks.swebenchVerified,
    },
    openWeights: record.openWeights,
    epoch,
    sources,
  };
}

/**
 * Build the models.json artifact object from in-memory inputs.
 *
 * @param {{ curated: object[], events: object[], csvText: string,
 *           columns: Record<string, string>, generatedAt: string }} inputs
 * @returns {object} the artifact (12.4 shape)
 */
export function buildArtifact({ curated, events, csvText, columns, generatedAt }) {
  const byName = indexEpochRows(csvText, columns);
  const models = curated.map((record) =>
    mergeRecord(
      record,
      record.epochName === null ? undefined : byName.get(record.epochName),
      columns
    )
  );
  models.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { generatedAt, attribution: ATTRIBUTION, models, events };
}

// ---------------------------------------------------------------------------
// File loading and CLI entry point.
// ---------------------------------------------------------------------------

function resolvePaths() {
  const override =
    process.argv[2] !== undefined ? process.argv[2] : process.env.FRONTIER_DATA_DIR;
  if (override !== undefined && override !== "") {
    const dir = resolve(override);
    return {
      curated: join(dir, "curated.json"),
      events: join(dir, "events.json"),
      csv: join(dir, "epoch_notable_ai_models.csv"),
      columns: join(dir, "epoch-columns.json"),
      artifact: join(dir, "models.json"),
    };
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return {
    curated: join(repoRoot, "data", "curated.json"),
    events: join(repoRoot, "data", "events.json"),
    csv: join(repoRoot, "data", "epoch_notable_ai_models.csv"),
    columns: join(repoRoot, "data", "epoch-columns.json"),
    artifact: join(repoRoot, "docs", "data", "models.json"),
  };
}

function loadJson(filePath, label) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`${label}: cannot read ${filePath} (${err.message})`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label}: invalid JSON in ${filePath} (${err.message})`);
  }
}

function main() {
  const paths = resolvePaths();

  const curated = loadJson(paths.curated, "curated");
  const events = loadJson(paths.events, "events");
  const columns = loadJson(paths.columns, "epoch-columns");
  const csvText = readFileSync(paths.csv, "utf8");

  // Fail loudly on invalid inputs (C10/C11); never work around them.
  const inputErrors = [
    ...validateCurated(curated),
    ...validateEvents(
      events,
      new Set(curated.map((record) => record.id))
    ),
  ];
  if (inputErrors.length > 0) {
    for (const violation of inputErrors) {
      console.error(`VIOLATION: ${violation}`);
    }
    throw new Error(`input validation failed with ${inputErrors.length} violation(s)`);
  }

  const artifact = buildArtifact({
    curated,
    events,
    csvText,
    columns,
    generatedAt: new Date().toISOString(),
  });

  mkdirSync(dirname(paths.artifact), { recursive: true });
  writeFileSync(paths.artifact, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(
    `merge: wrote ${paths.artifact} (${artifact.models.length} models, ${artifact.events.length} events)`
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error(`merge: FAILED: ${err.message}`);
    process.exit(1);
  }
}
