# Obsidian Time Range Review

This context describes a local-first Obsidian review plugin whose core product goal is a trusted Theme Hypothesis review loop: users inspect evidence-backed themes in Review Board, confirm the themes they trust, and only confirmed themes enter the Review Report.

## Language

**Review Session**:
A bounded time-range review with scan scope, privacy settings, AI settings, state, and report path.
_Avoid_: run, job, generation

**Evidence Note**:
A source note included in the bounded evidence set for a Review Session, with path, excerpt, date signals, links, and local signals.
_Avoid_: source document, input file

**Evidence Package**:
The bounded set of Evidence Notes and local signals made available for Theme Hypothesis generation; selection should favor coverage diversity across time periods, folders, connection clusters, and long-tail clues over simply taking the highest-scored notes.
_Avoid_: full vault context, prompt dump

**Theme Hypothesis**:
An evidence-backed proposed theme that must be reviewed by the user before it can be treated as a conclusion.
_Avoid_: final theme, AI conclusion, summary

**Review Candidate**:
The Review Board state representation of a Theme Hypothesis, including evidence, status, and user decisions; its identity should be stable across provider wording changes when the cited Evidence Notes substantially overlap.
_Avoid_: card, item, row

**Theme Decision**:
A user decision about a Review Candidate, such as accept, rename, merge, or ignore.
_Avoid_: AI judgment, automatic classification

**Review Board**:
The primary interaction surface where users inspect Theme Hypotheses, review Evidence Notes, and make Theme Decisions.
_Avoid_: dashboard, analytics view

**Review Report**:
A Markdown artifact written to the vault that includes only user-confirmed themes and their traceable evidence.
_Avoid_: AI report, generated summary

## Relationships

- A **Review Session** defines the scope for one **Evidence Package**.
- An **Evidence Package** contains many **Evidence Notes**.
- An **Evidence Package** should make its selection strategy explainable when it cannot cover every eligible **Evidence Note**.
- A **Theme Hypothesis** cites one or more **Evidence Notes**.
- A **Review Candidate** represents one **Theme Hypothesis** in **Review Board**.
- A **Theme Decision** belongs to one **Review Candidate**.
- A **Review Candidate** should survive renamed or reworded **Theme Hypotheses** when the underlying **Evidence Notes** substantially overlap.
- A **Review Report** includes only **Review Candidates** accepted or renamed by the user.

## Example dialogue

> **Dev:** "If the provider returns a compelling **Theme Hypothesis**, can we write it directly into the **Review Report**?"
> **Domain expert:** "No — it must first become a **Review Candidate** in **Review Board**, and only a user **Theme Decision** can promote it into the **Review Report**."

## Flagged ambiguities

- "Theme" can mean an unreviewed **Theme Hypothesis** or a confirmed report theme. Resolved: use **Theme Hypothesis** before user review, and describe report content as user-confirmed themes.
- "Dashboard" can imply analytics. Resolved: use **Review Board** for the primary interaction surface.
- Different provider wording for substantially overlapping **Evidence Notes** should not create duplicate **Review Candidates** by default; concise review queues are more important than maximizing generated theme count.
- Evidence selection for provider context should prioritize coverage diversity over only top score, because **Theme Hypotheses** should help users rediscover varied themes rather than only obvious high-activity notes.
