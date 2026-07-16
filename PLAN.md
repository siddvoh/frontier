# PLAN.md: Frontier build plan

Derived from SPEC.md (criteria C1 through C76; STEP 2 game criteria start
at C55). Slices are grouped into waves;
slices in the same wave are independent, never write the same path, and depend
only on earlier waves. Every slice names its own test file.

Standing rules for every slice (from SPEC):

- Never create, edit, or "fix" `data/curated.json`, `data/events.json`,
  `data/surprises.json`, or `data/curated-sources.md` (C10, C11, C55). If
  they are invalid, fail loudly and record the blockage in AGENT_NOTES.md.
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

- [x] W5.S1 | files: docs/css/styles.css, tests/w5s1.test.js | stylesheet remediation: motion scoping, token-styled controls, layout classes for all views
  - Motion: transitions exist only for `color` and `border-color` on links and form controls; the `button` opacity transition and `tbody tr` background transition are removed (they read as flicker on hover and re-render); the single `--dur`/`ease-out` and reduced-motion rules of C46 stay intact
  - Form controls stop looking user-agent-default: inputs, selects, textareas, buttons, and checkboxes are styled from tokens only (background `--surface-solid`, text `--ink`, hairline borders, radius tokens, accent-colored `:focus-visible` ring, primary button in `--accent`); C36 grep still finds no raw colors outside tokens.css
  - New layout classes, consumed by the view slices: `.table-scroll` (overflow-x auto wrapper so the page body NEVER scrolls horizontally at 375px), `.filter-bar` (single-row control grid at >=720px, stacked below), `.nowrap` (dates), `.bar-row` 3-column grid (name / bar / value, aligned), `.tray-docked` (compare tray: bottom sheet below 720px, right-docked panel >=720px, plus a main-content clearance rule so the tray never covers bars), `.overlay-scrim` (fixed full-viewport dim layer under `#model-overlay`: `background: var(--ink)` with an opacity property, no new tokens, no new glass), `.timeline-track` with two label lanes and a hairline axis
  - All W1.S2 checks keep passing unweakened: token-only sizes/spacing/radii, no `gradient(`, `box-shadow` and `backdrop-filter` counts unchanged, only width media query `min-width: 720px` (C36, C40, C41, C42, C43, C44, C45, C46, C47)
- [x] W5.S2 | files: docs/js/views/timeline.js, tests/w5s2.test.js | timeline dot layout: clamped labels, collision lanes, visible markers
  - Root defect: six 2026-era dots and both event markers compute to left 97-100 percent and render past the strip's right edge (measured x about 3100px in a 1014px strip), five of them at the identical x; the strip shows only the GPT-4 label
  - Keep the exact C34 linear mapping from 2023-03-01 to `generatedAt`, but anchor labels so they stay inside the track (labels in the right half translate left of their dot), and assign colliding dots (within 2 percent of each other) to distinct stacked lanes so no two labels overlap
  - Event markers must be visible inside the track at their C34 positions and still reveal title and body on click; dot click still navigates to `#/model/:id` (C34)
  - jsdom test asserts: C34 offsets unchanged for fixture dates, no label's computed left+anchor extends past 100 percent, the five same-x fixtures get distinct lanes, and marker elements are present inside the track
- [x] W5.S3 | files: docs/js/main.js, docs/js/views/model.js, tests/w5s3.test.js | model overlay over live catalog with scrim and readable values
  - Root defect: `#/model/:id` replaces the app content, so the "overlay" floats over an empty page with the footer showing through at the top; there is no dim layer behind the panel
  - main.js renders the catalog view beneath, then the overlay above it, at `#/model/:id`; an `.overlay-scrim` element sits between them; Close (and scrim click) returns to `#/catalog`; main.js stays the single fetch site (C29, C31)
  - model.js: definition list aligns label and value in two columns at >=720px; Parameters and Training compute render via locale/exponent formatting of the stored value (display formatting only, the value itself is never altered or defaulted, C19); nulls still render MISSING (C20)
  - jsdom test asserts: at the model route the app contains BOTH the catalog table and `#model-overlay`, the scrim element exists, formatted numbers appear (e.g. "1,800,000,000,000"), and existing W3.S2 provenance/events assertions keep passing (C31)
- [x] W5.S4 | files: docs/js/views/catalog.js, tests/w5s4.test.js | catalog table containment and control layout
  - Root defect: the 731px-wide table sits directly in the view with no scroll container, so the whole page scrolls horizontally at 375px (document scrollWidth 748) and the sticky header appears cut off mid-page
  - Wrap the table in a `.table-scroll` container; release-date cells get `.nowrap` so dates stop wrapping to "2026-07-" / "09"; numeric columns get `font-variant-numeric: tabular-nums` via a class S1 provides
  - Filter controls emit `.filter-bar` markup in a deliberate order (search, organization, open-weights, sort, direction) instead of the current grid with orphaned cells and a floating checkbox (C30, C35 labels unchanged)
  - jsdom test asserts the wrapper class around the table, the nowrap class on date cells, the control order, and all existing W3.S1 filter/sort assertions keep passing (C30)
- [x] W5.S5 | files: docs/js/views/compare.js, tests/w5s5.test.js | compare bars alignment and docked tray
  - Root defects: the fixed tray covers the GPQA and SWE-bench bar rows (hit-testing the tray's center finds a `.bar-row` under it) and sits mid-content on mobile; null rows render as run-on text "GPT-4—" with the dash glued to the label
  - Bar rows emit the `.bar-row` 3-column structure: name cell, bar cell, value cell as separate elements; a null metric renders name cell + MISSING in the value cell with an empty bar cell, never a concatenated string (C32, C20)
  - The tray emits `.tray-docked` markup: a collapsed one-line summary ("2 of 3 selected") that expands on toggle; 3-model cap and `#compare-tray` glass identity unchanged (C32, C43)
  - jsdom test asserts: name, bar, and value are sibling cells (no text run-ons), null rows have no bar element, the tray renders collapsed by default with a working toggle, and the 4th-selection cap still holds (C32)
- [x] W5.S6 | files: docs/js/views/scenario.js, tests/w5s6.test.js | scenario form grid and honest empty state
  - Root defects: nine full-width stacked fields make a sparse wall at 1440px with a floating checkbox, and a summary line of em dashes ("Budget —/mo · task — · ...") renders before the user has entered anything
  - Form emits `.form-grid` markup: budget/task and the two volumes paired at >=720px, the four constraints grouped in a labeled fieldset, the checkbox inline with its label (C33, C35)
  - The scenario summary line renders only after a scenario has been run; the initial state shows just the prompt box; results and exclusion sections unchanged (C33)
  - jsdom test asserts: fieldset grouping and pairing classes present, no summary element on initial render, summary present after a run, and all W3.S4 ranking/formula/exclusion assertions keep passing (C33, C26, C27)

## Wave 6: game data and pure logic (STEP 2, no UI)

STEP 2 (C55-C76) begins here. `data/surprises.json` is owner-authored with
the C10 protection (C55): no slice may create, edit, or extend it. W6.S1
makes the pipeline require it, so if the owner has not committed a valid
surprises.json when W6.S1 lands, `npm run build` / `npm run validate` fail
loudly and the agent records the blockage in AGENT_NOTES.md; fixture-driven
tests stay green regardless. Modules under `docs/js/game/` import nothing
outside `docs/js/`, never fetch (C13 stays one fetch site), and access
localStorage only through the W6.S3 module (C65).

- [x] W6.S1 | files: scripts/validate.js, scripts/merge.js, tests/fixtures/w6s1/, tests/w6s1.test.js | pipeline support for surprises data
  - validate.js enforces schema 12.5 on data/surprises.json and the amended 12.4 (required, possibly empty, `surprises` array in the artifact): both modelIds exist in curated.json, `field` is one of the six C59 stat fields, and against the built artifact (skipped gracefully when docs/data/models.json is absent, the W1.S3 convention) both models are non-null on that field with differing values; a test per rule feeds an invalid fixture and asserts nonzero exit (C55, C56)
  - merge.js copies surprises.json verbatim into the artifact as top-level `surprises`; fixture merge test; the C18 determinism test extends over the new field (C57, C18)
  - After this slice `npm run build && npm run validate` exit 0 against committed data with the owner-supplied surprises.json flowing through, and the regenerated docs/data/models.json is committed (C57, done-item 9); missing or invalid surprises.json fails loudly and the slice never creates or edits it (C55)
- [x] W6.S2 | files: docs/js/game/questions.js, tests/fixtures/w6s2/, tests/w6s2.test.js | seeded question generator with eight templates
  - xmur3 and mulberry32 byte-identical to the C58 listing; unit test pins the first three outputs of `mulberry32(xmur3("2026-07-15")())` against committed constants; no Math.random, no DOM, no fetch, no storage, no imports outside docs/js/ (C58, C19)
  - Eight templates exactly per C59 with per-template validity unit tests including null-field and equal-value exclusions; question id is `${templateId}:${idLow}:${idHigh}` with ids in lexicographic order; scenario templates use the exact unrounded midpoint budget so exactly one model qualifies per C24 (C59)
  - Reveal data per C60: stat templates `{field, valueA, valueB}`; scenario templates carry budget, volumes, both costs, and both formula strings compared verbatim to engine.js output (C60)
  - `generateDaily(seed, artifact)` deterministic (deep-equal on same seed and artifact), selection unique by (unordered pair, templateId), artifact-order enumeration with the seeded rng as the only source of choice including A/B order, count `min(10, poolSize)`, adjacent dates differ in at least one question id; at least 2 surprise-derived questions when available, all valid ones when fewer (fixture pools 0, 1, 3); endless sequence from `mulberry32(seed)` reproducible on a fixed seed (C61, C62, C63)
- [x] W6.S3 | files: docs/js/game/storage.js, tests/w6s3.test.js | localStorage module with streak state
  - Reads and writes exactly one key `frontier.game.v1` holding JSON per schema 12.6; round-trip unit test against the schema; this module is the only localStorage access point in docs/js (C65)
  - Corrupt JSON, `{"version":99}`, missing value, and a throwing localStorage stub all degrade to the fresh default `{"version":1,"endless":{"best":0},"daily":{}}` and never throw to the caller (C66)
  - Streak helpers: increment on correct, reset to 0 on wrong with play continuing, best streak is the maximum ever reached and persists across sessions via the module; unit tests for increment, reset, best retention (C64)
  - Exposes daily-record read/write (questionIds, picks, correct, completed) keyed by UTC date string, the contract the W8.S2 daily view consumes (12.6, C67 groundwork)
- [x] W6.S4 | files: docs/js/game/share.js, tests/w6s4.test.js | share string builder with copy helper
  - Exports the single constant `LAUNCH_DATE = "2026-07-15"` and a builder returning exactly `Frontier #${N} ${X}/${M}` + `"\n"` + M squares (U+1F7E9 correct, U+1F7E5 wrong, in question order), N per the C68 day formula with launch day #1; unit test asserts the exact string for a fixture record and date (C68)
  - Copy helper uses `navigator.clipboard.writeText` when available, else a readonly textarea with `document.execCommand("copy")`, and reports a copied state for the button; jsdom tests stub both paths (C69)
  - No storage access, no fetch, no imports outside docs/js/; consumed by the W8.S2 results screen
- [x] W6.S5 | files: tests/w4s1.test.js | rescope the step 1 game-word audit to the C74 file set
  - The docs/-wide ban on "game", "puzzle", "streak", "score" narrows to exactly the five step 1 view modules (catalog, model, compare, scenario, timeline) plus engine.js, keeping the established fmtScore / "benchmark score" allowance (C74, amended done-item 7); docs/js/game/, router and main wiring, styles, data, and tests are exempt per SPEC section 14
  - Every other w4s1 assertion stays unweakened: step 1 glass ids per rendered step 1 view and index.html, backdrop-filter and --surface-glass only in the @supports .glass rule, no `.skip(` or `.todo(`, absolute refs limited to the epoch.ai link (C43, C50, C2)
  - Wave gate: with all Wave 6 slices merged, `npm test` is green even though docs/js/game/ now exists

## Wave 7: game shell (routes, stub views, styles)

- [x] W7.S1 | files: docs/js/router.js, docs/js/main.js, docs/js/game/views/picker.js, docs/js/game/views/daily.js, docs/js/game/views/endless.js, tests/w7s1.test.js | game routes with mode picker and stub views
  - router.js parses `#/game` (picker), `#/game/daily`, and `#/game/endless` with an optional `?seed=` param; unknown `#/game/...` sub-routes resolve to the picker; jsdom tests per route including the unknown case; all step 1 routes unchanged (C70, C28)
  - Game views are pure `render(state)` functions per the W2.S3 contract; main.js dispatches the three game routes and adds a Game nav link; main.js remains the single fetch site so question data reaches views only through the artifact in state (C70, C29, C13)
  - picker.js renders links to daily and endless; daily.js and endless.js are minimal stubs (heading plus muted placeholder) rewritten by exactly one Wave 8 slice each; the five step 1 view modules and engine.js are untouched (C74)
- [x] W7.S2 | files: docs/css/styles.css, tests/w7s2.test.js | game styles from existing tokens only
  - `#game-cards` option buttons: `min-height: var(--sp-8)`, full column width below 720px, accent `:focus-visible` ring reused; streak / "q of M" display, reveal block, and next-question control styled from existing tokens; `#game-results` squares row and copy button styled likewise (C71, C72, C73)
  - No new CSS file, no new tokens, no new glass rules: `#game-cards` and `#game-results` get glass only by carrying the `.glass` class in Wave 8 markup; box-shadow count (1) and backdrop-filter count (2) stay pinned; keep W5.S1's exact selector-list conventions for the w5s1 ruleBlock helper (C73, amended C43, C45, C44)
  - All W1.S2 and W5.S1 checks pass unweakened: raw colors only in tokens.css, token-only sizes, spacing, radii, no `gradient(`, single `min-width: 720px` query, motion rules intact (C36-C47, C73)

## Wave 8: game views (each rewrites its Wave 7 stub)

- [x] W8.S1 | files: docs/js/game/views/endless.js, tests/w8s1.test.js | endless mode question screen
  - Draws the infinite question sequence from questions.js seeded by `?seed=` when present, else `Date.now()` at session start; with `?seed=` the rendered sequence is reproducible, asserted by test (C63)
  - Two `<button>` option cards inside `#game-cards` (carrying `.glass`); a running streak is visible; a wrong answer resets the streak to 0 with play continuing; best streak persists via the storage module only, never direct localStorage (C71, C64, C65)
  - After an answer the reveal state shows the real C60 values (both formula strings for scenario templates) and a next-question control; jsdom tests assert button semantics, reveal content per template, and the next-question flow (C71, C60)
- [x] W8.S2 | files: docs/js/game/views/daily.js, tests/w8s2.test.js | daily mode flow with results screen
  - Daily questions come from `generateDaily(xmur3(utcDateString)(), artifact)` with the view's date injectable for tests; answers are recorded to the storage module as the player progresses, one recorded play per UTC date; progress "q of M" is visible and the reveal state matches the W8.S1 card contract (C61, C67, C71)
  - Once today's record is complete, revisiting `#/game/daily` renders the `#game-results` screen (carrying `.glass`), not a replay: X/M, per-question squares, the exact C68 share string, and the C69 copy button; jsdom test uses a pre-seeded completed record (C67, C72)
  - Pre-launch: with an injected date earlier than LAUNCH_DATE the view renders a notice containing the literal "2026-07-15", generates no questions, renders no `#game-cards`, and a spy on the storage module records zero writes (C76)

## Wave 9: STEP 2 integration audit and harness

- [x] W9.S1 | files: tests/w9s1.test.js | amended glass scoping with whole-game audit
  - Renders every step 1 view, every game view, and index.html, asserting each element carrying `.glass` matches one of the six amended C43 selectors (`#site-header`, `#compare-tray`, `#scenario-results`, `#model-overlay`, `#game-cards`, `#game-results`), and that `--surface-glass` and `backdrop-filter` appear only in the `.glass` rules (amended C43)
  - Audit greps: the six C74 files contain no game/puzzle/streak/score feature strings (fmtScore and "benchmark score" allowance preserved); docs/js still has exactly one `fetch(`; localStorage appears only in docs/js/game/storage.js with the single `frontier.game.v1` key; no Math.random anywhere in docs/js including docs/js/game/ (C74, C13, C65, C19, section 15)
  - Suite-completeness: every C75 area (templates, PRNG constants, daily determinism, surprises, endless, streak, storage, share string, game view renders) has a suite under tests/; no `.skip(` or `.todo(` (C75, C50)
  - Done means: fresh clone `npm ci && npm run build && npm run validate && npm test` all exit 0 offline with `#/game` playable end to end when serving docs/ locally (done-items 8, 9, 10)
- [x] W9.S2 | files: scripts/screenshot.js, tests/w9s2.test.js | harness extended to the four game states
  - Adds the C75 states: `#/game` (picker), `#/game/endless?seed=1` (question), the same after clicking option A (reveal), and `#/game/daily` with a pre-seeded completed `frontier.game.v1` record (results), each at 375x812 and 1440x900 in light and dark: 32 PNGs total, no assertions, exits 0 (amended C53, C75)
  - The harness seeds localStorage via the browser context before the daily-results shot; when run before LAUNCH_DATE that state legitimately captures the C76 notice instead of results (note it in AGENT_NOTES.md); the harness stays outside npm test and every workflow (C75, C54, C7)
  - Verified by execution: `npm run shots` exits 0 and `shots/` holds exactly 32 PNGs; the four game states are visually inspected per the standing rule before flipping this box (done-item 11)
  - tests/w9s2.test.js keeps the W4.S3 hygiene pattern without banned strings: `Math.random` absent from scripts/ and docs/js/, no `gradient(` in docs/, the C58 PRNG listing byte-identical in questions.js (C19, C42, C58)

## Wave 10: functional defect remediation

W10.S1 defines the CSS class contract (the W5.S1 precedent); view slices
emit the markup. All four slices are file-disjoint.

- [x] W10.S1 | files: docs/css/styles.css, tests/w10s1.test.js | stylesheet: scenario results contract, nav containment, timeline ticks
  - Root defect: a run scenario renders run-on text "1. 1Claude Fable
    5SWE-bench Verified: 95.050.00 Mtok x $10.00 + ..." because scenario.js
    emits `.scenario-ranked`/`.rank`/`.model-name`/`.ranking-value`/
    `.cost-formula` markup but styles.css defines none of those classes;
    the ol marker also duplicates the `.rank` span
  - `.scenario-ranked`: suppress the list markers (list semantics kept),
    lay each li out as separate rank / name / ranking-value / formula
    cells (grid at >=720px, stacked below), `.cost-formula` in --text-1
    muted, `.rank` in tabular-nums; the duplicated visible rank is gone
  - Root defect: #site-header nav overflows 375px and clips the Game
    link; contain the nav below 720px (tighter gap plus overflow-x auto
    scoped to the nav only) so the page body never scrolls horizontally
  - `.timeline-tick` class contract consumed by W10.S4: absolutely
    positioned year labels in --text-1 muted with a hairline rule on the
    axis
  - All W1.S2/W5.S1/W7.S2 checks unweakened: token-only values, no
    `gradient(`, pinned box-shadow and backdrop-filter counts, single
    720px query (C36, C40-C47); `npm run shots` inspected per the
    standing rule
- [x] W10.S2 | files: docs/js/game/reveal.js, docs/js/game/views/daily.js, docs/js/game/views/endless.js, tests/w8s2.test.js, tests/w10s2.test.js | shared reveal formatting, no leaked field paths (tests/w8s2.test.js in the file list so its stat-reveal assertions rescope to the spec at equal or greater strength instead of pinning the defect)
  - Root defect: the daily reveal renders the raw dot-path
    "pricing.outputPerMTok" and unformatted values ("Claude Fable 5: 50")
    while endless.js already holds the correct STAT_REVEAL
    label-and-formatter map; the two views disagree on the same reveal
  - Extract STAT_REVEAL and the reveal-line builders into
    docs/js/game/reveal.js; both game views consume it; stat reveals show
    human labels and formatted values (fmtUsd/fmtInt/fmtDate/fmtScore);
    scenario reveals keep the exact C60 formula strings verbatim
  - reveal.js imports nothing outside docs/js/, no fetch, no storage
    access (C13 single fetch site and C65 single storage module greps
    unchanged)
  - jsdom tests: the daily reveal for every stat template asserts the
    human label and formatted value and asserts no raw dot-path string in
    the rendered output; all W8.S1 assertions keep passing, and the
    stat-reveal assertions in tests/w8s2.test.js's playthrough loop are
    rescoped to assert the human label and the formatted values at equal
    or greater strength (the Wave 8 precedent: stub-era assertions are
    rescoped to the spec, never weakened); every other w8s2 assertion
    keeps passing unchanged (C60, C71)
- [x] W10.S3 | files: docs/index.html, tests/w1s1.test.js | favicon and clean console
  - Root defect: every page load logs a favicon.ico 404, the only console
    error in the app
  - Add an inline `data:` URI favicon link in index.html; the C2 grep
    stays green (no `/` or `http` href added, docs/ file list unchanged);
    the w1s1 relative-path assertion gains exactly this one `data:` href
    allowance, mirroring the C35 epoch.ai exception; every other w1s1
    assertion unweakened (C2, C35)
  - Done means: serving docs/ locally shows zero console errors on all
    routes, light and dark
- [x] W10.S4 | files: docs/js/views/timeline.js, tests/w10s4.test.js | timeline first-paint usability
  - Root defect: strip content measures 3042px inside a 1016px container
    with every post-2023 dot at 97-99.6 percent left; first paint shows
    the GPT-4 label and an empty track, both event markers sit three
    screens of unhinted horizontal scroll away, and lane stacking
    overflows the strip (measured label bottom 245.5 vs strip bottom 237)
  - Keep the exact C34 linear mapping and left offsets; on first render
    scroll the strip so the newest dot cluster is in view; emit
    `.timeline-tick` year labels (2023 through the generatedAt year) so
    the sparse middle reads as real history instead of a rendering defect
  - Every dot and label renders inside the strip's box: the view sizes
    the track for its deepest occupied lane through the existing
    data-lane mechanism; event markers keep a visible accent glyph at
    their C34 positions, marker click still reveals title and body, dot
    click still navigates to `#/model/:id` (C34)
  - jsdom asserts: C34 offsets unchanged for fixture dates, the initial
    scroll target tracks the newest dot, tick elements present at
    computed year positions, and no dot or label box extends below the
    track

## Wave 11: explorer and game polish inside the frozen token set

No new tokens and no spec changes: every slice here serves existing
criteria with better hierarchy and states. W11.S1 owns styles.css and
defines the class contract; the three view slices emit the markup; all
four slices are file-disjoint. Every slice runs `npm run shots` and
inspects its states per the standing rule.

- [x] W11.S1 | files: docs/css/styles.css, tests/w11s1.test.js | stylesheet: filter chips, control states, metric cards, focal prompt
  - Filter chips: `.chip-set`/`.chip` contract replacing the four-row
    multiselect listbox look (hairline chip, accent border and text when
    selected); search, chips, toggle, and sort controls share one aligned
    baseline at >=720px
  - Button states: replace the opacity hover (reads as flicker) with
    background/border shifts inside the existing C46 transition set;
    disabled buttons get hairline border and muted text at full opacity;
    ghost buttons hover to an accent border
  - `.metric-card` contract for compare groups (surface-solid, hairline,
    --r-m, --sp-4) plus `.delta` and `.better-lower` annotation styles in
    --text-1 muted
  - `.game-prompt`: the question in --font-display at --text-4 (the
    prompt is the game's hero and currently renders at 13px muted);
    #game-cards buttons restyled as ghost cards (surface-solid, ink text,
    hairline border) reserving the accent for chosen/correct outlines;
    `.card-value` styles for in-card reveal values; C71 min-height token
    kept
  - All C36-C47 greps unweakened; shadow count (1 declaration) and
    backdrop-filter count pinned (C45, C44, C43)
- [x] W11.S2 | files: docs/js/views/catalog.js, tests/w3s1.test.js, tests/w5s4.test.js, tests/w11s2.test.js | catalog markup: chips and table typography (tests/w3s1.test.js and tests/w5s4.test.js in the file list so the 9-cell row arrays rescope to the name-cell-with-muted-org-subline contract, chips as the only organization control)
  - Organization filter emits labeled checkbox chips as the ONLY
    organization control (multi-select semantics and C35 labels
    preserved); the hidden `#catalog-filter-org` select bridge from the
    first W11.S2 landing is removed, and the w3s1/w5s4 assertions that
    pinned the select API are rescoped to drive the chips at equal or
    greater strength (the Wave 8 / W10.S2 rescope precedent); the
    filter-bar keeps the W5.S4 order minus the dissolved org slot
  - Model name cells get `.nowrap` so "Claude Fable 5" never wraps;
    organization moves to a muted second line under the name (the
    standalone Organization column dissolves into the name cell, so the
    w3s1/w5s4 exact 9-cell arrays are rescoped to the 8-cell contract
    asserting the name link plus the muted org subline explicitly);
    numeric columns right-aligned with the `.num` tabular class; weights
    renders as a `.badge`
  - jsdom: every W3.S1/W5.S4 filter and sort assertion keeps passing
    (rescoped ones at equal or greater strength) plus new assertions for
    chip semantics and cell classes (C30, C20)
- [x] W11.S3 | files: docs/js/game/views/picker.js, docs/js/game/views/daily.js, docs/js/game/views/endless.js, tests/w11s3.test.js | game screens: focal prompt, honest answer states
  - Picker: Daily and Endless render as two `.card` blocks with mode
    name, one-line rules copy, and current stats read via the storage
    module only (today's completion state, best streak); routing
    unchanged (C70, C65)
  - Question screens: the prompt emits `.game-prompt`; the C71
    streak/progress line stays visible; after an answer the correct card
    carries an accent outline, the chosen card carries a distinct pressed
    state class, and both cards render their revealed value inline via
    `.card-value` (formatted by the W10.S2 reveal module) so the answer
    lands where the eye already is; the C60 reveal panel and
    next-question control stay
  - jsdom: correct-card and picked-card classes asserted per template
    fixture, in-card values formatted, all W8 assertions unweakened (C71,
    C60, C67)
- [x] W11.S4 | files: docs/js/views/compare.js, tests/w11s4.test.js | compare metric cards and readable deltas
  - Each of the five C32 bar groups wraps in a `.metric-card` with the
    metric name as its heading; price groups carry a "lower is better"
    `.better-lower` note (the current bars read fullest-is-best, which is
    backwards for price)
  - Root defect: proportional-to-max bars render 93.2 vs 92.9 as two
    visually identical full bars; each non-leading row adds a `.delta`
    annotation ("0.3 behind" style) computed from the displayed values
    only (display formatting, not data invention, C19)
  - Bars, widths, group count, null handling, and the 3-model cap stay
    byte-for-byte per C32/C20; jsdom asserts five cards, the delta text
    for a near-tie fixture, and all W3.S3/W5.S5 assertions keep passing

## Wave 12: STEP 3 design-system amendment

The token contract caps the ceiling: no success or danger colors (so game
feedback falls back to emoji and opacity), one shadow, one duration. This
wave lifts the ceiling and is fully self-contained: every design decision
is settled below, in this plan, and W12.S1 transcribes the amendment into
SPEC.md mechanically. No slice in this plan waits on input from outside
the repository. Decisions, settled here and final: (1) the palette keeps
the committed warm set; STEP 3 is purely additive, no existing token
value changes, so every passing C37-C39 test stays valid. (2) Compare
near-tie readability ships in W11.S4 as delta annotations under the
existing C32; C32 is not amended. (3) The new token values are fixed
below, precomputed to clear the C39 threshold in both themes (worst case
4.77:1, --success against the light --bg).

Normative STEP 3 content, the values W12.S1 transcribes into SPEC.md. It
folds each into the criterion it amends (C37 carries the twelve-name set,
C46 the two durations, and so on) and stamps them "(Amended by STEP 3.)"
the way STEP 2 stamped its amendments, so every rule reads whole where it
stands. Once W12.S1 has landed, SPEC.md is authoritative and this block is
the design record behind it: change the criterion in SPEC.md, and mirror it
here; tests/w12s1.test.js pins the spec to these values either way.

- Amended C37, additions only. Light adds: `--success: #15803D;
  --danger: #B91C1C; --accent-soft: rgba(180, 83, 9, 0.12);
  --shadow-raised: 0 12px 40px rgba(0, 0, 0, 0.14);` Dark adds:
  `--success: #4ADE80; --danger: #F87171;
  --accent-soft: rgba(232, 163, 61, 0.16);
  --shadow-raised: 0 12px 40px rgba(0, 0, 0, 0.55);` One
  theme-independent `--dur-slow: 300ms` joins `:root` only.
- Amended C38: the theme set becomes twelve names (the eight plus
  --success, --danger, --accent-soft, --shadow-raised); --dur-slow joins
  the declared-once theme-independent list.
- Amended C39: --success and --danger join the >= 4.5:1 checks against
  --surface-solid and --bg in both themes; --accent-soft and
  --shadow-raised are fill/effect tokens outside the text-contrast rule,
  like --surface-glass.
- Amended C45: box-shadow appears in docs/ exactly as (a) the four token
  definitions in tokens.css (two --shadow-glass, two --shadow-raised),
  (b) the one `box-shadow: var(--shadow-glass);` in the .glass rule, and
  (c) exactly one `box-shadow: var(--shadow-raised);` declaration in
  styles.css whose selector list names the raised surfaces
  (#model-overlay and the correct-answer card state). Nowhere else.
- Amended C46: exactly two duration tokens, `--dur: 150ms` and
  `--dur-slow: 300ms`, easing ease-out; every transition/animation
  duration references one of them; the single reduced-motion block sets
  both to 0ms; at most one @keyframes rule, named `reveal-in`, used only
  by game reveal and card-state rules.

- [x] W12.S1 | files: SPEC.md, tests/w12s1.test.js | STEP 3 amendment transcribed into SPEC.md
  - Folds the normative content above into C37, C38, C39, C45, and C46
    themselves, stamping each "(Amended by STEP 3.)", and adds a STEP 3
    section giving the rationale plus done-items 12-14; the section
    restates no values, so each rule has exactly one place to read and to
    change; no other SPEC.md line changes and the transcription involves
    zero judgment, since every value is fixed in this plan
  - tests/w12s1.test.js asserts each amended criterion states its whole
    rule (all twelve token names and both exact values per state color),
    that the STEP 3 section restates no value, and that C32, C53, and C68
    carry no STEP 3 stamp, so spec drift fails loudly
- [x] W12.S2 | files: docs/css/tokens.css, docs/css/styles.css, tests/w1s2.test.js, tests/w5s1.test.js, tests/w7s2.test.js, tests/w10s1.test.js, tests/w11s1.test.js, tests/w12s2.test.js | amended tokens plus elevation, motion, and state styles (tokens and styles share one slice per the W1.S2 precedent because the pre-STEP-3 count pins live in the five listed test files, which this slice rescopes to the amended criteria at equal or greater strength)
  - tokens.css declares exactly the amended C37 additions in `:root` and
    the dark block with the values fixed above, --dur-slow in `:root`
    only; w1s2's C38 parity assertions rescope to the twelve-name theme
    set and its C39 contrast assertions extend over --success and
    --danger against --surface-solid and --bg in both themes
  - styles.css: correct/incorrect card states (--success/--danger
    outlines with --accent-soft fills); the single --shadow-raised
    declaration whose selector list is #model-overlay plus the
    correct-answer card state (no markup edits needed); the single
    reveal-in keyframe at --dur-slow; selected chips on --accent-soft
  - The pinned counts in w1s2/w7s2/w10s1/w11s1 (box-shadow exactly one
    declaration, transition-free state rules, single duration token)
    rescope to exactly the amended C45/C46 allowances: two box-shadow
    declarations (.glass and the --shadow-raised rule), state-rule
    transitions and the one reveal-in keyframe on token durations only;
    every other C36-C47 grep is unweakened
- [x] W12.S3 | files: docs/js/game/views/daily.js, docs/js/game/views/endless.js, tests/w8s2.test.js, tests/w12s3.test.js | game feedback on real state colors (tests/w8s2.test.js in the file list so its emoji-glyph squares assertions rescope to the token-colored squares contract at equal or greater strength)
  - Correct card carries the --success state, a wrong pick carries
    --danger; class names card-correct/card-picked stay (w11s3 pins
    them); the on-screen results squares render as token-colored
    elements instead of raw emoji glyphs while the C68 share string stays
    byte-identical (emoji squares are the share format, not the screen
    format); jsdom asserts state classes per outcome and the exact C68
    string unchanged

## Wave 13: the magic layer (after Wave 12)

Reveal choreography and the retention hooks every good daily game has.
Depends on Wave 12's tokens and motion amendment; file-disjoint (styles
vs daily vs endless vs picker).

- [x] W13.S1 | files: docs/css/styles.css, tests/w5s1.test.js, tests/w7s2.test.js, tests/w11s1.test.js, tests/w13s1.test.js | reveal and streak choreography: this is the wave's only stylesheet slice, so every Wave 13 rule lands here and S2/S3/S4 stay markup-only and parallel-safe (the three listed suites pin W5.S1's motion scoping to color and border-color only, which the press-in transform reshapes; this slice owns them and narrows the pin rather than dropping it)
  - The chosen card presses in, the correct card lifts (--shadow-raised
    plus --success edge), in-card values fade in staggered at --dur-slow;
    every duration and delay references a token and reduced-motion
    collapses the sequence to instant states, inside the amended C45/C46
    allowances that W12.S2's rescoped tests pin
  - W5.S1's motion scoping is narrowed, not dropped: transitions still
    animate only color and border-color everywhere, plus transform on
    `#game-cards button` alone, and the opacity/background/all bans stay.
    The anti-flicker rule that motivated the pin (hover and re-render
    motion on links, controls, and table rows) is unchanged
  - Also carries the W13.S3 streak contract, since one slice per wave may
    write styles.css: `.game-streak` (the count as the focal figure, in
    --font-display at --text-4) and `.streak-best` (the beaten-best
    celebration state, in --success). W13.S3 emits the markup
- [x] W13.S2 | files: docs/js/game/views/daily.js, tests/w8s2.test.js, tests/w13s2.test.js | results as a moment (tests/w8s2.test.js in the file list so its results-screen node assertions can rescope to the reshaped markup at equal or greater strength)
  - Day number headline ("Frontier #N" via share.js), one squares row
    with an X/M subline, a best-streak line once the player has a streak
    to show (it is an endless stat: "Best streak: 0" is noise to a
    daily-only player), and time-until-next-UTC-daily computed once at
    render from an injected clock (display only, no timers)
  - The exact C68 share string stays rendered inside #game-results per
    C72 (the .game-share node and the copy button remain), presented as
    the quiet copy block rather than a second decorative squares row;
    C68 string byte-identical, C69 copy paths unchanged, one recorded
    play per date (C67)
- [x] W13.S3 | files: docs/js/game/views/endless.js, tests/w8s1.test.js, tests/w11s3.test.js, tests/w13s3.test.js | streak stakes (w8s1 and w11s3 both pin the flat "Streak N · Best M" string, so both are in the file list and rescope to the focal streak markup at equal or greater strength; the styles are W13.S1's, per one stylesheet writer per wave)
  - The streak counter becomes the focal progress element and a
    best-streak celebration state (class plus copy) fires when best is
    beaten; storage via the single module and key only (C64, C65)
- [x] W13.S4 | files: docs/js/game/views/picker.js, tests/w11s3.test.js, tests/w13s4.test.js | picker as the game's front door (tests/w11s3.test.js in the file list so its pinned mode-stat texts can rescope with the presentation at equal or greater strength)
  - W11.S3 already landed the mode cards, the storage-read stats (not
    played / in progress / done with score, best streak), and the rules
    copy; those assertions stay green and unweakened. This slice closes
    what is left between the picker and the two screens behind it
  - The daily card names the dated run it opens, `Frontier #N` from
    share.js, the same number W13.S2 headlines on the results screen, so
    the front door and the moment agree
  - Pre-launch honesty (C76): when the injected date is before
    LAUNCH_DATE the daily card states the start date instead of claiming
    "Not played today", which is what the route behind it already says;
    no day number is shown for a run that has not started
  - Routes, the pure-render contract, and storage-module-only reads are
    unchanged (C70, C29, C65); the picker still adds no glass

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
| C55, C56, C57, schemas 12.4 amendment, 12.5 | W6.S1 |
| C58, C59, C60, C61, C62, C63 (generator) | W6.S2 |
| C64, C65, C66, schema 12.6 | W6.S3 |
| C68, C69 | W6.S4, rendered W8.S2 |
| C74 (rescope) | W6.S5, re-audited W9.S1 |
| C70 | W7.S1 |
| C71 (styles), C73 | W7.S2 |
| C63 (seed param UI), C71 (endless screen) | W8.S1 |
| C61 (daily use), C67, C71 (daily screen), C72, C76 | W8.S2 |
| C43 (amended), C75 (suite audit) | W9.S1 |
| C53 (amended), C75 (harness states) | W9.S2 |

Wave-independence audit: no two same-wave slices write the same path
(docs/js/main.js is written in W1.S1, rewritten in W2.S3 and W4.S1, all in
different waves; view stubs from W2.S3 are each rewritten by exactly one
Wave 3 slice). Wave 1 ends runnable: static shell serves, `npm test` passes
with the W1 suites. Every slice's done state is a named test file plus
explicit criteria.

STEP 2 wave-independence audit: Wave 6 slices touch scripts/, three
disjoint docs/js/game/ modules, and tests/w4s1.test.js, no overlaps; Wave 7
splits docs/js (router, main, three game view files) from docs/css; Wave 8
slices each rewrite exactly one Wave 7 stub (endless.js vs daily.js); Wave
9 splits tests/w9s1.test.js from scripts/screenshot.js plus
tests/w9s2.test.js. No slice imports a module built in its own wave except
W7.S1's stub pattern, which mirrors W2.S3 and creates the stub files it
imports within its own file list. docs/data/models.json is regenerated
only by W6.S1 (via npm run build), matching the W2.S1 ownership precedent.
Every STEP 2 criterion C55-C76 plus the four amendments (non-goal, C43,
C53, schema 12.4) appears in the map above.

Remediation-wave audit (Waves 10-13): like Wave 5, these waves remediate
criteria already mapped above, so the map gains no rows. No two same-wave
slices write the same path: Wave 10 splits styles.css / the game reveal
module and views / index.html / timeline.js; Wave 11 splits styles.css /
catalog.js / the three game views / compare.js; Wave 12 splits SPEC.md /
the css pair with its four rescoped suites / the two game mode views;
Wave 13 splits styles.css / daily.js with w8s2 / endless.js with w8s1 /
picker.js with w11s3, so no two same-wave slices share a test file
either. Cross-wave rewrites of the same file (styles.css in W10.S1,
W11.S1, W12.S2, W13.S1; daily.js in W10.S2, W11.S3, W12.S3, W13.S2;
tests/w8s2.test.js in W10.S2, W12.S3, W13.S2) follow the established
stub-then-rewrite precedent and are ordered by wave. Where a slice
reshapes behavior that an earlier wave's test file pins, that test file
is in the slice's file list and its assertions rescope at equal or
greater strength, never weaken. Every wave is executable without
outside input: Wave 12 settles its design decisions inline and W12.S1
transcribes the STEP 3 amendment into SPEC.md as a mechanical, tested
slice. The C10 protection is unchanged and covers only the owner data
files (curated.json, events.json, surprises.json, curated-sources.md).
The standing shots rule applies to
every slice above that touches docs/css or any view module, including the
game views.

<!-- PLAN-READY -->
