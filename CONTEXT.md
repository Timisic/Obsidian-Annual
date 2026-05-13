# Obsidian Time Range Review

This context describes a local-first Obsidian review plugin whose core product goal is a trusted Theme Hypothesis review loop: users inspect evidence-backed themes in Review Board, confirm the themes they trust, and only confirmed themes enter a narrative Review Report.

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
A Markdown artifact written to the vault that turns user-confirmed themes into a theme-first, human-readable review narrative with activity evidence, representative links, reflection questions, and a protected user writing area.
_Avoid_: AI report, generated summary, evidence dump, audit export

**Narrative Review Report**:
The default Review Report shape: prose-led, theme-first, and designed for later rereading rather than for auditing every local signal.
_Avoid_: dashboard report, review-board export, field report

**Activity Evidence**:
Charts and compact rhythm interpretation that explain the time range's writing activity, bursts, gaps, and theme-formation context.
_Avoid_: analytics dashboard, metrics wall

**Representative Evidence**:
A small set of Evidence Note links selected to support a confirmed report theme in the readable report.
_Avoid_: complete evidence list, local signal dump

**Evidence Audit**:
The complete review material needed to inspect local signals, all evidence notes, merge sources, hidden connection clusters, and uncertainty details.
_Avoid_: report appendix by default, reader-facing review body

**User Reflection**:
A protected user-authored section inside a Review Report that regeneration must preserve.
_Avoid_: AI reflection, generated conclusion

## Relationships

- A **Review Session** defines the scope for one **Evidence Package**.
- An **Evidence Package** contains many **Evidence Notes**.
- An **Evidence Package** should make its selection strategy explainable when it cannot cover every eligible **Evidence Note**.
- A **Theme Hypothesis** cites one or more **Evidence Notes**.
- A **Review Candidate** represents one **Theme Hypothesis** in **Review Board**.
- A **Theme Decision** belongs to one **Review Candidate**.
- A **Review Candidate** should survive renamed or reworded **Theme Hypotheses** when the underlying **Evidence Notes** substantially overlap.
- A **Review Report** includes only **Review Candidates** accepted or renamed by the user.
- A **Narrative Review Report** is the default shape of a **Review Report** across annual, quarterly, monthly, and custom-range **Review Sessions**.
- A **Narrative Review Report** uses **Activity Evidence** as background for the time range, not as the main product identity.
- A report theme cites **Representative Evidence** rather than every supporting **Evidence Note**.
- An **Evidence Audit** belongs in **Review Board** or an explicit audit export, not in the default **Review Report**.
- **User Reflection** belongs to one **Review Report** and must survive regeneration.

## Example dialogue

> **Dev:** "If the provider returns a compelling **Theme Hypothesis**, can we write it directly into the **Review Report**?"
> **Domain expert:** "No — it must first become a **Review Candidate** in **Review Board**, and only a user **Theme Decision** can promote it into the **Review Report**."
>
> **Dev:** "Should the report include every local signal, merge source, and hidden connection so the user can audit it later?"
> **Domain expert:** "No — that belongs to **Evidence Audit** material. The default **Narrative Review Report** should explain the confirmed themes clearly, cite **Representative Evidence**, preserve charts as **Activity Evidence**, and leave space for **User Reflection**."

## Flagged ambiguities

- "Theme" can mean an unreviewed **Theme Hypothesis** or a confirmed report theme. Resolved: use **Theme Hypothesis** before user review, and describe report content as user-confirmed themes.
- "Dashboard" can imply analytics. Resolved: use **Review Board** for the primary interaction surface.
- Different provider wording for substantially overlapping **Evidence Notes** should not create duplicate **Review Candidates** by default; concise review queues are more important than maximizing generated theme count.
- Evidence selection for provider context should prioritize coverage diversity over only top score, because **Theme Hypotheses** should help users rediscover varied themes rather than only obvious high-activity notes.
- "Report" can mean either a readable review artifact or a complete audit export. Resolved: **Review Report** defaults to **Narrative Review Report**; complete trace material is **Evidence Audit**.
- "3-5 themes" is a default target for **Narrative Review Report**, not a quota; short or sparse ranges may have fewer strong themes.
- "Hidden Connections" should not be a separate reader-facing report section by default; connection explanation is absorbed into theme prose.
- "Rediscovered Notes" should be reader-facing as worth-rereading notes, not as machine task suggestions.
- "Review prompts" should be reflective questions, not action items or automatic to-do lists.
- Default reports may retain sensitive names, relationship details, and money details when they are part of the source evidence; redaction requires an explicit privacy choice rather than being the default narrative style.
