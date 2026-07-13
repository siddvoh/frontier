// W4.S3 adjacent hygiene: docs/ ships no gradients, no webfonts, and no
// node_modules reference (C42, C40, C5); nothing in scripts/ or docs/js/
// uses Math.random (C19).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

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

describe("docs/ hygiene (C42, C40, C5)", () => {
  it("has files to scan", () => {
    expect(docsFiles.length).toBeGreaterThan(0);
  });

  it.each([
    ["gradient("],
    ["@font-face"],
    ["fonts.googleapis"],
    [".woff"],
    ["node_modules"],
  ])("contains no %s", (needle) => {
    expect(offenders(docsFiles, needle)).toEqual([]);
  });
});

describe("no Math.random in scripts/ or docs/js/ (C19)", () => {
  it("scripts/ is clean", () => {
    expect(scriptFiles.length).toBeGreaterThan(0);
    expect(offenders(scriptFiles, "Math.random")).toEqual([]);
  });

  it("docs/js/ is clean", () => {
    expect(docsJsFiles.length).toBeGreaterThan(0);
    expect(offenders(docsJsFiles, "Math.random")).toEqual([]);
  });
});
