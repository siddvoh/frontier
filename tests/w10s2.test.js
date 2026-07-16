// W10.S2: shared reveal formatting (C60, C71). docs/js/game/reveal.js is
// the single source of the stat label-and-formatter map and the reveal
// paragraph builder; both game views consume it, so daily and endless
// always agree on the same reveal. The daily reveal for every stat
// template shows the human label with display-formatted values and never
// leaks the raw artifact dot-path or raw String(value); scenario reveals
// keep the exact engine formula strings verbatim.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { JSDOM } from "jsdom";

import { STAT_REVEAL, revealParagraphs } from "../docs/js/game/reveal.js";
import { render as renderDailyView } from "../docs/js/game/views/daily.js";
import { render as renderEndlessView } from "../docs/js/game/views/endless.js";
import {
  dailySeed,
  endlessQuestions,
  generateDaily,
} from "../docs/js/game/questions.js";
import { fmtDate, fmtInt, fmtScore, fmtUsd } from "../docs/js/util.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function artifact(models) {
  return {
    generatedAt: "2026-07-01T00:00:00Z",
    attribution:
      'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
    models,
    events: [],
    surprises: [],
  };
}

// Two fully populated models differing on every C59 field: all eight
// templates are valid, so one daily playthrough covers every reveal shape.
const rich = artifact([
  model({
    id: "alpha-1",
    name: "Alpha 1",
    releaseDate: "2024-05-01",
    pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
    contextWindow: 200000,
    benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
  }),
  model({
    id: "beta-2",
    name: "Beta 2",
    releaseDate: "2025-01-15",
    pricing: { inputPerMTok: 10, outputPerMTok: 30, currency: "USD" },
    contextWindow: 1000000,
    benchmarks: { gpqaDiamond: 70.5, swebenchVerified: 55.9 },
  }),
]);

// Only contextWindow differs, so the endless pool is exactly the context
// template and the formatted value (thousands separators) differs from the
// raw String(value).
const contextOnly = artifact([
  model({ id: "alpha-1", name: "Alpha 1", contextWindow: 200000 }),
  model({ id: "beta-2", name: "Beta 2", contextWindow: 1000000 }),
]);

const NAMES = { "alpha-1": "Alpha 1", "beta-2": "Beta 2" };
const name = (id) => NAMES[id];

const PLAY_DATE = "2026-07-20";

// The expected reveal line for a stat question, built independently of the
// module under test.
const STAT_EXPECT = {
  "pricing.inputPerMTok": ["Input price per Mtok", fmtUsd],
  "pricing.outputPerMTok": ["Output price per Mtok", fmtUsd],
  contextWindow: ["Context window", fmtInt],
  "benchmarks.gpqaDiamond": ["GPQA Diamond", fmtScore],
  "benchmarks.swebenchVerified": ["SWE-bench Verified", fmtScore],
  releaseDate: ["Release date", fmtDate],
};

function expectedStatLine(question) {
  const data = question.revealData;
  const [label, format] = STAT_EXPECT[data.field];
  return (
    `${label}: ${name(question.optionA)} ${format(data.valueA)} vs ` +
    `${name(question.optionB)} ${format(data.valueB)}`
  );
}

// ---------- environment ----------

const saved = { document: globalThis.document, fetch: globalThis.fetch };
let dom;

beforeAll(() => {
  dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not touch the network");
  };
});

afterAll(() => {
  globalThis.document = saved.document;
  globalThis.fetch = saved.fetch;
});

beforeEach(() => {
  const map = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value));
      },
      removeItem: (key) => {
        map.delete(key);
      },
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
});

function cardButtons(el) {
  return [...el.querySelectorAll("#game-cards button")];
}

// ---------- the shared module (C60) ----------

describe("reveal.js stat map and paragraph builder (C60)", () => {
  it("maps exactly the six C59 stat fields to human labels", () => {
    expect(Object.keys(STAT_REVEAL).sort()).toEqual(
      Object.keys(STAT_EXPECT).sort()
    );
    for (const [field, [label]] of Object.entries(STAT_EXPECT)) {
      expect(STAT_REVEAL[field].label).toBe(label);
    }
    expect(Object.isFrozen(STAT_REVEAL)).toBe(true);
  });

  it("formats each field for display, never raw String(value)", () => {
    expect(STAT_REVEAL["pricing.inputPerMTok"].format(3)).toBe("$3.00");
    expect(STAT_REVEAL["pricing.outputPerMTok"].format(15)).toBe("$15.00");
    expect(STAT_REVEAL.contextWindow.format(200000)).toBe("200,000");
    expect(STAT_REVEAL["benchmarks.gpqaDiamond"].format(60.1)).toBe("60.1");
    expect(STAT_REVEAL["benchmarks.swebenchVerified"].format(55)).toBe("55.0");
    expect(STAT_REVEAL.releaseDate.format("2024-05-01")).toBe("2024-05-01");
  });

  it("builds one labeled, formatted line per stat question", () => {
    const question = endlessQuestions(11, contextOnly).next().value;
    expect(question.revealData.field).toBe("contextWindow");
    const nodes = revealParagraphs(question, name);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].tagName).toBe("P");
    expect(nodes[0].textContent).toBe(expectedStatLine(question));
  });

  it("builds budget plus two verbatim cost-formula lines per scenario question", () => {
    const scenario = generateDaily(dailySeed(PLAY_DATE), rich).find((q) =>
      q.templateId.startsWith("scen-")
    );
    expect(scenario).toBeDefined();
    const nodes = revealParagraphs(scenario, name);
    expect(nodes).toHaveLength(3);
    const data = scenario.revealData;
    expect(nodes[0].textContent).toContain("Budget: " + fmtUsd(data.budget));
    expect(nodes[1].className).toBe("cost-formula");
    expect(nodes[2].className).toBe("cost-formula");
    expect(nodes[1].textContent).toBe(
      `${name(scenario.optionA)}: ${data.formulaA}`
    );
    expect(nodes[2].textContent).toBe(
      `${name(scenario.optionB)}: ${data.formulaB}`
    );
  });
});

// ---------- daily reveals (C60, C71) ----------

describe("daily reveal shows human labels and formatted values (C60, C71)", () => {
  it("renders every stat template with its label, no raw dot-path leaked", () => {
    const questions = generateDaily(dailySeed(PLAY_DATE), rich);
    const el = renderDailyView(
      { route: { view: "daily" }, data: rich },
      PLAY_DATE
    );
    const statFieldsSeen = new Set();

    for (const question of questions) {
      cardButtons(el)[question.correctIndex].click();
      const reveal = el.querySelector(".game-reveal");
      expect(reveal).not.toBeNull();
      const text = reveal.textContent;
      const data = question.revealData;

      if (data.field !== undefined) {
        statFieldsSeen.add(data.field);
        expect(text).toContain(expectedStatLine(question));
        // The raw artifact dot-path never reaches the player.
        expect(text).not.toContain(data.field);
      } else {
        expect(text).toContain(data.formulaA);
        expect(text).toContain(data.formulaB);
        const formulas = [...reveal.querySelectorAll("p.cost-formula")];
        expect(formulas).toHaveLength(2);
      }
      el.querySelector(".game-next").click();
    }

    // The two-model rich fixture makes all six stat templates valid, so
    // every stat reveal shape was exercised above.
    expect(statFieldsSeen.size).toBe(6);
  });

  it("formats the context window with separators, raw digits absent", () => {
    const questions = generateDaily(dailySeed(PLAY_DATE), rich);
    const el = renderDailyView(
      { route: { view: "daily" }, data: rich },
      PLAY_DATE
    );

    for (const question of questions) {
      cardButtons(el)[question.correctIndex].click();
      if (question.revealData.field === "contextWindow") {
        const text = el.querySelector(".game-reveal").textContent;
        expect(text).toContain("200,000");
        expect(text).toContain("1,000,000");
        expect(text).not.toContain("200000");
        expect(text).not.toContain("1000000");
        return;
      }
      el.querySelector(".game-next").click();
    }
    throw new Error("fixture daily never asked the context question");
  });
});

// ---------- both views consume the shared module ----------

describe("daily and endless agree on the shared reveal", () => {
  it("endless renders the identical shared stat line", () => {
    const question = endlessQuestions(11, contextOnly).next().value;
    const view = renderEndlessView({
      route: { view: "endless", seed: 11 },
      data: contextOnly,
    });
    cardButtons(view)[question.correctIndex].click();
    const text = view.querySelector(".game-reveal").textContent;
    expect(text).toContain(expectedStatLine(question));
    expect(text).not.toContain("contextWindow");
    expect(text).not.toContain("200000");
  });

  it("both view modules import reveal.js and define no local label map", () => {
    for (const file of ["daily.js", "endless.js"]) {
      const source = readFileSync(
        path.join(root, "docs", "js", "game", "views", file),
        "utf8"
      );
      expect(source).toContain('from "../reveal.js"');
      expect(source).not.toContain("STAT_REVEAL =");
      expect(source).not.toContain("Input price per Mtok");
      expect(source).not.toContain("pricing.inputPerMTok");
    }
  });
});

// ---------- module hygiene (C13, C19, C65) ----------

describe("reveal.js module hygiene (C13, C19, C65)", () => {
  const source = readFileSync(
    path.join(root, "docs", "js", "game", "reveal.js"),
    "utf8"
  );

  it("never touches browser storage, the network, or ambient randomness", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("?? 0");
    expect(source).not.toContain("|| 0");
  });

  it("imports only from within docs/js/", () => {
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      expect(spec.startsWith("../") || spec.startsWith("./")).toBe(true);
    }
  });
});
