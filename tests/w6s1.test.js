// tests/w6s1.test.js
// W6.S1: pipeline support for surprises data (SPEC C55, C56, C57, C18,
// schemas 12.4 as amended and 12.5).
//
// validate.js enforces schema 12.5 on surprises.json plus the amended 12.4
// artifact shape and the C56 artifact cross-checks; merge.js copies
// surprises.json verbatim into the artifact as top-level `surprises`.
// Fixture dirs follow the established override convention: curated.json,
// events.json, epoch_notable_ai_models.csv, epoch-columns.json,
// surprises.json, with the artifact written as models.json in the same dir.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildArtifact } from "../scripts/merge.js";
import {
  SURPRISE_FIELDS,
  validateArtifact,
  validateSurprises,
} from "../scripts/validate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mergePath = join(repoRoot, "scripts", "merge.js");
const validatePath = join(repoRoot, "scripts", "validate.js");
const fixturesRoot = join(repoRoot, "tests", "fixtures", "w6s1");

/** Copy a fixture dir to a fresh temp dir so merge never writes into tests/. */
function stageFixture(name) {
  const dir = mkdtempSync(join(tmpdir(), `frontier-w6s1-${name}-`));
  cpSync(join(fixturesRoot, name), dir, { recursive: true });
  return dir;
}

function runScript(script, dir, opts = {}) {
  const args = [script];
  if (!opts.useEnv) args.push(dir);
  const res = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: opts.useEnv ? { ...process.env, FRONTIER_DATA_DIR: dir } : process.env,
  });
  return { status: res.status, output: `${res.stdout}${res.stderr}` };
}

const runMerge = (dir, opts) => runScript(mergePath, dir, opts);
const runValidate = (dir, opts) => runScript(validatePath, dir, opts);

function readArtifact(dir) {
  return JSON.parse(readFileSync(join(dir, "models.json"), "utf8"));
}

// ---------------------------------------------------------------------------
// Schema 12.5 rules: one test per rule, each feeding an invalid fixture and
// asserting a nonzero validate.js exit (C55, C56).
// ---------------------------------------------------------------------------

describe("W6.S1 validate.js: schema 12.5 on surprises.json", () => {
  const bad = runValidate(join(fixturesRoot, "bad-surprises"));

  it("exits nonzero on the schema-invalid fixture", () => {
    expect(bad.status).not.toBe(0);
    expect(bad.output).toContain("VIOLATION");
  });

  it("rejects an id that breaks the ^[a-z0-9]+(-[a-z0-9]+)*$ pattern", () => {
    expect(bad.output).toContain("Bad_ID");
    expect(bad.output).toContain("surprises[0].id: must be a string matching");
  });

  it("rejects a field outside the six C59 stat fields", () => {
    expect(bad.output).toContain(
      'surprises[1].field: must be one of'
    );
    expect(bad.output).toContain('"epoch.parameters"');
  });

  it("rejects a modelId that does not exist in curated.json", () => {
    expect(bad.output).toContain(
      '"ghost-model" is not an existing model id'
    );
  });

  it("rejects duplicate modelIds within one entry (uniqueItems)", () => {
    expect(bad.output).toContain(
      'surprises[3].modelIds[1]: duplicate entry "alpha-one"'
    );
  });

  it("rejects modelIds arrays that do not hold exactly 2 ids", () => {
    expect(bad.output).toContain(
      "surprises[4].modelIds: must contain exactly 2 model ids (got 1)"
    );
  });

  it("rejects a missing required key", () => {
    expect(bad.output).toContain('surprises[5]: missing required key "note"');
  });

  it("rejects additional properties", () => {
    expect(bad.output).toContain(
      'surprises[6]: additional property "bonus" is not allowed'
    );
  });

  it("rejects an empty note", () => {
    expect(bad.output).toContain(
      "surprises[7].note: must be a non-empty string"
    );
  });

  it("rejects a surprises.json that is not an array", () => {
    const res = runValidate(join(fixturesRoot, "not-array"));
    expect(res.status).not.toBe(0);
    expect(res.output).toContain(
      "surprises: must be an array of surprise records"
    );
  });

  it("fails loudly on malformed JSON", () => {
    const res = runValidate(join(fixturesRoot, "malformed"));
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("surprises: invalid JSON");
  });
});

// ---------------------------------------------------------------------------
// C56 artifact cross-checks: non-null on the field, differing values;
// skipped gracefully when models.json is absent (W1.S3 convention).
// ---------------------------------------------------------------------------

describe("W6.S1 validate.js: C56 checks against the built artifact", () => {
  it("exits nonzero when a referenced model is null on the surprise field", () => {
    const dir = stageFixture("null-field");
    expect(runMerge(dir).status).toBe(0); // schema-valid, so merge succeeds
    const res = runValidate(dir);
    expect(res.status).not.toBe(0);
    expect(res.output).toContain(
      'model "beta-two" is null on field "benchmarks.swebenchVerified"'
    );
  });

  it("exits nonzero when both models share the same value on the field", () => {
    const dir = stageFixture("equal-values");
    expect(runMerge(dir).status).toBe(0);
    const res = runValidate(dir);
    expect(res.status).not.toBe(0);
    expect(res.output).toContain(
      'both models have the same value 100000 on field "contextWindow"'
    );
  });

  it("skips the artifact cross-check gracefully when models.json is absent", () => {
    // Same null-field fixture, but without a built artifact: schema and
    // curated-existence checks pass, artifact check is skipped (W1.S3).
    const res = runValidate(join(fixturesRoot, "null-field"));
    expect(res.status).toBe(0);
    expect(res.output).toContain("skipping artifact check");
    expect(res.output).not.toContain("VIOLATION");
  });

  it("exits nonzero when the artifact lacks the required surprises array (amended 12.4)", () => {
    const dir = stageFixture("valid");
    expect(runMerge(dir).status).toBe(0);
    const artifact = readArtifact(dir);
    delete artifact.surprises;
    writeFileSync(join(dir, "models.json"), `${JSON.stringify(artifact, null, 2)}\n`);
    const res = runValidate(dir);
    expect(res.status).not.toBe(0);
    expect(res.output).toContain(
      'artifact: missing required key "surprises"'
    );
  });

  it("exits nonzero when an artifact surprise references a model absent from the artifact", () => {
    const dir = stageFixture("valid");
    expect(runMerge(dir).status).toBe(0);
    const artifact = readArtifact(dir);
    artifact.surprises[0].modelIds = ["alpha-one", "ghost-model"];
    writeFileSync(join(dir, "models.json"), `${JSON.stringify(artifact, null, 2)}\n`);
    const res = runValidate(dir);
    expect(res.status).not.toBe(0);
    expect(res.output).toContain(
      'artifact.surprises[0].modelIds[1]: "ghost-model" is not an existing model id'
    );
  });
});

// ---------------------------------------------------------------------------
// merge.js: verbatim copy into the artifact, loud input failure, C18
// determinism extended over the new field (C57, C18, C55).
// ---------------------------------------------------------------------------

describe("W6.S1 merge.js: surprises flow into the artifact", () => {
  it("copies surprises.json verbatim as top-level `surprises` and validates (C57)", () => {
    const dir = stageFixture("valid");
    const merge = runMerge(dir);
    expect(merge.status, merge.output).toBe(0);
    const artifact = readArtifact(dir);
    const fixtureSurprises = JSON.parse(
      readFileSync(join(fixturesRoot, "valid", "surprises.json"), "utf8")
    );
    expect(Object.keys(artifact).sort()).toEqual([
      "attribution",
      "events",
      "generatedAt",
      "models",
      "surprises",
    ]);
    expect(artifact.surprises).toEqual(fixtureSurprises);
    expect(validateArtifact(artifact, { requireSurprises: true })).toEqual([]);
    const res = runValidate(dir);
    expect(res.status, res.output).toBe(0);
    expect(res.output).toContain("surprises");
  });

  it("honors the FRONTIER_DATA_DIR override for both scripts", () => {
    const dir = stageFixture("valid");
    expect(runMerge(dir, { useEnv: true }).status).toBe(0);
    expect(readArtifact(dir).surprises).toHaveLength(3);
    expect(runValidate(dir, { useEnv: true }).status).toBe(0);
  });

  it("accepts an empty surprises array end to end (amended 12.4 allows [])", () => {
    const dir = stageFixture("valid");
    writeFileSync(join(dir, "surprises.json"), "[]\n");
    expect(runMerge(dir).status).toBe(0);
    expect(readArtifact(dir).surprises).toEqual([]);
    expect(runValidate(dir).status).toBe(0);
  });

  it("fails loudly on schema-invalid surprises input (C55)", () => {
    const res = runMerge(join(fixturesRoot, "bad-surprises"));
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("VIOLATION");
    expect(res.output).toContain("merge: FAILED");
  });

  it("fails loudly on malformed surprises JSON (C55)", () => {
    const res = runMerge(join(fixturesRoot, "malformed"));
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("surprises: invalid JSON");
  });

  it("is deterministic over the extended artifact, surprises included (C18)", () => {
    const a = stageFixture("valid");
    const b = stageFixture("valid");
    expect(runMerge(a).status).toBe(0);
    expect(runMerge(b).status).toBe(0);
    const normalize = (dir) =>
      readFileSync(join(dir, "models.json"), "utf8").replace(
        /"generatedAt": "[^"]+"/,
        '"generatedAt": "X"'
      );
    expect(normalize(a)).toContain('"surprises"');
    expect(normalize(a)).toBe(normalize(b));
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility: override dirs without surprises.json keep the
// pre-surprise behavior (the W1.S3/W2.S1 fixture suites rely on this).
// ---------------------------------------------------------------------------

describe("W6.S1 override dirs without surprises.json (fixture back-compat)", () => {
  it("validate skips the surprises check gracefully and exits 0", () => {
    const dir = stageFixture("valid");
    rmSync(join(dir, "surprises.json"));
    const res = runValidate(dir);
    expect(res.status, res.output).toBe(0);
    expect(res.output).toContain("skipping surprises check");
    expect(res.output).not.toContain("VIOLATION");
  });

  it("merge builds the pre-surprise artifact shape (no surprises key)", () => {
    const dir = stageFixture("valid");
    rmSync(join(dir, "surprises.json"));
    expect(runMerge(dir).status).toBe(0);
    const artifact = readArtifact(dir);
    expect(Object.keys(artifact).sort()).toEqual([
      "attribution",
      "events",
      "generatedAt",
      "models",
    ]);
    // ...and validate accepts that shape when no surprises input exists.
    expect(runValidate(dir).status).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit-level exports and the committed real data (done-item 9 groundwork).
// ---------------------------------------------------------------------------

describe("W6.S1 unit exports and committed data", () => {
  it("SURPRISE_FIELDS is exactly the six C59 stat fields", () => {
    expect(SURPRISE_FIELDS).toEqual([
      "pricing.inputPerMTok",
      "pricing.outputPerMTok",
      "contextWindow",
      "benchmarks.gpqaDiamond",
      "benchmarks.swebenchVerified",
      "releaseDate",
    ]);
  });

  it("validateSurprises accepts the committed data/surprises.json against curated ids", () => {
    const surprises = JSON.parse(
      readFileSync(join(repoRoot, "data", "surprises.json"), "utf8")
    );
    const curated = JSON.parse(
      readFileSync(join(repoRoot, "data", "curated.json"), "utf8")
    );
    const ids = new Set(curated.map((record) => record.id));
    expect(validateSurprises(surprises, ids)).toEqual([]);
  });

  it("buildArtifact passes surprises through untouched (verbatim, C57)", () => {
    const curated = JSON.parse(
      readFileSync(join(fixturesRoot, "valid", "curated.json"), "utf8")
    );
    const events = JSON.parse(
      readFileSync(join(fixturesRoot, "valid", "events.json"), "utf8")
    );
    const columns = JSON.parse(
      readFileSync(join(fixturesRoot, "valid", "epoch-columns.json"), "utf8")
    );
    const csvText = readFileSync(
      join(fixturesRoot, "valid", "epoch_notable_ai_models.csv"),
      "utf8"
    );
    const surprises = JSON.parse(
      readFileSync(join(fixturesRoot, "valid", "surprises.json"), "utf8")
    );
    const artifact = buildArtifact({
      curated,
      events,
      csvText,
      columns,
      generatedAt: "2026-07-13T00:00:00.000Z",
      surprises,
    });
    expect(artifact.surprises).toBe(surprises); // same reference: verbatim
    expect(validateArtifact(artifact, { requireSurprises: true })).toEqual([]);
  });
});
