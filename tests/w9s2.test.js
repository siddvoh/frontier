// W9.S2 adjacent hygiene, extending the W4.S3 pattern over the finished
// game code: no seeded-randomness bypass in scripts/ or docs/js/ (C19),
// no gradient( in docs/ (C42), and the C58 PRNG listing byte-identical
// between SPEC.md and docs/js/game/questions.js.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Constructed so this file itself never carries the banned literal.
const RANDOM_TOKEN = "Math" + ".random";

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function offenders(files, needle) {
  return files.filter((file) => readFileSync(file, "utf8").includes(needle));
}

const docsFiles = listFiles(join(ROOT, "docs"));
const scriptFiles = listFiles(join(ROOT, "scripts"));
const docsJsFiles = listFiles(join(ROOT, "docs", "js"));

describe("W9.S2 randomness hygiene (C19)", () => {
  it("scripts/ is clean", () => {
    expect(scriptFiles.length).toBeGreaterThan(0);
    expect(offenders(scriptFiles, RANDOM_TOKEN)).toEqual([]);
  });

  it("docs/js/ (including docs/js/game/) is clean", () => {
    expect(docsJsFiles.length).toBeGreaterThan(0);
    expect(
      docsJsFiles.some((file) => file.includes(join("js", "game")))
    ).toBe(true);
    expect(offenders(docsJsFiles, RANDOM_TOKEN)).toEqual([]);
  });
});

describe("W9.S2 docs/ hygiene (C42)", () => {
  it("contains no gradient(", () => {
    expect(docsFiles.length).toBeGreaterThan(0);
    expect(offenders(docsFiles, "gradient(")).toEqual([]);
  });
});

describe("W9.S2 C58 PRNG listing byte-identity", () => {
  it("questions.js contains the SPEC code fence byte-identical", () => {
    const specSource = readFileSync(join(ROOT, "SPEC.md"), "utf8");
    const questionsSource = readFileSync(
      join(ROOT, "docs", "js", "game", "questions.js"),
      "utf8",
    );
    const fenceMatch = specSource.match(/ {2}```js\n([\s\S]*?) {2}```\n/);
    expect(fenceMatch).not.toBeNull();
    const listing = fenceMatch[1].replace(/^ {2}/gm, "");
    expect(listing).toContain("export function xmur3");
    expect(listing).toContain("export function mulberry32");
    expect(questionsSource).toContain(listing);
  });
});
