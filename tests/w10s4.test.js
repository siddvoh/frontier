// W10.S4: timeline first-paint usability (C34).
// The C34 linear mapping and left offsets are pinned unchanged; the strip
// gains a first-render scroll to the newest dot cluster (recorded as
// data-scroll-target plus a proportional scrollLeft assignment), year
// ticks (.timeline-tick) from 2023 through the generatedAt year, and a
// data-lanes attribute on the track equal to the deepest occupied lane so
// the stylesheet can reserve room for every stacked label inside the box.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { JSDOM } from "jsdom";

import {
  render as renderTimeline,
  leftPercent,
  assignLanes,
  TIMELINE_START,
} from "../docs/js/views/timeline.js";

// Hand-computable axis from w3s1: four days after TIMELINE_START, so
// 03-02 -> 25%, 03-03 -> 50%, 03-04 -> 75%.
const SHORT_GENERATED_AT = "2023-03-05T00:00:00.000Z";

// Realistic axis reproducing the W10.S4 defect: 2026-era dots compute to
// left offsets in the high 90s, three viewport widths of scroll away.
const GENERATED_AT = "2026-07-13T00:00:00.000Z";

function model(overrides) {
  return {
    id: "x-0",
    name: "X 0",
    organization: "X Lab",
    releaseDate: null,
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

// Five dots at the identical x (lanes 0..4) plus an earlier loner: the
// newest cluster defines both the scroll target and the deepest lane.
const SAME_DATE = "2026-06-01";
const CLUSTER = ["a", "b", "c", "d", "e"].map((suffix, i) =>
  model({
    id: `cluster-${suffix}`,
    name: `Cluster ${suffix.toUpperCase()}`,
    releaseDate: SAME_DATE,
    contextWindow: 100000 + i,
  })
);

const EARLY = model({
  id: "early-2023",
  name: "Early 2023",
  releaseDate: "2023-06-01",
});

const UNDATED = model({ id: "undated", name: "Undated" });

const MODELS = [...CLUSTER, EARLY, UNDATED];

const EVENTS = [
  {
    id: "eval-pause",
    date: "2026-06-15",
    title: "Frontier eval pause",
    body: "Labs pause frontier releases pending external evals.",
    modelIds: ["cluster-a"],
  },
];

let dom;
const savedDocument = globalThis.document;
const savedFetchGlobal = globalThis.fetch;

beforeAll(() => {
  dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.document = dom.window.document;
  globalThis.fetch = () => {
    throw new Error("views must not call the network");
  };
});

afterAll(() => {
  globalThis.document = savedDocument;
  globalThis.fetch = savedFetchGlobal;
});

function renderFixture() {
  return renderTimeline({
    models: MODELS,
    events: EVENTS,
    generatedAt: GENERATED_AT,
  });
}

function dots(el) {
  return [...el.querySelectorAll(".timeline-dot")];
}

function dotById(el, id) {
  return dots(el).find((d) => d.getAttribute("href") === "#/model/" + id);
}

function ticks(el) {
  return [...el.querySelectorAll(".timeline-tick")];
}

/** Flush the queued microtask that applies the first-render scroll. */
function flushMicrotasks() {
  return Promise.resolve();
}

describe("W10.S4: C34 mapping and offsets are unchanged", () => {
  it("keeps the exact linear leftPercent mapping", () => {
    expect(TIMELINE_START).toBe("2023-03-01");
    expect(leftPercent("2023-03-01", SHORT_GENERATED_AT)).toBe(0);
    expect(leftPercent("2023-03-02", SHORT_GENERATED_AT)).toBe(25);
    expect(leftPercent("2023-03-03", SHORT_GENERATED_AT)).toBe(50);
    expect(leftPercent("2023-03-04", SHORT_GENERATED_AT)).toBe(75);
    expect(leftPercent(SHORT_GENERATED_AT, SHORT_GENERATED_AT)).toBe(100);
    expect(leftPercent(TIMELINE_START, GENERATED_AT)).toBe(0);
    expect(leftPercent(GENERATED_AT, GENERATED_AT)).toBe(100);
  });

  it("positions each dot at its raw leftPercent and omits null dates", () => {
    const el = renderFixture();
    for (const m of [...CLUSTER, EARLY]) {
      const dot = dotById(el, m.id);
      expect(dot, m.id).toBeDefined();
      expect(dot.style.left).toBe(
        leftPercent(m.releaseDate, GENERATED_AT) + "%"
      );
    }
    expect(dotById(el, "undated")).toBeUndefined();
  });

  it("keeps dot navigation and marker reveal behavior", () => {
    const el = renderFixture();
    const dot = dotById(el, "cluster-a");
    expect(dot.tagName).toBe("A");
    expect(dot.getAttribute("href")).toBe("#/model/cluster-a");

    const marker = el.querySelector(".timeline-event");
    expect(marker.style.left).toBe(
      leftPercent(EVENTS[0].date, GENERATED_AT) + "%"
    );
    expect(marker.getAttribute("style")).toContain("var(--accent)");
    const detail = el.querySelector(".timeline-event-detail");
    expect(detail.hidden).toBe(true);
    marker.click();
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain(EVENTS[0].title);
    expect(detail.textContent).toContain(EVENTS[0].body);
    marker.click();
    expect(detail.hidden).toBe(true);
  });
});

describe("W10.S4: initial scroll target tracks the newest dot", () => {
  it("records the newest dot percent as data-scroll-target", () => {
    const el = renderFixture();
    const newest = leftPercent(SAME_DATE, GENERATED_AT);
    expect(newest).toBeGreaterThan(90);
    expect(el.getAttribute("data-scroll-target")).toBe(String(newest));
  });

  it("moves the target when a newer dot is added", () => {
    const newerDate = "2026-07-01";
    const el = renderTimeline({
      models: [...MODELS, model({ id: "newer", name: "Newer", releaseDate: newerDate })],
      events: EVENTS,
      generatedAt: GENERATED_AT,
    });
    expect(el.getAttribute("data-scroll-target")).toBe(
      String(leftPercent(newerDate, GENERATED_AT))
    );
  });

  it("falls back to 0 when no dot has a release date", () => {
    const el = renderTimeline({
      models: [UNDATED],
      events: [],
      generatedAt: GENERATED_AT,
    });
    expect(el.getAttribute("data-scroll-target")).toBe("0");
  });

  it("assigns scrollLeft proportionally once the strip has layout", async () => {
    const el = renderFixture();
    // Simulate the measured defect geometry: 3042px of content inside a
    // 1016px scrollport, i.e. a 2026px scrollable range.
    Object.defineProperty(el, "scrollWidth", { value: 3042 });
    Object.defineProperty(el, "clientWidth", { value: 1016 });
    await flushMicrotasks();
    const target = parseFloat(el.getAttribute("data-scroll-target"));
    expect(el.scrollLeft).toBeCloseTo((target / 100) * (3042 - 1016), 6);
    expect(el.scrollLeft).toBeGreaterThan(0);
  });

  it("is a no-op where layout does not exist (zero scroll range)", async () => {
    const el = renderFixture();
    await flushMicrotasks();
    expect(el.scrollLeft).toBe(0);
  });
});

describe("W10.S4: year ticks", () => {
  it("emits one tick per year from 2023 through the generatedAt year", () => {
    const el = renderFixture();
    const track = el.querySelector(".timeline-track");
    const all = ticks(el);
    expect(all.map((t) => t.textContent)).toEqual([
      "2023",
      "2024",
      "2025",
      "2026",
    ]);
    for (const tick of all) {
      expect(tick.closest(".timeline-track")).toBe(track);
    }
  });

  it("positions each tick at the C34 percent of its January 1", () => {
    const el = renderFixture();
    const byYear = new Map(ticks(el).map((t) => [t.textContent, t]));
    for (const year of ["2024", "2025", "2026"]) {
      const expected = leftPercent(year + "-01-01", GENERATED_AT);
      expect(expected).toBeGreaterThan(0);
      expect(expected).toBeLessThanOrEqual(100);
      expect(byYear.get(year).style.left).toBe(expected + "%");
    }
  });

  it("clamps the 2023 tick to the left edge (its January 1 is negative)", () => {
    expect(leftPercent("2023-01-01", GENERATED_AT)).toBeLessThan(0);
    const el = renderFixture();
    const first = ticks(el)[0];
    expect(first.textContent).toBe("2023");
    expect(first.style.left).toBe("0%");
  });

  it("omits out-of-range ticks: nothing past generatedAt, all in 0..100", () => {
    const el = renderFixture();
    for (const tick of ticks(el)) {
      const left = parseFloat(tick.style.left);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
    }
    expect(ticks(el).some((t) => t.textContent === "2027")).toBe(false);

    // A short axis ending inside 2023 gets exactly the one clamped tick.
    const short = renderTimeline({
      models: [EARLY],
      events: [],
      generatedAt: SHORT_GENERATED_AT,
    });
    expect(ticks(short).map((t) => t.textContent)).toEqual(["2023"]);
    expect(ticks(short)[0].style.left).toBe("0%");
  });

  it("uses only percentage inline positioning on ticks (C36)", () => {
    const el = renderFixture();
    for (const tick of ticks(el)) {
      const props = [];
      for (let i = 0; i < tick.style.length; i += 1) {
        props.push(tick.style.item(i));
      }
      expect(props).toEqual(["left"]);
      expect(tick.style.left).toMatch(/^-?\d+(\.\d+)?%$/);
      expect(parseFloat(tick.style.left)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("W10.S4: lane sizing keeps every label inside the track box", () => {
  it("sets data-lanes on the track to the deepest occupied lane", () => {
    const el = renderFixture();
    const track = el.querySelector(".timeline-track");
    const laneValues = dots(el).map((d) => Number(d.getAttribute("data-lane")));
    const deepest = Math.max(...laneValues);
    // The five same-date cluster dots stack through lane 4.
    expect(deepest).toBe(4);
    expect(track.getAttribute("data-lanes")).toBe(String(deepest));
  });

  it("never places a dot in a lane deeper than the reserved data-lanes", () => {
    const el = renderFixture();
    const reserved = Number(
      el.querySelector(".timeline-track").getAttribute("data-lanes")
    );
    for (const dot of dots(el)) {
      expect(Number(dot.getAttribute("data-lane"))).toBeLessThanOrEqual(
        reserved
      );
    }
  });

  it("reports lane 0 depth for a collision-free strip", () => {
    const el = renderTimeline({
      models: [EARLY, CLUSTER[0]],
      events: [],
      generatedAt: GENERATED_AT,
    });
    expect(
      el.querySelector(".timeline-track").getAttribute("data-lanes")
    ).toBe("0");
    // And an empty strip still reserves the base depth.
    const empty = renderTimeline({
      models: [UNDATED],
      events: [],
      generatedAt: GENERATED_AT,
    });
    expect(
      empty.querySelector(".timeline-track").getAttribute("data-lanes")
    ).toBe("0");
  });

  it("keeps assignLanes behavior pinned (deepest lane derives from it)", () => {
    expect(assignLanes([10, 10, 10, 10, 10])).toEqual([0, 1, 2, 3, 4]);
    expect(assignLanes([10, 40])).toEqual([0, 0]);
  });
});
