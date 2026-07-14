// Entry point (W4.S1, finalizing W2.S3). Performs the single data fetch per
// C13/C29, wires the hash router to the real view modules, and renders into
// the #app and #site-header mounts. Views stay pure (state) -> DOM; every
// event wired here delegates to them or to the router:
// - catalog row clicks toggle the compare selection via compare.js's pure
//   toggleCompareId (3-model cap enforced there, C32);
// - compare-tray remove buttons (data-action="compare-remove") drop a model
//   and re-render through the hash so compare URLs stay shareable (C28);
// - the model overlay opens via #/model/:id links over the live catalog
//   (W5.S3): the catalog renders beneath, an .overlay-scrim div sits between
//   them, and the overlay closes via an injected Close button
//   (data-action="overlay-close"), a click on the scrim, or the Escape key;
// - scenario form submission reads the W3.S4 form (empty controls map to
//   null, never a default, C19) and navigates via the router's toHash.
// W7.S1 adds the three game routes (picker, daily, endless) to the same
// VIEWS dispatch plus a Game link in #site-header; game views receive
// question data only through the artifact in state, so this stays the
// single fetch site (C70, C29, C13).

import { parseHash, toHash } from "./router.js";
import { render as renderCatalog } from "./views/catalog.js";
import { render as renderModel } from "./views/model.js";
import {
  render as renderCompare,
  toggleCompareId,
  MAX_COMPARE,
} from "./views/compare.js";
import { render as renderScenario } from "./views/scenario.js";
import { render as renderPicker } from "./game/views/picker.js";
import { render as renderDaily } from "./game/views/daily.js";
import { render as renderEndless } from "./game/views/endless.js";

const VIEWS = {
  catalog: renderCatalog,
  model: renderModel,
  compare: renderCompare,
  scenario: renderScenario,
  picker: renderPicker,
  daily: renderDaily,
  endless: renderEndless,
};

const NAV_LINKS = [
  ["Catalog", "#/catalog"],
  ["Compare", "#/compare"],
  ["Scenario", "#/scenario"],
];

let data = null;
let compareIds = [];

function compareHash() {
  return toHash({ view: "compare", ids: compareIds });
}

function renderHeader() {
  const header = document.querySelector("#site-header");
  if (!header) return;
  let nav = header.querySelector("nav");
  if (!nav) {
    nav = document.createElement("nav");
    header.append(nav);
  }
  nav.replaceChildren(
    ...NAV_LINKS.map(([label, href]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      link.dataset.nav = label.toLowerCase();
      return link;
    })
  );
  // The Game entry point (W7.S1, C70) sits beside the nav as a direct
  // #site-header child: the w4s1 suite pins "#site-header nav a" to the
  // three step 1 links, so the game link must not join that list.
  if (!header.querySelector('a[data-nav="game"]')) {
    const game = document.createElement("a");
    game.href = "#/game";
    game.textContent = "Game";
    game.dataset.nav = "game";
    header.append(game);
  }
}

// The Compare nav link carries the current selection so navigating to it
// reproduces the tray from the hash (C28).
function updateCompareLink() {
  const link = document.querySelector('#site-header a[data-nav="compare"]');
  if (link) link.href = compareHash();
}

// Reflect the compare selection on catalog rows for event delegation and
// assistive tech; rows come from the pure catalog render.
function markCatalogSelection() {
  for (const row of document.querySelectorAll("#app tr[data-model-id]")) {
    const selected = compareIds.includes(row.dataset.modelId);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  }
}

// The overlay itself is pure (W3.S2); the close control is wiring, so it is
// injected here rather than rendered by the view.
function injectOverlayClose() {
  const overlay = document.querySelector("#model-overlay");
  if (!overlay) return;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ghost";
  close.dataset.action = "overlay-close";
  close.textContent = "Close";
  overlay.prepend(close);
}

// The dim layer between the catalog and the overlay (W5.S3). It carries the
// same data-action as the Close button so the one #app click delegate also
// closes the overlay on a scrim click.
function overlayScrim() {
  const scrim = document.createElement("div");
  scrim.className = "overlay-scrim";
  scrim.dataset.action = "overlay-close";
  return scrim;
}

function renderRoute() {
  const app = document.querySelector("#app");
  if (!app || data === null) return;
  const route = parseHash(window.location.hash);
  if (route.view === "compare") {
    // The hash is the source of truth for the tray (C28, C32).
    compareIds = route.ids.slice(0, MAX_COMPARE);
  }
  if (route.view === "model") {
    // The overlay floats over the live catalog (W5.S3): catalog beneath,
    // scrim between, overlay on top, in that DOM order.
    app.replaceChildren(
      VIEWS.catalog({ route: { view: "catalog" }, data }),
      overlayScrim(),
      VIEWS.model({ route, data })
    );
    injectOverlayClose();
    markCatalogSelection();
  } else {
    app.replaceChildren(VIEWS[route.view]({ route, data }));
    if (route.view === "catalog") markCatalogSelection();
  }
  updateCompareLink();
}

function navigate(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
  // Render immediately; the hashchange re-render is idempotent.
  renderRoute();
}

// Scenario form reading (W3.S4 contract): control names match the router's
// scenario query keys, so the raw values round through the router itself.
// parseHash normalizes every empty or invalid control to null (never 0 or
// any default, C19) and toHash canonicalizes the shareable hash (C28); the
// router stays the single owner of scenario input semantics.
function scenarioFormHash(form) {
  const params = new URLSearchParams();
  for (const name of ["budget", "task", "in", "out", "minCtx", "after", "before"]) {
    const value = form.elements.namedItem(name).value.trim();
    if (value !== "") params.set(name, value);
  }
  if (form.elements.namedItem("open").checked) params.set("open", "1");
  return toHash(parseHash("#/scenario?" + params.toString()));
}

function onAppClick(event) {
  const remove = event.target.closest('[data-action="compare-remove"]');
  if (remove) {
    compareIds = toggleCompareId(compareIds, remove.dataset.modelId);
    navigate(compareHash());
    return;
  }
  if (event.target.closest('[data-action="overlay-close"]')) {
    navigate("#/catalog");
    return;
  }
  if (parseHash(window.location.hash).view !== "catalog") return;
  if (event.target.closest("a")) return; // model links keep native behavior
  const row = event.target.closest("tr[data-model-id]");
  if (!row) return;
  compareIds = toggleCompareId(compareIds, row.dataset.modelId);
  markCatalogSelection();
  updateCompareLink();
}

function onAppSubmit(event) {
  const form = event.target.closest("#scenario-form");
  if (!form) return;
  event.preventDefault();
  navigate(scenarioFormHash(form));
}

function onKeydown(event) {
  if (event.key !== "Escape") return;
  if (parseHash(window.location.hash).view === "model") {
    navigate("#/catalog");
  }
}

function renderLoadError(message) {
  const app = document.querySelector("#app");
  if (!app) return;
  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "Could not load model data: " + message;
  app.replaceChildren(note);
}

async function init() {
  renderHeader();
  try {
    const response = await fetch("data/models.json");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    data = await response.json();
  } catch (err) {
    renderLoadError(err.message);
    return;
  }
  const app = document.querySelector("#app");
  if (app) {
    app.addEventListener("click", onAppClick);
    app.addEventListener("submit", onAppSubmit);
  }
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

init();
