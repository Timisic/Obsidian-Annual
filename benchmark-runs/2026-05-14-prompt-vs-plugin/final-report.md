# Prompt-vs-Plugin Benchmark + Optimization Report

## Executive verdict

**Pass.** The baseline plugin arm initially failed because it scored lower than the pure-prompt baseline (Direct Prompt 37.0 / 50, Plugin 35.0 / 50) and missed important in-scope notes. After Iteration 01, the independent reviewer scored the optimized plugin higher overall (Direct Prompt 37.5 / 50, Plugin 42.5 / 50); Iteration 02 then targeted the remaining pure-prompt advantages around compact prose, manual-review targets, and hidden/project context. The plugin now recovers the same six important themes as the prompt baseline, keeps all 47 eligible source notes in the Evidence Package, preserves a clean Review Session with six accepted Theme Decisions, and wins on evidence grounding, reviewability, Obsidian usefulness, doc alignment, and reproducibility/privacy. The direct prompt remains slightly better on compactness and explicit manual-review targets, but the plugin report is not materially worse on human readability or insight density.

## What the pure prompt did better

- **Higher prose density:** The direct prompt report is more compact and has fewer product/report scaffolding phrases.
- **More explicit manual-review posture:** It calls out missing/hidden wikilink targets and manual review targets more directly than the plugin report.
- **Old/project-note emphasis:** It still elevates project context more naturally inside the prose. Iteration 02 now surfaces `Projects/Research.md` and `Projects/Legacy.md` as manual-review targets, but the direct prompt remains more essay-like when weaving hidden context into the main narrative.
- **Uncertainty handling:** The prompt baseline more visibly separates contradictions, gaps, and “review this manually” guidance.

These are real advantages, but they are mostly prose/reviewer-behavior advantages rather than durable product-workflow advantages.

## What the plugin did better

- **Complete auditable Evidence Package:** `plugin/evidence-package.json` now contains 47 Evidence Notes, matching the 47-note source scope with no missing or extra paths.
- **Review workflow state:** `plugin/review-state.json` preserves a clean custom Review Session for `2026-01-01` to `2026-05-10`, with 6 Review Candidates, 6 accepted Theme Decisions, and evidence for each accepted theme.
- **Jumpable Obsidian links:** The final report contains 63 wikilinks and the reviewer/link spot check found 0 missing non-asset note links.
- **Confirmed-themes-only report:** The Review Report includes only accepted Theme Decisions and keeps Activity Evidence, Representative Evidence, methodology, and User Reflection sections aligned with the product docs.
- **Workflow-differentiating value:** A user can inspect the Evidence Package, Review Board state, accepted candidates, representative evidence, and final report separately. The prompt baseline only leaves a prose/table output.

Concrete theme recovery improved after optimization: the plugin now includes `2026-04-26 业界实习.md`, `2026-04-30 课题组的局限.md`, `2026-04-11 幸福的烦恼，交往的边界.md`, `2026-03-23 组内学生氛围很不错.md`, `Projects/Research.md`, and `Projects/Legacy.md` in the Evidence Package.

## Missed notes and hidden connections

| Area                       | Pure prompt                                                                                              | Baseline plugin                                                     | Optimized plugin                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI 主导权 / agentic coding | Strongly connected AI speed, pressure, Context Engineering, agentic coding chaos, and human judgment.    | Present but compressed.                                             | Restored as `在 AI 加速中重新夺回主导权`, with evidence across Jan/Feb/Apr/May.                                                                      |
| 科研 / 业界 / 课题组       | Strongly surfaced `业界实习.md`, `课题组的局限.md`, and the shift from platform/title to real scenarios. | Underused or missed key notes.                                      | Restored as `科研路径从平台想象转向真实场景`, with `业界实习.md` and `课题组的局限.md` cited.                                                        |
| 金钱 / 自由 / 风险         | Connected freedom fantasy, trading dreams, losses, money arrival, and short-term arbitrage.              | Present but less complete.                                          | Preserved with `环境促进想法转变.md`, `日有所思总是梦魇.md`, `亏钱自是烦恼.md`, `有钱之后.md`.                                                       |
| 关系 / 边界                | Connected old reconciliation, Linya, 馨玉, dependence, loneliness, and boundaries.                       | Missed `幸福的烦恼，交往的边界.md` because of evidence-id collapse. | Fixed; same-day Chinese notes stay distinct and relationship theme cites the boundary note.                                                          |
| 身体 / 环境 / 社交底盘     | Prompt saw this as a hidden support layer.                                                               | Missed `组内学生氛围很不错.md`.                                     | Restored with sleep, environment, social atmosphere, anxiety/fatigue evidence.                                                                       |
| 表达 / 标准 / 主干         | Prompt identified this as an important separate theme.                                                   | Weakened or absent.                                                 | Restored as `表达不清背后是标准、主干和边界不清`, connecting requirements, Codex exploration, paper expression, and AI noise.                        |
| Old/project notes          | Prompt emphasized `Projects/Research.md` and `Projects/Legacy.md` more naturally in prose.               | `Projects/Research.md` was missing from the package.                | Both project notes are included and now appear as manual-review / Worth Rereading targets; they are still not fully woven into the main theme prose. |

## Human readability verdict

The optimized plugin Review Report is **human-readable enough to pass**. The main theme sections lead with concrete tensions rather than generic categories: AI speed exposing human judgment, research evaluation shifting from platform identity to real scenarios, money creating both freedom and anxiety, intimacy requiring boundaries, bodily/environmental state shaping high-level judgment, and unclear expression revealing unclear standards.

Remaining template smell is visible but not gating:

- every theme keeps a `代表证据:` list, which is useful but visibly structured;
- `Worth Rereading` now explains project/manual-review targets, but still feels more structured than prose;
- direct prompt remains more compact and sometimes more naturally essay-like.

Overall judgment: the plugin report is not just a prettier prompt output. It is a readable Narrative Review Report backed by auditable workflow artifacts.

## Evidence accuracy spot check

| Sampled claim                                          | Source / artifact checked                                                                                                                                               | Judgment            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Evidence Package covers the full source scope.         | `inputs/source-scope.md` lists 47 source files; `plugin/evidence-package.json` has 47 `evidenceNotes`; local diff found no missing/extra paths.                         | Pass                |
| `业界实习.md` supports the research-path theme.        | `review-state.json` and report cite `2026月复盘/4月/2026-04-26 业界实习.md`; reviewer judged it supports real scenario / AI workflow / ability-boundary claims.         | Pass                |
| `课题组的局限.md` supports lab mismatch and risk.      | Present in Evidence Package and cited under research path.                                                                                                              | Pass                |
| Same-day Chinese relationship notes are distinct.      | `themeEvidence.spec.ts` regression covers `2026-04-11 有钱之后.md` and `2026-04-11 幸福的烦恼，交往的边界.md` as distinct ids.                                          | Pass                |
| Body/environment/social atmosphere theme has evidence. | Report cites sleep, environmental influence, `组内学生氛围很不错.md`, fatigue/anxiety notes.                                                                            | Pass                |
| Expression/standards theme is grounded.                | Report cites `不清楚的需求及标准.md`, `探索期有充足额度才有更多可能.md`, `精准的表达很有感染力.md`, `表达不清本质是思考不清.md`.                                        | Pass                |
| Obsidian report links resolve against source scope.    | Link spot check: 63 wikilinks, 0 missing non-asset note links.                                                                                                          | Pass                |
| Review decisions are visible.                          | `review-state.json`: 6 candidates, 6 accepted, 6 decisions, clean custom Jan-May Review Session.                                                                        | Pass                |
| Project/legacy hidden notes affect final narrative.    | `Projects/Research.md` and `Projects/Legacy.md` are included in the Evidence Package and now appear in Worth Rereading / Reflection Questions as manual-review targets. | Improved / Partial  |
| Report avoids audit-export residue.                    | Main prose is narrative, but `代表证据` labels and methodology remain visible.                                                                                          | Partial, acceptable |

## Optimization iterations

### Iteration 0 — Baseline

- Direct Prompt Agent produced a strong baseline with six major themes and an evidence table.
- Plugin arm produced a Review Report, Evidence Package, and Review State.
- Independent reviewer failed the plugin:
  - Direct Prompt: 37.0 / 50
  - Plugin: 35.0 / 50
- Diagnosed failures:
  1. Evidence Package recall gap: 42 plugin notes vs 47 source-scope notes.
  2. Same-day Chinese note id collapse dropped important notes.
  3. Linked old/project context could be omitted.
  4. The plugin report compressed or missed industry internship, lab limitations, and expression/standards.
  5. The plugin arm initially reused an annual fixture state instead of a clean Jan-May custom Review Session.

Artifacts:

- `reviewer/blind-review.md`
- `reviewer/unblinded-verdict.md`
- `reviewer/rubric.json`
- `iterations/iteration-01/failure-analysis.md`

### Iteration 1 — Evidence recall + report polish

Changes made:

- `src/core/themeEvidence.ts`
  - Preserved Unicode letters/numbers in evidence note slugs so non-Latin filenames no longer collapse.
  - Included linked-context notes when active review-range notes point to in-scope notes outside the date range.
- `src/core/render.ts`
  - Lowered the report-ready narrative threshold for compact link-rich AI narratives to reduce field-style scaffolding.
  - Added confirmed-theme context to Worth Rereading reasons when notes support accepted/renamed Review Candidates.
- `tests/themeEvidence.spec.ts`
  - Added regression tests for same-day Chinese note id distinctness and linked-context Evidence Package inclusion.
- `tests/reviewSession.spec.ts`
  - Added regression tests for compact AI narratives and worth-rereading confirmed-theme reasons.

New plugin artifacts:

- `plugin/evidence-package.json`
- `plugin/review-state.json`
- `plugin/review-report.md`
- `iterations/iteration-01/plugin-review-report.md`
- `iterations/iteration-01/evidence-package-after-optimization.json`
- `iterations/iteration-01/code-change-summary.md`
- `iterations/iteration-01/test-evidence.md`

Validation:

```bash
npm run test -- tests/themeEvidence.spec.ts tests/reviewSession.spec.ts
npm run test -- tests/reviewSession.spec.ts
npm run test && npm run typecheck && npm run lint && npm run format:check
```

Results:

- Focused combined test: 2 files passed, 45 tests passed.
- Focused renderer rerun: 1 file passed, 31 tests passed.
- Final full validation: 8 test files passed, 185 tests passed; typecheck, lint, and format check passed.

Independent reviewer result after optimization:

- Direct Prompt: 37.5 / 50
- Optimized Plugin: 42.5 / 50
- Verdict: Pass
- Artifact: `iterations/iteration-01/reviewer-verdict.md`

### Iteration 2 — Prompt-strength alignment polish

Issue: `docs/goal_0514_prompt_alignment.md`

Changes made:

- Added optional `themeEvidencePackage` support to `renderAnnualReview` and passed it through the plugin report generation path.
- Replaced confirmed-theme overview boilerplate with a shorter summary that emphasizes reviewable connected signals.
- Re-ranked Worth Rereading so confirmed-theme and manual-review value outrank generic aggregate order.
- Added concise manual-review reasons for high-signal Evidence Package notes that are not already used by accepted/renamed Review Candidates.
- Surfaced `Projects/Research.md` and `Projects/Legacy.md` in Worth Rereading and Reflection Questions.

Report effect:

- `ALL-in-AI` no longer appears as an unexplained orphan reread bullet.
- Hidden/project context is now visible to the reader as something to manually decide: background index or missed relationship.
- Reflection questions include concrete source-note review targets before generic coaching questions.

Validation:

```bash
npm run test -- tests/reviewSession.spec.ts
npm run test -- tests/themeEvidence.spec.ts tests/reviewSession.spec.ts
npm run test
npm run typecheck
npm run lint
npm run format:check
```

Results:

- Focused renderer suite: 1 file passed, 32 tests passed.
- Focused combined suite: 2 files passed, 46 tests passed.
- Full suite: 8 files passed, 186 tests passed.
- Typecheck, lint, and format check passed after formatting regenerated artifacts.

Artifacts:

- `iterations/iteration-02/code-change-summary.md`
- `iterations/iteration-02/plugin-review-report.md`
- `iterations/iteration-02/test-evidence.md`

## Remaining risks

- The direct prompt remains more compact and more explicit about manual-review targets.
- Hidden/project notes are now visible as manual-review targets, but they are still not deeply woven into the main theme prose.
- The optimized Review State demonstrates accepted Theme Decisions, but not rename/merge/ignore behavior in this specific run because all six benchmark candidates were accepted.
- `Worth Rereading` is more useful, but its concise bullet style is still more structured than pure-prompt prose.
- The plugin arm uses a benchmark provider output grounded in the Evidence Package for this run; future repeatability should pin a real provider/model invocation transcript when external AI access is available.

## Next recommended issues

1. **Weave linked-context notes into main-theme prose**
   - Iteration 02 surfaces hidden/project notes as manual-review targets; the next step is deciding when they should be promoted into the theme narrative itself.

2. **Make manual-review targets first-class Review Board objects**
   - Preserve why a note was kept as background, promoted to a Theme Hypothesis, or left for manual follow-up.

3. **Add a benchmark harness guard for source-scope parity**
   - For small benchmark scopes, fail the run if the Evidence Package omits eligible source notes without explicit omission reasons.
   - Archive a machine-readable source-vs-package diff.

4. **Benchmark Review Board decision diversity**
   - Add a fixture run that exercises rename, merge, ignore, and user-note preservation, not only accepted candidates.

5. **Capture provider invocation transcripts**
   - Store exact provider/model, prompt payload hash, Evidence Package hash, and raw model response for plugin Theme Hypothesis generation.
