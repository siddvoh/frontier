// Timeline strip (C34). Pure render: (props) -> DOM element, no fetch.
// x is mapped linearly from TIMELINE_START to the artifact's generatedAt.
// Model dots are anchors labeled by name at releaseDate (null dates are
// omitted, C21); event markers use the accent token and reveal their title
// and body on click. Pure HTML/CSS positioning: no canvas, no SVG.
// Inline styles use only percentages, "0", and var() references (C36).

import { fmtDate } from "../util.js";

/** Left edge of the timeline axis (GPT-4 era start). */
export const TIMELINE_START = "2023-03-01";

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

function placeAt(el, dateIso, generatedAt) {
  el.style.position = "absolute";
  el.style.left = leftPercent(dateIso, generatedAt) + "%";
}

function modelDot(model, index, generatedAt) {
  const dot = document.createElement("a");
  dot.className = "timeline-dot";
  dot.href = "#/model/" + encodeURIComponent(model.id);
  dot.textContent = model.name;
  placeAt(dot, model.releaseDate, generatedAt);
  // Alternate rows so neighboring labels do not sit on one line.
  dot.style.top = index % 2 === 0 ? "var(--sp-2)" : "var(--sp-6)";
  return dot;
}

function eventMarker(event, generatedAt) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "timeline-event";
  marker.setAttribute("aria-label", event.title);
  placeAt(marker, event.date, generatedAt);
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
  dated.forEach((model, index) => {
    track.append(modelDot(model, index, generatedAt));
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
