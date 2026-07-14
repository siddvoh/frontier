// Endless mode view (W8.S1; C63, C64, C71). Pure render per the W2.S3
// contract: render(state) -> HTMLElement via the global document, state =
// { route, data } with the full artifact, and the view never fetches. The
// infinite question sequence comes from endlessQuestions(seed, artifact),
// seeded by route.seed when the hash carried ?seed= (the router already
// parsed it to a number) and by Date.now() at session start otherwise, so
// a seeded run replays the exact same sequence (C63). The running streak
// is view state; the best streak flows only through the storage module
// and never touches browser storage directly (C64, C65). Markup follows
// the W7.S2 class
// contract: two <button> cards inside #game-cards.glass (amended C43),
// .game-progress for the streak line, .game-reveal for the C60 values,
// .game-next for the next-question control.

import { fmtDate, fmtInt, fmtScore, fmtUsd } from "../../util.js";
import { endlessQuestions } from "../questions.js";
import { getBestStreak, recordCorrect, recordWrong } from "../storage.js";

// Reveal label and formatter per stat revealData field (C60); values are
// formatted here, in the view, never in the generator.
const STAT_REVEAL = Object.freeze({
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

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

// The C60 reveal lines for a question, one string per <p>. Stat templates
// show the compared field with both values; scenario templates show the
// budget plus both engine formula strings verbatim (C71).
function revealLines(question, name) {
  const data = question.revealData;
  if (data.field !== undefined) {
    const { label, format } = STAT_REVEAL[data.field];
    return [
      `${label}: ${name(question.optionA)} ${format(data.valueA)} vs ` +
        `${name(question.optionB)} ${format(data.valueB)}`,
    ];
  }
  return [
    `Budget: ${fmtUsd(data.budget)} for ${data.inputMTok} Mtok in / ` +
      `${data.outputMTok} Mtok out per month`,
    `${name(question.optionA)}: ${data.formulaA}`,
    `${name(question.optionB)}: ${data.formulaB}`,
  ];
}

export function render(state) {
  const seed = state.route.seed ?? Date.now();
  const questions = endlessQuestions(seed, state.data);
  const names = new Map(state.data.models.map((m) => [m.id, m.name]));
  const name = (id) => names.get(id) ?? id;

  const section = el("section", { className: "view-endless" });
  const heading = el("h2", { textContent: "Endless" });

  const first = questions.next();
  if (first.done) {
    section.append(
      heading,
      el("p", {
        className: "muted",
        textContent: "Not enough model data for questions yet.",
      })
    );
    return section;
  }

  let question = first.value;
  let streak = 0;

  const progress = el("p", { className: "game-progress muted" });
  const prompt = el("p", { className: "game-prompt" });
  const cards = el("div", { id: "game-cards", className: "glass" });
  const options = [0, 1].map((index) => {
    const button = el("button", { type: "button" });
    button.addEventListener("click", () => answer(index));
    return button;
  });
  cards.append(...options);
  // Holds the reveal block and next-question button after an answer.
  const outcome = el("div", {});
  section.append(heading, progress, prompt, cards, outcome);

  function showProgress() {
    progress.textContent = `Streak ${streak} · Best ${getBestStreak()}`;
  }

  function showQuestion() {
    prompt.textContent = question.prompt;
    options[0].textContent = name(question.optionA);
    options[1].textContent = name(question.optionB);
    for (const button of options) button.disabled = false;
    outcome.replaceChildren();
    showProgress();
  }

  function answer(index) {
    if (options[0].disabled) return;
    const correct = index === question.correctIndex;
    // A wrong answer resets the run to 0 and play continues; a correct one
    // increments, and the storage module persists any new best (C64).
    streak = correct ? recordCorrect(streak) : recordWrong();
    for (const button of options) button.disabled = true;
    const winner = question.correctIndex === 0
      ? question.optionA
      : question.optionB;
    const reveal = el("div", { className: "game-reveal" }, [
      el("p", {
        textContent: correct ? "Correct." : `Not quite: ${name(winner)}.`,
      }),
      ...revealLines(question, name).map((text) =>
        el("p", { textContent: text })
      ),
    ]);
    const next = el("button", {
      className: "game-next",
      type: "button",
      textContent: "Next question",
    });
    next.addEventListener("click", () => {
      question = questions.next().value;
      showQuestion();
    });
    outcome.replaceChildren(reveal, next);
    showProgress();
  }

  showQuestion();
  return section;
}
