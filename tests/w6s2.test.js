import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeCost } from "../docs/js/engine.js";
import {
  xmur3,
  mulberry32,
  dailySeed,
  TEMPLATE_IDS,
  makeQuestion,
  generateDaily,
  endlessQuestions,
} from "../docs/js/game/questions.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const questionsSource = readFileSync(
  path.join(root, "docs", "js", "game", "questions.js"),
  "utf8",
);
const specSource = readFileSync(path.join(root, "SPEC.md"), "utf8");

function fixture(name) {
  return JSON.parse(
    readFileSync(path.join(root, "tests", "fixtures", "w6s2", name), "utf8"),
  );
}

const models = fixture("models.json");
const modelsSmall = fixture("models-small.json");
const artifact = (surprisesName, modelList = models) => ({
  models: modelList,
  surprises: fixture(surprisesName),
});

const byId = (id) => {
  const model = models.find((m) => m.id === id);
  if (!model) throw new Error(`fixture model missing: ${id}`);
  return model;
};
const alpha = byId("alpha");
const bravo = byId("bravo");
const charlie = byId("charlie");
const delta = byId("delta"); // null prices
const echo = byId("echo"); // null context/benchmarks/releaseDate
const foxtrot = byId("foxtrot"); // equal to alpha on every stat

// Pinned constants for mulberry32(xmur3("2026-07-15")()) per C58.
const PINNED_SEED = 1501764002;
const PINNED_OUTPUTS = [
  0.3059037704952061,
  0.6339699849486351,
  0.33315296238288283,
];

describe("W6.S2 C58: seeded PRNG", () => {
  it("xmur3('2026-07-15')() yields the pinned seed", () => {
    expect(xmur3("2026-07-15")()).toBe(PINNED_SEED);
    expect(dailySeed("2026-07-15")).toBe(PINNED_SEED);
  });

  it("mulberry32(xmur3('2026-07-15')()) first three outputs match pinned constants", () => {
    const rng = mulberry32(xmur3("2026-07-15")());
    expect([rng(), rng(), rng()]).toEqual(PINNED_OUTPUTS);
  });

  it("questions.js contains the C58 listing byte-identical to SPEC", () => {
    const fenceMatch = specSource.match(/ {2}```js\n([\s\S]*?) {2}```\n/);
    expect(fenceMatch).not.toBeNull();
    const listing = fenceMatch[1].replace(/^ {2}/gm, "");
    expect(listing).toContain("export function xmur3");
    expect(listing).toContain("export function mulberry32");
    expect(questionsSource).toContain(listing);
  });

  it("questions.js is pure: no Math.random, DOM, fetch, storage, or outside imports (C19)", () => {
    expect(questionsSource).not.toMatch(/Math\.random/);
    expect(questionsSource).not.toMatch(/\bfetch\s*\(/);
    expect(questionsSource).not.toMatch(/localStorage|sessionStorage/);
    expect(questionsSource).not.toMatch(/\bdocument\.|\bwindow\./);
    const importPaths = [...questionsSource.matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(importPaths).toEqual(["../engine.js"]);
  });
});

describe("W6.S2 C59: eight templates and validity", () => {
  it("exposes exactly the eight template ids", () => {
    expect(TEMPLATE_IDS).toEqual([
      "stat-input-price",
      "stat-output-price",
      "stat-context",
      "stat-gpqa",
      "stat-swebench",
      "stat-released-first",
      "scen-input-heavy",
      "scen-output-heavy",
    ]);
  });

  const statCases = [
    ["stat-input-price", delta, (m) => m.pricing.inputPerMTok],
    ["stat-output-price", delta, (m) => m.pricing.outputPerMTok],
    ["stat-context", echo, (m) => m.contextWindow],
    ["stat-gpqa", echo, (m) => m.benchmarks.gpqaDiamond],
    ["stat-swebench", echo, (m) => m.benchmarks.swebenchVerified],
    ["stat-released-first", echo, (m) => m.releaseDate],
  ];

  for (const [templateId, nullModel, value] of statCases) {
    describe(templateId, () => {
      it("builds a valid question with the higher/earlier option correct", () => {
        const q = makeQuestion(templateId, alpha, charlie);
        expect(q).not.toBeNull();
        expect(q.templateId).toBe(templateId);
        expect(q.optionA).toBe("alpha");
        expect(q.optionB).toBe("charlie");
        expect(typeof q.prompt).toBe("string");
        if (templateId === "stat-released-first") {
          // alpha released 2024-01-01, before charlie 2025-01-01.
          expect(q.correctIndex).toBe(0);
        } else {
          const correct =
            value(alpha) > value(charlie) ? 0 : 1;
          expect(q.correctIndex).toBe(correct);
        }
      });

      it("returns null when a field is null", () => {
        expect(makeQuestion(templateId, alpha, nullModel)).toBeNull();
        expect(makeQuestion(templateId, nullModel, alpha)).toBeNull();
      });

      it("returns null when the values are equal", () => {
        expect(makeQuestion(templateId, alpha, foxtrot)).toBeNull();
      });
    });
  }

  it("question id is `${templateId}:${idLow}:${idHigh}` in lexicographic order regardless of display order", () => {
    const forward = makeQuestion("stat-gpqa", alpha, bravo);
    const flipped = makeQuestion("stat-gpqa", bravo, alpha);
    expect(forward.id).toBe("stat-gpqa:alpha:bravo");
    expect(flipped.id).toBe("stat-gpqa:alpha:bravo");
    expect(flipped.optionA).toBe("bravo");
    expect(flipped.optionB).toBe("alpha");
    expect(flipped.correctIndex).toBe(1 - forward.correctIndex);
  });

  it("question objects carry exactly the C59 keys", () => {
    const stat = makeQuestion("stat-context", alpha, bravo);
    const scen = makeQuestion("scen-input-heavy", alpha, bravo);
    const keys = [
      "id",
      "templateId",
      "prompt",
      "optionA",
      "optionB",
      "correctIndex",
      "revealData",
    ];
    expect(Object.keys(stat).sort()).toEqual([...keys].sort());
    expect(Object.keys(scen).sort()).toEqual([...keys].sort());
  });

  for (const [templateId, inMTok, outMTok] of [
    ["scen-input-heavy", 50, 5],
    ["scen-output-heavy", 5, 50],
  ]) {
    describe(templateId, () => {
      it("uses the exact unrounded midpoint budget so exactly one model qualifies (C24)", () => {
        const q = makeQuestion(templateId, alpha, bravo);
        expect(q).not.toBeNull();
        const input = {
          budgetUsdPerMonth: 0,
          task: "longdoc",
          inputMTokPerMonth: inMTok,
          outputMTokPerMonth: outMTok,
          constraints: {
            openWeightsOnly: null,
            minContextTokens: null,
            releasedOnOrAfter: null,
            releasedOnOrBefore: null,
          },
        };
        const costA = computeCost(alpha, input).totalCost;
        const costB = computeCost(bravo, input).totalCost;
        expect(q.revealData.budget).toBe((costA + costB) / 2);
        const qualifies = [costA, costB].filter(
          (c) => c <= q.revealData.budget,
        );
        expect(qualifies).toHaveLength(1);
        expect(q.correctIndex).toBe(costA < costB ? 0 : 1);
      });

      it("returns null when a price is null, context is null, or costs are equal", () => {
        expect(makeQuestion(templateId, alpha, delta)).toBeNull(); // null prices
        expect(makeQuestion(templateId, alpha, echo)).toBeNull(); // null context
        expect(makeQuestion(templateId, alpha, foxtrot)).toBeNull(); // equal costs
      });
    });
  }
});

describe("W6.S2 C60: reveal data", () => {
  it("stat templates expose { field, valueA, valueB } in display order", () => {
    const q = makeQuestion("stat-input-price", bravo, alpha);
    expect(q.revealData).toEqual({
      field: "pricing.inputPerMTok",
      valueA: bravo.pricing.inputPerMTok,
      valueB: alpha.pricing.inputPerMTok,
    });
    const dateQ = makeQuestion("stat-released-first", alpha, bravo);
    expect(dateQ.revealData).toEqual({
      field: "releaseDate",
      valueA: "2024-01-01",
      valueB: "2024-06-01",
    });
  });

  it("scenario templates expose budget, volumes, both costs, and verbatim engine formulas", () => {
    const q = makeQuestion("scen-output-heavy", alpha, charlie);
    const input = {
      budgetUsdPerMonth: q.revealData.budget,
      task: "longdoc",
      inputMTokPerMonth: 5,
      outputMTokPerMonth: 50,
      constraints: {
        openWeightsOnly: null,
        minContextTokens: null,
        releasedOnOrAfter: null,
        releasedOnOrBefore: null,
      },
    };
    const engineA = computeCost(alpha, input);
    const engineC = computeCost(charlie, input);
    expect(q.revealData).toEqual({
      budget: (engineA.totalCost + engineC.totalCost) / 2,
      inputMTok: 5,
      outputMTok: 50,
      costA: engineA.totalCost,
      costB: engineC.totalCost,
      formulaA: engineA.formula,
      formulaB: engineC.formula,
    });
    // Verbatim C26 shape from the engine, never reformatted.
    expect(q.revealData.formulaA).toBe(
      "5.00 Mtok x $1.00 + 50.00 Mtok x $2.00 = $105.00/mo",
    );
    expect(q.revealData.formulaB).toBe(
      "5.00 Mtok x $3.00 + 50.00 Mtok x $6.00 = $315.00/mo",
    );
  });
});

// A question's surprise identity for C62 checks: (unordered pair, field).
const TEMPLATE_FIELD = {
  "stat-input-price": "pricing.inputPerMTok",
  "stat-output-price": "pricing.outputPerMTok",
  "stat-context": "contextWindow",
  "stat-gpqa": "benchmarks.gpqaDiamond",
  "stat-swebench": "benchmarks.swebenchVerified",
  "stat-released-first": "releaseDate",
};

function surpriseCount(questions, surprises) {
  return questions.filter((q) =>
    surprises.some(
      (s) =>
        s.field === TEMPLATE_FIELD[q.templateId] &&
        s.modelIds.includes(q.optionA) &&
        s.modelIds.includes(q.optionB),
    ),
  ).length;
}

describe("W6.S2 C61: generateDaily determinism and selection", () => {
  const art = artifact("surprises-0.json");

  it("same seed and artifact yield a deep-equal list", () => {
    const a = generateDaily(dailySeed("2026-07-15"), art);
    const b = generateDaily(dailySeed("2026-07-15"), art);
    expect(a).toEqual(b);
  });

  it("adjacent dates differ in at least one question id", () => {
    const day1 = generateDaily(dailySeed("2026-07-15"), art).map((q) => q.id);
    const day2 = generateDaily(dailySeed("2026-07-16"), art).map((q) => q.id);
    expect(day1).not.toEqual(day2);
  });

  it("returns min(10, poolSize) questions, unique by (unordered pair, templateId)", () => {
    const full = generateDaily(dailySeed("2026-07-15"), art);
    expect(full).toHaveLength(10);
    // ids encode (templateId, unordered pair), so uniqueness of ids is
    // uniqueness of (pair, template).
    expect(new Set(full.map((q) => q.id)).size).toBe(10);

    // 2 fully-populated models: all 8 templates valid, pool of 8.
    const small = generateDaily(
      dailySeed("2026-07-15"),
      artifact("surprises-0.json", modelsSmall),
    );
    expect(small).toHaveLength(8);
    expect(new Set(small.map((q) => q.templateId)).size).toBe(8);
    for (const q of small) {
      expect(q.id).toBe(`${q.templateId}:alpha:bravo`);
      expect([q.optionA, q.optionB].sort()).toEqual(["alpha", "bravo"]);
    }
  });

  it("every emitted question validates against makeQuestion output", () => {
    const modelById = new Map(models.map((m) => [m.id, m]));
    for (const q of generateDaily(dailySeed("2026-07-16"), art)) {
      const rebuilt = makeQuestion(
        q.templateId,
        modelById.get(q.optionA),
        modelById.get(q.optionB),
      );
      expect(rebuilt).toEqual(q);
    }
  });

  it("the seeded rng also decides A/B display order (both orders occur across dates)", () => {
    const orders = new Set();
    for (const date of ["2026-07-15", "2026-07-16", "2026-07-17"]) {
      for (const q of generateDaily(dailySeed(date), art)) {
        orders.add(q.optionA < q.optionB ? "forward" : "flipped");
      }
    }
    expect(orders).toEqual(new Set(["forward", "flipped"]));
  });
});

describe("W6.S2 C62: surprise inclusion", () => {
  for (const date of ["2026-07-15", "2026-07-16", "2026-07-17"]) {
    it(`pool of 3 valid surprises: daily for ${date} contains at least 2`, () => {
      const art = artifact("surprises-3.json");
      const daily = generateDaily(dailySeed(date), art);
      expect(surpriseCount(daily, art.surprises)).toBeGreaterThanOrEqual(2);
    });
  }

  it("pool of 1 valid surprise: daily contains it (all valid ones)", () => {
    const art = artifact("surprises-1.json");
    const daily = generateDaily(dailySeed("2026-07-15"), art);
    // The second fixture entry is invalid (null price) and yields nothing.
    expect(surpriseCount(daily, art.surprises)).toBe(1);
    expect(daily.some((q) => q.id === "stat-context:alpha:bravo")).toBe(true);
  });

  it("pool of 0 surprises: daily still has 10 questions and none are surprise-derived", () => {
    const art = artifact("surprises-0.json");
    const daily = generateDaily(dailySeed("2026-07-15"), art);
    expect(daily).toHaveLength(10);
    expect(surpriseCount(daily, art.surprises)).toBe(0);
  });
});

describe("W6.S2 C63: endless sequence", () => {
  const art = artifact("surprises-0.json");

  function take(iterator, n) {
    const out = [];
    for (const q of iterator) {
      out.push(q);
      if (out.length === n) break;
    }
    return out;
  }

  it("a fixed seed reproduces the same infinite sequence", () => {
    const a = take(endlessQuestions(12345, art), 25);
    const b = take(endlessQuestions(12345, art), 25);
    expect(a).toHaveLength(25);
    expect(a).toEqual(b);
  });

  it("emits valid C59 questions and never repeats a question back-to-back", () => {
    const seq = take(endlessQuestions(7, art), 40);
    const modelById = new Map(models.map((m) => [m.id, m]));
    for (let i = 0; i < seq.length; i++) {
      const q = seq[i];
      const rebuilt = makeQuestion(
        q.templateId,
        modelById.get(q.optionA),
        modelById.get(q.optionB),
      );
      expect(rebuilt).toEqual(q);
      if (i > 0) expect(q.id).not.toBe(seq[i - 1].id);
    }
  });

  it("different seeds diverge", () => {
    const a = take(endlessQuestions(1, art), 10).map((q) => q.id);
    const b = take(endlessQuestions(2, art), 10).map((q) => q.id);
    expect(a).not.toEqual(b);
  });
});
