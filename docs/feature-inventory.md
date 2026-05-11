# Feature Inventory

This inventory keeps the product surface focused on the trusted annual-review workflow. Core and Support items may appear in the main user path. Backlog and Remove items must not be presented as current primary capabilities.

Canonical MVP flow: local scan -> Evidence Notes -> Evidence Cluster -> Theme Hypothesis -> Theme Decision -> protected Markdown review report. README, SPEC, release, and agent docs should use this flow and should not promote dashboard analytics, task management, required next actions, screenshots, or private validation vault deployment as the current product promise.

## Core

| Feature                          | Status | Main-path rule                                                                                 |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Year and scan-range selection    | Core   | Always shown before generation.                                                                |
| Vault scan                       | Core   | Reads allowed local Markdown and Obsidian metadata only.                                       |
| Theme Hypothesis cards           | Core   | The only Review Board card type users need to understand.                                      |
| Evidence Notes                   | Core   | Source notes that support a theme hypothesis.                                                  |
| Evidence Clusters                | Core   | Groups of related evidence notes; tags can contribute weak signals but are not the theme path. |
| Review Board                     | Core   | Used to accept, rename, merge, ignore, or open source notes for Theme Hypotheses.              |
| Evidence links                   | Core   | Every hypothesis needs source notes, links, excerpts, timeline, folder, tag, or task evidence. |
| Recommendation rationale         | Core   | Explains why the item is suggested and what signal produced it.                                |
| Theme Decision state             | Core   | Users decide what is accepted, renamed, merged, or ignored.                                    |
| Protected Markdown annual report | Core   | Regeneration must preserve user-written sections and remain diffable.                          |
| Local-first default              | Core   | No network, AI, or telemetry by default.                                                       |

## Support

| Feature                                | Status  | Constraint                                                                                                                                                                                                |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuild index command                  | Support | Exposed because it helps users refresh the local scan deliberately.                                                                                                                                       |
| Review Board preview/control view      | Support | Exposed as the Review Board, not as a broad analytics dashboard.                                                                                                                                          |
| Basic progress and scan feedback       | Support | Limited to evidence-chain status and generation progress.                                                                                                                                                 |
| Optional AI enrichment                 | Support | Hidden behind explicit provider setup and context preview; can assist report drafting but cannot replace review or accepted decisions.                                                                    |
| Build, release, and dev deploy scripts | Support | Kept for maintainers. `release:*` builds copyable assets; explicit vault deployment is named `dev:deploy-plugin`; smoke-vault deployment is named `dev:deploy-smoke` and limited to dev/agent validation. |

## Validation Path Boundaries

| Path                        | Purpose                                                                                  | Main-path rule                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Normal user vault           | User-owned Obsidian vault for community or manual install                                | Never guessed by scripts or docs; users or agents must supply the path.                |
| Repo-local validation vault | `tests/fixtures/obsidian-smoke-vault` for deterministic tests and deploy/open validation | Repo-contained validation target; plugin build artifacts are generated, not committed. |
| Custom smoke vault          | Explicit `SMOKE_VAULT_PATH` target for release/agent evidence                            | Optional internal validation path; keep separate from ordinary user instructions.      |

## Backlog

| Feature                                  | Status  | Reason                                                                           |
| ---------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| Share cards                              | Backlog | Outside the local evidence and acceptance loop.                                  |
| Canvas export                            | Backlog | Adds layout and trust cost without improving the Markdown report.                |
| Bases output                             | Backlog | Useful later, but the core path must not depend on Bases or third-party views.   |
| HTML export                              | Backlog | Secondary publishing surface, not needed for trusted review.                     |
| Chart beautification                     | Backlog | Visual polish should wait until evidence and accepted-state handling are stable. |
| Broad dashboard metrics                  | Backlog | Metrics without review decisions can dilute the main workflow.                   |
| Agent installation as ordinary-user path | Backlog | Useful for development or automation, but not the primary install route.         |
| Multi-provider AI expansion              | Backlog | Provider breadth is not a core product promise.                                  |
| Project candidate cards                  | Backlog | Project context can support evidence, but it is not an MVP card type.            |
| Task candidate cards                     | Backlog | Task syntax can support evidence, but Review Board is not task management.       |
| Dormant-note candidate cards             | Backlog | Dormancy can rank evidence, but it is not an independent MVP candidate.          |
| Bridge-note candidate cards              | Backlog | Bridge behavior can explain clusters, but it is not an independent MVP card.     |
| Add to actions / action item system      | Backlog | Reports may include optional prompts, not required action sections.              |
| Archive decision system                  | Backlog | Ignore is the MVP close path.                                                    |
| Annual highlights                        | Backlog | Adds another report destination before the hypothesis loop is stable.            |

## Remove

| Feature                                                          | Status | Action                                                                                                                                                       |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Smoke report command in the command palette                      | Remove | Removed from command registration; keep smoke validation as an internal skill/workflow only.                                                                 |
| Private validation vault deploy script in public package scripts | Remove | Removed from public package-script names; smoke validation stays under the dev-only `dev:deploy-smoke` name and is documented as agent/developer validation. |
| Placeholder/backlog helper scripts in package scripts            | Remove | AI context placeholder and writing-growth helpers are kept as internal files/tests only, not ordinary package script capabilities.                           |
| Absolute note-value wording                                      | Remove | Replace user-facing text with review candidates, recommendation rationale, and manual accept/reject language.                                                |
| Unprotected overwrite-style regeneration promises                | Remove | Main docs only describe protected regeneration with user-written sections preserved.                                                                         |
| Tracked personal Daily smoke notes                               | Remove | `tests/fixtures/obsidian-smoke-vault/Daily/` is ignored and removed from git tracking; deterministic tests use `Review Fixtures/`.                           |
