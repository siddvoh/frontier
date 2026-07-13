// W5.S3: model overlay over the live catalog with a scrim between them,
// plus readable locale/exponent display of large Epoch counts (display
// formatting only; stored values never altered or defaulted).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { MISSING } from "../docs/js/util.js";
import { render as renderModel } from "../docs/js/views/model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

// Mirrors the committed artifact: gpt-4 carries Epoch enrichment values
// (parameters 1.8e12); claude-fable-5 has null parameters/compute.
const gpt4 = model({
  id: "gpt-4",
  name: "GPT-4",
  organization: "OpenAI",
  releaseDate: "2023-03-14",
  pricing: { inputPerMTok: 30, outputPerMTok: 60, currency: "USD" },
  contextWindow: 8192,
  benchmarks: { gpqaDiamond: 35.7, swebenchVerified: 3.4 },
  openWeights: false,
  epoch: {
    parameters: 1800000000000,
    trainingComputeFlop: 2.1e25,
    organization: "OpenAI",
  },
  sources: {
    releaseDate: "epoch",
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
});

const fable = model({
  id: "claude-fable-5",
  name: "Claude Fable 5",
  organization: "Anthropic",
  releaseDate: "2026-01-01",
  pricing: { inputPerMTok: 5, outputPerMTok: 25, currency: "USD" },
  contextWindow: 200000,
  benchmarks: { gpqaDiamond: 80, swebenchVerified: 75 },
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
});

const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [gpt4, fable],
  events: [
    {
      id: "gpt4-launch",
      date: "2023-03-14",
      title: "GPT-4 launches",
      body: "OpenAI releases GPT-4.",
      modelIds: ["gpt-4"],
    },
  ],
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("model.js locale/exponent count formatting (W5.S3)", () => {
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

  function overlayFor(id) {
    return renderModel({ route: { view: "model", id }, data: fixture });
  }

  function ddFor(el, label) {
    const terms = [...el.querySelectorAll("dt")];
    const term = terms.find((dt) => dt.textContent === label);
    return term.nextElementSibling;
  }

  it("renders parameters with en-US locale grouping", () => {
    const dd = ddFor(overlayFor("gpt-4"), "Parameters");
    expect(dd.textContent).toContain("1,800,000,000,000");
  });

  it("keeps the exact stored digits visible alongside the locale form", () => {
    const dd = ddFor(overlayFor("gpt-4"), "Parameters");
    expect(dd.textContent).toContain("1800000000000");
  });

  it("renders values already in exponent notation in exponent form", () => {
    const dd = ddFor(overlayFor("gpt-4"), "Training compute (FLOP)");
    expect(dd.textContent).toContain(String(2.1e25));
    expect(dd.textContent).toContain("e+25");
  });

  it("never alters the stored values while formatting", () => {
    overlayFor("gpt-4");
    expect(gpt4.epoch.parameters).toBe(1800000000000);
    expect(gpt4.epoch.trainingComputeFlop).toBe(2.1e25);
  });

  it("renders null parameters and compute as MISSING, never a default", () => {
    const el = overlayFor("claude-fable-5");
    expect(ddFor(el, "Parameters").textContent.trim()).toBe(MISSING);
    expect(ddFor(el, "Training compute (FLOP)").textContent.trim()).toBe(
      MISSING
    );
    expect(el.textContent).not.toContain("0 (");
  });

  it("keeps the two-column definition list class on both lists", () => {
    const lists = [...overlayFor("gpt-4").querySelectorAll("dl")];
    expect(lists.length).toBeGreaterThanOrEqual(2);
    for (const list of lists) {
      expect(list.classList.contains("grid-2")).toBe(true);
    }
  });

  it("does not import a locale helper from util.js (formatting is local)", () => {
    const source = readFileSync(
      path.join(root, "docs", "js", "views", "model.js"),
      "utf8"
    );
    expect(source).toContain('toLocaleString("en-US")');
  });
});

describe("model route overlays the live catalog with a scrim (W5.S3)", () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  let dom;
  const fetchCalls = [];

  beforeAll(async () => {
    dom = new JSDOM(
      '<!DOCTYPE html><html lang="en"><body>' +
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

  it("still performs exactly one relative artifact load", () => {
    expect(fetchCalls).toEqual(["data/models.json"]);
  });

  it("renders BOTH the catalog table and the overlay at the model route", async () => {
    await goto("#/model/gpt-4");
    const doc = dom.window.document;
    const app = doc.querySelector("#app");
    expect(app.querySelector(".view-catalog table tbody tr[data-model-id]"))
      .not.toBeNull();
    expect(
      app.querySelectorAll(".view-catalog tbody tr[data-model-id]")
    ).toHaveLength(2);
    expect(app.querySelector("#model-overlay")).not.toBeNull();
    expect(app.querySelector("#model-overlay h2").textContent).toBe("GPT-4");
  });

  it("places the scrim between the catalog and the overlay in DOM order", () => {
    const app = dom.window.document.querySelector("#app");
    const children = [...app.children];
    const catalogIdx = children.findIndex((el) =>
      el.classList.contains("view-catalog")
    );
    const scrimIdx = children.findIndex((el) =>
      el.classList.contains("overlay-scrim")
    );
    const overlayIdx = children.findIndex((el) => el.id === "model-overlay");
    expect(catalogIdx).toBeGreaterThanOrEqual(0);
    expect(scrimIdx).toBeGreaterThan(catalogIdx);
    expect(overlayIdx).toBeGreaterThan(scrimIdx);
  });

  it("shows the formatted parameter count in the live overlay", () => {
    const overlay = dom.window.document.querySelector("#model-overlay");
    expect(overlay.textContent).toContain("1,800,000,000,000");
  });

  it("keeps provenance badges rendering at the model route (W3.S2)", () => {
    const overlay = dom.window.document.querySelector("#model-overlay");
    const epochTags = overlay.querySelectorAll('.badge[data-source="epoch"]');
    expect(epochTags.length).toBeGreaterThan(0);
    expect(epochTags[0].textContent).toBe("Epoch");
  });

  it("keeps the injected Close button working over the catalog", async () => {
    const doc = dom.window.document;
    const close = doc.querySelector(
      '#model-overlay [data-action="overlay-close"]'
    );
    expect(close).not.toBeNull();
    click(close);
    await tick();
    expect(dom.window.location.hash).toBe("#/catalog");
    expect(doc.querySelector("#model-overlay")).toBeNull();
    expect(doc.querySelector(".overlay-scrim")).toBeNull();
    expect(doc.querySelector(".view-catalog")).not.toBeNull();
  });

  it("closes the overlay when the scrim itself is clicked", async () => {
    await goto("#/model/gpt-4");
    const doc = dom.window.document;
    const scrim = doc.querySelector("#app .overlay-scrim");
    expect(scrim).not.toBeNull();
    click(scrim);
    await tick();
    expect(dom.window.location.hash).toBe("#/catalog");
    expect(doc.querySelector("#model-overlay")).toBeNull();
    expect(doc.querySelector(".overlay-scrim")).toBeNull();
  });

  it("renders MISSING enrichment over the catalog for claude-fable-5", async () => {
    await goto("#/model/claude-fable-5");
    const doc = dom.window.document;
    const overlay = doc.querySelector("#model-overlay");
    expect(overlay).not.toBeNull();
    expect(doc.querySelector("#app .view-catalog")).not.toBeNull();
    expect(overlay.textContent).toContain(MISSING);
    expect(overlay.textContent).toContain("Claude Fable 5");
    await goto("#/catalog");
  });

  it("keeps catalog row selection behavior intact after overlay round trips", async () => {
    const doc = dom.window.document;
    const row = doc.querySelector('#app tr[data-model-id="gpt-4"]');
    click(row);
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(
      doc
        .querySelector('#site-header a[data-nav="compare"]')
        .getAttribute("href")
    ).toBe("#/compare?ids=gpt-4");
    click(row);
    expect(row.getAttribute("aria-selected")).toBe("false");
  });
});
