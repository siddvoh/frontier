// W5.S6: scenario form grid and honest empty state.
// Asserts the .form-grid markup (pairing classes, constraints fieldset with
// legend, inline checkbox) and that the scenario summary line renders only
// after a runnable input, never on initial render (no wall of MISSING
// markers). Ranked results and exclusion markup stay under w3s4.test.js.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

import { MISSING } from "../docs/js/util.js";
import { render } from "../docs/js/views/scenario.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewSource = readFileSync(
  path.join(root, "docs", "js", "views", "scenario.js"),
  "utf8"
);

function makeModel(overrides = {}) {
  return {
    id: "base-model",
    name: "Base Model",
    organization: "Base Lab",
    releaseDate: "2024-06-01",
    epochName: null,
    pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
    contextWindow: 200000,
    benchmarks: { gpqaDiamond: 50, swebenchVerified: 40 },
    openWeights: false,
    epoch: { parameters: null, trainingComputeFlop: null, organization: null },
    sources: {},
    ...overrides,
  };
}

const artifact = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [
    makeModel({ id: "m-a", name: "Model A" }),
    makeModel({
      id: "m-b",
      name: "Model B",
      pricing: { inputPerMTok: null, outputPerMTok: 15, currency: "USD" },
    }),
  ],
  events: [],
};

const emptyConstraints = {
  openWeightsOnly: null,
  minContextTokens: null,
  releasedOnOrAfter: null,
  releasedOnOrBefore: null,
};

const emptyInput = {
  budgetUsdPerMonth: null,
  task: null,
  inputMTokPerMonth: null,
  outputMTokPerMonth: null,
  constraints: { ...emptyConstraints },
};

const completeInput = {
  budgetUsdPerMonth: 500,
  task: "coding",
  inputMTokPerMonth: 10,
  outputMTokPerMonth: 5,
  constraints: { ...emptyConstraints },
};

function renderScenario(input) {
  return render({ route: { view: "scenario", input }, data: artifact });
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

describe("scenario form grid markup (C33, C35)", () => {
  it("puts the .form-grid class on the scenario form", () => {
    const el = renderScenario(emptyInput);
    const form = el.querySelector("form#scenario-form");
    expect(form).not.toBeNull();
    expect(form.classList.contains("form-grid")).toBe(true);
  });

  it("pairs budget/task and the two volumes as adjacent .field-pair cells", () => {
    const el = renderScenario(emptyInput);
    const form = el.querySelector("#scenario-form");
    for (const id of ["scenario-budget", "scenario-task", "scenario-in", "scenario-out"]) {
      const wrapper = form.querySelector(`#${id}`).closest(".field");
      expect(wrapper, id).not.toBeNull();
      expect(wrapper.classList.contains("field-pair"), id).toBe(true);
      // Direct grid cells of the two-column .form-grid, so the 1fr 1fr
      // columns at >=720px pair them row by row.
      expect(wrapper.parentElement, id).toBe(form);
    }
    const cells = [...form.children].filter((node) =>
      node.classList.contains("field-pair")
    );
    expect(
      cells.map((cell) => cell.querySelector("input, select").id)
    ).toEqual(["scenario-budget", "scenario-task", "scenario-in", "scenario-out"]);
  });

  it("groups the four constraints in a labeled fieldset", () => {
    const el = renderScenario(emptyInput);
    const fieldset = el.querySelector("#scenario-form fieldset.constraints");
    expect(fieldset).not.toBeNull();
    const legend = fieldset.querySelector("legend");
    expect(legend).not.toBeNull();
    expect(legend.textContent.trim().length).toBeGreaterThan(0);
    const inside = ["scenario-open", "scenario-min-ctx", "scenario-after", "scenario-before"];
    for (const id of inside) {
      expect(fieldset.querySelector(`#${id}`), id).not.toBeNull();
    }
    const outside = ["scenario-budget", "scenario-task", "scenario-in", "scenario-out"];
    for (const id of outside) {
      expect(fieldset.querySelector(`#${id}`), id).toBeNull();
    }
  });

  it("renders the open-weights checkbox inline before its label", () => {
    const el = renderScenario(emptyInput);
    const box = el.querySelector("#scenario-open");
    const wrapper = box.closest(".field");
    expect(wrapper.classList.contains("field-check")).toBe(true);
    const label = wrapper.querySelector('label[for="scenario-open"]');
    expect(label).not.toBeNull();
    expect(box.nextElementSibling).toBe(label);
  });
});

describe("scenario summary renders only after a run (C33)", () => {
  it("shows no summary element on the initial all-null render", () => {
    const el = renderScenario(emptyInput);
    expect(el.querySelector(".scenario-summary")).toBeNull();
    expect(el.querySelector("#scenario-results")).not.toBeNull();
    expect(el.querySelector("#scenario-results").textContent).toContain(
      "Enter a budget"
    );
  });

  it("shows no summary while any required field is still null", () => {
    const partials = [
      { ...completeInput, budgetUsdPerMonth: null },
      { ...completeInput, task: null },
      { ...completeInput, inputMTokPerMonth: null },
      { ...completeInput, outputMTokPerMonth: null },
    ];
    for (const partial of partials) {
      const el = renderScenario({
        ...partial,
        constraints: { ...emptyConstraints },
      });
      expect(el.querySelector(".scenario-summary")).toBeNull();
      expect(el.querySelector("#scenario-results ol")).toBeNull();
    }
  });

  it("renders the summary once the input is complete and the engine runs", () => {
    const el = renderScenario(completeInput);
    const summary = el.querySelector(".scenario-summary");
    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain("Budget $500.00/mo");
    expect(summary.textContent).toContain("task coding");
    expect(summary.textContent).toContain("input 10 Mtok/mo");
    expect(summary.textContent).toContain("output 5 Mtok/mo");
    expect(summary.textContent).not.toContain(MISSING);
    // Results render alongside the summary, unchanged.
    const ranked = [...el.querySelectorAll("#scenario-results ol > li")];
    expect(ranked.map((li) => li.dataset.modelId)).toEqual(["m-a"]);
  });

  it("keeps the summary between the form and the results", () => {
    const el = renderScenario(completeInput);
    const children = [...el.children].map(
      (node) => node.id || node.className || node.tagName.toLowerCase()
    );
    expect(children.indexOf("scenario-form")).toBeLessThan(
      children.indexOf("scenario-summary muted")
    );
    expect(children.indexOf("scenario-summary muted")).toBeLessThan(
      children.indexOf("scenario-results")
    );
  });
});

describe("module hygiene for the reshaped form (C20)", () => {
  it("contains no dash literal; MISSING flows from util.js only", () => {
    expect(viewSource).not.toContain(MISSING);
    expect(viewSource).toContain('import { MISSING');
  });

  it("keeps the empty state honest: prompt text, no fabricated values", () => {
    const el = renderScenario(emptyInput);
    // The MISSING marker in the prompt is the only place it appears; no
    // summary of MISSING values exists anywhere in the view.
    expect(el.textContent).toContain(MISSING);
    expect(el.textContent).not.toContain("Budget " + MISSING);
  });
});
