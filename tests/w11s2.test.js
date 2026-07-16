// W11.S2 (re-issued): catalog markup polish. Organization filter as labeled
// checkbox chips, the ONLY organization control (multi-select semantics kept,
// C30, C35); name cells .nowrap with the organization as a muted second line
// under the name; numeric cells .num, weights as a .badge, MISSING handling
// intact (C20).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import { MISSING } from "../docs/js/util.js";
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
const ORGS = ["Alpha Lab", "Beta Corp", "Delta AI"];

const fixture = {
  generatedAt: GENERATED_AT,
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: MODELS,
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

function rowIds(el) {
  return [...el.querySelectorAll("tbody tr")].map((r) => r.dataset.modelId);
}

function change(control) {
  control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function input(control) {
  control.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function chipBoxes(el) {
  return [...el.querySelectorAll(".chip-set .chip input")];
}

function chipFor(el, org) {
  return chipBoxes(el).find((box) => box.value === org);
}

function toggleChip(el, org, checked) {
  const box = chipFor(el, org);
  box.checked = checked;
  change(box);
}

function cellsFor(el, id) {
  return [...el.querySelectorAll(`tr[data-model-id="${id}"] td`)];
}

describe("organization chip markup (C30, C35)", () => {
  it("renders a .chip-set with one .chip per organization, sorted", () => {
    const el = renderFixtureCatalog();
    const set = el.querySelectorAll(".chip-set");
    expect(set).toHaveLength(1);
    const chips = [...set[0].querySelectorAll(".chip")];
    expect(chips).toHaveLength(ORGS.length);
    expect(chipBoxes(el).map((box) => box.value)).toEqual(ORGS);
  });

  it("builds each chip as a label wrapping its checkbox plus text", () => {
    const el = renderFixtureCatalog();
    for (const chip of el.querySelectorAll(".chip-set .chip")) {
      expect(chip.tagName).toBe("LABEL");
      const box = chip.querySelector('input[type="checkbox"]');
      expect(box).not.toBeNull();
      expect(box.id).not.toBe("");
      expect(chip.getAttribute("for")).toBe(box.id);
      expect(chip.textContent).toBe(box.value);
    }
  });

  it("gives every chip checkbox an explicitly associated label (C35)", () => {
    const el = renderFixtureCatalog();
    const boxes = chipBoxes(el);
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      const label = el.querySelector(`label[for="${box.id}"]`);
      expect(label, box.id).not.toBeNull();
      expect(label.textContent).not.toBe("");
    }
  });

  it("uses unique ids across chip checkboxes and bar controls", () => {
    const el = renderFixtureCatalog();
    const ids = [...el.querySelectorAll("input, select")].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the chip group for what it filters", () => {
    const el = renderFixtureCatalog();
    const legend = el.querySelector(".chip-set legend");
    expect(legend).not.toBeNull();
    expect(legend.textContent).toBe("Organization");
  });

  it("keeps chip checkboxes out of the pinned .filter-bar control row", () => {
    const el = renderFixtureCatalog();
    expect(el.querySelector(".filter-bar .chip")).toBeNull();
    const barIds = [
      ...el.querySelectorAll(".filter-bar input, .filter-bar select"),
    ].map((c) => c.id);
    expect(barIds).toEqual([
      "catalog-filter-name",
      "catalog-filter-open",
      "catalog-sort-key",
      "catalog-sort-dir",
    ]);
    // The chip set sits directly beside the bar inside the view section.
    const set = el.querySelector(".chip-set");
    expect(set.parentElement).toBe(el);
    expect(set.previousElementSibling.classList.contains("filter-bar")).toBe(
      true
    );
  });

  it("makes the chips the only organization control: no backing select", () => {
    const el = renderFixtureCatalog();
    expect(el.querySelector("#catalog-filter-org")).toBeNull();
    // The only selects left are the two sort controls.
    const selectIds = [...el.querySelectorAll("select")].map((s) => s.id);
    expect(selectIds).toEqual(["catalog-sort-key", "catalog-sort-dir"]);
  });
});

describe("chips drive the multi-organization filter (C30)", () => {
  it("filters rows to the checked chip's organization", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Alpha Lab", true);
    expect(rowIds(el).sort()).toEqual(["alpha-1", "gamma-3"]);
  });

  it("is multi-select: two checked chips union their organizations", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Alpha Lab", true);
    toggleChip(el, "Delta AI", true);
    expect(rowIds(el).sort()).toEqual(["alpha-1", "delta-4", "gamma-3"]);

    toggleChip(el, "Alpha Lab", false);
    expect(rowIds(el)).toEqual(["delta-4"]);

    toggleChip(el, "Delta AI", false);
    expect(rowIds(el)).toHaveLength(MODELS.length);
  });

  it("treats an unchecked chip set as no organization filter", () => {
    const el = renderFixtureCatalog();
    expect(chipBoxes(el).every((box) => !box.checked)).toBe(true);
    expect(rowIds(el)).toHaveLength(MODELS.length);
  });

  it("re-checking a chip after unchecking restores its filter", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Delta AI", true);
    expect(rowIds(el)).toEqual(["delta-4"]);
    toggleChip(el, "Delta AI", false);
    expect(rowIds(el)).toHaveLength(MODELS.length);
    toggleChip(el, "Delta AI", true);
    expect(chipFor(el, "Delta AI").checked).toBe(true);
    expect(rowIds(el)).toEqual(["delta-4"]);
  });

  it("combines chips with the open-weights toggle and name filter", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Alpha Lab", true);
    const toggle = el.querySelector("#catalog-filter-open");
    toggle.checked = true;
    change(toggle);
    expect(rowIds(el)).toEqual(["gamma-3"]);

    const box = el.querySelector("#catalog-filter-name");
    box.value = "alpha";
    input(box);
    expect(rowIds(el)).toEqual([undefined]);
    expect(el.querySelector("tbody").textContent).toContain("No models match");
  });
});

describe("table cell classes and badges (C30, C20)", () => {
  it("marks name cells .nowrap and keeps the model link inside", () => {
    const el = renderFixtureCatalog();
    for (const m of MODELS) {
      const cells = cellsFor(el, m.id);
      expect(cells[0].classList.contains("nowrap"), m.id).toBe(true);
      const link = cells[0].querySelector("a");
      expect(link.getAttribute("href")).toBe("#/model/" + m.id);
      expect(link.textContent).toBe(m.name);
    }
  });

  it("renders the organization as a muted second line under the name", () => {
    const el = renderFixtureCatalog();
    for (const m of MODELS) {
      const cells = cellsFor(el, m.id);
      const orgLine = cells[0].querySelector(".muted");
      expect(orgLine, m.id).not.toBeNull();
      expect(orgLine.textContent).toBe(m.organization);
      // A block element after the name link, so it reads as a second line.
      expect(orgLine.tagName).toBe("DIV");
      expect(orgLine.previousElementSibling.tagName).toBe("A");
    }
  });

  it("right-aligns numeric columns with .num, MISSING cells included", () => {
    const el = renderFixtureCatalog();
    const NUM_INDEXES = [2, 3, 4, 5, 6];
    for (const id of ["alpha-1", "beta-2"]) {
      const cells = cellsFor(el, id);
      expect(cells).toHaveLength(8);
      cells.forEach((td, index) => {
        expect(td.classList.contains("num"), `${id} col ${index}`).toBe(
          NUM_INDEXES.includes(index)
        );
      });
    }
    // Null stats still render the shared MISSING constant with .num intact.
    const betaCells = cellsFor(el, "beta-2");
    for (const index of NUM_INDEXES) {
      expect(betaCells[index].textContent).toBe(MISSING);
    }
  });

  it("renders the weights value as a .badge for open and closed", () => {
    const el = renderFixtureCatalog();
    const closed = cellsFor(el, "alpha-1")[7].querySelector("span.badge");
    expect(closed).not.toBeNull();
    expect(closed.textContent).toBe("closed");
    const open = cellsFor(el, "gamma-3")[7].querySelector("span.badge");
    expect(open.textContent).toBe("open");
    // The cell's own text stays the bare value for the pinned row contract.
    expect(cellsFor(el, "alpha-1")[7].textContent).toBe("closed");
  });

  it("renders null weights as plain MISSING with no empty badge (C20)", () => {
    const el = renderFixtureCatalog();
    const cell = cellsFor(el, "beta-2")[7];
    expect(cell.textContent).toBe(MISSING);
    expect(cell.querySelector(".badge")).toBeNull();
  });

  it("keeps cell classes and badges after a chip-driven re-render", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Alpha Lab", true);
    const cells = cellsFor(el, "gamma-3");
    expect(cells[0].classList.contains("nowrap")).toBe(true);
    expect(cells[0].querySelector(".muted").textContent).toBe("Alpha Lab");
    expect(cells[4].classList.contains("num")).toBe(true);
    expect(cells[7].querySelector("span.badge").textContent).toBe("open");
  });
});

describe("filter and sort regressions through the new markup (C30)", () => {
  it("keeps the default sort: release date descending, nulls last", () => {
    const el = renderFixtureCatalog();
    expect(rowIds(el)).toEqual(["delta-4", "gamma-3", "alpha-1", "beta-2"]);
  });

  it("re-sorts chip-filtered rows through the sort controls", () => {
    const el = renderFixtureCatalog();
    toggleChip(el, "Alpha Lab", true);
    const key = el.querySelector("#catalog-sort-key");
    const dir = el.querySelector("#catalog-sort-dir");
    key.value = "inputPrice";
    change(key);
    dir.value = "asc";
    change(dir);
    expect(rowIds(el)).toEqual(["gamma-3", "alpha-1"]);
  });
});
