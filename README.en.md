# Obsidian Annual Review

[中文](README.md) | [Docs index](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Annual Review is a local-first **Time Range Review** plugin for
Obsidian. It helps you review an annual, quarterly, monthly, or custom date
range by rediscovering forgotten notes, surfacing the hidden themes that connect
them, and writing only user-confirmed conclusions into a traceable Markdown
review report.

It is built around three pains:

- **Forgetting**: after a busy period, you remember the recent, loud, or obvious
  notes, while older but important notes disappear.
- **Broken connections**: many real relationships between notes are never fully
  captured by links, tags, or folders.
- **Distrust of automatic summaries**: AI can write polished summaries, but you
  need to know what it saw, why it connected those notes, and which claims still
  need review.

The plugin's promise is not "one-click life summary." The core loop is:

```text
Choose time range -> Compile evidence notes -> Generate theme hypotheses -> User review -> Write confirmed Markdown report
```

Annual Review remains the default preset, alongside Quarterly Review, Monthly
Review, and Custom Range. Every Theme Hypothesis must keep Evidence Notes,
connection explanations, and uncertainty notes. A hypothesis enters the final
report only after the user accepts, renames, merges, or otherwise confirms it in
Review Board.

## Who It Is For

- Obsidian users who write daily notes, project logs, reading notes, research
  notes, or evergreen notes.
- People who want to review a period without organizing their whole vault first.
- Users who want AI to extract themes and explain relationships, but do not want
  AI to make final judgments for them.
- Users who keep review artifacts as local Markdown and inspect changes with
  Obsidian Sync, Git, or another versioning tool.

## Core Concepts

| Concept          | Meaning                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Review Session   | One review's time range, scan scope, privacy settings, AI settings, state, and report path.      |
| Evidence Note    | A source note included in the evidence pack, with path, title, excerpt, links, and time signals. |
| Evidence Cluster | A group of evidence notes that may support the same theme.                                       |
| Theme Hypothesis | A proposed theme line based on evidence. It is a reviewable hypothesis, not a user conclusion.   |
| Theme Decision   | The user's accept, rename, merge, or ignore decision for a theme hypothesis.                     |
| Review Report    | The Markdown report written to the vault, containing only confirmed themes and evidence.         |

`project`, `task`, `action`, and `archive` capabilities may return as later
extensions, but they are not MVP core objects or first-screen promises.

## Review Board Loop

`Annual Review: Open Review Board` opens the current Review Session's Theme
Hypothesis queue. Each theme card shows:

- Theme title and one-line explanation.
- Representative Evidence Notes.
- A Connection Explanation for why those notes may belong to the same line of
  thought.
- Evidence links, excerpts, and uncertainty notes.
- User actions: Accept, Rename, Merge, Ignore, Open evidence, Re-explain.

Theme Hypotheses require user review. The plugin can say "these notes may form
this theme," but the final report only includes user-confirmed titles,
explanations, evidence, and additions.

## AI's Role

AI is the **theme extractor and relationship explainer**:

- It proposes Theme Hypotheses from a controlled evidence pack.
- It explains possible relationships between Evidence Notes.
- It marks uncertainty and notes that need careful user review.
- After confirmation, it may help polish report draft text.

The plugin is the **evidence compiler, Review Board, state manager, and report
writer**. By default it makes no network requests, calls no external AI, and
sends no telemetry. External AI is only used when the user explicitly enables it
and confirms the context scope.

## Plugin vs. Full Prompt

A strong prompt can ask a model to read many notes and summarize a period. The
plugin adds:

- Local scan and scope control: Annual / Quarterly / Monthly / Custom Range,
  include/exclude rules, and privacy boundaries.
- Reviewable evidence: every Theme Hypothesis is linked to source notes,
  excerpts, and connection explanations.
- Saved user decisions: accept, rename, merge, and ignore state persists in the
  Review Session.
- Reproducible output: reports contain confirmed content and regeneration does
  not overwrite user-written sections.
- Native Obsidian workflow: source notes open directly and the Markdown artifact
  remains in the vault.

## Privacy And Edit Protection

- No network access, external AI calls, or telemetry by default.
- By default, the plugin reads only allowed Markdown files and Obsidian metadata
  cache inside the active vault.
- Report folders, templates, attachments, and user-excluded scopes are not
  scanned as source input.
- Generated text lives in plugin-managed sections, while user sections remain
  reserved for personal writing and edits.
- Regeneration only replaces reproducible sections and does not overwrite
  user-written sections.
- Every theme hypothesis and connection explanation keeps source-note evidence
  so the user can verify it before accepting it.

## Installation And Path Boundaries

Documentation uses three distinct vault paths:

- **Normal user vault**: the user's own Obsidian vault. Community installation
  and manual release-package installation target this path.
- **Repo-local validation vault**: `tests/fixtures/obsidian-smoke-vault`, used
  for unit-test samples and repository-local Review Board validation.
- **Custom smoke vault**: automation agents or release reviewers may set
  `SMOKE_VAULT_PATH` to an explicit local test vault; this is not a normal user
  installation path.

### Install From Obsidian Community Plugins

After the plugin is listed:

1. Open Obsidian `Settings -> Community plugins`.
2. Search for **Annual Review**.
3. Click **Install**, then **Enable**.

### Manual Release Package Install

```bash
npm install
npm run release:plugin
```

Copy the release artifacts to a vault plugin directory:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

Open Obsidian and enable **Annual Review** from `Settings -> Community plugins`.

## Available Commands

| Command                            | Purpose                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Annual Review: Rebuild index`     | Rescan allowed Markdown notes for the current Review Session and record a snapshot.               |
| `Annual Review: Open Review Board` | Open the Theme Hypothesis queue for evidence review, connection explanation, and theme decisions. |
| `Annual Review: Generate report`   | Write a protected Markdown review report for Annual / Quarterly / Monthly / Custom Range.         |

## Development Commands

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `npm run test`      | Run Vitest.                                                |
| `npm run typecheck` | Run TypeScript type checking without emitting build files. |
| `npm run build`     | Build the installable Obsidian plugin bundle.              |
| `npm run format`    | Format code and docs with Prettier.                        |

## Local Validation

```bash
npm install
npm run test
npm run typecheck
npm run build
```

Manual smoke path:

1. Install and enable the plugin.
2. Create an Annual, Quarterly, Monthly, or Custom Range Review Session.
3. Run `Annual Review: Rebuild index`.
4. Open Review Board and confirm Theme Hypotheses, Evidence Notes, Connection
   Explanation, and review actions are visible.
5. Accept, rename, merge, or ignore several Theme Hypotheses.
6. Run `Annual Review: Generate report`.
7. Confirm the report includes only user-confirmed themes, evidence links,
   methodology, and user-written sections, and that source notes can be opened.
