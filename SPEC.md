# Frontier: Specification

Frontier is a static reference explorer and decision engine for frontier AI
models, GPT-4 (March 2023) through the July 2026 releases. It is built by an
autonomous agent loop; every criterion below is checkable by a command, a
test, or a concrete inspection. Criteria are numbered C1, C2, ... and each
ends with a `Check:` line stating how it is verified. "grep" means a search
over the named paths; "test" means an assertion that runs under `npm test`.

Rendered site: GitHub Pages serving the `docs/` directory from `main`.

## 1. Non-goals

- No game features, scoring, streaks, or puzzle logic of any kind. The data
  layer must stay reusable (pure functions, plain JSON), but nothing
  game-related appears in code, markup, data, or copy.
- No server, backend, accounts, auth, cookies, analytics, or telemetry.
- No JS/CSS frameworks, no chart or graphing libraries, no runtime
  dependencies at all. Dev-only tooling is allowed (see C6).
- No paid services anywhere: hosting, CI, data, fonts. GitHub free tier only.
- No invented data. See section 5; this is a hard product rule.
- No pixel-diff or visual-regression testing.

## 2. Repository layout and toolchain

- C1. The repo contains exactly these top-level source areas: `data/` (inputs),
  `scripts/` (Node pipeline + tooling), `docs/` (the deployable site),
  `tests/` (vitest suites), `.github/workflows/` (CI).
  Check: inspection of the tree.
- C2. `docs/` is fully self-contained and static: `index.html`, `css/tokens.css`,
  `css/styles.css`, `js/` (ES modules), `data/models.json`. Opening it over any
  static file server with any base path works.
  Check: grep of `docs/` finds no `src=`, `href=`, or `fetch(` argument
  starting with `/` or `http`, with exactly one exception: the C35
  attribution link `href="https://epoch.ai"`. All asset paths are relative.
- C3. `package.json` has `"type": "module"` and the test script is exactly
  `"test": "vitest run --passWithNoTests"`.
  Check: grep package.json.
- C4. `package.json` scripts include `"fetch": "node scripts/fetch-epoch.js"`,
  `"build": "node scripts/merge.js"`, `"validate": "node scripts/validate.js"`,
  `"shots": "node scripts/screenshot.js"`.
  Check: grep package.json.
- C5. `package.json` contains no `"dependencies"` key. The site ships zero
  third-party code.
  Check: grep package.json; grep of `docs/` finds no `node_modules` reference.
- C6. devDependencies are limited to: `vitest`, `jsdom`, `playwright`, and
  optionally `ajv`. Nothing else.
  Check: inspection of package.json.
- C7. `npm test` never invokes playwright and `scripts/screenshot.js` is
  imported by no test file.
  Check: grep `tests/` for `screenshot` and `playwright` finds nothing.
- C8. `shots/` is gitignored.
  Check: grep .gitignore for `shots/`.

## 3. Data inputs

Three input files live in `data/`. Two are human-edited only.

- C9. `data/epoch_notable_ai_models.csv` is a committed snapshot of Epoch AI's
  "Notable AI Models" dataset (CC-BY 4.0), fetched by `scripts/fetch-epoch.js`
  from `https://epoch.ai/data/notable_ai_models.csv`.
  Check: file exists, is parseable CSV with a header row (test).
- C10. `data/curated.json` is hand-entered by the repository owner from
  official lab pricing and announcement pages. It is ground truth. The agent
  loop must never create, edit, extend, or "fix" `data/curated.json` or
  `data/events.json`; if either is missing or schema-invalid, the pipeline
  fails loudly and the loop records the blockage instead of working around it.
  Check: git history shows no loop commit touching these two files;
  `npm run validate` exits nonzero when either file is invalid.
- C11. `data/events.json` is a hand-written list of landscape events (for
  example the Fable 5 export suspension). Same authorship rule as C10.
  Check: schema validation (test) and C10's inspection.
- C12. `data/epoch-columns.json` maps logical enrichment fields to exact Epoch
  CSV header names. It is committed, human-editable, and read by merge.js; no
  column name is hardcoded in JS. If a mapped column is absent from the CSV,
  merge exits nonzero.
  Check: test with a fixture CSV missing a column asserts nonzero exit /
  thrown error; grep merge.js for quoted Epoch header strings finds none.

## 4. Pipeline: merge, validate, output

- C13. `scripts/merge.js` produces exactly one artifact,
  `docs/data/models.json`, conforming to the schema in section 12. It is the
  single source of truth; the site and the engine read model or event data
  from nowhere else.
  Check: grep `docs/js/` for `fetch(` shows exactly one fetched URL,
  `data/models.json` (relative).
- C14. Merge semantics: `curated.json` is master. Every curated record appears
  in the output; no other models appear. A record with non-null `epochName`
  is joined to the Epoch row whose mapped model-name column exactly equals
  `epochName` (case-sensitive, no normalization, no fuzzy matching); matched
  rows contribute only the enrichment fields named in `epoch-columns.json`
  (release date, parameters, training compute, organization). Unmatched Epoch
  rows are ignored. On conflict, the curated value wins.
  Check: unit tests with fixtures covering matched, unmatched, and
  conflicting cases.
- C15. Every merged record carries a `sources` object tagging each nullable
  stat/enrichment field with `"curated"` or `"epoch"` (fields that are null
  are tagged with the source that would have provided them or omitted; the
  schema fixes the rule). Tags must be truthful: a field whose value came
  from the CSV is tagged `"epoch"`.
  Check: unit test asserts tags on a fixture merge.
- C16. The artifact's top level contains `generatedAt` (ISO 8601 UTC),
  `attribution` (exact string:
  `Model metadata: Epoch AI, "Notable AI Models", CC-BY 4.0, https://epoch.ai`),
  `models` (array), and `events` (array, copied verbatim from events.json).
  Check: schema test against the committed artifact.
- C17. `scripts/validate.js` validates `curated.json`, `events.json`, and the
  generated `docs/data/models.json` against the section 12 schemas and exits
  nonzero on any violation, printing every violation found.
  Check: test feeds an invalid fixture and asserts failure; `npm run
  validate` on the committed repo exits 0.
- C18. Determinism: running merge twice on the same inputs produces
  byte-identical output except `generatedAt`. Models are sorted by `id`.
  Check: test runs merge twice on fixtures and diffs.

## 5. Missing data and the no-invention rule

- C19. No code path in `scripts/` or `docs/js/` generates, estimates,
  imputes, interpolates, or defaults a stat value (pricing, context window,
  benchmark score, parameters, training compute, release date, open-weights
  flag). Null in curated.json stays null through merge, engine, and render.
  Check: property-style tests assert null-in/null-out through merge and
  engine; grep `scripts/` and `docs/js/` for `?? 0`, `|| 0`, and
  `Math.random` finds nothing; critic inspects merge.js and engine.js for
  fallback expressions on stat fields.
- C20. A model with a null field stays in the catalog. Every renderer shows
  a missing value as an em dash via the single exported constant
  `MISSING = "—"`; no renderer writes a literal dash for this purpose.
  Check: jsdom test renders a fixture model with nulls and asserts the em
  dash; grep `docs/js/` shows exactly one definition of `MISSING`.
- C21. Any ranking, comparison bar, timeline position, or cost computation
  that requires a field excludes models where that field is null, rather
  than substituting anything.
  Check: engine unit tests per computation with null fixtures.

## 6. Scenario engine

Pure functions in `docs/js/engine.js`. No DOM access, no fetch, no globals;
the module imports nothing outside `docs/js/`.

- C22. Input shape:
  `{ budgetUsdPerMonth, task, inputMTokPerMonth, outputMTokPerMonth,
  constraints: { openWeightsOnly, minContextTokens, releasedOnOrAfter,
  releasedOnOrBefore } }` where task is `"coding" | "reasoning" | "longdoc"`,
  volumes are millions of tokens per month, constraint fields are nullable.
  Check: exported JSDoc typedef plus unit tests.
- C23. Cost formula, exact:
  `cost = inputMTokPerMonth * pricing.inputPerMTok +
  outputMTokPerMonth * pricing.outputPerMTok` (USD/month). Cost is
  computable only when both prices are non-null.
  Check: unit tests with hand-computed expectations.
- C24. A model qualifies iff: cost is computable and `cost <=
  budgetUsdPerMonth`; every non-null constraint passes (`openWeightsOnly`
  requires `openWeights === true`; `minContextTokens` requires non-null
  `contextWindow >= min`; date constraints require non-null `releaseDate` in
  range); and the task's ranking field is non-null.
  Check: unit tests covering each exclusion reason independently.
- C25. Ranking fields: coding ranks by `benchmarks.swebenchVerified`
  descending; reasoning by `benchmarks.gpqaDiamond` descending; longdoc by
  `contextWindow` descending with computed cost as the visible secondary
  metric. Tie-breaks for all tasks, in order: ranking field, then lower
  computed cost, then newer `releaseDate`, then `id` ascending. Ordering is
  total and deterministic.
  Check: unit tests including exact-tie fixtures.
- C26. Each result exposes shown math:
  `{ inputCost, outputCost, totalCost, formula }` where `formula` is the
  human-readable string
  `"{in} Mtok x ${inPrice} + {out} Mtok x ${outPrice} = ${total}/mo"` with
  values formatted to two decimals.
  Check: unit test asserts the exact string for a fixture.
- C27. The engine also exposes the list of non-qualifying models with a
  machine-readable reason (`over_budget`, `missing_price`,
  `missing_ranking_field`, `constraint_open_weights`, `constraint_context`,
  `constraint_date`).
  Check: unit tests per reason.

## 7. UI: structure and views

Single page, hash routing, ES modules, no build step for the site.

- C28. Routes: `#/catalog` (default, also empty hash), `#/model/:id`,
  `#/compare?ids=a,b,c`, `#/scenario?...`. Unknown routes render the catalog.
  View state needed to reproduce a compare or scenario lives in the hash, so
  URLs are shareable.
  Check: jsdom router tests per route including the unknown-route case.
- C29. Views are pure render functions: `(state) -> DOM/HTML`, testable under
  jsdom without fetch. `main.js` does the single fetch and wires events.
  Check: each view has a jsdom test that renders it from a fixture state.
- C30. Catalog: one row/card per model showing name, organization, release
  date, input and output price, context window, GPQA Diamond, SWE-bench
  Verified, open/closed weights. Filters: organization (multi), open weights
  (toggle), free-text on name. Sortable by release date, either price,
  context window, and both benchmarks; null values sort last in both
  directions.
  Check: jsdom tests for each filter and for null-last sorting.
- C31. Model card overlay (`#/model/:id`): all record fields, provenance
  labels from `sources` (visible "Epoch" / "curated" tags per enriched
  field), Epoch enrichment values, and every event whose `modelIds` includes
  the model, rendered date + title + body.
  Check: jsdom test with a fixture model that has events and nulls.
- C32. Compare: 2 or 3 models selected from the catalog populate a compare
  tray; `#/compare` renders exactly five bar groups: input price, output
  price, context window, GPQA Diamond, SWE-bench Verified. Bars are plain
  divs whose widths are proportional with the max among compared models at
  100%; a null value renders an em dash row with no bar. Selecting a 4th
  model is impossible.
  Check: jsdom tests assert bar count, proportional widths from fixtures,
  null handling, and the 3-model cap.
- C33. Scenario view: a form for every C22 input, results as a ranked list
  showing rank, model name, ranking-field value, computed cost with the C26
  formula string, and (for longdoc) context window; plus a collapsed section
  listing excluded models with their C27 reason.
  Check: jsdom test drives a fixture dataset through the form-state render.
- C34. Timeline strip on the catalog view: a horizontally scrollable strip,
  x mapped linearly from 2023-03-01 to `generatedAt`. Model dots labeled by
  name at their `releaseDate` (models with null `releaseDate` are omitted);
  event markers use the accent token. Clicking a dot navigates to
  `#/model/:id`; clicking an event marker reveals its title and body. Pure
  HTML/CSS positioning; no canvas, no SVG charting.
  Check: jsdom test asserts computed left-offsets for fixture dates and
  omission of null-date models.
- C35. Baseline semantics: `index.html` has `lang`, a `title`, exactly one
  `h1`; every form control has an associated `<label>`; the footer contains
  "Epoch AI" and "CC-BY 4.0" with a link to `https://epoch.ai`.
  Check: jsdom/grep tests.

## 8. Design system: hard constraints

All values below are exact contract values in `docs/css/tokens.css`.

- C36. Raw color values (hex, `rgb(`, `rgba(`, `color-mix(`, named colors)
  appear only in `tokens.css`. Every other stylesheet and any inline style
  uses `var()` references.
  Check: grep `docs/css/styles.css`, `docs/js/`, and `docs/index.html` for
  `#[0-9a-fA-F]{3,8}` color literals and `rgb` finds nothing.
- C37. Themes: `:root` defines the light set; a single
  `@media (prefers-color-scheme: dark)` block redefines the same names.
  Light: `--bg: #FAF9F7; --surface-glass: rgba(255, 255, 255, 0.62);
  --surface-solid: #FFFFFF; --ink: #1A1815; --muted: #6B675F;
  --hairline: #E5E2DC; --accent: #B45309;
  --shadow-glass: 0 4px 24px rgba(0, 0, 0, 0.08);`
  Dark: `--bg: #141310; --surface-glass: rgba(32, 30, 26, 0.62);
  --surface-solid: #201E1A; --ink: #ECEAE4; --muted: #98948A;
  --hairline: #2E2B26; --accent: #E8A33D;
  --shadow-glass: 0 4px 24px rgba(0, 0, 0, 0.40);`
  Check: grep tokens.css for these exact declarations.
- C38. Theme parity: the eight C37 names (`--bg`, `--surface-glass`,
  `--surface-solid`, `--ink`, `--muted`, `--hairline`, `--accent`,
  `--shadow-glass`) are the theme set. A test parses tokens.css and asserts
  the dark block declares exactly the theme set and the `:root` block
  declares all of it, so a color token can never ship in one theme only.
  Theme-independent tokens (fonts, sizes, spacing, radii, `--dur`, `--blur`)
  are declared once in `:root` and never in the dark block.
  Check: test.
- C39. Contrast, worst case: `--ink`, `--muted`, and `--accent` each reach a
  contrast ratio >= 4.5:1 against `--surface-solid` and against `--bg`, in
  both themes. A test computes WCAG relative-luminance ratios from the
  parsed token values.
  Check: test.
- C40. Type: `--font-display: Charter, Georgia, serif;`
  `--font-text: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;`
  Font sizes only via the six tokens
  `--text-1: 13px; --text-2: 16px; --text-3: 20px; --text-4: 25px;
  --text-5: 31px; --text-6: 39px;` and line heights via
  `--lh-body: 1.5; --lh-head: 1.2;`. No webfont is loaded.
  Check: grep styles.css: every `font-size` value is `var(--text-`; grep
  docs/ for `@font-face`, `fonts.googleapis`, `.woff` finds nothing.
- C41. Spacing only via the eight tokens `--sp-1: 4px` through
  `--sp-8` = 4, 8, 12, 16, 24, 32, 48, 64px. Radii only `--r-s: 6px;
  --r-m: 12px;`.
  Check: grep styles.css: every margin/padding/gap length value is a
  spacing token var, `0`, or `auto`; every border-radius is a radius token.
- C42. No gradients anywhere; the string `gradient(` appears nowhere in
  `docs/`.
  Check: grep.
- C43. Glass is scoped to exactly three components, expressed as one class:
  `.glass` may be applied only to (a) the sticky site header `#site-header`,
  (b) the floating panels `#compare-tray` and `#scenario-results`, and
  (c) the model card overlay `#model-overlay`. A jsdom test renders each
  view and asserts every element carrying `.glass` matches one of those four
  selectors, and nothing else uses `--surface-glass` or `backdrop-filter`.
  Check: test plus grep (`backdrop-filter` and `--surface-glass)` usages
  appear only in the `.glass` rules).
- C44. Glass fallback: the `.glass` base rule (outside any `@supports`) uses
  `background: var(--surface-solid)`. All `backdrop-filter` declarations sit
  inside a single `@supports (backdrop-filter: blur(12px))` block, which
  switches `.glass` to `background: var(--surface-glass)` and
  `backdrop-filter: blur(var(--blur))` with `--blur: 12px`. C39 guarantees
  text on glass against the solid worst case.
  Check: grep: `backdrop-filter` occurs in styles.css only inside that one
  `@supports` block (plus its condition), nowhere else in docs/.
- C45. Shadow: `box-shadow` appears in `docs/` exactly as (a) the two
  `--shadow-glass` token definitions in tokens.css and (b) one declaration
  `box-shadow: var(--shadow-glass);` inside the `.glass` rule in styles.css.
  Nowhere else.
  Check: grep counts.
- C46. Motion: exactly one duration token `--dur: 150ms`, easing `ease-out`;
  all transition/animation durations reference `var(--dur)`. One
  `@media (prefers-reduced-motion: reduce)` block sets `--dur: 0ms`.
  Check: grep styles.css.
- C47. Responsive: mobile-first base styles plus exactly one width
  breakpoint; every width media query in `docs/css/` is
  `@media (min-width: 720px)`. No `max-width` media queries.
  Check: grep.

## 9. Testing gates

- C48. `npm test` runs the full vitest suite: pipeline (merge, validate,
  determinism), engine, router, every view render, token parity (C38),
  contrast (C39), and glass scoping (C43). Suites live in `tests/` and use
  fixture data under `tests/fixtures/`, not the live curated.json, except
  the validation tests that run against the committed real files.
  Check: `npm test` exits 0; inspection that each listed area has a suite.
- C49. From a fresh clone, `npm ci && npm test` and `npm run build && npm
  run validate` all exit 0 with no network access required.
  Check: execution.
- C50. Tests may not be weakened to pass: no `.skip`, no `.todo`, no empty
  test bodies.
  Check: grep `tests/` for `.skip(`, `.todo(` finds nothing.

## 10. Nightly refresh (GitHub Actions)

- C51. `.github/workflows/refresh.yml` runs on `schedule` (cron, nightly) and
  `workflow_dispatch`. Steps in order: checkout, setup-node, `npm ci`,
  `npm run fetch` (overwrite the CSV snapshot), `npm run build`,
  `npm run validate`, `npm test`, then commit and push
  `data/epoch_notable_ai_models.csv` + `docs/data/models.json` only if
  changed. Any failing step aborts the job nonzero with no commit; the red
  run is the alert. The workflow declares `permissions: contents: write`
  (the push step fails on default token permissions otherwise). Uses only
  the default `GITHUB_TOKEN`; touches no other files; never edits
  curated.json or events.json.
  Check: inspection of the workflow file; the commit step is guarded by both
  test success (job ordering) and a git diff check.
- C52. A regular CI workflow runs `npm ci`, `npm run validate`, `npm test`
  on every push to `main`.
  Check: inspection of `.github/workflows/ci.yml`.

## 11. Screenshot harness (human eyeballing only)

- C53. `scripts/screenshot.js`, run via `npm run shots`, uses playwright
  (devDependency) to: serve `docs/` on a local port, then for each route in
  `#/catalog`, `#/model/:id` (an id present in the committed models.json),
  `#/compare?ids=` (two committed ids), `#/scenario` at each viewport
  375x812 and 1440x900 and each `colorScheme` `light` and `dark`, write a
  PNG to `shots/` named `{route-slug}-{width}x{height}-{theme}.png`. That is
  16 PNGs. No assertions, no diffing; it exits 0 after writing the files.
  Check: with playwright browsers installed, `npm run shots` exits 0 and
  `ls shots/*.png | wc -l` prints 16.
- C54. The harness is outside every quality gate: not referenced by
  `npm test`, the CI workflow, or the nightly workflow.
  Check: grep workflows and tests for `shots`/`screenshot` finds nothing.

## 12. Data schemas (excluded from the 500-line limit)

`scripts/validate.js` enforces these exactly (ajv or hand-rolled).

### 12.1 Model record (element of `models` in docs/data/models.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ModelRecord",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "organization", "releaseDate", "epochName",
               "pricing", "contextWindow", "benchmarks", "openWeights",
               "epoch", "sources"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9.]+)*$" },
    "name": { "type": "string", "minLength": 1 },
    "organization": { "type": "string", "minLength": 1 },
    "releaseDate": {
      "oneOf": [{ "type": "string", "format": "date" }, { "type": "null" }]
    },
    "epochName": { "type": ["string", "null"] },
    "pricing": {
      "type": "object",
      "additionalProperties": false,
      "required": ["inputPerMTok", "outputPerMTok", "currency"],
      "properties": {
        "inputPerMTok": { "type": ["number", "null"], "minimum": 0 },
        "outputPerMTok": { "type": ["number", "null"], "minimum": 0 },
        "currency": { "const": "USD" }
      }
    },
    "contextWindow": { "type": ["integer", "null"], "minimum": 1 },
    "benchmarks": {
      "type": "object",
      "additionalProperties": false,
      "required": ["gpqaDiamond", "swebenchVerified"],
      "properties": {
        "gpqaDiamond": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
        "swebenchVerified": { "type": ["number", "null"], "minimum": 0, "maximum": 100 }
      }
    },
    "openWeights": { "type": ["boolean", "null"] },
    "epoch": {
      "type": "object",
      "additionalProperties": false,
      "required": ["parameters", "trainingComputeFlop", "organization"],
      "properties": {
        "parameters": { "type": ["number", "null"], "minimum": 0 },
        "trainingComputeFlop": { "type": ["number", "null"], "minimum": 0 },
        "organization": { "type": ["string", "null"] }
      }
    },
    "sources": {
      "type": "object",
      "additionalProperties": { "enum": ["curated", "epoch"] },
      "description": "Keys are dot-paths of nullable stat/enrichment fields (e.g. pricing.inputPerMTok, releaseDate, epoch.parameters). A key is present iff the field is non-null; its value names the source that provided it."
    }
  }
}
```

### 12.2 Curated input record (element of data/curated.json)

Identical to 12.1 minus `epoch` and `sources` (those are pipeline outputs).
`releaseDate` in curated wins over the Epoch publication date when both exist.

### 12.3 Event (element of data/events.json and of `events` in the artifact)

```json
{
  "title": "Event",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "date", "title", "body", "modelIds"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$" },
    "date": { "type": "string", "format": "date" },
    "title": { "type": "string", "minLength": 1 },
    "body": { "type": "string", "minLength": 1 },
    "modelIds": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
  }
}
```

Every entry in `modelIds` must be an existing model `id` (validator check).

### 12.4 Artifact top level (docs/data/models.json)

```json
{
  "title": "ModelsArtifact",
  "type": "object",
  "additionalProperties": false,
  "required": ["generatedAt", "attribution", "models", "events"],
  "properties": {
    "generatedAt": { "type": "string", "format": "date-time" },
    "attribution": { "const": "Model metadata: Epoch AI, \"Notable AI Models\", CC-BY 4.0, https://epoch.ai" },
    "models": { "type": "array", "items": { "$ref": "ModelRecord" }, "minItems": 1 },
    "events": { "type": "array", "items": { "$ref": "Event" }, "minItems": 1 }
  }
}
```

Model `id` values are unique (validator check). Models sorted by `id` (C18).

## 13. Seed data note

The repository owner supplies `data/curated.json` (target: about 40 models,
and at minimum the anchors `gpt-4`, `claude-fable-5`, `muse-spark-1.1`,
`gpt-5.6`, `grok-4.5`) and `data/events.json` (at least one event). The loop
builds and tests against fixtures (C48), so code correctness never depends on
the live data being complete. If the committed curated.json is a small seed,
swapping in the full file later is a data-only change with no code edits.

## 14. Definition of done

All of the following hold at once, verified by the critic by execution:

1. Fresh clone: `npm ci && npm run build && npm run validate && npm test`
   all exit 0 offline (C49).
2. Every criterion C1 through C54 passes its stated Check.
3. Serving `docs/` locally (`python3 -m http.server` from `docs/`) renders
   the catalog with the committed data; all four routes work; a model with
   null fields shows em dashes and appears in no ranking that needs the
   missing field.
4. `npm run shots` (after `npx playwright install chromium`) produces
   exactly 16 PNGs in `shots/` (C53).
5. No file under `docs/` references anything outside `docs/`; the site
   works from a subpath (GitHub Pages project site).
6. `data/curated.json` and `data/events.json` have no loop-authored edits
   (C10, C11).
7. The words "game", "puzzle", "streak", "score" (as features) appear
   nowhere in `docs/` copy or code identifiers (section 1).
