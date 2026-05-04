# Obsidian Annual Review

[中文](README.md) | [Docs index](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Annual Review is a local-first annual review workflow plugin for
Obsidian. It helps you select important themes from a year of notes, review key
notes, make follow-up decisions, and generate a traceable, editable,
repeatable Markdown annual report.

The plugin is not trying to produce a polished recap first. It addresses the
harder review problems: finding what is worth revisiting, seeing which themes
persisted, deciding which notes should move forward or be archived, and trusting
the result because every recommendation has evidence.

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
   timeline signals inside the active vault.
2. **Candidates**: the plugin proposes annual themes, representative notes,
   project/task signals, unusual activity, and dormant assets with a short
   reason for each recommendation.
3. **Review**: you confirm, rename, merge, ignore, or archive candidates in the
   Review Board.
4. **Decisions**: you decide whether confirmed themes and notes should continue,
   merge, archive, stop, or become projects.
5. **Annual report**: the plugin writes confirmed material, evidence links,
   action decisions, and method notes to
   `Annual Reviews/YYYY Annual Review.md`.

> Screenshot placeholder: Review Board candidate list, evidence links, action
> decisions, and the generated Markdown annual report.

## Privacy Boundary

- No network access, external AI calls, or telemetry by default.
- By default, the plugin reads only Markdown files and Obsidian metadata cache
  inside the active vault.
- The report folder, templates, archives, attachments, and user-excluded scopes
  are not scanned as source input.
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

## Installation

### Install From Obsidian Community Plugins

After the plugin is listed in the community plugin browser:

1. Open Obsidian `Settings -> Community plugins`.
2. Search for **Annual Review**.
3. Click **Install**, then **Enable**.

### Manually Install The Development Build

```bash
npm install
npm run build
```

Then copy the build artifacts into the vault plugin directory:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js styles.css versions.json "$PLUGIN_DIR/"
```

Open Obsidian and enable **Annual Review** from `Settings -> Community plugins`.

## Current Commands

- `Annual Review: Rebuild index`: rescan allowed Markdown notes in the active
  vault.
- `Annual Review: Generate report`: choose a year and generation options, then
  write the annual Markdown report.
- `Annual Review: Open dashboard`: open the local preview/control surface for
  candidate signals and report actions.

## Development Commands

- `npm run test`: run Vitest coverage for tokenizer, filters, metadata
  extraction, aggregation, and Markdown rendering.
- `npm run typecheck`: run TypeScript without emitting build files.
- `npm run build`: bundle the installable Obsidian plugin.
- `npm run dev`: start esbuild watch mode for local plugin development.
- `npm run deploy:plugin`: build and optionally deploy to any vault
  `.obsidian` folder.
- `npm run deploy:smoke`: build and deploy to the smoke vault configured by
  this repository.

## Validation

Automated validation:

```bash
npm run test
npm run typecheck
npm run build
```

Manual validation:

1. Enable the plugin in a test vault.
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
- [Roadmap](docs/roadmap.md)
- [Docs index](docs/README.md)
- [AI report design](docs/ai-report-design.md)
