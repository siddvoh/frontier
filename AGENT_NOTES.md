# AGENT_NOTES.md

Running notes between slice agents. Newest wave at top.

## Wave 13 (the magic layer)

### W13.S4 (picker front door, tests/w13s4.test.js)
- W11.S3 had already landed the mode cards, the storage-read stats, and
  the rules copy, so this slice only closed the gaps between the picker
  and the screens behind it. Its w11s3 assertions all stayed green.
- The daily card carries `p.game-mode-day` ("Frontier #N" via share.js)
  between the blurb and `.game-mode-stat`, matching the W13.S2 headline.
  Endless has no day element: it is not a dated run.
- Pre-launch (C76): with an injected date < LAUNCH_DATE the stat reads
  `Starts 2026-07-15.` and no day number renders. It no longer reads any
  daily record then, so a stale pre-launch record cannot show a score for
  a run that has not started.

### W13.S3 (streak stakes, tests/w13s3.test.js)
- PLAN FILE-LIST FIX (applied): w11s3 pinned "Streak 1" too, not just
  w8s1; both are in the file list and both rescoped.
- Markup: `.game-progress` holds `span.game-streak` (the count alone,
  matches /^\d+$/) plus `span.game-streak-label`. w8s1's progressText()
  helper now reassembles "Streak N · Best M" from that markup, so its
  exact-equality assertions kept their strength.
- The celebration compares against `bestAtStart`, captured once at render,
  NOT the live best: recordCorrect persists the new best immediately, so
  comparing to storage congratulates every correct answer. It also stays
  silent when bestAtStart is 0, since a first-ever run beats nothing.
  w13s3 pins both traps.
- Styles for `.game-streak` / `.streak-best` live in W13.S1: one slice per
  wave writes styles.css, so S2/S3/S4 stay markup-only and the wave can
  still be built in parallel.

### W13.S2 (results as a moment, tests/w13s2.test.js)
- `render(state, todayUtc, now = new Date())` gained a third parameter:
  the countdown reads the clock once at render. No timers anywhere (w13s2
  spies setInterval/setTimeout and pins zero calls); the screen states the
  wait, it does not tick.
- Results order: `.game-day` (h3, "Frontier #N") → `.game-score` (X/M) →
  `.game-squares` → `.game-best` (only when best > 0) → `.game-next-daily`
  → `.game-share` (muted, the copy source) → `.game-copy`. C72 needs the
  share string rendered, so it stays; it is quiet, not gone.
- CRITIC FIX: `.game-best` renders only when the best streak is > 0. Best
  streak is an endless stat and "Best streak: 0" is noise on a daily-only
  player's results.
- w8s2's pins needed no rescope: the reshape added around `.game-score`
  and `.game-share` rather than replacing them.

### W13.S1 (reveal choreography, tests/w13s1.test.js)
- PLAN FILE-LIST FIX (applied): the slice claimed no count-pin test needed
  changing. Wrong: w5s1/w7s2/w11s1 all pinned W5.S1's "transitions animate
  only color or border-color", which the press-in transform reshapes. The
  three suites joined the file list and the pin was NARROWED, not dropped:
  transform is allowed on `#game-cards button` and nowhere else (w5s1 now
  enumerates every rule with a transform transition and pins that list to
  exactly one selector), and the opacity/background/all bans are intact.
- Choreography: `#game-cards button` rests at translateY(0) scale(1);
  `.card-picked` presses to scale(0.99); `.card-correct` lifts to
  translateY(calc(-1 * var(--sp-1))) and carries the amended-C45 raised
  shadow. Lengths are tokens, so no raw px enters styles.css.
- The fade is on `.game-reveal` and `#game-cards .card-value` (all card
  values, not just correct/wrong ones: the unpicked card's value must
  animate identically or the pair reads broken when you answer right).
  Stagger is `animation-delay` on `button:nth-child(2) .card-value` =
  var(--dur); w13s1 pins every delay to 0ms or a token so reduced motion
  reaches them.
- animation-delay is NOT matched by the `animation\s*:` regex the motion
  pins use, so delays need their own assertion; w13s1 has it.
- Verified live: press scale(0.99), lift -4px, values opacity 1 after the
  fade. With reducedMotion=reduce, --dur-slow computes to 0ms and every
  state is fully applied 50ms after the click: the answer never depends on
  motion, only its tweening does.

## Wave 12 (STEP 3 design system)

- Wave 12 is self-contained: every STEP 3 value is normative in the
  PLAN.md Wave 12 preamble; W12.S1 transcribes it into SPEC.md verbatim,
  and S2/S3 implement from the same normative values, so all three
  slices are independent and file-disjoint (parallel is fine).
- Pin ownership: the pre-STEP-3 count pins live in w1s2/w7s2/w10s1/
  w11s1 (all owned by W12.S2) and the emoji squares pins in w8s2 (owned
  by W12.S3). Wave 13 slices own w8s2/w8s1/w11s3 respectively for the
  same reason; rescope at equal or greater strength, never weaken.

### W12.S3 (game state colors, tests/w12s3.test.js)
- Class contract, now three states on a card: `.card-picked` (the pick,
  accent border), `.card-correct` (the answer, success outline + raised
  shadow), `.card-wrong` (a wrong pick, danger border). A wrong pick
  carries BOTH card-picked and card-wrong; endless clears all three per
  question. W13.S1 choreography must keep these names.
- The verdict `<p>` carries `game-verdict` plus `verdict-correct` /
  `verdict-wrong`. Both views build it now; endless previously had an
  unclassed `<p>`.
- Squares contract (STEP 3): `.game-squares span` is an empty
  `role="img"` element with `data-correct="true"|"false"` and
  aria-label correct/wrong; CSS colors it. NO glyph text on screen. The
  C68 share string still carries the emoji squares and is built by
  share.js: w12s3 pins both halves, including "no glyph outside
  .game-share". W13.S2 reshapes this screen; keep the data-correct
  contract or own w12s3.
- Verified live in both themes: wrong border rgb(185,28,28) light /
  rgb(248,113,113) dark, correct outline rgb(21,128,61) / rgb(74,222,128),
  squares 16px token-colored blocks, share string "Frontier #2 2/3" with
  emoji intact.
- LOCAL-VERIFICATION GOTCHA: `currentUtcDate()` is UTC, so after ~20:00
  US Eastern the daily rolls to tomorrow. Seed daily records with
  `new Date().toISOString().slice(0,10)` (what scripts/screenshot.js
  does), never a hardcoded date, or the view renders a fresh game and
  your check times out waiting for #game-results.

### W12.S2 (tokens + styles, tests/w12s2.test.js)
- PLAN FILE-LIST FIX (applied): tests/w5s1.test.js also pinned
  box-shadow count 1 and was missing from the slice's file list; it was
  added to PLAN.md and rescoped with the others. If you add a shadow or
  a duration, FIVE suites pin it: w1s2, w5s1, w7s2, w10s1, w11s1.
- Do NOT add a second rule for an existing selector: W11.S1 already had
  `#game-cards button.card-correct` and `.chip:has(input:checked)`;
  STEP 3 upgrades those rules IN PLACE (--accent -> --success, plus the
  --accent-soft fill). w11s1 now pins "exactly one standalone
  card-correct rule" so a duplicate fails loudly. `.card-picked` keeps
  its accent border (the pick), `.card-wrong` is the new danger state.
- The amended C45 raised rule is a shared selector list
  (`#model-overlay, #game-cards button.card-correct`), pinned by exact
  sorted list in w1s2 and w12s2. Note this makes `card-correct` appear
  twice in the file (state rule + shadow list member): count standalone
  rules with `(^|\})\s*<selector>\s*\{`, never a bare substring match.
- The opacity pin in w11s1 was rescoped, not weakened: keyframe blocks
  are stripped before counting, and the assertion now also proves no
  button/state rule dims by opacity (stronger than the old bare count).
- HARNESS GOTCHA (do not "fix" the reveal): the reveal-in fade means
  game-*-reveal PNGs can capture .game-reveal mid-animation and show an
  empty gap. Verified live in both themes: opacity settles to 1 with the
  text present, correct outline rgb(21,128,61) light / rgb(74,222,128)
  dark, raised shadow at the right per-theme alpha. Same family as the
  W11 border-transition and W10 scroll-reset artifacts.
- W12.S3 owns applying `.card-wrong` in the views; until then the danger
  state has no live card (the CSS is ready and pinned).

### W12.S1 (STEP 3 transcription, tests/w12s1.test.js)
- SPEC.md gained a "# STEP 3: DESIGN SYSTEM" section (sections 24-25:
  amended tokens, then done-items 12-14) and "(Amended by STEP 3.)"
  stamps on exactly C37, C38, C39, C45, C46. No other SPEC line changed;
  C32 and the C53 32-shot count are explicitly untouched.
- STEP 3 numbering: new criteria would continue from C77, but the
  amendment needed none; it is entirely amendments to the five.
- w12s1 counts stamps with `^- C\d+\. \(Amended by STEP 3\.\)` per line,
  NOT a raw substring count: the section preamble quotes the stamp
  string, so a bare count returns 6. Keep the anchored regex if you add
  criteria.
- The spec is now the source w12s2/w12s3 implement against; if a value
  ever needs to change, change PLAN.md's normative block and SPEC.md
  together or w12s1 fails loudly.

## Wave 11 (polish inside the frozen token set; suite 670/670; all four slices done)

### W11.S2 (catalog chips and table typography, tests/w11s2.test.js)
- Row contract (w3s1/w5s4/w11s2 rescoped at equal or greater
  strength): 8 td cells per row. The standalone Organization column is
  gone; td[0] (.nowrap) holds the name link followed by a block
  `div.muted` org subline (white-space inherits, so the subline never
  wraps either). Indexes shifted: Released 1 (.nowrap), num columns 2-6,
  Weights 7 (span.badge iff openWeights non-null). Anything querying
  catalog cells by index must use the new positions.
- The hidden-select bridge is dissolved: #catalog-filter-org no longer
  exists; the checked `.chip-set input` boxes ARE the organization
  multi-select state (w11s2 pins "no backing select": the only selects in
  the view are catalog-sort-key/-dir). The filter-bar id list is now the
  four survivors (name, open, sort key, direction), pinned by w5s4 and
  w11s2; the chip-set stays the bar's immediate next sibling.
- update() reads checked chips directly; both `controls` and `chips`
  hosts get input+change listeners. There is no chip<->select sync code
  left to maintain.
- Shots re-run and inspected (catalog light/dark, 1440/375): subline
  layout, right-aligned numerics, badges, chip wrap at 375px with no
  body horizontal scroll all correct; left-anchored timeline strip in
  PNGs remains the known W10 capture artifact.

### Integration (by the wave orchestrator, inside W11.S1's styles.css)
- Two cross-slice bridges after the parallel slices landed: `.num` gained
  `text-align: right` (the W11.S2 bullet's "numeric columns right-aligned"
  is CSS and fell between the S1/S2 file lists; w5s1's .num test only pins
  tabular-nums), and a new standalone `.game-modes` rule (list-style none,
  padding 0) because the picker's new li.card blocks made the ul's default
  markers read as a defect.
- HARNESS GOTCHA (do not "fix" the app): game-endless-reveal PNGs show the
  picked card with a hairline border, but live the .card-picked border
  settles to var(--accent): verified getComputedStyle rgb(180,83,9) 500ms
  after click, unchanged across a fullPage capture. The harness screenshots
  the frame before the 150ms border-color transition runs. Same family as
  the W10 scroll-reset gotcha: verify answer-state styling in a live
  browser, never from the PNGs.
- Shots re-run and inspected after the bridges: catalog chips wrap at
  375px with no body horizontal scroll, numerics right-aligned in both
  themes, metric cards with deltas and lower-is-better notes, picker cards
  marker-free, hero game prompt, dark parity clean. The doubled squares
  row on game-daily-results is the known W13.S2 item, not a Wave 11
  regression.

### W11.S1 (stylesheet contracts, tests/w11s1.test.js)
- Chips: `.chip-set` works as a plain div or fieldset host (border/
  padding/margin zeroed, flex row, gap --sp-2); `.chip` is a label
  wrapping its own checkbox; the selected state is `.chip:has(
  input:checked)` (accent border and text), so markup needs NO selected
  class. `.chip input { margin: 0 }`; the native box stays visible.
- Button states: `button:hover:enabled` is an ink fill (bg --ink, text
  --bg); `button.ghost:hover:enabled` accent border/text on surface-solid
  (higher specificity beats the ink fill); `button:disabled` muted text,
  hairline border, full opacity. ALL hover rules are `:hover:enabled`;
  follow that pattern or disabled buttons light up. The only `opacity:`
  declaration left in styles.css is .overlay-scrim (w11s1 pins count 1).
- Game: `.game-prompt` is the hero (--font-display at --text-4, --ink;
  wins over .muted only because it is declared later at equal
  specificity). `#game-cards button` extended in place (ink text,
  surface-solid, hairline); id specificity means generic button hover/
  disabled rules never touch game cards. `#game-cards
  button.card-picked` accent border; `...card-correct` 2px accent outline
  + 2px offset; `.card-value` block, --text-2, tabular-nums.
- w11s1 pins every new W11.S1 rule block as transition/box-shadow/
  backdrop-filter free EXCEPT .chip (color+border-color only) and pins
  `#game-cards button` as containing no var(--accent). Never write a
  `:focus` pseudo-class in any `#game-...` selector (w7s2 regex ban).
- Pinned counts unchanged: box-shadow 1, backdrop-filter 2, one 720px
  query, --dur declared once.

- Markup gotchas: `fieldset.chip-set` carries legend "Organization" with
  one `label.chip[for=catalog-org-<i>]` per sorted org wrapping its
  checkbox + span; chip inputs can never live inside `.filter-bar` (w5s4
  pins the bar's input/select ids to exactly the four surviving
  controls); weights wrap in `span.badge` only when openWeights is
  non-null (null renders plain MISSING, no empty pill).

### W11.S3 (game screens)
- picker.js is now `render(state, todayUtc = currentUtcDate())`, the
  daily.js date-injection pattern; main.js one-arg dispatch unaffected.
  Structure kept: section.view-picker > h2 + p.muted + ul.game-modes;
  each li carries `.card` and holds a[href] (unchanged hrefs), the block
  p.muted blurb, and a new `p.game-mode-stat.muted` stats line ("Not
  played today." / "In progress: N of M answered." / "Done today: X/M."
  from getDailyRecord(todayUtc); "Best streak: N." from getBestStreak()).
  Reads only via the storage module; rendering never writes; no .glass
  (w9s1 counts intact).
- Answer states in both modes: correct button gains class `card-correct`,
  chosen button `card-picked` (both on one button when the pick was
  right); daily keeps data-picked="true" on the same element. Each button
  gets exactly one appended `span.card-value` INSIDE it (never a new
  #game-cards child; w8s1 pins the two-button children). Stat values
  format via STAT_REVEAL[field].format from ../reveal.js; scenario
  values are fmtUsd(costA)/fmtUsd(costB).
- endless.js resets per question in showQuestion(): the textContent
  assignment drops value spans and classList.remove clears both state
  classes; daily rebuilds cards per question.
- w11s3 pins the picker anchor list exactly (["#/game/daily",
  "#/game/endless"]), li.card count 2, and the p.game-mode-stat texts by
  containment; W13.S4 (picker front door) and W12.S4 (state recolor)
  must keep the class names and those texts or own tests/w11s3.test.js.
- `cardValues(question)` is deliberately duplicated in daily.js and
  endless.js: reveal.js was not in this slice's file list. Its canonical
  home is reveal.js; consolidation candidate below.

### W11.S4 (compare)
- The metric card IS the group element: `div.bar-group.metric-card
  [data-metric]`, so every existing .bar-group query holds; the existing
  h3 is the card heading; the two price groups append `p.better-lower`
  with textContent exactly "lower is better" after the h3.
- Deltas: each METRICS entry gained `digits` (2 price, 0 context, 1
  benchmarks) and `betterLower` (true only for prices). shown[i] =
  Number(value.toFixed(digits)); best = min(shown) for price groups else
  max. Every non-null row with shown[i] !== best appends `span.delta`
  INSIDE span.bar-value (after a single space text node), keeping the
  w5s5 3-sibling-cell contract. Text = format(gap) + (" more" |
  " behind"), a difference of displayed readings only (C19). Displayed
  ties (93.24 vs 93.21 both print 93.2) mean multiple leaders and NO
  delta; null rows never carry one.
- `.bar-value` textContent is no longer the bare value on trailing rows
  ("$4.00 $2.00 more"); w5s5's exact equality checks survive because
  they hit leader/null rows. New tests pinning trailing-row text must
  include the delta. Bar widths stay proportional to the raw non-null
  max including for prices; `.better-lower` is what flags the inverted
  direction there.

### Quality review (wave gate)
- Thermo-nuclear review verdict: approve. Recorded consolidation
  candidates, each needing a future slice that owns the files together:
  cardValues() into reveal.js (duplicated daily/endless);
  currentUtcDate() (now picker.js + daily.js); the el() builder
  (scenario/daily/endless) and the test fixture factories from the W10
  note still stand. styles.css is at ~895 lines and Waves 12-13 both add
  rules; watch the 1k-line boundary (a file split may be spec-
  constrained: tests assume exactly css/tokens.css + css/styles.css).

## Wave 10 complete (suite 596/596)

### W10.S2 (shared reveal module, docs/js/game/reveal.js)
- tests/w8s2.test.js is in this slice's file list; ONLY the stat-reveal
  assertions in its playthrough loop were rescoped (raw dot-path +
  String(value) containment became human label + spec-formatted values +
  a new negative assertion that the raw dot-path never renders: strictly
  stronger, the Wave 8 rescope precedent).
- reveal.js exports STAT_REVEAL (frozen label/format map keyed by the six
  C59 dot-path fields) and revealParagraphs(question, name) -> <p>[]
  ready to append inside a .game-reveal. `name` is an id -> display-name
  function so the module stays ignorant of how each view looks up models.
  Stat reveals are one line `Label: NameA value vs NameB value`; scenario
  reveals are the budget line plus both C26 formulas verbatim, formula
  lines carrying class "cost-formula" (in BOTH modes now; endless
  previously had no class there, no test pinned that).
- Both game views now import ../reveal.js and hold no local label map;
  w10s2 pins this by source grep (`from "../reveal.js"` present,
  "STAT_REVEAL =" and stat label/field literals absent from views). The
  daily budget line changed from "Budget: $X/mo" to the shared endless
  phrasing "Budget: $X for N Mtok in / M Mtok out per month".
- Hygiene: reveal.js must keep even comment text free of the literal
  tokens "local"+"Storage", "fetch(", "Math"+".random" (w10s2 and the
  w9s1 occurrence-counted greps both police it).
- Duplication candidates now at their worst and worth one future slice
  allowed to touch many files: the el() builder (scenario/daily/endless),
  modelName lookup, and the model()/artifact() test fixture factories
  (four test files). Verified: 596/596 green, `npm run shots` inspected
  (reveal shows "Release date: ... 2026-07-09 vs ... 2023-03-15", no
  dot-paths, both themes/viewports clean). 2026-07-15 is launch day, so
  the game-daily-results shot now captures real results (Frontier #1),
  not the C76 notice.

## Wave 10 (functional defect remediation; suite 586/586)

### Integration (by the wave orchestrator, inside W10.S1's styles.css)
- Cross-slice CSS bridged after the parallel slices landed:
  `.timeline-track[data-lanes="3".."6"]` min-height rules sized as
  calc(var(--text-1) * var(--lh-body) * (N+1)), one label line per lane
  plus the lane-0 line. Padding was tried first and does NOT work: the
  global border-box box-sizing means padding shrinks the content box
  under the track's inline `height: var(--sp-8)` instead of growing the
  box. min-height beats the inline height. Verified by execution: with
  the real 7-model artifact (deepest lane 4) the track grows to 97.5px
  and the worst label bottom sits exactly on the track box bottom.
- HARNESS GOTCHA (do not "fix" the scroll): the W10.S4 scroll-to-newest
  works in a live browser (measured scrollLeft 2019 of range 2028 on
  the committed data) but every harness PNG shows the strip at its LEFT
  end: Chromium's fullPage capture (captureBeyondViewport) resets inner
  scroll positions, measured scrollLeft 2019 -> 39 across a single
  page.screenshot({fullPage: true}) call. A left-anchored strip in
  shots/ is a capture artifact, not a regression; verify scroll behavior
  with a live browser, never from the PNGs.
- BROWSER-CACHE GOTCHA for live audits: a long-lived local browser
  serves stale docs/js modules and styles.css from memory cache even
  across location.reload(); a plain page.goto in a FRESH browser (what
  the harness does) gets current files. If a live check contradicts the
  code on disk, curl the served file and compare before diagnosing.
- Zero console errors verified across all routes in a fresh browser
  (the W10.S3 favicon landed); document scrollWidth == clientWidth at
  375px on catalog, model, compare, game (no body horizontal scroll).

### W10.S1 (scenario contract, nav containment, tick styles)
- .scenario-ranked suppresses ol markers (list semantics kept); each li
  is a 2-col grid below 720px (rank spans 3 rows) and a 3-col grid at
  >=720px (rank spans 2 rows, ranking-value in col 3, formula on its
  own row spanning cols 2 to -1). If scenario.js ever adds a fifth span
  per li, bump the .rank grid-row spans (base 3, wide 2).
- Header containment mechanism: #site-header nav gains overflow-x auto
  (zeroes its flex min-width so it shrinks and scrolls internally);
  base header gap tightened to --sp-2, desktop values restored inside
  the single 720px query; #site-header nav a and the outside-nav
  `#site-header > a[data-nav="game"]` get white-space nowrap. w10s1
  pins that body/html/#site-header carry no overflow declarations.
- .timeline-tick: absolute, top 50%, muted --text-1, hairline
  border-left as the tick rule, nowrap. Pinned counts re-asserted in
  w10s1: 1 box-shadow, 2 backdrop-filter, one 720px query.

### W10.S3 (data: favicon, clean console)
- Inline 16x16 PNG favicon as a data: href in index.html (base64
  checked free of http/rgb/#/gradient( and the C54 banned substrings;
  re-check those substrings if the icon is ever regenerated).
- tests/w1s1.test.js relative-path assertion gains exactly one
  allowance: `if (value.startsWith("data:")) continue;` after the
  epoch.ai exception, plus one positive favicon test. The w4s1 C2 grep
  needed no change (its offender predicate is startsWith("/")/
  startsWith("http"), which data: never trips).

### W10.S4 (timeline first-paint)
- New DOM contract: the strip carries data-scroll-target (percent of
  the newest dot); .timeline-track carries data-lanes (deepest occupied
  lane, consumed by the integration CSS above); .timeline-tick spans
  (2023..generatedAt year) carry inline left% only, 2023 clamps to 0%,
  raw percents > 100 omitted. Ticks are appended before dots so
  dot-order assertions hold.
- scheduleInitialScroll sets scrollLeft = target% of (scrollWidth -
  clientWidth) in a queueMicrotask, guarded by range > 0 so jsdom (no
  layout) is a no-op; it relies on the caller attaching the strip in
  the same task, which main.js's synchronous replaceChildren does.
- leftPercent, TIMELINE_START, assignLanes, render signatures and all
  C34 offsets unchanged; w3s1/w5s2 untouched and passing.

## Wave 9 (STEP 2 integration audit and harness; suite 552/552)

### Integration (by the wave orchestrator, inside docs/js/game/views/picker.js)
- The 32-shot inspection surfaced a picker run-on ("DailyTen questions...",
  "EndlessKeep answering..."): the mode blurb was an inline span glued to
  the link. Fixed by making the blurb a block-level p.muted (textContent
  unchanged, no inline styles, w7s1 assertions untouched); shots re-run and
  inspected clean in both themes at both viewports.

### W9.S1 (whole-game glass and hygiene audit, tests/w9s1.test.js)
- Renders 13 view states (all step 1 views, picker, endless rich/empty
  pool, daily post-launch/pre-launch/completed) and pins .glass to the six
  amended C43 ids; glass counts are pinned per game state (exactly 1 on
  question/results screens, exactly 0 on empty-pool endless and pre-launch
  daily). Adding glass to a new game sub-element needs a SPEC amendment.
- Fetch audit is now occurrence-counted: docs/js must contain exactly one
  `fetch(` and it must be in main.js; even a commented occurrence anywhere
  in docs/js fails w9s1.
- The key literal "frontier.game.v1" may appear exactly once in docs/js,
  as storage.js's STORAGE_KEY definition; every other file (comments
  included) must import STORAGE_KEY instead of restating the string.
- C75 completeness is marker-based: each area maps to a suite file that
  must exist AND contain a marker string (e.g. w6s2 must contain the
  pinned PRNG constant 1501764002). Relocating an area between test files
  requires updating the `areas` map in w9s1, intentionally.
- All sensitive grep tokens are built by concatenation in a single TOKENS
  map; keep that pattern when editing the file.

### W9.S2 (harness extended to game states, scripts/screenshot.js)
- Harness now shoots 8 states (the 4 step 1 routes plus game-picker,
  game-endless-question, game-endless-reveal, game-daily-results) at both
  viewports and themes: 32 PNGs. The reveal state is the endless route
  plus a click on the first `#game-cards button` (a single clickOptionA
  boolean on that state's table entry, not a second code path).
- Every browser context seeds the schema-12.6 completed daily record via
  context.addInitScript before page scripts run, keyed to the run's
  current UTC date; only the daily view reads it, so the other states are
  unaffected. The harness imports STORAGE_KEY from docs/js/game/storage.js
  (safe: no top-level side effects); keep that import working if
  storage.js is restructured.
- Until 2026-07-15 the game-daily-results shot legitimately captures the
  C76 pre-launch notice instead of #game-results (PLAN anticipated this);
  re-running the harness on or after launch day captures real results
  with no harness change.
- tests/w9s2.test.js repeats listFiles/offenders (w4s3) and the SPEC
  fence extraction (w6s2) because the slice could not touch other test
  files; with w9s2 that duplication now spans three files, a candidate
  for a future shared tests/ helper slice.

## Wave 8 (game views; suite 533/533)

### Integration (by the wave orchestrator, inside tests/w7s1.test.js)
- Two stub-era w7s1 assertions asserted the deleted W7.S1 stub behavior and
  were rescoped to the spec, not weakened: "renders identically with a seeded
  endless route" (seed=42 vs seed=null; null now legitimately uses Date.now())
  became same-seed determinism (seed=42 twice, C63), and "adds no .glass in
  any game view" became ".glass only on #game-cards / #game-results" per the
  amended C43. W9.S1 positively asserts the whitelist across all views.
- Today's real date (2026-07-13) is pre-launch, so a live `#/game/daily`
  renders the C76 notice; W9.S2's daily-results shot will capture the notice
  until 2026-07-15 (already anticipated by that slice's PLAN text).

### W8.S1 (endless mode question screen)
- endless.js render(state): seed = `state.route.seed ?? Date.now()`, stream
  from endlessQuestions(seed, artifact); the generator is pulled lazily, one
  question per next-click, so a seeded run replays exactly (C63). Empty
  candidate pool renders section.view-endless with h2 + p.muted note and NO
  #game-cards (no .glass): W9.S1's whitelist audit must tolerate an endless
  render without glass when the fixture pool is empty.
- DOM contract (question screen): section.view-endless > h2 "Endless",
  p.game-progress.muted with text exactly `Streak ${n} · Best ${m}`
  (middle dot, live-updated), p.game-prompt (intentionally unstyled; daily
  reuses the class), div#game-cards.glass holding exactly two
  `<button type="button">` children labeled with model names (id fallback),
  then an anonymous div that is empty pre-answer and holds div.game-reveal +
  button.game-next ("Next question") post-answer.
- Answer flow: clicking an option disables both buttons (extra clicks
  ignored); streak flows ONLY through storage.js recordCorrect(currentStreak)
  / recordWrong(), best read via getBestStreak() on every progress repaint.
  Reveal first line is "Correct." or `Not quite: ${winnerName}.`; stat
  templates then one line `${label}: ${nameA} ${fmt(valueA)} vs ${nameB}
  ${fmt(valueB)}` (fmtUsd/fmtInt/fmtScore/fmtDate per field); scenario
  templates three lines: `Budget: ${fmtUsd(budget)} for ${in} Mtok in /
  ${out} Mtok out per month`, then `${nameA}: ${formulaA}` and `${nameB}:
  ${formulaB}` with the C26 formulas verbatim. .game-next pulls the next
  generator value and repaints in place (no re-render).
- GOTCHA: the C19/C65 hygiene greps mean even comments in endless.js must
  avoid the literal tokens "Math" + ".random", "local" + "Storage",
  "fetch(" (w8s1 pins this on the file).
- W9.S2 harness: `#/game/endless?seed=1` shows the question immediately (no
  start gate); clicking either `#game-cards button` produces the reveal
  state; .game-next advances.

### W8.S2 (daily mode flow with results screen)
- daily.js exports `render(state, todayUtc = currentUtcDate())`: the second
  parameter is the date-injection hook, a UTC "YYYY-MM-DD" string defaulting
  to the current UTC date. main.js's generic one-arg dispatch needs no change.
- DOM contract: section.view-daily > h2 "Daily" > div.game-body (unstyled
  container so the flow can replaceChildren without touching the heading).
  Question screen inside .game-body: p.game-progress.muted ("Question q of
  M"), p.game-prompt (question.prompt verbatim), div#game-cards.glass with
  exactly two `<button type="button">` cards (textContent = model name,
  data-index "0"/"1"). After an answer both cards disable, the picked one
  gets data-picked="true", and div.game-reveal + button.game-next append.
  Reveal shows a .game-verdict line ("Correct!"/"Not quite.") then real C60
  values: stat templates render the dotted field path plus
  `${name}: ${fmtText(value)}` per option; scenario templates render
  `Budget: ${fmtUsd(budget)}/mo` plus both C26 formulas verbatim in
  p.cost-formula lines. game-next reads "Next question", or "See results" on
  the last question.
- Results screen (completed record, or after the last reveal):
  div#game-results.glass > p.game-score (contains "X/M"), div.game-squares
  (one span per question, U+1F7E9/U+1F7E5 in question order), pre.game-share
  (textContent is the exact buildShareString output including the newline),
  button.game-copy "Copy result". The copy handler awaits
  copyShareString(shareText) with default env; on resolved true it sets
  textContent "Copied" and data-copied="true"; on false it stays idle. jsdom
  tests stub the fallback path by assigning document.execCommand (Node's
  global navigator has no clipboard, so the copy helper falls through to the
  document path).
- Persistence: one saveDailyRecord(date, record) upsert per answer;
  `completed` flips true on the final answer. On render, a stored completed
  record (or picks.length >= M) short-circuits to results with zero writes;
  an in-progress record whose questionIds deep-equal the regenerated ids
  resumes at index picks.length; a mismatched in-progress record restarts
  fresh (overwritten on the next answer). Rendering itself never writes.
- Pre-launch (C76): todayUtc < LAUNCH_DATE (ISO string compare, LAUNCH_DATE
  imported from share.js) renders h2 + p.muted containing "2026-07-15",
  generates no questions, no #game-cards/#game-results, zero storage writes.
  An empty question pool renders a muted note.
- Testing gotchas for W9: vi.mock on the storage module wrapping
  saveDailyRecord/saveState in vi.fn(actual.fn) gives write spies without
  weakening behavior; a two-fully-populated-model fixture yields exactly 8
  questions covering all eight templates, so a full playthrough exercises
  both reveal shapes deterministically.
- Duplication candidates for a future slice allowed to touch multiple files:
  the el() builder (scenario.js + daily.js), model-name lookup, and shared
  card/reveal markup between daily.js and endless.js.

## Wave 7 (game shell: routes, stub views, styles; suite 505/505)

### W7.S1 (game routes, picker, stub views)
- router.js route states (C70): `#/game` -> `{ view: "picker" }`;
  `#/game/daily` -> `{ view: "daily" }`; `#/game/endless` ->
  `{ view: "endless", seed: number|null }`. Only endless carries seed
  (spec C70); it parses via the router's parseNum, so a missing, empty,
  or non-numeric `?seed=` is null, never a default. `?seed=` on `#/game`
  or `#/game/daily` is ignored. Every other `#/game/...` (unknown mode,
  extra segments) resolves to the picker; unknown top-level routes still
  resolve to the catalog. toHash: "#/game", "#/game/daily",
  "#/game/endless" or "#/game/endless?seed=" + String(seed);
  parseHash(toHash(state)) round-trips all four game states.
- Game views live in docs/js/game/views/{picker,daily,endless}.js, each
  exporting `render(state) -> HTMLElement` per the W2.S3 contract
  (state = { route, data }, global document, never fetch). Wave 8 slices
  rewrite daily.js (W8.S2) and endless.js (W8.S1) wholesale: nothing
  else imports their internals, only main.js imports their render.
  W8.S1 reads the seed from `state.route.seed` (already a number or
  null); the stub currently ignores it.
- DOM hooks: picker renders `section.view-picker` with `ul.game-modes`
  holding `a[href="#/game/daily"]` and `a[href="#/game/endless"]`; the
  stubs render `section.view-daily` / `section.view-endless`, each an
  h2 plus `p.muted`. No `.glass` anywhere in game views yet: Wave 8
  markup introduces `#game-cards` / `#game-results` carrying it per the
  amended C43.
- main.js: VIEWS gained picker/daily/endless (generic dispatch branch,
  no game special cases in renderRoute or the delegates). GOTCHA: the
  Game link is `#site-header > a[data-nav="game"]`, a sibling AFTER the
  injected nav, NOT inside it, because w4s1 pins `#site-header nav a`
  to exactly 3; w7s1 pins the outside-nav placement. Styling or audits
  touching header links must target `#site-header a` (or add a rule for
  the data-nav="game" anchor), not `#site-header nav a`.
- tests/w7s1.test.js covers route parses (incl. unknown sub-routes and
  seed semantics), round-trips, step 1 route regression, pure view
  renders with a throwing-fetch guard, and main.js dispatch/nav.

### W7.S2 (game styles)
- Wave 8 class contract: `#game-cards` (grid host for the two option
  `<button>` cards, must carry `.glass` in markup; 1fr 1fr at >=720px),
  `#game-cards button` (width 100%, min-height var(--sp-8) = 64px tap
  target, no extra class needed), `.game-progress` (streak / "q of M",
  muted text-1 tabular-nums), `.game-reveal` (hairline panel for C60
  values), `.game-next` (block next-question button), `#game-results`
  (results panel, must carry `.glass`), `.game-squares` (flex row of
  per-question squares), `.game-copy` (C69 copy button).
- `#game-cards` and `#game-results` deliberately declare NO background /
  box-shadow / backdrop-filter: glass comes only from the `.glass` class
  per amended C43. w7s2 asserts this negatively; do not "fix" it.
- All game rules are standalone selectors (never appended to `button`,
  `input, select, textarea`, etc.) to keep the w5s1 ruleBlock exact
  comma-entry convention intact. No transitions in any game rule; focus
  is the untouched global `:focus-visible` accent outline.
- Pinned counts unchanged: box-shadow 1, backdrop-filter 2, one
  `min-width: 720px` query (game two-up rule lives inside it), no
  `gradient(`, no raw colors in styles.css.
- Helper drift note: braceBlock/ruleBlock/tracks CSS-parsing helpers are
  now duplicated across w1s2/w5s1/w7s2 test files (repo convention of
  self-contained tests). A future slice allowed to touch multiple test
  files could extract tests/css-helpers.js.

## Wave 6 (game data and pure logic; suite 464/464, build + validate OK)

### W6.S2 (question generator, docs/js/game/questions.js)
- Exports: xmur3, mulberry32 (C58 listing byte-identical to SPEC, never
  touch; w6s2 re-extracts the SPEC fence and asserts source containment),
  dailySeed(utcDateString) = xmur3(str)(), TEMPLATE_IDS (frozen, eight C59
  ids in pool-enumeration order), makeQuestion(templateId, modelA, modelB),
  generateDaily(seed, artifact), generator endlessQuestions(seed, artifact).
- Pinned PRNG constants: xmur3("2026-07-15")() = 1501764002; first three
  mulberry32 outputs 0.3059037704952061, 0.6339699849486351,
  0.33315296238288283.
- Questions are `{ id, templateId, prompt, optionA, optionB, correctIndex,
  revealData }`; optionA/optionB are model ids in display order
  (rng-flipped) while id is always `${templateId}:${idLow}:${idHigh}`
  lexicographic. makeQuestion returns null for invalid pairs (null field,
  equal values; scenarios: uncomputable/equal costs, null contextWindow)
  and follows its argument order, so views can rebuild a question from ids.
- Stat revealData is `{ field, valueA, valueB }` (dotted artifact path,
  values in display order; releaseDate compared as ISO strings, earlier
  wins stat-released-first, higher wins otherwise). Scenario revealData is
  `{ budget, inputMTok, outputMTok, costA, costB, formulaA, formulaB }`:
  budget is the exact unrounded midpoint (format in the view, never here)
  and formulas are verbatim computeCost output; render untouched.
- generateDaily needs only artifact.models and artifact.surprises, returns
  min(10, poolSize) questions unique by (pair, template), guarantees
  min(2, validSurpriseCount) surprise-derived questions, same seed +
  artifact deep-equal. endlessQuestions never reads the clock: the W8.S1
  caller passes Number(?seed) or Date.now(); yields forever (skips
  back-to-back repeats when pool > 1), returns immediately on empty pool.
- Imports only ../engine.js; keep even the literal string "Math.random"
  out of the module (C19 grep).

### W6.S3 (storage, docs/js/game/storage.js)
- The only localStorage touchpoint in docs/js, single key
  STORAGE_KEY = "frontier.game.v1", schema 12.6. Exports: defaultState()
  -> fresh `{version:1, endless:{best:0}, daily:{}}`; loadState() reads
  and validates, degrading to the default on any failure (corrupt JSON,
  wrong version, schema violation, missing/throwing localStorage), never
  throws; saveState(state) validates and returns true iff persisted;
  isValidState(state) is the exported schema predicate.
- Streaks (C64): the running streak lives in view state, not the module.
  getBestStreak() returns the persisted best; recordCorrect(currentStreak)
  returns currentStreak + 1 and persists it as the new best when it
  exceeds the stored best (non-integer/negative input starts a run at 1);
  recordWrong() returns 0 and leaves the persisted best untouched.
- Daily (C67 groundwork): getDailyRecord(date) takes a UTC "YYYY-MM-DD"
  string, returns the stored `{questionIds, picks, correct, completed}`
  record or null; saveDailyRecord(date, record) upserts (overwrite-in-
  place is how in-progress answers are recorded), returns true iff
  persisted, rejecting malformed date keys, extra/missing record fields,
  picks outside {0,1}, or non-boolean correct entries.
- All writes go through saveState, so a failing/quota-exceeded
  localStorage means false returns but the app keeps running in-memory.

### W6.S4 (share string + copy helper, docs/js/game/share.js)
- Exports LAUNCH_DATE = "2026-07-15" (the single declaration; C76 views
  should import it from here), dayNumber(dateString) (UTC "YYYY-MM-DD" ->
  C68 day number, launch day = 1), buildShareString(record, dateString)
  (reads only record.correct: boolean[] in question order; returns exactly
  `Frontier #${N} ${X}/${M}` + "\n" + M squares, U+1F7E9 per true,
  U+1F7E5 per false, no trailing newline), and async
  copyShareString(text, env = {}).
- copyShareString never rejects: resolves true when copied (this boolean
  IS the button's copied state, so W8.S2 should await it and flip the
  button on true), false otherwise. env accepts optional { navigator,
  document } overrides for jsdom stubs. Prefers
  navigator.clipboard.writeText; else readonly textarea +
  document.execCommand("copy"), textarea removed before resolving.
- Zero imports, no storage, no fetch, no Math.random; w6s4 pins the exact
  string bytes and both copy paths.

### W6.S5 (w4s1 game-word audit rescoped to C74)
- The step 1 game-word audit in tests/w4s1.test.js no longer greps all of
  docs/; it greps exactly six files: docs/js/views/catalog.js, model.js,
  compare.js, scenario.js, timeline.js, docs/js/engine.js. Within those,
  "game", "puzzle", "streak", "score" (case-insensitive) remain banned
  outright, with only the pre-existing fmtScore and "benchmark score"
  allowances. The test asserts each of the six files exists before
  grepping, so moving/renaming a step 1 view module fails w4s1 rather
  than silently narrowing the audit.
- docs/js/game/, router.js, main.js, styles.css, docs/data/, index.html,
  and tests/ are exempt from the game-word ban per SPEC section 14, but
  every docs/ file (including new game files) is still covered by w4s1's
  other audits: absolute refs limited to the single epoch.ai link, .glass
  only on whitelisted ids, backdrop-filter and --surface-glass confined
  to the one @supports .glass rule, no .skip(/.todo( under tests/.

### W6.S1 (surprises pipeline)
- data/surprises.json flows through as top-level `surprises` in the
  artifact, copied verbatim by buildArtifact (new optional `surprises`
  param; when undefined the key is omitted, preserving the pre-surprise
  12.4 shape that w1s3/w2s1 fixtures rely on).
- Presence semantics: on the default (repo data) path surprises.json is
  required and a missing/invalid file fails both scripts loudly (C55); in
  an override dir a missing surprises.json skips gracefully ("skipping
  surprises check"), mirroring the W1.S3 artifact convention, so
  pre-Wave-6 fixtures stay valid without edits. resolvePaths in both
  scripts now returns `surprises` and an `isOverride` flag.
- validateArtifact takes an optional second arg `{ requireSurprises }`
  (default false, old call sites unchanged); the artifact `surprises` key
  is required exactly when a surprises input was checked, and entries get
  the C56 non-null/differing-value cross-check.
- New validate.js exports: SURPRISE_FIELDS (six C59 dot-path fields),
  validateSurprises(surprises, knownModelIds, path?),
  checkSurprisesAgainstModels(surprises, models, path?).
- Gotcha: w1s3 asserts exact violation strings, and the modelIds checks
  for events and surprises now share checkModelIdList/checkModelIdsExist;
  keep those messages stable. loadJson/resolvePaths (and now the surprises
  presence predicate) remain duplicated merge/validate; a future slice
  owning scripts/lib/ may consolidate.


### Integration (by the wave orchestrator, inside W5.S1's styles.css)
- Cross-slice CSS bridged after the parallel slices landed: timeline
  `data-anchor`/`data-lane` styling (custom props --anchor-shift/--lane-shift
  on .timeline-dot, translate() percentages, lanes 1-6 enumerated),
  `.form-grid .constraints` + `.form-grid button` spanning `1 / -1` at
  >=720px, and `.field-check` inline checkbox rules.
- Docking lives on the #compare-tray host, not the details: a
  `#compare-tray .tray-docked` rule resets position/border/padding/margin
  so the nested details is only a toggle. Without it two fixed elements
  render (an empty glass pill plus an escaped sheet). Any future tray
  markup change must keep either the host id or that override in sync.
- tests/w2s3.test.js "concrete inputs" now passes a fully runnable input
  (both volumes non-null): the old partial input relied on the always-on
  summary that W5.S6 removed by design. Assertion strength unchanged.
- model.js fmtCount renders "1,800,000,000,000 (1800000000000)": the
  parenthesized raw digits exist because w3s2 asserts String(value)
  verbatim in the overlay text. Cosmetic candidate for a future slice
  (would need w3s2 + w5s3 assertion updates together).

### W5.S1 (stylesheet remediation)
- Transitions exist only for color/border-color on a, input/select/textarea,
  button; w5s1 enforces this for every transition declaration. No opacity/
  background/all transitions ever again.
- Layout classes: .table-scroll (overflow-x auto), .filter-bar (grid,
  single row via grid-auto-flow: column at >=720px), .nowrap, .num
  (tabular-nums), .bar-row (3-col grid minmax(0,1fr) 2fr auto),
  .form-grid (1fr 1fr at >=720px), .tray-docked (bottom sheet, right-docked
  >=720px, body:has() clearance keyed on :not([hidden])), .overlay-scrim
  (fixed, var(--ink) + opacity .4, z-index 19 under #model-overlay's 20),
  .timeline-track (2-row grid, ::before hairline axis).
- w5s1's ruleBlock helper matches selector lists by exact comma-separated
  entry: keep selector entries exactly "input", "button", ".bar-row" etc.
  when splitting rules, or update the test.
- Focus ring stays the global :focus-visible accent outline. box-shadow
  count (1) and backdrop-filter count (2) are pinned.

### W5.S2 (timeline lanes/anchors)
- New export assignLanes(percents) -> lanes, pure; smallest free lane among
  dots within COLLISION_PERCENT = 2 (inclusive), walked in ascending x
  (ties by input index). Lane numbering follows ascending x, not input
  order; w5s2 pins [98, 97, 98] -> [1, 0, 2].
- Dots and markers carry data-anchor="start|end" ("end" iff percent > 50;
  exactly 50 is "start"); dots carry data-lane. Old alternating inline top
  vars removed: vertical placement is CSS's job now.
- leftPercent/TIMELINE_START/render signatures unchanged; jsdom gotcha:
  enumerate inline styles via style.length + style.item(i).

### W5.S3 (overlay over live catalog)
- main.js model route: one replaceChildren(catalog, scrim, overlay); scrim
  div carries data-action="overlay-close" so the single #app delegate
  closes on scrim click too. injectOverlayClose + markCatalogSelection both
  run at the model route. Row-click compare toggling stays gated on
  view === "catalog", so rows under the scrim are inert by design.
- model.js fmtCount (local, util.js untouched): exponent strings (>=1e21)
  verbatim; otherwise toLocaleString("en-US") + " (raw)". Null falls
  through to fmtText -> MISSING. Never mutates the stored value.
- docs/js still has exactly one fetch( (main.js); keep comments free of
  the token.

### W5.S4 (catalog containment)
- Table sits inside div.table-scroll (direct child of section); anything
  querying section > table must use .table-scroll > table.
- Controls div is "catalog-controls filter-bar" (grid-2 dropped); order
  pinned by w5s4: name, org, open, sort key, direction. Listeners still
  bubble to .catalog-controls.
- COLUMNS tuples are [header, formatter, tdClass]: Released -> nowrap, the
  five numeric columns -> num, applied on every td including MISSING cells.
  Header th elements intentionally carry no such classes.

### W5.S5 (compare rows/tray)
- Bar rows: exactly 3 sibling cells via one row.append(label, barCell,
  valueEl): span.bar-label, div.bar-cell, span.bar-value. bar-cell is
  ALWAYS present; null metrics leave it empty (no .bar/.bar-track) and add
  .bar-row-missing. w5s5 pins children length 3, so nest any extras inside
  a cell.
- Tray content is one details.tray-docked (no .glass) inside div#compare-tray
  .glass; summary text is exactly "N of 3 selected" (w5s5 asserts equality).
  Old h3 + p.muted capacity line are gone. Collapsed by default (no open
  attribute); jsdom's summary.click() toggles details.open in tests.

### W5.S6 (scenario form/empty state)
- #scenario-form carries .form-grid; direct children in order: four
  div.field.field-pair (budget, task, in, out), fieldset.constraints
  (legend "Constraints", checkbox first via .field-check with input BEFORE
  label), submit button. w5s6 pins the order.
- Summary (p.scenario-summary.muted) renders only when isRunnable(input)
  (budget, task, both volumes non-null), exactly when the engine runs, so
  it never shows MISSING. The MISSING marker w3s4 expects for all-null
  input lives in the muted prompt: "Enter a budget, task, and both token
  volumes to rank models. Until then every scenario value is " + MISSING +
  "." Keep the phrase "Enter a budget" and the interpolation; w5s6 also
  asserts "Budget " + MISSING never appears.
- Helpers: labeledField (.field), pairedField (+field-pair), checkboxField
  (control-first, .field-check).

## Wave 4

### W4.S1 (final wiring, glass scoping, whole-suite audit)
- main.js wiring: catalog row clicks toggle compare selection via
  compare.js's toggleCompareId (clicks on the name link are ignored); rows
  get aria-selected markers and the Compare nav link href carries the
  current ids (`a[data-nav="compare"]`), so the tray reproduces from the
  hash. Tray remove buttons and the injected overlay Close button
  (data-action="overlay-close", plus Escape) are handled by one click
  delegate on #app; navigate() renders directly and hashchange re-renders
  idempotently.
- Scenario submission rounds raw form strings through the router itself:
  scenarioFormHash builds params from the named controls (empty controls
  omitted, checkbox -> open=1) and returns toHash(parseHash(...)), so
  router.js remains the single owner of the null-never-default semantics.
  Do not reintroduce bespoke form parsing in main.js.
- The overlay Close button is injected by main.js after render (views stay
  pure and W4.S1 could not edit view files); anything restyling the overlay
  should keep `[data-action="overlay-close"]`.
- w4s1 audit greps to respect from now on: `.glass` only on the four C43
  ids (asserted per rendered view and in index.html); backdrop-filter and
  --surface-glass usages only in the single @supports .glass rule; no
  ".skip("/".todo(" anywhere under tests/; docs/ absolute refs limited to
  the one epoch.ai href; "score" in docs/ only as fmtScore or the phrase
  "benchmark score" (game/puzzle/streak banned outright).
- The findModel/label-wrapper unification suggested by W3.S2 was out of
  scope for main.js-only edits and remains open for any future slice that
  owns util.js and the views together.

### W4.S3 (screenshot harness)
- Verified by execution: `npx playwright install chromium` (playwright 1.55+
  needed the chromium-headless-shell v1228 download), then `npm run shots`
  exited 0 and wrote exactly 16 PNGs to the gitignored output dir, named
  `{route-slug}-{width}x{height}-{theme}.png` (slugs catalog, model-gpt-4,
  compare, scenario; committed ids gpt-4 and claude-fable-5 for compare).
- scripts/screenshot.js is dep-free apart from playwright: a node:http
  static server on an ephemeral port serves docs/ (path-traversal guarded),
  one browser, one context per viewport+colorScheme combo, `waitUntil:
  "networkidle"` per route so the single models.json fetch lands before
  capture. Kept free of Math.random / `?? 0` / `|| 0` (C19 greps scripts/).
- tests/w4s3.test.js does the C42/C40/C5/C19 hygiene greps by recursive
  file scan; it never mentions the harness, satisfying the C7/C54 string
  ban without the String.fromCharCode trick (nothing to reference).

### W4.S2 (CI + nightly refresh workflows)
- ci.yml: push-to-main only, ubuntu-latest, node 22, `npm ci` then
  `npm run validate` then `npm test`; permissions locked to contents: read.
- refresh.yml: cron "30 3 * * *" plus workflow_dispatch; steps checkout,
  setup-node, npm ci, fetch, build, validate, test, then a single
  commit-and-push step. The push step exits 0 early via
  `git diff --quiet -- data/epoch_notable_ai_models.csv docs/data/models.json`
  and `git add`s exactly those two paths; permissions contents: write,
  default GITHUB_TOKEN only (no `secrets.` or `${{` anywhere).
- C54 note for W4.S1/W4.S3 audits: the SPEC's C54 check also greps the
  WORKFLOW files for the banned tool strings, so neither yml mentions the
  harness; tests/w4s2.test.js asserts this using the w1s1
  String.fromCharCode pattern. w4s2 also asserts ci.yml has no
  pull_request/schedule trigger; keep ci.yml push-to-main only.

## Wave 3 (W3.S1-W3.S4, all done; suite 237/237)

### W3.S4 (scenario view)
- Form contract for W4.S1 wiring: `<form id="scenario-form">` with control
  ids scenario-budget/-task/-in/-out/-open/-min-ctx/-after/-before and
  `name` attributes exactly matching the router scenario query keys
  (budget, task, in, out, open, minCtx, after, before), so main.js reads
  the form and builds the hash via `toHash`. Checkbox checked maps to
  `openWeightsOnly: true`; empty controls must map to null, never 0. The
  task select has an empty "" option for unset.
- Result DOM: ranked entries are `#scenario-results ol.scenario-ranked >
  li[data-model-id]` containing `.rank`, `.model-name`, `.ranking-value`
  (labeled "SWE-bench Verified" / "GPQA Diamond" / "Context window"),
  `.cost-formula` (engine's C26 string verbatim). Excluded entries are
  `details.scenario-excluded li[data-model-id][data-reason]`, collapsed by
  default. `#scenario-results` carries `.glass` per the C43 whitelist.
- The engine runs only when budget, task, and both volumes are non-null;
  otherwise a muted prompt renders and nothing is ever defaulted. For
  longdoc, one `.ranking-value` line ("Context window: N") serves both C33
  requirements since contextWindow is the ranking field.

### W3.S3 (compare view)
- compare.js exports `render(state)`, pure `toggleCompareId(ids, id)`
  (no-op at cap, toggle-off on reselect, never mutates), and
  `MAX_COMPARE = 3`. W4.S1 must route catalog selection through
  toggleCompareId when wiring the tray; tray remove buttons carry
  `data-action="compare-remove"` and `data-model-id` for event delegation.
- Bar groups are `.bar-group[data-metric]` with keys input-price,
  output-price, context-window, gpqa-diamond, swebench-verified; rows are
  `.bar-row[data-model-id]` (null rows add `.bar-row-missing` and have no
  `.bar`/`.bar-track`). Widths proportional to the group's non-null max at
  100%; an all-null group renders rows with no bars.
- render defensively slices route ids to 3, so a hand-typed URL cannot
  compare 4; unknown ids are dropped with a visible muted note. `#compare-tray`
  carries `.glass` per the C43 whitelist.

### W3.S2 (model card overlay)
- DOM contract: `#model-overlay.glass` > h2 name, `dl.grid-2` field rows
  (dt label + dd value, provenance `span.badge[data-source="epoch"|"curated"]`
  with visible text "Epoch"/"curated" via a SOURCE_LABELS map), h3 "Epoch
  enrichment" + second dl (parameters, trainingComputeFlop, epoch
  organization via fmtText), `section.model-events` with `article.card` per
  matching event (time[datetime], h4 title, p body) and a muted empty-state
  paragraph when no events match. Not-found id renders "Model not found"
  inside `#model-overlay`.
- A provenance tag renders iff the dot-path key exists in `sources`
  (pipeline's key-present-iff-non-null rule), so null fields get no tag.
- `models.find(m => m.id === ...)` is now duplicated in model.js and
  compare.js; W4.S1 (which owns main.js wiring) should promote a
  `findModel` helper into util.js per the W2.S3 note. Also worth unifying
  then: catalog's `labeled()` vs scenario's `labeledField()` near-duplicate
  label wrappers, and scenario's compact `el()` builder vs the verbose
  createElement chains in the other views.

### W3.S1 (catalog + timeline)
- catalog.js exports `render(state)` plus pure `filterModels(models,
  {organizations, openWeightsOnly, nameQuery})`, `sortModels(models, key,
  "asc"|"desc")`, `SORT_KEYS` (keys: releaseDate, inputPrice, outputPrice,
  contextWindow, gpqaDiamond, swebenchVerified). Control ids:
  `#catalog-filter-org` (multi select), `#catalog-filter-open` (checkbox),
  `#catalog-filter-name` (text), `#catalog-sort-key`, `#catalog-sort-dir`
  (default releaseDate/desc). Rows carry `data-model-id`; tbody re-renders on
  input/change bubbled to `.catalog-controls`. Filter/sort state is local to
  the view (C28 requires hash state only for compare/scenario), so W4.S1
  needs no extra wiring for catalog interactivity.
- Open-weights toggle checked means `openWeights === true` only (null
  excluded, matching engine C24); unchecked means no filter. Sorts put nulls
  last in both directions, then id ascending for a total order.
- timeline.js exports `render({models, events, generatedAt})`,
  `leftPercent(dateIso, generatedAt)`, `TIMELINE_START = "2023-03-01"`.
  Dots are `a.timeline-dot` (href `#/model/:id`, native hash navigation);
  markers are `button.timeline-event` (accent via `var(--accent)`) toggling
  `.timeline-event-detail[hidden]`. All positioning inline with `left: N%`;
  inline styles use only percentages, "0", and var() tokens per W1.S2.

## Wave 2 (W2.S1-W2.S3, all done; suite 160/160, build + validate OK)

### W2.S3 (router, util, main, stub views)
- router.js: pure `parseHash(hash)` / `toHash(state)`. Route states:
  `{ view: "catalog" }` (default, empty, unknown routes, and `#/model/` with
  no id); `{ view: "model", id }`; `{ view: "compare", ids: string[] }`
  (missing `?ids=` yields []); `{ view: "scenario", input: <C22 shape> }`.
  Scenario query keys: budget, task, in, out, open (1/0), minCtx, after,
  before; invalid values parse to null, never a default.
  `parseHash(toHash(state))` round-trips for compare and scenario.
- View contract (Wave 3 must keep it): each view module exports
  `render(state) -> HTMLElement` using the global `document` (tests set
  `globalThis.document` from a JSDOM window). `state = { route, data }`,
  `data` is the full artifact `{ generatedAt, attribution, models, events }`.
  Views may assume `state.data` present; never fetch in a view.
- main.js dispatch: maps `route.view` to render via a `VIEWS` object,
  `app.replaceChildren(view({ route, data }))` on load and hashchange.
  Nav is plain `<a href="#/...">` links injected into #site-header.
  On fetch failure main.js renders a load-error message.
- util.js exports MISSING plus formatters fmtText, fmtUsd, fmtInt, fmtScore,
  fmtDate, fmtWeights (all built on one orMissing combinator). Never write a
  dash literal, redefine MISSING, or add a second `fetch(` anywhere in
  docs/js/ (w2s3 tests grep for both; the fetch grep matches comments too).
- Styling hooks in stubs: `.muted` spans; `#model-overlay` on the model
  section; `#scenario-results` div inside the scenario section (neither has
  `.glass` yet; apply `.glass` only per the C43 whitelist).
- model.js and compare.js each do a local `models.find(m => m.id === ...)`;
  if Wave 3 keeps that pattern in 2+ views, consider promoting a lookup
  helper into util.js then.

### W2.S2 (scenario engine, docs/js/engine.js)
- API: `evaluateScenario(models, input)` returns `{ qualified, excluded }`.
  Qualified entries: `{ rank (1-based), model, rankingValue, cost:
  { inputCost, outputCost, totalCost, formula } }`; excluded entries:
  `{ model, reason }` with reason one of the frozen `EXCLUSION_REASONS`.
  Also exports `computeCost(model, input)`, `rankingValue(model, task)`,
  `exclusionReason(model, input)`, `TASKS`.
- The C26 formula string is prebuilt in `cost.formula`; W3.S4 must render it
  verbatim, never reformat (exact shape:
  `10.00 Mtok x $3.00 + 5.00 Mtok x $15.00 = $105.00/mo`, plain letter x).
- Each excluded model carries exactly ONE reason: the first failing check in
  C24 order (missing_price, over_budget, constraint_open_weights,
  constraint_context, constraint_date, missing_ranking_field).
- Constraint semantics: `openWeightsOnly: false` and `null` both mean no
  filter; a non-null date constraint excludes null-releaseDate models with
  `constraint_date`; non-null `minContextTokens` excludes null-contextWindow
  models with `constraint_context`; null contextWindow under longdoc with no
  context constraint yields `missing_ranking_field`.
- All boundaries inclusive: cost == budget, contextWindow == min,
  releaseDate == either bound all qualify.
- Tie-break: ranking field desc, lower totalCost, newer releaseDate (null
  dates sort after any date), id ascending; order is total.
- W3.S4 form state must supply the full `constraints` object with all four
  keys (null for unset); the engine uses strict `!== null` / `=== true`
  checks, no defaulting. Longdoc's visible secondary metric is just
  `cost.totalCost` on each qualified entry.

### W2.S1 (merge pipeline)
- docs/data/models.json now exists (7 models, 2 events); npm run validate
  validates it from here on. Never hand-edit it; regenerate via npm run build.
- Merge override mirrors validate.js: `node scripts/merge.js <dir>` or
  FRONTIER_DATA_DIR; the dir must hold curated.json, events.json,
  epoch_notable_ai_models.csv, epoch-columns.json; output is <dir>/models.json,
  so validate.js can then be run on the same dir.
- merge.js exports buildArtifact({curated, events, csvText, columns,
  generatedAt}) (pure) for direct unit use.
- sources keys used (present iff field non-null): releaseDate,
  pricing.inputPerMTok, pricing.outputPerMTok, contextWindow,
  benchmarks.gpqaDiamond, benchmarks.swebenchVerified, openWeights,
  epoch.parameters, epoch.trainingComputeFlop, epoch.organization.
  releaseDate is tagged "epoch" when filled from the CSV (curated null),
  else "curated"; epoch.* are always "epoch"; the rest always "curated".
- In the committed artifact, gpt-4.releaseDate is "2023-03-15" (from Epoch,
  sources.releaseDate = "epoch"); claude-fable-5 gets epoch.organization
  "Anthropic" but null parameters/compute (empty in the snapshot). Views must
  render null epoch fields with MISSING.
- merge.js source must never contain a quoted Epoch header string; a w2s1
  hygiene test greps for every value in data/epoch-columns.json. Keep new
  header needs in that JSON map.
- loadJson/resolvePaths are duplicated between merge.js and validate.js
  (slice file boundaries forced it); a later slice touching both may
  consolidate into scripts/lib/.

## Wave 1 (W1.S1-W1.S4, all done; suite 68/68, validate OK, shell serves)

### Environment / repo state
- `npm install` has been run; node_modules has vitest, jsdom, ajv, playwright.
  Do NOT add devDependencies: the C6 set is complete and tested by w1s1.
- package.json is now `"type": "module"`: everything is ESM.
- package-lock.json changed as an install side effect (not owned by any slice).

### W1.S1 (scaffold)
- Banned-string workaround: tests/w1s1.test.js asserts the shots script and
  the browser devDependency via `String.fromCharCode` construction so the C54
  banned substrings never appear in test bytes. W4.S2/W4.S3 tests can reuse
  this pattern.
- docs/index.html already links css/tokens.css, css/styles.css, js/main.js
  (all relative) and applies `.glass` to `#site-header` only (C43 whitelist).
- docs/js/main.js is a minimal real renderer; W2.S3 rewrites it.

### W1.S2 (tokens/styles)
- `--dur: 150ms` and `--blur: 12px` live in tokens.css `:root`; the
  reduced-motion `--dur: 0ms` override lives in styles.css. The w1s2 test
  asserts exactly one `--dur: 150ms` across both files: never redeclare it.
- C45 strict: styles.css holds the ONLY `box-shadow` in docs/ (`.glass`).
  Views must use `outline` for focus and `border: 1px solid var(--hairline)`
  for edges, never box-shadow.
- Glass hosts pre-styled; they get background/shadow only from the `.glass`
  class, applied exactly to `#site-header`, `#compare-tray`,
  `#scenario-results`, `#model-overlay` (C43).
- Styling hooks for views: `.card`, `.badge`, `.muted`, `.bar`+`.bar-track`
  (compare), `.timeline` (relative + overflow-x), `details/summary`
  (scenario exclusions), `button.ghost`, `.grid-2` (2 cols at >=720px).
- Inline styles from JS: percentages and `var()` only; raw colors in
  docs/js/ would trip the C36 grep. Avoid element ids that look like hex
  (e.g. `#feed`, `#fab`).

### W1.S3 (validator)
- `node scripts/validate.js [dir]` or env `FRONTIER_DATA_DIR=dir`: overrides
  data location for tests; the dir holds curated.json, events.json, and
  optionally `models.json` (note: artifact filename inside an override dir is
  `models.json`, not `docs/data/models.json`). Default paths resolve from the
  script location, cwd-independent.
- Module exports `validateCurated`, `validateEvents`, `validateArtifact`,
  `runValidation`, `ATTRIBUTION` for reuse by W2.S1.
- Real curated.json and events.json validate cleanly. Artifact check skips
  gracefully only while docs/data/models.json does not exist; once W2.S1
  writes it, `npm run validate` validates it too.

### W1.S4 (fetch/CSV/column map)
- Merge (W2.S1) must import `parse` from scripts/lib/csv.js
  (`parse(text) -> { header, rows }`, rows keyed by header; also
  `parseRows -> string[][]`) and read header names ONLY from
  data/epoch-columns.json (C12: no hardcoded Epoch header strings in merge).
- Logical keys in epoch-columns.json: `modelName` -> "Model",
  `releaseDate` -> "Publication date", `parameters` -> "Parameters",
  `trainingComputeFlop` -> "Training compute (FLOP)",
  `organization` -> "Organization".
- CSV empty fields arrive as `""`, not null; merge must map `""` to null,
  never 0 (C19). Parameters/compute are scientific-notation numeric strings
  when present (e.g. `1.7e+25`). Snapshot: 47 columns, ~900 data rows, many
  embedded newlines (handled by the parser).
