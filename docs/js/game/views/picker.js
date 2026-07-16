// Game mode picker (W7.S1, C70; W11.S3, C65). Pure render per the W2.S3
// contract: render(state) -> HTMLElement via the global document, state =
// { route, data } with the full artifact, and the view never fetches. The
// two mode links are plain hash anchors, so navigation flows through the
// router exactly like every other view (C28). Each mode renders as a
// .card block carrying the mode name, one line of rules copy, and the
// player's current stats, read only through the storage module (today's
// daily completion state, best endless streak); reads degrade gracefully
// to the fresh defaults and rendering never writes. The optional second
// parameter injects the UTC date for tests, computed the same way
// daily.js computes it.

import { getBestStreak, getDailyRecord } from "../storage.js";
import { LAUNCH_DATE, dayNumber } from "../share.js";

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function dailyStat(todayUtc) {
  // Before launch the route behind this card renders the C76 notice, so
  // the card says the same thing rather than offering a play.
  if (todayUtc < LAUNCH_DATE) return `Starts ${LAUNCH_DATE}.`;
  const record = getDailyRecord(todayUtc);
  if (record === null) return "Not played today.";
  if (record.completed) {
    const total = record.correct.length;
    const right = record.correct.filter(Boolean).length;
    return `Done today: ${right}/${total}.`;
  }
  return (
    `In progress: ${record.picks.length} of ` +
    `${record.questionIds.length} answered.`
  );
}

export function render(state, todayUtc = currentUtcDate()) {
  const modes = [
    [
      "Daily",
      "#/game/daily",
      "Ten questions, the same set for everyone each UTC day.",
      dailyStat(todayUtc),
    ],
    [
      "Endless",
      "#/game/endless",
      "Keep answering; a wrong pick resets your streak, not the run.",
      `Best streak: ${getBestStreak()}.`,
    ],
  ];

  const section = document.createElement("section");
  section.className = "view-picker";

  const heading = document.createElement("h2");
  heading.textContent = "Game";

  const intro = document.createElement("p");
  intro.className = "muted";
  intro.textContent = "Two models, one question. Pick a mode to play.";

  const list = document.createElement("ul");
  list.className = "game-modes";
  for (const [label, href, blurb, stat] of modes) {
    const item = document.createElement("li");
    item.className = "card";
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = blurb;
    const stats = document.createElement("p");
    stats.className = "game-mode-stat muted";
    stats.textContent = stat;
    item.append(link, note, stats);
    // The daily is a dated run: name it here exactly as the results
    // screen headlines it, so the two screens agree. A run that has not
    // started has no number to name.
    if (href === "#/game/daily" && todayUtc >= LAUNCH_DATE) {
      const day = document.createElement("p");
      day.className = "game-mode-day muted";
      day.textContent = `Frontier #${dayNumber(todayUtc)}`;
      item.insertBefore(day, stats);
    }
    list.append(item);
  }

  section.append(heading, intro, list);
  return section;
}
