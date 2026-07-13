// Timeline strip (C34). Pure render: (props) -> DOM element, no network.
// x is mapped linearly from TIMELINE_START to the artifact's generatedAt.
// Model dots are anchors labeled by name at releaseDate (null dates are
// omitted, C21); event markers use the accent token and reveal their title
// and body on click. Pure HTML/CSS positioning: no canvas, no SVG.
// Inline styles use only percentages, "0", and var() references (C36).
//
// W5.S2 layout contract (consumed by the W5.S1 CSS slice):
// - data-anchor="start|end" on dots and markers: "end" means the element is
//   in the right half of the track, so its label translates left of the dot
//   to stay inside the track; "start" labels extend rightward as before.
// - data-lane="0|1|2..." on dots: deterministic stacked lanes so labels of
//   dots within COLLISION_PERCENT of each other never overlap.

import { fmtDate } from "../util.js";

/** Left edge of the timeline axis (GPT-4 era start). */
export const TIMELINE_START = "2023-03-01";

/** Dots closer than this (in percent of the track) share a collision group. */
const COLLISION_PERCENT = 2;

/**
 * Linear x position of an ISO date on the strip, as a percentage of the
 * span from TIMELINE_START to generatedAt.
 * @param {string} dateIso ISO date, e.g. "2024-05-01"
 * @param {string} generatedAt ISO date-time from the artifact top level
 * @returns {number} percentage (0 at TIMELINE_START, 100 at generatedAt)
 */
export function leftPercent(dateIso, generatedAt) {
  const start = Date.parse(TIMELINE_START);
  const end = Date.parse(generatedAt);
  return ((Date.parse(dateIso) - start) / (end - start)) * 100;
}

/** Anchor side for a track position: right-half labels flip to "end". */
function anchorFor(percent) {
  return percent > 50 ? "end" : "start";
}

/**
 * Deterministic lane per dot: walk dots in ascending x (ties broken by
 * input order) and give each the smallest lane not taken by any earlier
 * dot within COLLISION_PERCENT of it.
 * @param {number[]} percents left offsets in input order
 * @returns {number[]} lane numbers in input order
 */
export function assignLanes(percents) {
  const order = percents
    .map((percent, index) => ({ percent, index }))
    .sort((a, b) => a.percent - b.percent || a.index - b.index);
  const lanes = new Array(percents.length);
  const placed = [];
  for (const entry of order) {
    const taken = new Set(
      placed
        .filter(
          (p) => Math.abs(p.percent - entry.percent) <= COLLISION_PERCENT
        )
        .map((p) => p.lane)
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;
    lanes[entry.index] = lane;
    placed.push({ percent: entry.percent, lane });
  }
  return lanes;
}

function placeAt(el, percent) {
  el.style.position = "absolute";
  el.style.left = percent + "%";
  el.setAttribute("data-anchor", anchorFor(percent));
}

function modelDot(model, percent, lane) {
  const dot = document.createElement("a");
  dot.className = "timeline-dot";
  dot.href = "#/model/" + encodeURIComponent(model.id);
  dot.textContent = model.name;
  placeAt(dot, percent);
  dot.setAttribute("data-lane", String(lane));
  return dot;
}

function eventMarker(event, generatedAt) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "timeline-event";
  marker.setAttribute("aria-label", event.title);
  placeAt(marker, leftPercent(event.date, generatedAt));
  marker.style.bottom = "0";
  marker.style.width = "var(--sp-3)";
  marker.style.height = "var(--sp-3)";
  marker.style.padding = "0";
  marker.style.borderRadius = "50%";
  marker.style.background = "var(--accent)";
  marker.style.borderColor = "var(--accent)";

  const detail = document.createElement("div");
  detail.className = "timeline-event-detail";
  detail.hidden = true;
  const title = document.createElement("strong");
  title.textContent = fmtDate(event.date) + ": " + event.title;
  const body = document.createElement("p");
  body.textContent = event.body;
  detail.append(title, body);

  marker.addEventListener("click", () => {
    detail.hidden = !detail.hidden;
  });
  return { marker, detail };
}

/**
 * Render the horizontally scrollable timeline strip.
 * @param {{models: Array, events: Array, generatedAt: string}} props
 * @returns {HTMLElement}
 */
export function render({ models, events, generatedAt }) {
  const strip = document.createElement("div");
  strip.className = "timeline";
  strip.setAttribute("aria-label", "Release timeline");

  const track = document.createElement("div");
  track.className = "timeline-track";
  track.style.position = "relative";
  track.style.width = "300%";
  track.style.height = "var(--sp-8)";

  const dated = models.filter((m) => m.releaseDate !== null);
  const percents = dated.map((m) => leftPercent(m.releaseDate, generatedAt));
  const lanes = assignLanes(percents);
  dated.forEach((model, index) => {
    track.append(modelDot(model, percents[index], lanes[index]));
  });

  const details = [];
  for (const event of events) {
    const { marker, detail } = eventMarker(event, generatedAt);
    track.append(marker);
    details.push(detail);
  }

  strip.append(track, ...details);
  return strip;
}
