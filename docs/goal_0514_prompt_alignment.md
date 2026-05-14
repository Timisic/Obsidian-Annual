# Polish Narrative Review Report to match pure-prompt strengths

Label: `ready-for-agent`  
Type: AFK implementation issue  
Blocked by: `docs/goal_0514.md` benchmark baseline and reviewer verdict

## Context

The prompt-vs-plugin benchmark in `benchmark-runs/2026-05-14-prompt-vs-plugin/final-report.md` passed after Iteration 01, but the independent reviewer still found areas where the pure prompt remains stronger:

- prose is more compact;
- insight density is higher;
- manual review targets are more natural and explicit;
- hidden/project context such as `Projects/Research.md` and `Projects/Legacy.md` is emphasized better;
- the final text feels more like a smart person read all the notes, not a report template.

This issue should keep the plugin's workflow advantages while narrowing those pure-prompt advantages.

## Goal

Improve the plugin-generated **Narrative Review Report** so that it:

1. reads more compactly without losing evidence grounding;
2. turns accepted Theme Decisions into denser insight paragraphs;
3. surfaces natural manual-review targets when evidence is partial, old, linked, contradictory, or background-only;
4. uses linked-context Evidence Notes such as `Projects/Research.md` and `Projects/Legacy.md` in final report guidance when they are included in the Evidence Package;
5. reduces template smell in prose sections, especially overview and Worth Rereading.

## Scope

In scope:

- Report renderer changes in production code.
- Evidence-to-report selection changes that are generalizable and not fixture-specific.
- Regression tests for compactness, manual review targets, and linked-context surfacing.
- Regenerating the benchmark plugin report/artifacts after code changes.
- Updating the benchmark final report with a short Iteration 02 note.

Out of scope:

- No new dependencies.
- No source fixture note edits.
- No weakening the pure-prompt baseline.
- No product pivot or full UI redesign.
- No hardcoded fixture titles, expected themes, or one-off report text.

## Acceptance criteria

- [x] Worth Rereading does not leave included AI/review candidates as unexplained orphan bullets when a traceable accepted/renamed Review Candidate reason exists.
- [x] Linked-context notes included only through links/backlinks can appear as manual review targets or reread guidance, instead of staying invisible background context.
- [x] Reflection/manual-review questions can be evidence-born from uncertain/linked/background Review Candidate context, not only generic coaching prompts.
- [x] The benchmark plugin report is regenerated and shows fewer weak/orphan reread bullets and a clearer hidden-context/manual-review section.
- [x] Focused tests cover the new report behavior.
- [x] `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- [x] Completion audit maps this issue's criteria to concrete files/artifacts/test output.

## Suggested implementation notes

- Prefer improving existing renderer heuristics over adding new abstractions.
- Use Review Candidate evidence/source paths and Evidence Package context already captured by `buildThemeEvidencePackage`.
- Keep report prose narrative-first; avoid turning the report into an audit export.
- Favor concise bullets that explain why a note matters over generic sections.

## Benchmark artifacts to update

- `benchmark-runs/2026-05-14-prompt-vs-plugin/plugin/review-report.md`
- `benchmark-runs/2026-05-14-prompt-vs-plugin/iterations/iteration-02/code-change-summary.md`
- `benchmark-runs/2026-05-14-prompt-vs-plugin/iterations/iteration-02/plugin-review-report.md`
- `benchmark-runs/2026-05-14-prompt-vs-plugin/iterations/iteration-02/test-evidence.md`
- `benchmark-runs/2026-05-14-prompt-vs-plugin/final-report.md`
