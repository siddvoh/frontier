// W7.S2: game styles from existing tokens only (C71, C72, C73).
// #game-cards / #game-results are token-styled glass hosts (glass itself
// arrives only via the .glass class in Wave 8 markup), option buttons are
// thumb-tappable full-width cards, and the progress/reveal/next/squares/copy
// class contract exists for the Wave 8 views. All W1.S2/W5.S1 stylesheet
// invariants stay pinned.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesCss = readFileSync(
  new URL("../docs/css/styles.css", import.meta.url),
  "utf8"
);
const tokensCss = readFileSync(
  new URL("../docs/css/tokens.css", import.meta.url),
  "utf8"
);
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const styles = stripComments(stylesCss);
const tokens = stripComments(tokensCss);

// ---------- helpers (same conventions as w5s1) ----------

/** Content between the braces starting at the first `{` at or after `from`. */
function braceBlock(css, from) {
  const open = css.indexOf("{", from);
  if (open === -1) throw new Error("no opening brace found");
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

/**
 * Return the declaration block for the first rule in `css` whose selector
 * list contains `selector` as an exact comma-separated entry.
 */
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

const mediaStart = styles.search(/@media\s*\(min-width:\s*720px\)/);
const mediaBlock = mediaStart === -1 ? "" : braceBlock(styles, mediaStart);

/** Split a track list on top-level whitespace (spaces inside parens kept). */
function tracks(value) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- #game-cards host (C71, amended C43) ----------

describe("#game-cards", () => {
  const block = ruleBlock(styles, "#game-cards");

  it("is a stacked grid card container on tokens only", () => {
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*grid/);
    expect(block).toMatch(/gap\s*:\s*var\(--sp-\d\)/);
    expect(block).toMatch(/border\s*:\s*1px solid var\(--hairline\)/);
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
    expect(block).toMatch(/padding\s*:\s*var\(--sp-\d\)/);
  });

  it("carries no glass of its own (glass arrives via the .glass class)", () => {
    expect(block).not.toContain("background");
    expect(block).not.toContain("box-shadow");
    expect(block).not.toContain("backdrop-filter");
  });

  it("goes two-up at >=720px inside the single media query", () => {
    const wide = ruleBlock(mediaBlock, "#game-cards");
    expect(wide).not.toBeNull();
    const cols = wide.match(/grid-template-columns\s*:\s*([^;]+);/);
    expect(cols).not.toBeNull();
    expect(tracks(cols[1])).toHaveLength(2);
  });
});

// ---------- option buttons (C71) ----------

describe("#game-cards option buttons", () => {
  it("tokens.css defines --sp-8 for the tap-target height", () => {
    expect(tokens).toMatch(/--sp-8\s*:/);
  });

  it("are full column width with min-height var(--sp-8)", () => {
    const block = ruleBlock(styles, "#game-cards button");
    expect(block).not.toBeNull();
    expect(block).toMatch(/width\s*:\s*100%/);
    expect(block).toMatch(/min-height\s*:\s*var\(--sp-8\)/);
  });

  it("reuse the global accent :focus-visible outline, no box-shadow ring", () => {
    const focus = ruleBlock(styles, ":focus-visible");
    expect(focus).not.toBeNull();
    expect(focus).toMatch(/outline\s*:\s*2px solid var\(--accent\)/);
    // No game-specific focus rule overrides or shadows it.
    expect(styles).not.toMatch(/#game-[\w-]*[^{]*:focus/);
    const buttons = ruleBlock(styles, "#game-cards button");
    expect(buttons).not.toContain("outline");
    expect(buttons).not.toContain("box-shadow");
  });
});

// ---------- progress / reveal / next (C71) ----------

describe("question-screen classes", () => {
  it(".game-progress is a muted small-text tabular counter", () => {
    const block = ruleBlock(styles, ".game-progress");
    expect(block).not.toBeNull();
    expect(block).toContain("color: var(--muted)");
    expect(block).toMatch(/font-size\s*:\s*var\(--text-[1-6]\)/);
    expect(block).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
  });

  it(".game-reveal is a hairline-bordered token panel", () => {
    const block = ruleBlock(styles, ".game-reveal");
    expect(block).not.toBeNull();
    expect(block).toMatch(/border\s*:\s*1px solid var\(--hairline\)/);
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
    expect(block).toMatch(/padding\s*:\s*var\(--sp-\d\)/);
  });

  it(".game-next exists with token spacing only", () => {
    const block = ruleBlock(styles, ".game-next");
    expect(block).not.toBeNull();
    expect(block).toMatch(/margin\s*:\s*[0\sauto]*var\(--sp-\d\)[0\sauto]*/);
  });
});

// ---------- #game-results, squares, copy (C72, amended C43) ----------

describe("#game-results screen", () => {
  const block = ruleBlock(styles, "#game-results");

  it("is a hairline-bordered token panel", () => {
    expect(block).not.toBeNull();
    expect(block).toMatch(/border\s*:\s*1px solid var\(--hairline\)/);
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
    expect(block).toMatch(/padding\s*:\s*var\(--sp-\d\)/);
  });

  it("carries no glass of its own (glass arrives via the .glass class)", () => {
    expect(block).not.toContain("background");
    expect(block).not.toContain("box-shadow");
    expect(block).not.toContain("backdrop-filter");
  });

  it(".game-squares is a token-gapped row", () => {
    const squares = ruleBlock(styles, ".game-squares");
    expect(squares).not.toBeNull();
    expect(squares).toMatch(/display\s*:\s*flex/);
    expect(squares).toMatch(/gap\s*:\s*var\(--sp-\d\)/);
    expect(squares).toMatch(/font-size\s*:\s*var\(--text-[1-6]\)/);
  });

  it(".game-copy exists with token spacing only", () => {
    const copy = ruleBlock(styles, ".game-copy");
    expect(copy).not.toBeNull();
    expect(copy).toMatch(/margin\s*:\s*[0\sauto]*var\(--sp-\d\)[0\sauto]*/);
  });
});

// ---------- W1.S2 / W5.S1 invariants stay pinned (C73, C44, C45) ----------

describe("stylesheet invariants stay pinned", () => {
  it("box-shadow is the two token references, backdrop-filter unchanged", () => {
    // Amended C45: the glass shadow plus the one --shadow-raised rule.
    expect(styles.match(/box-shadow/g)).toHaveLength(2);
    expect(
      styles.match(/box-shadow\s*:\s*var\(--shadow-glass\)\s*;/g)
    ).toHaveLength(1);
    expect(
      styles.match(/box-shadow\s*:\s*var\(--shadow-raised\)\s*;/g)
    ).toHaveLength(1);
    expect(styles.match(/backdrop-filter/g)).toHaveLength(2);
  });

  it("still no gradient anywhere in docs/css (C42)", () => {
    expect(styles).not.toContain("gradient(");
    expect(tokens).not.toContain("gradient(");
  });

  it("still exactly one min-width: 720px media query, no other width query", () => {
    expect(styles.match(/@media\s*\(min-width:\s*720px\)/g)).toHaveLength(1);
    const queries = [...styles.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]);
    for (const q of queries) {
      if (/width/.test(q)) {
        expect(q.trim()).toBe("(min-width: 720px)");
      }
    }
  });

  it("still no raw colors in styles.css (C36)", () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/rgb/i);
    expect(styles).not.toMatch(/hsl/i);
    expect(styles).not.toMatch(/color-mix/i);
  });

  it("game rules add no transitions beyond the card press (W5.S1 scoping)", () => {
    for (const sel of [
      "#game-cards",
      ".game-progress",
      ".game-reveal",
      ".game-next",
      "#game-results",
      ".game-squares",
      ".game-copy",
    ]) {
      const block = ruleBlock(styles, sel);
      expect(block, sel).not.toBeNull();
      expect(block, sel).not.toContain("transition");
    }
    // The one exception, added by W13.S1: the answer card presses in.
    // It transitions color, border-color, and transform, nothing else.
    const card = ruleBlock(styles, "#game-cards button");
    expect(card).not.toBeNull();
    const transition = card.match(/transition\s*:\s*([^;]+);/);
    expect(transition).not.toBeNull();
    expect(
      transition[1].split(",").map((p) => p.trim().split(/\s+/)[0])
    ).toEqual(["color", "border-color", "transform"]);
  });
});
