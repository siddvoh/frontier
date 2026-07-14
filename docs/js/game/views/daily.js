// Daily mode view (W8.S2: C61, C67, C71, C72, C76). Pure render per the
// W2.S3 contract: render(state) -> HTMLElement via the global document,
// state = { route, data } with the full artifact, and the view never loads
// data itself. The optional second parameter injects the UTC date for
// tests; it defaults to the current UTC date. Persistence goes through the
// storage module only (C65): answers are recorded as the player
// progresses via saveDailyRecord upserts, and once the date's record is
// complete the view renders the results screen instead of a replay (C67).

import { dailySeed, generateDaily } from "../questions.js";
import { getDailyRecord, saveDailyRecord } from "../storage.js";
import { LAUNCH_DATE, buildShareString, copyShareString } from "../share.js";
import { fmtText, fmtUsd } from "../../util.js";

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function modelName(models, id) {
  const model = models.find((m) => m.id === id);
  return model ? model.name : id;
}

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** The reveal panel for an answered question, real C60 values only. */
function revealPanel(question, models, wasCorrect) {
  const nameA = modelName(models, question.optionA);
  const nameB = modelName(models, question.optionB);
  const reveal = question.revealData;
  const verdict = el("p", {
    className: "game-verdict",
    textContent: wasCorrect ? "Correct!" : "Not quite.",
  });
  const lines =
    reveal.field !== undefined
      ? [
          el("p", { textContent: reveal.field }),
          el("p", { textContent: `${nameA}: ${fmtText(reveal.valueA)}` }),
          el("p", { textContent: `${nameB}: ${fmtText(reveal.valueB)}` }),
        ]
      : [
          el("p", { textContent: `Budget: ${fmtUsd(reveal.budget)}/mo` }),
          el("p", {
            className: "cost-formula",
            textContent: `${nameA}: ${reveal.formulaA}`,
          }),
          el("p", {
            className: "cost-formula",
            textContent: `${nameB}: ${reveal.formulaB}`,
          }),
        ];
  return el("div", { className: "game-reveal" }, [verdict, ...lines]);
}

export function render(state, todayUtc = currentUtcDate()) {
  const { models } = state.data;
  const section = el("section", { className: "view-daily" }, [
    el("h2", { textContent: "Daily" }),
  ]);
  const body = el("div", { className: "game-body" });
  section.append(body);

  // Pre-launch (C76): a notice, no questions, no storage writes.
  if (todayUtc < LAUNCH_DATE) {
    body.append(
      el("p", {
        className: "muted",
        textContent:
          `The daily challenge starts on ${LAUNCH_DATE}. Come back then.`,
      })
    );
    return section;
  }

  const stored = getDailyRecord(todayUtc);
  if (stored !== null && stored.completed) {
    showResults(stored);
    return section;
  }

  const questions = generateDaily(dailySeed(todayUtc), state.data);
  if (questions.length === 0) {
    body.append(
      el("p", {
        className: "muted",
        textContent: "No daily questions can be built from today's data.",
      })
    );
    return section;
  }

  const ids = questions.map((q) => q.id);
  const resumable = stored !== null && sameIds(stored.questionIds, ids);
  const record = resumable
    ? { ...stored, picks: [...stored.picks], correct: [...stored.correct] }
    : { questionIds: ids, picks: [], correct: [], completed: false };
  let index = record.picks.length;

  if (index >= questions.length) {
    // A full record that was never flagged complete still counts as a
    // finished play (C67): render results, never a replay.
    showResults(record);
    return section;
  }
  showQuestion();
  return section;

  function showQuestion() {
    const question = questions[index];
    const cards = el("div", { id: "game-cards", className: "glass" });
    for (const [pick, optionId] of [question.optionA, question.optionB]
      .entries()) {
      const card = el("button", {
        type: "button",
        textContent: modelName(models, optionId),
      });
      card.dataset.index = String(pick);
      card.addEventListener("click", () => answer(pick, card, cards));
      cards.append(card);
    }
    body.replaceChildren(
      el("p", {
        className: "game-progress muted",
        textContent: `Question ${index + 1} of ${questions.length}`,
      }),
      el("p", { className: "game-prompt", textContent: question.prompt }),
      cards
    );
  }

  function answer(pick, card, cards) {
    const question = questions[index];
    const wasCorrect = pick === question.correctIndex;
    record.picks.push(pick);
    record.correct.push(wasCorrect);
    record.completed = record.picks.length === questions.length;
    saveDailyRecord(todayUtc, record);

    for (const button of cards.querySelectorAll("button")) {
      button.disabled = true;
    }
    card.dataset.picked = "true";
    const next = el("button", {
      type: "button",
      className: "game-next",
      textContent: record.completed ? "See results" : "Next question",
    });
    next.addEventListener("click", () => {
      if (record.completed) {
        showResults(record);
      } else {
        index += 1;
        showQuestion();
      }
    });
    body.append(revealPanel(question, models, wasCorrect), next);
  }

  function showResults(finished) {
    const total = finished.correct.length;
    const score = finished.correct.filter(Boolean).length;
    const shareText = buildShareString(finished, todayUtc);
    const squares = el(
      "div",
      { className: "game-squares" },
      finished.correct.map((wasCorrect) =>
        el("span", { textContent: wasCorrect ? "\u{1F7E9}" : "\u{1F7E5}" })
      )
    );
    const copy = el("button", {
      type: "button",
      className: "game-copy",
      textContent: "Copy result",
    });
    copy.addEventListener("click", async () => {
      if (await copyShareString(shareText)) {
        copy.textContent = "Copied";
        copy.dataset.copied = "true";
      }
    });
    body.replaceChildren(
      el("div", { id: "game-results", className: "glass" }, [
        el("p", {
          className: "game-score",
          textContent: `You got ${score}/${total} right.`,
        }),
        squares,
        el("pre", { className: "game-share", textContent: shareText }),
        copy,
      ])
    );
  }
}
