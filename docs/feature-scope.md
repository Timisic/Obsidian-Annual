# Feature Scope

DEC-77 narrows the MVP to one user-facing review object: **Theme Hypothesis**.
Everything else should support the loop of evidence, user confirmation, and report output.

## MVP Loop

```text
Review Session -> Evidence Notes -> Evidence Cluster -> Theme Hypothesis -> Theme Decision -> Review Report
```

Tags, folders, links, tasks, and timestamps are weak signals for building evidence.
They are not the primary path users must understand.

## Retained

| Feature | Status | Notes |
| --- | --- | --- |
| Review Session | Retained | Owns time range, scan scope, privacy settings, AI settings, state, and report path. |
| Evidence Note | Retained | Source note with path, title, excerpt, date/link/context signals, and source-note navigation. |
| Evidence Cluster | Retained | Group of evidence notes that may support the same theme hypothesis. |
| Theme Hypothesis | Retained | The only Review Board card type in the MVP. |
| Theme Decision | Retained | User confirmation state: Accept, Rename, Merge, Ignore. |
| Review Report | Retained | Markdown report that includes only confirmed Theme Hypotheses and evidence. |
| Accept / Rename / Merge / Ignore / Open Source Note | Retained | The active Review Board decision set. |

## Deferred Or Hidden

| Feature | Status | Reason |
| --- | --- | --- |
| Project candidate | Deferred | Project context can be evidence, but it is not an independent card type in the MVP. |
| Task candidate | Deferred | Task lines can be weak evidence, not a task-management workflow. |
| Dormant note candidate | Hidden | Dormancy can inform evidence ranking, but no standalone dormant-note card is shown. |
| Bridge note candidate | Hidden | Bridge behavior can explain an evidence cluster, but no standalone bridge-note card is shown. |
| Add to actions | Deferred | Follow-up work is outside the review-confirm-report loop. |
| Archive | Deferred | The MVP records Ignore rather than archive-management decisions. |
| Annual highlights | Hidden | Highlighting adds another report destination before the theme loop is stable. |
| Strong action section | Deferred | Reports may include optional reflection prompts, but must not require next action items. |

## Removed From The Active MVP Surface

| Feature | Status | Replacement |
| --- | --- | --- |
| Multiple Review Board card types | Removed | Use Theme Hypothesis cards only. |
| Action/Archive progress buckets | Removed | Progress tracks reviewed, confirmed, merged, and ignored hypotheses. |
| Report action decisions | Removed | Report includes confirmed hypotheses; reflection prompts are optional supporting copy. |
| Daily smoke-vault fixture tracking | Removed from git | `tests/fixtures/obsidian-smoke-vault/Daily/` is ignored and can remain local for smoke testing. Deterministic test notes live under `Review Fixtures/`. |

## Documentation Rules

- Say **Theme Hypothesis** when describing the card users review.
- Say **Evidence Note** or **Evidence Cluster** when describing source material.
- Describe tags as weak signals, never as the theme path.
- Avoid task-manager wording in Review Board docs and UI labels.
- Do not promise required next actions in generated reports.
