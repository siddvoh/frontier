// W8.S1: endless mode question screen (C63, C64, C65, C71). The view is
// exercised end to end under jsdom against fixture artifacts: seeded
// reproducibility, #game-cards button semantics, streak/best persistence
// through the storage module (in-memory localStorage stub), reveal content
// for stat and scenario templates (formula strings verbatim per C60), and
// the next-question flow.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { JSDOM } from "jsdom";

import { render } from "../docs/js/game/views/endless.js";
import { endlessQuestions } from "../docs/js/game/questions.js";
import { STORAGE_KEY, getBestStreak } from "../docs/js/game/storage.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- fixtures ----------

function model(overrides) {
  return {
    id: "x",
    name: "X",
    organization: "X Lab",
    releaseDate: "2024-01-01",
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

function artifact(models) {
  return {
    generatedAt: "2026-07-01T00:00:00Z",
    attribution:
      'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
    models,
    events: [],
    surprises: [],
  };
}

// Every field differs, so all eight templates are valid (pool size 8).
const rich = artifact([
  model({
    id: "alpha-1",
    name: "Alpha 1",
    releaseDate: "2024-05-01",
    pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
    contextWindow: 200000,
    benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
  }),
  model({
    id: "beta-2",
    name: "Beta 2",
    releaseDate: "2025-01-15",
    pricing: { inputPerMTok: 10, outputPerMTok: 30, currency: "USD" },
    contextWindow: 1000000,
    benchmarks: { gpqaDiamond: 71.9, swebenchVerified: 55.0 },
  }),
]);

// Only GPQA differs; every other template is invalid, so the pool is
// exactly { stat-gpqa } and the first question is a stat question.
const gpqaOnly = artifact([
  model({
    id: "alpha-1",
    name: "Alpha 1",
    benchmarks: { gpqaDiamond: 60.1, swebenchVerified: null },
  }),
  model({
    id: "beta-2",
    name: "Beta 2",
    benchmarks: { gpqaDiamond: 71.9, swebenchVerified: null },
  }),
]);

// Equal input price and context, differing output price: the pool is
// { stat-output-price, scen-input-heavy, scen-output-heavy }, so scenario
// questions are reachable in a few draws.
const scenarioHeavy = artifact([
  model({
    id: "alpha-1",
    name: "Alpha 1",
    pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
    contextWindow: 200000,
  }),
  model({
    id: "beta-2",
    name: "Beta 2",
    pricing: { inputPerMTok: 3, outputPerMTok: 30, currency: "USD" },
    contextWindow: 200000,
  }),
]);

// Nothing differs and nothing is priced: the candidate pool is empty.
const empty = artifact([
  model({ id: "alpha-1", name: "Alpha 1" }),
  model({ id: "beta-2", name: "Beta 2" }),
]);

const NAMES = { "alpha-1": "Alpha 1", "beta-2": "Beta 2" };

// ---------- environment (jsdom document, throwing fetch, storage stub) ----------

const saved = { document: globalThis.document, fetch: globalThis.fetch };
let dom;

beforeAll(() => {
  dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not call fetch");
  };
});

afterAll(() => {
  globalThis.document = saved.document;
  globalThis.fetch = saved.fetch;
});

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

let stub;

beforeEach(() => {
  stub = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

// ---------- drive helpers ----------

function renderAt(seed, data = rich) {
  return render({ route: { view: "endless", seed }, data });
}

function take(seed, count, data = rich) {
  const gen = endlessQuestions(seed, data);
  return Array.from({ length: count }, () => gen.next().value);
}

function optionButtons(view) {
  return [...view.querySelectorAll("#game-cards button")];
}

function shown(view) {
  return {
    prompt: view.querySelector(".game-prompt").textContent,
    labels: optionButtons(view).map((b) => b.textContent),
  };
}

function progressText(view) {
  return view.querySelector(".game-progress").textContent;
}

function answer(view, index) {
  optionButtons(view)[index].click();
}

function clickNext(view) {
  view.querySelector("button.game-next").click();
}

function expectedShape(question) {
  return {
    prompt: question.prompt,
    labels: [NAMES[question.optionA], NAMES[question.optionB]],
  };
}

// ---------- question screen semantics (C71) ----------

describe("question screen semantics (C71)", () => {
  it("renders two <button> option cards inside #game-cards.glass", () => {
    const view = renderAt(101);
    const cards = view.querySelector("#game-cards");
    expect(cards).not.toBeNull();
    expect(cards.classList.contains("glass")).toBe(true);
    const buttons = optionButtons(view);
    expect(buttons).toHaveLength(2);
    expect([...cards.children]).toEqual(buttons);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.disabled).toBe(false);
      expect(button.textContent).not.toBe("");
    }
  });

  it("shows the first seeded question's prompt and model-name labels", () => {
    const [first] = take(101, 1);
    const view = renderAt(101);
    expect(shown(view)).toEqual(expectedShape(first));
  });

  it("shows a streak display before any answer", () => {
    const view = renderAt(101);
    expect(progressText(view)).toBe("Streak 0 · Best 0");
    // The stub keeps the w7s1 muted-paragraph shape alive.
    expect(view.querySelector("h2").textContent).toBe("Endless");
    expect(view.querySelector("p.muted")).not.toBeNull();
  });

  it("renders no reveal and no next control before an answer", () => {
    const view = renderAt(101);
    expect(view.querySelector(".game-reveal")).toBeNull();
    expect(view.querySelector(".game-next")).toBeNull();
  });

  it("renders a muted note and no cards when the pool is empty", () => {
    const view = renderAt(101, empty);
    expect(view.querySelector("#game-cards")).toBeNull();
    expect(view.querySelector(".glass")).toBeNull();
    const note = view.querySelector("p.muted");
    expect(note).not.toBeNull();
    expect(note.textContent).not.toBe("");
  });
});

// ---------- seeded reproducibility (C63) ----------

describe("seeded sequence is reproducible (C63)", () => {
  function walk(view, expected) {
    const seen = [];
    for (const question of expected) {
      seen.push(shown(view));
      answer(view, question.correctIndex);
      clickNext(view);
    }
    return seen;
  }

  it("renders the generator's sequence for a fixed ?seed=", () => {
    const expected = take(202, 5);
    const seen = walk(renderAt(202), expected);
    expect(seen).toEqual(expected.map(expectedShape));
  });

  it("replays the identical sequence on a second seeded session", () => {
    const expected = take(202, 5);
    const first = walk(renderAt(202), expected);
    const second = walk(renderAt(202), expected);
    expect(second).toEqual(first);
  });

  it("renders identical initial markup for the same seed", () => {
    expect(renderAt(303).outerHTML).toBe(renderAt(303).outerHTML);
  });

  it("seeds from Date.now() at session start when ?seed= is absent", () => {
    vi.spyOn(Date, "now").mockReturnValue(31337);
    const [first] = take(31337, 1);
    const view = renderAt(null);
    expect(shown(view)).toEqual(expectedShape(first));
  });
});

// ---------- streak and persistence (C64, C65) ----------

describe("streak and best-streak persistence (C64, C65)", () => {
  it("increments on correct, resets to 0 on wrong, play continuing", () => {
    const questions = take(404, 4);
    const view = renderAt(404);

    answer(view, questions[0].correctIndex);
    expect(progressText(view)).toBe("Streak 1 · Best 1");
    clickNext(view);

    answer(view, questions[1].correctIndex);
    expect(progressText(view)).toBe("Streak 2 · Best 2");
    clickNext(view);

    answer(view, 1 - questions[2].correctIndex);
    expect(progressText(view)).toBe("Streak 0 · Best 2");

    // Play continues after a wrong answer: the next question is live.
    clickNext(view);
    expect(shown(view)).toEqual(expectedShape(questions[3]));
    expect(optionButtons(view).every((b) => !b.disabled)).toBe(true);
  });

  it("persists the best through the storage module's single key", () => {
    const questions = take(404, 2);
    const view = renderAt(404);
    answer(view, questions[0].correctIndex);
    clickNext(view);
    answer(view, questions[1].correctIndex);

    expect(getBestStreak()).toBe(2);
    expect([...stub.map.keys()]).toEqual([STORAGE_KEY]);
    expect(JSON.parse(stub.map.get(STORAGE_KEY)).endless.best).toBe(2);
  });

  it("shows the persisted best in a fresh session at streak 0", () => {
    const [first] = take(505, 1);
    const view = renderAt(505);
    answer(view, first.correctIndex);
    expect(progressText(view)).toBe("Streak 1 · Best 1");

    const fresh = renderAt(606);
    expect(progressText(fresh)).toBe("Streak 0 · Best 1");
  });

  it("ignores extra option clicks once the question is answered", () => {
    const [first] = take(404, 1);
    const view = renderAt(404);
    answer(view, first.correctIndex);
    expect(progressText(view)).toBe("Streak 1 · Best 1");
    answer(view, 1 - first.correctIndex);
    answer(view, first.correctIndex);
    expect(progressText(view)).toBe("Streak 1 · Best 1");
    expect(getBestStreak()).toBe(1);
  });
});

// ---------- reveal content (C60, C71) ----------

describe("reveal content per template (C60, C71)", () => {
  it("stat reveal shows the real field values", () => {
    const [question] = take(11, 1, gpqaOnly);
    expect(question.templateId).toBe("stat-gpqa");
    const view = renderAt(11, gpqaOnly);
    answer(view, question.correctIndex);

    const reveal = view.querySelector(".game-reveal");
    expect(reveal).not.toBeNull();
    expect(reveal.textContent).toContain("Correct.");
    expect(reveal.textContent).toContain("GPQA Diamond");
    expect(reveal.textContent).toContain("60.1");
    expect(reveal.textContent).toContain("71.9");
  });

  it("wrong answers reveal the winning model by name", () => {
    const [question] = take(11, 1, gpqaOnly);
    const view = renderAt(11, gpqaOnly);
    answer(view, 1 - question.correctIndex);
    const reveal = view.querySelector(".game-reveal");
    const winner =
      question.correctIndex === 0 ? question.optionA : question.optionB;
    expect(reveal.textContent).toContain("Not quite");
    expect(reveal.textContent).toContain(NAMES[winner]);
  });

  it("scenario reveal shows both engine formula strings verbatim", () => {
    // Walk the deterministic seeded stream to the first scenario question.
    const gen = endlessQuestions(22, scenarioHeavy);
    const view = renderAt(22, scenarioHeavy);
    let question = gen.next().value;
    let hops = 0;
    while (!question.templateId.startsWith("scen-")) {
      expect(hops++).toBeLessThan(50);
      answer(view, question.correctIndex);
      clickNext(view);
      question = gen.next().value;
    }
    expect(shown(view)).toEqual(expectedShape(question));

    answer(view, question.correctIndex);
    const reveal = view.querySelector(".game-reveal");
    expect(reveal).not.toBeNull();
    const { formulaA, formulaB, budget } = question.revealData;
    expect(formulaA).not.toBe(formulaB);
    expect(reveal.textContent).toContain(formulaA);
    expect(reveal.textContent).toContain(formulaB);
    expect(reveal.textContent).toContain("$" + budget.toFixed(2));
  });
});

// ---------- next-question flow (C71) ----------

describe("next-question flow (C71)", () => {
  it("shows a next control after an answer and advances the stream", () => {
    const questions = take(707, 2);
    const view = renderAt(707);
    answer(view, questions[0].correctIndex);

    const next = view.querySelector("button.game-next");
    expect(next).not.toBeNull();
    expect(next.tagName).toBe("BUTTON");
    expect(next.textContent).not.toBe("");
    expect(optionButtons(view).every((b) => b.disabled)).toBe(true);

    next.click();
    expect(shown(view)).toEqual(expectedShape(questions[1]));
    expect(view.querySelector(".game-reveal")).toBeNull();
    expect(view.querySelector(".game-next")).toBeNull();
    expect(optionButtons(view).every((b) => !b.disabled)).toBe(true);
  });
});

// ---------- module hygiene (C13, C19, C65) ----------

describe("endless.js module hygiene (C13, C19, C65)", () => {
  const source = readFileSync(
    path.join(root, "docs", "js", "game", "views", "endless.js"),
    "utf8"
  );

  it("never touches localStorage, fetch, or ambient randomness", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("Math.random");
  });

  it("imports only from within docs/js/", () => {
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      expect(spec.startsWith("../") || spec.startsWith("./")).toBe(true);
    }
  });
});
