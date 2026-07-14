// Game mode picker (W7.S1, C70). Pure render per the W2.S3 contract:
// render(state) -> HTMLElement via the global document, state = { route,
// data } with the full artifact, and the view never fetches. The two mode
// links are plain hash anchors, so navigation flows through the router
// exactly like every other view (C28).

const MODES = [
  [
    "Daily",
    "#/game/daily",
    "Ten questions, the same set for everyone each UTC day.",
  ],
  [
    "Endless",
    "#/game/endless",
    "Keep answering; a wrong pick resets your streak, not the run.",
  ],
];

export function render(state) {
  const section = document.createElement("section");
  section.className = "view-picker";

  const heading = document.createElement("h2");
  heading.textContent = "Game";

  const intro = document.createElement("p");
  intro.className = "muted";
  intro.textContent = "Two models, one question. Pick a mode to play.";

  const list = document.createElement("ul");
  list.className = "game-modes";
  for (const [label, href, blurb] of MODES) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = blurb;
    item.append(link, note);
    list.append(item);
  }

  section.append(heading, intro, list);
  return section;
}
