# Review Board Alignment Decisions

Status: DEC-40 docs/readme alignment audit.

This document lists requirement, feature, and definition wording that should be intentionally aligned after Review Board v1 is accepted. It does not change product scope by itself.

## Audit Scope

Scanned:

- `README.md`
- `README.en.md`
- `docs/README.md`
- `docs/product-definition.md`
- `docs/product-specification.md`
- `docs/feature-inventory.md`
- `docs/roadmap.md`
- `docs/ai-report-design.md`
- `docs/agent-installation.md`
- `docs/research/project-research.md`
- `docs/writing-growth.config.example.json`

## Decision Items

| Area | Current wording | Review Board v1 wording | Decision needed |
| --- | --- | --- | --- |
| Candidate status name | `docs/product-specification.md` uses `confirmed`; README uses "确认". | DEC-40 requires `accepted`. | Decide whether to rename all product docs and UI copy to `accepted`/接受, or keep `confirmed` as user-facing text and map it to `accepted` internally. |
| Candidate type set | Existing SPEC includes `Annual Theme`, `Representative Note`, `Project Thread`, `Action Candidate`, `Dormant Asset`, and `Anomaly`. | DEC-40 requires `topic`, `note`, `project`, `task`, `dormant-note`, and `bridge-note`. | Decide whether `Anomaly` remains a later signal feeding candidates, and whether `Action Candidate` becomes `task` plus `next-action` state. |
| Review Board layout | Existing SPEC recommends left candidate queue, middle evidence/reason, right decisions/report preview. | DEC-40 requires left candidate list, right evidence/actions, bottom progress. | Decide whether MVP removes the separate right-side report preview until after accepted candidates exist. |
| Action vocabulary | Existing docs use Continue, Merge, Archive, Drop, Convert to project, Revisit. | DEC-40 actions are accept, ignore, merge topic, rename topic, add to annual highlights, add to action, open source note. | Decide whether report "decisions" keep the broader action vocabulary while Review Board buttons use the DEC-40 action set. |
| Persistence location | Existing docs focus on protected Markdown annual report regeneration. | DEC-40 requires plugin data or annual review state file and avoiding user正文 pollution. | Decide whether plugin data is canonical and `.annual-review/YYYY.review-state.json` is an export/portability option, or whether vault state files are always written. |
| Source note metadata | The Queue and Spaced Everything store review metadata in frontmatter/properties, but current Annual Review docs emphasize protected report sections. | DEC-40 explicitly avoids polluting user正文; the spec recommends no source-note frontmatter writes for review state. | Decide whether any optional frontmatter integration should be forbidden for MVP or reserved for a future opt-in export. |
| "Open Review Board" command | README and command IDs expose `Annual Review: Open Review Board`, but current implementation command id is `open-annual-review-dashboard`. | DEC-40 treats Review Board as the primary MVP UI. | Decide whether to rename internal command id later or keep id stable while changing labels only. |
| Writing Growth docs | `docs/writing-growth.config.example.json` describes a separate writing growth report config. | Review Board v1 uses writing growth only as possible evidence for note/topic candidates. | Decide whether writing growth remains a support report or should be reframed as a candidate evidence source in future docs. |

## Recommended Alignment Direction

- Use `accepted` internally because it is the DEC-40 required state.
- Keep Chinese user-facing copy as "接受" or "确认接受" to preserve clarity.
- Treat `Anomaly` as a scan signal, not a Review Board v1 candidate type.
- Treat `Action Candidate` as either `task` or an accepted candidate moved to `next-action`.
- Make plugin data the canonical state store; add `.annual-review/YYYY.review-state.json` only when portability is needed.
- Do not write Review Board state to source-note frontmatter in MVP.
