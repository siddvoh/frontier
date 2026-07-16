// W11.S3: game screens with a focal prompt and honest answer states (C71,
// C60, C67, C65, C70). The picker renders Daily and Endless as .card
// blocks with mode name, one-line rules copy, and current stats read only
// through the storage module. On both question screens, answering marks
// the correct card with the accent-outline class ("card-correct") and the
// chosen card with the pressed-state class ("card-picked"), and both
// cards reveal their real value inline via a .card-value span formatted
// by the shared W10.S2 reveal module; the C60 reveal panel, the
// next-question control, and the C71 streak/progress line all stay.

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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

import { render as renderPicker } from "../docs/js/game/views/picker.js";
import { render as renderDaily } from "../docs/js/game/views/daily.js";
import { render as renderEndless } from "../docs/js/game/views/endless.js";
import {
  dailySeed,
  endlessQuestions,
  generateDaily,
} from "../docs/js/game/questions.js";
import { saveDailyRecord, saveState } from "../docs/js/game/storage.js";
import { fmtDate, fmtInt, fmtScore, fmtUsd } from "../docs/js/util.js";

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

// Two fully populated models differing on every C59 field: all eight
// templates are valid, so a full daily playthrough asserts the in-card
// answer state for every template fixture deterministically.
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
    benchmarks: { gpqaDiamond: 70.5, swebenchVerified: 55.9 },
  }),
]);

const PLAY_DATE = "2026-07-20";

// The display formatter per stat revealData field, kept independent of the
// module under test (the W10.S2 spec formatting).
const STAT_FMT = {
  "pricing.inputPerMTok": fmtUsd,
  "pricing.outputPerMTok": fmtUsd,
  contextWindow: fmtInt,
  "benchmarks.gpqaDiamond": fmtScore,
  "benchmarks.swebenchVerified": fmtScore,
  releaseDate: fmtDate,
};

// The honest in-card value pair for a question: formatted stat values, or
// the two computed costs (fmtUsd) for scenario templates.
function expectedCardValues(question) {
  const data = question.revealData;
  if (data.field !== undefined) {
    const format = STAT_FMT[data.field];
    return [format(data.valueA), format(data.valueB)];
  }
  return [fmtUsd(data.costA), fmtUsd(data.costB)];
}

// ---------- environment ----------

const saved = { document: globalThis.document, fetch: globalThis.fetch };
let dom;
let stub;

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
  stub = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
});

function cardButtons(el) {
  return [...el.querySelectorAll("#game-cards button")];
}

function expectAnswerState(el, question, pick) {
  const buttons = cardButtons(el);
  expect(buttons).toHaveLength(2);

  // The correct card carries the accent-outline class; the chosen card
  // carries the distinct pressed-state class; no other card carries them.
  buttons.forEach((button, i) => {
    expect(button.classList.contains("card-correct")).toBe(
      i === question.correctIndex
    );
    expect(button.classList.contains("card-picked")).toBe(i === pick);
  });

  // Both cards reveal their real value inline, formatted for display.
  const values = expectedCardValues(question);
  buttons.forEach((button, i) => {
    const spans = [...button.querySelectorAll(".card-value")];
    expect(spans).toHaveLength(1);
    expect(spans[0].tagName).toBe("SPAN");
    expect(spans[0].textContent).toBe(values[i]);
  });

  // The raw artifact dot-path never reaches a card (W10.S2 rule extended
  // to the in-card values).
  if (question.revealData.field !== undefined) {
    const cardsText = el.querySelector("#game-cards").textContent;
    expect(cardsText).not.toContain(question.revealData.field);
  }

  // The C60 reveal panel and the next-question control stay.
  expect(el.querySelector(".game-reveal")).not.toBeNull();
  expect(el.querySelector(".game-next")).not.toBeNull();
  // The C71 streak/progress line stays visible after the answer.
  expect(el.querySelector(".game-progress")).not.toBeNull();
  expect(el.querySelector(".game-progress").textContent).not.toBe("");
}

function expectCleanCards(el) {
  const buttons = cardButtons(el);
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    expect(button.classList.contains("card-correct")).toBe(false);
    expect(button.classList.contains("card-picked")).toBe(false);
  }
  expect(el.querySelectorAll("#game-cards .card-value")).toHaveLength(0);
}

// ---------- picker mode cards (C70, C65) ----------

describe("picker renders Daily and Endless as .card blocks (C70, C65)", () => {
  function picker(date = PLAY_DATE) {
    return renderPicker({ route: { view: "picker" }, data: rich }, date);
  }

  function modeCard(el, href) {
    const link = el.querySelector(`ul.game-modes a[href="${href}"]`);
    expect(link).not.toBeNull();
    const card = link.closest(".card");
    expect(card).not.toBeNull();
    return card;
  }

  it("renders two .card blocks with mode name, rules copy, and a stat line", () => {
    const el = picker();
    const cards = [...el.querySelectorAll("ul.game-modes .card")];
    expect(cards).toHaveLength(2);

    const daily = modeCard(el, "#/game/daily");
    const endless = modeCard(el, "#/game/endless");
    expect(daily).not.toBe(endless);
    expect(daily.querySelector("a").textContent).toBe("Daily");
    expect(endless.querySelector("a").textContent).toBe("Endless");

    for (const card of [daily, endless]) {
      const blurb = card.querySelector("p.muted");
      expect(blurb).not.toBeNull();
      expect(blurb.textContent).not.toBe("");
      const stat = card.querySelector(".game-mode-stat");
      expect(stat).not.toBeNull();
      expect(stat.textContent).not.toBe("");
    }
  });

  it("keeps routing unchanged and adds no glass (C70, amended C43)", () => {
    const el = picker();
    const hrefs = [...el.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toEqual(["#/game/daily", "#/game/endless"]);
    expect(el.querySelector(".glass")).toBeNull();
  });

  it("shows the fresh defaults when nothing is stored", () => {
    const el = picker();
    const daily = modeCard(el, "#/game/daily");
    const endless = modeCard(el, "#/game/endless");
    expect(daily.querySelector(".game-mode-stat").textContent).toBe(
      "Not played today."
    );
    expect(endless.querySelector(".game-mode-stat").textContent).toContain(
      "Best streak: 0"
    );
  });

  it("shows today's completed score and the persisted best streak", () => {
    expect(saveState({ version: 1, endless: { best: 7 }, daily: {} })).toBe(
      true
    );
    expect(
      saveDailyRecord(PLAY_DATE, {
        questionIds: ["q-a", "q-b", "q-c", "q-d", "q-e"],
        picks: [0, 1, 0, 1, 0],
        correct: [true, true, false, true, false],
        completed: true,
      })
    ).toBe(true);

    const el = picker(PLAY_DATE);
    const daily = modeCard(el, "#/game/daily");
    const endless = modeCard(el, "#/game/endless");
    expect(daily.querySelector(".game-mode-stat").textContent).toContain(
      "3/5"
    );
    expect(endless.querySelector(".game-mode-stat").textContent).toContain(
      "Best streak: 7"
    );
  });

  it("shows in-progress state for a partial record on the render date", () => {
    expect(
      saveDailyRecord(PLAY_DATE, {
        questionIds: ["q-a", "q-b", "q-c"],
        picks: [0, 1],
        correct: [true, false],
        completed: false,
      })
    ).toBe(true);
    const el = picker(PLAY_DATE);
    const stat = modeCard(el, "#/game/daily").querySelector(
      ".game-mode-stat"
    );
    expect(stat.textContent).toContain("2 of 3");
  });

  it("reads only the render date's record, not other days", () => {
    expect(
      saveDailyRecord("2026-08-01", {
        questionIds: ["q-a"],
        picks: [0],
        correct: [true],
        completed: true,
      })
    ).toBe(true);
    const el = picker(PLAY_DATE);
    expect(
      modeCard(el, "#/game/daily").querySelector(".game-mode-stat").textContent
    ).toBe("Not played today.");
  });

  it("never writes storage while rendering", () => {
    stub.setItem.mockClear();
    picker();
    expect(stub.setItem).not.toHaveBeenCalled();
  });
});

// ---------- daily answer states per template fixture (C71, C60, C67) ----------

describe("daily answer states per template (C71, C60, C67)", () => {
  it("marks correct and picked cards with formatted in-card values on all eight templates", () => {
    const questions = generateDaily(dailySeed(PLAY_DATE), rich);
    expect(questions).toHaveLength(8);
    const el = renderDaily(
      { route: { view: "daily" }, data: rich },
      PLAY_DATE
    );
    let sawStat = false;
    let sawScenario = false;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      // Before the answer: a focal .game-prompt, clean cards, no values.
      expect(el.querySelector(".game-prompt")).not.toBeNull();
      expect(el.querySelector(".game-prompt").textContent).toBe(
        question.prompt
      );
      expectCleanCards(el);

      // Alternate right and wrong picks so both the picked === correct and
      // the picked !== correct states are asserted across the playthrough.
      const pick =
        i % 2 === 0 ? question.correctIndex : 1 - question.correctIndex;
      cardButtons(el)[pick].click();

      if (question.revealData.field !== undefined) sawStat = true;
      else sawScenario = true;
      expectAnswerState(el, question, pick);
      // The picked card also keeps its W8.S2 data-picked marker, on the
      // same element that carries the pressed-state class.
      expect(cardButtons(el)[pick].dataset.picked).toBe("true");

      el.querySelector(".game-next").click();
    }

    // Both reveal shapes were exercised and the flow still ends on the
    // results screen, never a replay (C67).
    expect(sawStat).toBe(true);
    expect(sawScenario).toBe(true);
    expect(el.querySelector("#game-results")).not.toBeNull();
  });

  it("formats the in-card context values with separators, raw digits absent", () => {
    const questions = generateDaily(dailySeed(PLAY_DATE), rich);
    const el = renderDaily(
      { route: { view: "daily" }, data: rich },
      PLAY_DATE
    );

    for (const question of questions) {
      cardButtons(el)[question.correctIndex].click();
      if (question.revealData.field === "contextWindow") {
        const values = cardButtons(el).map(
          (b) => b.querySelector(".card-value").textContent
        );
        expect(values).toContain("200,000");
        expect(values).toContain("1,000,000");
        const cardsText = el.querySelector("#game-cards").textContent;
        expect(cardsText).not.toContain("200000");
        expect(cardsText).not.toContain("1000000");
        return;
      }
      el.querySelector(".game-next").click();
    }
    throw new Error("fixture daily never asked the context question");
  });

  it("shows the two computed costs in-card for scenario templates", () => {
    const questions = generateDaily(dailySeed(PLAY_DATE), rich);
    const el = renderDaily(
      { route: { view: "daily" }, data: rich },
      PLAY_DATE
    );

    for (const question of questions) {
      cardButtons(el)[question.correctIndex].click();
      if (question.revealData.field === undefined) {
        const data = question.revealData;
        const values = cardButtons(el).map(
          (b) => b.querySelector(".card-value").textContent
        );
        expect(values).toEqual([fmtUsd(data.costA), fmtUsd(data.costB)]);
        expect(values[0]).not.toBe(values[1]);
        return;
      }
      el.querySelector(".game-next").click();
    }
    throw new Error("fixture daily never asked a scenario question");
  });
});

// ---------- endless answer states (C71, C60) ----------

describe("endless answer states (C71, C60)", () => {
  it("marks cards per answer, then clears the state on the next question", () => {
    const gen = endlessQuestions(22, rich);
    const view = renderEndless({
      route: { view: "endless", seed: 22 },
      data: rich,
    });
    let sawStat = false;
    let sawScenario = false;
    let hops = 0;

    while (!(sawStat && sawScenario)) {
      expect(hops).toBeLessThan(50);
      const question = gen.next().value;
      expectCleanCards(view);

      // Alternate right and wrong picks across the walk.
      const pick =
        hops % 2 === 0 ? question.correctIndex : 1 - question.correctIndex;
      cardButtons(view)[pick].click();

      if (question.revealData.field !== undefined) sawStat = true;
      else sawScenario = true;
      expectAnswerState(view, question, pick);

      view.querySelector(".game-next").click();
      // The next question starts clean: no answer-state classes and no
      // stale in-card values survive the repaint.
      expectCleanCards(view);
      hops += 1;
    }
  });

  it("keeps the streak line and prompt visible through the reveal state", () => {
    const question = endlessQuestions(101, rich).next().value;
    const view = renderEndless({
      route: { view: "endless", seed: 101 },
      data: rich,
    });
    expect(view.querySelector(".game-prompt").textContent).toBe(
      question.prompt
    );
    cardButtons(view)[question.correctIndex].click();
    expect(view.querySelector(".game-prompt").textContent).toBe(
      question.prompt
    );
    // W13.S3 split the flat "Streak N" string into a focal count plus a
    // quiet label; the invariant this pins is unchanged: the streak stays
    // visible, and reads 1, through the reveal state.
    const progress = view.querySelector(".game-progress");
    expect(progress.querySelector(".game-streak").textContent).toBe("1");
    expect(progress.textContent).toContain("Streak");
  });
});

// ---------- module hygiene (C13, C19, C65) ----------

describe("game view module hygiene (C13, C19, C65)", () => {
  // Banned-token workaround (repo convention): built by concatenation so
  // this file never contains the tokens literally.
  const TOKENS = {
    fetchCall: "fet" + "ch(",
    webStorage: "local" + "Storage",
    mathRandom: "Math" + ".random",
  };
  const files = ["picker.js", "daily.js", "endless.js"];

  for (const file of files) {
    const source = readFileSync(
      path.join(root, "docs", "js", "game", "views", file),
      "utf8"
    );

    it(`${file} never touches browser storage, the network, or ambient randomness`, () => {
      expect(source).not.toContain(TOKENS.webStorage);
      expect(source).not.toContain(TOKENS.fetchCall);
      expect(source).not.toContain(TOKENS.mathRandom);
      expect(source).not.toContain("?? 0");
      expect(source).not.toContain("|| 0");
    });

    it(`${file} imports only from within docs/js/`, () => {
      const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
        (m) => m[1]
      );
      expect(specifiers.length).toBeGreaterThan(0);
      for (const spec of specifiers) {
        expect(spec.startsWith("../") || spec.startsWith("./")).toBe(true);
      }
    });
  }
});
