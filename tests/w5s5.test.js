// W5.S5: compare bar-row 3-cell alignment and docked compare tray.
//
// Root defects covered: null rows rendered as run-on text ("GPT-4" glued to
// the missing marker) because name and value were not isolated cells, and the
// fixed tray covered bar rows because it lacked a collapsed docked state.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import {
  render,
  toggleCompareId,
  MAX_COMPARE,
} from "../docs/js/views/compare.js";
import { MISSING } from "../docs/js/util.js";

// Complete ModelRecord fixture factory (schema 12.1); overrides win.
function makeModel(overrides) {
  return {
    id: "model-x",
    name: "Model X",
    organization: "Some Lab",
    releaseDate: "2024-01-01",
    epochName: null,
    pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
    contextWindow: null,
    benchmarks: { gpqaDiamond: null, swebenchVerified: null },
    openWeights: false,
    epoch: { parameters: null, trainingComputeFlop: null, organization: null },
    sources: {},
    ...overrides,
  };
}

const modelA = makeModel({
  id: "alpha-1",
  name: "Alpha 1",
  organization: "Alpha Lab",
  pricing: { inputPerMTok: 2, outputPerMTok: 10, currency: "USD" },
  contextWindow: 100000,
  benchmarks: { gpqaDiamond: 50, swebenchVerified: 25 },
});

// gamma-3 has nulls: input price, GPQA Diamond.
const modelC = makeModel({
  id: "gamma-3",
  name: "Gamma 3",
  organization: "Gamma Inc",
  pricing: { inputPerMTok: null, outputPerMTok: 20, currency: "USD" },
  contextWindow: 200000,
  benchmarks: { gpqaDiamond: null, swebenchVerified: 100 },
});

// delta-4 is all-null.
const modelD = makeModel({ id: "delta-4", name: "Delta 4" });

const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [modelA, modelC, modelD],
  events: [],
};

function renderCompare(ids) {
  return render({ route: { view: "compare", ids }, data: fixture });
}

function groupRow(el, metric, modelId) {
  const row = el.querySelector(
    '.bar-group[data-metric="' +
      metric +
      '"] .bar-row[data-model-id="' +
      modelId +
      '"]'
  );
  expect(row).not.toBeNull();
  return row;
}

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

describe("bar-row 3-cell structure", () => {
  it("renders every row as exactly three sibling cells in order", () => {
    const el = renderCompare(["alpha-1", "gamma-3", "delta-4"]);
    const rows = el.querySelectorAll(".bar-row");
    expect(rows.length).toBe(15); // 3 models x 5 metrics
    for (const row of rows) {
      const cells = [...row.children];
      expect(cells).toHaveLength(3);
      expect(cells[0].classList.contains("bar-label")).toBe(true);
      expect(cells[1].classList.contains("bar-cell")).toBe(true);
      expect(cells[2].classList.contains("bar-value")).toBe(true);
      // Genuine siblings under the row, not nested in one another.
      for (const cell of cells) {
        expect(cell.parentElement).toBe(row);
      }
    }
  });

  it("keeps name and value isolated so text never runs together", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);

    // Null metric: the name cell holds only the name and the value cell
    // holds only MISSING; nothing concatenates them into one text node.
    const row = groupRow(el, "input-price", "gamma-3");
    const name = row.querySelector(".bar-label");
    const value = row.querySelector(".bar-value");
    expect(name.textContent).toBe("Gamma 3");
    expect(value.textContent).toBe(MISSING);
    expect(name.textContent).not.toContain(MISSING);
    // No direct text nodes on the row itself gluing cells together.
    const looseText = [...row.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .trim();
    expect(looseText).toBe("");
  });

  it("puts the bar inside the middle cell for non-null values", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const row = groupRow(el, "output-price", "alpha-1");
    const cell = row.querySelector(".bar-cell");
    const track = cell.querySelector(".bar-track");
    expect(track).not.toBeNull();
    const bar = track.querySelector(".bar");
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe("50%"); // 10 of max 20
    expect(row.querySelector(".bar-value").textContent).toBe("$10.00");
  });

  it("renders null rows with an empty bar cell and no bar element", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    for (const metric of ["input-price", "gpqa-diamond"]) {
      const row = groupRow(el, metric, "gamma-3");
      expect(row.classList.contains("bar-row-missing")).toBe(true);
      const cell = row.querySelector(".bar-cell");
      expect(cell).not.toBeNull();
      expect(cell.children).toHaveLength(0);
      expect(cell.textContent).toBe("");
      expect(row.querySelector(".bar")).toBeNull();
      expect(row.querySelector(".bar-track")).toBeNull();
      expect(row.querySelector(".bar-value").textContent).toBe(MISSING);
    }
  });

  it("renders an all-null model with three cells and no bars in any group", () => {
    const el = renderCompare(["alpha-1", "delta-4"]);
    for (const group of el.querySelectorAll(".bar-group")) {
      const row = group.querySelector('.bar-row[data-model-id="delta-4"]');
      expect(row).not.toBeNull();
      expect(row.children).toHaveLength(3);
      expect(row.querySelector(".bar")).toBeNull();
      expect(row.querySelector(".bar-cell").children).toHaveLength(0);
      expect(row.querySelector(".bar-value").textContent).toBe(MISSING);
    }
  });
});

describe("docked tray (.tray-docked)", () => {
  it("renders a details.tray-docked inside #compare-tray, collapsed by default", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const tray = el.querySelector("#compare-tray");
    expect(tray).not.toBeNull();
    expect(tray.classList.contains("glass")).toBe(true);
    const dock = tray.querySelector("details.tray-docked");
    expect(dock).not.toBeNull();
    expect(dock.tagName).toBe("DETAILS");
    expect(dock.open).toBe(false);
    // Glass identity stays on #compare-tray only.
    expect(dock.classList.contains("glass")).toBe(false);
  });

  it("shows a one-line count summary while collapsed", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const summary = el.querySelector("#compare-tray .tray-docked > summary");
    expect(summary).not.toBeNull();
    expect(summary.textContent).toBe("2 of 3 selected");
  });

  it("toggles open and closed", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const dock = el.querySelector("#compare-tray .tray-docked");
    const summary = dock.querySelector("summary");
    expect(dock.open).toBe(false);
    summary.click();
    expect(dock.open).toBe(true);
    summary.click();
    expect(dock.open).toBe(false);
  });

  it("keeps working compare-remove buttons in the expanded body", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const dock = el.querySelector("#compare-tray .tray-docked");
    dock.open = true;
    const buttons = dock.querySelectorAll('[data-action="compare-remove"]');
    expect(buttons).toHaveLength(2);
    expect([...buttons].map((b) => b.dataset.modelId)).toEqual([
      "alpha-1",
      "gamma-3",
    ]);
  });

  it("renders the empty selection as a collapsed zero count with no list", () => {
    const el = renderCompare([]);
    const tray = el.querySelector("#compare-tray");
    const summary = tray.querySelector(".tray-docked > summary");
    expect(summary.textContent).toBe("0 of 3 selected");
    expect(tray.querySelectorAll("li")).toHaveLength(0);
  });
});

describe("3-model cap still holds", () => {
  it("makes a 4th selection impossible via toggleCompareId", () => {
    expect(MAX_COMPARE).toBe(3);
    const full = ["alpha-1", "gamma-3", "delta-4"];
    const after = toggleCompareId(full, "someone-else");
    expect(after).toEqual(full);
    expect(after).not.toBe(full); // pure: returns a copy, never mutates
  });

  it("caps rendering at three models from a hand-typed URL", () => {
    const el = renderCompare(["alpha-1", "gamma-3", "delta-4", "model-x"]);
    expect(
      el.querySelector("#compare-tray").querySelectorAll("li")
    ).toHaveLength(3);
    expect(
      el.querySelector("#compare-tray .tray-docked > summary").textContent
    ).toBe("3 of 3 selected");
    for (const group of el.querySelectorAll(".bar-group")) {
      expect(group.querySelectorAll(".bar-row")).toHaveLength(3);
    }
  });
});
