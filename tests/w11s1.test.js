// W11.S1: stylesheet polish inside the frozen token set. The .chip-set/.chip
// contract replaces the organization multiselect look (accent border and text
// when checked), button states swap the opacity hover for background/border
// shifts (disabled buttons keep full opacity with hairline border and muted
// text; ghost buttons hover to an accent border), the .metric-card contract
// plus .delta/.better-lower annotations exist for the compare groups, and the
// game question becomes the hero via .game-prompt with #game-cards buttons
// restyled as ghost cards (accent reserved for the chosen/correct outlines,
// values revealed in-card via .card-value). All W1.S2/W5.S1/W7.S2/W10.S1
// stylesheet invariants stay pinned.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesCss = readFileSync(
  new URL("../docs/css/styles.css", import.meta.url),
  "utf8"
);
const styles = stylesCss.replace(/\/\*[\s\S]*?\*\//g, "");

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
      // Skip into the at-rule prelude; rules inside are scanned separately
      // via mediaBlock(), so jump past the whole conditional block.
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

// ---------- filter chips (.chip-set / .chip) ----------

describe("filter chip contract", () => {
  it(".chip-set is a wrapping flex row with token gap and no box chrome", () => {
    const block = ruleBlock(styles, ".chip-set");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*flex/);
    expect(block).toMatch(/flex-wrap\s*:\s*wrap/);
    expect(block).toMatch(/gap\s*:\s*var\(--sp-\d\)/);
    expect(block).toMatch(/margin\s*:\s*0\s*;/);
    expect(block).toMatch(/padding\s*:\s*0\s*;/);
  });

  it(".chip is a hairline chip on tokens only", () => {
    const block = ruleBlock(styles, ".chip");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*inline-flex/);
    expect(block).toContain("background: var(--surface-solid)");
    expect(block).toMatch(/border\s*:\s*1px solid var\(--hairline\)/);
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
    expect(block).toMatch(/font-size\s*:\s*var\(--text-1\)/);
    expect(block).toMatch(/padding\s*:\s*var\(--sp-\d\)\s+var\(--sp-\d\)/);
    expect(block).not.toContain("opacity");
  });

  it("a checked chip carries the accent border and text", () => {
    const block = ruleBlock(styles, ".chip:has(input:checked)");
    expect(block).not.toBeNull();
    expect(block).toContain("color: var(--accent)");
    expect(block).toContain("border-color: var(--accent)");
  });

  it("the chip state change rides a color/border-color transition only", () => {
    const block = ruleBlock(styles, ".chip");
    const transition = block.match(/transition\s*:\s*([^;]+);/);
    expect(transition).not.toBeNull();
    for (const part of transition[1].split(",")) {
      const prop = part.trim().split(/\s+/)[0];
      expect(["color", "border-color"]).toContain(prop);
      expect(part).toContain("var(--dur)");
      expect(part).toContain("ease-out");
    }
  });

  it("search, chips, toggle, and sort controls share one baseline at >=720px", () => {
    // The .filter-bar single-row grid bottom-aligns every control cell;
    // the chip set participates with zero margin of its own.
    const wide = ruleBlock(mediaBlock, ".filter-bar");
    expect(wide).not.toBeNull();
    expect(wide).toMatch(/grid-auto-flow\s*:\s*column/);
    expect(wide).toMatch(/align-items\s*:\s*end/);
    const chipSet = ruleBlock(styles, ".chip-set");
    expect(chipSet).toMatch(/margin\s*:\s*0\s*;/);
  });
});

// ---------- button states ----------

describe("button states", () => {
  it("the opacity hover is gone: no rule states opacity except the scrim", () => {
    // Rescoped for the amended C46 reveal-in keyframe, which legitimately
    // fades opacity. The invariant that matters is unchanged and asserted
    // more precisely: no button/state rule dims by opacity, and the scrim
    // is the only non-keyframe rule that touches it.
    const withoutKeyframes = styles.replace(
      /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
      ""
    );
    const uses = [...withoutKeyframes.matchAll(/opacity\s*:/g)];
    expect(uses).toHaveLength(1);
    const scrim = ruleBlock(styles, ".overlay-scrim");
    expect(scrim).not.toBeNull();
    expect(scrim).toMatch(/opacity\s*:\s*0?\.\d+/);
    for (const sel of [
      "button:hover:enabled",
      "button:disabled",
      "#game-cards button.card-correct",
      "#game-cards button.card-wrong",
    ]) {
      const block = ruleBlock(styles, sel);
      if (block !== null) expect(block, sel).not.toContain("opacity");
    }
  });

  it("hover is a background/border shift scoped to enabled buttons", () => {
    const block = ruleBlock(styles, "button:hover:enabled");
    expect(block).not.toBeNull();
    expect(block).toContain("background: var(--ink)");
    expect(block).toContain("border-color: var(--ink)");
    expect(block).toContain("color: var(--bg)");
    expect(block).not.toContain("opacity");
    // The shift rides the existing C46 transition set; no new transition.
    expect(block).not.toContain("transition");
  });

  it("disabled buttons get hairline border and muted text at full opacity", () => {
    const block = ruleBlock(styles, "button:disabled");
    expect(block).not.toBeNull();
    expect(block).toContain("color: var(--muted)");
    expect(block).toContain("border-color: var(--hairline)");
    expect(block).toContain("background: var(--surface-solid)");
    expect(block).toMatch(/cursor\s*:\s*default/);
    expect(block).not.toContain("opacity");
  });

  it("ghost buttons hover to an accent border, never the ink fill", () => {
    const base = ruleBlock(styles, "button.ghost");
    expect(base).not.toBeNull();
    expect(base).toContain("color: var(--ink)");
    expect(base).toContain("background: var(--surface-solid)");
    expect(base).toContain("border-color: var(--hairline)");
    const hover = ruleBlock(styles, "button.ghost:hover:enabled");
    expect(hover).not.toBeNull();
    expect(hover).toContain("border-color: var(--accent)");
    expect(hover).toContain("background: var(--surface-solid)");
    expect(hover).not.toContain("opacity");
    expect(hover).not.toContain("transition");
  });

  it("the base button rule still transitions color and border-color only", () => {
    const block = ruleBlock(styles, "button");
    expect(block).not.toBeNull();
    const transition = block.match(/transition\s*:\s*([^;]+);/);
    expect(transition).not.toBeNull();
    const props = transition[1]
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .sort();
    expect(props).toEqual(["border-color", "color"]);
  });
});

// ---------- compare metric cards ----------

describe("metric card contract", () => {
  it(".metric-card is a solid hairline card with --r-m and --sp-4", () => {
    const block = ruleBlock(styles, ".metric-card");
    expect(block).not.toBeNull();
    expect(block).toContain("background: var(--surface-solid)");
    expect(block).toMatch(/border\s*:\s*1px solid var\(--hairline\)/);
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-m\)/);
    expect(block).toMatch(/padding\s*:\s*var\(--sp-4\)/);
    expect(block).not.toContain("box-shadow");
    expect(block).not.toContain("backdrop-filter");
  });

  it(".delta and .better-lower are muted --text-1 annotations", () => {
    for (const sel of [".delta", ".better-lower"]) {
      const block = ruleBlock(styles, sel);
      expect(block, sel).not.toBeNull();
      expect(block, sel).toContain("color: var(--muted)");
      expect(block, sel).toMatch(/font-size\s*:\s*var\(--text-1\)/);
    }
  });
});

// ---------- game: focal prompt, ghost cards, in-card values ----------

describe("game question styles", () => {
  it(".game-prompt is the hero: display face at --text-4 in ink", () => {
    const block = ruleBlock(styles, ".game-prompt");
    expect(block).not.toBeNull();
    expect(block).toContain("font-family: var(--font-display)");
    expect(block).toMatch(/font-size\s*:\s*var\(--text-4\)/);
    expect(block).toMatch(/line-height\s*:\s*var\(--lh-(body|head)\)/);
    expect(block).toContain("color: var(--ink)");
  });

  it("#game-cards buttons are ghost cards keeping the C71 tap target", () => {
    const block = ruleBlock(styles, "#game-cards button");
    expect(block).not.toBeNull();
    expect(block).toContain("color: var(--ink)");
    expect(block).toContain("background: var(--surface-solid)");
    expect(block).toContain("border-color: var(--hairline)");
    // C71 stays byte-for-byte: full column width, --sp-8 min-height.
    expect(block).toMatch(/width\s*:\s*100%/);
    expect(block).toMatch(/min-height\s*:\s*var\(--sp-8\)/);
    // Accent stays reserved for the state outlines below.
    expect(block).not.toContain("var(--accent)");
  });

  it("enabled option cards hover to an accent border", () => {
    const block = ruleBlock(styles, "#game-cards button:hover:enabled");
    expect(block).not.toBeNull();
    expect(block).toContain("border-color: var(--accent)");
    expect(block).not.toContain("transition");
  });

  it("the chosen card presses to an accent border", () => {
    const block = ruleBlock(styles, "#game-cards button.card-picked");
    expect(block).not.toBeNull();
    expect(block).toContain("border-color: var(--accent)");
  });

  it("the correct card carries a state outline, stated once", () => {
    // STEP 3 moved the outline from --accent to --success; the invariant
    // (a 2px state outline on the correct card, declared in exactly one
    // rule) is unchanged. Its box-shadow is the amended C45 raised rule,
    // pinned by selector list in w1s2/w12s2, so it is not banned here.
    const block = ruleBlock(styles, "#game-cards button.card-correct");
    expect(block).not.toBeNull();
    expect(block).toMatch(/outline\s*:\s*2px solid var\(--success\)/);
    expect(block).not.toContain("box-shadow");
    // Exactly one rule whose selector list is only this card state. It also
    // appears as one member of the shared --shadow-raised selector list,
    // which w1s2/w12s2 pin by exact list; that is not a duplicate state rule.
    const standalone = styles.match(
      /(^|\})\s*#game-cards button\.card-correct\s*\{/g
    );
    expect(standalone).toHaveLength(1);
  });

  it(".card-value renders in-card reveal values as a tabular block", () => {
    const block = ruleBlock(styles, ".card-value");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*block/);
    expect(block).toMatch(/font-size\s*:\s*var\(--text-[1-6]\)/);
    expect(block).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
    expect(block).toContain("color: var(--ink)");
  });
});

// ---------- pinned W1.S2/W5.S1/W7.S2/W10.S1 invariants ----------

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

  it("still exactly one min-width: 720px media query, no other width query", () => {
    expect(styles.match(/@media\s*\(min-width:\s*720px\)/g)).toHaveLength(1);
    const queries = [...styles.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]);
    for (const q of queries) {
      if (/width/.test(q)) {
        expect(q.trim()).toBe("(min-width: 720px)");
      }
    }
  });

  it("still no raw colors and no gradient in styles.css", () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/rgb/i);
    expect(styles).not.toMatch(/hsl/i);
    expect(styles).not.toMatch(/color-mix/i);
    expect(styles).not.toContain("gradient(");
  });

  it("every transition still animates only color, border-color, or the card press", () => {
    // Narrowed by W13.S1 for the game card press-in (transform), which
    // w5s1 pins to `#game-cards button` alone. The opacity/background/all
    // bans that keep hover and re-render flicker out are unchanged.
    const transitions = [...styles.matchAll(/transition\s*:\s*([^;]+);/g)];
    expect(transitions.length).toBeGreaterThan(0);
    for (const [, value] of transitions) {
      for (const part of value.split(",")) {
        const prop = part.trim().split(/\s+/)[0];
        expect(["color", "border-color", "transform"], value).toContain(prop);
      }
      expect(value).not.toMatch(/\bopacity\b/);
      expect(value).not.toMatch(/\bbackground\b/);
      expect(value).not.toMatch(/(^|[\s,])all(\s|,|$)/);
    }
  });

  it("the new W11.S1 rules add no box chrome or motion beyond the chip", () => {
    for (const sel of [
      ".chip-set",
      ".chip:has(input:checked)",
      "button:hover:enabled",
      "button:disabled",
      "button.ghost:hover:enabled",
      ".metric-card",
      ".delta",
      ".better-lower",
      ".game-prompt",
      "#game-cards button:hover:enabled",
      "#game-cards button.card-picked",
      "#game-cards button.card-correct",
      ".card-value",
    ]) {
      const block = ruleBlock(styles, sel);
      expect(block, sel).not.toBeNull();
      expect(block, sel).not.toContain("transition");
      expect(block, sel).not.toContain("box-shadow");
      expect(block, sel).not.toContain("backdrop-filter");
    }
  });
});
