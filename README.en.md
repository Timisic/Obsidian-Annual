# Obsidian Annual Review

[中文](README.md) | [Docs index](docs/README.md) | [Product spec](docs/product-spec.md)

Obsidian Annual Review is a local-first Obsidian plugin that turns vault activity into an editable, evidence-backed yearly review note.

The plugin scans Markdown notes, properties, tags, links, headings, tasks, and daily-note patterns inside the active Obsidian vault. It then generates `Annual Reviews/YYYY Annual Review.md` with yearly totals, monthly rhythm, representative notes, top tags/folders/links, and methodology notes. The output stays in your vault as Markdown, so it remains editable, linkable, syncable, versionable, and auditable.

> Repository status: this repo includes the plugin scaffold, TypeScript source, tests, product spec, and research notes. It does not yet publish packaged community-plugin release artifacts.

## Who it is for

- Obsidian users who write daily notes, project logs, reading notes, research notes, or evergreen notes.
- Writers and researchers who want to review writing volume, active days, topic shifts, and representative work.
- Users who want annual-review material to stay local instead of being uploaded to a hosted recap page.
- Users who prefer an evidence-backed draft they can edit into their own yearly narrative.

## Features

| Area | Status | What it does |
| --- | --- | --- |
| Report generation | Baseline implemented | Run `Annual Review: Generate report` to create a Markdown report for a selected year. |
| Dashboard | Baseline implemented | Run `Annual Review: Open dashboard` to preview metrics, top lists, and report actions. |
| Reindexing | Baseline implemented | Run `Annual Review: Rebuild index` after vault or setting changes. |
| Local analysis | Baseline implemented | Reads Markdown, frontmatter, tags, links, headings, tasks, and file timestamps through Obsidian APIs. |
| Mixed-language counting | Baseline implemented | Keeps Latin word counts and CJK character counts useful for Chinese, English, and mixed vaults. |
| Evidence links | Baseline implemented | Uses Obsidian links for representative notes and ranked note references. |
| Daily word heatmap | Baseline implemented | Shows daily created-note word volume in the report and dashboard, similar to a contribution heatmap. |
| Word growth trend | Baseline implemented | Shows monthly word growth and cumulative words so fast and flat periods are easy to spot. |
| ChatGPT provider | Optional baseline | Report generation can opt into ChatGPT; it is off by default, requires an OpenAI API key, and does not hardcode secrets. |
| Privacy controls | Partial | Default processing is local; AI requires explicit selection, while richer redaction preview remains future work. |

## Recent Changes

DEC-17 added two report-quality improvements:

- **AI-personalized report section**: the generate modal can switch the AI provider from `None` to `ChatGPT`. The plugin sends annual aggregates, top tags/folders/links, representative notes, link relationships, and clipped note excerpts to the OpenAI Responses API, then appends the returned content as an `AI Personalization` section. Without an API key, it makes no network request and writes a readable provider status plus TODOs into the report.
- **Richer charts**: reports and the dashboard now include a daily word heatmap plus a monthly growth trend with gained and cumulative words. The heatmap makes high-volume writing days visible; the growth trend makes fast and flat months easier to compare.
- **AI context placeholder script**: `npm run ai:context-placeholder` prints the future Obsidian skill/CLI context-adapter contract. The current script does not read a vault or make network requests.

## ChatGPT Provider And Privacy

The default remains local-first: `AI provider` is `None`, and report generation does not access the network. To enable ChatGPT:

1. Open the Annual Review plugin settings.
2. Set `AI provider` to `ChatGPT`.
3. Enter an `OpenAI API key` and adjust `ChatGPT model` if needed.
4. Run `Annual Review: Generate report` and confirm the provider for that run in the generate modal.

The privacy boundary is explicit: ChatGPT mode sends the report context, link relationships, and selected note excerpts to OpenAI. The current implementation requires an opt-in provider, stores no hardcoded secret, and skips the request when the key is missing; finer-grained data preview, redaction controls, and Obsidian skill/CLI context enrichment remain captured in the script TODO.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Verify the project

```bash
npm run test
npm run typecheck
npm run build
```

These commands validate the core logic, TypeScript types, and Obsidian plugin bundle. `npm run build` creates `main.js` for manual installation.

### 3. Install into a test vault

Prepare an Obsidian test vault, then copy the plugin files into that vault:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js "$PLUGIN_DIR/"
```

In Obsidian:

1. Enable community plugins.
2. Enable **Annual Review**.
3. Open the plugin settings and confirm the report folder, include/exclude folders, report language, generator language, metric toggles, privacy mode, and AI provider.

### 4. Generate the first annual review

1. Run `Annual Review: Rebuild index` from the command palette.
2. Run `Annual Review: Generate report`.
3. Select the year and generation options.
4. Open `Annual Reviews/YYYY Annual Review.md`.
5. Review the yearly totals, daily word heatmap, word growth trend, top tags/folders/links, representative notes, and methodology.
6. Edit the Markdown report in your own voice; rerun generation after the vault changes.
7. Run `Annual Review: Open dashboard` when you want a metric preview first.

## Use Cases

- **Personal yearly review**: turn daily notes, projects, ideas, and tasks into an editable annual summary.
- **Writing review**: inspect yearly words/characters, active days, streaks, active months, and representative long-form notes.
- **Research review**: identify top tags, central links, dominant folders, and topic shifts across the year.
- **Project retrospective**: collect project-note, folder, and task activity into review material.
- **Vault maintenance**: surface frequently edited areas, high-signal themes, and notes that need metadata cleanup.
- **Share preparation**: generate a complete private report locally, then manually select safe excerpts for public sharing.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Obsidian plugin manifest for `annual-review`. |
| `package.json` | Development scripts for tests, typecheck, build, and watch mode. |
| `src/` | Plugin source for commands, settings, vault scanning, aggregation, rendering, report writing, and dashboard UI. |
| `tests/` | Vitest coverage and fixture vault content. |
| `docs/` | Product spec, research notes, docs index, and future docs. |
| `docs/product-spec.md` | Chinese product specification covering scope, architecture, validation, and roadmap. |
| `docs/research/dec-7-project-research.md` | Early project research kept under docs as background material. |

## Boundaries

- No default network access.
- No default external AI calls.
- No required Dataview, Bases, Tasks, Kanban, Projects, or Novel Word Count dependency.
- No reading files outside the active Obsidian vault during plugin operation.
- The Markdown annual review remains the primary artifact; the dashboard is a preview and control surface.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run test` | Run Vitest coverage for tokenizer, filters, extraction, aggregation, and Markdown rendering. |
| `npm run typecheck` | Run TypeScript without emitting build files. |
| `npm run build` | Bundle the plugin into `main.js`. |
| `npm run dev` | Start esbuild watch mode for local plugin development. |
| `npm run ai:context-placeholder` | Print the placeholder contract for a future Obsidian skill/CLI AI context adapter. |

## Validation

Automated validation:

```bash
npm run test
npm run typecheck
npm run build
```

Manual validation:

1. Install the plugin into a test vault.
2. Rebuild the index, generate a report, and open the dashboard.
3. Confirm the report is created under `Annual Reviews/`.
4. Confirm Obsidian links in the report open source notes.
5. Regenerate the report and confirm old content is not duplicated.
6. Repeat the core flow in a clean vault without third-party plugins.

## More Documentation

- [Chinese README](README.md)
- [Docs index](docs/README.md)
- [Product spec](docs/product-spec.md)
- [Research notes](docs/research/dec-7-project-research.md)
