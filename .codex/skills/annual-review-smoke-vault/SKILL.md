---
name: annual-review-smoke-vault
description: Deploy and validate the Obsidian Annual Review plugin against the install-smoke-vault using Obsidian CLI. Use when optimizing generated annual reports, checking Markdown/Obsidian wikilink rendering, verifying Dashboard commands, reproducing report quality issues, or creating issue evidence from /Users/hong/code/obsidian-annual-workspaces/install-smoke-vault.
---

# Annual Review Smoke Vault

Use this skill to close the loop between code changes and the real Obsidian smoke vault. Prefer this over inspecting generated Markdown in isolation when report quality, Obsidian wikilinks, embedded SVGs, plugin commands, or Dashboard behavior matter.

## Fixed context

- Repo: `/Users/hong/code/Obsidian-Annual`
- Smoke vault path: `/Users/hong/code/obsidian-annual-workspaces/install-smoke-vault`
- Vault name for CLI: `install-smoke-vault`
- Obsidian CLI: `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`
- Plugin id: `annual-review`
- Current report: `Annual Reviews/2026 Annual Review.md`

## Workflow

1. Deploy the latest plugin build:

   ```bash
   cd /Users/hong/code/Obsidian-Annual
   npm run deploy:smoke
   ```

2. Reload the plugin and rebuild its index:

   ```bash
   OBSIDIAN_CLI=/Applications/Obsidian.app/Contents/MacOS/obsidian-cli
   "$OBSIDIAN_CLI" vault=install-smoke-vault plugin:enable id=annual-review filter=community
   "$OBSIDIAN_CLI" vault=install-smoke-vault plugin:reload id=annual-review
   "$OBSIDIAN_CLI" vault=install-smoke-vault command id=annual-review:rebuild-annual-review-index
   ```

3. Generate the report when possible:

   ```bash
   "$OBSIDIAN_CLI" vault=install-smoke-vault command id=annual-review:generate-annual-review
   ```

   Current caveat: this command opens the year modal, so it is not fully headless. If the task requires autonomous iteration, add or request a non-interactive dev command such as `annual-review:generate-annual-review-2026`, then use that in the loop.

4. Read and audit the generated report:

   ```bash
   cat "/Users/hong/code/obsidian-annual-workspaces/install-smoke-vault/Annual Reviews/2026 Annual Review.md"
   ```

5. Use concrete report evidence to drive code changes or issue text. Do not claim a visual/Markdown rendering fix from source inspection alone.

## One-command smoke check

Run the bundled helper for deployment, plugin reload, index rebuild, and report sanity checks:

```bash
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh
```

Use `--generate` only when interactive generation is acceptable:

```bash
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --generate
```

The helper reports:

- whether the report file exists
- quoted month names being used as topics
- remaining `更新笔记` column/text
- wikilink aliases inside Markdown table rows, which can break table columns
- SVG embeds without explicit width
- repeated `建立 MOC` count
- Obsidian unresolved/outgoing link diagnostics

## Quality gates for report optimization

Before saying the report-quality task is done, verify the generated report in the smoke vault and check these gates:

- SVG embeds are readable in Obsidian and use an explicit size where needed.
- Markdown tables are not broken by `[[path|alias]]` pipes; table rows have stable columns.
- The topic table no longer contains the low-value `更新笔记` column.
- Month folders such as `1月`, `2月`, `3月`, `4月`, or `2026-04` are not treated as content themes.
- Top 10 high-value notes have differentiated reasons/actions; `建立 MOC` is not mechanically repeated.
- Dashboard/Open Dashboard uses Obsidian-native spacing, color variables, and dark/light theme compatible layout.

## Useful CLI probes

```bash
OBSIDIAN_CLI=/Applications/Obsidian.app/Contents/MacOS/obsidian-cli
"$OBSIDIAN_CLI" vaults
"$OBSIDIAN_CLI" vault=install-smoke-vault plugins:enabled filter=community format=json
"$OBSIDIAN_CLI" vault=install-smoke-vault commands filter=annual
"$OBSIDIAN_CLI" vault=install-smoke-vault read path="Annual Reviews/2026 Annual Review.md"
"$OBSIDIAN_CLI" vault=install-smoke-vault unresolved counts format=json
"$OBSIDIAN_CLI" vault=install-smoke-vault links path="Annual Reviews/2026 Annual Review.md"
```

## Preferred follow-up improvement

If autonomous report generation is blocked by the year modal, implement a dev/smoke-only non-interactive command or script first. The desired loop is:

```bash
npm run deploy:smoke
"$OBSIDIAN_CLI" vault=install-smoke-vault plugin:reload id=annual-review
"$OBSIDIAN_CLI" vault=install-smoke-vault command id=annual-review:rebuild-annual-review-index
"$OBSIDIAN_CLI" vault=install-smoke-vault command id=annual-review:generate-annual-review-2026
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --no-deploy
```
## Troubleshooting agent handoffs

### Ticket references this skill but the checkout has no `.codex/`

This means the agent is probably working from a GitHub/remote checkout that does not include local uncommitted skill files yet. Check:

```bash
git status --short
find .codex/skills/annual-review-smoke-vault -maxdepth 3 -type f -print
```

If `.codex/` is missing, do not treat the ticket as wrong. Fall back to the commands documented in the issue, or ask the maintainer to commit/push:

- `.codex/skills/annual-review-smoke-vault/SKILL.md`
- `.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh`
- `.codex/skills/annual-review-smoke-vault/agents/openai.yaml`
- any required deploy script such as `scripts/deploy-plugin.mjs`
- package scripts such as `deploy:smoke`

### `gh auth status` reports an invalid keyring token

This is a local GitHub CLI credential/keyring problem, not an Obsidian Annual Review repo problem. It can happen when a spawned agent, tmux pane, or separate machine has stale `gh` credentials while the GitHub connector still works.

Diagnose:

```bash
gh auth status
```

If invalid, prefer read-only `gh` only when it still works, and use the GitHub connector for PR creation/labeling. To repair the local CLI credentials in an interactive shell:

```bash
gh auth refresh -h github.com -s repo -s read:org -s workflow
# If refresh fails:
gh auth logout -h github.com
gh auth login -h github.com -p ssh -s repo -s read:org -s workflow
```

After repair, verify:

```bash
gh auth status
gh repo view --json nameWithOwner,url
```

