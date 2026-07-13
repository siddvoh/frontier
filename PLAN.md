# PLAN.md: Frontier build plan

Derived from SPEC.md (criteria C1 through C54). Slices are grouped into waves;
slices in the same wave are independent, never write the same path, and depend
only on earlier waves. Every slice names its own test file.

Standing rules for every slice (from SPEC):

- Never create, edit, or "fix" `data/curated.json`, `data/events.json`, or
  `data/curated-sources.md` (C10, C11). If they are invalid, fail loudly and
  record the blockage in AGENT_NOTES.md.
- No runtime dependencies, ever (C5). devDependencies limited to vitest,
  jsdom, playwright, optionally ajv (C6).
- No stat value is ever defaulted, estimated, or imputed; null stays null
  (C19). No `?? 0`, `|| 0`, or `Math.random` in `scripts/` or `docs/js/`.
- No `.skip`, `.todo`, or empty test bodies (C50).
- Per C7 and C54, no file under `tests/` may contain the strings
  "screenshot", "shots", or "playwright" (this includes the W4.S3 test file).
- All `docs/` asset paths relative; the only absolute URL in `docs/` is the
  C35 attribution link to https://epoch.ai (C2).
- Test fixtures live under a per-slice directory `tests/fixtures/<slice>/` so
  same-wave slices never collide on fixture paths (C48).
- Any slice touching docs/css or a docs/js/views file must run `npm run
  shots` after the change and visually inspect the relevant PNGs in shots/
  before flipping its box: a layout defect visible in a screenshot means the
  slice is NOT done, even if npm test is green. The test gate itself is
  untouched: playwright stays out of npm test (C7, C54).

## Wave 1: foundation (runnable skeleton, tokens, validator, fetch)

- [x] W1.S1 | files: package.json, .gitignore, docs/index.html, docs/js/main.js, tests/w1s1.test.js | repo scaffold with static index shell plus npm scripts
  - package.json has `"type": "module"`, test script exactly `"test": "vitest run --passWithNoTests"`, scripts fetch/build/validate/shots exactly as specified, no `dependencies` key, devDependencies limited to vitest, jsdom, playwright, ajv (C3, C4, C5, C6); test asserts all of these by reading package.json
  - docs/index.html: `lang` attribute, a `title`, exactly one `h1`, footer containing "Epoch AI", "CC-BY 4.0", and a link to https://epoch.ai; mount points `#site-header`, `#app`; only relative `src`/`href` asset paths, asserted by test (C35, C2, part of C1)
  - .gitignore contains `shots/` and `node_modules/` (C8; verified by critic grep, not by a test, per the C54 string ban)
  - Done means: `npm ci && npm test` exits 0 with at least one passing assertion, and `python3 -m http.server` from docs/ serves the shell page (wave 1 runnable-skeleton gate)
- [x] W1.S2 | files: docs/css/tokens.css, docs/css/styles.css, tests/w1s2.test.js | design tokens plus base stylesheet with parity, contrast, motion tests
  - tokens.css declares the exact C37 light values in `:root` and the exact dark values in a single `@media (prefers-color-scheme: dark)` block; test parses the file and asserts the eight theme names appear in both blocks and only there, theme-independent tokens (fonts, sizes, spacing, radii, `--dur`, `--blur`) only in `:root` (C37, C38)
  - Test computes WCAG relative-luminance ratios from parsed tokens: `--ink`, `--muted`, `--accent` each >= 4.5:1 against `--surface-solid` and `--bg` in both themes (C39)
  - styles.css: every font-size uses `var(--text-*)` from the six C40 tokens, line heights via `--lh-body`/`--lh-head`, no webfont; every margin/padding/gap is a spacing token, `0`, or `auto`; every border-radius is `--r-s` or `--r-m`; no `gradient(`; raw colors only in tokens.css (C40, C41, C42, C36)
  - styles.css defines `.glass`: base rule `background: var(--surface-solid)` with the single `box-shadow: var(--shadow-glass)` declaration, all `backdrop-filter` inside one `@supports (backdrop-filter: blur(12px))` block; exactly one `--dur: 150ms` token with `ease-out`, one `@media (prefers-reduced-motion: reduce)` block setting `--dur: 0ms`; only width media query is `@media (min-width: 720px)`; test greps for all of these (C44, C45, C46, C47)
- [x] W1.S3 | files: scripts/validate.js, tests/fixtures/w1s3/, tests/w1s3.test.js | schema validator for curated, events, artifact
  - Validates data/curated.json (schema 12.2), data/events.json (schema 12.3), and docs/data/models.json (schemas 12.1, 12.4) exactly; exits nonzero on any violation and prints every violation found (C17)
  - Cross checks: every events `modelIds` entry is an existing model id, model ids unique, models sorted by id, attribution string exact (12.3, 12.4, C16)
  - Test feeds invalid fixtures (bad id pattern, missing required key, negative price, unknown modelId) and asserts nonzero exit per case; skips the artifact check gracefully only when docs/data/models.json does not exist yet, otherwise validates it (C17, C10 fail-loud path)
  - `npm run validate` against the committed real curated.json and events.json exits 0 (C10, C11); this slice reads but never writes those files
- [x] W1.S4 | files: scripts/fetch-epoch.js, scripts/lib/csv.js, data/epoch-columns.json, tests/w1s4.test.js | epoch fetch script, CSV parser, column map
  - scripts/fetch-epoch.js downloads https://epoch.ai/data/notable_ai_models.csv to data/epoch_notable_ai_models.csv, overwriting the snapshot; not run in tests, no network in `npm test` (C9, C49)
  - scripts/lib/csv.js parses quoted CSV with a header row; test parses the committed data/epoch_notable_ai_models.csv and asserts a header row plus at least one data row (C9)
  - data/epoch-columns.json maps the logical enrichment fields (model name, release date, parameters, training compute, organization) to exact Epoch CSV header strings; test asserts every mapped header exists in the committed CSV (C12)

## Wave 2: pipeline, engine, routing core

- [x] W2.S1 | files: scripts/merge.js, tests/fixtures/w2s1/, tests/w2s1.test.js | merge pipeline emitting the models.json artifact
  - Reads curated.json (master), events.json, the Epoch CSV via scripts/lib/csv.js, and data/epoch-columns.json; writes exactly one artifact docs/data/models.json with `generatedAt`, the exact attribution string, `models` sorted by id, `events` verbatim (C13, C16, C18)
  - Join semantics tested with fixtures: exact case-sensitive `epochName` match, unmatched Epoch rows ignored, curated wins on conflict, only mapped enrichment fields copied; `sources` tags truthful per field, key present iff field non-null (C14, C15)
  - Fixture CSV missing a mapped column makes merge exit nonzero; no quoted Epoch header string appears in merge.js (C12)
  - Null-in null-out property test on every nullable stat field; determinism test runs merge twice and diffs byte-identical output except `generatedAt`; no `?? 0` or `|| 0` on stat fields (C19, C18)
  - After this slice `npm run build && npm run validate` exits 0 against the committed data
- [x] W2.S2 | files: docs/js/engine.js, tests/w2s2.test.js | scenario engine pure functions
  - Exports the C22 input typedef via JSDoc; no DOM, no fetch, no globals, imports nothing outside docs/js/ (C22)
  - Cost formula exact per C23, computable only when both prices non-null; qualification per C24 with unit tests covering each exclusion independently; excluded models carry the six machine-readable C27 reasons
  - Ranking per task with the full four-step tie-break, tested with exact-tie fixtures for a total deterministic order (C25); null-field models excluded from any computation needing that field, never substituted (C21, C19)
  - Each result exposes `{ inputCost, outputCost, totalCost, formula }` with the exact C26 string format, asserted verbatim against a hand-computed fixture (C26)
- [x] W2.S3 | files: docs/js/router.js, docs/js/util.js, docs/js/main.js, docs/js/views/catalog.js, docs/js/views/model.js, docs/js/views/compare.js, docs/js/views/scenario.js, tests/w2s3.test.js | hash router, MISSING constant, stub views wired in main
  - router.js parses `#/catalog` (default and empty hash), `#/model/:id`, `#/compare?ids=a,b,c`, `#/scenario?...` into a route state object; unknown routes resolve to catalog; compare and scenario state round-trips through the hash; jsdom tests per route including unknown (C28)
  - util.js exports the single constant `MISSING` (the em dash) plus shared formatters; this is the only definition in docs/js/ (C20)
  - main.js performs the single relative `fetch("data/models.json")` and dispatches route changes to view modules; views are pure `(state) -> DOM` functions, stubbed here with minimal render output so the site runs end to end (C29, C13)
  - Test renders each stub view under jsdom without fetch and asserts main.js is the only fetch site (C29, C2)

## Wave 3: views (each rewrites its own Wave 2 stub)

- [x] W3.S1 | files: docs/js/views/catalog.js, docs/js/views/timeline.js, tests/w3s1.test.js | catalog view with filters, sorting, timeline strip
  - One row per model with name, organization, release date, both prices, context window, GPQA Diamond, SWE-bench Verified, open/closed weights; nulls render the MISSING constant (C30, C20)
  - Filters: organization multi-select, open-weights toggle, free-text name; sorts on release date, either price, context window, both benchmarks with nulls last in both directions; jsdom test per filter and per null-last sort (C30)
  - timeline.js: horizontally scrollable strip, x linear from 2023-03-01 to `generatedAt`, dots labeled by name at releaseDate, null-date models omitted, event markers use the accent token, dot click navigates to `#/model/:id`, marker click reveals title and body; pure HTML/CSS positioning, no canvas or SVG; test asserts computed left offsets for fixture dates and null-date omission (C34)
  - Every form control in the view has an associated label (C35)
- [x] W3.S2 | files: docs/js/views/model.js, tests/w3s2.test.js | model card overlay with provenance and events
  - `#model-overlay` renders all record fields, visible "Epoch" / "curated" provenance tags per enriched field from `sources`, and the Epoch enrichment values (C31)
  - Renders every event whose `modelIds` includes the model as date, title, body (C31)
  - jsdom test uses a fixture model having both events and null fields; nulls render the MISSING constant, no dash literal in the renderer (C31, C20)
- [x] W3.S3 | files: docs/js/views/compare.js, tests/w3s3.test.js | compare view with proportional bars
  - Compare tray (`#compare-tray`) holds 2 or 3 catalog selections; selecting a 4th is impossible, asserted by test (C32)
  - `#/compare` renders exactly five bar groups: input price, output price, context window, GPQA Diamond, SWE-bench Verified; bars are plain divs, widths proportional with the compared max at 100 percent (C32)
  - Null value renders a MISSING row with no bar; jsdom tests assert bar count, proportional widths from fixtures, null handling, the 3-model cap (C32, C20)
- [x] W3.S4 | files: docs/js/views/scenario.js, tests/w3s4.test.js | scenario form with ranked results
  - Form exposes every C22 input (budget, task, both volumes, all four constraints), each control labeled (C33, C35)
  - Results list (`#scenario-results`) shows rank, model name, ranking-field value, computed cost with the exact C26 formula string, plus context window for longdoc (C33)
  - Collapsed section lists excluded models with their C27 reason; jsdom test drives a fixture dataset through the form-state render and asserts qualifying order, formula string, exclusion reasons (C33)

## Wave 4: integration, automation, harness

- [x] W4.S1 | files: docs/js/main.js, tests/w4s1.test.js | final wiring, glass scoping, whole-suite audit
  - main.js wires the real views, compare-tray selection events, model-overlay open/close, scenario form submission; still the single fetch site (C29)
  - jsdom test renders each view and asserts every element carrying `.glass` is one of `#site-header`, `#compare-tray`, `#scenario-results`, `#model-overlay`, and that `--surface-glass` and `backdrop-filter` appear only in the `.glass` rules (C43)
  - Suite-completeness assertions: pipeline, engine, router, every view, token parity, contrast, and glass suites all exist under tests/; no `.skip(` or `.todo(` anywhere in tests/; docs/ contains no absolute-path or http reference except the C35 link, and no game/puzzle/streak/score identifiers or copy (C48, C50, C2, section 1, done-item 7)
  - Done means: from a fresh clone, `npm ci && npm run build && npm run validate && npm test` all exit 0 offline, and serving docs/ locally renders all four routes with the committed data (C49, done-items 1 and 3)
- [x] W4.S2 | files: .github/workflows/ci.yml, .github/workflows/refresh.yml, tests/w4s2.test.js | CI workflow plus nightly refresh workflow
  - ci.yml runs `npm ci`, `npm run validate`, `npm test` on every push to main (C52)
  - refresh.yml: `schedule` cron nightly plus `workflow_dispatch`; steps in order checkout, setup-node, `npm ci`, `npm run fetch`, `npm run build`, `npm run validate`, `npm test`, then a commit-and-push step limited to data/epoch_notable_ai_models.csv and docs/data/models.json, guarded by a git diff check; declares `permissions: contents: write`; default GITHUB_TOKEN only; never touches curated.json or events.json (C51)
  - tests/w4s2.test.js parses both YAML files and asserts trigger types, step order, the permissions block, and the diff guard, without ever containing the C54 banned strings (C51, C52)
- [x] W4.S3 | files: scripts/screenshot.js, tests/w4s3.test.js | playwright screenshot harness outside all gates
  - scripts/screenshot.js serves docs/ on a local port, then for `#/catalog`, `#/model/:id` (a committed id), `#/compare?ids=` (two committed ids), `#/scenario`, at 375x812 and 1440x900, in light and dark colorScheme, writes `{route-slug}-{width}x{height}-{theme}.png`, 16 PNGs total, no assertions, exits 0 (C53)
  - Verified by execution only: `npx playwright install chromium && npm run shots` exits 0 and the output directory holds exactly 16 PNGs (C53, done-item 4)
  - By construction the harness is referenced by no test file and no workflow, and tests/ contains none of the banned strings; the critic grep for C7 and C54 passes
  - tests/w4s3.test.js covers adjacent hygiene without the banned strings: `docs/` contains no `gradient(`, no `@font-face`, no `fonts.googleapis`, no `.woff`, no `node_modules` reference, and `Math.random` appears nowhere in scripts/ or docs/js/ (C42, C40, C5, C19)

## Wave 5: visual defect remediation (from 2026-07-13 screenshot + live-UI audit)

Defects diagnosed by running `npm run shots`, inspecting all 16 PNGs, and
driving the served site with a real browser. Dark mode was explicitly
compared against light across all four routes: the PNGs differ correctly
(dark tokens apply), so there is no dark-mode defect slice. W5.S1 defines
the CSS class contract (class names listed in its bullets); the view slices
emit those class names in markup. Each slice's own tests are independently
runnable under jsdom without S1's CSS; the combined visual result is
verified by the standing shots rule and the critic. All six slices are
file-disjoint.

- [ ] W5.S1 | files: docs/css/styles.css, tests/w5s1.test.js | stylesheet remediation: motion scoping, token-styled controls, layout classes for all views
  - Motion: transitions exist only for `color` and `border-color` on links and form controls; the `button` opacity transition and `tbody tr` background transition are removed (they read as flicker on hover and re-render); the single `--dur`/`ease-out` and reduced-motion rules of C46 stay intact
  - Form controls stop looking user-agent-default: inputs, selects, textareas, buttons, and checkboxes are styled from tokens only (background `--surface-solid`, text `--ink`, hairline borders, radius tokens, accent-colored `:focus-visible` ring, primary button in `--accent`); C36 grep still finds no raw colors outside tokens.css
  - New layout classes, consumed by the view slices: `.table-scroll` (overflow-x auto wrapper so the page body NEVER scrolls horizontally at 375px), `.filter-bar` (single-row control grid at >=720px, stacked below), `.nowrap` (dates), `.bar-row` 3-column grid (name / bar / value, aligned), `.tray-docked` (compare tray: bottom sheet below 720px, right-docked panel >=720px, plus a main-content clearance rule so the tray never covers bars), `.overlay-scrim` (fixed full-viewport dim layer under `#model-overlay`: `background: var(--ink)` with an opacity property, no new tokens, no new glass), `.timeline-track` with two label lanes and a hairline axis
  - All W1.S2 checks keep passing unweakened: token-only sizes/spacing/radii, no `gradient(`, `box-shadow` and `backdrop-filter` counts unchanged, only width media query `min-width: 720px` (C36, C40, C41, C42, C43, C44, C45, C46, C47)
- [ ] W5.S2 | files: docs/js/views/timeline.js, tests/w5s2.test.js | timeline dot layout: clamped labels, collision lanes, visible markers
  - Root defect: six 2026-era dots and both event markers compute to left 97-100 percent and render past the strip's right edge (measured x about 3100px in a 1014px strip), five of them at the identical x; the strip shows only the GPT-4 label
  - Keep the exact C34 linear mapping from 2023-03-01 to `generatedAt`, but anchor labels so they stay inside the track (labels in the right half translate left of their dot), and assign colliding dots (within 2 percent of each other) to distinct stacked lanes so no two labels overlap
  - Event markers must be visible inside the track at their C34 positions and still reveal title and body on click; dot click still navigates to `#/model/:id` (C34)
  - jsdom test asserts: C34 offsets unchanged for fixture dates, no label's computed left+anchor extends past 100 percent, the five same-x fixtures get distinct lanes, and marker elements are present inside the track
- [ ] W5.S3 | files: docs/js/main.js, docs/js/views/model.js, tests/w5s3.test.js | model overlay over live catalog with scrim and readable values
  - Root defect: `#/model/:id` replaces the app content, so the "overlay" floats over an empty page with the footer showing through at the top; there is no dim layer behind the panel
  - main.js renders the catalog view beneath, then the overlay above it, at `#/model/:id`; an `.overlay-scrim` element sits between them; Close (and scrim click) returns to `#/catalog`; main.js stays the single fetch site (C29, C31)
  - model.js: definition list aligns label and value in two columns at >=720px; Parameters and Training compute render via locale/exponent formatting of the stored value (display formatting only, the value itself is never altered or defaulted, C19); nulls still render MISSING (C20)
  - jsdom test asserts: at the model route the app contains BOTH the catalog table and `#model-overlay`, the scrim element exists, formatted numbers appear (e.g. "1,800,000,000,000"), and existing W3.S2 provenance/events assertions keep passing (C31)
- [ ] W5.S4 | files: docs/js/views/catalog.js, tests/w5s4.test.js | catalog table containment and control layout
  - Root defect: the 731px-wide table sits directly in the view with no scroll container, so the whole page scrolls horizontally at 375px (document scrollWidth 748) and the sticky header appears cut off mid-page
  - Wrap the table in a `.table-scroll` container; release-date cells get `.nowrap` so dates stop wrapping to "2026-07-" / "09"; numeric columns get `font-variant-numeric: tabular-nums` via a class S1 provides
  - Filter controls emit `.filter-bar` markup in a deliberate order (search, organization, open-weights, sort, direction) instead of the current grid with orphaned cells and a floating checkbox (C30, C35 labels unchanged)
  - jsdom test asserts the wrapper class around the table, the nowrap class on date cells, the control order, and all existing W3.S1 filter/sort assertions keep passing (C30)
- [ ] W5.S5 | files: docs/js/views/compare.js, tests/w5s5.test.js | compare bars alignment and docked tray
  - Root defects: the fixed tray covers the GPQA and SWE-bench bar rows (hit-testing the tray's center finds a `.bar-row` under it) and sits mid-content on mobile; null rows render as run-on text "GPT-4—" with the dash glued to the label
  - Bar rows emit the `.bar-row` 3-column structure: name cell, bar cell, value cell as separate elements; a null metric renders name cell + MISSING in the value cell with an empty bar cell, never a concatenated string (C32, C20)
  - The tray emits `.tray-docked` markup: a collapsed one-line summary ("2 of 3 selected") that expands on toggle; 3-model cap and `#compare-tray` glass identity unchanged (C32, C43)
  - jsdom test asserts: name, bar, and value are sibling cells (no text run-ons), null rows have no bar element, the tray renders collapsed by default with a working toggle, and the 4th-selection cap still holds (C32)
- [ ] W5.S6 | files: docs/js/views/scenario.js, tests/w5s6.test.js | scenario form grid and honest empty state
  - Root defects: nine full-width stacked fields make a sparse wall at 1440px with a floating checkbox, and a summary line of em dashes ("Budget —/mo · task — · ...") renders before the user has entered anything
  - Form emits `.form-grid` markup: budget/task and the two volumes paired at >=720px, the four constraints grouped in a labeled fieldset, the checkbox inline with its label (C33, C35)
  - The scenario summary line renders only after a scenario has been run; the initial state shows just the prompt box; results and exclusion sections unchanged (C33)
  - jsdom test asserts: fieldset grouping and pairing classes present, no summary element on initial render, summary present after a run, and all W3.S4 ranking/formula/exclusion assertions keep passing (C33, C26, C27)

## Criterion-to-slice map (audit)

| Criteria | Slice |
|---|---|
| C1, C3, C4, C5, C6, C8, C35 (shell) | W1.S1 |
| C2 | W1.S1, re-audited W4.S1 |
| C36, C37, C38, C39, C40, C41, C42, C44, C45, C46, C47 | W1.S2 |
| C10, C11, C17, schemas 12.1-12.4 | W1.S3 |
| C9, C12 (map file) | W1.S4 |
| C12 (missing-column exit), C13, C14, C15, C16, C18, C19 (pipeline) | W2.S1 |
| C19 (engine), C21, C22, C23, C24, C25, C26, C27 | W2.S2 |
| C20, C28, C29 | W2.S3, finalized W4.S1 |
| C30, C34, C35 (labels) | W3.S1 |
| C31 | W3.S2 |
| C32 | W3.S3 |
| C33, C35 (labels) | W3.S4 |
| C43, C48, C49, C50, section 1 copy rule | W4.S1 |
| C51, C52 | W4.S2 |
| C7, C53, C54 | W4.S3 |

Wave-independence audit: no two same-wave slices write the same path
(docs/js/main.js is written in W1.S1, rewritten in W2.S3 and W4.S1, all in
different waves; view stubs from W2.S3 are each rewritten by exactly one
Wave 3 slice). Wave 1 ends runnable: static shell serves, `npm test` passes
with the W1 suites. Every slice's done state is a named test file plus
explicit criteria.

<!-- PLAN-READY -->
