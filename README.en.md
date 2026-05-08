# Obsidian Annual Review

[中文](README.md) | [Docs index](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Annual Review is a local-first annual review workflow plugin for
Obsidian. It helps you select candidate themes from a year of notes, review
candidate notes, make follow-up decisions, and generate a traceable, editable,
repeatable Markdown annual report.

The plugin has one main promise: scan the local vault, suggest candidates with
rationale and evidence links, let the user accept them in Review Board, and
write accepted results into a protected Markdown annual report.

## Who it is for

- Obsidian users who write daily notes, project logs, reading notes, research
  notes, or evergreen notes.
- People who want a meaningful first annual review pass in 10-15 minutes
  without organizing the whole vault first.
- Users who want recommendations with reasons and source-note links, while
  keeping final judgment in their own hands.
- Users who keep annual reports as local Markdown and review changes with
  Obsidian Sync, Git, or another versioning tool.

## Core Workflow

```text
Scan scope -> Generate candidates -> Review Board -> Decisions -> Markdown report
```

1. **Scan**: choose a year, include/exclude folders, and privacy mode. The
   plugin reads only allowed Markdown, properties, tags, links, tasks, and
   timeline signals inside the active vault, and records a vault snapshot during
   rebuild/run.
2. **Candidates**: the plugin proposes topic, note, project, task, dormant-note,
   and bridge-note candidates with auditable recommendation rationale, stat
   fields, and evidence links. Unusual activity is only a signal for candidate
   generation.
3. **Review**: you accept, rename, merge topics, ignore, archive, or add
   candidates to actions in the Review Board.
4. **Decisions**: you decide whether accepted topics, notes, projects, tasks,
   dormant notes, and bridge notes become annual highlights or next actions.
5. **Annual report**: the plugin writes accepted material, evidence links,
   action decisions, and method notes to `Annual Reviews/YYYY Annual Review.md`.

## Privacy Boundary

- No network access, external AI calls, or telemetry by default.
- By default, the plugin reads only Markdown files and Obsidian metadata cache
  inside the active vault.
- The report folder, templates, archives, attachments, and user-excluded scopes
  are not scanned as source input.
- `annual-review-snapshots.json` is stored in the plugin-owned
  `.obsidian/plugins/<plugin-id>/` data directory for later word-delta
  comparison; it does not modify source-note frontmatter.
- AI is an optional report-drafting enhancement; the core candidate, review,
  decision, and evidence workflow does not depend on AI.
- If a user explicitly enables an external AI provider, the plugin must explain
  the provider, context scope, excerpt count, and available exclusions before
  sending.

## How The Plugin Protects User Edits

- The annual report is a normal Markdown file in the vault, so Obsidian, Git, or
  sync tools can inspect its history.
- Generated content should live in plugin-managed sections, while user sections
  remain reserved for personal writing and edits.
- Regeneration only replaces reproducible sections and does not overwrite
  user-written sections.
- Before regeneration, the plugin should preserve the previous version or
  produce a diffable change for rollback.
- Every candidate and action suggestion keeps source-note, tag, link, task, or
  timeline evidence so the user can verify it before accepting it.

## Data Methodology

- When comparable historical snapshots exist, the annual report shows real vault
  word-count deltas computed from snapshot history.
- When no historical snapshot exists, or include/exclude scope changes make
  snapshots incompatible, growth metrics are labeled as current-vault inference
  instead of precise historical growth.
- Snapshot capture reuses the same include/exclude folders, exclude patterns,
  and report-folder exclusion as the report scan. Excluded directories do not
  enter snapshots or delta statistics.
- See [Data Methodology](docs/data-methodology.md) for the JSON format,
  capture timing, limitations, imports, batch modifications, and excluded
  directory behavior.

## Installation And Path Boundaries

Documentation uses three distinct vault paths:

- **Normal user vault**: the user's own Obsidian vault. Community installation
  and manual release-package installation target this path.
- **Repo-local fixture vault**: `tests/fixtures/vault`, used only for unit tests
  and deterministic Markdown samples. It is not a real Obsidian smoke vault.
- **Real smoke vault**: the local Obsidian CLI validation vault used by agents
  and release reviewers for end-to-end checks. It is not the ordinary-user
  install path and is not exposed as the public package-script main path.

### Install From Obsidian Community Plugins

After the plugin is listed in the community plugin browser:

1. Open Obsidian `Settings -> Community plugins`.
2. Search for **Annual Review**.
3. Click **Install**, then **Enable**.

### Manually Install The Release Package

```bash
npm install
npm run release:plugin
```

Then copy the release assets into the vault plugin directory:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

Open Obsidian and enable **Annual Review** from `Settings -> Community plugins`.

## Current Commands

- `Annual Review: Rebuild index`: rescan allowed Markdown notes in the active
  vault and record a snapshot.
- `Annual Review: Generate report`: choose a year and generation options, then
  write the protected annual Markdown report.
- `Annual Review: Open Review Board`: review candidate rationale, evidence
  links, and accepted status.

## Development Commands

- `npm run test`: run Vitest coverage for tokenizer, filters, metadata
  extraction, aggregation, and Markdown rendering.
- `npm run typecheck`: run TypeScript without emitting build files.
- `npm run build`: bundle the installable Obsidian plugin.
- `npm run lint`: run ESLint.
- `npm run release:plugin`: create `dist/annual-review/` release assets.
- `npm run dev`: start esbuild watch mode for local plugin development.
- `npm run dev:deploy-plugin`: development/agent smoke validation only; deploy
  to an explicit test vault `.obsidian` folder, not the ordinary install path.

## Validation

Automated validation:

```bash
npm run test
npm run typecheck
npm run build
npm run lint
```

Manual validation:

1. Enable the plugin in your temporary test vault or the agent smoke vault.
2. Run `Annual Review: Rebuild index`.
3. Run `Annual Review: Generate report`.
4. Confirm the report appears under `Annual Reviews/` and candidates link back
   to source notes.
5. Edit a user-written section in the report, regenerate, and confirm the user
   edit remains intact.
6. Confirm default settings make no external network request or AI call.

## More Documentation

- [Product Definition](docs/product-definition.md)
- [SPEC](docs/product-specification.md)
- [Feature Inventory](docs/feature-inventory.md)
- [Roadmap](docs/roadmap.md)
- [Docs index](docs/README.md)
- [Data Methodology](docs/data-methodology.md)
- [Release checklist](docs/release-checklist.md)
