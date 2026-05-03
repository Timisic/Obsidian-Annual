# Obsidian Annual Review

Obsidian Annual Review is a spec-first project for a local-first Obsidian plugin
that turns vault activity into an editable yearly review note.

The intended product scans Markdown notes, metadata, tags, links, tasks, and
daily-note patterns inside an Obsidian vault, then generates an annual review
that stays in the vault as Markdown. The durable output is designed to be
editable, linkable, syncable, versionable, and auditable.

> Current repository status: this repository contains product research and a
> plugin specification. It does not yet contain a packaged Obsidian plugin,
> build scripts, or installable release artifacts.

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
| [`SPEC.md`](SPEC.md) | Product specification for the Obsidian plugin, including scope, architecture, data model, validation plan, and phased delivery. |
| [`docs/research/dec-7-project-research.md`](docs/research/dec-7-project-research.md) | Market and product research covering Obsidian-native capabilities, related community plugins, annual-report patterns, and implementation recommendations. |

## Planned features

The features below describe the planned plugin behavior from the current spec,
not completed implementation in this repository.

| Area | Feature | Outcome |
| --- | --- | --- |
| Report generation | `Annual Review: Generate report` command | Creates `Annual Reviews/YYYY Annual Review.md` for the selected year and vault scope. |
| Local analysis | Vault scanner using Obsidian Markdown files and metadata cache | Reads notes, paths, timestamps, frontmatter, tags, links, headings, and tasks without requiring third-party plugins. |
| Metrics | Year totals, active days, streaks, word/character counts, monthly buckets, top folders, tags, links, and notes | Gives users a concrete view of writing volume, cadence, and knowledge structure. |
| CJK-aware counting | Store both word count and character count | Keeps Chinese, Japanese, Korean, English, and mixed-language vaults understandable. |
| Evidence links | Obsidian links for representative and ranked notes | Makes the generated review inspectable instead of opaque. |
| Dashboard | `Annual Review: Open dashboard` ItemView | Provides a lightweight preview/control surface for year, scope, privacy, index freshness, and regeneration. |
| Indexing | Rebuild command plus future incremental cache | Avoids repeated full scans for large vaults after the baseline is implemented. |
| Privacy controls | Include/exclude folders, report privacy mode, opt-in export/AI boundaries | Keeps sensitive vault data under user control. |
| Sharing | Future local PNG/SVG/HTML share-card export | Supports optional public highlights without default cloud upload. |

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
3. Use the "Planned features" and "Competitive and alternative tool comparison"
   sections in this README as the product overview.

### Start implementation work

This repository does not yet include a plugin scaffold. The expected
implementation path is:

1. Create an Obsidian plugin scaffold with TypeScript and esbuild.
2. Keep the generated Markdown report as the first product milestone.
3. Add fixture vaults before writing scanner and aggregation logic.
4. Implement the local statistics engine before dashboard or export features.
5. Validate against Chinese, English, mixed-language, tag, link, task, and
   frontmatter fixtures.

The recommended module layout and validation plan are defined in
[`SPEC.md`](SPEC.md).

### Target end-user flow after implementation

1. Install the plugin in an Obsidian vault.
2. Open plugin settings and confirm report folder, included folders, excluded
   folders, date patterns, and privacy defaults.
3. Run `Annual Review: Generate report` from the command palette.
4. Select year, vault scope, and privacy options.
5. Open `Annual Reviews/YYYY Annual Review.md`.
6. Inspect linked evidence notes, edit the generated narrative, and rerun the
   command when the vault changes.
7. Optionally open the dashboard to preview metrics or export a privacy-safe
   share card.

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
| Phase 0 | Spec and fixtures | Product spec, sample vault fixtures, metric methodology snapshots. |
| Phase 1 | Statistics engine | Scanner, tokenizer, metadata extraction, filters, aggregation, deterministic Markdown output. |
| Phase 2 | Obsidian commands and settings | Command palette entries, settings tab, vault report writer, cache through `loadData()` / `saveData()`. |
| Phase 3 | Dashboard | Obsidian `ItemView` with controls, metric summary, charts, representative notes, and regeneration actions. |
| Phase 4 | Export and adapters | Privacy-aware share cards, optional Canvas/Bases output, adapters for Markdown-backed third-party plugin data. |
| Phase 5 | Optional AI | Opt-in AI provider interface with redaction preview, source evidence, and local caching. |

## Validation expectations

The first implementation should prove the core flow with automated and manual
checks:

- tokenizer tests for Chinese, English, mixed-language, punctuation, and empty
  content;
- path filter and metadata extraction tests;
- monthly aggregation and top-N deterministic sorting tests;
- Markdown renderer snapshot tests;
- manual Obsidian desktop validation for generating, opening, rerunning, and
  reading the annual review note;
- confirmation that the core flow works without third-party Obsidian plugins and
  without network access.
