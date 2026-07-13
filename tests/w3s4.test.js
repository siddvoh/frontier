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

// Fixture fleet exercising qualification order and every exclusion path.
const fleet = [
  makeModel({
    id: "q-top",
    name: "Q Top",
    releaseDate: "2024-06-01",
    pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
    contextWindow: 200000,
    benchmarks: { gpqaDiamond: 70, swebenchVerified: 90 },
    openWeights: false,
  }),
  makeModel({
    id: "q-cheap",
    name: "Q Cheap",
    releaseDate: "2025-01-01",
    pricing: { inputPerMTok: 1, outputPerMTok: 2, currency: "USD" },
    contextWindow: 128000,
    benchmarks: { gpqaDiamond: 60, swebenchVerified: 80 },
    openWeights: true,
  }),
  makeModel({
    id: "q-dear",
    name: "Q Dear",
    releaseDate: "2023-05-01",
    pricing: { inputPerMTok: 5, outputPerMTok: 20, currency: "USD" },
    contextWindow: 300000,
    benchmarks: { gpqaDiamond: 85, swebenchVerified: 80 },
    openWeights: false,
  }),
  makeModel({
    id: "x-priceless",
    name: "X Priceless",
    pricing: { inputPerMTok: null, outputPerMTok: 15, currency: "USD" },
    benchmarks: { gpqaDiamond: 99, swebenchVerified: 99 },
  }),
  makeModel({
    id: "x-pricey",
    name: "X Pricey",
    pricing: { inputPerMTok: 40, outputPerMTok: 80, currency: "USD" },
    benchmarks: { gpqaDiamond: 95, swebenchVerified: 95 },
  }),
  makeModel({
    id: "x-small-ctx",
    name: "X Small Ctx",
    pricing: { inputPerMTok: 2, outputPerMTok: 4, currency: "USD" },
    contextWindow: 8000,
    benchmarks: { gpqaDiamond: 55, swebenchVerified: 55 },
  }),
  makeModel({
    id: "x-old",
    name: "X Old",
    releaseDate: "2022-01-01",
    benchmarks: { gpqaDiamond: 45, swebenchVerified: 45 },
  }),
  makeModel({
    id: "x-unbenched",
    name: "X Unbenched",
    contextWindow: 150000,
    benchmarks: { gpqaDiamond: 50, swebenchVerified: null },
  }),
];

const artifact = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: fleet,
  events: [],
};

function makeInput(overrides = {}, constraints = {}) {
  return {
    budgetUsdPerMonth: 500,
    task: "coding",
    inputMTokPerMonth: 10,
    outputMTokPerMonth: 5,
    ...overrides,
    constraints: {
      openWeightsOnly: null,
      minContextTokens: null,
      releasedOnOrAfter: null,
      releasedOnOrBefore: null,
      ...constraints,
    },
  };
}

const constrained = {
  minContextTokens: 100000,
  releasedOnOrAfter: "2023-01-01",
  releasedOnOrBefore: "2026-12-31",
};

const emptyInput = {
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

describe("scenario form exposes every C22 input, labeled (C33, C35)", () => {
  const controls = [
    ["scenario-budget", "budget", "input"],
    ["scenario-task", "task", "select"],
    ["scenario-in", "in", "input"],
    ["scenario-out", "out", "input"],
    ["scenario-open", "open", "input"],
    ["scenario-min-ctx", "minCtx", "input"],
    ["scenario-after", "after", "input"],
    ["scenario-before", "before", "input"],
  ];

  it("renders one labeled control per C22 field with router query names", () => {
    const el = renderScenario(emptyInput);
    const form = el.querySelector("form#scenario-form");
    expect(form).not.toBeNull();
    for (const [id, name, tag] of controls) {
      const control = form.querySelector(`#${id}`);
      expect(control, id).not.toBeNull();
      expect(control.tagName.toLowerCase()).toBe(tag);
      expect(control.name).toBe(name);
      const label = form.querySelector(`label[for="${id}"]`);
      expect(label, `label for ${id}`).not.toBeNull();
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("every form control inside the view has an associated label", () => {
    const el = renderScenario(emptyInput);
    for (const control of el.querySelectorAll("input, select, textarea")) {
      expect(control.id, control.outerHTML).not.toBe("");
      expect(el.querySelector(`label[for="${control.id}"]`)).not.toBeNull();
    }
  });

  it("offers exactly the three C22 tasks plus an unset option", () => {
    const el = renderScenario(emptyInput);
    const options = [...el.querySelectorAll("#scenario-task option")];
    expect(options.map((o) => o.value)).toEqual([
      "",
      "coding",
      "reasoning",
      "longdoc",
    ]);
  });

  it("prefills every control from the route input state", () => {
    const input = makeInput(
      { budgetUsdPerMonth: 250.5, task: "longdoc" },
      { openWeightsOnly: true, ...constrained }
    );
    const el = renderScenario(input);
    expect(el.querySelector("#scenario-budget").value).toBe("250.5");
    expect(el.querySelector("#scenario-task").value).toBe("longdoc");
    expect(el.querySelector("#scenario-in").value).toBe("10");
    expect(el.querySelector("#scenario-out").value).toBe("5");
    expect(el.querySelector("#scenario-open").checked).toBe(true);
    expect(el.querySelector("#scenario-min-ctx").value).toBe("100000");
    expect(el.querySelector("#scenario-after").value).toBe("2023-01-01");
    expect(el.querySelector("#scenario-before").value).toBe("2026-12-31");
  });

  it("leaves controls empty and unchecked for an all-null input", () => {
    const el = renderScenario(emptyInput);
    expect(el.querySelector("#scenario-budget").value).toBe("");
    expect(el.querySelector("#scenario-task").value).toBe("");
    expect(el.querySelector("#scenario-open").checked).toBe(false);
  });
});

describe("ranked results driven through the form-state render (C33)", () => {
  it("lists qualifying models in engine order with 1-based ranks", () => {
    const el = renderScenario(makeInput({}, constrained));
    const items = [...el.querySelectorAll("#scenario-results ol > li")];
    expect(items.map((li) => li.dataset.modelId)).toEqual([
      "q-top",
      "q-cheap",
      "q-dear",
    ]);
    expect(items.map((li) => li.querySelector(".rank").textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(items[0].querySelector(".model-name").textContent).toBe("Q Top");
  });

  it("shows the ranking-field value per entry", () => {
    const el = renderScenario(makeInput({}, constrained));
    const first = el.querySelector('#scenario-results li[data-model-id="q-top"]');
    expect(first.querySelector(".ranking-value").textContent).toBe(
      "SWE-bench Verified: 90.0"
    );
  });

  it("shows the computed cost as the exact C26 formula string", () => {
    const el = renderScenario(makeInput({}, constrained));
    const items = [...el.querySelectorAll("#scenario-results ol > li")];
    const formulas = items.map(
      (li) => li.querySelector(".cost-formula").textContent
    );
    expect(formulas).toEqual([
      "10.00 Mtok x $3.00 + 5.00 Mtok x $15.00 = $105.00/mo",
      "10.00 Mtok x $1.00 + 5.00 Mtok x $2.00 = $20.00/mo",
      "10.00 Mtok x $5.00 + 5.00 Mtok x $20.00 = $150.00/mo",
    ]);
  });

  it("shows the context window for longdoc", () => {
    const el = renderScenario(makeInput({ task: "longdoc" }, constrained));
    const items = [...el.querySelectorAll("#scenario-results ol > li")];
    expect(items.map((li) => li.dataset.modelId)).toEqual([
      "q-dear",
      "q-top",
      "x-unbenched",
      "q-cheap",
    ]);
    expect(items[0].querySelector(".ranking-value").textContent).toBe(
      "Context window: 300,000"
    );
  });

  it("ranks reasoning by GPQA Diamond with the field labeled", () => {
    const el = renderScenario(makeInput({ task: "reasoning" }, constrained));
    const items = [...el.querySelectorAll("#scenario-results ol > li")];
    expect(items.map((li) => li.dataset.modelId)).toEqual([
      "q-dear",
      "q-top",
      "q-cheap",
      "x-unbenched",
    ]);
    expect(items[0].querySelector(".ranking-value").textContent).toBe(
      "GPQA Diamond: 85.0"
    );
  });

  it("says so when nothing qualifies, without inventing entries", () => {
    const el = renderScenario(makeInput({ budgetUsdPerMonth: 1 }));
    expect(el.querySelector("#scenario-results ol")).toBeNull();
    expect(el.querySelector("#scenario-results").textContent).toContain(
      "No models qualify"
    );
    expect(
      el.querySelectorAll("#scenario-results details li")
    ).toHaveLength(fleet.length);
  });
});

describe("collapsed excluded section with C27 reasons (C33)", () => {
  function excludedByReason(el) {
    const out = {};
    for (const li of el.querySelectorAll("#scenario-results details li")) {
      out[li.dataset.modelId] = li.dataset.reason;
    }
    return out;
  }

  it("renders a collapsed details section listing every excluded model", () => {
    const el = renderScenario(makeInput({}, constrained));
    const details = el.querySelector("#scenario-results details");
    expect(details).not.toBeNull();
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("summary").textContent).toContain("5");
  });

  it("shows each model's machine-readable reason in text and data", () => {
    const el = renderScenario(makeInput({}, constrained));
    expect(excludedByReason(el)).toEqual({
      "x-priceless": "missing_price",
      "x-pricey": "over_budget",
      "x-small-ctx": "constraint_context",
      "x-old": "constraint_date",
      "x-unbenched": "missing_ranking_field",
    });
    const priceless = el.querySelector('details li[data-model-id="x-priceless"]');
    expect(priceless.textContent).toContain("X Priceless");
    expect(priceless.textContent).toContain("missing_price");
  });

  it("reports constraint_open_weights under an open-weights-only input", () => {
    const el = renderScenario(makeInput({}, { openWeightsOnly: true }));
    const reasons = excludedByReason(el);
    expect(reasons["q-top"]).toBe("constraint_open_weights");
    expect(reasons["q-dear"]).toBe("constraint_open_weights");
    const ranked = [...el.querySelectorAll("#scenario-results ol > li")];
    expect(ranked.map((li) => li.dataset.modelId)).toContain("q-cheap");
  });

  it("omits the excluded section when every model qualifies", () => {
    const twoGood = {
      ...artifact,
      models: fleet.filter((m) => m.id.startsWith("q-")),
    };
    const el = render({
      route: { view: "scenario", input: makeInput() },
      data: twoGood,
    });
    expect(el.querySelector("#scenario-results details")).toBeNull();
  });
});

describe("incomplete input and null rendering (C20, C19)", () => {
  it("renders a prompt instead of results while the input is incomplete", () => {
    const el = renderScenario(emptyInput);
    const results = el.querySelector("#scenario-results");
    expect(results).not.toBeNull();
    expect(results.querySelector("ol")).toBeNull();
    expect(results.querySelector("details")).toBeNull();
    expect(results.textContent).toContain("Enter a budget");
  });

  it("renders null summary values via the MISSING constant", () => {
    const el = renderScenario(emptyInput);
    expect(el.textContent).toContain(MISSING);
  });

  it("treats a missing volume as incomplete, never defaulting it", () => {
    const el = renderScenario(makeInput({ outputMTokPerMonth: null }));
    expect(el.querySelector("#scenario-results ol")).toBeNull();
  });
});

describe("view module hygiene (C19, C20, C29)", () => {
  it("contains no em dash literal; MISSING flows from util.js", () => {
    expect(viewSource).not.toContain(MISSING);
  });

  it("delegates all computation to engine.js and never fetches", () => {
    expect(viewSource).toContain('from "../engine.js"');
    expect(viewSource).toContain("evaluateScenario");
    expect(viewSource).not.toMatch(/\bfetch\s*\(/);
    expect(viewSource).not.toContain("?? 0");
    expect(viewSource).not.toContain("|| 0");
    expect(viewSource).not.toContain("Math.random");
  });

  it("keeps the .glass class on #scenario-results only (C43 whitelist)", () => {
    const el = renderScenario(makeInput());
    const glassed = [...el.querySelectorAll(".glass")];
    expect(glassed.map((node) => node.id)).toEqual(["scenario-results"]);
  });
});
