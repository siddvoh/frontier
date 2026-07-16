// Shared reveal formatting for the game views (W10.S2; C60, C71). Both
// daily.js and endless.js build their post-answer reveal from this module,
// so the two modes always agree on how a question's real values are shown:
// stat reveals carry the human field label with display-formatted values
// (never the raw artifact dot-path), and scenario reveals carry the exact
// engine formula strings verbatim (C60). Formatting is display-only; the
// stored values are never altered or defaulted (C19). This module imports
// only from docs/js/, never touches the network, and never reads or
// writes browser storage.

import { fmtDate, fmtInt, fmtScore, fmtUsd } from "../util.js";

// Human label and display formatter per stat revealData field (C60).
export const STAT_REVEAL = Object.freeze({
  "pricing.inputPerMTok": { label: "Input price per Mtok", format: fmtUsd },
  "pricing.outputPerMTok": { label: "Output price per Mtok", format: fmtUsd },
  contextWindow: { label: "Context window", format: fmtInt },
  "benchmarks.gpqaDiamond": { label: "GPQA Diamond", format: fmtScore },
  "benchmarks.swebenchVerified": {
    label: "SWE-bench Verified",
    format: fmtScore,
  },
  releaseDate: { label: "Release date", format: fmtDate },
});

function paragraph(text, className) {
  const node = document.createElement("p");
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * The C60 reveal for an answered question as ready-to-append <p> elements.
 * Stat templates yield one line, `Label: NameA value vs NameB value`;
 * scenario templates yield the budget line plus both C26 formula strings
 * verbatim, each formula line carrying the "cost-formula" class. `name`
 * maps a model id to its display name.
 */
export function revealParagraphs(question, name) {
  const data = question.revealData;
  if (data.field !== undefined) {
    const { label, format } = STAT_REVEAL[data.field];
    return [
      paragraph(
        `${label}: ${name(question.optionA)} ${format(data.valueA)} vs ` +
          `${name(question.optionB)} ${format(data.valueB)}`
      ),
    ];
  }
  return [
    paragraph(
      `Budget: ${fmtUsd(data.budget)} for ${data.inputMTok} Mtok in / ` +
        `${data.outputMTok} Mtok out per month`
    ),
    paragraph(`${name(question.optionA)}: ${data.formulaA}`, "cost-formula"),
    paragraph(`${name(question.optionB)}: ${data.formulaB}`, "cost-formula"),
  ];
}
