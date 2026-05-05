# Feature Inventory

This inventory keeps the product surface focused on the trusted annual-review workflow. Core and Support items may appear in the main user path. Backlog and Remove items must not be presented as current primary capabilities.

## Core

| Feature | Status | Main-path rule |
| --- | --- | --- |
| Year and scan-range selection | Core | Always shown before generation. |
| Vault scan | Core | Reads allowed local Markdown and Obsidian metadata only. |
| Candidate themes | Core | Presented as suggestions with rationale and evidence links. |
| Candidate review notes | Core | Presented as "Suggested review candidates", never as absolute value judgments. |
| Review Board | Core | Used to accept, rename topics, merge topics, ignore, archive, highlight, or move candidates into actions. |
| Evidence links | Core | Every recommendation needs source notes, tags, links, tasks, excerpts, or timeline evidence. |
| Recommendation rationale | Core | Explains why the item is suggested and what signal produced it. |
| User accepted state | Core | Users decide what is accepted, renamed, merged, ignored, archived, or moved into actions. |
| Protected Markdown annual report | Core | Regeneration must preserve user-written sections and remain diffable. |
| Local-first default | Core | No network, AI, or telemetry by default. |

## Support

| Feature | Status | Constraint |
| --- | --- | --- |
| Rebuild index command | Support | Exposed because it helps users refresh the local scan deliberately. |
| Review Board preview/control view | Support | Exposed as the Review Board, not as a broad analytics dashboard. |
| Basic progress and scan feedback | Support | Limited to evidence-chain status and generation progress. |
| Optional AI enrichment | Support | Hidden behind explicit provider setup and context preview; cannot replace review or accepted decisions. |
| Build and deploy scripts | Support | Kept for maintainers, but smoke-vault deployment is not a public main-path command. |

## Backlog

| Feature | Status | Reason |
| --- | --- | --- |
| Share cards | Backlog | Outside the local evidence and acceptance loop. |
| Canvas export | Backlog | Adds layout and trust cost without improving the Markdown report. |
| Bases output | Backlog | Useful later, but the core path must not depend on Bases or third-party views. |
| HTML export | Backlog | Secondary publishing surface, not needed for trusted review. |
| Chart beautification | Backlog | Visual polish should wait until evidence and accepted-state handling are stable. |
| Broad dashboard metrics | Backlog | Metrics without review decisions can dilute the main workflow. |
| Agent installation as ordinary-user path | Backlog | Useful for development or automation, but not the primary install route. |
| Multi-provider AI expansion | Backlog | Provider breadth is not a core product promise. |

## Remove

| Feature | Status | Action |
| --- | --- | --- |
| Smoke report command in the command palette | Remove | Removed from command registration; keep smoke validation as an internal skill/workflow only. |
| Smoke-vault deploy script in public package scripts | Remove | Removed from `package.json` to avoid exposing local development paths as product surface. |
| Absolute note-value wording | Remove | Replace user-facing text with review candidates, recommendation rationale, and manual accept/reject language. |
| Unprotected overwrite-style regeneration promises | Remove | Main docs only describe protected regeneration with user-written sections preserved. |
