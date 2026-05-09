---
name: annual-review-smoke-vault
description: Operate the Obsidian Annual Review plugin in the repo-local smoke vault as an agent-controlled real-user loop. Use Obsidian CLI/dev tools to deploy, reload, open Review Board, inspect/click UI, make decisions, generate the 2026 report, read feedback, modify repo code or allowed generated output when requested, and iterate against tests and smoke evidence from tests/fixtures/obsidian-smoke-vault.
---

# Annual Review Smoke Vault

Use this skill when an agent needs to **operate Annual Review inside Obsidian** instead of only reading source code or Markdown. The agent should be able to deploy the plugin, open the repo-local vault, drive the Review Board like a user, generate a report, inspect feedback, make changes, and repeat.

The loop is:

1. deploy the current repo build to the smoke vault;
2. reload Annual Review in Obsidian and rebuild its index;
3. open the Review Board;
4. inspect DOM/text/screenshots/errors;
5. click Review Board controls through Obsidian CLI `eval`/DOM tools or Computer Use;
6. generate the 2026 annual report;
7. read the generated report and Obsidian diagnostics;
8. if the task asks for fixes, modify repo code or allowed generated output;
9. redeploy/reload/rerun until the observed result is acceptable.

This is an **operational execution skill**, not a product-review or issue-writing template. Create issues/workpads only when the user explicitly asks.

## Fixed context

- Repo: current checkout (`/Users/hong/code/Obsidian-Annual` in the maintainer environment)
- Smoke vault path: `tests/fixtures/obsidian-smoke-vault`
- Absolute smoke vault path: `/Users/hong/code/Obsidian-Annual/tests/fixtures/obsidian-smoke-vault`
- Obsidian CLI vault name: `obsidian-smoke-vault`
- Obsidian CLI binary: `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`
- Plugin id: `annual-review`
- Validation year: `2026`
- Report path: `Annual Reviews/2026 Annual Review.md`

The legacy external `install-smoke-vault` path is not the default. Use a different vault only when the user provides one or when `SMOKE_VAULT_PATH` / `VAULT_PATH` is intentionally overridden.

## Tool routing

Use the lightest tool that can actually observe or operate Obsidian:

1. **Shell + Obsidian CLI** for deploy, reload, commands, `read`, link diagnostics, `dev:errors`, `dev:console`, `dev:dom`, `dev:screenshot`, and `eval`.
2. **`$obsidian-cli` skill conventions** for exact CLI syntax and plugin-development probes.
3. **Computer Use** when DOM/eval is insufficient and the task requires visible UI interaction.
4. **Repo tests/build/lint** after code changes.

Do not fake user decisions by editing `data.json` when the task is to validate UX. Direct `data.json` edits are acceptable only for setup/configuration, migration tests, or recovery tests. For Review Board behavior, prefer visible UI clicks via CLI `eval` or Computer Use.

## Setup shell variables

```bash
cd /Users/hong/code/Obsidian-Annual
OBSIDIAN_CLI=/Applications/Obsidian.app/Contents/MacOS/obsidian-cli
VAULT_NAME=obsidian-smoke-vault
VAULT_PATH="$PWD/tests/fixtures/obsidian-smoke-vault"
REPORT_PATH="Annual Reviews/2026 Annual Review.md"
REPORT_FILE="$VAULT_PATH/$REPORT_PATH"
```

Confirm the vault is registered/openable and that the CLI name points at **this checkout's** vault path:

```bash
"$OBSIDIAN_CLI" vaults verbose
open -a Obsidian "$VAULT_PATH"
"$OBSIDIAN_CLI" eval code="app.vault.getName()+'\t'+app.vault.adapter.basePath"
```

If `obsidian-smoke-vault` is missing or points at another checkout, do not continue with that stale target. Open/register the repo-local vault in Obsidian, remove/rename the stale registration, or set `VAULT_NAME` to the registered name that actually points at `$VAULT_PATH`. Folder-name collisions are common because copied fixture vaults are all named `obsidian-smoke-vault`.

## Deploy, reload, and rebuild

```bash
npm run dev:deploy-smoke
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:enable id=annual-review filter=community
"$OBSIDIAN_CLI" vault="$VAULT_NAME" plugin:reload id=annual-review
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:errors
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:rebuild-annual-review-index
```

`npm run dev:deploy-smoke` defaults to `tests/fixtures/obsidian-smoke-vault` and enables smoke-only commands by writing `enableSmokeCommands: true` into the plugin `data.json`. Override only when intentionally targeting another validation vault:

```bash
SMOKE_VAULT_PATH=/path/to/validation-vault npm run dev:deploy-smoke
```

## Open and inspect the Review Board

```bash
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:open-annual-review-dashboard
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:dom selector=".annual-review-dashboard-view" text
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:screenshot path="/tmp/annual-review-board.png"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:errors
```

Useful probes:

```bash
# List visible Annual Review buttons.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).map((b,i)=>i+': '+b.textContent?.trim()).join('\\n')"

# Read current board text.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="document.querySelector('.annual-review-board')?.innerText"

# Read queue groups.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-board-queue-group')).map(g=>g.innerText).join('\\n---\\n')"

# Read selected candidate detail.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:dom selector=".annual-review-board-detail" text
```

## Click UI controls like a user

After every click, re-read DOM/text or plugin state to verify the result.

```bash
# Select a queue row by index.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="document.querySelectorAll('.annual-review-board-queue button')[1]?.click()"

# Accept selected candidate.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('接受')||b.textContent?.includes('Accept'))?.click()"

# Ignore selected candidate.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('忽略')||b.textContent?.includes('Ignore'))?.click()"

# Add selected candidate to annual highlights.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('加入年度精选')||b.textContent?.includes('Highlight'))?.click()"

# Add an action when the UI prompts for a label.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="const old=window.prompt; window.prompt=()=> 'Follow up from smoke validation'; Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('加入行动')||b.textContent?.includes('Add action'))?.click(); setTimeout(()=>window.prompt=old, 0);"

# Rename a topic when the UI prompts for a title.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="const old=window.prompt; window.prompt=()=> 'Renamed smoke topic'; Array.from(document.querySelectorAll('.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('重命名')||b.textContent?.includes('Rename'))?.click(); setTimeout(()=>window.prompt=old, 0);"

# Merge a topic if merge controls are present.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-board-merge button')).find(b=>b.textContent?.includes('合并')||b.textContent?.includes('Merge'))?.click()"

# Open selected candidate source/evidence.
"$OBSIDIAN_CLI" vault="$VAULT_NAME" eval code="Array.from(document.querySelectorAll('.annual-review-board-evidence button,.annual-review-dashboard-view button')).find(b=>b.textContent?.includes('打开源笔记')||b.textContent?.includes('Open source'))?.click()"
```

For a real-user smoke run, exercise a representative set of controls: inspect a candidate reason/evidence, accept, ignore, highlight/action, rename or merge when present, then reload/rebuild and confirm decisions are still reflected.

## Generate the annual report

Headless smoke path for 2026:

```bash
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:generate-annual-review-2026
```

User-facing path:

```bash
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:open-annual-review-dashboard
# Then click Generate report in the UI, or invoke:
"$OBSIDIAN_CLI" vault="$VAULT_NAME" command id=annual-review:generate-annual-review
```

For real AI output, configure a real provider first. `aiProvider: "none"`, mocks, or report text like `AI summary unavailable` do not count as a real GPT/OpenAI success. With `aiProvider: "chatgpt"`, a stored `chatGptApiKey` uses OpenAI Responses API; without a key, the plugin attempts `localCodexCommand` fallback.

## Read feedback

```bash
cat "$REPORT_FILE"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" read path="$REPORT_PATH"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" links path="$REPORT_PATH"
"$OBSIDIAN_CLI" vault="$VAULT_NAME" unresolved counts format=json
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:errors
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:console level=error
"$OBSIDIAN_CLI" vault="$VAULT_NAME" dev:screenshot path="/tmp/annual-review-report.png"
```

Inspect feedback from:

- Review Board DOM text;
- Review Board and report screenshots;
- generated Markdown report;
- Obsidian link diagnostics;
- plugin `data.json` only as persisted-state evidence;
- console/plugin errors.

## Modify and iterate

When feedback shows a bug or quality issue and the task authorizes changes:

1. edit the smallest relevant repo files;
2. run focused tests;
3. rebuild/deploy/reload;
4. repeat the exact Obsidian interaction that exposed the problem;
5. re-read DOM/report/screenshots/errors;
6. run broad verification before final output.

Standard verification:

```bash
npm run test
npm run typecheck
npm run build
npm run lint
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --no-deploy
```

Allowed vault writes during normal smoke operation:

- `.obsidian/plugins/annual-review/` plugin state/build artifacts;
- `Annual Reviews/` generated reports and chart assets;
- explicit temporary screenshots/logs outside the vault, e.g. `/tmp/annual-review-*.png`.

Do not edit source user notes in the smoke vault unless the user explicitly asks to change fixture content.

## One-command helper

```bash
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --generate
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --no-deploy
```

The helper optionally deploys, reloads the plugin, rebuilds the index, optionally generates the report, and prints report/link sanity checks. It is a quick gate, not a substitute for DOM/screenshot/UI interaction when UI behavior matters.

## Completion evidence

A completed run should report:

- deploy/reload/rebuild commands used;
- how Review Board was operated: CLI DOM clicks, Computer Use, or manual UI;
- generated report path;
- feedback observed from report/DOM/screenshot/errors;
- changes made, if any;
- verification command results;
- blockers such as missing Obsidian CLI, unregistered vault, plugin errors, or missing real AI credentials.
