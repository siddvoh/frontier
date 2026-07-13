// W5.S1: stylesheet remediation. Motion is scoped to color/border-color,
// form controls are token-styled, and the layout classes consumed by the
// view slices (.table-scroll, .filter-bar, .nowrap, .num, .bar-row,
// .tray-docked, .overlay-scrim, .timeline-track, .form-grid) exist with
// their contracted properties.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesCss = readFileSync(
  new URL("../docs/css/styles.css", import.meta.url),
  "utf8"
);
const styles = stylesCss.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------- helpers ----------

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

// ---------- motion scoping ----------

describe("motion scoping", () => {
  const transitions = [...styles.matchAll(/transition\s*:\s*([^;]+);/g)].map(
    (m) => m[1]
  );

  it("has at least one transition", () => {
    expect(transitions.length).toBeGreaterThan(0);
  });

  it("every transition animates only color or border-color", () => {
    for (const value of transitions) {
      for (const part of value.split(",")) {
        const prop = part.trim().split(/\s+/)[0];
        expect(["color", "border-color"], value).toContain(prop);
      }
    }
  });

  it("no transition targets opacity, background, or all", () => {
    for (const value of transitions) {
      expect(value).not.toMatch(/\bopacity\b/);
      expect(value).not.toMatch(/\bbackground\b/);
      expect(value).not.toMatch(/(^|[\s,])all(\s|,|$)/);
    }
  });

  it("button rule has no opacity transition", () => {
    const block = ruleBlock(styles, "button");
    expect(block).not.toBeNull();
    const transition = block.match(/transition\s*:\s*([^;]+);/);
    if (transition) {
      expect(transition[1]).not.toContain("opacity");
    }
  });

  it("tbody tr has no background transition (no transition at all)", () => {
    const block = ruleBlock(styles, "tbody tr");
    if (block !== null) {
      expect(block).not.toContain("transition");
    }
    const hover = ruleBlock(styles, "tbody tr:hover");
    if (hover !== null) {
      expect(hover).not.toContain("transition");
    }
  });
});

// ---------- token-styled form controls ----------

describe("token-styled form controls", () => {
  it("inputs/selects/textareas use surface, ink, hairline, radius tokens", () => {
    const block = ruleBlock(styles, "input");
    expect(block).not.toBeNull();
    expect(block).toContain("background: var(--surface-solid)");
    expect(block).toContain("color: var(--ink)");
    expect(block).toContain("border: 1px solid var(--hairline)");
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
    // The shared rule covers select and textarea too.
    expect(styles).toMatch(/input\s*,\s*select\s*,\s*textarea\s*\{/);
  });

  it("primary button is accent on tokens only", () => {
    const block = ruleBlock(styles, "button");
    expect(block).not.toBeNull();
    expect(block).toContain("background: var(--accent)");
    expect(block).toContain("color: var(--bg)");
    expect(block).toMatch(/border-radius\s*:\s*var\(--r-(s|m)\)/);
  });

  it("checkboxes take the accent color", () => {
    const block = ruleBlock(styles, 'input[type="checkbox"]');
    expect(block).not.toBeNull();
    expect(block).toContain("accent-color: var(--accent)");
  });

  it("focus-visible ring is an accent outline, not a box-shadow", () => {
    const block = ruleBlock(styles, ":focus-visible");
    expect(block).not.toBeNull();
    expect(block).toMatch(/outline\s*:\s*2px solid var\(--accent\)/);
    expect(block).not.toContain("box-shadow");
  });

  it("no raw colors outside tokens.css (C36)", () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/rgb/i);
    expect(styles).not.toMatch(/hsl/i);
  });
});

// ---------- layout classes ----------

describe("layout classes", () => {
  it(".table-scroll allows horizontal scroll inside the wrapper", () => {
    const block = ruleBlock(styles, ".table-scroll");
    expect(block).not.toBeNull();
    expect(block).toMatch(/overflow-x\s*:\s*auto/);
  });

  it(".filter-bar is a stacked grid, single row at >=720px", () => {
    const base = ruleBlock(styles, ".filter-bar");
    expect(base).not.toBeNull();
    expect(base).toMatch(/display\s*:\s*grid/);
    const wide = ruleBlock(mediaBlock, ".filter-bar");
    expect(wide).not.toBeNull();
    expect(wide).toMatch(/grid-auto-flow\s*:\s*column/);
  });

  it(".nowrap prevents wrapping (dates)", () => {
    const block = ruleBlock(styles, ".nowrap");
    expect(block).not.toBeNull();
    expect(block).toMatch(/white-space\s*:\s*nowrap/);
  });

  it(".num uses tabular figures for table cells", () => {
    const block = ruleBlock(styles, ".num");
    expect(block).not.toBeNull();
    expect(block).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
  });

  it(".bar-row is a three-column grid (name / bar / value)", () => {
    const block = ruleBlock(styles, ".bar-row");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*grid/);
    const cols = block.match(/grid-template-columns\s*:\s*([^;]+);/);
    expect(cols).not.toBeNull();
    expect(tracks(cols[1])).toHaveLength(3);
    expect(block).toMatch(/align-items\s*:\s*center/);
  });

  it(".form-grid stacks by default and pairs fields 2-up at >=720px", () => {
    const base = ruleBlock(styles, ".form-grid");
    expect(base).not.toBeNull();
    expect(base).toMatch(/display\s*:\s*grid/);
    const wide = ruleBlock(mediaBlock, ".form-grid");
    expect(wide).not.toBeNull();
    expect(tracks(wide.match(/grid-template-columns\s*:\s*([^;]+);/)[1]))
      .toHaveLength(2);
  });
});

// ---------- tray docking ----------

describe(".tray-docked", () => {
  it("is a full-width fixed bottom sheet below 720px", () => {
    const base = ruleBlock(styles, ".tray-docked");
    expect(base).not.toBeNull();
    expect(base).toMatch(/position\s*:\s*fixed/);
    expect(base).toMatch(/left\s*:\s*0/);
    expect(base).toMatch(/right\s*:\s*0/);
    expect(base).toMatch(/bottom\s*:\s*0/);
  });

  it("docks right at >=720px", () => {
    const wide = ruleBlock(mediaBlock, ".tray-docked");
    expect(wide).not.toBeNull();
    expect(wide).toMatch(/left\s*:\s*auto/);
    expect(wide).toMatch(/right\s*:\s*var\(--sp-\d\)/);
    expect(wide).toMatch(/max-width\s*:/);
  });

  it("gives the main content clearance so the tray never covers bars", () => {
    const clearance = styles.match(
      /body:has\(\.tray-docked[^{]*\)\s*#app\s*\{([^}]*)\}/
    );
    expect(clearance).not.toBeNull();
    expect(clearance[1]).toMatch(/padding-bottom\s*:\s*var\(--sp-\d\)/);
  });
});

// ---------- overlay scrim ----------

describe(".overlay-scrim", () => {
  const block = ruleBlock(styles, ".overlay-scrim");

  it("is a fixed full-viewport dim layer", () => {
    expect(block).not.toBeNull();
    expect(block).toMatch(/position\s*:\s*fixed/);
    for (const edge of ["top", "left", "right", "bottom"]) {
      expect(block).toMatch(new RegExp(`${edge}\\s*:\\s*0`));
    }
  });

  it("dims with var(--ink) plus opacity, no new tokens or glass", () => {
    expect(block).toContain("background: var(--ink)");
    expect(block).toMatch(/opacity\s*:\s*0?\.\d+/);
    expect(block).not.toContain("backdrop-filter");
    expect(block).not.toContain("box-shadow");
  });

  it("stacks under #model-overlay (z-index 20)", () => {
    const z = block.match(/z-index\s*:\s*(\d+)/);
    expect(z).not.toBeNull();
    expect(Number(z[1])).toBeLessThan(20);
  });
});

// ---------- timeline track ----------

describe(".timeline-track", () => {
  it("has two label lanes", () => {
    const block = ruleBlock(styles, ".timeline-track");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*grid/);
    const rows = block.match(/grid-template-rows\s*:\s*([^;]+);/);
    expect(rows).not.toBeNull();
    expect(tracks(rows[1])).toHaveLength(2);
  });

  it("draws a hairline axis between the lanes", () => {
    const axis = ruleBlock(styles, ".timeline-track::before");
    expect(axis).not.toBeNull();
    expect(axis).toMatch(/border-top\s*:\s*1px solid var\(--hairline\)/);
    expect(axis).toMatch(/position\s*:\s*absolute/);
  });
});

// ---------- unweakened W1.S2 invariants ----------

describe("W1.S2 invariants stay intact", () => {
  it("the only width media query is min-width: 720px", () => {
    const queries = [...styles.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]);
    for (const q of queries) {
      if (/width/.test(q)) {
        expect(q.trim()).toBe("(min-width: 720px)");
      }
    }
  });

  it("still exactly one box-shadow and one backdrop-filter declaration", () => {
    expect(styles.match(/box-shadow/g)).toHaveLength(1);
    // One @supports condition plus one declaration inside it.
    expect(styles.match(/backdrop-filter/g)).toHaveLength(2);
    expect(styles).not.toContain("gradient(");
  });
});
