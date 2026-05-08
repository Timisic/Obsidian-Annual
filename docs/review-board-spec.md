# Review Board v1 Specification

Status: DEC-40 MVP specification draft.

Review Board is the review surface between vault scanning and annual report generation. It should make the scan output feel like a low-friction queue of evidence-backed choices, not an automatically accepted summary.

## Product References

- Vault Review: create a snapshot, review files one by one, and expose review progress.
- The Queue: keep notes from sinking by showing one item at a time with lightweight controls.
- Journal Bases: preserve yearly review context by rolling daily to weekly to monthly to quarterly to yearly material.
- Spaced Everything: keep review context, record review outcomes, and let outcomes affect what appears next.

These references support four MVP rules:

1. Review Board opens with a stable candidate set for one annual review session.
2. The user handles one candidate at a time while retaining list context.
3. Every candidate explains why it appeared and links back to evidence.
4. Confirmed user choices survive repeated scans.

## Candidate Types

| Type           | Meaning                                                                | Primary evidence                                                                  | Default user question                                                    |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `topic`        | A theme, direction, or cluster that appears across the year.           | Tags, folders, headings, link clusters, representative notes, month distribution. | Is this a real annual theme?                                             |
| `note`         | A specific note worth rereading or including as a representative note. | Word count, link count, recent activity, topic membership, excerpt.               | Should this note be part of the annual review?                           |
| `project`      | A project thread that spans notes, tasks, folders, or links.           | Project folder, task trail, linked notes, first/last activity.                    | Should this project continue, close, or become a report item?            |
| `task`         | A task or task cluster that needs annual-level decision.               | Markdown task source, completion state, nearby heading, linked note.              | Does this task need a next action, archive decision, or omission?        |
| `dormant-note` | A note that was important before but has not been touched recently.    | Last modified time, inbound links, old activity, topic membership.                | Is this still worth maintaining or should it be archived?                |
| `bridge-note`  | A note connecting multiple topics or project areas.                    | Distinct linked topics, inbound/outbound links, folder span.                      | Does this note deserve to become an index, summary, or annual highlight? |

Each candidate must have:

- Stable `id` derived from year, type, and source identity.
- `type`.
- Suggested `title`.
- Short `reason`.
- `status`.
- At least one evidence source.
- `sourcePaths` for Obsidian note opening and rescans.
- Optional score and rank explanation.

## Status Model

The required statuses are:

| Status        | Meaning                                                       | Report impact                                                                |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `candidate`   | Newly scanned or still undecided.                             | Not included by default.                                                     |
| `accepted`    | User accepts the candidate as review-worthy.                  | Eligible for the annual report.                                              |
| `renamed`     | User accepts the candidate with a user-facing title override. | Eligible for the annual report using `userTitle`.                            |
| `merged`      | User merged this candidate into another candidate.            | Source candidate is not shown as standalone; target carries merged evidence. |
| `ignored`     | User intentionally skips it for this review.                  | Not included, but preserved in state.                                        |
| `archived`    | User decides the item should be closed or archived.           | Eligible for the decisions section if `includeInReport` is true.             |
| `next-action` | User turns the item into a follow-up action.                  | Eligible for the actions section.                                            |

Allowed transitions:

| From                                              | To            | Trigger                                       |
| ------------------------------------------------- | ------------- | --------------------------------------------- |
| `candidate`                                       | `accepted`    | Accept.                                       |
| `candidate`, `accepted`                           | `renamed`     | Rename topic or candidate.                    |
| `candidate`, `accepted`, `renamed`                | `merged`      | Merge topic into another topic.               |
| `candidate`, `accepted`, `renamed`, `next-action` | `ignored`     | Ignore.                                       |
| `candidate`, `accepted`, `renamed`, `next-action` | `archived`    | Archive or mark as archive decision.          |
| `candidate`, `accepted`, `renamed`                | `next-action` | Add action.                                   |
| `ignored`, `archived`, `merged`                   | `candidate`   | Only by explicit reset, not by repeated scan. |

Repeated scans may update reason, score, sort rank, and evidence on undecided candidates. They must not overwrite `accepted`, `renamed`, `merged`, `ignored`, `archived`, or `next-action` decisions.

## Actions

| Action                   | Applies to                                                 | State effect                                                                                        | Required payload                           |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Accept                   | All candidate types.                                       | `candidate` -> `accepted`.                                                                          | Candidate id.                              |
| Ignore                   | All candidate types.                                       | Any active status -> `ignored`.                                                                     | Candidate id, optional note.               |
| Merge topic              | `topic`; later may support similar `note` merge.           | Source -> `merged`; target receives merged source id/evidence.                                      | Source id, target id.                      |
| Rename topic             | `topic`; optional for other candidates.                    | Active status -> `renamed`.                                                                         | Candidate id, non-empty user title.        |
| Add to annual highlights | `topic`, `note`, `bridge-note`.                            | Keeps current accepted/renamed status or accepts candidate first; sets `includeInAnnualHighlights`. | Candidate id.                              |
| Add to actions           | All candidate types, especially project/task/dormant-note. | Active status -> `next-action`; creates decision.                                                   | Candidate id, action label, optional note. |
| Archive                  | All candidate types.                                       | Active status -> `archived`.                                                                        | Candidate id, optional note.               |
| Open source note         | All candidates with note evidence.                         | No state change.                                                                                    | Candidate id, evidence id or source path.  |

## Minimal UI

| Region                     | Contents                                                                                                       | Required behavior                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left candidate list        | Queue grouped by status/type, with title, type badge, evidence count, and current status.                      | Selecting a row loads the candidate detail without changing state. Filters: To review, Accepted, Actions, Archived/Ignored.                                         |
| Right evidence and actions | Candidate title, reason, source notes, evidence snippets, rank explanation, and action buttons.                | Evidence rows open source notes. Primary action is Accept for `candidate`, Add action for accepted project/task/dormant candidates, and Review target for `merged`. |
| Bottom progress            | Counts for total candidates, reviewed items, accepted/highlighted items, next actions, ignored/archived items. | Progress is based on non-`candidate` statuses and updates after every state change.                                                                                 |

Markdown wireframe:

| Candidate queue                                                                                                                                                      | Evidence and actions                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `To review (11)`<br>`[topic] Writing Systems`<br>`[note] Projects/Research.md`<br>`[bridge-note] Index/MOCs.md`<br><br>`Accepted (4)`<br>`[topic] Local-first tools` | `Writing Systems`<br>Reason: Appears in 8 notes across 6 months; links project notes and daily reflections.<br><br>Evidence:<br>`Daily/2026-01-02.md#Reflection` - tag `#writing`<br>`Projects/Research.md` - 4 inbound links<br>`Topics/Writing.md` - representative note<br><br>Actions:<br>`Accept` `Rename` `Merge topic` `Add to annual highlights` `Add to actions` `Ignore` `Archive` `Open source note` |

Bottom bar:

| Reviewed | Accepted | Next actions | Ignored | Archived |
| -------- | -------- | ------------ | ------- | -------- |
| `7 / 18` | `4`      | `3`          | `2`     | `1`      |

## Persistence

Persist review state outside user-authored note bodies. The MVP should prefer plugin data for current sessions and may additionally write a review state file when users need vault-level portability.

Recommended plugin data key:

```text
annual-review.sessions.<year>
```

Optional vault state file:

```text
.annual-review/YYYY.review-state.json
```

The state file must be JSON, plugin-owned, and excluded from scan input. Do not add frontmatter properties to source notes just to track Review Board decisions.

Required persisted structure:

```ts
type ReviewSessionState = {
  schemaVersion: 1;
  year: number;
  scopeHash: string;
  scanId: string;
  candidates: ReviewCandidate[];
  decisions: ReviewDecision[];
  progress: ReviewProgress;
  createdAt: string;
  updatedAt: string;
};
```

Merge rule for repeated scans:

1. Match scanned candidates by stable `id`.
2. If the stored candidate has a user-decided status, preserve stored status, `userTitle`, decisions, highlight flag, merge target, and user note.
3. Refresh machine-owned fields such as `reason`, `score`, `rank`, and evidence when the candidate is still `candidate`.
4. Append newly scanned candidates as `candidate`.
5. Keep stored candidates that disappeared from a new scan if they are not `candidate`; mark evidence as missing instead of dropping the decision.
6. Drop disappeared undecided candidates only after the user explicitly starts a fresh review session.

## Evidence Source Contract

Every candidate must include at least one `EvidenceSource`:

| Field        | Meaning                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `id`         | Stable within candidate.                                                                                       |
| `kind`       | `note`, `tag`, `link`, `task`, `timeline`, `folder`, or `excerpt`.                                             |
| `sourcePath` | Vault-relative note path when applicable.                                                                      |
| `target`     | Tag, link target, task line, folder path, or timeline bucket.                                                  |
| `label`      | Human-readable evidence label.                                                                                 |
| `excerpt`    | Optional short source text.                                                                                    |
| `reason`     | Why this evidence supports the candidate.                                                                      |
| `missing`    | True when evidence for a previously accepted or otherwise user-decided candidate cannot be found after rescan. |

The UI must never show an accepted candidate without evidence. If all evidence is missing after rescan, keep the user decision and show a "missing evidence" warning.

## MVP Implementation Boundaries

In scope:

- State types and pure transition helpers.
- Session merge behavior for repeated scans.
- Minimal Obsidian view with queue, evidence, actions, and progress.
- Report generator reading accepted/highlight/action state.

Out of scope for v1:

- Drag-and-drop sorting.
- Bulk actions.
- Bases/Dataview dependency.
- AI-generated decisions.
- Editing source note frontmatter to store review status.
