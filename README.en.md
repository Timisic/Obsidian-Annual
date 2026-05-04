# Obsidian Annual Review

[中文](README.md) | [Docs index](docs/README.md) | [Product specification](docs/product-specification.md)

Obsidian Annual Review is a local-first Obsidian plugin that turns vault activity into an editable, evidence-backed yearly review note.

The plugin scans Markdown notes, properties, tags, links, headings, tasks, and daily-note patterns inside the active Obsidian vault. It then generates `Annual Reviews/YYYY Annual Review.md` around writing growth, topic evolution, high-value notes, and next-period actions. The output stays in your vault as Markdown, so it remains editable, linkable, syncable, versionable, and auditable.

## Who it is for

- Obsidian users who write daily notes, project logs, reading notes, research notes, or evergreen notes.
- Writers and researchers who want to review writing volume, active days, topic shifts, and representative work.
- Users who want annual-review material to stay local instead of being uploaded to a hosted recap page.
- Users who prefer an evidence-backed draft they can edit into their own yearly narrative.

## Features

| Feature | What it does |
| --- | --- |
| Annual report generation | Run `Annual Review: Generate report` to create a Markdown report for a selected year. |
| Dashboard | Run `Annual Review: Open dashboard` to preview metrics, top lists, and report actions. |
| Reindexing | Run `Annual Review: Rebuild index` after vault or setting changes. |
| Local analysis | Reads Markdown, frontmatter, tags, Obsidian-resolved links, headings, tasks, and file timestamps through Obsidian APIs. |
| Mixed-language counting | Keeps Latin word counts and CJK character counts useful for Chinese, English, and mixed vaults. |
| Evidence links | Uses Obsidian links for topic evidence and high-value note references. |
| Writing growth charts | Writes daily cumulative words, monthly growth, and heatmap SVG assets, then references them from the report with Obsidian image links. |
| Optional ChatGPT | Report generation can opt into ChatGPT; with an API key it uses the Responses API, otherwise it can use a configured local Codex CLI/auth path. |
| Privacy boundary | Default processing is local; AI requires explicit user selection. |

## ChatGPT Provider And Privacy

The default remains local-first: `AI provider` is `None`, and report generation does not access the network. To enable ChatGPT:

1. Open the Annual Review plugin settings.
2. Set `AI provider` to `ChatGPT`.
3. Optionally enter an `OpenAI API key` and adjust `ChatGPT model`.
4. If the key is empty, confirm `Local Codex command`. If macOS GUI-launched Obsidian cannot find `codex`, use the absolute path to the local `codex` executable on that machine.
5. Run `Annual Review: Generate report` and confirm the provider for that run in the generate modal.

The privacy boundary is explicit: ChatGPT mode sends the report context, link relationships, and selected note excerpts to the selected generation path. With an API key, that path is the OpenAI Responses API; without a key, it is the local Codex CLI/auth environment. The current implementation requires an opt-in provider, stores no hardcoded secret, and lets users configure the local Codex command.

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

For the smoke vault configured by this repository, run:

```bash
npm run deploy:smoke
```

For another vault, use the generic deploy script:

```bash
npm run deploy:plugin -- --target /path/to/YourVault/.obsidian
```

You can also copy build artifacts manually:

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js versions.json "$PLUGIN_DIR/"
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
5. Review the one-sentence judgment, writing growth charts, topic evolution, high-value notes, and next-period actions.
6. Edit the Markdown report in your own voice; rerun generation after the vault changes.
7. Run `Annual Review: Open dashboard` when you want a metric preview first.

## Use Cases

- **Personal yearly review**: turn daily notes, projects, ideas, and tasks into an editable annual summary.
- **Writing review**: inspect total new words, writing days, longest streak, daily cumulative growth, monthly growth, and heatmap patterns.
- **Research review**: identify top topics, topic evolution, emerging and declining themes, and next-period topic suggestions.
- **Project retrospective**: collect project-note, folder, and task activity into review material.
- **Vault maintenance**: surface high-value notes, output-ready notes, maintenance-needed notes, and isolated-potential notes.
- **Share preparation**: generate a complete private report locally, then manually select safe excerpts for public sharing.

## Repository Layout

```text
.
├── manifest.json              # Obsidian plugin manifest
├── package.json               # Development, test, build, and deploy scripts
├── src/                       # Plugin source
├── tests/                     # Vitest coverage and fixture vault content
├── scripts/                   # Build, deploy, and reporting helpers
├── docs/                      # Product, design, and research docs
│   ├── README.md              # Docs index
│   ├── product-specification.md
│   ├── ai-report-design.md
│   └── research/project-research.md
└── .codex/skills/             # Repo-local validation and development skills
```

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
| `npm run deploy:plugin` | Build the plugin, generate `dist/annual-review/`, and optionally deploy to any vault `.obsidian` folder. |
| `npm run deploy:smoke` | Build and deploy to the smoke vault configured by this repository. |
| `npm run writing-growth` | Run the standalone writing-growth report script. |
| `npm run ai:context-placeholder` | Print the placeholder contract for a future Obsidian skill/CLI AI context adapter. |

## Validation

Automated validation:

```bash
npm run test
npm run typecheck
npm run build
```

Smoke-vault validation:

```bash
npm run deploy:smoke
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --no-deploy
```

Manual validation:

1. Install the plugin into a test vault.
2. Rebuild the index, generate a report, and open the dashboard.
3. Confirm the report is created under `Annual Reviews/` and chart SVGs are created under `Annual Reviews/YYYY Annual Review Assets/`.
4. Confirm Obsidian links in the report open source notes.
5. Regenerate the report and confirm old content is not duplicated.
6. Repeat the core flow in a clean vault without third-party plugins.

## More Documentation

- [Chinese README](README.md)
- [Docs index](docs/README.md)
- [Product specification](docs/product-specification.md)
- [AI report design](docs/ai-report-design.md)
- [Research notes](docs/research/project-research.md)
