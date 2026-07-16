// W11.S4: compare metric cards and readable deltas (C32, C20, C19).
//
// Root defect covered: proportional-to-max bars render near-ties (93.2 vs
// 92.9) as two visually identical full bars, and price bars read
// fullest-is-best, which is backwards for price. Each bar group is now a
// .metric-card with the metric name as its heading; the two price groups
// carry a "lower is better" .better-lower note; every non-leading row adds
// a .delta annotation computed from the displayed values only. Leading row
// per group = best DISPLAYED value: lowest for the price groups, highest
// for context window and both benchmarks. Bars, widths, group count, null
// handling, and the 3-model cap are unchanged (w3s3/w5s5 pin them).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import { render, toggleCompareId, MAX_COMPARE } from "../docs/js/views/compare.js";
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

// near-a leads SWE-bench 93.2 vs 92.9 (the near-tie the bars cannot show)
// but costs more on input price ($3.00 vs $1.50, so it TRAILS there).
const nearA = makeModel({
  id: "near-a",
  name: "Near A",
  pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
  contextWindow: 400000,
  benchmarks: { gpqaDiamond: 93.24, swebenchVerified: 93.2 },
});

const nearB = makeModel({
  id: "near-b",
  name: "Near B",
  pricing: { inputPerMTok: 1.5, outputPerMTok: 15, currency: "USD" },
  contextWindow: 100000,
  benchmarks: { gpqaDiamond: 93.21, swebenchVerified: 92.9 },
});

// nulls: input price and GPQA Diamond.
const holey = makeModel({
  id: "holey-1",
  name: "Holey 1",
  pricing: { inputPerMTok: null, outputPerMTok: 20, currency: "USD" },
  contextWindow: 200000,
  benchmarks: { gpqaDiamond: null, swebenchVerified: 40 },
});

const blank = makeModel({ id: "blank-9", name: "Blank 9" });

const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [nearA, nearB, holey, blank],
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

function deltaOf(row) {
  return row.querySelector(".delta");
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

describe("metric cards", () => {
  it("wraps each of the five bar groups in a .metric-card", () => {
    const el = renderCompare(["near-a", "near-b"]);
    const cards = el.querySelectorAll(".metric-card");
    expect(cards).toHaveLength(5);
    // The card IS the bar group, so .bar-group[data-metric] stays
    // queryable exactly as before.
    expect([...cards].map((c) => c.dataset.metric)).toEqual([
      "input-price",
      "output-price",
      "context-window",
      "gpqa-diamond",
      "swebench-verified",
    ]);
    for (const card of cards) {
      expect(card.classList.contains("bar-group")).toBe(true);
    }
  });

  it("gives every card the metric name as its heading", () => {
    const el = renderCompare(["near-a", "near-b"]);
    const headings = [...el.querySelectorAll(".metric-card")].map((card) => {
      const h = card.querySelector("h3");
      expect(h).not.toBeNull();
      return h.textContent;
    });
    expect(headings).toEqual([
      "Input price ($/MTok)",
      "Output price ($/MTok)",
      "Context window (tokens)",
      "GPQA Diamond",
      "SWE-bench Verified",
    ]);
  });

  it("puts a lower-is-better note on exactly the two price groups", () => {
    const el = renderCompare(["near-a", "near-b"]);
    const notes = el.querySelectorAll(".better-lower");
    expect(notes).toHaveLength(2);
    const carriers = [...el.querySelectorAll(".metric-card")]
      .filter((c) => c.querySelector(".better-lower") !== null)
      .map((c) => c.dataset.metric);
    expect(carriers).toEqual(["input-price", "output-price"]);
    for (const note of notes) {
      expect(note.textContent).toBe("lower is better");
    }
  });
});

describe("delta annotations from displayed values", () => {
  it("annotates the trailing row of a 93.2 vs 92.9 near-tie, not the leader", () => {
    const el = renderCompare(["near-a", "near-b"]);
    const leader = groupRow(el, "swebench-verified", "near-a");
    const trailer = groupRow(el, "swebench-verified", "near-b");
    expect(deltaOf(leader)).toBeNull();
    const delta = deltaOf(trailer);
    expect(delta).not.toBeNull();
    expect(delta.textContent).toBe("0.3 behind");
    // The bars themselves stay proportional-to-max per C32: the leader is
    // still the full bar.
    expect(leader.querySelector(".bar").style.width).toBe("100%");
  });

  it("treats the CHEAPEST model as the leader in a price group", () => {
    const el = renderCompare(["near-a", "near-b"]);
    // near-b is cheaper on input price ($1.50 vs $3.00): it leads even
    // though its bar is the shorter one.
    const cheap = groupRow(el, "input-price", "near-b");
    const dear = groupRow(el, "input-price", "near-a");
    expect(deltaOf(cheap)).toBeNull();
    const delta = deltaOf(dear);
    expect(delta).not.toBeNull();
    expect(delta.textContent).toBe("$1.50 more");
  });

  it("phrases higher-is-better deltas with the metric's own format", () => {
    const el = renderCompare(["near-a", "near-b"]);
    const trailer = groupRow(el, "context-window", "near-b");
    expect(deltaOf(trailer).textContent).toBe("300,000 behind");
    expect(deltaOf(groupRow(el, "context-window", "near-a"))).toBeNull();
  });

  it("gives no delta to either row when the displayed values tie", () => {
    // GPQA 93.24 vs 93.21 both display as 93.2: annotating one as behind
    // the other would contradict the printed values.
    const el = renderCompare(["near-a", "near-b"]);
    const group = el.querySelector('.bar-group[data-metric="gpqa-diamond"]');
    expect(group.querySelectorAll(".delta")).toHaveLength(0);
  });

  it("annotates every non-leading row in a 3-model group", () => {
    const el = renderCompare(["near-a", "near-b", "holey-1"]);
    // Output price: 15, 15, 20 -> both $15.00 rows lead; $20.00 trails.
    const rows = ["near-a", "near-b"].map((id) =>
      groupRow(el, "output-price", id)
    );
    for (const row of rows) expect(deltaOf(row)).toBeNull();
    expect(deltaOf(groupRow(el, "output-price", "holey-1")).textContent).toBe(
      "$5.00 more"
    );
    // SWE-bench: 93.2 leads; 92.9 and 40 both trail with their own gaps.
    expect(
      deltaOf(groupRow(el, "swebench-verified", "near-b")).textContent
    ).toBe("0.3 behind");
    expect(
      deltaOf(groupRow(el, "swebench-verified", "holey-1")).textContent
    ).toBe("53.2 behind");
    expect(deltaOf(groupRow(el, "swebench-verified", "near-a"))).toBeNull();
  });
});

describe("null handling stays intact and deltaless (C20)", () => {
  it("never annotates a null row", () => {
    const el = renderCompare(["near-a", "holey-1"]);
    for (const metric of ["input-price", "gpqa-diamond"]) {
      const row = groupRow(el, metric, "holey-1");
      expect(row.classList.contains("bar-row-missing")).toBe(true);
      expect(deltaOf(row)).toBeNull();
      expect(row.querySelector(".bar-value").textContent).toBe(MISSING);
    }
  });

  it("keeps an all-null model deltaless in every group", () => {
    const el = renderCompare(["near-a", "blank-9"]);
    for (const group of el.querySelectorAll(".bar-group")) {
      const row = group.querySelector('.bar-row[data-model-id="blank-9"]');
      expect(row).not.toBeNull();
      expect(deltaOf(row)).toBeNull();
      expect(row.querySelector(".bar-value").textContent).toBe(MISSING);
    }
    // A single non-null model is the leader by itself: no deltas anywhere.
    expect(el.querySelectorAll(".delta")).toHaveLength(0);
  });

  it("nests the delta inside the value cell, keeping rows at 3 cells", () => {
    const el = renderCompare(["near-a", "near-b", "holey-1"]);
    for (const row of el.querySelectorAll(".bar-row")) {
      expect(row.children).toHaveLength(3);
    }
    for (const delta of el.querySelectorAll(".delta")) {
      expect(delta.parentElement.classList.contains("bar-value")).toBe(true);
    }
  });
});

describe("3-model cap stays intact (C32)", () => {
  it("makes a 4th selection impossible via toggleCompareId", () => {
    expect(MAX_COMPARE).toBe(3);
    const full = ["near-a", "near-b", "holey-1"];
    const after = toggleCompareId(full, "blank-9");
    expect(after).toEqual(full);
    expect(after).not.toBe(full);
  });

  it("caps rendering at three models and five cards from a hand-typed URL", () => {
    const el = renderCompare(["near-a", "near-b", "holey-1", "blank-9"]);
    expect(el.querySelectorAll(".metric-card")).toHaveLength(5);
    for (const group of el.querySelectorAll(".bar-group")) {
      expect(group.querySelectorAll(".bar-row")).toHaveLength(3);
    }
    expect(el.textContent).not.toContain("Blank 9");
  });
});
