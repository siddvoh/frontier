// W4.S1: final wiring, glass scoping (C43), whole-suite audit
// (C48, C50, C2, C49, section 1 copy rule).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { render as renderCatalog } from "../docs/js/views/catalog.js";
import { render as renderModel } from "../docs/js/views/model.js";
import { render as renderCompare } from "../docs/js/views/compare.js";
import { render as renderScenario } from "../docs/js/views/scenario.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const testsDir = path.join(root, "tests");

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
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
      releaseDate: null,
    }),
    model({
      id: "delta-4",
      name: "Delta 4",
      organization: "Delta Inc",
      releaseDate: "2025-01-15",
      pricing: { inputPerMTok: 2, outputPerMTok: 8, currency: "USD" },
      contextWindow: 100000,
      benchmarks: { gpqaDiamond: 55, swebenchVerified: 35 },
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
      id: "gamma-3",
      name: "Gamma 3",
      organization: "Gamma AI",
      releaseDate: "2024-11-01",
      pricing: { inputPerMTok: 1, outputPerMTok: 4, currency: "USD" },
      contextWindow: 128000,
      benchmarks: { gpqaDiamond: 50, swebenchVerified: 30 },
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
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("main.js final wiring (C29, C32, C33, C28)", () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  let dom;
  const fetchCalls = [];

  beforeAll(async () => {
    dom = new JSDOM(
      "<!DOCTYPE html><html lang=\"en\"><body>" +
        '<header id="site-header" class="glass"><h1>Frontier</h1></header>' +
        '<main id="app"></main></body></html>',
      { url: "http://localhost/frontier/" }
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.fetch = (url) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, json: async () => fixture });
    };
    await import("../docs/js/main.js");
    await tick();
  });

  afterAll(() => {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
  });

  async function goto(hash) {
    dom.window.location.hash = hash;
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    await tick();
  }

  function click(el) {
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  }

  function compareLink() {
    return dom.window.document
      .querySelector('#site-header a[data-nav="compare"]')
      .getAttribute("href");
  }

  it("boots with a single relative fetch and renders the catalog", () => {
    expect(fetchCalls).toEqual(["data/models.json"]);
    const doc = dom.window.document;
    expect(doc.querySelector(".view-catalog")).not.toBeNull();
    expect(doc.querySelectorAll("#app tbody tr[data-model-id]")).toHaveLength(
      4
    );
    expect(doc.querySelectorAll("#site-header nav a")).toHaveLength(3);
    expect(compareLink()).toBe("#/compare");
  });

  it("routes catalog row selection through toggleCompareId with the cap", () => {
    const doc = dom.window.document;
    const row = (id) => doc.querySelector('#app tr[data-model-id="' + id + '"]');
    for (const id of ["alpha-1", "beta-2", "gamma-3", "delta-4"]) {
      click(row(id));
    }
    // The 4th selection is impossible (C32); the pure helper enforced it.
    expect(row("alpha-1").getAttribute("aria-selected")).toBe("true");
    expect(row("beta-2").getAttribute("aria-selected")).toBe("true");
    expect(row("gamma-3").getAttribute("aria-selected")).toBe("true");
    expect(row("delta-4").getAttribute("aria-selected")).toBe("false");
    expect(compareLink()).toBe("#/compare?ids=alpha-1,beta-2,gamma-3");
    // Re-clicking a selected row deselects it.
    click(row("beta-2"));
    expect(row("beta-2").getAttribute("aria-selected")).toBe("false");
    expect(compareLink()).toBe("#/compare?ids=alpha-1,gamma-3");
  });

  it("ignores clicks on the model name link for selection purposes", async () => {
    const doc = dom.window.document;
    const anchor = doc.querySelector(
      '#app tr[data-model-id="delta-4"] a'
    );
    click(anchor);
    // Let jsdom's queued fragment navigation settle before the next test.
    await tick();
    expect(compareLink()).toBe("#/compare?ids=alpha-1,gamma-3");
  });

  it("renders the tray from the hash and wires compare-remove buttons", async () => {
    await goto("#/compare?ids=alpha-1,gamma-3");
    const doc = dom.window.document;
    const tray = doc.querySelector("#compare-tray");
    expect(tray).not.toBeNull();
    expect(tray.querySelectorAll("li")).toHaveLength(2);
    click(
      tray.querySelector(
        '[data-action="compare-remove"][data-model-id="alpha-1"]'
      )
    );
    expect(dom.window.location.hash).toBe("#/compare?ids=gamma-3");
    expect(
      doc.querySelectorAll("#compare-tray li")
    ).toHaveLength(1);
    expect(doc.querySelector("#compare-tray").textContent).toContain(
      "Gamma 3"
    );
  });

  it("opens the model overlay on its route and closes via the button", async () => {
    await goto("#/model/alpha-1");
    const doc = dom.window.document;
    const overlay = doc.querySelector("#model-overlay");
    expect(overlay).not.toBeNull();
    const close = overlay.querySelector('[data-action="overlay-close"]');
    expect(close).not.toBeNull();
    click(close);
    expect(dom.window.location.hash).toBe("#/catalog");
    expect(doc.querySelector("#model-overlay")).toBeNull();
  });

  it("closes the model overlay on Escape", async () => {
    await goto("#/model/alpha-1");
    const doc = dom.window.document;
    expect(doc.querySelector("#model-overlay")).not.toBeNull();
    dom.window.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape" })
    );
    expect(dom.window.location.hash).toBe("#/catalog");
    expect(doc.querySelector("#model-overlay")).toBeNull();
  });

  it("submits the scenario form through the router's toHash", async () => {
    await goto("#/scenario");
    const doc = dom.window.document;
    const form = doc.querySelector("#scenario-form");
    expect(form).not.toBeNull();
    form.elements.namedItem("budget").value = "200";
    form.elements.namedItem("task").value = "coding";
    form.elements.namedItem("in").value = "10";
    form.elements.namedItem("out").value = "5";
    form.dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true })
    );
    expect(dom.window.location.hash).toBe(
      "#/scenario?budget=200&task=coding&in=10&out=5"
    );
    const ranked = doc.querySelectorAll(
      "#scenario-results ol.scenario-ranked > li"
    );
    expect(ranked).toHaveLength(3);
    expect(ranked[0].dataset.modelId).toBe("alpha-1");
    expect(ranked[0].querySelector(".cost-formula").textContent).toBe(
      "10.00 Mtok x $3.00 + 5.00 Mtok x $15.00 = $105.00/mo"
    );
    const excluded = doc.querySelector(
      'details.scenario-excluded li[data-model-id="beta-2"]'
    );
    expect(excluded).not.toBeNull();
    expect(excluded.dataset.reason).toBe("missing_price");
  });

  it("maps empty scenario controls to null, never a default", async () => {
    const doc = dom.window.document;
    const form = doc.querySelector("#scenario-form");
    form.elements.namedItem("budget").value = "";
    form.elements.namedItem("task").value = "";
    form.elements.namedItem("in").value = "";
    form.elements.namedItem("out").value = "";
    form.elements.namedItem("open").checked = false;
    form.elements.namedItem("minCtx").value = "";
    form.dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true })
    );
    expect(dom.window.location.hash).toBe("#/scenario");
    expect(
      doc.querySelector("#scenario-results ol.scenario-ranked")
    ).toBeNull();
    expect(doc.querySelector("#scenario-results").textContent).toContain(
      "Enter a budget"
    );
  });
});

describe("glass scoping (C43)", () => {
  const GLASS_IDS = [
    "site-header",
    "compare-tray",
    "scenario-results",
    "model-overlay",
  ];
  const savedDocument = globalThis.document;

  beforeAll(() => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
  });

  afterAll(() => {
    globalThis.document = savedDocument;
  });

  function glassElements(el) {
    const all = [el, ...el.querySelectorAll("*")];
    return all.filter((node) => node.classList.contains("glass"));
  }

  it("every rendered .glass element is one of the four whitelisted hosts", () => {
    const rendered = [
      renderCatalog({ route: { view: "catalog" }, data: fixture }),
      renderModel({ route: { view: "model", id: "alpha-1" }, data: fixture }),
      renderModel({ route: { view: "model", id: "beta-2" }, data: fixture }),
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
    ];
    let found = 0;
    for (const el of rendered) {
      for (const node of glassElements(el)) {
        found++;
        expect(GLASS_IDS, "glass on #" + node.id).toContain(node.id);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("index.html applies .glass only to whitelisted hosts", () => {
    const html = readFileSync(path.join(docsDir, "index.html"), "utf8");
    const dom = new JSDOM(html);
    const nodes = [...dom.window.document.querySelectorAll(".glass")];
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(GLASS_IDS).toContain(node.id);
    }
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
    const outside =
      styles.slice(0, supportsIdx) + styles.slice(end);
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

describe("suite completeness and test hygiene (C48, C50)", () => {
  it("has a suite for every audited area", () => {
    const suites = {
      "package/scaffold": "w1s1.test.js",
      "token parity and contrast": "w1s2.test.js",
      validator: "w1s3.test.js",
      "csv and column map": "w1s4.test.js",
      pipeline: "w2s1.test.js",
      engine: "w2s2.test.js",
      "router and util": "w2s3.test.js",
      "catalog and timeline views": "w3s1.test.js",
      "model view": "w3s2.test.js",
      "compare view": "w3s3.test.js",
      "scenario view": "w3s4.test.js",
      "glass scoping and audit": "w4s1.test.js",
    };
    for (const [area, file] of Object.entries(suites)) {
      expect(existsSync(path.join(testsDir, file)), area).toBe(true);
    }
  });

  it("contains no skipped or todo tests anywhere under tests/", () => {
    // Built by concatenation so this file never contains the substrings.
    const banned = ["." + "skip" + "(", "." + "todo" + "("];
    const files = listFiles(testsDir).filter((f) => f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(root, file);
      for (const token of banned) {
        expect(text, rel).not.toContain(token);
      }
    }
  });
});

describe("docs/ reference and copy audit (C2, section 1)", () => {
  const files = listFiles(docsDir).map((file) => ({
    rel: path.relative(root, file),
    text: readFileSync(file, "utf8"),
  }));

  it("has no absolute-path or http reference except the C35 link", () => {
    const attrRe = /(?:src|href)\s*=\s*["']([^"']*)["']/g;
    const fetchRe = /fetch\s*\(\s*["'`]([^"'`]*)["'`]/g;
    const offenders = [];
    for (const { rel, text } of files) {
      for (const re of [attrRe, fetchRe]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(text)) !== null) {
          const target = match[1];
          if (target.startsWith("/") || target.startsWith("http")) {
            offenders.push({ rel, target });
          }
        }
      }
    }
    expect(offenders).toEqual([
      { rel: path.join("docs", "index.html"), target: "https://epoch.ai" },
    ]);
  });

  it("contains no game, puzzle, streak, or score identifiers or copy", () => {
    for (const { rel, text } of files) {
      // fmtScore and the phrase "benchmark score" describe benchmark data,
      // not a feature; everything else with these words is banned.
      const cleaned = text
        .replace(/fmtScore/g, "")
        .replace(/benchmark score/gi, "");
      expect(cleaned, rel).not.toMatch(/game|puzzle|streak|score/i);
    }
  });
});
