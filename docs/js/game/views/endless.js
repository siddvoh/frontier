// Endless mode view (W8.S1; C63, C64, C71). Pure render per the W2.S3
// contract: render(state) -> HTMLElement via the global document, state =
// { route, data } with the full artifact, and the view never fetches. The
// infinite question sequence comes from endlessQuestions(seed, artifact),
// seeded by route.seed when the hash carried ?seed= (the router already
// parsed it to a number) and by Date.now() at session start otherwise, so
// a seeded run replays the exact same sequence (C63). The running streak
// is view state; the best streak flows only through the storage module
// and never touches browser storage directly (C64, C65). The C60 reveal
// content comes from the shared reveal module (W10.S2) so daily and
// endless always agree on labels and value formatting. Markup follows
// the W7.S2 class
// contract: two <button> cards inside #game-cards.glass (amended C43),
// .game-progress for the streak line, .game-reveal for the C60 values,
// .game-next for the next-question control.

import { endlessQuestions } from "../questions.js";
import { STAT_REVEAL, revealParagraphs } from "../reveal.js";
import { getBestStreak, recordCorrect, recordWrong } from "../storage.js";
import { fmtUsd } from "../../util.js";

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/**
 * The honest per-card values revealed inline after an answer (W11.S3):
 * the real C60 stat values through the shared reveal formatters, or the
 * two computed C23 costs for scenario templates. Read from revealData
 * only; nothing is ever invented or defaulted (C19).
 */
function cardValues(question) {
  const data = question.revealData;
  if (data.field !== undefined) {
    const { format } = STAT_REVEAL[data.field];
    return [format(data.valueA), format(data.valueB)];
  }
  return [fmtUsd(data.costA), fmtUsd(data.costB)];
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

  // The streak is what an endless run is playing for, so the count is the
  // figure and the best sits quiet beside it. The celebration fires only
  // once the run passes the best the player walked in with: the storage
  // module has already persisted the new best by then, so comparing
  // against the live best would congratulate every first correct answer.
  const bestAtStart = getBestStreak();

  function showProgress() {
    // You can only beat a best you had: a first-ever run passing 0 is not
    // a comeback, so it reads as a plain streak until there is a bar.
    const beatenBest = bestAtStart > 0 && streak > bestAtStart;
    const count = el("span", {
      className: beatenBest ? "game-streak streak-best" : "game-streak",
      textContent: String(streak),
    });
    const label = el("span", {
      className: "game-streak-label",
      textContent: beatenBest
        ? "New best streak"
        : `Streak · Best ${getBestStreak()}`,
    });
    progress.replaceChildren(count, label);
  }

  function showQuestion() {
    prompt.textContent = question.prompt;
    options[0].textContent = name(question.optionA);
    options[1].textContent = name(question.optionB);
    for (const button of options) {
      button.disabled = false;
      // Setting textContent above dropped the in-card value spans; the
      // answer-state classes reset here so a fresh question starts clean.
      button.classList.remove("card-correct", "card-picked", "card-wrong");
    }
    outcome.replaceChildren();
    showProgress();
  }

  function answer(index) {
    if (options[0].disabled) return;
    const correct = index === question.correctIndex;
    // A wrong answer resets the run to 0 and play continues; a correct one
    // increments, and the storage module persists any new best (C64).
    streak = correct ? recordCorrect(streak) : recordWrong();
    // Honest answer states: the correct card carries the success state, a
    // wrong pick the danger state (STEP 3), the chosen card the pressed
    // state, and both cards reveal their real value inline where the eye
    // already is.
    const values = cardValues(question);
    options.forEach((button, i) => {
      button.disabled = true;
      button.append(
        el("span", { className: "card-value", textContent: values[i] })
      );
    });
    options[index].classList.add("card-picked");
    if (!correct) options[index].classList.add("card-wrong");
    options[question.correctIndex].classList.add("card-correct");
    const winner = question.correctIndex === 0
      ? question.optionA
      : question.optionB;
    const reveal = el("div", { className: "game-reveal" }, [
      el("p", {
        className: `game-verdict ${correct ? "verdict-correct" : "verdict-wrong"}`,
        textContent: correct ? "Correct." : `Not quite: ${name(winner)}.`,
      }),
      ...revealParagraphs(question, name),
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
