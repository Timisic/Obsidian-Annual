# Obsidian Annual Review

Obsidian Annual Review is a local-first Obsidian plugin that turns vault
activity into an editable yearly review note.

The plugin scans Markdown notes, metadata, tags, links, tasks, and daily-note
patterns inside an Obsidian vault, then generates an annual review that stays in
the vault as Markdown. The durable output is designed to be editable, linkable,
syncable, versionable, and auditable.

> Current repository status: this repository includes the plugin scaffold,
> TypeScript source, tests, research notes, and product specification. It does
> not yet publish packaged release artifacts.

## Why this exists

Most Obsidian users already have fragments of an annual review scattered across
daily notes, project notes, reading notes, tags, links, and task lists. Existing
tools can count words, query notes, or visualize relationships, but they do not
combine those signals into a yearly narrative that remains native to Obsidian.

This project focuses on four principles:

- Local first: the default path reads only the active vault and makes no network
  calls.
- Markdown first: the annual review note is the primary artifact, not a hosted
  wrapped page.
- Evidence backed: named notes and surprising metrics should link back to source
  material.
- Obsidian native: commands, settings, views, and exports should fit the
  Obsidian workflow instead of replacing it.

## Repository contents

| Path | Purpose |
| --- | --- |
| [`manifest.json`](manifest.json) | Obsidian plugin manifest for the `annual-review` plugin. |
| [`package.json`](package.json) | Development scripts for build, watch, typecheck, and tests. |
| [`src/`](src) | Plugin source code for commands, settings, vault scanning, aggregation, rendering, report writing, and dashboard UI. |
| [`tests/`](tests) | Vitest fixtures and coverage for tokenizer, filters, extraction, aggregation, rendering, and command IDs. |
| [`SPEC.md`](SPEC.md) | Product specification for the Obsidian plugin, including scope, architecture, data model, validation plan, and phased delivery. |
| [`docs/research/dec-7-project-research.md`](docs/research/dec-7-project-research.md) | Market and product research covering Obsidian-native capabilities, related community plugins, annual-report patterns, and implementation recommendations. |

## Features

The current implementation covers the Markdown-first MVP path and leaves
share/export and optional adapters for later phases.

| Area | Status | Feature | Outcome |
| --- | --- | --- | --- |
| Report generation | Implemented | `Annual Review: Generate report` command | Creates `Annual Reviews/YYYY Annual Review.md` for the selected year and vault scope. |
| Dashboard | Implemented | `Annual Review: Open dashboard` ItemView | Provides year preview, index status, totals, top lists, report generation, and open-report actions. |
| Reindexing | Implemented | `Annual Review: Rebuild index` command | Re-scans Markdown files after vault or settings changes. |
| Settings | Implemented | Report folder, include/exclude folders, metric toggles, and privacy mode | Lets users shape the scan without editing code. |
| Local analysis | Implemented | Vault scanner using Obsidian Markdown file reads | Reads note paths, timestamps, frontmatter, tags, links, headings, and tasks without requiring third-party plugins. |
| Metrics | Implemented | Year totals, active days, streaks, word/character counts, monthly buckets, top folders, tags, links, representative notes, and tasks | Gives users a concrete view of writing volume, cadence, and knowledge structure. |
| CJK-aware counting | Implemented | Mixed Latin-word and CJK-character counting | Keeps Chinese, Japanese, Korean, English, and mixed-language vaults understandable. |
| Evidence links | Implemented | Obsidian wiki links for representative and ranked notes | Makes the generated review inspectable instead of opaque. |
| Privacy controls | Partial | Local-only generation plus include/exclude and privacy labeling | Keeps default processing local; richer export/AI controls remain future work. |
| Sharing | Future | Local PNG/SVG/HTML share-card export | Supports optional public highlights without default cloud upload. |

## Use cases

- Personal annual review: summarize a year of daily notes, project logs, ideas,
  tags, and links into a review note that can be edited before sharing.
- Writing review: measure yearly word and character output, active days, longest
  streaks, most edited notes, and representative writing periods.
- Research review: identify top tags, linked notes, folders, and theme shifts
  across reading notes, evergreen notes, and project notes.
- Project retrospective: pull task, folder, and note activity into a yearly
  summary for teams or solo projects that use Obsidian as a work journal.
- Vault maintenance: surface stale areas, highly linked notes, orphaned themes,
  and next-year cleanup actions from the generated methodology section.
- Shareable recap: export selected, privacy-safe highlights after the user
  explicitly chooses what data can leave the private review note.

## Competitive and alternative tool comparison

This project is closest to a yearly-review layer that composes existing Obsidian
signals. It is not trying to replace lower-level tools such as word counters,
query engines, or graph views.

| Tool / approach | What it does well | Gap for annual reviews | Positioning for this project |
| --- | --- | --- | --- |
| Obsidian core Word count, Bases, Canvas, Graph, Workspaces ([core plugins](https://obsidian.md/help/Plugins/Core%2Bplugins)) | Native, local, widely available building blocks for counts, database-like views, layouts, and relationship exploration. | These are general-purpose surfaces; users still assemble the annual narrative manually. | Use core Obsidian concepts and generated Markdown as the default experience. |
| Novel Word Count ([GitHub](https://github.com/isaaclyman/novel-word-count-obsidian)) | Shows file, folder, and vault-level writing statistics close to the file explorer. | Optimized for ongoing word-count visibility, not yearly storytelling, evidence selection, or review generation. | Borrow the value of local writing metrics, then add yearly aggregation and narrative structure. |
| Daily Stats ([GitHub](https://github.com/dhruvik7/obsidian-daily-stats)) and similar writing trackers | Tracks daily word counts and historical writing logs. | Usually centered on daily cadence rather than tags, links, representative notes, methodology, and exportable annual artifacts. | Include activity rhythm as one module inside a broader vault review. |
| Dataview ([GitHub](https://github.com/blacksmithgu/obsidian-dataview)) | Powerful Markdown query layer for frontmatter, inline fields, lists, and custom dashboards. | Requires user-authored queries and does not provide a built-in annual-review product flow. | Read Markdown-backed facts independently; optionally interoperate with Dataview-style fields later. |
| Bases ([Obsidian docs](https://docs.obsidian.md/plugins/guides/bases-view)) | Core database views for sorting, filtering, grouping, and editing note properties. | Excellent for browsing structured notes, but not a guided annual report generator by itself. | Generate properties or `.base` suggestions later while keeping Markdown report generation primary. |
| Tracker / Charts-style plugins | Good at visualizing time series and habits. | Visualization-focused; users still define data sources, interpretation, and review prose. | Use simple charts in the dashboard, with source-backed Markdown as the deliverable. |
| Prompted or AI-assisted "Obsidian Wrapped" workflows | Can produce a polished one-off narrative from exported or selected vault data. | Often depends on external tools, manual prompting, and unclear data boundaries. | Keep the default offline and repeatable; make any AI provider explicit opt-in with preview and redaction. |

## Quick start

### Understand the project in five minutes

1. Read [`SPEC.md`](SPEC.md) for the product scope, architecture, data model,
   validation plan, and phased delivery.
2. Read [`docs/research/dec-7-project-research.md`](docs/research/dec-7-project-research.md)
   for the research behind the Markdown-first product direction.
3. Use the "Features" and "Competitive and alternative tool comparison"
   sections in this README as the product overview.

### Build and test locally

```bash
npm install
npm run test
npm run typecheck
npm run build
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run test` | Run Vitest coverage for core parsing, aggregation, rendering, and command IDs. |
| `npm run typecheck` | Run TypeScript without emitting build files. |
| `npm run build` | Bundle the plugin to `main.js` for manual Obsidian installation. |
| `npm run dev` | Start esbuild watch mode for local plugin development. |

### Install into an Obsidian vault for manual testing

After `npm run build`, copy the plugin files into a vault:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js "$PLUGIN_DIR/"
```

Then open Obsidian, enable community plugins, enable **Annual Review**, and run
the commands from the command palette.

### Generate the first annual review

1. Open plugin settings and confirm report folder, included folders, excluded
   folders, metric toggles, and privacy mode.
2. Run `Annual Review: Rebuild index` when validating a fresh or changed vault.
3. Run `Annual Review: Generate report` from the command palette.
4. Select year and generation options.
5. Open `Annual Reviews/YYYY Annual Review.md`.
6. Inspect linked evidence notes, edit the generated narrative, and rerun the
   command when the vault changes.
7. Optionally run `Annual Review: Open dashboard` to preview metrics and reopen
   the latest generated report.

## Product boundaries

- No default cloud processing.
- No default external AI calls.
- No telemetry requirement.
- No mandatory dependency on Dataview, Bases, Tasks, Kanban, Projects, or Novel
  Word Count.
- No reading files outside the active Obsidian vault during plugin operation.
- No dashboard-only product path; generated Markdown remains the primary output.

## Roadmap

| Phase | Focus | Deliverable |
| --- | --- | --- |
| Phase 0 | Spec and fixtures | Complete: product spec, sample vault fixtures, metric methodology snapshots. |
| Phase 1 | Statistics engine | Complete baseline: scanner, tokenizer, metadata extraction, filters, aggregation, deterministic Markdown output. |
| Phase 2 | Obsidian commands and settings | Complete baseline: command palette entries, settings tab, vault report writer, and in-memory index cache. |
| Phase 3 | Dashboard | Complete baseline: Obsidian `ItemView` with controls, metric summary, top lists, representative notes, and regeneration actions. |
| Phase 4 | Export and adapters | Privacy-aware share cards, optional Canvas/Bases output, adapters for Markdown-backed third-party plugin data. |
| Phase 5 | Optional AI | Opt-in AI provider interface with redaction preview, source evidence, and local caching. |

## Validation

Current automated validation:

```bash
npm run test
npm run typecheck
npm run build
```

The test suite currently covers:

- tokenizer behavior for English, CJK, and mixed-language content;
- path filtering for generated reports, templates, archive folders, and
  non-Markdown files;
- frontmatter, tag, link, heading, and task extraction;
- year aggregation, monthly buckets, streaks, top lists, and representative
  notes;
- Markdown renderer sections and source-note links;
- registered plugin command IDs.

Manual validation should still be run in Obsidian before release: install the
built plugin into a test vault, rebuild the index, generate a report, open the
dashboard, rerun generation, and confirm the generated Markdown remains readable
without third-party plugins or network access.
