// Daily mode view (W8.S2: C61, C67, C71, C72, C76). Pure render per the
// W2.S3 contract: render(state) -> HTMLElement via the global document,
// state = { route, data } with the full artifact, and the view never loads
// data itself. The optional second parameter injects the UTC date for
// tests; it defaults to the current UTC date. Persistence goes through the
// storage module only (C65): answers are recorded as the player
// progresses via saveDailyRecord upserts, and once the date's record is
// complete the view renders the results screen instead of a replay (C67).

import { dailySeed, generateDaily } from "../questions.js";
import { STAT_REVEAL, revealParagraphs } from "../reveal.js";
import { getBestStreak, getDailyRecord, saveDailyRecord } from "../storage.js";
import {
  LAUNCH_DATE,
  buildShareString,
  copyShareString,
  dayNumber,
} from "../share.js";
import { fmtUsd } from "../../util.js";

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whole hours and minutes until the next UTC midnight, when the daily
 * rolls over. Read once at render from the injected clock: the results
 * screen states the wait, it does not tick (no timers, no re-render).
 */
function timeToNextDaily(now) {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  const remainingMs = nextUtcMidnight - now.getTime();
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
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

/**
 * The reveal panel for an answered question, real C60 values only. Labels,
 * value formatting, and the verbatim formula lines come from the shared
 * reveal module (W10.S2), so daily and endless render the same reveal.
 */
function revealPanel(question, models, wasCorrect) {
  const verdict = el("p", {
    className: `game-verdict ${wasCorrect ? "verdict-correct" : "verdict-wrong"}`,
    textContent: wasCorrect ? "Correct!" : "Not quite.",
  });
  const name = (id) => modelName(models, id);
  return el("div", { className: "game-reveal" }, [
    verdict,
    ...revealParagraphs(question, name),
  ]);
}

export function render(state, todayUtc = currentUtcDate(), now = new Date()) {
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

    // Honest answer states (W11.S3): the correct card carries the accent
    // outline class, the chosen card the pressed-state class, and both
    // cards reveal their real value inline where the eye already is.
    const buttons = [...cards.querySelectorAll("button")];
    const values = cardValues(question);
    buttons.forEach((button, i) => {
      button.disabled = true;
      button.append(
        el("span", { className: "card-value", textContent: values[i] })
      );
    });
    buttons[question.correctIndex].classList.add("card-correct");
    card.classList.add("card-picked");
    if (!wasCorrect) card.classList.add("card-wrong");
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
    // On-screen squares are token-colored elements (STEP 3); the emoji
    // squares remain the share format only, built by share.js (C68).
    const squares = el(
      "div",
      { className: "game-squares" },
      finished.correct.map((wasCorrect) => {
        const square = el("span", { role: "img" });
        square.dataset.correct = String(wasCorrect);
        square.setAttribute("aria-label", wasCorrect ? "correct" : "wrong");
        return square;
      })
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
    // The day number is the headline: this play belongs to a dated run
    // everyone else played too. The squares carry the story, the share
    // string sits quiet beneath them as the copy source (C72).
    const best = getBestStreak();
    const results = el("div", { id: "game-results", className: "glass" }, [
      el("h3", {
        className: "game-day",
        textContent: `Frontier #${dayNumber(todayUtc)}`,
      }),
      el("p", {
        className: "game-score",
        textContent: `You got ${score}/${total} right.`,
      }),
      squares,
    ]);
    // The streak belongs to endless. It earns a line here only once the
    // player has one: "Best streak: 0" is noise to a daily-only player.
    if (best > 0) {
      results.append(
        el("p", { className: "game-best muted", textContent: `Best streak: ${best}` })
      );
    }
    results.append(
      el("p", {
        className: "game-next-daily muted",
        textContent: `Next daily in ${timeToNextDaily(now)}.`,
      }),
      el("pre", { className: "game-share muted", textContent: shareText }),
      copy
    );
    body.replaceChildren(results);
  }
}
