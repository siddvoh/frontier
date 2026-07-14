// W7.S1: game routes (C70, C28), pure game views (C29), main.js dispatch
// plus Game nav link, single fetch site preserved (C13).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import { parseHash, toHash } from "../docs/js/router.js";
import { render as renderPicker } from "../docs/js/game/views/picker.js";
import { render as renderDaily } from "../docs/js/game/views/daily.js";
import { render as renderEndless } from "../docs/js/game/views/endless.js";

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
      sources: {
        releaseDate: "curated",
        "pricing.inputPerMTok": "curated",
        "pricing.outputPerMTok": "curated",
        contextWindow: "curated",
        "benchmarks.gpqaDiamond": "curated",
        "benchmarks.swebenchVerified": "curated",
        openWeights: "curated",
      },
    }),
    model({ id: "beta-2", name: "Beta 2", organization: "Beta Corp" }),
  ],
  events: [],
};

const emptyScenarioInput = {
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

describe("router game routes (C70, C28)", () => {
  it("parses #/game to the picker", () => {
    expect(parseHash("#/game")).toEqual({ view: "picker" });
    expect(parseHash("#/game/")).toEqual({ view: "picker" });
  });

  it("ignores query params on the picker route", () => {
    expect(parseHash("#/game?seed=5")).toEqual({ view: "picker" });
  });

  it("parses #/game/daily", () => {
    expect(parseHash("#/game/daily")).toEqual({ view: "daily" });
  });

  it("keeps the daily route seed-free even when a seed is supplied", () => {
    expect(parseHash("#/game/daily?seed=9")).toEqual({ view: "daily" });
  });

  it("parses #/game/endless with a missing seed as null", () => {
    expect(parseHash("#/game/endless")).toEqual({
      view: "endless",
      seed: null,
    });
  });

  it("parses a present numeric seed", () => {
    expect(parseHash("#/game/endless?seed=42")).toEqual({
      view: "endless",
      seed: 42,
    });
    expect(parseHash("#/game/endless?seed=1501764002")).toEqual({
      view: "endless",
      seed: 1501764002,
    });
  });

  it("parses an invalid or empty seed to null, never a default", () => {
    expect(parseHash("#/game/endless?seed=abc")).toEqual({
      view: "endless",
      seed: null,
    });
    expect(parseHash("#/game/endless?seed=")).toEqual({
      view: "endless",
      seed: null,
    });
  });

  it("resolves unknown #/game/... sub-routes to the picker", () => {
    expect(parseHash("#/game/xyz")).toEqual({ view: "picker" });
    expect(parseHash("#/game/weekly?seed=3")).toEqual({ view: "picker" });
    expect(parseHash("#/game/daily/extra")).toEqual({ view: "picker" });
    expect(parseHash("#/game/endless/extra?seed=4")).toEqual({
      view: "picker",
    });
  });

  it("serializes game states and round-trips them", () => {
    const states = [
      { view: "picker" },
      { view: "daily" },
      { view: "endless", seed: null },
      { view: "endless", seed: 42 },
    ];
    expect(toHash(states[0])).toBe("#/game");
    expect(toHash(states[1])).toBe("#/game/daily");
    expect(toHash(states[2])).toBe("#/game/endless");
    expect(toHash(states[3])).toBe("#/game/endless?seed=42");
    for (const state of states) {
      expect(parseHash(toHash(state))).toEqual(state);
    }
  });
});

describe("step 1 routes are unchanged (C28, C70)", () => {
  it("still parses catalog, model, compare, and scenario", () => {
    expect(parseHash("")).toEqual({ view: "catalog" });
    expect(parseHash("#/catalog")).toEqual({ view: "catalog" });
    expect(parseHash("#/model/gpt-4")).toEqual({ view: "model", id: "gpt-4" });
    expect(parseHash("#/compare?ids=a,b")).toEqual({
      view: "compare",
      ids: ["a", "b"],
    });
    expect(parseHash("#/scenario")).toEqual({
      view: "scenario",
      input: emptyScenarioInput,
    });
  });

  it("still resolves unknown top-level routes to the catalog", () => {
    expect(parseHash("#/games")).toEqual({ view: "catalog" });
    expect(parseHash("#/nope")).toEqual({ view: "catalog" });
  });

  it("keeps the compare and scenario round-trips intact", () => {
    const compare = { view: "compare", ids: ["alpha-1", "beta-2"] };
    expect(parseHash(toHash(compare))).toEqual(compare);
    const scenario = parseHash(
      "#/scenario?budget=100&task=coding&in=10&out=5&open=1&minCtx=100000" +
        "&after=2024-01-01&before=2025-01-01"
    );
    expect(parseHash(toHash(scenario))).toEqual(scenario);
    expect(toHash({ view: "catalog" })).toBe("#/catalog");
    expect(toHash({ view: "model", id: "gpt-4" })).toBe("#/model/gpt-4");
  });
});

describe("game views are pure renders (C29, C13, C70)", () => {
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

  function renderWith(render, route) {
    return render({ route, data: fixture });
  }

  it("picker renders links to both modes", () => {
    const el = renderWith(renderPicker, { view: "picker" });
    expect(el).toBeInstanceOf(dom.window.HTMLElement);
    expect(el.querySelector("h2")).not.toBeNull();
    const hrefs = [...el.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("#/game/daily");
    expect(hrefs).toContain("#/game/endless");
  });

  it("daily stub renders a heading plus a muted placeholder", () => {
    const el = renderWith(renderDaily, { view: "daily" });
    expect(el).toBeInstanceOf(dom.window.HTMLElement);
    expect(el.querySelector("h2").textContent).toBe("Daily");
    const note = el.querySelector("p.muted");
    expect(note).not.toBeNull();
    expect(note.textContent).not.toBe("");
  });

  it("endless stub renders a heading plus a muted placeholder", () => {
    const el = renderWith(renderEndless, { view: "endless", seed: null });
    expect(el).toBeInstanceOf(dom.window.HTMLElement);
    expect(el.querySelector("h2").textContent).toBe("Endless");
    const note = el.querySelector("p.muted");
    expect(note).not.toBeNull();
    expect(note.textContent).not.toBe("");
  });

  it("renders identically for the same endless seed (C63)", () => {
    const a = renderWith(renderEndless, { view: "endless", seed: 42 });
    const b = renderWith(renderEndless, { view: "endless", seed: 42 });
    expect(a.outerHTML).toBe(b.outerHTML);
  });

  it("game views carry .glass only on the amended C43 ids", () => {
    const views = [
      renderWith(renderPicker, { view: "picker" }),
      renderWith(renderDaily, { view: "daily" }),
      renderWith(renderEndless, { view: "endless", seed: 42 }),
    ];
    const allowed = ["game-cards", "game-results"];
    for (const el of views) {
      expect(el.classList.contains("glass")).toBe(false);
      for (const glassy of el.querySelectorAll(".glass")) {
        expect(allowed).toContain(glassy.id);
      }
    }
  });
});

describe("main.js dispatches game routes and links to them (C70, C13)", () => {
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  let dom;
  const fetchCalls = [];
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeAll(async () => {
    dom = new JSDOM(
      '<!DOCTYPE html><html lang="en"><body>' +
        '<header id="site-header" class="glass"><h1>Frontier</h1></header>' +
        '<main id="app"></main></body></html>',
      { url: "http://localhost/frontier/" }
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.fetch = (url) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, json: async () => fixture });
    };
    await import("../docs/js/main.js");
    await tick();
  });

  afterAll(() => {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
  });

  async function goto(hash) {
    dom.window.location.hash = hash;
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    await tick();
  }

  it("boots with the single relative fetch and a Game link in the header", () => {
    expect(fetchCalls).toEqual(["data/models.json"]);
    const doc = dom.window.document;
    const game = doc.querySelector('#site-header a[data-nav="game"]');
    expect(game).not.toBeNull();
    expect(game.getAttribute("href")).toBe("#/game");
    expect(game.textContent).toBe("Game");
    // The step 1 nav stays exactly three links; the Game link sits beside
    // the nav as a direct #site-header child (w4s1 pins the nav count).
    expect(doc.querySelectorAll("#site-header nav a")).toHaveLength(3);
    expect(game.closest("nav")).toBeNull();
  });

  it("dispatches #/game to the picker view", async () => {
    await goto("#/game");
    const app = dom.window.document.querySelector("#app");
    expect(app.querySelector(".view-picker")).not.toBeNull();
    expect(app.querySelector('a[href="#/game/daily"]')).not.toBeNull();
    expect(app.querySelector('a[href="#/game/endless"]')).not.toBeNull();
  });

  it("dispatches #/game/daily to the daily stub", async () => {
    await goto("#/game/daily");
    const app = dom.window.document.querySelector("#app");
    expect(app.querySelector(".view-daily h2").textContent).toBe("Daily");
    expect(app.querySelector(".view-daily p.muted")).not.toBeNull();
  });

  it("dispatches #/game/endless (with ?seed=) to the endless stub", async () => {
    await goto("#/game/endless?seed=7");
    const app = dom.window.document.querySelector("#app");
    expect(app.querySelector(".view-endless h2").textContent).toBe("Endless");
    expect(app.querySelector(".view-endless p.muted")).not.toBeNull();
  });

  it("dispatches unknown #/game/... sub-routes to the picker", async () => {
    await goto("#/game/xyz");
    const app = dom.window.document.querySelector("#app");
    expect(app.querySelector(".view-picker")).not.toBeNull();
  });

  it("still renders the catalog on the default route", async () => {
    await goto("#/catalog");
    const app = dom.window.document.querySelector("#app");
    expect(app.querySelector(".view-catalog")).not.toBeNull();
    expect(app.querySelectorAll("tr[data-model-id]")).toHaveLength(2);
  });
});
