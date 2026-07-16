// W12.S2: the STEP 3 tokens plus the elevation, motion, and state styles
// built on them. The amended C37-C39 token values and the amended C45/C46
// counts are pinned in w1s2 (this slice rescoped them there); this suite
// pins what STEP 3 adds on top: the state rules, the raised surface, the
// reveal keyframe, and the chip fill.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const styles = stripComments(
  readFileSync(new URL("../docs/css/styles.css", import.meta.url), "utf8")
);
const tokens = stripComments(
  readFileSync(new URL("../docs/css/tokens.css", import.meta.url), "utf8")
);

function braceBlock(css, from) {
  const open = css.indexOf("{", from);
  if (open === -1) throw new Error("no opening brace");
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced braces");
}

function ruleBlock(css, selector) {
  let pos = 0;
  while (pos < css.length) {
    const open = css.indexOf("{", pos);
    if (open === -1) break;
    const selText = css.slice(css.lastIndexOf("}", open) + 1, open);
    if (selText.trim().startsWith("@")) {
      const inner = braceBlock(css, open);
      pos = open + inner.length + 2;
      continue;
    }
    const selectors = selText.split(",").map((s) => s.trim());
    const block = braceBlock(css, open);
    if (selectors.includes(selector)) return block;
    pos = open + block.length + 2;
  }
  return null;
}

describe("tokens.css STEP 3 additions", () => {
  it("declares the five new names, each exactly where it belongs", () => {
    // Theme names twice (light + dark); --dur-slow once (:root only).
    for (const name of [
      "--success",
      "--danger",
      "--accent-soft",
      "--shadow-raised",
    ]) {
      expect(tokens.match(new RegExp(`${name}\\s*:`, "g")), name).toHaveLength(2);
    }
    expect(tokens.match(/--dur-slow\s*:/g)).toHaveLength(1);
  });

  it("keeps every raw color in tokens.css only (C36)", () => {
    for (const name of ["--success", "--danger", "--accent-soft"]) {
      expect(styles).not.toMatch(new RegExp(`${name}\\s*:`));
    }
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/\brgba?\(/);
  });
});

describe("answer state rules (STEP 3)", () => {
  it("the correct card states in --success", () => {
    const block = ruleBlock(styles, "#game-cards button.card-correct");
    expect(block).not.toBeNull();
    expect(block).toContain("border-color: var(--success)");
    expect(block).toContain("outline: 2px solid var(--success)");
    expect(block).toContain("background: var(--accent-soft)");
  });

  it("the wrong card states in --danger", () => {
    const block = ruleBlock(styles, "#game-cards button.card-wrong");
    expect(block).not.toBeNull();
    expect(block).toContain("border-color: var(--danger)");
    expect(block).toContain("background: var(--accent-soft)");
  });

  it("neither state rule dims by opacity", () => {
    for (const sel of [
      "#game-cards button.card-correct",
      "#game-cards button.card-wrong",
    ]) {
      expect(ruleBlock(styles, sel), sel).not.toContain("opacity");
    }
  });

  it("the verdict line takes the matching state color", () => {
    expect(styles).toMatch(/\.game-verdict\.verdict-correct/);
    expect(styles).toMatch(/\.game-verdict\.verdict-wrong/);
  });
});

describe("results squares (STEP 3)", () => {
  it("render as token-colored blocks, not glyph-sized text", () => {
    const square = ruleBlock(styles, ".game-squares span");
    expect(square).not.toBeNull();
    expect(square).toMatch(/width\s*:\s*var\(--sp-\d\)/);
    expect(square).toMatch(/height\s*:\s*var\(--sp-\d\)/);
    expect(square).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
  });

  it("color by the data-correct attribute, success and danger", () => {
    expect(
      ruleBlock(styles, '.game-squares span[data-correct="true"]')
    ).toContain("background: var(--success)");
    expect(
      ruleBlock(styles, '.game-squares span[data-correct="false"]')
    ).toContain("background: var(--danger)");
  });
});

describe("elevation and motion (amended C45, C46)", () => {
  it("the raised shadow rule exists on exactly the two raised surfaces", () => {
    const raised = styles.match(
      /([^}]*)\{\s*box-shadow\s*:\s*var\(--shadow-raised\)\s*;\s*\}/
    );
    expect(raised).not.toBeNull();
    const selectors = raised[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    expect(selectors).toEqual([
      "#game-cards button.card-correct",
      "#model-overlay",
    ]);
  });

  it("exactly one keyframe, named reveal-in, fading opacity", () => {
    const names = styles.match(/@keyframes\s+([\w-]+)/g) ?? [];
    expect(names).toEqual(["@keyframes reveal-in"]);
    const start = styles.search(/@keyframes\s+reveal-in/);
    const block = braceBlock(styles, start);
    expect(block).toMatch(/opacity\s*:\s*0\s*;/);
    expect(block).toMatch(/opacity\s*:\s*1\s*;/);
  });

  it("reveal-in is used only on the reveal and card values, at --dur-slow", () => {
    const animations = [...styles.matchAll(/animation\s*:\s*([^;]+);/g)];
    expect(animations.length).toBeGreaterThan(0);
    for (const [, value] of animations) {
      expect(value).toBe("reveal-in var(--dur-slow) ease-out");
    }
  });

  it("reduced motion zeroes both durations", () => {
    const start = styles.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = braceBlock(styles, start);
    expect(block).toMatch(/--dur\s*:\s*0ms\s*;/);
    expect(block).toMatch(/--dur-slow\s*:\s*0ms\s*;/);
  });
});

describe("chip fill (STEP 3)", () => {
  it("the selected chip gains the accent-soft fill", () => {
    const block = ruleBlock(styles, ".chip:has(input:checked)");
    expect(block).not.toBeNull();
    expect(block).toContain("background: var(--accent-soft)");
  });
});
