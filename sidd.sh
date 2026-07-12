#!/bin/bash
mkdir -p .sidd

PROMPT=$(cat <<'EOF'
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

while true; do
  [ -f .sidd/STOP ] && exit 0
  [ -f .sidd/APPROVED ] && echo done && exit 0
  claude -p "$PROMPT" --permission-mode auto
  sleep 2
done