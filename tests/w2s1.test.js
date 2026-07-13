// tests/w2s1.test.js
// W2.S1: merge pipeline emitting docs/data/models.json (C12-C16, C18, C19).

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildArtifact } from "../scripts/merge.js";
import { ATTRIBUTION, validateArtifact } from "../scripts/validate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mergePath = join(repoRoot, "scripts", "merge.js");
const validatePath = join(repoRoot, "scripts", "validate.js");
const fixturesRoot = join(repoRoot, "tests", "fixtures", "w2s1");

/** Copy a fixture dir to a fresh temp dir so merge never writes into tests/. */
function stageFixture(name) {
  const dir = mkdtempSync(join(tmpdir(), `frontier-w2s1-${name}-`));
  cpSync(join(fixturesRoot, name), dir, { recursive: true });
  return dir;
}

function runMerge(dir, opts = {}) {
  const args = [mergePath];
  if (!opts.useEnv) args.push(dir);
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: opts.useEnv ? { ...process.env, FRONTIER_DATA_DIR: dir } : process.env,
  });
}

function readArtifact(dir) {
  return JSON.parse(readFileSync(join(dir, "models.json"), "utf8"));
}

function getPath(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => o[k], obj);
}

// Every nullable stat/enrichment field a merged record can carry (12.1).
const NULLABLE_FIELDS = [
  "releaseDate",
  "pricing.inputPerMTok",
  "pricing.outputPerMTok",
  "contextWindow",
  "benchmarks.gpqaDiamond",
  "benchmarks.swebenchVerified",
  "openWeights",
  "epoch.parameters",
  "epoch.trainingComputeFlop",
  "epoch.organization",
];

const COLUMNS = JSON.parse(
  readFileSync(join(fixturesRoot, "basic", "epoch-columns.json"), "utf8")
);

describe("W2.S1 merge pipeline: basic fixture run", () => {
  let artifact;
  let fixtureEvents;
  let byId;

  beforeAll(() => {
    const dir = stageFixture("basic");
    const res = runMerge(dir);
    expect(res.status, res.stderr).toBe(0);
    artifact = readArtifact(dir);
    fixtureEvents = JSON.parse(
      readFileSync(join(fixturesRoot, "basic", "events.json"), "utf8")
    );
    byId = new Map(artifact.models.map((m) => [m.id, m]));
  });

  it("emits exactly the 12.4 top-level keys with the exact attribution (C16)", () => {
    expect(Object.keys(artifact).sort()).toEqual([
      "attribution",
      "events",
      "generatedAt",
      "models",
    ]);
    expect(artifact.attribution).toBe(ATTRIBUTION);
    expect(artifact.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
    );
    expect(Number.isNaN(Date.parse(artifact.generatedAt))).toBe(false);
  });

  it("copies events verbatim (C16)", () => {
    expect(artifact.events).toEqual(fixtureEvents);
  });

  it("sorts models by id and includes exactly the curated models (C14, C18)", () => {
    expect(artifact.models.map((m) => m.id)).toEqual([
      "alpha-one",
      "beta-two",
      "delta-four",
      "gamma-three",
      "zeta-model",
    ]);
  });

  it("ignores unmatched Epoch rows: no extra models appear (C14)", () => {
    expect(artifact.models).toHaveLength(5);
    for (const m of artifact.models) {
      expect(m.name).not.toBe("Unmatched Model");
    }
  });

  it("joins on exact epochName and copies only the mapped enrichment fields (C14)", () => {
    const alpha = byId.get("alpha-one");
    expect(alpha.epoch).toEqual({
      parameters: 1000000000,
      trainingComputeFlop: 1.5e24,
      organization: "Alpha Lab Epoch",
    });
    // Unmapped CSV columns never leak into the record.
    for (const m of artifact.models) {
      expect(Object.keys(m).sort()).toEqual([
        "benchmarks",
        "contextWindow",
        "epoch",
        "epochName",
        "id",
        "name",
        "openWeights",
        "organization",
        "pricing",
        "releaseDate",
        "sources",
      ]);
      expect(Object.keys(m.epoch).sort()).toEqual([
        "organization",
        "parameters",
        "trainingComputeFlop",
      ]);
    }
  });

  it("curated wins on conflict; top-level organization stays curated (C14)", () => {
    const alpha = byId.get("alpha-one");
    expect(alpha.releaseDate).toBe("2024-05-01"); // CSV row says 2024-01-01
    expect(alpha.sources.releaseDate).toBe("curated");
    expect(alpha.organization).toBe("Alpha Lab Curated");
  });

  it("fills a null curated releaseDate from the matched Epoch row, tagged epoch (C14, C15)", () => {
    const zeta = byId.get("zeta-model");
    expect(zeta.releaseDate).toBe("2023-06-15");
    expect(zeta.sources.releaseDate).toBe("epoch");
    expect(zeta.epoch.parameters).toBe(2.5e9);
    expect(zeta.epoch.trainingComputeFlop).toBe(3e23);
    expect(zeta.epoch.organization).toBe("Zeta, Inc"); // quoted CSV field
  });

  it("matches case-sensitively with no normalization (C14)", () => {
    const gamma = byId.get("gamma-three"); // epochName "GAMMA THREE" vs CSV "Gamma Three"
    expect(gamma.epoch).toEqual({
      parameters: null,
      trainingComputeFlop: null,
      organization: null,
    });
    expect(gamma.releaseDate).toBe(null);
  });

  it("leaves models with null epochName unjoined (C14)", () => {
    const beta = byId.get("beta-two");
    expect(beta.epoch).toEqual({
      parameters: null,
      trainingComputeFlop: null,
      organization: null,
    });
    expect(beta.sources).toEqual({});
  });

  it("maps empty CSV fields to null, never 0 (C19)", () => {
    const delta = byId.get("delta-four"); // matched row with all fields empty
    expect(delta.epoch).toEqual({
      parameters: null,
      trainingComputeFlop: null,
      organization: null,
    });
    expect(delta.releaseDate).toBe(null);
    expect(delta.sources).toEqual({});
  });

  it("keeps sources truthful: key present iff field non-null, correct tag (C15)", () => {
    for (const m of artifact.models) {
      for (const field of NULLABLE_FIELDS) {
        const value = getPath(m, field);
        if (value === null) {
          expect(m.sources, `${m.id} ${field}`).not.toHaveProperty(field);
        } else {
          const expected =
            field.startsWith("epoch.") ||
            (field === "releaseDate" && m.id === "zeta-model")
              ? "epoch"
              : "curated";
          expect(m.sources[field], `${m.id} ${field}`).toBe(expected);
        }
      }
      // No stray tags beyond the known nullable fields.
      for (const key of Object.keys(m.sources)) {
        expect(NULLABLE_FIELDS).toContain(key);
      }
    }
  });

  it("produces an artifact that satisfies schemas 12.1 and 12.4 (C13, C17)", () => {
    expect(validateArtifact(artifact)).toEqual([]);
  });

  it("passes scripts/validate.js on the output directory", () => {
    const dir = stageFixture("basic");
    expect(runMerge(dir).status).toBe(0);
    const res = spawnSync(process.execPath, [validatePath, dir], {
      encoding: "utf8",
    });
    expect(res.status, res.stderr).toBe(0);
  });

  it("honors the FRONTIER_DATA_DIR environment override", () => {
    const dir = stageFixture("basic");
    const res = runMerge(dir, { useEnv: true });
    expect(res.status, res.stderr).toBe(0);
    expect(readArtifact(dir).models).toHaveLength(5);
  });
});

describe("W2.S1 merge pipeline: failure and determinism", () => {
  it("exits nonzero when a mapped column is missing from the CSV (C12)", () => {
    const dir = stageFixture("missing-column");
    const res = runMerge(dir);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/parameters/i);
  });

  it("is deterministic: two runs are byte-identical except generatedAt (C18)", () => {
    const a = stageFixture("basic");
    const b = stageFixture("basic");
    expect(runMerge(a).status).toBe(0);
    expect(runMerge(b).status).toBe(0);
    const normalize = (dir) =>
      readFileSync(join(dir, "models.json"), "utf8").replace(
        /"generatedAt": "[^"]+"/,
        '"generatedAt": "X"'
      );
    expect(normalize(a)).toBe(normalize(b));
  });
});

describe("W2.S1 null-in null-out property (C19)", () => {
  const baseRecord = {
    id: "prop-model",
    name: "Prop Model",
    organization: "Prop Lab",
    releaseDate: "2024-06-01",
    epochName: null,
    pricing: { inputPerMTok: 1.5, outputPerMTok: 3.25, currency: "USD" },
    contextWindow: 128000,
    benchmarks: { gpqaDiamond: 55.5, swebenchVerified: 44.4 },
    openWeights: true,
  };
  const events = [
    {
      id: "prop-event",
      date: "2024-06-02",
      title: "Prop",
      body: "Prop body",
      modelIds: ["prop-model"],
    },
  ];
  const header = [
    COLUMNS.modelName,
    COLUMNS.releaseDate,
    COLUMNS.parameters,
    COLUMNS.trainingComputeFlop,
    COLUMNS.organization,
  ].join(",");

  const curatedNullable = NULLABLE_FIELDS.filter(
    (f) => !f.startsWith("epoch.")
  );

  for (const field of curatedNullable) {
    it(`keeps ${field} null through the merge, with no sources tag`, () => {
      const record = structuredClone(baseRecord);
      const parts = field.split(".");
      if (parts.length === 2) record[parts[0]][parts[1]] = null;
      else record[field] = null;
      const artifact = buildArtifact({
        curated: [record],
        events,
        csvText: `${header}\n`,
        columns: COLUMNS,
        generatedAt: "2026-07-12T00:00:00.000Z",
      });
      const merged = artifact.models[0];
      expect(getPath(merged, field)).toBe(null);
      expect(merged.sources).not.toHaveProperty(field);
      // Every other nullable curated field is intact and tagged curated.
      for (const other of curatedNullable) {
        if (other === field) continue;
        expect(getPath(merged, other)).toBe(getPath(baseRecord, other));
        expect(merged.sources[other]).toBe("curated");
      }
    });
  }

  it("keeps every epoch enrichment field null when the CSV fields are empty", () => {
    const record = { ...structuredClone(baseRecord), epochName: "Prop Model" };
    const csvText = `${header}\nProp Model,,,,\n`;
    const artifact = buildArtifact({
      curated: [record],
      events,
      csvText,
      columns: COLUMNS,
      generatedAt: "2026-07-12T00:00:00.000Z",
    });
    const merged = artifact.models[0];
    for (const field of NULLABLE_FIELDS.filter((f) => f.startsWith("epoch."))) {
      expect(getPath(merged, field)).toBe(null);
      expect(merged.sources).not.toHaveProperty(field);
    }
  });
});

describe("W2.S1 merge.js source hygiene (C12, C19)", () => {
  const src = readFileSync(mergePath, "utf8");

  it("contains no quoted Epoch header string; headers come from epoch-columns.json", () => {
    const realColumns = JSON.parse(
      readFileSync(join(repoRoot, "data", "epoch-columns.json"), "utf8")
    );
    for (const headerName of Object.values(realColumns)) {
      expect(src).not.toContain(`"${headerName}"`);
      expect(src).not.toContain(`'${headerName}'`);
      expect(src).not.toContain(`\`${headerName}\``);
    }
  });

  it("contains no stat-field fallback or randomness", () => {
    expect(src).not.toMatch(/\?\?\s*0/);
    expect(src).not.toMatch(/\|\|\s*0/);
    expect(src).not.toContain("Math.random");
  });
});
