// Scenario view (W3.S4). Pure render: (state) -> DOM element (C29, C33).
// state = { route, data }; route = { view: "scenario", input } per C22.
// All computation comes from engine.js; this module only renders. W4.S1
// wires form submission in main.js; control name attributes match the
// router's scenario query keys (budget, task, in, out, open, minCtx,
// after, before) so the form state can round-trip through the hash.

import { MISSING, fmtText, fmtUsd, fmtInt, fmtScore } from "../util.js";
import { evaluateScenario, TASKS } from "../engine.js";

const RANKING_LABELS = {
  coding: "SWE-bench Verified",
  reasoning: "GPQA Diamond",
  longdoc: "Context window",
};

function fmtRankingValue(task, value) {
  return task === "longdoc" ? fmtInt(value) : fmtScore(value);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function labeledField(id, name, labelText, control) {
  control.id = id;
  control.name = name;
  const label = el("label", { htmlFor: id, textContent: labelText });
  return el("div", { className: "field" }, [label, control]);
}

// A .field that pairs 2-up in the .form-grid columns at >=720px.
function pairedField(id, name, labelText, control) {
  const field = labeledField(id, name, labelText, control);
  field.classList.add("field-pair");
  return field;
}

// Checkbox variant: control first so the box sits inline with its label.
function checkboxField(id, name, labelText, control) {
  control.id = id;
  control.name = name;
  const label = el("label", { htmlFor: id, textContent: labelText });
  return el("div", { className: "field field-check" }, [control, label]);
}

function numberInput(value) {
  const input = el("input", { type: "number", min: "0" });
  input.step = "any";
  if (value !== null) input.value = String(value);
  return input;
}

function dateInput(value) {
  const input = el("input", { type: "date" });
  if (value !== null) input.value = value;
  return input;
}

function taskSelect(task) {
  const select = el("select", {}, [
    el("option", { value: "", textContent: "Select a task" }),
    ...TASKS.map((t) => el("option", { value: t, textContent: t })),
  ]);
  if (task !== null) select.value = task;
  return select;
}

// Every C22 input, each control labeled (C33, C35). W5.S6 layout: the
// form is a .form-grid (two 1fr columns at >=720px, per W5.S1 CSS), so the
// four .field-pair cells pair up row by row: budget/task then in/out. The
// four constraints live in a labeled fieldset spanning the grid, with the
// open-weights checkbox inline before its label.
function renderForm(input) {
  const c = input.constraints;
  const openBox = el("input", { type: "checkbox" });
  openBox.checked = c.openWeightsOnly === true;
  const constraints = el("fieldset", { className: "constraints" }, [
    el("legend", { textContent: "Constraints" }),
    checkboxField("scenario-open", "open", "Open weights only", openBox),
    labeledField(
      "scenario-min-ctx",
      "minCtx",
      "Minimum context window (tokens)",
      numberInput(c.minContextTokens)
    ),
    labeledField(
      "scenario-after",
      "after",
      "Released on or after",
      dateInput(c.releasedOnOrAfter)
    ),
    labeledField(
      "scenario-before",
      "before",
      "Released on or before",
      dateInput(c.releasedOnOrBefore)
    ),
  ]);
  return el("form", { id: "scenario-form", className: "form-grid" }, [
    pairedField(
      "scenario-budget",
      "budget",
      "Budget (USD/month)",
      numberInput(input.budgetUsdPerMonth)
    ),
    pairedField("scenario-task", "task", "Task", taskSelect(input.task)),
    pairedField(
      "scenario-in",
      "in",
      "Input volume (Mtok/month)",
      numberInput(input.inputMTokPerMonth)
    ),
    pairedField(
      "scenario-out",
      "out",
      "Output volume (Mtok/month)",
      numberInput(input.outputMTokPerMonth)
    ),
    constraints,
    el("button", { type: "submit", textContent: "Run scenario" }),
  ]);
}

// Rendered only for a runnable input (W5.S6), so every value below is
// non-null and the line never shows a wall of MISSING markers.
function renderSummary(input) {
  return el("p", {
    className: "scenario-summary muted",
    textContent:
      "Budget " +
      fmtUsd(input.budgetUsdPerMonth) +
      "/mo · task " +
      fmtText(input.task) +
      " · input " +
      fmtInt(input.inputMTokPerMonth) +
      " Mtok/mo · output " +
      fmtInt(input.outputMTokPerMonth) +
      " Mtok/mo",
  });
}

// Ranked entry: rank, name, ranking-field value, exact C26 formula string
// (rendered verbatim from the engine, never reformatted), and the context
// window for longdoc (its ranking field, so one line serves both) (C33).
function renderQualified(qualified, task) {
  if (qualified.length === 0) {
    return el("p", {
      className: "muted",
      textContent: "No models qualify under this scenario.",
    });
  }
  return el(
    "ol",
    { className: "scenario-ranked" },
    qualified.map((entry) => {
      const item = el("li", {}, [
        el("span", { className: "rank", textContent: String(entry.rank) }),
        el("span", { className: "model-name", textContent: entry.model.name }),
        el("span", {
          className: "ranking-value",
          textContent:
            RANKING_LABELS[task] +
            ": " +
            fmtRankingValue(task, entry.rankingValue),
        }),
        el("span", {
          className: "cost-formula",
          textContent: entry.cost.formula,
        }),
      ]);
      item.dataset.modelId = entry.model.id;
      return item;
    })
  );
}

// Collapsed excluded-models section with the machine-readable C27 reason.
function renderExcluded(excluded) {
  const items = excluded.map(({ model, reason }) => {
    const item = el("li", {}, [
      el("span", { className: "model-name", textContent: model.name }),
      el("span", { className: "muted reason", textContent: reason }),
    ]);
    item.dataset.modelId = model.id;
    item.dataset.reason = reason;
    return item;
  });
  return el("details", { className: "scenario-excluded" }, [
    el("summary", {
      textContent: "Excluded models (" + excluded.length + ")",
    }),
    el("ul", {}, items),
  ]);
}

function isRunnable(input) {
  return (
    input.budgetUsdPerMonth !== null &&
    input.task !== null &&
    input.inputMTokPerMonth !== null &&
    input.outputMTokPerMonth !== null
  );
}

function renderResults(input, models) {
  const results = el("div", { id: "scenario-results", className: "glass" });
  if (!isRunnable(input)) {
    results.append(
      el("p", {
        className: "muted",
        textContent:
          "Enter a budget, task, and both token volumes to rank models." +
          " Until then every scenario value is " +
          MISSING +
          ".",
      })
    );
    return results;
  }
  const { qualified, excluded } = evaluateScenario(models, input);
  results.append(renderQualified(qualified, input.task));
  if (excluded.length > 0) results.append(renderExcluded(excluded));
  return results;
}

export function render(state) {
  const input = state.route.input;
  const children = [el("h2", { textContent: "Scenario" }), renderForm(input)];
  // Honest empty state (W5.S6): the summary line exists only once the
  // input is complete enough for the engine to run.
  if (isRunnable(input)) children.push(renderSummary(input));
  children.push(renderResults(input, state.data.models));
  return el("section", { className: "view-scenario" }, children);
}
