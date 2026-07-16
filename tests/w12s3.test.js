// W12.S3: game feedback on real state colors (STEP 3).
// The correct card states in --success and a wrong pick in --danger, via
// class names the W12.S2 stylesheet pins by selector. The C68 share string
// is untouched: emoji squares are the share format, not the screen format.
// Environment setup follows the W8.S1 house pattern (jsdom document,
// throwing fetch, in-memory storage stub).

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

import { render as renderEndless } from "../docs/js/game/views/endless.js";
import { render as renderDaily } from "../docs/js/game/views/daily.js";
import { buildShareString } from "../docs/js/game/share.js";
import { STORAGE_KEY } from "../docs/js/game/storage.js";

const GREEN = "\u{1F7E9}";
const RED = "\u{1F7E5}";

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

const LAUNCH = "2026-07-15";
const RESULT_DATE = "2026-08-01";
const completedRecord = {
  questionIds: ["a", "b", "c"],
  picks: [0, 1, 0],
  correct: [true, false, true],
  completed: true,
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

function click(el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// ---------- endless ----------

describe("endless answer states (STEP 3)", () => {
  function play(pickIndex) {
    const view = renderEndless({ data: rich, route: { seed: "1" } });
    const buttons = [...view.querySelectorAll("#game-cards button")];
    click(buttons[pickIndex]);
    return { view, buttons };
  }

  it("marks exactly one card correct, never dimming by inline opacity", () => {
    const { buttons } = play(0);
    const correct = buttons.filter((b) => b.classList.contains("card-correct"));
    expect(correct).toHaveLength(1);
    for (const button of buttons) expect(button.style.opacity).toBe("");
  });

  it("card-wrong appears iff the picked card is not the correct one", () => {
    for (const pick of [0, 1]) {
      const { buttons } = play(pick);
      const picked = buttons.find((b) => b.classList.contains("card-picked"));
      const wasWrong = !picked.classList.contains("card-correct");
      expect(picked.classList.contains("card-wrong"), `pick ${pick}`).toBe(
        wasWrong
      );
    }
  });

  it("the verdict line carries the matching state class", () => {
    const { view, buttons } = play(0);
    const verdict = view.querySelector(".game-verdict");
    expect(verdict).not.toBeNull();
    const picked = buttons.find((b) => b.classList.contains("card-picked"));
    const wasCorrect = picked.classList.contains("card-correct");
    expect(verdict.classList.contains("verdict-correct")).toBe(wasCorrect);
    expect(verdict.classList.contains("verdict-wrong")).toBe(!wasCorrect);
  });

  it("every state class clears when the next question renders", () => {
    const { view, buttons } = play(0);
    click(view.querySelector(".game-next"));
    for (const button of buttons) {
      for (const cls of ["card-correct", "card-picked", "card-wrong"]) {
        expect(button.classList.contains(cls), cls).toBe(false);
      }
    }
  });
});

// ---------- daily ----------

describe("daily answer states (STEP 3)", () => {
  function playOne(pickIndex) {
    const view = renderDaily({ data: rich, route: {} }, LAUNCH);
    const buttons = [...view.querySelectorAll("#game-cards button")];
    click(buttons[pickIndex]);
    return { view, buttons };
  }

  it("marks the correct card and the wrong pick by class", () => {
    const { buttons } = playOne(0);
    expect(
      buttons.filter((b) => b.classList.contains("card-correct"))
    ).toHaveLength(1);
    const picked = buttons.find((b) => b.dataset.picked === "true");
    const wasWrong = !picked.classList.contains("card-correct");
    expect(picked.classList.contains("card-wrong")).toBe(wasWrong);
  });

  it("the verdict line carries the matching state class", () => {
    const { view, buttons } = playOne(0);
    const verdict = view.querySelector(".game-verdict");
    expect(verdict).not.toBeNull();
    const picked = buttons.find((b) => b.dataset.picked === "true");
    const wasCorrect = picked.classList.contains("card-correct");
    expect(verdict.classList.contains("verdict-correct")).toBe(wasCorrect);
    expect(verdict.classList.contains("verdict-wrong")).toBe(!wasCorrect);
  });
});

// ---------- results squares vs the share string ----------

describe("results squares are tokenized, the share string is not (C68)", () => {
  beforeEach(() => {
    stub.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        endless: { best: 0 },
        daily: { [RESULT_DATE]: completedRecord },
      })
    );
  });

  it("renders labeled data-correct elements carrying no glyph text", () => {
    const view = renderDaily({ data: rich, route: {} }, RESULT_DATE);
    const squares = [...view.querySelectorAll(".game-squares span")];
    expect(squares.map((s) => s.dataset.correct)).toEqual([
      "true",
      "false",
      "true",
    ]);
    for (const square of squares) {
      expect(square.textContent).toBe("");
      expect(square.getAttribute("role")).toBe("img");
      expect(square.getAttribute("aria-label")).toMatch(/^(correct|wrong)$/);
    }
  });

  it("keeps the C68 share string byte-identical, emoji included", () => {
    const view = renderDaily({ data: rich, route: {} }, RESULT_DATE);
    const expected = `Frontier #18 2/3\n${GREEN}${RED}${GREEN}`;
    expect(buildShareString(completedRecord, RESULT_DATE)).toBe(expected);
    expect(view.querySelector(".game-share").textContent).toBe(expected);
  });

  it("renders no emoji square glyph outside the share string", () => {
    const view = renderDaily({ data: rich, route: {} }, RESULT_DATE);
    view.querySelector(".game-share").remove();
    expect(view.textContent).not.toContain(GREEN);
    expect(view.textContent).not.toContain(RED);
  });
});
