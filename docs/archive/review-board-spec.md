# Review Board MVP Specification

Status: DEC-77 scope-converged MVP specification.

Review Board is the review surface between vault scanning and report generation. It presents one card type only: **Theme Hypothesis**. Evidence Notes, Evidence Clusters, tags, links, tasks, folders, and timeline signals support that card, but they are not separate user-facing candidate queues.

## MVP Rules

1. A Review Session produces a stable set of Theme Hypotheses for one time range.
2. The user reviews one Theme Hypothesis card at a time while retaining list context.
3. Every Theme Hypothesis explains why it appeared and links back to Evidence Notes.
4. Tags are weak signals only; they may help form evidence clusters but are not the primary theme path.
5. Confirmed user decisions survive repeated scans.
6. Review Board must not look or behave like a task manager.

## Card Type

| Type               | Meaning                                                                                | Primary evidence                                                                                                       | Default user question                         |
| ------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `theme-hypothesis` | A possible theme, direction, or evidence cluster that appears across the review range. | Evidence Notes, links, folders, headings, excerpts, timeline signals, weak tag/task signals, and representative notes. | Is this a real theme for this Review Session? |

Each Theme Hypothesis must have:

- stable `id` derived from year/range and theme identity;
- `type: "theme-hypothesis"`;
- suggested title;
- short reason;
- status;
- at least one evidence source;
- source paths for Obsidian note opening and rescans;
- optional score/rank explanation for sorting only.

## Status Model

| Status      | Meaning                                                        | Report impact                                                                 |
| ----------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `candidate` | Newly scanned or still undecided.                              | Not included by default.                                                      |
| `accepted`  | User accepts the hypothesis as review-worthy.                  | Eligible for the Review Report.                                               |
| `renamed`   | User accepts the hypothesis with a user-facing title override. | Eligible for the Review Report using `userTitle`.                             |
| `merged`    | User merged this hypothesis into another hypothesis.           | Source hypothesis is not shown as standalone; target carries merged evidence. |
| `ignored`   | User intentionally skips it for this review.                   | Not included, but preserved in state.                                         |

Allowed transitions:

| From                               | To          | Trigger                                       |
| ---------------------------------- | ----------- | --------------------------------------------- |
| `candidate`                        | `accepted`  | Accept.                                       |
| `candidate`, `accepted`            | `renamed`   | Rename.                                       |
| `candidate`, `accepted`, `renamed` | `merged`    | Merge into another Theme Hypothesis.          |
| `candidate`, `accepted`, `renamed` | `ignored`   | Ignore.                                       |
| `ignored`, `merged`                | `candidate` | Only by explicit reset, not by repeated scan. |

Repeated scans may update reason, score, sort rank, and evidence on undecided hypotheses. They must not overwrite `accepted`, `renamed`, `merged`, or `ignored` decisions.

## Actions

| Action           | Applies to                         | State effect                                                   | Required payload                          |
| ---------------- | ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Accept           | Theme Hypothesis.                  | `candidate` -> `accepted`.                                     | Candidate id.                             |
| Rename           | Theme Hypothesis.                  | Active status -> `renamed`.                                    | Candidate id, non-empty user title.       |
| Merge            | Theme Hypothesis.                  | Source -> `merged`; target receives merged source id/evidence. | Source id, target id.                     |
| Ignore           | Theme Hypothesis.                  | Active status -> `ignored`.                                    | Candidate id, optional note.              |
| Open Source Note | Any hypothesis with note evidence. | No state change.                                               | Candidate id, evidence id or source path. |

Deferred actions: Add to actions, Archive, Add to annual highlights, and bulk actions.

## Minimal UI

| Region                       | Contents                                                                                           | Required behavior                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Left hypothesis list         | Queue grouped by To review, Confirmed, and Closed, with title, evidence count, and current status. | Selecting a row loads detail without changing state. No separate project/task/dormant/bridge queues. |
| Right evidence and decisions | Hypothesis title, reason, source notes, evidence snippets, rank explanation, and decision buttons. | Evidence rows open source notes. Primary decision is Accept for undecided hypotheses.                |
| Bottom progress              | Counts for total hypotheses, reviewed items, confirmed items, merged items, and ignored items.     | Progress is based on non-`candidate` statuses and updates after every state change.                  |

Markdown wireframe:

| Theme Hypotheses                                                                                                                                             | Evidence and decisions                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `To review (3)`<br>`[theme-hypothesis] Writing Systems`<br>`[theme-hypothesis] Local-first tools`<br><br>`Confirmed (1)`<br>`[theme-hypothesis] AI judgment` | `Writing Systems`<br>Reason: Appears in notes across several months and connects daily reflections to project notes.<br><br>Evidence:<br>`Review Fixtures/2026-01-01.md` - representative note<br>`Projects/Research.md` - backlink evidence<br><br>Decisions:<br>`Accept` `Rename` `Merge` `Ignore` `Open Source Note` |

Bottom bar:

| Reviewed | Confirmed | Merged | Ignored |
| -------- | --------- | ------ | ------- |
| `3 / 7`  | `2`       | `1`    | `0`     |

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

## Evidence Source Contract

Every Theme Hypothesis must include at least one `EvidenceSource`:

| Field        | Meaning                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------- |
| `id`         | Stable within candidate.                                                                  |
| `kind`       | `note`, `tag`, `link`, `task`, `timeline`, `folder`, or `excerpt`.                        |
| `sourcePath` | Vault-relative note path when applicable.                                                 |
| `target`     | Tag, link target, task line, folder path, or timeline bucket.                             |
| `label`      | Human-readable evidence label.                                                            |
| `excerpt`    | Optional short source text.                                                               |
| `reason`     | Why this evidence supports the hypothesis.                                                |
| `missing`    | True when evidence for a previously user-decided hypothesis cannot be found after rescan. |

The UI must never show an accepted hypothesis without evidence. If all evidence is missing after rescan, keep the user decision and show a missing-evidence warning.

## MVP Implementation Boundaries

In scope:

- Theme Hypothesis state types and pure transition helpers.
- Session merge behavior for repeated scans.
- Minimal Obsidian view with hypothesis list, evidence, decisions, and progress.
- Report generator reading accepted/renamed Theme Hypotheses only.

Out of scope:

- Project, task, dormant-note, or bridge-note as independent candidate types.
- Add to actions / Action Item system.
- Archive decision system.
- Annual highlights.
- Strong action section in the generated report.
- Drag-and-drop sorting.
- Bulk actions.
- Bases/Dataview dependency.
- AI-generated decisions.
- Editing source note frontmatter to store review status.
