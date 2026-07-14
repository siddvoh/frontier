// W8.S2: daily mode view (C61, C67, C71, C72, C76). The view is rendered
// with an injected UTC date; answers are recorded through the storage
// module as the player progresses; a completed record renders the results
// screen (share string per C68, copy button per C69) instead of a replay;
// a pre-launch date renders a notice, generates no questions, and performs
// zero storage writes (asserted with a spy on the storage module).

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

vi.mock("../docs/js/game/storage.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    saveDailyRecord: vi.fn(actual.saveDailyRecord),
    saveState: vi.fn(actual.saveState),
  };
});

import * as storage from "../docs/js/game/storage.js";
import { render } from "../docs/js/game/views/daily.js";
import { dailySeed, generateDaily } from "../docs/js/game/questions.js";
import { buildShareString } from "../docs/js/game/share.js";

const GREEN = "\u{1F7E9}";
const RED = "\u{1F7E5}";

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

// Two fully populated models differing on every C59 field, so all eight
// templates are valid for the single pair and the daily has exactly
// min(10, 8) = 8 questions covering every template.
const fixture = {
  generatedAt: "2026-07-01T00:00:00Z",
  attribution:
    'Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai',
  models: [
    model({
      id: "alpha-1",
      name: "Alpha 1",
      organization: "Alpha Lab",
      releaseDate: "2024-05-01",
      pricing: { inputPerMTok: 3, outputPerMTok: 15, currency: "USD" },
      contextWindow: 200000,
      benchmarks: { gpqaDiamond: 60.1, swebenchVerified: 40.2 },
      openWeights: false,
    }),
    model({
      id: "beta-2",
      name: "Beta 2",
      organization: "Beta Corp",
      releaseDate: "2025-01-15",
      pricing: { inputPerMTok: 10, outputPerMTok: 30, currency: "USD" },
      contextWindow: 1000000,
      benchmarks: { gpqaDiamond: 70.5, swebenchVerified: 55.9 },
      openWeights: true,
    }),
  ],
  events: [],
  surprises: [],
};

const PLAY_DATE = "2026-07-20"; // day #6
const PRE_LAUNCH_DATE = "2026-07-10";

const NAMES = { "alpha-1": "Alpha 1", "beta-2": "Beta 2" };

function memoryStorage() {
  const map = new Map();
  const setItem = vi.fn((key, value) => {
    map.set(key, String(value));
  });
  return {
    map,
    setItem,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const saved = { document: globalThis.document, fetch: globalThis.fetch };
let dom;
let stub;

beforeAll(() => {
  dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not touch the network");
  };
});

afterAll(() => {
  globalThis.document = saved.document;
  globalThis.fetch = saved.fetch;
});

beforeEach(() => {
  vi.clearAllMocks();
  stub = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.document.execCommand;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function renderDaily(date) {
  return render({ route: { view: "daily" }, data: fixture }, date);
}

function expectedQuestions() {
  return generateDaily(dailySeed(PLAY_DATE), fixture);
}

function cardButtons(el) {
  return [...el.querySelectorAll("#game-cards button")];
}

describe("pre-launch notice (C76)", () => {
  it("renders the launch date, no cards, and performs zero storage writes", () => {
    const el = renderDaily(PRE_LAUNCH_DATE);
    expect(el).toBeInstanceOf(dom.window.HTMLElement);
    expect(el.querySelector("h2").textContent).toBe("Daily");
    const note = el.querySelector("p.muted");
    expect(note).not.toBeNull();
    expect(note.textContent).toContain("2026-07-15");
    expect(el.querySelector("#game-cards")).toBeNull();
    expect(el.querySelector("#game-results")).toBeNull();
    expect(el.querySelector(".game-progress")).toBeNull();
    expect(storage.saveDailyRecord).not.toHaveBeenCalled();
    expect(storage.saveState).not.toHaveBeenCalled();
    expect(stub.setItem).not.toHaveBeenCalled();
  });
});

describe("daily question screen (C61, C71)", () => {
  it("renders the first generated question with progress and glass cards", () => {
    const questions = expectedQuestions();
    const el = renderDaily(PLAY_DATE);

    const progress = el.querySelector(".game-progress");
    expect(progress).not.toBeNull();
    expect(progress.textContent).toContain("1 of 8");

    expect(el.querySelector(".game-prompt").textContent).toBe(
      questions[0].prompt
    );

    const cards = el.querySelector("#game-cards");
    expect(cards).not.toBeNull();
    expect(cards.classList.contains("glass")).toBe(true);
    const buttons = cardButtons(el);
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => b.tagName === "BUTTON")).toBe(true);
    expect(buttons[0].textContent).toBe(NAMES[questions[0].optionA]);
    expect(buttons[1].textContent).toBe(NAMES[questions[0].optionB]);
    expect(el.querySelector(".game-reveal")).toBeNull();
    expect(el.querySelector(".game-next")).toBeNull();
  });

  it("records the answer through the storage module and shows the reveal", () => {
    const questions = expectedQuestions();
    const el = renderDaily(PLAY_DATE);
    cardButtons(el)[0].click();

    expect(storage.saveDailyRecord).toHaveBeenCalledTimes(1);
    expect(storage.saveDailyRecord).toHaveBeenCalledWith(PLAY_DATE, {
      questionIds: questions.map((q) => q.id),
      picks: [0],
      correct: [questions[0].correctIndex === 0],
      completed: false,
    });
    expect(storage.getDailyRecord(PLAY_DATE)).toEqual({
      questionIds: questions.map((q) => q.id),
      picks: [0],
      correct: [questions[0].correctIndex === 0],
      completed: false,
    });

    expect(cardButtons(el).every((b) => b.disabled)).toBe(true);
    expect(el.querySelector(".game-reveal")).not.toBeNull();
    const next = el.querySelector(".game-next");
    expect(next).not.toBeNull();
    expect(next.tagName).toBe("BUTTON");
    expect(next.textContent).toBe("Next question");
  });

  it("plays all eight questions with per-template reveals and records progress", () => {
    const questions = expectedQuestions();
    const el = renderDaily(PLAY_DATE);
    let sawStat = false;
    let sawScenario = false;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      expect(el.querySelector(".game-progress").textContent).toContain(
        `${i + 1} of ${questions.length}`
      );
      expect(el.querySelector(".game-prompt").textContent).toBe(
        question.prompt
      );

      // Alternate right and wrong picks: even index correct, odd wrong.
      const pick =
        i % 2 === 0 ? question.correctIndex : 1 - question.correctIndex;
      cardButtons(el)[pick].click();

      // Reveal shows the real C60 values for the template (C71).
      const reveal = el.querySelector(".game-reveal");
      expect(reveal).not.toBeNull();
      const text = reveal.textContent;
      const data = question.revealData;
      if (data.field !== undefined) {
        sawStat = true;
        expect(text).toContain(data.field);
        expect(text).toContain(String(data.valueA));
        expect(text).toContain(String(data.valueB));
      } else {
        sawScenario = true;
        // Both C26 formula strings verbatim (C60, C71).
        expect(text).toContain(data.formulaA);
        expect(text).toContain(data.formulaB);
        expect(text).toContain("$" + data.budget.toFixed(2));
      }

      const next = el.querySelector(".game-next");
      expect(next.textContent).toBe(
        i === questions.length - 1 ? "See results" : "Next question"
      );
      next.click();
    }

    // All eight templates appear for the two-model fixture: both reveal
    // shapes were exercised.
    expect(sawStat).toBe(true);
    expect(sawScenario).toBe(true);

    // One saveDailyRecord upsert per answer, ending completed (C67).
    expect(storage.saveDailyRecord).toHaveBeenCalledTimes(questions.length);
    const record = storage.getDailyRecord(PLAY_DATE);
    expect(record.completed).toBe(true);
    expect(record.picks).toHaveLength(questions.length);
    expect(record.correct).toEqual(
      questions.map((_, i) => i % 2 === 0)
    );

    // After the last question the same element shows the results screen.
    const results = el.querySelector("#game-results");
    expect(results).not.toBeNull();
    expect(results.classList.contains("glass")).toBe(true);
    expect(el.querySelector("#game-cards")).toBeNull();
    expect(results.querySelector(".game-score").textContent).toContain("4/8");
    expect(results.querySelector(".game-share").textContent).toBe(
      "Frontier #6 4/8\n" + (GREEN + RED).repeat(4)
    );
  });

  it("resumes an in-progress record at the next unanswered question", () => {
    const questions = expectedQuestions();
    const first = renderDaily(PLAY_DATE);
    for (let i = 0; i < 3; i++) {
      cardButtons(first)[questions[i].correctIndex].click();
      first.querySelector(".game-next").click();
    }

    const second = renderDaily(PLAY_DATE);
    expect(second.querySelector(".game-progress").textContent).toContain(
      "4 of 8"
    );
    expect(second.querySelector(".game-prompt").textContent).toBe(
      questions[3].prompt
    );
    expect(second.querySelector("#game-results")).toBeNull();
  });
});

describe("completed record renders results, not a replay (C67, C68, C72)", () => {
  const RESULT_DATE = "2026-08-01"; // day #18
  const completedRecord = {
    questionIds: ["q-a", "q-b", "q-c", "q-d", "q-e"],
    picks: [0, 1, 0, 1, 0],
    correct: [true, true, false, true, false],
    completed: true,
  };

  function seedCompleted() {
    expect(storage.saveDailyRecord(RESULT_DATE, completedRecord)).toBe(true);
    vi.clearAllMocks();
  }

  it("shows X/M, ordered squares, and the exact C68 share string", () => {
    seedCompleted();
    const el = renderDaily(RESULT_DATE);

    expect(el.querySelector("#game-cards")).toBeNull();
    expect(el.querySelector(".game-progress")).toBeNull();
    const results = el.querySelector("#game-results");
    expect(results).not.toBeNull();
    expect(results.classList.contains("glass")).toBe(true);

    expect(results.querySelector(".game-score").textContent).toContain("3/5");

    const squares = [...results.querySelectorAll(".game-squares span")];
    expect(squares.map((s) => s.textContent)).toEqual([
      GREEN,
      GREEN,
      RED,
      GREEN,
      RED,
    ]);

    const expected = `Frontier #18 3/5\n${GREEN}${GREEN}${RED}${GREEN}${RED}`;
    expect(buildShareString(completedRecord, RESULT_DATE)).toBe(expected);
    expect(results.querySelector(".game-share").textContent).toBe(expected);

    // Revisiting writes nothing: the record is rendered, never replayed.
    expect(storage.saveDailyRecord).not.toHaveBeenCalled();
  });

  it("flips the copy button to a copied state when the copy resolves true (C69)", async () => {
    seedCompleted();
    globalThis.document.execCommand = vi.fn(() => true);
    const el = renderDaily(RESULT_DATE);

    const copy = el.querySelector(".game-copy");
    expect(copy).not.toBeNull();
    expect(copy.tagName).toBe("BUTTON");
    const idleLabel = copy.textContent;

    copy.click();
    await tick();

    expect(globalThis.document.execCommand).toHaveBeenCalledWith("copy");
    expect(copy.textContent).toBe("Copied");
    expect(copy.textContent).not.toBe(idleLabel);
    expect(copy.dataset.copied).toBe("true");
  });

  it("keeps the idle label when the copy fails", async () => {
    seedCompleted();
    globalThis.document.execCommand = vi.fn(() => false);
    const el = renderDaily(RESULT_DATE);

    const copy = el.querySelector(".game-copy");
    const idleLabel = copy.textContent;
    copy.click();
    await tick();

    expect(copy.textContent).toBe(idleLabel);
    expect(copy.dataset.copied).toBeUndefined();
  });

  it("finishing the daily then re-rendering yields the results screen", () => {
    const questions = expectedQuestions();
    const play = renderDaily(PLAY_DATE);
    for (let i = 0; i < questions.length; i++) {
      cardButtons(play)[questions[i].correctIndex].click();
      play.querySelector(".game-next").click();
    }
    expect(play.querySelector("#game-results")).not.toBeNull();

    const revisit = renderDaily(PLAY_DATE);
    expect(revisit.querySelector("#game-cards")).toBeNull();
    expect(revisit.querySelector("#game-results")).not.toBeNull();
    expect(
      revisit.querySelector("#game-results .game-score").textContent
    ).toContain("8/8");
    expect(
      revisit.querySelector("#game-results .game-share").textContent
    ).toBe("Frontier #6 8/8\n" + GREEN.repeat(8));
  });
});
