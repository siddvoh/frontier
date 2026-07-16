// Catalog view (C30, C34, C35, C20). Pure render: (state) -> DOM element.
// state = { route, data } where data is the models.json artifact.
// One table row per model; filters (organization multi-select, open-weights
// toggle, free-text name) and sorts (release date, either price, context
// window, both benchmarks) with nulls last in both directions. Null stat
// values render via the shared MISSING constant; nothing is defaulted (C19).
//
// W11.S2: the organization filter is a set of labeled checkbox chips
// (.chip-set / .chip), the only organization control; the checked chip
// inputs hold the multi-select state. In the table, organization renders as
// a muted second line under the model name instead of its own column.

import {
  fmtText,
  fmtUsd,
  fmtInt,
  fmtScore,
  fmtDate,
  fmtWeights,
} from "../util.js";
import { render as renderTimeline } from "./timeline.js";

/** Sortable columns: sort key -> value accessor (null means missing). */
export const SORT_KEYS = {
  releaseDate: (m) => m.releaseDate,
  inputPrice: (m) => m.pricing.inputPerMTok,
  outputPrice: (m) => m.pricing.outputPerMTok,
  contextWindow: (m) => m.contextWindow,
  gpqaDiamond: (m) => m.benchmarks.gpqaDiamond,
  swebenchVerified: (m) => m.benchmarks.swebenchVerified,
};

const SORT_LABELS = {
  releaseDate: "Release date",
  inputPrice: "Input price",
  outputPrice: "Output price",
  contextWindow: "Context window",
  gpqaDiamond: "GPQA Diamond",
  swebenchVerified: "SWE-bench Verified",
};

// Each column: [header, cell formatter, td class]. "nowrap" keeps names and
// dates on one line; "num" is the right-aligned tabular-nums class shipped by
// the CSS slices. The name cell also carries the muted organization subline
// (built in rowFor); classes apply to every td (including MISSING cells);
// header th elements carry none of them.
const COLUMNS = [
  ["Name", (m) => fmtText(m.name), "nowrap"],
  ["Released", (m) => fmtDate(m.releaseDate), "nowrap"],
  ["Input $/MTok", (m) => fmtUsd(m.pricing.inputPerMTok), "num"],
  ["Output $/MTok", (m) => fmtUsd(m.pricing.outputPerMTok), "num"],
  ["Context window", (m) => fmtInt(m.contextWindow), "num"],
  ["GPQA Diamond", (m) => fmtScore(m.benchmarks.gpqaDiamond), "num"],
  ["SWE-bench Verified", (m) => fmtScore(m.benchmarks.swebenchVerified), "num"],
  ["Weights", (m) => fmtWeights(m.openWeights), ""],
];

/**
 * Apply the catalog filters. A model with null fields stays unless a filter
 * positively excludes it (open-weights toggle requires openWeights === true).
 * @param {Array} models
 * @param {{organizations: string[], openWeightsOnly: boolean,
 *          nameQuery: string}} filters
 * @returns {Array}
 */
export function filterModels(models, filters) {
  const query = filters.nameQuery.trim().toLowerCase();
  return models.filter((model) => {
    if (
      filters.organizations.length > 0 &&
      !filters.organizations.includes(model.organization)
    ) {
      return false;
    }
    if (filters.openWeightsOnly && model.openWeights !== true) return false;
    if (query !== "" && !model.name.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

/**
 * Sort models by a SORT_KEYS key. Null values sort last in both directions;
 * ties break by id ascending so the order is total and deterministic.
 * @param {Array} models
 * @param {string} key one of the SORT_KEYS names
 * @param {"asc"|"desc"} direction
 * @returns {Array} a new sorted array
 */
export function sortModels(models, key, direction) {
  const valueOf = SORT_KEYS[key];
  const dir = direction === "asc" ? 1 : -1;
  return [...models].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    const aNull = av === null;
    const bNull = bv === null;
    if (aNull !== bNull) return aNull ? 1 : -1;
    if (!aNull) {
      if (av < bv) return -dir;
      if (av > bv) return dir;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function labeled(text, control) {
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = text;
  wrap.append(label, control);
  return wrap;
}

// The organization control (W11.S2): one labeled checkbox chip per distinct
// organization, sorted. Each chip is a label wrapping its checkbox and text,
// with an explicit for/id association (C35). The checked chips ARE the
// multi-select state; there is no backing select element.
function orgChipSet(models) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "chip-set";
  const legend = document.createElement("legend");
  legend.textContent = "Organization";
  fieldset.append(legend);
  const orgs = [...new Set(models.map((m) => m.organization))].sort();
  orgs.forEach((org, index) => {
    const chip = document.createElement("label");
    chip.className = "chip";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "catalog-org-" + index;
    box.value = org;
    chip.htmlFor = box.id;
    const text = document.createElement("span");
    text.textContent = org;
    chip.append(box, text);
    fieldset.append(chip);
  });
  return fieldset;
}

function sortSelect(id, entries, selected) {
  const select = document.createElement("select");
  select.id = id;
  for (const [value, text] of entries) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    option.selected = value === selected;
    select.append(option);
  }
  return select;
}

function rowFor(model) {
  const row = document.createElement("tr");
  row.dataset.modelId = model.id;
  const weightsIndex = COLUMNS.length - 1;
  COLUMNS.forEach(([, cell, cellClass], index) => {
    const td = document.createElement("td");
    if (cellClass !== "") td.className = cellClass;
    if (index === 0) {
      const link = document.createElement("a");
      link.href = "#/model/" + encodeURIComponent(model.id);
      link.textContent = model.name;
      // Organization reads as the quiet second line under the name (W11.S2);
      // a block element makes the line, the muted class makes it quiet.
      const org = document.createElement("div");
      org.className = "muted";
      org.textContent = fmtText(model.organization);
      td.append(link, org);
    } else if (index === weightsIndex && model.openWeights !== null) {
      // Weights renders as a badge (W11.S2); a null flag falls through to
      // the plain MISSING text so no empty badge pill ever renders (C20).
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = cell(model);
      td.append(badge);
    } else {
      td.textContent = cell(model);
    }
    row.append(td);
  });
  return row;
}

function emptyRow() {
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = COLUMNS.length;
  td.className = "muted";
  td.textContent = "No models match the current filters.";
  row.append(td);
  return row;
}

export function render(state) {
  const { models, events, generatedAt } = state.data;

  const section = document.createElement("section");
  section.className = "view-catalog";

  const heading = document.createElement("h2");
  heading.textContent = "Catalog";
  section.append(heading);

  section.append(renderTimeline({ models, events, generatedAt }));

  const open = document.createElement("input");
  open.type = "checkbox";
  open.id = "catalog-filter-open";
  const name = document.createElement("input");
  name.type = "text";
  name.id = "catalog-filter-name";
  const sortKey = sortSelect(
    "catalog-sort-key",
    Object.keys(SORT_KEYS).map((key) => [key, SORT_LABELS[key]]),
    "releaseDate"
  );
  const sortDir = sortSelect(
    "catalog-sort-dir",
    [
      ["desc", "Descending"],
      ["asc", "Ascending"],
    ],
    "desc"
  );

  // Deliberate control order (W5.S4, minus the dissolved organization slot):
  // search, open-weights, sort key, direction. catalog-controls stays for
  // the update listeners; the organization chips sit right after the bar.
  const controls = document.createElement("div");
  controls.className = "catalog-controls filter-bar";
  controls.append(
    labeled("Filter by name", name),
    labeled("Open weights only", open),
    labeled("Sort by", sortKey),
    labeled("Direction", sortDir)
  );
  section.append(controls);

  // Chip inputs live outside the .filter-bar (its control list is pinned)
  // as the bar's immediate sibling.
  const chips = orgChipSet(models);
  section.append(chips);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const [title] of COLUMNS) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = title;
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);

  // Containment (W5.S4): the 731px table scrolls inside this wrapper so the
  // page itself never scrolls horizontally at narrow widths.
  const tableScroll = document.createElement("div");
  tableScroll.className = "table-scroll";
  tableScroll.append(table);
  section.append(tableScroll);

  function update() {
    const filtered = filterModels(models, {
      organizations: [...chips.querySelectorAll("input")]
        .filter((box) => box.checked)
        .map((box) => box.value),
      openWeightsOnly: open.checked,
      nameQuery: name.value,
    });
    const sorted = sortModels(filtered, sortKey.value, sortDir.value);
    tbody.replaceChildren(
      ...(sorted.length === 0 ? [emptyRow()] : sorted.map(rowFor))
    );
  }

  for (const host of [controls, chips]) {
    host.addEventListener("input", update);
    host.addEventListener("change", update);
  }
  update();

  return section;
}
