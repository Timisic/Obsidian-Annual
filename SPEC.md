# Obsidian Annual Review Plugin Spec

Status: Draft for DEC-10
Source research: `docs/research/dec-7-project-research.md`
Target implementation stack: TypeScript + Obsidian API

## 1. Intent

Build a local-first Obsidian plugin that turns a user's vault activity into an
editable annual review note. The plugin should help users understand their year
inside Obsidian through traceable metrics, representative notes, theme shifts,
and a lightweight preview/export workflow.

The first version should not be a standalone marketing-style wrapped page. The
durable artifact is Markdown inside the vault, because Obsidian users expect
content to be inspectable, editable, linkable, syncable, and versionable.

## 2. Deep Interview Summary

This spec was derived from a self-contained Deep Interview pass because DEC-10
is an unattended ticket. The interview used the DEC-7 research report and Linear
comments as evidence, then pressure-tested scope and assumptions before writing
the execution spec.

| Dimension | Resolution |
| --- | --- |
| Intent | Create a practical project spec for an Obsidian annual-report plugin. |
| Outcome | A reviewable `SPEC.md` that can drive future implementation tickets. |
| Scope | Spec only: product behavior, architecture, milestones, validation, risks. |
| Non-goals | No plugin scaffolding, no external repo inspection, no cloud/AI default path. |
| Decision boundary | Codex may choose spec structure and implementation recommendations from repo-local research. |
| Pressure pass | Challenged whether the MVP should start with a dashboard/share-card experience; resolved that Markdown report generation is the first non-negotiable product path, with dashboard/export layered after the statistics engine. |

Key constraint: DEC-10 comments reference
`/Users/hong/Downloads/obsidian-word-history-tool`, but the session is limited to
this repository copy. This spec therefore uses the repo-local DEC-7 research
summary of Novel Word Count-style behavior instead of reading that external path.

## 3. Product Principles

- Local first: all default analysis runs in the vault without network access.
- Evidence backed: every surprising summary should link to source notes or show
  the metric rule that produced it.
- Markdown first: the generated annual review note is the primary deliverable.
- Obsidian native: use command palette, settings, `ItemView`, vault files, and
  theme CSS variables instead of a separate web-app shell.
- Optional sharing: exported images or HTML are user-triggered and default to
  privacy-preserving data.
- Minimal dependency surface: TypeScript with the official Obsidian plugin
  template and esbuild; avoid heavy UI frameworks for the MVP.

## 4. Target Users

- Personal knowledge management users who write daily notes, project notes,
  reading notes, and evergreen notes in one vault.
- Writers and researchers who care about yearly writing volume, cadence, and
  topic evolution.
- Obsidian power users who already use Properties, Dataview-like fields, Bases,
  Tasks, Kanban, or Periodic Notes, but still want the annual report to work
  from plain Markdown facts.

## 5. MVP User Journey

1. User installs the plugin and opens settings.
2. User chooses default report folder, included/excluded folders, privacy
   defaults, and whether to include task/frontmatter/link metrics.
3. User runs `Annual Review: Generate report` from the command palette.
4. A modal asks for year, scope, and privacy options.
5. The plugin scans vault Markdown files and metadata cache.
6. The plugin writes `Annual Reviews/YYYY Annual Review.md`.
7. The user can open the generated report, inspect linked evidence notes, edit
   the narrative, and rerun generation when needed.
8. User can run `Annual Review: Open dashboard` to preview metrics and regenerate
   the report from an interactive view.

## 6. In Scope

### 6.1 Commands

- `Annual Review: Generate report`
  - Select year.
  - Select all vault or configured include folders.
  - Confirm privacy options before writing.
  - Generate or update a Markdown report.
- `Annual Review: Open dashboard`
  - Open an Obsidian `ItemView` for preview, filters, and regeneration.
- `Annual Review: Rebuild index`
  - Clear plugin cache and rescan vault files.

### 6.2 Settings

- Report folder, default `Annual Reviews/`.
- Include folders and exclude folders.
- Exclude patterns, defaulting to `.obsidian/`, attachments, templates, archive
  folders when configured by the user, and generated annual reports.
- Daily note path/date patterns.
- Whether to include tasks, links, frontmatter, and headings in metrics.
- Privacy defaults for generated report and share exports.
- Optional advanced tokenizer settings for CJK and mixed-language vaults.

### 6.3 Data Sources

The MVP reads repository facts from Obsidian APIs and Markdown content:

- `app.vault.getMarkdownFiles()`
- `vault.cachedRead(file)`
- `metadataCache.getFileCache(file)`
- frontmatter / Properties
- tags
- links and embeds
- headings
- Markdown tasks
- file path, folder, ctime, and mtime

Third-party plugins are not required for the core path. Dataview, Bases, Tasks,
Kanban, Projects, and Periodic Notes can be supported later through adapters that
read Markdown-backed facts or optional plugin APIs.

### 6.4 Metrics

MVP metrics:

- Total notes created in the selected year.
- Total notes modified in the selected year.
- Active days.
- Longest writing streak.
- Total words and characters.
- Monthly writing/activity buckets.
- Top folders.
- Top tags.
- Top linked notes.
- Most edited notes.
- Longest notes by word/character count.
- Representative notes for each month.
- Tasks created/completed when task parsing is enabled.

Counting requirements:

- Store both word count and character count.
- Use CJK-aware counting. Chinese/Japanese/Korean text should not collapse into
  one English-style token.
- Preserve a clear distinction between `created`, `modified`, and
  `content-in-year` metrics.
- Keep stable tie-breaking for top-N lists, for example count descending then
  path ascending.

### 6.5 Generated Markdown Report

Default path:

```text
Annual Reviews/YYYY Annual Review.md
```

Required sections:

- Title and generated timestamp.
- Data scope and privacy mode.
- Executive summary.
- Year totals table.
- Monthly timeline.
- Top tags, folders, and links.
- Representative notes.
- Writing/activity rhythm.
- Tasks and project notes when enabled.
- Data methodology.
- Suggested next-year actions.

Generated report content should include Obsidian links to source notes whenever a
metric names a note. The user must be able to edit the generated Markdown without
breaking plugin state.

### 6.6 Dashboard View

The MVP dashboard is functional, restrained, and Obsidian-native:

- Year selector.
- Include/exclude summary.
- Privacy mode indicator.
- Index freshness and rebuild action.
- Metric cards for totals.
- Monthly trend chart using SVG or Canvas.
- Lists for top tags, folders, links, and notes.
- Buttons to generate, regenerate, and open the Markdown report.

The dashboard is a preview/control surface, not the primary content artifact.

## 7. Out of Scope for MVP

- Mandatory cloud sync, cloud analysis, or hosted report pages.
- AI-generated summaries by default.
- Reading private data outside the active vault.
- Full Canvas generation.
- Full share-card editor.
- Mobile-first dashboard optimization.
- Strong dependency on Dataview, Bases, Tasks, Kanban, or Projects plugin APIs.
- Marketing-style animated wrapped flow as the first shipped experience.

## 8. Architecture

Use the official Obsidian sample plugin structure with TypeScript and esbuild.

Recommended module layout:

```text
src/
  main.ts
  settings.ts
  commands/
    generateReportCommand.ts
    openDashboardCommand.ts
    rebuildIndexCommand.ts
  index/
    vaultScanner.ts
    indexStore.ts
    metadataExtractor.ts
    fileEvents.ts
  metrics/
    tokenizer.ts
    yearAggregator.ts
    taskMetrics.ts
    linkMetrics.ts
    themeMetrics.ts
  report/
    reportModel.ts
    markdownRenderer.ts
    reportWriter.ts
  view/
    annualReviewView.ts
    charts.ts
  adapters/
    dailyNotes.ts
    dataviewFields.ts
    basesProperties.ts
  validation/
    fixtures.md
```

Data flow:

```text
Vault Markdown files
  -> scanner + metadata extractor
  -> NoteStats[]
  -> YearAggregate
  -> ReportSection[]
  -> Markdown report + dashboard preview
```

The index layer should be incremental after MVP baseline:

- Cache file stats keyed by path, mtime, size, and plugin schema version.
- Recompute changed files on vault create/modify/delete/rename events.
- Avoid blocking Obsidian startup with full scans.
- Show index freshness in the dashboard.

## 9. Core Data Model

```ts
export interface NoteStats {
  path: string;
  ctime: number;
  mtime: number;
  folder: string;
  month: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
  headings: string[];
  tasks: TaskStats;
  wordCount: number;
  charCount: number;
}

export interface YearAggregate {
  year: number;
  generatedAt: string;
  scope: ReportScope;
  activeDays: number;
  createdCount: number;
  modifiedCount: number;
  totalWords: number;
  totalCharacters: number;
  monthBuckets: MonthBucket[];
  topTags: RankedMetric[];
  topFolders: RankedMetric[];
  topLinks: RankedMetric[];
  topNotes: RankedNote[];
}

export interface ReportSection {
  id: string;
  title: string;
  markdown: string;
  evidencePaths: string[];
  privacyLevel: "safe" | "sensitive";
}
```

## 10. Privacy and AI Boundary

Default behavior:

- No network calls.
- No external AI calls.
- No telemetry.
- No automatic upload or publishing.
- Generated reports remain in the vault.

Optional future AI provider:

- Must be opt-in.
- Must show exact data being sent before submission.
- Must support redaction/exclusion.
- Must preserve source evidence links.
- Must cache generated summaries locally only after user confirmation.

## 11. Validation Plan

Create fixture vaults before implementation:

- Chinese daily notes with CJK text.
- English notes.
- Mixed Chinese/English notes.
- frontmatter/Properties.
- tags.
- wiki links and embeds.
- Markdown tasks.
- folders that should be included and excluded.
- generated report folder to verify self-exclusion.

Automated tests:

- tokenizer unit tests for Chinese, English, mixed-language, punctuation, and
  empty content.
- path filter unit tests.
- metadata extraction unit tests.
- monthly aggregation tests.
- top-N deterministic sorting tests.
- Markdown renderer snapshot tests.

Manual validation:

- Load plugin in an Obsidian desktop test vault.
- Run `Annual Review: Generate report`.
- Confirm `Annual Reviews/YYYY Annual Review.md` is created.
- Confirm report links open source notes.
- Confirm rerun updates the report without duplicating sections.
- Confirm the same generation flow works in a clean vault with no Dataview,
  Bases, Tasks, Kanban, Projects, or Novel Word Count plugins installed.
- Confirm the generated Markdown report remains readable on mobile or a
  read-only Obsidian client even when the dashboard is unavailable.
- Confirm no network access is needed for MVP generation.

## 12. Acceptance Criteria for First Implementation Ticket

- The plugin can scan a small test vault with Chinese notes, English notes,
  tags, links, tasks, and frontmatter.
- The plugin can generate a Markdown annual review for a selected year.
- The report includes year totals, active days, monthly trend, top tags, top
  links, top folders, representative notes, and methodology.
- The command palette exposes generate and rebuild commands.
- The output stays inside the vault and works offline.
- Tests cover tokenizer, filters, aggregation, and Markdown rendering.
- The core flow works without third-party Obsidian plugins installed.
- The generated Markdown report is readable on mobile or read-only Obsidian
  clients.

## 13. Phased Delivery

### Phase 0: Spec and Fixtures

- Commit this spec.
- Add fixture vaults.
- Define metric methodology snapshots.

### Phase 1: Statistics Engine

- Scaffold Obsidian plugin from official TypeScript template.
- Implement scanner, tokenizer, metadata extraction, filters, and aggregation.
- Generate a deterministic Markdown report from fixtures.

### Phase 2: Obsidian Commands and Settings

- Add command palette entries.
- Add settings tab.
- Write report into the selected vault folder.
- Add index cache through `loadData()` / `saveData()`.
- Keep this phase Markdown-first; dashboard and share export remain outside the
  first implementation ticket unless a later ticket explicitly changes scope.

### Phase 3: Dashboard

- Add `ItemView`.
- Add year/scope controls.
- Show index status, metric summary, trend chart, and representative notes.
- Add regenerate/open actions.

### Phase 4: Export and Adapters

- Add privacy-aware share-card export.
- Add optional Canvas/Bases output.
- Add adapters for Dataview-like fields, Daily Notes, Tasks, Kanban, and
  Projects where the data is Markdown-backed.

### Phase 5: Optional AI

- Add opt-in AI provider interface.
- Add redaction preview.
- Add local cache for accepted AI summaries.

## 14. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Large vault scans are slow | Incremental cache, event-driven updates, rebuild command, startup deferral. |
| Word count is inaccurate for CJK | Store both words and characters, add CJK-aware tokenizer fixtures. |
| Users distrust generated labels | Show methodology and evidence notes; avoid opaque personality labels in MVP. |
| Privacy concerns | Offline default, explicit export/AI confirmation, include/exclude controls. |
| Third-party plugin data is unstable | Read Markdown facts first; keep adapters optional and isolated. |
| Generated reports become stale | Show generated timestamp and index freshness; rerun command updates report. |

## 15. Open Decisions

- Exact default exclude folder list beyond `.obsidian/`, attachments, templates,
  and generated report folder.
- Whether the first implementation should use Vitest or another test runner once
  the plugin scaffold exists.
- Whether share-card export should be PNG first or HTML/SVG first.

## 16. Non-Negotiable Boundaries

- Do not make external AI or cloud services part of the MVP path.
- Do not require users to install Dataview or Novel Word Count.
- Do not treat generated narrative as authoritative without source evidence.
- Do not block the Markdown report behind the dashboard.
- Do not read or upload files outside the active Obsidian vault during plugin
  operation.
