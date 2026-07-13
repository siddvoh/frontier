import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import { render as renderCatalog } from "../docs/js/views/catalog.js";

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

const fixture = {
  generatedAt: GENERATED_AT,
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [alpha, beta],
  events: [],
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

describe("table containment (W5.S4)", () => {
  it("wraps the catalog table in a .table-scroll container", () => {
    const el = renderFixtureCatalog();
    const table = el.querySelector("table");
    expect(table).not.toBeNull();
    expect(table.parentElement.classList.contains("table-scroll")).toBe(true);
    // The wrapper lives directly inside the view section, not the reverse.
    expect(el.querySelectorAll(".table-scroll > table")).toHaveLength(1);
  });

  it("keeps the .table-scroll wrapper inside the catalog section", () => {
    const el = renderFixtureCatalog();
    const wrapper = el.querySelector(".table-scroll");
    expect(wrapper.parentElement).toBe(el);
  });
});

describe("cell classes (W5.S4)", () => {
  // Column order: Name, Organization, Released, Input $/MTok, Output $/MTok,
  // Context window, GPQA Diamond, SWE-bench Verified, Weights.
  const NUM_INDEXES = [3, 4, 5, 6, 7];
  const DATE_INDEX = 2;

  it("marks release-date cells with .nowrap", () => {
    const el = renderFixtureCatalog();
    for (const id of ["alpha-1", "beta-2"]) {
      const cells = el.querySelectorAll(`tr[data-model-id="${id}"] td`);
      expect(cells[DATE_INDEX].classList.contains("nowrap"), id).toBe(true);
    }
  });

  it("marks every numeric cell with .num and no others", () => {
    const el = renderFixtureCatalog();
    for (const id of ["alpha-1", "beta-2"]) {
      const cells = [...el.querySelectorAll(`tr[data-model-id="${id}"] td`)];
      expect(cells).toHaveLength(9);
      cells.forEach((td, index) => {
        expect(td.classList.contains("num"), `${id} col ${index}`).toBe(
          NUM_INDEXES.includes(index)
        );
      });
    }
  });

  it("keeps cell classes after a re-render through the controls", () => {
    const el = renderFixtureCatalog();
    const box = el.querySelector("#catalog-filter-name");
    box.value = "alpha";
    box.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    const cells = [...el.querySelectorAll('tr[data-model-id="alpha-1"] td')];
    expect(cells[DATE_INDEX].classList.contains("nowrap")).toBe(true);
    for (const index of NUM_INDEXES) {
      expect(cells[index].classList.contains("num"), `col ${index}`).toBe(
        true
      );
    }
  });

  it("does not mark the name link cell or weights cell as numeric", () => {
    const el = renderFixtureCatalog();
    const cells = [...el.querySelectorAll('tr[data-model-id="alpha-1"] td')];
    expect(cells[0].querySelector("a")).not.toBeNull();
    expect(cells[0].classList.contains("num")).toBe(false);
    expect(cells[8].classList.contains("num")).toBe(false);
  });
});

describe("filter bar layout (W5.S4)", () => {
  it("emits .filter-bar controls in order: name, org, open, sort, dir", () => {
    const el = renderFixtureCatalog();
    const bar = el.querySelector(".filter-bar");
    expect(bar).not.toBeNull();
    const ids = [...bar.querySelectorAll("input, select")].map((c) => c.id);
    expect(ids).toEqual([
      "catalog-filter-name",
      "catalog-filter-org",
      "catalog-filter-open",
      "catalog-sort-key",
      "catalog-sort-dir",
    ]);
  });

  it("keeps the catalog-controls listener container class on the bar", () => {
    const el = renderFixtureCatalog();
    const bar = el.querySelector(".filter-bar");
    expect(bar.classList.contains("catalog-controls")).toBe(true);
  });

  it("keeps every control labeled after the reorder", () => {
    const el = renderFixtureCatalog();
    const bar = el.querySelector(".filter-bar");
    for (const control of bar.querySelectorAll("input, select")) {
      const label = bar.querySelector(`label[for="${control.id}"]`);
      expect(label, control.id).not.toBeNull();
      expect(label.textContent).not.toBe("");
    }
  });
});
