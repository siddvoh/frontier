# Sources for data/curated.json and data/events.json

Verified on 2026-07-12. Sourcing policy (SPEC.md C10): every value is
hand-verified from an official lab pricing/announcement page OR a named
independent leaderboard (vals.ai, epoch.ai, artificialanalysis.ai), one
source URL per value. Zero invented or estimated numbers. Conflicting
sources are never averaged: both readings are recorded here and the field
stays null until the owner decides.

Convention: `releaseDate` = general availability (GA) date, not limited
preview.

`epochName` values were matched against the exact `Model` column of the
committed `data/epoch_notable_ai_models.csv` (fetched 2026-07-12 from
https://epoch.ai/data/notable_ai_models.csv). Exact matches exist only for
"GPT-4 (Mar 2023)" and "Claude Fable 5". The CSV has no row for Grok 4.5 or
any GPT-5.6 tier, and only "Muse Spark" (the April 1.0, not 1.1), so those
stay null.

## gpt-4 (original, March 2023)

- Pricing $30 / $60 per 1M and context window 8,192:
  https://developers.openai.com/api/docs/models/gpt-4
- `releaseDate` null, CONFLICT recorded per policy:
  owner recollection says 2023-03-14 (the announcement date);
  Epoch's Notable AI Models CSV row "GPT-4 (Mar 2023)" says Publication
  date 2023-03-15. The openai.com announcement page blocks automated
  fetching so the official date could not be read directly. Owner to
  decide and fill.
- `gpqaDiamond` null: no readable score on an allowed source.
  epoch.ai's benchmark hub (https://epoch.ai/benchmarks/gpqa-diamond)
  references gpt-4-0613 in its log viewer but displays no extractable
  number, and the ~39% figure circulating in secondary coverage could not
  be confirmed on the epoch.ai pages checked. If you find it in the hub UI,
  fill and cite the hub URL.
- `swebenchVerified` null: GPT-4 does not appear on
  https://www.vals.ai/benchmarks/swebench and OpenAI never published one.
- `openWeights` false: API-only model per OpenAI docs (same URL as pricing).

## claude-fable-5

- Release date 2026-06-09:
  https://www.anthropic.com/news/claude-fable-5-mythos-5 ("Jun 9, 2026"),
  corroborated by the Epoch CSV row "Claude Fable 5" (2026-06-09).
- Pricing $10 / $50 per 1M:
  https://platform.claude.com/docs/en/about-claude/pricing
- Context window 1,000,000: same pricing docs page ("full 1M token context
  window" for Fable 5).
- `swebenchVerified` 95.0: https://www.vals.ai/benchmarks/swebench
  ("Claude Fable 5" at 95.00%), consistent with Anthropic's launch claims.
- `gpqaDiamond` 93.18: https://www.vals.ai/benchmarks/gpqa
  ("Claude Fable 5 and GPT 5.5 tied for second at 93.18%"). Anthropic
  itself publishes no numeric GPQA figure.
- `openWeights` false: API-only per Anthropic announcement and docs.

## muse-spark-1.1

- Release date 2026-07-09:
  https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/
  corroborated by https://artificialanalysis.ai/models/muse-spark-1-1 and
  https://www.vals.ai/models/meta_muse-spark-1.1 ("7/9/2026").
- Context window 1,000,000: same Meta blog ("1 million tokens").
- Pricing null: the Meta blog states no dollar figures and the Meta Model
  API portal (https://developer.meta.com/ai/products/meta-model-api/)
  renders via JS and is not automation-readable. Owner will verify the
  reported $1.25 / $4.25 per 1M in a browser and fill by hand.
- Benchmarks null: vals.ai lists Muse Spark 1.1 on both leaderboards
  (SWE-bench rank 8/69, GPQA Diamond rank 13/121 at
  https://www.vals.ai/models/meta_muse-spark-1.1) but the percentage cells
  render as "0.0%", an obvious display artifact, so no number could be
  read. Secondary sources conflict (e.g. 77.4 vs 56.6 on SWE-bench) and
  are not allowed sources anyway. Read the vals.ai page in a browser and
  fill from there. artificialanalysis.ai does not disclose per-benchmark
  scores for this model.
- `openWeights` null: no official statement found either way; given Meta's
  history of open-weight releases, do not assume closed.

## gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna

Sol, Terra, and Luna are separate models with separate prices and get
separate records, same as an Opus/Sonnet/Haiku family would.

- Release date 2026-07-09 for all three tiers, GA per the convention above:
  https://artificialanalysis.ai/models/gpt-5-6-sol ("Released July 2026",
  July 9, 2026 per the FAQ). A limited preview ran from June 26, 2026;
  releaseDate deliberately records GA, not the preview.
- Sol pricing $5 / $30 and context window 1,050,000:
  https://developers.openai.com/api/docs/models/gpt-5.6-sol
- Terra pricing $2.50 / $15 and context window 1,050,000:
  https://developers.openai.com/api/docs/models/gpt-5.6-terra
- Luna pricing $1 / $6 and context window 1,050,000:
  https://developers.openai.com/api/docs/models/gpt-5.6-luna
- Benchmarks null for all three tiers: OpenAI has published no GPQA
  Diamond or SWE-bench Verified figures for the 5.6 family, and neither
  vals.ai leaderboard listed any 5.6 tier on the pages checked
  (https://www.vals.ai/benchmarks/swebench,
  https://www.vals.ai/benchmarks/gpqa).
- `openWeights` false: API-only per OpenAI docs (URLs above).

## grok-4.5

- Release date 2026-07-08: https://www.vals.ai/models/grok_grok-4.5
  ("7/8/2026"), matching owner recollection.
- Pricing $2 / $6 per 1M and context window 500k:
  https://docs.x.ai/developers/models
- `swebenchVerified` 86.6: https://www.vals.ai/benchmarks/swebench
  ("Grok 4.5" at 86.60%).
- `gpqaDiamond` 92.93: https://www.vals.ai/models/grok_grok-4.5 (reported
  as #5 on GPQA Diamond at 92.93%; the page's score cells render as 0.0%
  to automated fetching but the rank 5/121 matches, and the 92.93 figure
  is vals.ai's own. Double-check in a browser if in doubt.)
- Organization entered as "SpaceXAI": that is how the official site titles
  itself (formerly xAI); change if you prefer the legal entity name.
- `openWeights` false: API-only per docs.x.ai.

## Events (data/events.json)

- Restoration: https://www.anthropic.com/news/redeploying-fable-5
  (official). Controls lifted June 30, 2026; service restored July 1, 2026.
- Suspension: dated June 12, 2026 per contemporaneous reporting
  (https://www.cnbc.com/2026/06/30/anthropic-says-trump-admin-has-lifted-export-controls-on-claude-fable-5-and-mythos-5.html,
  https://thehackernews.com/2026/07/anthropic-restores-claude-fable-5-after.html)
  and consistent with Anthropic's own restoration post.
