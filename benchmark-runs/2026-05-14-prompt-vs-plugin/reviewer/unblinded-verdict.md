# Unblinded Verdict

A = **Direct Prompt**. B = **Plugin**.

**Verdict: FAIL against `docs/goal_0514.md` threshold.**

Reason: the plugin has real workflow advantages in reviewability, Obsidian links, and persisted decisions, but it does **not** clearly beat the direct prompt overall and is **not at least as good on important theme discovery**.

Key evidence:

- Passing threshold requires plugin to be higher overall, at least as good on theme discovery, better in workflow-differentiating categories, and not materially worse in readability/insight density (`docs/goal_0514.md:200-210`).
- Direct Prompt identifies richer research/career evidence, including `业界实习.md` and `课题组的局限.md`, and a separate expression/standards theme.
- Plugin evidence package has 42 notes while source scope has 47; missing notes include:
  - `2026-04-11 幸福的烦恼，交往的边界.md`
  - `2026-04-26 业界实习.md`
  - `2026-04-30 课题组的局限.md`
  - `Projects/Research.md`
  - `2026-03-23 组内学生氛围很不错.md`
- Plugin `run-notes.md` documents that Review Board decisions came from fixture state for `2026 Annual Review`, then were evaluated against the Jan-May snapshot, with a metadata mismatch caveat.
- Plugin does preserve visible decisions: 5 accepted, 2 merged, 3 ignored, 2 candidates in `review-state.json`; this is its strongest advantage.
- Plugin report is readable and uses confirmed themes plus user reflection, but the direct prompt report is denser and more complete on important themes.

## Required Next Optimization

Do **not** stop; optimize and rerun.

Top generalizable failure modes:

1. **Evidence package recall gap**: the plugin omitted important eligible notes even in a small 47-note benchmark scope.
2. **Theme/report compression loss**: strong notes about industry internship, lab limitations, expression/standards, and hidden project structure were absent or weakened in the final themes.
3. **State reproducibility mismatch**: plugin candidates/decisions came from annual fixture state rather than a clean Jan-May custom Review Session.

Smallest recommended optimization:

> Add a pre-generation evidence coverage reconciliation step: compare `source-scope.md` / scan manifest against `evidence-package.json`; for small scopes, include all eligible Evidence Notes, and for larger scopes require explicit omission reasons plus diversity quotas for project notes, backlink/link-heavy notes, older/hidden notes, and high-signal low-frequency notes. Fail the benchmark run if accepted report evidence references notes outside the Evidence Package or if important in-scope notes are omitted without reason.

Then rerun the plugin arm from a clean custom Review Session and review again.
