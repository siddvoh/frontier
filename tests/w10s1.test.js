// W10.S1: stylesheet remediation for the live-UI audit defects. The
// .scenario-ranked class contract lays out scenario.js's rank / model-name /
// ranking-value / cost-formula spans as separate cells (suppressing the ol
// marker that duplicated the .rank span), the #site-header nav is contained
// below 720px so the page body never scrolls horizontally at 375px, and the
// .timeline-tick contract exists for the W10.S4 timeline markup. All
// W1.S2/W5.S1/W7.S2 stylesheet invariants stay pinned.
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

// ---------- scenario ranked results contract ----------

describe(".scenario-ranked list", () => {
  it("suppresses the ol marker (the .rank span already shows the rank)", () => {
    const block = ruleBlock(styles, ".scenario-ranked");
    expect(block).not.toBeNull();
    expect(block).toMatch(/list-style\s*:\s*none/);
    expect(block).toMatch(/padding\s*:\s*0/);
  });

  it("lays each entry out as a grid of cells, stacked below 720px", () => {
    const block = ruleBlock(styles, ".scenario-ranked li");
    expect(block).not.toBeNull();
    expect(block).toMatch(/display\s*:\s*grid/);
    expect(block).toMatch(/border-bottom\s*:\s*1px solid var\(--hairline\)/);
  });

  it("widens each entry into a multi-column grid at >=720px", () => {
    const wide = ruleBlock(mediaBlock, ".scenario-ranked li");
    expect(wide).not.toBeNull();
    const cols = wide.match(/grid-template-columns\s*:\s*([^;]+);/);
    expect(cols).not.toBeNull();
    expect(tracks(cols[1]).length).toBeGreaterThanOrEqual(3);
  });

  it("defines a cell rule for each scenario.js span class", () => {
    for (const sel of [
      ".scenario-ranked .rank",
      ".scenario-ranked .model-name",
      ".scenario-ranked .ranking-value",
      ".scenario-ranked .cost-formula",
    ]) {
      expect(ruleBlock(styles, sel), sel).not.toBeNull();
    }
  });

  it("places the ranking value and formula in their own >=720px cells", () => {
    const value = ruleBlock(mediaBlock, ".scenario-ranked .ranking-value");
    expect(value).not.toBeNull();
    expect(value).toMatch(/grid-column\s*:/);
    const formula = ruleBlock(mediaBlock, ".scenario-ranked .cost-formula");
    expect(formula).not.toBeNull();
    expect(formula).toMatch(/grid-column\s*:/);
  });

  it(".rank renders in tabular figures", () => {
    const block = ruleBlock(styles, ".scenario-ranked .rank");
    expect(block).not.toBeNull();
    expect(block).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);
  });

  it(".cost-formula is small muted text (--text-1 and --muted)", () => {
    const block = ruleBlock(styles, ".scenario-ranked .cost-formula");
    expect(block).not.toBeNull();
    expect(block).toContain("color: var(--muted)");
    expect(block).toMatch(/font-size\s*:\s*var\(--text-1\)/);
  });
});

// ---------- header nav containment ----------

describe("#site-header nav containment", () => {
  it("scopes horizontal overflow to the nav, not the page body", () => {
    const nav = ruleBlock(styles, "#site-header nav");
    expect(nav).not.toBeNull();
    expect(nav).toMatch(/overflow-x\s*:\s*auto/);
    // Neither html nor body gains any overflow handling: the page body
    // must never scroll horizontally at 375px.
    const body = ruleBlock(styles, "body");
    expect(body).not.toBeNull();
    expect(body).not.toContain("overflow");
    const html = ruleBlock(styles, "html");
    if (html !== null) {
      expect(html).not.toContain("overflow");
    }
    const header = ruleBlock(styles, "#site-header");
    expect(header).not.toBeNull();
    expect(header).not.toContain("overflow");
  });

  it("tightens header gaps below 720px, restoring them in the media query", () => {
    const header = ruleBlock(styles, "#site-header");
    expect(header).toMatch(/gap\s*:\s*var\(--sp-[1-3]\)/);
    const nav = ruleBlock(styles, "#site-header nav");
    expect(nav).toMatch(/gap\s*:\s*var\(--sp-[1-2]\)/);
    const wideHeader = ruleBlock(mediaBlock, "#site-header");
    expect(wideHeader).not.toBeNull();
    expect(wideHeader).toMatch(/gap\s*:\s*var\(--sp-4\)/);
  });

  it("keeps the header links on one line so they scroll instead of wrap", () => {
    const links = ruleBlock(styles, "#site-header nav a");
    expect(links).not.toBeNull();
    expect(links).toMatch(/white-space\s*:\s*nowrap/);
    // The Game link is a direct #site-header child AFTER the nav (W7.S1),
    // so it needs its own rule; it must never join the nav rule list.
    const game = ruleBlock(styles, '#site-header > a[data-nav="game"]');
    expect(game).not.toBeNull();
    expect(game).toMatch(/white-space\s*:\s*nowrap/);
  });
});

// ---------- timeline tick contract (consumed by W10.S4) ----------

describe(".timeline-tick", () => {
  const block = ruleBlock(styles, ".timeline-tick");

  it("is an absolutely positioned muted --text-1 year label", () => {
    expect(block).not.toBeNull();
    expect(block).toMatch(/position\s*:\s*absolute/);
    expect(block).toContain("color: var(--muted)");
    expect(block).toMatch(/font-size\s*:\s*var\(--text-1\)/);
  });

  it("draws its rule as a hairline border, never a box-shadow", () => {
    expect(block).toMatch(/border[\w-]*\s*:\s*1px solid var\(--hairline\)/);
    expect(block).not.toContain("box-shadow");
  });
});

// ---------- pinned W1.S2/W5.S1/W7.S2 invariants ----------

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

  it("the W10.S1 rules add no transitions (motion stays scoped per W5.S1)", () => {
    for (const sel of [
      ".scenario-ranked",
      ".scenario-ranked li",
      ".scenario-ranked .rank",
      ".scenario-ranked .model-name",
      ".scenario-ranked .ranking-value",
      ".scenario-ranked .cost-formula",
      "#site-header nav",
      "#site-header nav a",
      '#site-header > a[data-nav="game"]',
      ".timeline-tick",
    ]) {
      const block = ruleBlock(styles, sel);
      expect(block, sel).not.toBeNull();
      expect(block, sel).not.toContain("transition");
    }
  });
});
