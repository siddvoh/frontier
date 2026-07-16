// W13.S1: reveal choreography. The chosen card presses in, the correct card
// lifts on --shadow-raised with its --success edge, and the in-card values
// fade in staggered at --dur-slow. Every duration and delay is a token, so
// the single reduced-motion block collapses the whole sequence to instant
// states. The amended C45/C46 counts are pinned in w1s2/w12s2; this suite
// pins the motion this wave adds.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const styles = stripComments(
  readFileSync(new URL("../docs/css/styles.css", import.meta.url), "utf8")
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

describe("the cards move on state, not on hover", () => {
  it("cards have a resting transform and transition it on a token duration", () => {
    const block = ruleBlock(styles, "#game-cards button");
    expect(block).not.toBeNull();
    expect(block).toMatch(/transform\s*:\s*translateY\(0\) scale\(1\)/);
    const transition = block.match(/transition\s*:\s*([^;]+);/);
    expect(transition).not.toBeNull();
    expect(transition[1]).toContain("transform var(--dur) ease-out");
  });

  it("the chosen card presses in", () => {
    const block = ruleBlock(styles, "#game-cards button.card-picked");
    expect(block).not.toBeNull();
    expect(block).toMatch(/transform\s*:\s*translateY\(0\) scale\(0?\.\d+\)/);
  });

  it("the correct card lifts, on a spacing token, never a raw length", () => {
    const block = ruleBlock(styles, "#game-cards button.card-correct");
    expect(block).not.toBeNull();
    expect(block).toMatch(
      /transform\s*:\s*translateY\(calc\(-1 \* var\(--sp-\d\)\)\) scale\(1\)/
    );
  });

  it("the lift pairs with the success edge and the raised shadow", () => {
    const state = ruleBlock(styles, "#game-cards button.card-correct");
    expect(state).toContain("outline: 2px solid var(--success)");
    const raised = styles.match(
      /([^}]*)\{\s*box-shadow\s*:\s*var\(--shadow-raised\)\s*;\s*\}/
    );
    expect(raised).not.toBeNull();
    expect(raised[1]).toContain("#game-cards button.card-correct");
  });
});

describe("the values fade in, staggered", () => {
  it("every in-card value fades, whichever card it sits on", () => {
    // Scoped to #game-cards .card-value, so the value on an unpicked,
    // incorrect card animates exactly like the others.
    const block = ruleBlock(styles, "#game-cards .card-value");
    expect(block).not.toBeNull();
    expect(block).toMatch(/animation\s*:\s*reveal-in var\(--dur-slow\) ease-out/);
  });

  it("the reveal panel fades on the same keyframe", () => {
    const block = ruleBlock(styles, ".game-reveal");
    expect(block).not.toBeNull();
    expect(block).toMatch(/animation\s*:\s*reveal-in var\(--dur-slow\) ease-out/);
  });

  it("the second card's value lands one --dur after the first", () => {
    const first = ruleBlock(styles, "#game-cards button:first-child .card-value");
    const second = ruleBlock(styles, "#game-cards button:nth-child(2) .card-value");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).toMatch(/animation-delay\s*:\s*0ms/);
    expect(second).toMatch(/animation-delay\s*:\s*var\(--dur\)/);
  });

  it("no delay is a literal duration: reduced motion must reach them all", () => {
    const delays = [...styles.matchAll(/animation-delay\s*:\s*([^;]+);/g)];
    expect(delays.length).toBeGreaterThan(0);
    for (const [, value] of delays) {
      expect(value.trim()).toMatch(/^(0ms|var\(--dur(-slow)?\))$/);
    }
  });
});

describe("reduced motion collapses the sequence", () => {
  it("zeroes both durations in the single block", () => {
    const blocks = styles.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g);
    expect(blocks).toHaveLength(1);
    const start = styles.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = braceBlock(styles, start);
    expect(block).toMatch(/--dur\s*:\s*0ms\s*;/);
    expect(block).toMatch(/--dur-slow\s*:\s*0ms\s*;/);
  });

  it("leaves the state itself intact: the transforms are not motion-gated", () => {
    // Reduced motion removes the tweening, never the answer. The state
    // rules live outside the reduced-motion block.
    const start = styles.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = braceBlock(styles, start);
    expect(block).not.toContain("card-correct");
    expect(block).not.toContain("card-picked");
  });
});
