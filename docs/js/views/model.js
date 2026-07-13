// Model card overlay (W3.S2, C31). Pure render: (state) -> DOM element.
// Renders every record field with a visible provenance tag ("Epoch" or
// "curated") for each enriched field present in `sources`, the Epoch
// enrichment values, and every event whose modelIds includes this model.
// Null fields render via MISSING from util.js; no dash literal here (C20).
// state = { route, data }; route = { view: "model", id }.

import {
  fmtText,
  fmtUsd,
  fmtInt,
  fmtScore,
  fmtDate,
  fmtWeights,
} from "../util.js";

// sources values are "curated" | "epoch"; visible tag text per C31.
const SOURCE_LABELS = { curated: "curated", epoch: "Epoch" };

// Every record field, in render order. sourceKey is the dot-path key used
// in the merged record's `sources` object (null for fields that are never
// tagged: identity fields the pipeline does not treat as enrichable stats).
const FIELD_ROWS = [
  { label: "ID", sourceKey: null, value: (m) => fmtText(m.id) },
  { label: "Name", sourceKey: null, value: (m) => fmtText(m.name) },
  {
    label: "Organization",
    sourceKey: null,
    value: (m) => fmtText(m.organization),
  },
  {
    label: "Release date",
    sourceKey: "releaseDate",
    value: (m) => fmtDate(m.releaseDate),
  },
  {
    label: "Epoch dataset name",
    sourceKey: null,
    value: (m) => fmtText(m.epochName),
  },
  {
    label: "Input price / MTok",
    sourceKey: "pricing.inputPerMTok",
    value: (m) => fmtUsd(m.pricing.inputPerMTok),
  },
  {
    label: "Output price / MTok",
    sourceKey: "pricing.outputPerMTok",
    value: (m) => fmtUsd(m.pricing.outputPerMTok),
  },
  {
    label: "Context window (tokens)",
    sourceKey: "contextWindow",
    value: (m) => fmtInt(m.contextWindow),
  },
  {
    label: "GPQA Diamond",
    sourceKey: "benchmarks.gpqaDiamond",
    value: (m) => fmtScore(m.benchmarks.gpqaDiamond),
  },
  {
    label: "SWE-bench Verified",
    sourceKey: "benchmarks.swebenchVerified",
    value: (m) => fmtScore(m.benchmarks.swebenchVerified),
  },
  {
    label: "Weights",
    sourceKey: "openWeights",
    value: (m) => fmtWeights(m.openWeights),
  },
];

// Epoch enrichment values (C31), rendered as their own group.
const EPOCH_ROWS = [
  {
    label: "Parameters",
    sourceKey: "epoch.parameters",
    value: (m) => fmtText(m.epoch.parameters),
  },
  {
    label: "Training compute (FLOP)",
    sourceKey: "epoch.trainingComputeFlop",
    value: (m) => fmtText(m.epoch.trainingComputeFlop),
  },
  {
    label: "Organization",
    sourceKey: "epoch.organization",
    value: (m) => fmtText(m.epoch.organization),
  },
];

function renderRows(model, rows) {
  const list = document.createElement("dl");
  list.className = "grid-2";
  for (const row of rows) {
    const term = document.createElement("dt");
    term.className = "muted";
    term.textContent = row.label;
    const detail = document.createElement("dd");
    const value = document.createElement("span");
    value.textContent = row.value(model);
    detail.append(value);
    const source =
      row.sourceKey === null ? undefined : model.sources[row.sourceKey];
    if (source !== undefined) {
      const tag = document.createElement("span");
      tag.className = "badge";
      tag.dataset.source = source;
      tag.textContent = SOURCE_LABELS[source];
      detail.append(" ", tag);
    }
    list.append(term, detail);
  }
  return list;
}

function renderEvents(model, events) {
  const related = events.filter((e) => e.modelIds.includes(model.id));
  const wrap = document.createElement("section");
  wrap.className = "model-events";
  const heading = document.createElement("h3");
  heading.textContent = "Events";
  wrap.append(heading);
  if (related.length === 0) {
    const none = document.createElement("p");
    none.className = "muted";
    none.textContent = "No recorded events for this model.";
    wrap.append(none);
    return wrap;
  }
  for (const event of related) {
    const article = document.createElement("article");
    article.className = "card";
    const date = document.createElement("time");
    date.className = "muted";
    date.dateTime = event.date;
    date.textContent = event.date;
    const title = document.createElement("h4");
    title.textContent = event.title;
    const body = document.createElement("p");
    body.textContent = event.body;
    article.append(date, title, body);
    wrap.append(article);
  }
  return wrap;
}

export function render(state) {
  const section = document.createElement("section");
  section.id = "model-overlay";
  section.className = "glass";

  const model = state.data.models.find((m) => m.id === state.route.id);
  if (!model) {
    const heading = document.createElement("h2");
    heading.textContent = "Model not found";
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "No model with id " + state.route.id + ".";
    section.append(heading, note);
    return section;
  }

  const heading = document.createElement("h2");
  heading.textContent = model.name;

  const epochHeading = document.createElement("h3");
  epochHeading.textContent = "Epoch enrichment";

  section.append(
    heading,
    renderRows(model, FIELD_ROWS),
    epochHeading,
    renderRows(model, EPOCH_ROWS),
    renderEvents(model, state.data.events)
  );
  return section;
}
