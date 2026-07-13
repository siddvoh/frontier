#!/bin/zsh
mkdir -p .sidd
MODE="${1:-build}"

PLAN_PROMPT=$(cat <<'EOF'
This is new context and you are a principal software engineer planning a build. Read SPEC.md fully. If PLAN.md exists you are refining it; read it and
AGENT_NOTES.md too, and keep completed [x] slices untouched.

Break the spec into vertical slices grouped into waves and write PLAN.md. A slice is one testable piece cutting through to something runnable, sized for
one agent in one sitting. A wave is a group of slices that depend only on earlier waves, are independent of each other, and never write to the same
file, because they get built in parallel and merged.

Slice lines must be exactly this shape, one per slice, since a script and other agents parse them:
- [ ] W1.S1 | files: data/schema.json, scripts/validate.js, tests/w1s1.test.js | schema plus validator with seeded models

Under each slice add 2 to 4 indented bullets with its acceptance checks, each traceable to a numbered SPEC.md criterion. Every slice names its own
test file in files:. One slice must establish the design tokens and base stylesheet before any UI slice. Wave 1 must end with a runnable skeleton and at least one passing test. 
Aim for 8 to 14 slices; if a description needs "and" twice, split it.

Now audit your own plan before finishing: every SPEC.md criterion maps to a slice; no slice depends on a same-wave or later slice; no two same-wave
slices share a writable path; no slice is vague about what done means. If the audit passes, make <!-- PLAN-READY --> the last line of PLAN.md, commit
"plan: ready", stop. If it fails, fix what you can, commit "plan: progress" without the stamp, stop.
EOF
)

BUILD_PROMPT=$(cat <<'EOF'
This is new context and you are a principal software engineer. You are the only agent working on this project. You have a SPEC.md, a PLAN.md and an AGENT_NOTES.md.
Decide your move in this order and do exactly one of these:

1. Run npm test. If it's red, fix it, without weakening or deleting tests, commit "fix: gate green" and stop. Make sure tests always stay green before you leave. If it's green, continue to step 2.

2. Find the lowest wave in PLAN.md with unchecked slices. If that wave has one open slice, implement it. If it has several, they are file-disjoint by design: spawn a subagent per slice in parallel with the Task tool, each
doing one slice under the same rules, then integrate and run the full suite yourself. Rules for any slice: only write inside its files: paths plus its test file, no stubs or TODOs, write its tests, whole suite green, flip its box to [x], note anything the next agent needs in AGENT_NOTES.md, commit "W2.S1: what you did", stop. 
If the plan itself is wrong, don't work around it: note why in AGENT_NOTES.md, leave the box unchecked, commit, stop.

3. If no unchecked slices remain, switch to critic. Verify SPEC.md criterion by criterion against the actual code, by execution where you can: run the merge script, load the engine in node, serve the site. Hunt stubs, weakened tests, code never wired into the page, schema drift, non-goals
that somehow crept in. If anything real fails, append a new wave to PLAN.md, one slice per issue in the standard format, commit "critic: issues", stop. If everything genuinely holds, create the file .sidd/APPROVED, commit "critic: approved", stop.
EOF
)

if [ "$MODE" = plan ]; then
  for i in 1 2 3 4 5; do
    grep -q 'PLAN-READY' PLAN.md 2>/dev/null && { echo "plan ready"; exit 0; }
    claude -p "$PLAN_PROMPT" --permission-mode auto > .sidd/plan_$i.log 2>&1
    sleep 2
  done
  grep -q 'PLAN-READY' PLAN.md && exit 0
  echo "plan not converging after 5 passes, read PLAN.md and AGENT_NOTES.md"
  exit 1
fi

while true; do
  [ -f .sidd/STOP ] && exit 0
  [ -f .sidd/APPROVED ] && echo done && exit 0
  claude -p "$BUILD_PROMPT" --permission-mode auto > .sidd/build_$i.log 2>&1
  sleep 2
done