// W1.S2: design tokens and base stylesheet (C36-C42, C44-C47).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(
  new URL("../docs/css/tokens.css", import.meta.url),
  "utf8"
);
const stylesCss = readFileSync(
  new URL("../docs/css/styles.css", import.meta.url),
  "utf8"
);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = stripComments(tokensCss);
const styles = stripComments(stylesCss);

// ---------- helpers ----------

/** Return the content between the braces starting at the first `{` at or after `from`. */
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

/** Parse `--name: value;` declarations from a block into a Map. */
function parseDecls(block) {
  const map = new Map();
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

const rootStart = tokens.search(/:root\s*\{/);
const darkStart = tokens.search(/@media\s*\(prefers-color-scheme:\s*dark\)/);
const rootDecls = parseDecls(braceBlock(tokens, rootStart));
const darkDecls = parseDecls(darkStart === -1 ? "" : braceBlock(tokens, darkStart));

// The theme set is twelve names as of the STEP 3 amendment to C37/C38:
// the eight STEP 1 names plus the four state/elevation additions.
const THEME = [
  "--bg",
  "--surface-glass",
  "--surface-solid",
  "--ink",
  "--muted",
  "--hairline",
  "--accent",
  "--shadow-glass",
  "--success",
  "--danger",
  "--accent-soft",
  "--shadow-raised",
];

const LIGHT = {
  "--bg": "#FAF9F7",
  "--surface-glass": "rgba(255, 255, 255, 0.62)",
  "--surface-solid": "#FFFFFF",
  "--ink": "#1A1815",
  "--muted": "#6B675F",
  "--hairline": "#E5E2DC",
  "--accent": "#B45309",
  "--shadow-glass": "0 4px 24px rgba(0, 0, 0, 0.08)",
  "--success": "#15803D",
  "--danger": "#B91C1C",
  "--accent-soft": "rgba(180, 83, 9, 0.12)",
  "--shadow-raised": "0 12px 40px rgba(0, 0, 0, 0.14)",
};

const DARK = {
  "--bg": "#141310",
  "--surface-glass": "rgba(32, 30, 26, 0.62)",
  "--surface-solid": "#201E1A",
  "--ink": "#ECEAE4",
  "--muted": "#98948A",
  "--hairline": "#2E2B26",
  "--accent": "#E8A33D",
  "--shadow-glass": "0 4px 24px rgba(0, 0, 0, 0.40)",
  "--success": "#4ADE80",
  "--danger": "#F87171",
  "--accent-soft": "rgba(232, 163, 61, 0.16)",
  "--shadow-raised": "0 12px 40px rgba(0, 0, 0, 0.55)",
};

const INDEPENDENT = [
  "--font-display",
  "--font-text",
  "--text-1",
  "--text-2",
  "--text-3",
  "--text-4",
  "--text-5",
  "--text-6",
  "--lh-body",
  "--lh-head",
  "--sp-1",
  "--sp-2",
  "--sp-3",
  "--sp-4",
  "--sp-5",
  "--sp-6",
  "--sp-7",
  "--sp-8",
  "--r-s",
  "--r-m",
  "--dur",
  "--dur-slow",
  "--blur",
];

// ---------- WCAG contrast (C39) ----------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- tokens.css: C37 exact values ----------

describe("tokens.css theme values (C37)", () => {
  it("declares the exact light values in :root", () => {
    for (const [name, value] of Object.entries(LIGHT)) {
      expect(rootDecls.get(name), name).toBe(value);
    }
  });

  it("declares the exact dark values in one prefers-color-scheme block", () => {
    const darkBlocks = tokens.match(/@media\s*\(prefers-color-scheme:\s*dark\)/g);
    expect(darkBlocks).toHaveLength(1);
    for (const [name, value] of Object.entries(DARK)) {
      expect(darkDecls.get(name), name).toBe(value);
    }
  });
});

// ---------- tokens.css: C38 parity ----------

describe("tokens.css theme parity (C38)", () => {
  it("dark block declares exactly the twelve theme names", () => {
    expect([...darkDecls.keys()].sort()).toEqual([...THEME].sort());
  });

  it(":root declares all twelve theme names", () => {
    for (const name of THEME) {
      expect(rootDecls.has(name), name).toBe(true);
    }
  });

  it("theme-independent tokens are declared once, in :root only", () => {
    for (const name of INDEPENDENT) {
      expect(rootDecls.has(name), `${name} in :root`).toBe(true);
      expect(darkDecls.has(name), `${name} not in dark`).toBe(false);
      const uses = tokens.match(new RegExp(`${name}\\s*:`, "g")) || [];
      expect(uses, `${name} declared once`).toHaveLength(1);
    }
  });

  it("theme names are declared only in the :root and dark blocks", () => {
    // Each is in :root and in the dark block (asserted above), so "only
    // there" means exactly two declarations in the whole file.
    for (const name of THEME) {
      const decls = tokens.match(new RegExp(`${name}\\s*:`, "g")) || [];
      expect(decls, name).toHaveLength(2);
    }
  });
});

// ---------- C39 contrast ----------

describe("contrast ratios (C39)", () => {
  // --accent-soft and --shadow-raised are fill/effect tokens, outside the
  // text-contrast rule (STEP 3 amendment), exactly like --surface-glass.
  for (const [theme, set] of [["light", LIGHT], ["dark", DARK]]) {
    for (const fg of ["--ink", "--muted", "--accent", "--success", "--danger"]) {
      for (const bg of ["--surface-solid", "--bg"]) {
        it(`${theme}: ${fg} vs ${bg} >= 4.5:1`, () => {
          expect(contrastRatio(set[fg], set[bg])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

// ---------- styles.css: C36, C40, C41, C42 ----------

describe("styles.css token discipline (C36, C40, C41, C42)", () => {
  it("contains no raw color values (C36)", () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(styles).not.toMatch(/rgb/i);
    expect(styles).not.toMatch(/hsl/i);
    expect(styles).not.toMatch(/color-mix/i);
  });

  it("contains no gradient anywhere in docs/css (C42)", () => {
    expect(styles).not.toContain("gradient(");
    expect(tokens).not.toContain("gradient(");
  });

  it("uses only the six text tokens for font-size (C40)", () => {
    const sizes = [...styles.matchAll(/font-size\s*:\s*([^;]+);/g)];
    expect(sizes.length).toBeGreaterThan(0);
    for (const [, value] of sizes) {
      expect(value.trim()).toMatch(/^var\(--text-[1-6]\)$/);
    }
  });

  it("uses only the two line-height tokens (C40)", () => {
    const lhs = [...styles.matchAll(/line-height\s*:\s*([^;]+);/g)];
    expect(lhs.length).toBeGreaterThan(0);
    for (const [, value] of lhs) {
      expect(value.trim()).toMatch(/^var\(--lh-(body|head)\)$/);
    }
  });

  it("loads no webfont (C40)", () => {
    for (const css of [styles, tokens]) {
      expect(css).not.toContain("@font-face");
      expect(css).not.toContain("fonts.googleapis");
      expect(css).not.toContain(".woff");
    }
  });

  it("uses only spacing tokens, 0, or auto for margin/padding/gap (C41)", () => {
    const decls = [
      ...styles.matchAll(
        /(?:^|[{;])\s*((?:margin|padding)(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap)\s*:\s*([^;{}]+);/g
      ),
    ];
    expect(decls.length).toBeGreaterThan(0);
    for (const [, prop, value] of decls) {
      for (const part of value.trim().split(/\s+/)) {
        expect(part, `${prop}: ${value}`).toMatch(
          /^(0|auto|var\(--sp-[1-8]\))$/
        );
      }
    }
  });

  it("uses only the two radius tokens for border-radius (C41)", () => {
    const radii = [...styles.matchAll(/border-radius\s*:\s*([^;]+);/g)];
    expect(radii.length).toBeGreaterThan(0);
    for (const [, value] of radii) {
      expect(value.trim()).toMatch(/^var\(--r-(s|m)\)$/);
    }
  });
});

// ---------- styles.css: glass (C44, C45) ----------

describe("glass rules (C44, C45)", () => {
  const supportsStart = styles.search(
    /@supports\s*\(backdrop-filter:\s*blur\(12px\)\)/
  );

  it("base .glass rule uses the solid surface and the single shadow", () => {
    const base = styles.slice(0, supportsStart);
    const glass = base.match(/\.glass\s*\{([^}]*)\}/);
    expect(glass).not.toBeNull();
    expect(glass[1]).toContain("background: var(--surface-solid)");
    expect(glass[1]).toContain("box-shadow: var(--shadow-glass)");
  });

  it("box-shadow appears exactly twice, both token references (amended C45)", () => {
    // STEP 3: the glass shadow plus exactly one --shadow-raised
    // declaration on the raised surfaces. Nothing else may shadow.
    const uses = styles.match(/box-shadow/g);
    expect(uses).toHaveLength(2);
    expect(styles).toMatch(/box-shadow\s*:\s*var\(--shadow-glass\)\s*;/);
    const raised = styles.match(/box-shadow\s*:\s*var\(--shadow-raised\)\s*;/g);
    expect(raised).toHaveLength(1);
    expect(tokensCss.match(/--shadow-glass\s*:/g)).toHaveLength(2);
    expect(tokensCss.match(/--shadow-raised\s*:/g)).toHaveLength(2);
  });

  it("the raised shadow names only the model overlay and correct card (amended C45)", () => {
    const rule = styles.match(
      /([^}]*)\{\s*box-shadow\s*:\s*var\(--shadow-raised\)\s*;\s*\}/
    );
    expect(rule).not.toBeNull();
    const selectors = rule[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(selectors.sort()).toEqual([
      "#game-cards button.card-correct",
      "#model-overlay",
    ]);
  });

  it("backdrop-filter lives only inside the single @supports block (C44)", () => {
    expect(supportsStart).toBeGreaterThan(-1);
    const conditions = styles.match(/@supports/g);
    expect(conditions).toHaveLength(1);
    const block = braceBlock(styles, supportsStart);
    expect(block).toMatch(/\.glass\s*\{/);
    expect(block).toContain("background: var(--surface-glass)");
    expect(block).toMatch(/backdrop-filter\s*:\s*blur\(var\(--blur\)\)\s*;/);
    const outside =
      styles.slice(0, supportsStart) +
      styles.slice(supportsStart).replace(block, "");
    // Only the @supports condition itself may mention backdrop-filter.
    expect(outside.match(/backdrop-filter/g)).toHaveLength(1);
    expect(outside).not.toContain("--surface-glass");
  });
});

// ---------- motion (C46) ----------

describe("motion (C46 as amended by STEP 3)", () => {
  it("exactly two duration tokens, declared in tokens.css :root", () => {
    expect((tokens + styles).match(/--dur\s*:\s*150ms/g)).toHaveLength(1);
    expect((tokens + styles).match(/--dur-slow\s*:\s*300ms/g)).toHaveLength(1);
    expect(rootDecls.get("--dur")).toBe("150ms");
    expect(rootDecls.get("--dur-slow")).toBe("300ms");
  });

  it("every transition uses var(--dur) with ease-out and no literal duration", () => {
    const transitions = [...styles.matchAll(/transition\s*:\s*([^;]+);/g)];
    expect(transitions.length).toBeGreaterThan(0);
    for (const [, value] of transitions) {
      for (const part of value.split(",")) {
        expect(part).toContain("var(--dur)");
        expect(part).toContain("ease-out");
      }
      expect(value).not.toMatch(/\d+m?s\b/);
    }
  });

  it("every animation is the one keyframe on a token duration (amended C46)", () => {
    const names = styles.match(/@keyframes\s+([\w-]+)/g) ?? [];
    expect(names).toEqual(["@keyframes reveal-in"]);
    const animations = [...styles.matchAll(/animation\s*:\s*([^;]+);/g)];
    expect(animations.length).toBeGreaterThan(0);
    for (const [, value] of animations) {
      expect(value).toContain("reveal-in");
      expect(value).toMatch(/var\(--dur(-slow)?\)/);
      expect(value).toContain("ease-out");
      expect(value).not.toMatch(/\d+m?s\b/);
    }
  });

  it("one prefers-reduced-motion block zeroes both durations (amended C46)", () => {
    const blocks = styles.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g);
    expect(blocks).toHaveLength(1);
    const start = styles.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = braceBlock(styles, start);
    expect(block).toMatch(/--dur\s*:\s*0ms\s*;/);
    expect(block).toMatch(/--dur-slow\s*:\s*0ms\s*;/);
  });
});

// ---------- responsive (C47) ----------

describe("responsive (C47)", () => {
  it("the only width media query in docs/css is min-width: 720px", () => {
    for (const css of [styles, tokens]) {
      const queries = [...css.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]);
      for (const q of queries) {
        if (/width/.test(q)) {
          expect(q.trim()).toBe("(min-width: 720px)");
        }
        expect(q).not.toContain("max-width");
      }
    }
    expect(styles).toMatch(/@media\s*\(min-width:\s*720px\)/);
  });
});
