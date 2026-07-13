import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  computeCost,
  rankingValue,
  exclusionReason,
  evaluateScenario,
  EXCLUSION_REASONS,
  TASKS,
} from "../docs/js/engine.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineSource = readFileSync(path.join(root, "docs", "js", "engine.js"), "utf8");

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

function makeInput(overrides = {}, constraints = {}) {
  return {
    budgetUsdPerMonth: 1000,
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

describe("C22 module contract", () => {
  it("exports the ScenarioInput JSDoc typedef with every C22 field", () => {
    expect(engineSource).toContain("@typedef {Object} ScenarioInput");
    expect(engineSource).toContain("@typedef {Object} ScenarioConstraints");
    for (const field of [
      "budgetUsdPerMonth",
      "task",
      "inputMTokPerMonth",
      "outputMTokPerMonth",
      "constraints",
      "openWeightsOnly",
      "minContextTokens",
      "releasedOnOrAfter",
      "releasedOnOrBefore",
    ]) {
      expect(engineSource).toContain(field);
    }
    expect(engineSource).toContain('{"coding"|"reasoning"|"longdoc"} task');
  });

  it("touches no DOM, fetch, or globals and imports nothing (C22)", () => {
    expect(engineSource).not.toMatch(/\bimport\b\s/);
    expect(engineSource).not.toMatch(/\bfetch\s*\(/);
    expect(engineSource).not.toMatch(/\bdocument\b/);
    expect(engineSource).not.toMatch(/\bwindow\b/);
    expect(engineSource).not.toMatch(/\bglobalThis\b/);
  });

  it("exposes the six C27 reasons and the three C22 tasks", () => {
    expect(EXCLUSION_REASONS).toHaveLength(6);
    expect([...EXCLUSION_REASONS].sort()).toEqual([
      "constraint_context",
      "constraint_date",
      "constraint_open_weights",
      "missing_price",
      "missing_ranking_field",
      "over_budget",
    ]);
    expect(TASKS).toEqual(["coding", "reasoning", "longdoc"]);
  });
});

describe("C23 cost formula", () => {
  it("computes cost = in * inPrice + out * outPrice exactly", () => {
    const cost = computeCost(makeModel(), makeInput());
    expect(cost.inputCost).toBe(30);
    expect(cost.outputCost).toBe(75);
    expect(cost.totalCost).toBe(105);
  });

  it("handles fractional volumes and prices by hand-computed values", () => {
    const model = makeModel({
      pricing: { inputPerMTok: 1.25, outputPerMTok: 10.5, currency: "USD" },
    });
    const input = makeInput({ inputMTokPerMonth: 2.5, outputMTokPerMonth: 0.5 });
    const cost = computeCost(model, input);
    expect(cost.inputCost).toBeCloseTo(3.125, 10);
    expect(cost.outputCost).toBeCloseTo(5.25, 10);
    expect(cost.totalCost).toBeCloseTo(8.375, 10);
  });

  it("is not computable when the input price is null (C19, C21)", () => {
    const model = makeModel({
      pricing: { inputPerMTok: null, outputPerMTok: 15, currency: "USD" },
    });
    expect(computeCost(model, makeInput())).toBeNull();
  });

  it("is not computable when the output price is null", () => {
    const model = makeModel({
      pricing: { inputPerMTok: 3, outputPerMTok: null, currency: "USD" },
    });
    expect(computeCost(model, makeInput())).toBeNull();
  });

  it("is not computable when both prices are null", () => {
    const model = makeModel({
      pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
    });
    expect(computeCost(model, makeInput())).toBeNull();
  });

  it("treats a zero price as a real value, never as missing", () => {
    const model = makeModel({
      pricing: { inputPerMTok: 0, outputPerMTok: 0, currency: "USD" },
    });
    const cost = computeCost(model, makeInput());
    expect(cost.totalCost).toBe(0);
  });
});

describe("C26 shown-math result shape", () => {
  it("matches the exact hand-computed formula string verbatim", () => {
    const cost = computeCost(makeModel(), makeInput());
    expect(cost.formula).toBe("10.00 Mtok x $3.00 + 5.00 Mtok x $15.00 = $105.00/mo");
  });

  it("formats every value to two decimals, rounding the total", () => {
    const model = makeModel({
      pricing: { inputPerMTok: 1.25, outputPerMTok: 10.5, currency: "USD" },
    });
    const input = makeInput({ inputMTokPerMonth: 2.5, outputMTokPerMonth: 0.5 });
    const cost = computeCost(model, input);
    expect(cost.formula).toBe("2.50 Mtok x $1.25 + 0.50 Mtok x $10.50 = $8.38/mo");
  });

  it("exposes exactly inputCost, outputCost, totalCost, formula", () => {
    const cost = computeCost(makeModel(), makeInput());
    expect(Object.keys(cost).sort()).toEqual([
      "formula",
      "inputCost",
      "outputCost",
      "totalCost",
    ]);
  });
});

describe("C24/C27 qualification, each exclusion independently", () => {
  it("qualifies the base model under the base input", () => {
    expect(exclusionReason(makeModel(), makeInput())).toBeNull();
  });

  it("missing_price: null input price excludes", () => {
    const model = makeModel({
      pricing: { inputPerMTok: null, outputPerMTok: 15, currency: "USD" },
    });
    expect(exclusionReason(model, makeInput())).toBe("missing_price");
  });

  it("missing_price: null output price excludes", () => {
    const model = makeModel({
      pricing: { inputPerMTok: 3, outputPerMTok: null, currency: "USD" },
    });
    expect(exclusionReason(model, makeInput())).toBe("missing_price");
  });

  it("over_budget: cost above budget excludes; cost equal to budget passes", () => {
    expect(exclusionReason(makeModel(), makeInput({ budgetUsdPerMonth: 104.99 }))).toBe(
      "over_budget",
    );
    expect(exclusionReason(makeModel(), makeInput({ budgetUsdPerMonth: 105 }))).toBeNull();
  });

  it("constraint_open_weights: openWeightsOnly requires openWeights === true", () => {
    const input = makeInput({}, { openWeightsOnly: true });
    expect(exclusionReason(makeModel({ openWeights: false }), input)).toBe(
      "constraint_open_weights",
    );
    expect(exclusionReason(makeModel({ openWeights: null }), input)).toBe(
      "constraint_open_weights",
    );
    expect(exclusionReason(makeModel({ openWeights: true }), input)).toBeNull();
  });

  it("openWeightsOnly false or null does not exclude closed models", () => {
    expect(
      exclusionReason(makeModel({ openWeights: false }), makeInput({}, { openWeightsOnly: false })),
    ).toBeNull();
    expect(
      exclusionReason(makeModel({ openWeights: false }), makeInput({}, { openWeightsOnly: null })),
    ).toBeNull();
  });

  it("constraint_context: below-min or null contextWindow excludes; equal passes", () => {
    const input = makeInput({}, { minContextTokens: 200001 });
    expect(exclusionReason(makeModel(), input)).toBe("constraint_context");
    expect(exclusionReason(makeModel({ contextWindow: null }), input)).toBe(
      "constraint_context",
    );
    expect(exclusionReason(makeModel(), makeInput({}, { minContextTokens: 200000 }))).toBeNull();
  });

  it("constraint_date: releasedOnOrAfter excludes older, keeps boundary", () => {
    const input = makeInput({}, { releasedOnOrAfter: "2024-06-02" });
    expect(exclusionReason(makeModel(), input)).toBe("constraint_date");
    expect(
      exclusionReason(makeModel(), makeInput({}, { releasedOnOrAfter: "2024-06-01" })),
    ).toBeNull();
  });

  it("constraint_date: releasedOnOrBefore excludes newer, keeps boundary", () => {
    const input = makeInput({}, { releasedOnOrBefore: "2024-05-31" });
    expect(exclusionReason(makeModel(), input)).toBe("constraint_date");
    expect(
      exclusionReason(makeModel(), makeInput({}, { releasedOnOrBefore: "2024-06-01" })),
    ).toBeNull();
  });

  it("constraint_date: a date constraint excludes null releaseDate models (C21)", () => {
    const model = makeModel({ releaseDate: null });
    expect(exclusionReason(model, makeInput({}, { releasedOnOrAfter: "2023-01-01" }))).toBe(
      "constraint_date",
    );
    expect(exclusionReason(model, makeInput({}, { releasedOnOrBefore: "2026-01-01" }))).toBe(
      "constraint_date",
    );
  });

  it("null releaseDate without date constraints does not exclude", () => {
    expect(exclusionReason(makeModel({ releaseDate: null }), makeInput())).toBeNull();
  });

  it("missing_ranking_field: coding requires swebenchVerified", () => {
    const model = makeModel({ benchmarks: { gpqaDiamond: 50, swebenchVerified: null } });
    expect(exclusionReason(model, makeInput({ task: "coding" }))).toBe(
      "missing_ranking_field",
    );
  });

  it("missing_ranking_field: reasoning requires gpqaDiamond", () => {
    const model = makeModel({ benchmarks: { gpqaDiamond: null, swebenchVerified: 40 } });
    expect(exclusionReason(model, makeInput({ task: "reasoning" }))).toBe(
      "missing_ranking_field",
    );
  });

  it("missing_ranking_field: longdoc requires contextWindow", () => {
    const model = makeModel({ contextWindow: null });
    expect(exclusionReason(model, makeInput({ task: "longdoc" }))).toBe(
      "missing_ranking_field",
    );
  });

  it("reports one reason: the first failing check in C24 order", () => {
    const model = makeModel({
      pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
      openWeights: false,
      contextWindow: null,
      releaseDate: null,
      benchmarks: { gpqaDiamond: null, swebenchVerified: null },
    });
    const input = makeInput(
      {},
      {
        openWeightsOnly: true,
        minContextTokens: 100000,
        releasedOnOrAfter: "2024-01-01",
      },
    );
    expect(exclusionReason(model, input)).toBe("missing_price");
  });
});

describe("C25 ranking per task", () => {
  const fleet = [
    makeModel({
      id: "coder-high",
      releaseDate: "2024-01-01",
      contextWindow: 100000,
      benchmarks: { gpqaDiamond: 10, swebenchVerified: 80 },
    }),
    makeModel({
      id: "reasoner-high",
      releaseDate: "2024-02-01",
      contextWindow: 150000,
      benchmarks: { gpqaDiamond: 90, swebenchVerified: 20 },
    }),
    makeModel({
      id: "longdoc-high",
      releaseDate: "2024-03-01",
      contextWindow: 1000000,
      benchmarks: { gpqaDiamond: 40, swebenchVerified: 50 },
    }),
  ];

  it("coding ranks by swebenchVerified descending", () => {
    const { qualified } = evaluateScenario(fleet, makeInput({ task: "coding" }));
    expect(qualified.map((r) => r.model.id)).toEqual([
      "coder-high",
      "longdoc-high",
      "reasoner-high",
    ]);
    expect(qualified.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(qualified[0].rankingValue).toBe(80);
  });

  it("reasoning ranks by gpqaDiamond descending", () => {
    const { qualified } = evaluateScenario(fleet, makeInput({ task: "reasoning" }));
    expect(qualified.map((r) => r.model.id)).toEqual([
      "reasoner-high",
      "longdoc-high",
      "coder-high",
    ]);
  });

  it("longdoc ranks by contextWindow descending with cost attached", () => {
    const { qualified } = evaluateScenario(fleet, makeInput({ task: "longdoc" }));
    expect(qualified.map((r) => r.model.id)).toEqual([
      "longdoc-high",
      "reasoner-high",
      "coder-high",
    ]);
    for (const result of qualified) {
      expect(result.cost.totalCost).toBe(105);
      expect(result.cost.formula).toBe(
        "10.00 Mtok x $3.00 + 5.00 Mtok x $15.00 = $105.00/mo",
      );
    }
  });

  it("rankingValue reads the task field and throws on unknown tasks", () => {
    const model = makeModel();
    expect(rankingValue(model, "coding")).toBe(40);
    expect(rankingValue(model, "reasoning")).toBe(50);
    expect(rankingValue(model, "longdoc")).toBe(200000);
    expect(() => rankingValue(model, "poetry")).toThrow();
  });
});

describe("C25 four-step tie-break, exact-tie fixtures", () => {
  const pricing = { inputPerMTok: 5, outputPerMTok: 20, currency: "USD" };
  const cheap = { inputPerMTok: 1, outputPerMTok: 2, currency: "USD" };
  const tiedBench = { gpqaDiamond: 50, swebenchVerified: 60 };
  const tieFleet = [
    makeModel({
      id: "zz-cheaper",
      releaseDate: "2023-05-01",
      pricing: cheap,
      benchmarks: tiedBench,
    }),
    makeModel({
      id: "yy-newer",
      releaseDate: "2025-01-01",
      pricing,
      benchmarks: tiedBench,
    }),
    makeModel({
      id: "beta-old",
      releaseDate: "2024-01-01",
      pricing,
      benchmarks: tiedBench,
    }),
    makeModel({
      id: "alpha-old",
      releaseDate: "2024-01-01",
      pricing,
      benchmarks: tiedBench,
    }),
    makeModel({
      id: "top-bench",
      releaseDate: "2023-01-01",
      pricing,
      benchmarks: { gpqaDiamond: 50, swebenchVerified: 61 },
    }),
  ];

  it("orders by ranking field, then lower cost, then newer date, then id", () => {
    const { qualified } = evaluateScenario(tieFleet, makeInput({ task: "coding" }));
    expect(qualified.map((r) => r.model.id)).toEqual([
      "top-bench",
      "zz-cheaper",
      "yy-newer",
      "alpha-old",
      "beta-old",
    ]);
  });

  it("is total and deterministic under any input permutation", () => {
    const reversed = [...tieFleet].reverse();
    const rotated = [...tieFleet.slice(2), ...tieFleet.slice(0, 2)];
    const expected = evaluateScenario(tieFleet, makeInput({ task: "coding" })).qualified.map(
      (r) => r.model.id,
    );
    for (const arrangement of [reversed, rotated]) {
      const { qualified } = evaluateScenario(arrangement, makeInput({ task: "coding" }));
      expect(qualified.map((r) => r.model.id)).toEqual(expected);
    }
  });

  it("orders a null releaseDate after any date at the date tie-break step", () => {
    const withNullDate = [
      makeModel({ id: "no-date", releaseDate: null, pricing, benchmarks: tiedBench }),
      makeModel({ id: "some-date", releaseDate: "2023-01-01", pricing, benchmarks: tiedBench }),
    ];
    const { qualified } = evaluateScenario(withNullDate, makeInput({ task: "coding" }));
    expect(qualified.map((r) => r.model.id)).toEqual(["some-date", "no-date"]);
  });
});

describe("C21/C19 null fields excluded, never substituted", () => {
  it("keeps a null-price model out of the ranking even if it would win", () => {
    const models = [
      makeModel({
        id: "priceless-champion",
        pricing: { inputPerMTok: null, outputPerMTok: null, currency: "USD" },
        benchmarks: { gpqaDiamond: 99, swebenchVerified: 99 },
      }),
      makeModel({ id: "priced-runner" }),
    ];
    const { qualified, excluded } = evaluateScenario(models, makeInput({ task: "coding" }));
    expect(qualified.map((r) => r.model.id)).toEqual(["priced-runner"]);
    expect(excluded).toEqual([
      { model: models[0], reason: "missing_price" },
    ]);
  });

  it("keeps a null-ranking-field model out even when it is cheapest", () => {
    const models = [
      makeModel({
        id: "cheap-unbenched",
        pricing: { inputPerMTok: 0.1, outputPerMTok: 0.1, currency: "USD" },
        benchmarks: { gpqaDiamond: 50, swebenchVerified: null },
      }),
      makeModel({ id: "priced-runner" }),
    ];
    const { qualified, excluded } = evaluateScenario(models, makeInput({ task: "coding" }));
    expect(qualified.map((r) => r.model.id)).toEqual(["priced-runner"]);
    expect(excluded[0].reason).toBe("missing_ranking_field");
  });

  it("never contains a fallback-to-zero expression on stat fields", () => {
    expect(engineSource).not.toContain("?? 0");
    expect(engineSource).not.toContain("|| 0");
    expect(engineSource).not.toContain("Math.random");
  });
});

describe("evaluateScenario result envelope", () => {
  it("splits every model into qualified or excluded without mutation", () => {
    const models = [
      makeModel({ id: "aaa-fits" }),
      makeModel({
        id: "bbb-priceless",
        pricing: { inputPerMTok: null, outputPerMTok: 15, currency: "USD" },
      }),
      makeModel({ id: "ccc-fits", benchmarks: { gpqaDiamond: 50, swebenchVerified: 70 } }),
    ];
    const originalOrder = models.map((m) => m.id);
    const snapshot = JSON.parse(JSON.stringify(models));
    const { qualified, excluded } = evaluateScenario(models, makeInput());
    expect(qualified.length + excluded.length).toBe(models.length);
    expect(models.map((m) => m.id)).toEqual(originalOrder);
    expect(JSON.parse(JSON.stringify(models))).toEqual(snapshot);
    expect(qualified.map((r) => r.model.id)).toEqual(["ccc-fits", "aaa-fits"]);
  });

  it("exposes rank, model, rankingValue, cost on each qualified result", () => {
    const { qualified } = evaluateScenario([makeModel()], makeInput());
    expect(Object.keys(qualified[0]).sort()).toEqual([
      "cost",
      "model",
      "rank",
      "rankingValue",
    ]);
    expect(qualified[0].rank).toBe(1);
    expect(qualified[0].rankingValue).toBe(40);
    expect(qualified[0].cost.totalCost).toBe(105);
  });

  it("returns empty qualified and full excluded when nothing fits", () => {
    const { qualified, excluded } = evaluateScenario(
      [makeModel()],
      makeInput({ budgetUsdPerMonth: 1 }),
    );
    expect(qualified).toEqual([]);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].reason).toBe("over_budget");
  });
});
