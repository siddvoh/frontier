// W1.S3: schema validator tests (SPEC C10, C11, C16, C17, schemas 12.1-12.4).
// Spawns scripts/validate.js as a child process, exactly as `npm run validate`
// does, using the fixture-directory override for the invalid cases and the
// default real data paths for the committed-data case.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(repoRoot, "scripts", "validate.js");
const fixtures = join(repoRoot, "tests", "fixtures", "w1s3");

function runValidate(args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

describe("validate.js on fixture directories", () => {
  it("exits 0 on a fully valid fixture set (curated, events, artifact)", () => {
    const { status, output } = runValidate([join(fixtures, "valid")]);
    expect(output).not.toContain("VIOLATION");
    expect(status).toBe(0);
  });

  it("exits 0 and skips the artifact check when models.json is absent", () => {
    const { status, output } = runValidate([join(fixtures, "no-artifact")]);
    expect(status).toBe(0);
    expect(output).toContain("does not exist yet");
    expect(output).toContain("skipping artifact check");
  });

  it("exits nonzero on a bad model id pattern", () => {
    const { status, output } = runValidate([join(fixtures, "bad-id")]);
    expect(status).not.toBe(0);
    expect(output).toContain("VIOLATION");
    expect(output).toContain("Bad_ID");
    expect(output).toContain("id: must be a string matching");
  });

  it("exits nonzero on a missing required key", () => {
    const { status, output } = runValidate([join(fixtures, "missing-key")]);
    expect(status).not.toBe(0);
    expect(output).toContain('missing required key "pricing"');
  });

  it("exits nonzero on a negative price", () => {
    const { status, output } = runValidate([join(fixtures, "negative-price")]);
    expect(status).not.toBe(0);
    expect(output).toContain("pricing.inputPerMTok");
    expect(output).toContain("must be >= 0");
  });

  it("exits nonzero when an event references an unknown model id", () => {
    const { status, output } = runValidate([join(fixtures, "unknown-modelid")]);
    expect(status).not.toBe(0);
    expect(output).toContain('"ghost-model" is not an existing model id');
  });

  it("prints every artifact violation found, not just the first (C17)", () => {
    const { status, output } = runValidate([join(fixtures, "bad-artifact")]);
    expect(status).not.toBe(0);
    // Four independent violations from one run:
    expect(output).toContain("artifact.attribution: must be the exact string");
    expect(output).toContain("not sorted by id");
    expect(output).toContain('duplicate model id "alpha-1"');
    expect(output).toContain('"phantom-model" is not an existing model id');
  });

  it("also accepts the fixture directory via the FRONTIER_DATA_DIR env var", () => {
    const { status, output } = runValidate([], {
      FRONTIER_DATA_DIR: join(fixtures, "bad-id"),
    });
    expect(status).not.toBe(0);
    expect(output).toContain("Bad_ID");
  });
});

describe("validate.js on the committed real data", () => {
  it("validates data/curated.json and data/events.json cleanly (exit 0)", () => {
    const { status, output } = runValidate([]);
    expect(output).not.toContain("VIOLATION");
    expect(status).toBe(0);
  });
});
