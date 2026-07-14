// Hash router (C28, C70). Pure functions: parseHash(hash) -> route state,
// toHash(state) -> hash string. Compare, scenario, and game state
// round-trips: parseHash(toHash(state)) deep-equals state. Unknown routes
// resolve to the catalog; unknown #/game/... sub-routes resolve to the
// game mode picker. No DOM access here; main.js owns the hashchange
// listener.

const TASKS = new Set(["coding", "reasoning", "longdoc"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseNum(raw) {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw) {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
}

function parseDate(raw) {
  return raw !== null && DATE_RE.test(raw) ? raw : null;
}

function parseTask(raw) {
  return raw !== null && TASKS.has(raw) ? raw : null;
}

function catalogRoute() {
  return { view: "catalog" };
}

function scenarioRoute(params) {
  return {
    view: "scenario",
    input: {
      budgetUsdPerMonth: parseNum(params.get("budget")),
      task: parseTask(params.get("task")),
      inputMTokPerMonth: parseNum(params.get("in")),
      outputMTokPerMonth: parseNum(params.get("out")),
      constraints: {
        openWeightsOnly: parseBool(params.get("open")),
        minContextTokens: parseNum(params.get("minCtx")),
        releasedOnOrAfter: parseDate(params.get("after")),
        releasedOnOrBefore: parseDate(params.get("before")),
      },
    },
  };
}

// Game routes (C70): #/game is the mode picker, #/game/daily and
// #/game/endless are the two modes, and only endless accepts ?seed=
// (an invalid or absent seed is null, never a default, matching every
// other query param here). Anything else under #/game/ is the picker.
function gameRoute(segments, params) {
  if (segments.length === 2 && segments[1] === "daily") {
    return { view: "daily" };
  }
  if (segments.length === 2 && segments[1] === "endless") {
    return { view: "endless", seed: parseNum(params.get("seed")) };
  }
  return { view: "picker" };
}

/**
 * Parse a location hash into a route state object.
 * @param {string} hash e.g. "#/model/gpt-4" or "" (empty -> catalog)
 * @returns {{view: string}} route state; unknown routes -> catalog
 */
export function parseHash(hash) {
  const raw = typeof hash === "string" ? hash : "";
  const stripped = raw.startsWith("#") ? raw.slice(1) : raw;
  const queryStart = stripped.indexOf("?");
  const path = queryStart === -1 ? stripped : stripped.slice(0, queryStart);
  const query = queryStart === -1 ? "" : stripped.slice(queryStart + 1);
  const segments = path.split("/").filter((s) => s !== "");

  if (segments.length === 0 || segments[0] === "catalog") {
    return catalogRoute();
  }
  if (segments[0] === "model" && segments.length === 2) {
    return { view: "model", id: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === "compare" && segments.length === 1) {
    const params = new URLSearchParams(query);
    const rawIds = params.get("ids");
    const ids =
      rawIds === null
        ? []
        : rawIds.split(",").map((s) => s.trim()).filter((s) => s !== "");
    return { view: "compare", ids };
  }
  if (segments[0] === "scenario" && segments.length === 1) {
    return scenarioRoute(new URLSearchParams(query));
  }
  if (segments[0] === "game") {
    return gameRoute(segments, new URLSearchParams(query));
  }
  return catalogRoute();
}

/**
 * Serialize a route state object back into a hash string.
 * parseHash(toHash(state)) deep-equals state for every valid state.
 * @param {{view: string}} state
 * @returns {string} hash beginning with "#/"
 */
export function toHash(state) {
  if (state.view === "model") {
    return "#/model/" + encodeURIComponent(state.id);
  }
  if (state.view === "compare") {
    const ids = state.ids.map((id) => encodeURIComponent(id)).join(",");
    return ids === "" ? "#/compare" : "#/compare?ids=" + ids;
  }
  if (state.view === "scenario") {
    const inp = state.input;
    const c = inp.constraints;
    const params = new URLSearchParams();
    if (inp.budgetUsdPerMonth !== null) {
      params.set("budget", String(inp.budgetUsdPerMonth));
    }
    if (inp.task !== null) params.set("task", inp.task);
    if (inp.inputMTokPerMonth !== null) {
      params.set("in", String(inp.inputMTokPerMonth));
    }
    if (inp.outputMTokPerMonth !== null) {
      params.set("out", String(inp.outputMTokPerMonth));
    }
    if (c.openWeightsOnly !== null) {
      params.set("open", c.openWeightsOnly ? "1" : "0");
    }
    if (c.minContextTokens !== null) {
      params.set("minCtx", String(c.minContextTokens));
    }
    if (c.releasedOnOrAfter !== null) params.set("after", c.releasedOnOrAfter);
    if (c.releasedOnOrBefore !== null) {
      params.set("before", c.releasedOnOrBefore);
    }
    const qs = params.toString();
    return qs === "" ? "#/scenario" : "#/scenario?" + qs;
  }
  if (state.view === "picker") {
    return "#/game";
  }
  if (state.view === "daily") {
    return "#/game/daily";
  }
  if (state.view === "endless") {
    return state.seed === null
      ? "#/game/endless"
      : "#/game/endless?seed=" + String(state.seed);
  }
  return "#/catalog";
}
