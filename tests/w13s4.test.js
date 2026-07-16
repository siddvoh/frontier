// W13.S4: the picker as the game's front door. W11.S3 landed the mode
// cards and their storage-read stats; this slice makes the front door
// agree with the two screens behind it: the daily card names the dated run
// (Frontier #N, the number W13.S2 headlines), and before LAUNCH_DATE it
// states the start date rather than claiming an unplayed run, which is
// what the C76 notice behind it already says. Routing, the pure-render
// contract, and storage-module-only reads are unchanged.

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
import { readFileSync } from "node:fs";

import { render } from "../docs/js/game/views/picker.js";
import { LAUNCH_DATE, dayNumber } from "../docs/js/game/share.js";
import { STORAGE_KEY } from "../docs/js/game/storage.js";

const SOURCE = readFileSync(
  new URL("../docs/js/game/views/picker.js", import.meta.url),
  "utf8"
);

const state = { data: { models: [], events: [], surprises: [] }, route: {} };

// ---------- environment (W8.S1 house pattern) ----------

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

const card = (view, href) =>
  [...view.querySelectorAll("li.card")].find(
    (li) => li.querySelector("a").getAttribute("href") === href
  );

const AFTER_LAUNCH = "2026-08-01";
const BEFORE_LAUNCH = "2026-07-10";

// ---------- the dated run ----------

describe("the daily card names the run it opens", () => {
  it("shows Frontier #N, the same number the results screen headlines", () => {
    const daily = card(render(state, AFTER_LAUNCH), "#/game/daily");
    const day = daily.querySelector(".game-mode-day");
    expect(day).not.toBeNull();
    expect(day.textContent).toBe(`Frontier #${dayNumber(AFTER_LAUNCH)}`);
    expect(day.textContent).toBe("Frontier #18");
  });

  it("numbers launch day #1", () => {
    const daily = card(render(state, LAUNCH_DATE), "#/game/daily");
    expect(daily.querySelector(".game-mode-day").textContent).toBe(
      "Frontier #1"
    );
  });

  it("names the run above its state, below the rules copy", () => {
    const daily = card(render(state, AFTER_LAUNCH), "#/game/daily");
    const order = [...daily.children].map((c) => c.className.split(" ")[0]);
    expect(order.indexOf("muted")).toBeLessThan(order.indexOf("game-mode-day"));
    expect(order.indexOf("game-mode-day")).toBeLessThan(
      order.indexOf("game-mode-stat")
    );
  });

  it("puts no day number on the endless card: it is not a dated run", () => {
    const endless = card(render(state, AFTER_LAUNCH), "#/game/endless");
    expect(endless.querySelector(".game-mode-day")).toBeNull();
  });
});

// ---------- pre-launch honesty (C76) ----------

describe("before launch the front door says so", () => {
  it("states the start date instead of an unplayed run", () => {
    const daily = card(render(state, BEFORE_LAUNCH), "#/game/daily");
    const stat = daily.querySelector(".game-mode-stat");
    expect(stat.textContent).toBe(`Starts ${LAUNCH_DATE}.`);
    expect(stat.textContent).toContain("2026-07-15");
    expect(stat.textContent).not.toContain("Not played");
  });

  it("names no day number for a run that has not started", () => {
    const daily = card(render(state, BEFORE_LAUNCH), "#/game/daily");
    expect(daily.querySelector(".game-mode-day")).toBeNull();
  });

  it("leaves endless playable: it does not wait for a launch date", () => {
    const endless = card(render(state, BEFORE_LAUNCH), "#/game/endless");
    expect(endless.querySelector(".game-mode-stat").textContent).toContain(
      "Best streak: 0"
    );
    expect(endless.querySelector("a").getAttribute("href")).toBe(
      "#/game/endless"
    );
  });

  it("reads no daily record before launch: there is nothing to have played", () => {
    stub.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        endless: { best: 3 },
        daily: {
          [BEFORE_LAUNCH]: {
            questionIds: ["a"],
            picks: [0],
            correct: [true],
            completed: true,
          },
        },
      })
    );
    const daily = card(render(state, BEFORE_LAUNCH), "#/game/daily");
    expect(daily.querySelector(".game-mode-stat").textContent).toBe(
      `Starts ${LAUNCH_DATE}.`
    );
  });
});

// ---------- the contracts behind it ----------

describe("the front door changes nothing behind it", () => {
  it("keeps both routes and adds no glass (C70, amended C43)", () => {
    const view = render(state, AFTER_LAUNCH);
    expect(
      [...view.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    ).toEqual(["#/game/daily", "#/game/endless"]);
    expect(view.querySelector(".glass")).toBeNull();
  });

  it("renders from state and the storage module, never fetching (C29, C13)", () => {
    expect(SOURCE).not.toContain("fetch(");
    expect(SOURCE).not.toContain("localStorage");
    expect(SOURCE).toContain('from "../storage.js"');
  });

  it("writes nothing when rendered (C65)", () => {
    render(state, AFTER_LAUNCH);
    expect([...stub.map.keys()]).toEqual([]);
  });

  it("degrades to the fresh defaults on unreadable storage (C66)", () => {
    stub.setItem(STORAGE_KEY, "{not json");
    const view = render(state, AFTER_LAUNCH);
    expect(card(view, "#/game/daily").querySelector(".game-mode-stat").textContent).toBe(
      "Not played today."
    );
    expect(
      card(view, "#/game/endless").querySelector(".game-mode-stat").textContent
    ).toContain("Best streak: 0");
  });
});
