// W3.S3: compare view with proportional bars (C32, C20).

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

const modelB = makeModel({
  id: "beta-2",
  name: "Beta 2",
  organization: "Beta Corp",
  pricing: { inputPerMTok: 4, outputPerMTok: 5, currency: "USD" },
  contextWindow: 400000,
  benchmarks: { gpqaDiamond: 100, swebenchVerified: 50 },
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

const modelD = makeModel({ id: "delta-4", name: "Delta 4" });

const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [modelA, modelB, modelC, modelD],
  events: [],
};

function renderCompare(ids) {
  return render({ route: { view: "compare", ids }, data: fixture });
}

// Rows of one bar group keyed by model id.
function groupRows(el, metric) {
  const group = el.querySelector('.bar-group[data-metric="' + metric + '"]');
  expect(group).not.toBeNull();
  const rows = {};
  for (const row of group.querySelectorAll(".bar-row")) {
    rows[row.dataset.modelId] = row;
  }
  return rows;
}

function barWidth(row) {
  const bar = row.querySelector(".bar");
  expect(bar).not.toBeNull();
  return bar.style.width;
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

describe("compare view bar groups (C32)", () => {
  it("renders exactly five bar groups in the specified order", () => {
    const el = renderCompare(["alpha-1", "beta-2"]);
    const groups = el.querySelectorAll(".bar-group");
    expect(groups).toHaveLength(5);
    expect([...groups].map((g) => g.dataset.metric)).toEqual([
      "input-price",
      "output-price",
      "context-window",
      "gpqa-diamond",
      "swebench-verified",
    ]);
  });

  it("renders one row per compared model in every group", () => {
    const el = renderCompare(["alpha-1", "beta-2", "gamma-3"]);
    for (const group of el.querySelectorAll(".bar-group")) {
      expect(group.querySelectorAll(".bar-row")).toHaveLength(3);
    }
  });

  it("uses plain divs for bars", () => {
    const el = renderCompare(["alpha-1", "beta-2"]);
    for (const bar of el.querySelectorAll(".bar")) {
      expect(bar.tagName).toBe("DIV");
      expect(bar.querySelector("*")).toBeNull();
    }
  });

  it("sizes bars proportionally with the compared max at 100%", () => {
    const el = renderCompare(["alpha-1", "beta-2", "gamma-3"]);

    // Input price: 2, 4, null -> max 4.
    let rows = groupRows(el, "input-price");
    expect(barWidth(rows["alpha-1"])).toBe("50%");
    expect(barWidth(rows["beta-2"])).toBe("100%");

    // Output price: 10, 5, 20 -> max 20.
    rows = groupRows(el, "output-price");
    expect(barWidth(rows["alpha-1"])).toBe("50%");
    expect(barWidth(rows["beta-2"])).toBe("25%");
    expect(barWidth(rows["gamma-3"])).toBe("100%");

    // Context window: 100000, 400000, 200000 -> max 400000.
    rows = groupRows(el, "context-window");
    expect(barWidth(rows["alpha-1"])).toBe("25%");
    expect(barWidth(rows["beta-2"])).toBe("100%");
    expect(barWidth(rows["gamma-3"])).toBe("50%");

    // GPQA Diamond: 50, 100, null -> max 100.
    rows = groupRows(el, "gpqa-diamond");
    expect(barWidth(rows["alpha-1"])).toBe("50%");
    expect(barWidth(rows["beta-2"])).toBe("100%");

    // SWE-bench Verified: 25, 50, 100 -> max 100.
    rows = groupRows(el, "swebench-verified");
    expect(barWidth(rows["alpha-1"])).toBe("25%");
    expect(barWidth(rows["beta-2"])).toBe("50%");
    expect(barWidth(rows["gamma-3"])).toBe("100%");
  });

  it("recomputes the max from only the compared subset", () => {
    // Alone with gamma-3 (null input price), alpha-1's 2 becomes the max.
    const el = renderCompare(["alpha-1", "gamma-3"]);
    const rows = groupRows(el, "input-price");
    expect(barWidth(rows["alpha-1"])).toBe("100%");
  });
});

describe("null handling (C32, C20)", () => {
  it("renders a MISSING row with no bar for a null value", () => {
    const el = renderCompare(["alpha-1", "gamma-3"]);

    const inputRows = groupRows(el, "input-price");
    const gammaInput = inputRows["gamma-3"];
    expect(gammaInput.querySelector(".bar")).toBeNull();
    expect(gammaInput.querySelector(".bar-track")).toBeNull();
    expect(gammaInput.querySelector(".bar-value").textContent).toBe(MISSING);

    const gpqaRows = groupRows(el, "gpqa-diamond");
    expect(gpqaRows["gamma-3"].querySelector(".bar")).toBeNull();
    expect(gpqaRows["gamma-3"].textContent).toContain(MISSING);
  });

  it("keeps an all-null model in every group as MISSING rows", () => {
    const el = renderCompare(["alpha-1", "delta-4"]);
    for (const group of el.querySelectorAll(".bar-group")) {
      const row = group.querySelector('.bar-row[data-model-id="delta-4"]');
      expect(row).not.toBeNull();
      expect(row.querySelector(".bar")).toBeNull();
      expect(row.textContent).toContain(MISSING);
    }
  });

  it("renders one bar per non-null value overall", () => {
    // 3 models x 5 metrics = 15 cells, gamma-3 has 2 nulls -> 13 bars.
    const el = renderCompare(["alpha-1", "beta-2", "gamma-3"]);
    expect(el.querySelectorAll(".bar")).toHaveLength(13);
  });
});

describe("compare tray and the 3-model cap (C32)", () => {
  it("renders #compare-tray with the selected models", () => {
    const el = renderCompare(["alpha-1", "beta-2"]);
    const tray = el.querySelector("#compare-tray");
    expect(tray).not.toBeNull();
    expect(tray.querySelectorAll("li")).toHaveLength(2);
    expect(tray.textContent).toContain("Alpha 1");
    expect(tray.textContent).toContain("Beta 2");
    expect(tray.textContent).toContain("2 of 3 selected");
  });

  it("holds up to three selections", () => {
    const el = renderCompare(["alpha-1", "beta-2", "gamma-3"]);
    const tray = el.querySelector("#compare-tray");
    expect(tray.querySelectorAll("li")).toHaveLength(3);
    expect(tray.textContent).toContain("3 of 3 selected");
  });

  it("makes selecting a 4th model impossible via toggleCompareId", () => {
    expect(MAX_COMPARE).toBe(3);
    const full = ["alpha-1", "beta-2", "gamma-3"];
    const after = toggleCompareId(full, "delta-4");
    expect(after).toEqual(full);
    expect(after).not.toContain("delta-4");
    expect(full).toEqual(["alpha-1", "beta-2", "gamma-3"]);
  });

  it("adds below the cap and toggles off an existing selection", () => {
    expect(toggleCompareId([], "alpha-1")).toEqual(["alpha-1"]);
    expect(toggleCompareId(["alpha-1"], "beta-2")).toEqual([
      "alpha-1",
      "beta-2",
    ]);
    expect(toggleCompareId(["alpha-1", "beta-2", "gamma-3"], "beta-2")).toEqual(
      ["alpha-1", "gamma-3"]
    );
    const before = ["alpha-1", "beta-2"];
    toggleCompareId(before, "gamma-3");
    expect(before).toEqual(["alpha-1", "beta-2"]);
  });

  it("caps rendering at three models even from a hand-typed URL", () => {
    const el = renderCompare(["alpha-1", "beta-2", "gamma-3", "delta-4"]);
    expect(el.querySelector("#compare-tray").querySelectorAll("li")).toHaveLength(
      3
    );
    for (const group of el.querySelectorAll(".bar-group")) {
      expect(group.querySelectorAll(".bar-row")).toHaveLength(3);
    }
    expect(el.textContent).not.toContain("Delta 4");
  });
});

describe("edge states", () => {
  it("renders a prompt and no bar groups with an empty selection", () => {
    const el = renderCompare([]);
    expect(el.querySelectorAll(".bar-group")).toHaveLength(0);
    expect(el.textContent).toContain("Select 2 or 3 models");
    const tray = el.querySelector("#compare-tray");
    expect(tray).not.toBeNull();
    expect(tray.textContent).toContain("0 of 3 selected");
  });

  it("ignores unknown ids without inventing data", () => {
    const el = renderCompare(["alpha-1", "nope-0"]);
    expect(el.textContent).toContain("Unknown model ids ignored: nope-0");
    const tray = el.querySelector("#compare-tray");
    expect(tray.querySelectorAll("li")).toHaveLength(1);
    for (const group of el.querySelectorAll(".bar-group")) {
      expect(group.querySelectorAll(".bar-row")).toHaveLength(1);
    }
  });
});
