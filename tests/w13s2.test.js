// W13.S2: the daily results screen as a moment. The day number is the
// headline, the squares carry the story with an X/M subline, best streak
// and the wait for the next daily sit beneath, and the C68 share string
// stays rendered as the quiet copy source (C72). The share string itself
// is byte-identical to its STEP 2 form, the copy paths are C69's, and
// revisiting records nothing (C67). Environment follows the W8.S1 pattern.

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

import { render } from "../docs/js/game/views/daily.js";
import { buildShareString, dayNumber } from "../docs/js/game/share.js";
import * as storage from "../docs/js/game/storage.js";

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

const artifact = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [
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
  ],
  events: [],
  surprises: [],
};

const state = { data: artifact, route: {} };

const RESULT_DATE = "2026-08-01";
const record = {
  questionIds: ["a", "b", "c", "d", "e"],
  picks: [0, 1, 0, 1, 0],
  correct: [true, true, false, true, false],
  completed: true,
};

// 21:15 UTC, so the next daily is 2h 45m away.
const NOW = new Date("2026-08-01T21:15:00Z");

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
  stub.setItem(
    storage.STORAGE_KEY,
    JSON.stringify({
      version: 1,
      endless: { best: 7 },
      daily: { [RESULT_DATE]: record },
    })
  );
});

afterEach(() => {
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

const results = () =>
  render(state, RESULT_DATE, NOW).querySelector("#game-results");

// ---------- the moment ----------

describe("the day number is the headline", () => {
  it("leads with Frontier #N, matching the C68 day formula", () => {
    const view = results();
    const day = view.querySelector(".game-day");
    expect(day).not.toBeNull();
    expect(day.tagName).toBe("H3");
    expect(day.textContent).toBe(`Frontier #${dayNumber(RESULT_DATE)}`);
    expect(day.textContent).toBe("Frontier #18");
  });

  it("the headline comes before the score and the squares", () => {
    const view = results();
    const order = [...view.children].map((c) => c.className.split(" ")[0]);
    expect(order.indexOf("game-day")).toBeLessThan(order.indexOf("game-score"));
    expect(order.indexOf("game-score")).toBeLessThan(
      order.indexOf("game-squares")
    );
  });
});

describe("the score, squares, and streak", () => {
  it("states X/M once, as a subline under the headline", () => {
    const view = results();
    const score = view.querySelector(".game-score");
    expect(score.textContent).toContain("3/5");
    expect(view.querySelectorAll(".game-score")).toHaveLength(1);
  });

  it("renders one squares row, in question order", () => {
    const view = results();
    expect(view.querySelectorAll(".game-squares")).toHaveLength(1);
    const squares = [...view.querySelectorAll(".game-squares span")];
    expect(squares.map((s) => s.dataset.correct)).toEqual([
      "true",
      "true",
      "false",
      "true",
      "false",
    ]);
  });

  it("shows the best streak, read through the storage module", () => {
    const view = results();
    const best = view.querySelector(".game-best");
    expect(best).not.toBeNull();
    expect(best.textContent).toBe("Best streak: 7");
  });

  it("stays silent about the streak until the player has one", () => {
    // Best streak is an endless stat. A daily-only player has none, and
    // "Best streak: 0" tells them nothing.
    stub.setItem(
      storage.STORAGE_KEY,
      JSON.stringify({
        version: 1,
        endless: { best: 0 },
        daily: { [RESULT_DATE]: record },
      })
    );
    const view = results();
    expect(view.querySelector(".game-best")).toBeNull();
    // The rest of the moment is unaffected.
    expect(view.querySelector(".game-day").textContent).toBe("Frontier #18");
    expect(view.querySelector(".game-next-daily")).not.toBeNull();
    expect(view.querySelector(".game-share")).not.toBeNull();
  });
});

describe("the wait for the next daily", () => {
  it("states the time to the next UTC midnight, from the injected clock", () => {
    const view = results();
    const next = view.querySelector(".game-next-daily");
    expect(next).not.toBeNull();
    expect(next.textContent).toBe("Next daily in 2h 45m.");
  });

  it("is computed once at render: no timer is ever started", () => {
    const setInterval = vi.spyOn(dom.window, "setInterval");
    const setTimeout = vi.spyOn(dom.window, "setTimeout");
    results();
    expect(setInterval).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("reads the clock it is given, not the wall clock", () => {
    const justBeforeMidnight = new Date("2026-08-01T23:59:00Z");
    const view = render(state, RESULT_DATE, justBeforeMidnight).querySelector(
      "#game-results"
    );
    expect(view.querySelector(".game-next-daily").textContent).toBe(
      "Next daily in 0h 1m."
    );
  });
});

describe("the share string stays exactly what STEP 2 promised (C68, C72)", () => {
  it("renders the C68 string byte-identical, inside #game-results", () => {
    const view = results();
    const expected = `Frontier #18 3/5\n${GREEN}${GREEN}${RED}${GREEN}${RED}`;
    expect(buildShareString(record, RESULT_DATE)).toBe(expected);
    expect(view.querySelector(".game-share").textContent).toBe(expected);
  });

  it("sits quiet beneath the moment, after the squares", () => {
    const view = results();
    const order = [...view.children].map((c) => c.className.split(" ")[0]);
    expect(order.indexOf("game-squares")).toBeLessThan(
      order.indexOf("game-share")
    );
    expect(view.querySelector(".game-share").classList).toContain("muted");
  });

  it("keeps the C69 copy button, wired to the exact share string", () => {
    // The two clipboard paths themselves are C69 and belong to w6s4,
    // which drives copyShareString with injected deps. What this screen
    // owns is the button and the string it hands over.
    const view = results();
    const copy = view.querySelector(".game-copy");
    expect(copy).not.toBeNull();
    expect(copy.tagName).toBe("BUTTON");
    expect(copy.type).toBe("button");
    expect(copy.textContent).toBe("Copy result");
    expect(copy.dataset.copied).toBeUndefined();
    expect(view.querySelector(".game-share").textContent).toBe(
      `Frontier #18 3/5\n${GREEN}${GREEN}${RED}${GREEN}${RED}`
    );
  });
});

describe("revisiting is a replay of the record, never of the play (C67)", () => {
  it("renders results with no cards and writes nothing", () => {
    const save = vi.spyOn(storage, "saveDailyRecord");
    const view = render(state, RESULT_DATE, NOW);
    expect(view.querySelector("#game-cards")).toBeNull();
    expect(view.querySelector("#game-results")).not.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
