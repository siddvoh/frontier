import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { parseHash, toHash } from "../docs/js/router.js";
import {
  MISSING,
  fmtText,
  fmtUsd,
  fmtInt,
  fmtScore,
  fmtDate,
  fmtWeights,
} from "../docs/js/util.js";
import { render as renderCatalog } from "../docs/js/views/catalog.js";
import { render as renderModel } from "../docs/js/views/model.js";
import { render as renderCompare } from "../docs/js/views/compare.js";
import { render as renderScenario } from "../docs/js/views/scenario.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsDir = path.join(root, "docs", "js");

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const jsFiles = listJsFiles(jsDir).map((file) => ({
  rel: path.relative(root, file),
  text: readFileSync(file, "utf8"),
}));

const EM_DASH = "—";

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

describe("router.parseHash (C28)", () => {
  it("resolves empty and default hashes to the catalog", () => {
    expect(parseHash("")).toEqual({ view: "catalog" });
    expect(parseHash("#")).toEqual({ view: "catalog" });
    expect(parseHash("#/")).toEqual({ view: "catalog" });
    expect(parseHash("#/catalog")).toEqual({ view: "catalog" });
  });

  it("parses #/model/:id", () => {
    expect(parseHash("#/model/gpt-4")).toEqual({ view: "model", id: "gpt-4" });
    expect(parseHash("#/model/gpt-5.6-sol")).toEqual({
      view: "model",
      id: "gpt-5.6-sol",
    });
  });

  it("parses #/compare?ids=a,b,c", () => {
    expect(parseHash("#/compare?ids=a,b,c")).toEqual({
      view: "compare",
      ids: ["a", "b", "c"],
    });
    expect(parseHash("#/compare")).toEqual({ view: "compare", ids: [] });
  });

  it("parses a full #/scenario query", () => {
    const hash =
      "#/scenario?budget=100&task=coding&in=5&out=2.5" +
      "&open=1&minCtx=200000&after=2024-01-01&before=2025-06-30";
    expect(parseHash(hash)).toEqual({
      view: "scenario",
      input: {
        budgetUsdPerMonth: 100,
        task: "coding",
        inputMTokPerMonth: 5,
        outputMTokPerMonth: 2.5,
        constraints: {
          openWeightsOnly: true,
          minContextTokens: 200000,
          releasedOnOrAfter: "2024-01-01",
          releasedOnOrBefore: "2025-06-30",
        },
      },
    });
  });

  it("parses a bare #/scenario as all-null input", () => {
    expect(parseHash("#/scenario")).toEqual({
      view: "scenario",
      input: emptyScenarioInput,
    });
  });

  it("treats invalid scenario values as null, never a default", () => {
    const route = parseHash("#/scenario?budget=abc&task=poetry&open=maybe");
    expect(route.input.budgetUsdPerMonth).toBeNull();
    expect(route.input.task).toBeNull();
    expect(route.input.constraints.openWeightsOnly).toBeNull();
  });

  it("resolves unknown routes to the catalog", () => {
    expect(parseHash("#/bogus")).toEqual({ view: "catalog" });
    expect(parseHash("#/model")).toEqual({ view: "catalog" });
    expect(parseHash("#/compare/extra")).toEqual({ view: "catalog" });
    expect(parseHash("#/scenario/extra?budget=1")).toEqual({
      view: "catalog",
    });
    expect(parseHash("#/settings?x=1")).toEqual({ view: "catalog" });
  });
});

describe("router round trips (C28)", () => {
  it("round-trips compare state through the hash", () => {
    const state = { view: "compare", ids: ["gpt-4", "claude-fable-5"] };
    expect(toHash(state)).toBe("#/compare?ids=gpt-4,claude-fable-5");
    expect(parseHash(toHash(state))).toEqual(state);
  });

  it("round-trips a full scenario state through the hash", () => {
    const state = {
      view: "scenario",
      input: {
        budgetUsdPerMonth: 250.5,
        task: "longdoc",
        inputMTokPerMonth: 10,
        outputMTokPerMonth: 3,
        constraints: {
          openWeightsOnly: false,
          minContextTokens: 128000,
          releasedOnOrAfter: "2023-03-01",
          releasedOnOrBefore: "2026-07-01",
        },
      },
    };
    expect(parseHash(toHash(state))).toEqual(state);
  });

  it("round-trips a partially-null scenario state", () => {
    const state = {
      view: "scenario",
      input: {
        ...emptyScenarioInput,
        budgetUsdPerMonth: 42,
        task: "reasoning",
        constraints: { ...emptyScenarioInput.constraints },
      },
    };
    expect(parseHash(toHash(state))).toEqual(state);
  });

  it("serializes model and catalog states", () => {
    expect(toHash({ view: "model", id: "gpt-4" })).toBe("#/model/gpt-4");
    expect(toHash({ view: "catalog" })).toBe("#/catalog");
    expect(parseHash(toHash({ view: "model", id: "gpt-4" }))).toEqual({
      view: "model",
      id: "gpt-4",
    });
  });
});

describe("util MISSING and formatters (C20, C19)", () => {
  it("exports MISSING as the em dash", () => {
    expect(MISSING).toBe(EM_DASH);
    expect(MISSING).toHaveLength(1);
  });

  it("formats null as MISSING in every formatter", () => {
    for (const fmt of [fmtText, fmtUsd, fmtInt, fmtScore, fmtDate, fmtWeights]) {
      expect(fmt(null)).toBe(MISSING);
    }
  });

  it("formats non-null values without substitution", () => {
    expect(fmtUsd(3)).toBe("$3.00");
    expect(fmtUsd(0)).toBe("$0.00");
    expect(fmtInt(200000)).toBe("200,000");
    expect(fmtScore(60.15)).toBe("60.1");
    expect(fmtDate("2024-05-01")).toBe("2024-05-01");
    expect(fmtWeights(true)).toBe("open");
    expect(fmtWeights(false)).toBe("closed");
    expect(fmtText("Alpha Lab")).toBe("Alpha Lab");
  });

  it("is the only MISSING definition in docs/js/", () => {
    const defining = jsFiles.filter(({ text }) =>
      /\bMISSING\s*=/.test(text)
    );
    expect(defining.map((f) => f.rel)).toEqual([
      path.join("docs", "js", "util.js"),
    ]);
  });
});

describe("view stubs render under jsdom without fetch (C29, C13)", () => {
  const fixture = {
    generatedAt: "2026-07-01T00:00:00Z",
    attribution:
      'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
    models: [
      {
        id: "alpha-1",
        name: "Alpha 1",
        organization: "Alpha Lab",
        releaseDate: "2024-05-01",
        epochName: "Alpha 1",
        pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
        contextWindow: 200000,
        benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
        openWeights: false,
        epoch: {
          parameters: 1.7e12,
          trainingComputeFlop: 1.7e25,
          organization: "Alpha Lab",
        },
        sources: {
          releaseDate: "curated",
          "pricing.inputPerMTok": "curated",
          "pricing.outputPerMTok": "curated",
          contextWindow: "curated",
          "benchmarks.gpqaDiamond": "curated",
          "benchmarks.swebenchVerified": "curated",
          openWeights: "curated",
          "epoch.parameters": "epoch",
          "epoch.trainingComputeFlop": "epoch",
          "epoch.organization": "epoch",
        },
      },
      {
        id: "beta-2",
        name: "Beta 2",
        organization: "Beta Corp",
        releaseDate: null,
        epochName: null,
        pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
        contextWindow: null,
        benchmarks: { gpqaDiamond: null, swebenchVerified: null },
        openWeights: null,
        epoch: {
          parameters: null,
          trainingComputeFlop: null,
          organization: null,
        },
        sources: {},
      },
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

  const savedDocument = globalThis.document;
  const savedFetch = globalThis.fetch;

  beforeAll(() => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    globalThis.document = dom.window.document;
    globalThis.fetch = () => {
      throw new Error("views must not call fetch");
    };
  });

  afterAll(() => {
    globalThis.document = savedDocument;
    globalThis.fetch = savedFetch;
  });

  it("renders the catalog stub with nulls as MISSING", () => {
    const el = renderCatalog({ route: { view: "catalog" }, data: fixture });
    expect(el.nodeType).toBe(1);
    expect(el.textContent).toContain("Alpha 1");
    expect(el.textContent).toContain("Beta 2");
    expect(el.textContent).toContain("$3.00");
    expect(el.textContent).toContain(EM_DASH);
    const link = el.querySelector('a[href="#/model/alpha-1"]');
    expect(link).not.toBeNull();
  });

  it("renders the model stub for a known id", () => {
    const el = renderModel({
      route: { view: "model", id: "alpha-1" },
      data: fixture,
    });
    expect(el.id).toBe("model-overlay");
    expect(el.textContent).toContain("Alpha 1");
    expect(el.textContent).toContain("200,000");
  });

  it("renders the model stub for an unknown id without inventing data", () => {
    const el = renderModel({
      route: { view: "model", id: "nope-0" },
      data: fixture,
    });
    expect(el.textContent).toContain("Model not found");
  });

  it("renders null model fields as MISSING", () => {
    const el = renderModel({
      route: { view: "model", id: "beta-2" },
      data: fixture,
    });
    expect(el.textContent).toContain("Beta 2");
    expect(el.textContent).toContain(EM_DASH);
  });

  it("renders the compare stub for selected ids", () => {
    const el = renderCompare({
      route: { view: "compare", ids: ["alpha-1", "beta-2"] },
      data: fixture,
    });
    expect(el.querySelectorAll("li")).toHaveLength(2);
    expect(el.textContent).toContain("Alpha 1");
    expect(el.textContent).toContain("Beta 2");
  });

  it("renders the compare stub with no selection", () => {
    const el = renderCompare({
      route: { view: "compare", ids: [] },
      data: fixture,
    });
    expect(el.textContent).toContain("Compare");
  });

  it("renders the scenario stub with null inputs as MISSING", () => {
    const el = renderScenario({
      route: { view: "scenario", input: emptyScenarioInput },
      data: fixture,
    });
    expect(el.querySelector("#scenario-results")).not.toBeNull();
    expect(el.textContent).toContain(EM_DASH);
  });

  it("renders the scenario stub with concrete inputs", () => {
    const el = renderScenario({
      route: {
        view: "scenario",
        input: {
          ...emptyScenarioInput,
          budgetUsdPerMonth: 100,
          task: "coding",
          constraints: { ...emptyScenarioInput.constraints },
        },
      },
      data: fixture,
    });
    expect(el.textContent).toContain("$100.00");
    expect(el.textContent).toContain("coding");
  });
});

describe("main.js is the single fetch site (C13, C29, C2)", () => {
  const fetchCall = /\bfetch\s*\(/g;

  it("has exactly one fetch call in docs/js/, in main.js", () => {
    const sites = [];
    for (const { rel, text } of jsFiles) {
      const count = (text.match(fetchCall) || []).length;
      if (count > 0) sites.push({ rel, count });
    }
    expect(sites).toEqual([
      { rel: path.join("docs", "js", "main.js"), count: 1 },
    ]);
  });

  it("fetches the relative artifact path only", () => {
    const main = jsFiles.find((f) => f.rel.endsWith("main.js"));
    expect(main.text).toContain('fetch("data/models.json")');
    expect(main.text).not.toMatch(/fetch\s*\(\s*["'`]\//);
    expect(main.text).not.toMatch(/fetch\s*\(\s*["'`]http/);
  });

  it("keeps docs/js/ free of stat defaulting and randomness (C19)", () => {
    for (const { rel, text } of jsFiles) {
      expect(text, rel).not.toContain("?? 0");
      expect(text, rel).not.toContain("|| 0");
      expect(text, rel).not.toContain("Math.random");
    }
  });
});
