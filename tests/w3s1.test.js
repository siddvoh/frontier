import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import { MISSING } from "../docs/js/util.js";
import {
  render as renderCatalog,
  filterModels,
  sortModels,
  SORT_KEYS,
} from "../docs/js/views/catalog.js";
import {
  render as renderTimeline,
  leftPercent,
  TIMELINE_START,
} from "../docs/js/views/timeline.js";

// generatedAt exactly four days after TIMELINE_START so fixture dates land
// on hand-computable offsets: 03-02 -> 25%, 03-03 -> 50%, 03-04 -> 75%.
const GENERATED_AT = "2023-03-05T00:00:00.000Z";

function model(overrides) {
  return {
    id: "x-0",
    name: "X 0",
    organization: "X Lab",
    releaseDate: null,
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

const alpha = model({
  id: "alpha-1",
  name: "Alpha 1",
  organization: "Alpha Lab",
  releaseDate: "2023-03-02",
  pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
  contextWindow: 200000,
  benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
  openWeights: false,
});

const beta = model({
  id: "beta-2",
  name: "Beta 2",
  organization: "Beta Corp",
});

const gamma = model({
  id: "gamma-3",
  name: "Gamma 3",
  organization: "Alpha Lab",
  releaseDate: "2023-03-03",
  pricing: { inputPerMTok: 1, outputPerMTok: 6, currency: "USD" },
  contextWindow: 1000000,
  benchmarks: { gpqaDiamond: 80, swebenchVerified: 70 },
  openWeights: true,
});

const delta = model({
  id: "delta-4",
  name: "Delta 4",
  organization: "Delta AI",
  releaseDate: "2023-03-04",
  pricing: { inputPerMTok: 10, outputPerMTok: 50, currency: "USD" },
  contextWindow: 128000,
  benchmarks: { gpqaDiamond: null, swebenchVerified: 55 },
  openWeights: true,
});

const MODELS = [alpha, beta, gamma, delta];

const EVENT = {
  id: "gamma-export-pause",
  date: "2023-03-03",
  title: "Gamma 3 export pause",
  body: "Alpha Lab pauses Gamma 3 weight exports.",
  modelIds: ["gamma-3"],
};

const fixture = {
  generatedAt: GENERATED_AT,
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: MODELS,
  events: [EVENT],
};

let dom;
const savedDocument = globalThis.document;
const savedFetch = globalThis.fetch;

beforeAll(() => {
  dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not call fetch");
  };
});

afterAll(() => {
  globalThis.document = savedDocument;
  globalThis.fetch = savedFetch;
});

function renderFixtureCatalog() {
  return renderCatalog({ route: { view: "catalog" }, data: fixture });
}

function rowIds(el) {
  return [...el.querySelectorAll("tbody tr")].map((r) => r.dataset.modelId);
}

function change(control) {
  control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function input(control) {
  control.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

describe("catalog rows (C30, C20)", () => {
  it("renders one row per model with every C30 field", () => {
    const el = renderFixtureCatalog();
    expect(el.querySelectorAll("tbody tr")).toHaveLength(MODELS.length);
    const row = el.querySelector('tr[data-model-id="alpha-1"]');
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells).toEqual([
      "Alpha 1",
      "Alpha Lab",
      "2023-03-02",
      "$3.00",
      "$15.00",
      "200,000",
      "60.1",
      "40.2",
      "closed",
    ]);
  });

  it("links each model name to its #/model/:id route", () => {
    const el = renderFixtureCatalog();
    const link = el.querySelector('tr[data-model-id="gamma-3"] a');
    expect(link.getAttribute("href")).toBe("#/model/gamma-3");
  });

  it("keeps all-null models in the catalog, rendered as MISSING", () => {
    const el = renderFixtureCatalog();
    const row = el.querySelector('tr[data-model-id="beta-2"]');
    expect(row).not.toBeNull();
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells).toEqual([
      "Beta 2",
      "Beta Corp",
      MISSING,
      MISSING,
      MISSING,
      MISSING,
      MISSING,
      MISSING,
      MISSING,
    ]);
  });
});

describe("catalog filters (C30)", () => {
  it("filters by organization multi-select", () => {
    const el = renderFixtureCatalog();
    const select = el.querySelector("#catalog-filter-org");
    [...select.options].find((o) => o.value === "Alpha Lab").selected = true;
    change(select);
    expect(rowIds(el).sort()).toEqual(["alpha-1", "gamma-3"]);

    [...select.options].find((o) => o.value === "Beta Corp").selected = true;
    change(select);
    expect(rowIds(el).sort()).toEqual(["alpha-1", "beta-2", "gamma-3"]);
  });

  it("filters by the open-weights toggle, excluding null openWeights", () => {
    const el = renderFixtureCatalog();
    const toggle = el.querySelector("#catalog-filter-open");
    toggle.checked = true;
    change(toggle);
    expect(rowIds(el).sort()).toEqual(["delta-4", "gamma-3"]);

    toggle.checked = false;
    change(toggle);
    expect(rowIds(el)).toHaveLength(MODELS.length);
  });

  it("filters by free-text name, case-insensitively", () => {
    const el = renderFixtureCatalog();
    const box = el.querySelector("#catalog-filter-name");
    box.value = "ALPHA";
    input(box);
    expect(rowIds(el)).toEqual(["alpha-1"]);
  });

  it("shows an empty state instead of rows when nothing matches", () => {
    const el = renderFixtureCatalog();
    const box = el.querySelector("#catalog-filter-name");
    box.value = "zzz-no-such-model";
    input(box);
    expect(rowIds(el)).toEqual([undefined]);
    expect(el.querySelector("tbody").textContent).toContain("No models match");
  });

  it("filterModels combines all three filters", () => {
    const kept = filterModels(MODELS, {
      organizations: ["Alpha Lab", "Delta AI"],
      openWeightsOnly: true,
      nameQuery: "gam",
    });
    expect(kept.map((m) => m.id)).toEqual(["gamma-3"]);
  });
});

describe("catalog sorting with nulls last in both directions (C30)", () => {
  // Non-null ids in ascending order of the sort field, per key.
  const ascOrders = {
    releaseDate: ["alpha-1", "gamma-3", "delta-4"],
    inputPrice: ["gamma-3", "alpha-1", "delta-4"],
    outputPrice: ["gamma-3", "alpha-1", "delta-4"],
    contextWindow: ["delta-4", "alpha-1", "gamma-3"],
    gpqaDiamond: ["alpha-1", "gamma-3"],
    swebenchVerified: ["alpha-1", "delta-4", "gamma-3"],
  };

  for (const key of Object.keys(SORT_KEYS)) {
    it(`sorts by ${key} with nulls last both ways`, () => {
      const asc = ascOrders[key];
      const nullIds = MODELS.filter((m) => SORT_KEYS[key](m) === null)
        .map((m) => m.id)
        .sort();
      expect(sortModels(MODELS, key, "asc").map((m) => m.id)).toEqual([
        ...asc,
        ...nullIds,
      ]);
      expect(sortModels(MODELS, key, "desc").map((m) => m.id)).toEqual([
        ...[...asc].reverse(),
        ...nullIds,
      ]);
    });
  }

  it("covers every SORT_KEYS entry in the expectations above", () => {
    expect(Object.keys(ascOrders).sort()).toEqual(
      Object.keys(SORT_KEYS).sort()
    );
  });

  it("breaks exact ties by id ascending in both directions", () => {
    const a = model({
      id: "tie-a",
      pricing: { inputPerMTok: 5, outputPerMTok: 5, currency: "USD" },
    });
    const b = model({
      id: "tie-b",
      pricing: { inputPerMTok: 5, outputPerMTok: 5, currency: "USD" },
    });
    for (const dir of ["asc", "desc"]) {
      expect(sortModels([b, a], "inputPrice", dir).map((m) => m.id)).toEqual([
        "tie-a",
        "tie-b",
      ]);
    }
  });

  it("re-sorts the table through the sort controls", () => {
    const el = renderFixtureCatalog();
    // Default: release date descending, nulls last.
    expect(rowIds(el)).toEqual(["delta-4", "gamma-3", "alpha-1", "beta-2"]);

    const key = el.querySelector("#catalog-sort-key");
    const dir = el.querySelector("#catalog-sort-dir");
    key.value = "gpqaDiamond";
    change(key);
    dir.value = "asc";
    change(dir);
    expect(rowIds(el)).toEqual(["alpha-1", "gamma-3", "beta-2", "delta-4"]);
  });
});

describe("form control labels (C35)", () => {
  it("associates a label with every catalog form control", () => {
    const el = renderFixtureCatalog();
    const controls = [...el.querySelectorAll("input, select, textarea")];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.id, control.outerHTML).not.toBe("");
      const label = el.querySelector(`label[for="${control.id}"]`);
      expect(label, control.id).not.toBeNull();
      expect(label.textContent).not.toBe("");
    }
  });
});

describe("timeline strip (C34)", () => {
  function renderFixtureTimeline() {
    return renderTimeline({
      models: MODELS,
      events: [EVENT],
      generatedAt: GENERATED_AT,
    });
  }

  it("maps x linearly from 2023-03-01 to generatedAt", () => {
    expect(TIMELINE_START).toBe("2023-03-01");
    expect(leftPercent("2023-03-01", GENERATED_AT)).toBe(0);
    expect(leftPercent("2023-03-02", GENERATED_AT)).toBe(25);
    expect(leftPercent("2023-03-03", GENERATED_AT)).toBe(50);
    expect(leftPercent("2023-03-04", GENERATED_AT)).toBe(75);
    expect(leftPercent(GENERATED_AT, GENERATED_AT)).toBe(100);
  });

  it("positions a labeled dot per dated model at its computed left offset", () => {
    const el = renderFixtureTimeline();
    const dots = [...el.querySelectorAll(".timeline-dot")];
    expect(dots.map((d) => d.textContent)).toEqual([
      "Alpha 1",
      "Gamma 3",
      "Delta 4",
    ]);
    expect(dots.map((d) => d.style.left)).toEqual(["25%", "50%", "75%"]);
    expect(dots.map((d) => d.style.position)).toEqual([
      "absolute",
      "absolute",
      "absolute",
    ]);
  });

  it("omits models whose releaseDate is null", () => {
    const el = renderFixtureTimeline();
    expect(el.textContent).not.toContain("Beta 2");
    expect(el.querySelectorAll(".timeline-dot")).toHaveLength(3);
  });

  it("navigates to #/model/:id from each dot", () => {
    const el = renderFixtureTimeline();
    const hrefs = [...el.querySelectorAll(".timeline-dot")].map((d) =>
      d.getAttribute("href")
    );
    expect(hrefs).toEqual([
      "#/model/alpha-1",
      "#/model/gamma-3",
      "#/model/delta-4",
    ]);
  });

  it("styles event markers with the accent token at the event date", () => {
    const el = renderFixtureTimeline();
    const marker = el.querySelector(".timeline-event");
    expect(marker).not.toBeNull();
    expect(marker.style.left).toBe("50%");
    expect(marker.getAttribute("style")).toContain("var(--accent)");
  });

  it("reveals the event title and body on marker click", () => {
    const el = renderFixtureTimeline();
    const marker = el.querySelector(".timeline-event");
    const detail = el.querySelector(".timeline-event-detail");
    expect(detail.hidden).toBe(true);

    marker.click();
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain(EVENT.title);
    expect(detail.textContent).toContain(EVENT.body);

    marker.click();
    expect(detail.hidden).toBe(true);
  });

  it("uses pure HTML/CSS positioning: no canvas, no SVG", () => {
    const el = renderFixtureTimeline();
    expect(el.querySelector("canvas")).toBeNull();
    expect(el.querySelector("svg")).toBeNull();
  });

  it("is embedded in the catalog view", () => {
    const el = renderFixtureCatalog();
    const strip = el.querySelector(".timeline");
    expect(strip).not.toBeNull();
    expect(strip.querySelectorAll(".timeline-dot")).toHaveLength(3);
  });
});
