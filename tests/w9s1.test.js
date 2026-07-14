// W9.S1: STEP 2 integration audit. Amended glass scoping across every
// step 1 view, every game view, and index.html (C43 as amended: six
// whitelisted hosts); CSS containment of the glass primitives; whole-game
// hygiene greps (C74, C13, C65, C19, section 15); and C75/C50 suite
// completeness. Grep tokens that the hygiene rules ban from source bytes
// are built by concatenation so this file never contains them literally.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { render as renderCatalog } from "../docs/js/views/catalog.js";
import { render as renderModel } from "../docs/js/views/model.js";
import { render as renderCompare } from "../docs/js/views/compare.js";
import { render as renderScenario } from "../docs/js/views/scenario.js";
import { render as renderPicker } from "../docs/js/game/views/picker.js";
import { render as renderDaily } from "../docs/js/game/views/daily.js";
import { render as renderEndless } from "../docs/js/game/views/endless.js";
import { STORAGE_KEY, saveDailyRecord } from "../docs/js/game/storage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const testsDir = path.join(root, "tests");

// Banned-token workaround (repo convention since W1.S1/W4.S1): these
// strings are grep data, never literals, so the hygiene greps that scan
// test bytes stay clean.
const TOKENS = {
  skip: "." + "skip" + "(",
  todo: "." + "todo" + "(",
  fetchCall: "fet" + "ch(",
  webStorage: "local" + "Storage",
  mathRandom: "Math" + ".random",
};

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function count(text, token) {
  return text.split(token).length - 1;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Returns the { ... } block starting at the first "{" at or after startIdx.
function extractBlock(css, startIdx) {
  const open = css.indexOf("{", startIdx);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { block: css.slice(open, i + 1), end: i + 1 };
    }
  }
  throw new Error("unbalanced braces in css");
}

// ---------- fixtures ----------

function model(overrides) {
  return {
    id: "x",
    name: "X",
    organization: "X Lab",
    releaseDate: "2024-01-01",
    epochName: null,
    pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
    contextWindow: null,
    benchmarks: { gpqaDiamond: null, swebenchVerified: null },
    openWeights: null,
    epoch: { parameters: null, trainingComputeFlop: null, organization: null },
    sources: {},
    ...overrides,
  };
}

// alpha-1 and beta-2 are fully populated and differ on every C59 field, so
// all eight game templates are valid and daily/endless renders positively
// produce #game-cards (the empty-pool endless render legitimately has no
// glass; see the dedicated fixture below). gamma-3 keeps nulls in play for
// the step 1 renders.
const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [
    model({
      id: "alpha-1",
      name: "Alpha 1",
      organization: "Alpha Lab",
      releaseDate: "2024-05-01",
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
      contextWindow: 200000,
      benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
      openWeights: false,
      sources: {
        releaseDate: "curated",
        "pricing.inputPerMTok": "curated",
        "pricing.outputPerMTok": "curated",
        contextWindow: "curated",
        "benchmarks.gpqaDiamond": "curated",
        "benchmarks.swebenchVerified": "curated",
        openWeights: "curated",
      },
    }),
    model({
      id: "beta-2",
      name: "Beta 2",
      organization: "Beta Corp",
      releaseDate: "2025-01-15",
      pricing: { inputPerMTok: 10, outputPerMTok: 30, currency: "USD" },
      contextWindow: 1000000,
      benchmarks: { gpqaDiamond: 70.5, swebenchVerified: 55.9 },
      openWeights: true,
      sources: {
        releaseDate: "curated",
        "pricing.inputPerMTok": "curated",
        "pricing.outputPerMTok": "curated",
        contextWindow: "curated",
        "benchmarks.gpqaDiamond": "curated",
        "benchmarks.swebenchVerified": "curated",
        openWeights: "curated",
      },
    }),
    model({ id: "gamma-3", name: "Gamma 3", releaseDate: null }),
  ],
  events: [
    {
      id: "alpha-launch",
      date: "2024-05-01",
      title: "Alpha 1 launches",
      body: "Alpha Lab releases Alpha 1.",
      modelIds: ["alpha-1"],
    },
  ],
  surprises: [],
};

// Nothing differs and nothing is priced: the game candidate pool is empty,
// so the endless view renders its muted note with no #game-cards and no
// glass at all, which the amended C43 audit must accept.
const emptyPoolFixture = {
  ...fixture,
  models: [model({ id: "alpha-1", name: "Alpha 1" }), model({ id: "beta-2", name: "Beta 2" })],
  events: [],
};

const emptyScenarioInput = {
  budgetUsdPerMonth: null,
  task: null,
  inputMTokPerMonth: null,
  outputMTokPerMonth: null,
  constraints: {
    openWeightsOnly: null,
    minContextTokens: null,
    releasedOnOrAfter: null,
    releasedOnOrBefore: null,
  },
};

const PLAY_DATE = "2026-07-20"; // past the C76 LAUNCH_DATE gate
const PRE_LAUNCH_DATE = "2026-07-10";
const RESULT_DATE = "2026-08-01";

const completedRecord = {
  questionIds: ["q-a", "q-b", "q-c", "q-d", "q-e"],
  picks: [0, 1, 0, 1, 0],
  correct: [true, true, false, true, false],
  completed: true,
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("amended glass scoping across every view (C43)", () => {
  const GLASS_IDS = [
    "site-header",
    "compare-tray",
    "scenario-results",
    "model-overlay",
    "game-cards",
    "game-results",
  ];
  const saved = { document: globalThis.document, fetch: globalThis.fetch };

  beforeAll(() => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
    globalThis.fetch = () => {
      throw new Error("views must not touch the network");
    };
  });

  afterAll(() => {
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
    delete globalThis.localStorage;
  });

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  function glassElements(el) {
    const all = [el, ...el.querySelectorAll("*")];
    return all.filter((node) => node.classList.contains("glass"));
  }

  function renderAll() {
    // A pre-seeded completed record makes the daily render the results
    // screen (#game-results.glass) instead of a replay (C67, C72).
    expect(saveDailyRecord(RESULT_DATE, completedRecord)).toBe(true);
    return [
      renderCatalog({ route: { view: "catalog" }, data: fixture }),
      renderModel({ route: { view: "model", id: "alpha-1" }, data: fixture }),
      renderModel({ route: { view: "model", id: "gamma-3" }, data: fixture }),
      renderCompare({
        route: { view: "compare", ids: ["alpha-1", "beta-2", "gamma-3"] },
        data: fixture,
      }),
      renderCompare({ route: { view: "compare", ids: [] }, data: fixture }),
      renderScenario({
        route: { view: "scenario", input: emptyScenarioInput },
        data: fixture,
      }),
      renderScenario({
        route: {
          view: "scenario",
          input: {
            ...emptyScenarioInput,
            budgetUsdPerMonth: 200,
            task: "coding",
            inputMTokPerMonth: 10,
            outputMTokPerMonth: 5,
            constraints: { ...emptyScenarioInput.constraints },
          },
        },
        data: fixture,
      }),
      renderPicker({ route: { view: "picker" }, data: fixture }),
      renderEndless({ route: { view: "endless", seed: 42 }, data: fixture }),
      renderEndless({
        route: { view: "endless", seed: 42 },
        data: emptyPoolFixture,
      }),
      renderDaily({ route: { view: "daily" }, data: fixture }, PLAY_DATE),
      renderDaily({ route: { view: "daily" }, data: fixture }, PRE_LAUNCH_DATE),
      renderDaily({ route: { view: "daily" }, data: fixture }, RESULT_DATE),
    ];
  }

  it("every rendered .glass element is one of the six whitelisted hosts, and all game hosts appear", () => {
    const rendered = renderAll();
    const found = new Set();
    for (const el of rendered) {
      for (const node of glassElements(el)) {
        expect(GLASS_IDS, "glass on #" + node.id).toContain(node.id);
        found.add(node.id);
      }
    }
    // Positive coverage: the audit saw glass on every host the views own
    // (index.html owns #site-header, asserted separately below).
    for (const id of GLASS_IDS.filter((g) => g !== "site-header")) {
      expect([...found], "expected a rendered #" + id).toContain(id);
    }
  });

  it("the seeded endless and post-launch daily question screens carry glass on #game-cards only", () => {
    const endless = renderEndless(
      { route: { view: "endless", seed: 42 }, data: fixture }
    );
    const daily = renderDaily(
      { route: { view: "daily" }, data: fixture },
      PLAY_DATE
    );
    for (const el of [endless, daily]) {
      const cards = el.querySelector("#game-cards");
      expect(cards).not.toBeNull();
      expect(cards.classList.contains("glass")).toBe(true);
      expect(glassElements(el)).toHaveLength(1);
    }
  });

  it("the completed daily carries glass on #game-results only", () => {
    expect(saveDailyRecord(RESULT_DATE, completedRecord)).toBe(true);
    const el = renderDaily(
      { route: { view: "daily" }, data: fixture },
      RESULT_DATE
    );
    const results = el.querySelector("#game-results");
    expect(results).not.toBeNull();
    expect(results.classList.contains("glass")).toBe(true);
    expect(el.querySelector("#game-cards")).toBeNull();
    expect(glassElements(el)).toHaveLength(1);
  });

  it("empty-pool endless and pre-launch daily legitimately render no glass", () => {
    const endless = renderEndless({
      route: { view: "endless", seed: 42 },
      data: emptyPoolFixture,
    });
    const daily = renderDaily(
      { route: { view: "daily" }, data: fixture },
      PRE_LAUNCH_DATE
    );
    for (const el of [endless, daily]) {
      expect(el.querySelector("#game-cards")).toBeNull();
      expect(el.querySelector("#game-results")).toBeNull();
      expect(glassElements(el)).toHaveLength(0);
    }
  });

  it("index.html applies .glass only to whitelisted hosts", () => {
    const html = readFileSync(path.join(docsDir, "index.html"), "utf8");
    const dom = new JSDOM(html);
    const nodes = [...dom.window.document.querySelectorAll(".glass")];
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(GLASS_IDS).toContain(node.id);
    }
    expect(nodes.map((n) => n.id)).toContain("site-header");
  });
});

describe("glass CSS containment (C43, C44)", () => {
  const styles = stripCssComments(
    readFileSync(path.join(docsDir, "css", "styles.css"), "utf8")
  );
  const tokens = stripCssComments(
    readFileSync(path.join(docsDir, "css", "tokens.css"), "utf8")
  );
  const supportsCond = "@supports (backdrop-filter: blur(12px))";
  const supportsIdx = styles.indexOf(supportsCond);

  it("keeps all backdrop-filter use inside the single @supports .glass rule", () => {
    expect(supportsIdx).toBeGreaterThanOrEqual(0);
    expect(styles.split("@supports")).toHaveLength(2);
    const { block, end } = extractBlock(styles, supportsIdx);
    const outside = styles.slice(0, supportsIdx) + styles.slice(end);
    expect(outside).not.toContain("backdrop-filter");
    expect(block).toContain(".glass");
    expect(block).toContain("backdrop-filter: blur(var(--blur))");
    expect(block.split("backdrop-filter")).toHaveLength(2);
  });

  it("uses var(--surface-glass) only inside the @supports .glass rule", () => {
    const { block, end } = extractBlock(styles, supportsIdx);
    const outside = styles.slice(0, supportsIdx) + styles.slice(end);
    expect(outside).not.toContain("--surface-glass");
    expect(block).toContain("background: var(--surface-glass)");
    expect(block.split("--surface-glass")).toHaveLength(2);
  });

  it("tokens.css only defines --surface-glass and never uses backdrop-filter", () => {
    expect(tokens).not.toContain("backdrop-filter");
    const mentions = tokens.split("--surface-glass").length - 1;
    const definitions = tokens.split("--surface-glass:").length - 1;
    expect(definitions).toBe(2); // light and dark theme blocks
    expect(mentions).toBe(definitions);
  });

  it("no docs file outside css/ mentions surface-glass or backdrop-filter", () => {
    const files = listFiles(docsDir).filter(
      (f) => !f.includes(path.join("docs", "css") + path.sep)
    );
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(root, file);
      expect(text, rel).not.toContain("surface-glass");
      expect(text, rel).not.toContain("backdrop-filter");
    }
  });
});

describe("whole-game hygiene greps (C74, C13, C65, C19, section 15)", () => {
  const jsFiles = listFiles(path.join(docsDir, "js"));

  it("keeps game, puzzle, streak, and score out of the six C74 files", () => {
    const audited = [
      path.join(docsDir, "js", "views", "catalog.js"),
      path.join(docsDir, "js", "views", "model.js"),
      path.join(docsDir, "js", "views", "compare.js"),
      path.join(docsDir, "js", "views", "scenario.js"),
      path.join(docsDir, "js", "views", "timeline.js"),
      path.join(docsDir, "js", "engine.js"),
    ];
    for (const file of audited) {
      const rel = path.relative(root, file);
      expect(existsSync(file), rel).toBe(true);
      const text = readFileSync(file, "utf8");
      // fmtScore and the phrase "benchmark score" describe benchmark data,
      // not a feature; everything else with these words is banned.
      const cleaned = text
        .replace(/fmtScore/g, "")
        .replace(/benchmark score/gi, "");
      expect(cleaned, rel).not.toMatch(/game|puzzle|streak|score/i);
    }
  });

  it("docs/js still has exactly one network call site, in main.js (C13)", () => {
    const hits = [];
    for (const file of jsFiles) {
      const n = count(readFileSync(file, "utf8"), TOKENS.fetchCall);
      if (n > 0) hits.push({ rel: path.relative(root, file), n });
    }
    expect(hits).toEqual([
      { rel: path.join("docs", "js", "main.js"), n: 1 },
    ]);
  });

  it("browser storage access lives only in docs/js/game/storage.js with the single v1 key (C65)", () => {
    const storagePath = path.join(docsDir, "js", "game", "storage.js");
    expect(STORAGE_KEY).toBe("frontier.game.v1");
    const keyDefinition = 'STORAGE_KEY = "frontier.game.v1"';
    for (const file of jsFiles) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(root, file);
      if (file === storagePath) {
        expect(count(text, TOKENS.webStorage), rel).toBeGreaterThan(0);
        // The key literal is defined exactly once and only as STORAGE_KEY.
        expect(count(text, '"frontier.game.v1"'), rel).toBe(1);
        expect(text, rel).toContain(keyDefinition);
      } else {
        expect(text, rel).not.toContain(TOKENS.webStorage);
        expect(text, rel).not.toContain("frontier.game.v1");
      }
    }
  });

  it("no seedless randomness anywhere in docs/js including docs/js/game/ (C19)", () => {
    const gameFiles = jsFiles.filter((f) =>
      f.includes(path.join("js", "game") + path.sep)
    );
    expect(gameFiles.length).toBeGreaterThan(0);
    for (const file of jsFiles) {
      const text = readFileSync(file, "utf8");
      expect(text, path.relative(root, file)).not.toContain(TOKENS.mathRandom);
    }
  });
});

describe("C75 suite completeness and test hygiene (C75, C50)", () => {
  it("has a suite with matching coverage for every C75 area", () => {
    // Area -> [suite file, a marker string proving the area lives there].
    const areas = {
      "per-template generator validity (C59)": ["w6s2.test.js", "stat-input-price"],
      "PRNG constants (C58)": ["w6s2.test.js", "1501764002"],
      "daily determinism and date variation (C61)": ["w6s2.test.js", "generateDaily"],
      "surprise inclusion (C62)": ["w6s2.test.js", "surprise"],
      "endless reproducibility (C63)": ["w8s1.test.js", "endlessQuestions"],
      "streak logic (C64)": ["w6s3.test.js", "recordCorrect"],
      "storage round-trip and corruption (C65, C66)": ["w6s3.test.js", "loadState"],
      "exact share string (C68)": ["w6s4.test.js", "buildShareString"],
      "game route and picker render (C70)": ["w7s1.test.js", "view-picker"],
      "endless question screen render (C71)": ["w8s1.test.js", "game-cards"],
      "daily flow and results render (C71, C72)": ["w8s2.test.js", "game-results"],
    };
    for (const [area, [file, marker]] of Object.entries(areas)) {
      const full = path.join(testsDir, file);
      expect(existsSync(full), area).toBe(true);
      expect(readFileSync(full, "utf8"), area).toContain(marker);
    }
  });

  it("contains no skipped or todo tests anywhere under tests/", () => {
    const files = listFiles(testsDir).filter((f) => f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(root, file);
      expect(text, rel).not.toContain(TOKENS.skip);
      expect(text, rel).not.toContain(TOKENS.todo);
    }
  });
});
