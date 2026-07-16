// W12.S1: the STEP 3 amendment is transcribed into SPEC.md.
// The plan fixes every STEP 3 value; this suite pins the spec to those
// values so plan and spec can never drift apart silently. It also pins the
// integration itself: each amended criterion states its whole rule where it
// stands, and the STEP 3 section restates no values, so every rule has
// exactly one place to read and to change.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SPEC = readFileSync(join(ROOT, "SPEC.md"), "utf8");

/** The text of criterion `id`, from its bullet to the next one. */
function criterion(id) {
  const start = SPEC.search(new RegExp(`^- ${id}\\. `, "m"));
  expect(start, `${id} exists`).toBeGreaterThan(-1);
  const rest = SPEC.slice(start + 1);
  const next = rest.search(/^- C\d+\. |^#/m);
  return next === -1 ? rest : rest.slice(0, next);
}

const STEP3 = SPEC.slice(SPEC.indexOf("# STEP 3: DESIGN SYSTEM"));

describe("STEP 3 section", () => {
  it("exists with its own heading and its own done items", () => {
    expect(SPEC).toContain("# STEP 3: DESIGN SYSTEM");
    expect(STEP3).toContain("## 24. STEP 3 definition of done");
  });

  it("stamps exactly the five amended criteria", () => {
    // Only criterion-line stamps count; the section prose names the string.
    const stamps = SPEC.match(/^- C\d+\. \(Amended by STEP 3\.\)/gm) ?? [];
    expect(stamps).toHaveLength(5);
    for (const c of ["C37", "C38", "C39", "C45", "C46"]) {
      expect(SPEC).toMatch(
        new RegExp(`^- ${c}\\. \\(Amended by STEP 3\\.\\)`, "m")
      );
    }
  });

  it("restates no token value: the criteria are the single source", () => {
    for (const value of [
      "#15803D",
      "#4ADE80",
      "#B91C1C",
      "#F87171",
      "rgba(180, 83, 9, 0.12)",
      "rgba(232, 163, 61, 0.16)",
      "0 12px 40px",
      "300ms",
    ]) {
      expect(STEP3, `${value} restated in the STEP 3 section`).not.toContain(
        value
      );
    }
  });

  it("says what it deliberately does not touch", () => {
    expect(STEP3).toContain("additive");
    expect(STEP3).toMatch(/C32's proportional bars, C53's 32 shots, and C68's/);
  });
});

describe("C37 carries the whole twelve-name token set", () => {
  const c37 = criterion("C37");

  it("declares both light state colors and elevation", () => {
    expect(c37).toContain("--success: #15803D;");
    expect(c37).toContain("--danger: #B91C1C;");
    expect(c37).toContain("--accent-soft: rgba(180, 83, 9, 0.12);");
    expect(c37).toContain("--shadow-raised: 0 12px 40px rgba(0, 0, 0, 0.14);");
  });

  it("declares both dark state colors and elevation", () => {
    expect(c37).toContain("--success: #4ADE80;");
    expect(c37).toContain("--danger: #F87171;");
    expect(c37).toContain("--accent-soft: rgba(232, 163, 61, 0.16);");
    expect(c37).toContain("--shadow-raised: 0 12px 40px rgba(0, 0, 0, 0.55);");
  });

  it("keeps the committed STEP 1 values unchanged", () => {
    expect(c37).toContain("--bg: #FAF9F7;");
    expect(c37).toContain("--accent: #B45309;");
    expect(c37).toContain("--bg: #141310;");
    expect(c37).toContain("--accent: #E8A33D;");
  });
});

describe("C38, C39, C45, C46 each state their whole rule", () => {
  it("C38 names all twelve theme tokens and --dur-slow as independent", () => {
    const c38 = criterion("C38");
    expect(c38).toContain("the twelve C37 names");
    for (const name of [
      "--success",
      "--danger",
      "--accent-soft",
      "--shadow-raised",
    ]) {
      expect(c38, name).toContain(name);
    }
    expect(c38).toMatch(/`--dur`,\s*\n?\s*`--dur-slow`, `--blur`/);
  });

  it("C39 covers success and danger, exempting fill and effect tokens", () => {
    const c39 = criterion("C39");
    expect(c39).toMatch(/`--success`, and `--danger` each reach a contrast/);
    expect(c39).toContain(">= 4.5:1");
    expect(c39).toMatch(
      /`--surface-glass`, `--accent-soft`, and `--shadow-raised` are fill and/
    );
  });

  it("C45 fixes four token definitions and two shadow declarations", () => {
    const c45 = criterion("C45");
    expect(c45).toContain("the four token definitions in tokens.css");
    expect(c45).toContain("box-shadow: var(--shadow-glass);");
    expect(c45).toContain("box-shadow: var(--shadow-raised);");
    expect(c45).toContain("Two elevations, two rules");
  });

  it("C46 fixes two durations, one keyframe, and reduced motion", () => {
    const c46 = criterion("C46");
    expect(c46).toContain("exactly two duration tokens");
    expect(c46).toContain("--dur: 150ms");
    expect(c46).toContain("--dur-slow: 300ms");
    expect(c46).toContain("named `reveal-in`");
    expect(c46).toContain("sets both");
    expect(c46).toContain("0ms");
  });
});

describe("STEP 3 leaves the untouched contracts alone", () => {
  it("does not stamp or amend C32, C53, or C68", () => {
    for (const c of ["C32", "C53", "C68"]) {
      expect(criterion(c), c).not.toContain("(Amended by STEP 3.)");
    }
  });

  it("keeps the C68 share string byte-identical", () => {
    expect(STEP3).toContain(
      "the C68 share string is byte-identical to its STEP 2\n    form"
    );
  });
});
