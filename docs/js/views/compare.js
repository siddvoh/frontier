// Compare view (W3.S3, C32). Pure render: (state) -> DOM element.
// state = { route, data }; route = { view: "compare", ids }.
//
// Renders the compare tray (#compare-tray) with the selected models and
// exactly five bar groups: input price, output price, context window,
// GPQA Diamond, SWE-bench Verified. Bars are plain divs whose widths are
// proportional with the max among the compared models at 100%. A null value
// renders a MISSING row (via the util formatters) with no bar (C20, C19).
//
// Selection logic lives in the exported pure helper toggleCompareId; main.js
// (W4.S1) calls it when wiring catalog selection events. It caps the
// selection at MAX_COMPARE models, so selecting a 4th is impossible.

import { fmtText, fmtUsd, fmtInt, fmtScore } from "../util.js";

export const MAX_COMPARE = 3;

// The five C32 bar groups, in render order.
const METRICS = [
  {
    key: "input-price",
    label: "Input price ($/MTok)",
    value: (m) => m.pricing.inputPerMTok,
    format: fmtUsd,
  },
  {
    key: "output-price",
    label: "Output price ($/MTok)",
    value: (m) => m.pricing.outputPerMTok,
    format: fmtUsd,
  },
  {
    key: "context-window",
    label: "Context window (tokens)",
    value: (m) => m.contextWindow,
    format: fmtInt,
  },
  {
    key: "gpqa-diamond",
    label: "GPQA Diamond",
    value: (m) => m.benchmarks.gpqaDiamond,
    format: fmtScore,
  },
  {
    key: "swebench-verified",
    label: "SWE-bench Verified",
    value: (m) => m.benchmarks.swebenchVerified,
    format: fmtScore,
  },
];

/**
 * Toggle a model id in a compare selection, enforcing the 3-model cap.
 * Pure: never mutates `ids`. Selecting an already-selected id removes it;
 * selecting a new id when MAX_COMPARE models are already selected is a
 * no-op (the 4th selection is impossible, C32).
 * @param {string[]} ids current selection
 * @param {string} id model id to toggle
 * @returns {string[]} the next selection
 */
export function toggleCompareId(ids, id) {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= MAX_COMPARE) return ids.slice();
  return [...ids, id];
}

// Width of one bar as a percentage of the group's non-null max. Only called
// for non-null values; a group whose max is not positive gets zero-width
// bars because proportionality is undefined there.
function barWidthPercent(value, max) {
  return max > 0 ? (value / max) * 100 : 0;
}

// The tray docks as a collapsed one-line summary so it never covers the
// bar rows (W5.S5); details/summary gives a standards-native toggle with no
// event wiring, keeping render pure. The .glass identity stays on
// #compare-tray itself (C43); .tray-docked CSS ships in another slice.
function renderTray(models) {
  const tray = document.createElement("div");
  tray.id = "compare-tray";
  tray.className = "glass";

  const dock = document.createElement("details");
  dock.className = "tray-docked";

  const summary = document.createElement("summary");
  summary.textContent = models.length + " of " + MAX_COMPARE + " selected";
  dock.append(summary);

  if (models.length > 0) {
    const list = document.createElement("ul");
    for (const model of models) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = model.name + " (" + fmtText(model.organization) + ")";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost";
      remove.dataset.action = "compare-remove";
      remove.dataset.modelId = model.id;
      remove.textContent = "Remove";
      item.append(name, " ", remove);
      list.append(item);
    }
    dock.append(list);
  }

  tray.append(dock);
  return tray;
}

function renderBarGroup(metric, models) {
  const group = document.createElement("div");
  group.className = "bar-group";
  group.dataset.metric = metric.key;

  const heading = document.createElement("h3");
  heading.textContent = metric.label;
  group.append(heading);

  const values = models.map(metric.value);
  const nonNull = values.filter((v) => v !== null);
  const max = nonNull.length > 0 ? Math.max(...nonNull) : null;

  models.forEach((model, i) => {
    const value = values[i];
    const row = document.createElement("div");
    row.className = "bar-row";
    row.dataset.modelId = model.id;

    // Three sibling cells (W5.S5): name, bar, value. The bar cell is always
    // present so rows align as columns; for a null value it stays empty (no
    // .bar/.bar-track) and the value cell shows MISSING via the formatter,
    // never a string concatenated onto the name.
    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = model.name;

    const barCell = document.createElement("div");
    barCell.className = "bar-cell";
    if (value !== null) {
      const track = document.createElement("div");
      track.className = "bar-track";
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = barWidthPercent(value, max) + "%";
      track.append(bar);
      barCell.append(track);
    } else {
      row.classList.add("bar-row-missing");
    }

    const valueEl = document.createElement("span");
    valueEl.className = "bar-value";
    valueEl.textContent = metric.format(value);

    row.append(label, barCell, valueEl);

    group.append(row);
  });

  return group;
}

/**
 * Render the compare view.
 * @param {{route: {view: string, ids: string[]}, data: object}} state
 * @returns {HTMLElement}
 */
export function render(state) {
  const section = document.createElement("section");
  section.className = "view-compare";

  const heading = document.createElement("h2");
  heading.textContent = "Compare";
  section.append(heading);

  // Cap defensively so a hand-typed URL can never compare more than
  // MAX_COMPARE models either (C32).
  const ids = state.route.ids.slice(0, MAX_COMPARE);
  const models = [];
  const unknown = [];
  for (const id of ids) {
    const model = state.data.models.find((m) => m.id === id);
    if (model) models.push(model);
    else unknown.push(id);
  }

  section.append(renderTray(models));

  if (unknown.length > 0) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Unknown model ids ignored: " + unknown.join(", ");
    section.append(note);
  }

  if (models.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Select 2 or 3 models from the catalog to compare.";
    section.append(empty);
    return section;
  }

  for (const metric of METRICS) {
    section.append(renderBarGroup(metric, models));
  }
  return section;
}
