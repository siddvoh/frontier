# Frontier

An open source reference explorer and decision engine game for frontier AI models, from 2024 to 2026. Also includes a daily higher-or-lower game built on the same data. Data is a committed Epoch AI snapshot (CC-BY, credit to them) merged with hand-curated pricing and benchmarks.

Live: https://siddvoh.github.io/frontier/

Built for CMU 17-636 in two steps. The base system was the explorer and then the extension was tha game. Both components were built in four stages (specify, plan, build, refine). Specs were written in interactive sessions on Claude Code. The plan and build stages ran as an autonomous loop, a fresh agent each iteration with a critic gate at the end, see [sidd.sh](sidd.sh). The contract the loop is held to is [SPEC.md](SPEC.md) and the plan it maintains is [PLAN.md](PLAN.md).

Assignment files: 
- [prompts.txt](prompts.txt) has every prompt I typed plus a pointer to the loop prompts (also included a nicely formatted transcript for the full session incl claude reponses at [full_session_transcript.md](full_session_transcript.md))  
- [running.md](running.md) has instrcution on how to run the system locally (though its also live at the above link)
- [reflection.md](reflection.md) is my reflection as I went through this process.