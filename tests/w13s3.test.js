// W13.S3: streak stakes. The count is the focal figure of an endless run,
// the best sits quiet beside it, and passing the best you walked in with
// states itself as a celebration (class plus copy). Streak values and the
// best still come from the storage module only (C64, C65). Environment
// follows the W8.S1 house pattern.

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
import { STORAGE_KEY, getBestStreak } from "../docs/js/game/storage.js";

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

// Only GPQA differs, so every question is the same stat template and the
// correct option is always the higher-scoring model: a run is steerable.
const gpqaOnly = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [
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
  ],
  events: [],
  surprises: [],
};

// ---------- environment ----------

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

function seedBest(best) {
  stub.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, endless: { best }, daily: {} })
  );
}

function view() {
  return render({ data: gpqaOnly, route: { seed: "1" } });
}

const streakEl = (v) => v.querySelector(".game-progress .game-streak");
const labelEl = (v) => v.querySelector(".game-progress .game-streak-label");

/** Answer the current question correctly, then advance. */
function answerRight(v) {
  const buttons = [...v.querySelectorAll("#game-cards button")];
  const prompt = v.querySelector(".game-prompt").textContent;
  // Higher GPQA wins; the option order is seeded, so find Beta 2's card.
  const target = buttons.find((b) => b.textContent.startsWith("Beta 2"));
  expect(target, `a Beta 2 card exists for: ${prompt}`).toBeDefined();
  target.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  v.querySelector(".game-next").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true })
  );
}

// ---------- the streak is the figure ----------

describe("the count is the focal figure", () => {
  it("renders the streak as its own element, the best as a quiet label", () => {
    seedBest(4);
    const v = view();
    expect(streakEl(v).textContent).toBe("0");
    expect(labelEl(v).textContent).toBe("Streak · Best 4");
  });

  it("the figure is the number alone: no label text inside it", () => {
    seedBest(4);
    expect(streakEl(view()).textContent).toMatch(/^\d+$/);
  });

  it("counts up as the run continues", () => {
    seedBest(9);
    const v = view();
    answerRight(v);
    expect(streakEl(v).textContent).toBe("1");
    answerRight(v);
    expect(streakEl(v).textContent).toBe("2");
  });
});

// ---------- the celebration ----------

describe("beating your best is the moment", () => {
  it("stays quiet while the run is still short of the best", () => {
    seedBest(3);
    const v = view();
    answerRight(v);
    answerRight(v);
    expect(streakEl(v).textContent).toBe("2");
    expect(streakEl(v).classList.contains("streak-best")).toBe(false);
    expect(labelEl(v).textContent).toBe("Streak · Best 3");
  });

  it("stays quiet on merely equalling the best", () => {
    seedBest(2);
    const v = view();
    answerRight(v);
    answerRight(v);
    expect(streakEl(v).textContent).toBe("2");
    expect(streakEl(v).classList.contains("streak-best")).toBe(false);
  });

  it("celebrates, in class and copy, once the run passes it", () => {
    seedBest(2);
    const v = view();
    answerRight(v);
    answerRight(v);
    answerRight(v);
    expect(streakEl(v).textContent).toBe("3");
    expect(streakEl(v).classList.contains("streak-best")).toBe(true);
    expect(labelEl(v).textContent).toBe("New best streak");
  });

  it("does not celebrate a first-ever run: there is no best to beat", () => {
    seedBest(0);
    const v = view();
    answerRight(v);
    expect(streakEl(v).textContent).toBe("1");
    expect(streakEl(v).classList.contains("streak-best")).toBe(false);
    expect(labelEl(v).textContent).toBe("Streak · Best 1");
  });

  it("celebrates against the best walked in with, not the live one", () => {
    // recordCorrect persists the new best immediately, so a view that
    // compared against storage would congratulate every correct answer.
    seedBest(1);
    const v = view();
    answerRight(v);
    expect(getBestStreak()).toBe(1);
    expect(streakEl(v).classList.contains("streak-best")).toBe(false);
    answerRight(v);
    expect(getBestStreak()).toBe(2);
    expect(streakEl(v).classList.contains("streak-best")).toBe(true);
  });
});

// ---------- the reset ----------

describe("a wrong answer resets the stake, not the run (C64)", () => {
  it("drops the count to 0, keeps the best, and play continues", () => {
    seedBest(5);
    const v = view();
    answerRight(v);
    const wrong = [...v.querySelectorAll("#game-cards button")].find((b) =>
      b.textContent.startsWith("Alpha 1")
    );
    wrong.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    v.querySelector(".game-next").dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true })
    );
    expect(streakEl(v).textContent).toBe("0");
    expect(labelEl(v).textContent).toBe("Streak · Best 5");
    expect(v.querySelectorAll("#game-cards button")).toHaveLength(2);
    expect(v.querySelector(".game-prompt").textContent).not.toBe("");
  });

  it("the celebration clears with the reset", () => {
    seedBest(1);
    const v = view();
    answerRight(v);
    answerRight(v);
    expect(streakEl(v).classList.contains("streak-best")).toBe(true);
    const wrong = [...v.querySelectorAll("#game-cards button")].find((b) =>
      b.textContent.startsWith("Alpha 1")
    );
    wrong.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    v.querySelector(".game-next").dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true })
    );
    expect(streakEl(v).classList.contains("streak-best")).toBe(false);
  });
});

// ---------- storage discipline (C65) ----------

describe("the streak reads and writes through the storage module only", () => {
  it("uses the single key, never another", () => {
    seedBest(2);
    const v = view();
    answerRight(v);
    expect([...stub.map.keys()]).toEqual([STORAGE_KEY]);
  });

  it("persists the beaten best for the next session", () => {
    seedBest(1);
    const v = view();
    answerRight(v);
    answerRight(v);
    answerRight(v);
    expect(getBestStreak()).toBe(3);
    const fresh = view();
    expect(streakEl(fresh).textContent).toBe("0");
    expect(labelEl(fresh).textContent).toBe("Streak · Best 3");
  });
});
