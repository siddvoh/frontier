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

// Realistic axis reproducing the W5.S2 defect: 2026-era dots compute to
// left offsets in the high 90s and crowd the right edge of the strip.
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

// Five dots at the identical x plus a sixth 2026-era dot, all right-half.
const SAME_DATE = "2026-06-01";
const CLUSTER = ["a", "b", "c", "d", "e"].map((suffix, i) =>
  model({
    id: `cluster-${suffix}`,
    name: `Cluster ${suffix.toUpperCase()}`,
    releaseDate: SAME_DATE,
    contextWindow: 100000 + i,
  })
);

const LONER_2026 = model({
  id: "loner-2026",
  name: "Loner 2026",
  releaseDate: "2026-04-01",
});

const EARLY = model({
  id: "early-2023",
  name: "Early 2023",
  releaseDate: "2023-06-01",
});

const UNDATED = model({ id: "undated", name: "Undated" });

const MODELS = [...CLUSTER, LONER_2026, EARLY, UNDATED];

const EVENTS = [
  {
    id: "eval-pause",
    date: "2026-06-15",
    title: "Frontier eval pause",
    body: "Labs pause frontier releases pending external evals.",
    modelIds: ["cluster-a"],
  },
  {
    id: "compute-pact",
    date: "2026-07-01",
    title: "Compute reporting pact",
    body: "Major labs agree to report training compute.",
    modelIds: [],
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
  return dots(el).find(
    (d) => d.getAttribute("href") === "#/model/" + id
  );
}

function leftOf(el) {
  return parseFloat(el.style.left);
}

describe("W5.S2: C34 mapping is unchanged", () => {
  it("keeps the exact linear leftPercent mapping from w3s1", () => {
    expect(TIMELINE_START).toBe("2023-03-01");
    expect(leftPercent("2023-03-01", SHORT_GENERATED_AT)).toBe(0);
    expect(leftPercent("2023-03-02", SHORT_GENERATED_AT)).toBe(25);
    expect(leftPercent("2023-03-03", SHORT_GENERATED_AT)).toBe(50);
    expect(leftPercent("2023-03-04", SHORT_GENERATED_AT)).toBe(75);
    expect(leftPercent(SHORT_GENERATED_AT, SHORT_GENERATED_AT)).toBe(100);
    expect(leftPercent(TIMELINE_START, GENERATED_AT)).toBe(0);
    expect(leftPercent(GENERATED_AT, GENERATED_AT)).toBe(100);
  });

  it("positions each dot at its raw leftPercent, untouched by layout", () => {
    const el = renderFixture();
    for (const m of [...CLUSTER, LONER_2026, EARLY]) {
      const dot = dotById(el, m.id);
      expect(dot, m.id).toBeDefined();
      expect(dot.style.left).toBe(
        leftPercent(m.releaseDate, GENERATED_AT) + "%"
      );
    }
    expect(dotById(el, "undated")).toBeUndefined();
  });
});

describe("W5.S2: label anchoring keeps labels inside the track", () => {
  it("gives every right-half dot the end anchor and left-half the start anchor", () => {
    const el = renderFixture();
    const all = dots(el);
    expect(all.length).toBe(7);
    for (const dot of all) {
      const left = leftOf(dot);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
      // No start-anchored (rightward-extending) label may sit past the
      // midpoint, so no label's left plus anchor extends past 100 percent.
      const expected = left > 50 ? "end" : "start";
      expect(dot.getAttribute("data-anchor"), dot.textContent).toBe(expected);
    }
  });

  it("end-anchors all six 2026-era dots and start-anchors the early dot", () => {
    const el = renderFixture();
    for (const m of [...CLUSTER, LONER_2026]) {
      expect(leftOf(dotById(el, m.id))).toBeGreaterThan(90);
      expect(dotById(el, m.id).getAttribute("data-anchor")).toBe("end");
    }
    expect(dotById(el, "early-2023").getAttribute("data-anchor")).toBe(
      "start"
    );
  });
});

describe("W5.S2: collision lanes", () => {
  it("assigns five distinct lanes to the five same-x dots", () => {
    const el = renderFixture();
    const lanes = CLUSTER.map((m) =>
      dotById(el, m.id).getAttribute("data-lane")
    );
    expect(new Set(lanes).size).toBe(5);
    expect([...lanes].sort()).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("keeps non-colliding dots on lane 0", () => {
    const el = renderFixture();
    expect(dotById(el, "early-2023").getAttribute("data-lane")).toBe("0");
    // Loner is about 3.4 percent left of the cluster: beyond the 2 percent
    // collision window, so it does not stack with the cluster.
    expect(
      Math.abs(
        leftPercent(LONER_2026.releaseDate, GENERATED_AT) -
          leftPercent(SAME_DATE, GENERATED_AT)
      )
    ).toBeGreaterThan(2);
    expect(dotById(el, "loner-2026").getAttribute("data-lane")).toBe("0");
  });

  it("assigns lanes deterministically across renders", () => {
    const first = renderFixture();
    const second = renderFixture();
    const laneMap = (el) =>
      dots(el).map((d) => [d.getAttribute("href"), d.dataset.lane]);
    expect(laneMap(second)).toEqual(laneMap(first));
  });

  it("assignLanes stacks only elements within 2 percent of each other", () => {
    expect(assignLanes([10, 10, 10])).toEqual([0, 1, 2]);
    expect(assignLanes([10, 11.5, 40])).toEqual([0, 1, 0]);
    expect(assignLanes([10, 13, 40])).toEqual([0, 0, 0]);
    // Order-independent of input order: lanes follow ascending x.
    expect(assignLanes([98, 97, 98])).toEqual([1, 0, 2]);
  });
});

describe("W5.S2: markers stay visible inside the track", () => {
  it("renders each event marker inside .timeline-track at its C34 position", () => {
    const el = renderFixture();
    const track = el.querySelector(".timeline-track");
    expect(track).not.toBeNull();
    const markers = [...el.querySelectorAll(".timeline-event")];
    expect(markers).toHaveLength(EVENTS.length);
    markers.forEach((marker, i) => {
      expect(marker.closest(".timeline-track")).toBe(track);
      expect(marker.style.left).toBe(
        leftPercent(EVENTS[i].date, GENERATED_AT) + "%"
      );
      expect(leftOf(marker)).toBeLessThanOrEqual(100);
      expect(marker.getAttribute("data-anchor")).toBe("end");
      expect(marker.getAttribute("style")).toContain("var(--accent)");
    });
  });

  it("still reveals title and body on marker click", () => {
    const el = renderFixture();
    const marker = el.querySelectorAll(".timeline-event")[1];
    const detail = el.querySelectorAll(".timeline-event-detail")[1];
    expect(detail.hidden).toBe(true);
    marker.click();
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain(EVENTS[1].title);
    expect(detail.textContent).toContain(EVENTS[1].body);
    marker.click();
    expect(detail.hidden).toBe(true);
  });

  it("dot click still navigates via the native #/model/:id href", () => {
    const el = renderFixture();
    const dot = dotById(el, "cluster-a");
    expect(dot.tagName).toBe("A");
    expect(dot.getAttribute("href")).toBe("#/model/cluster-a");
  });
});

describe("W5.S2: inline style hygiene (C36)", () => {
  it("uses only percentages, 0, and var() tokens in inline styles", () => {
    const el = renderFixture();
    const styled = [...el.querySelectorAll("[style]")];
    expect(styled.length).toBeGreaterThan(0);
    for (const node of styled) {
      const props = [];
      for (let i = 0; i < node.style.length; i += 1) {
        props.push(node.style.item(i));
      }
      for (const prop of props) {
        const value = node.style.getPropertyValue(prop).trim();
        const ok =
          value === "0" ||
          value === "0px" ||
          /^-?\d+(\.\d+)?%$/.test(value) ||
          /^var\(--[a-z0-9-]+\)$/.test(value) ||
          ["absolute", "relative"].includes(value);
        expect(ok, `${prop}: ${value}`).toBe(true);
      }
    }
  });
});
