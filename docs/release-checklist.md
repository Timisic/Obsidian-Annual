# 发布检查清单

本清单用于发布 Obsidian Annual Review 的手动安装包和社区插件提交材料。

发布验证围绕同一个 MVP 闭环：本地扫描、候选、Review Board 审核/决策、受保护 Markdown 年报。不要把 AI 草稿、Dashboard 指标、截图素材或私有 smoke-vault 部署写成当前发布主能力。

## 发布前

- [ ] `manifest.json` 的 `version` 与 `package.json` 一致。
- [ ] `manifest.json` 包含非空 `author`、清晰 `description`、`minAppVersion` 和 `isDesktopOnly: true`。
- [ ] `versions.json` 记录当前版本对应的最低 Obsidian 版本。
- [ ] `README.md` 说明隐私边界、默认不联网、可选 AI 行为和手动安装路径。
- [ ] README、SPEC、Feature Inventory 和本清单对命令表述一致：`Annual Review: Rebuild index`、`Annual Review: Open Review Board`、`Annual Review: Generate report`。
- [ ] 没有本机绝对路径、私人 vault 路径或空 author 信息留在仓库中。

## 自动验证

```bash
npm run test
npm run typecheck
npm run build
npm run lint
npm run release:check
```

`npm run release:check` 会在 `dist/annual-review/` 检查必需发布资产：

- `manifest.json`
- `main.js`
- `styles.css`

## Agent smoke-vault 验证

开发/agent 验证真实 Obsidian 行为时，默认使用仓库内的
`tests/fixtures/obsidian-smoke-vault`。这个 repo-local validation vault 同时承载
单元测试样本和本仓库内的 Obsidian 部署验证，避免在 `tests/fixtures` 下维护两个
可混淆的 vault。
如需使用外部测试 vault，显式设置 `SMOKE_VAULT_PATH`。

```bash
npm run dev:deploy-smoke
.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --generate
```

`dev:deploy-smoke` 会将当前构建部署到 repo-local validation vault，并仅在该 vault
的插件 `data.json` 中启用隐藏 smoke 命令；用 `SMOKE_VAULT_PATH` 可改为显式
提供的本机 smoke vault 路径。普通用户安装验证仍走下面的手动路径。

## DEC-55 MVP readiness record (2026-05-08)

Verdict: `Not ready`.

Reason: the plugin passes automated release checks and can generate a protected
Markdown annual report in the real smoke vault, but the Review Board does not yet
close the MVP review/decision loop. `Annual Review: Open Review Board` currently
shows a year preview/dashboard with scan metrics and report actions; smoke-vault
DOM evidence did not expose candidate queue decision actions such as accept,
ignore, rename, merge, or open source note. Follow-up: DEC-57.

Evidence summary:

| Gate                                      | Result | Evidence                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                            | Pass   | 2 files, 53 tests passed.                                                                                                                                                                                                                                                     |
| `npm run typecheck`                       | Pass   | `tsc -noEmit -skipLibCheck` completed.                                                                                                                                                                                                                                        |
| `npm run build`                           | Pass   | production esbuild completed.                                                                                                                                                                                                                                                 |
| `npm run lint`                            | Pass   | `eslint .` completed.                                                                                                                                                                                                                                                         |
| `npm run release:check`                   | Pass   | `dist/annual-review` contains `manifest.json`, `main.js`, `styles.css`.                                                                                                                                                                                                       |
| Smoke deploy/reload/rebuild/generate/read | Pass   | `.codex/skills/annual-review-smoke-vault/scripts/smoke-vault-check.sh --generate` deployed to `install-smoke-vault`, reloaded the plugin, rebuilt index, executed `annual-review:generate-annual-review-2026`, and read `Annual Reviews/2026 Annual Review.md` (3,277 bytes). |
| Report sanity checks                      | Pass   | No quoted month topics, no deprecated `更新笔记`, no table-row wikilink alias pipes, no SVG embeds without explicit width, no `AI summary unavailable`, no `codex: command not found`; `建立 MOC` count was 0.                                                                |
| Release artifact/version consistency      | Pass   | `manifest.json`, `package.json`, `versions.json`, and `dist/annual-review/manifest.json` all agree on version `0.1.0`; minimum Obsidian version is `1.7.2`.                                                                                                                   |

MVP loop assessment:

| MVP step                         | Result | Evidence / gap                                                                                                                                                    |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select year/range                | Pass   | Year modal/dashboard year control exist; smoke command generated the 2026 report using configured scope `2026月复盘`.                                             |
| Scan vault                       | Pass   | Smoke rebuild reported 40 indexed files in the Review Board/dashboard DOM.                                                                                        |
| Generate Theme Hypotheses        | Pass   | Generated report includes evidence-backed Theme Hypotheses with auditable source-note links.                                                                      |
| Review Board review/decision     | Fail   | Review Board surface is still a preview/dashboard, not a Theme Hypothesis decision board. Gap filed as DEC-57.                                                    |
| Protected Markdown annual report | Pass   | Generated report is wrapped in `<!-- annual-review:start -->` / `<!-- annual-review:end -->` and writes assets under `Annual Reviews/2026 Annual Review Assets/`. |

## 手动安装验证

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

然后在 Obsidian 中验证：

1. 打开 `Settings -> Community plugins` 并启用 **Annual Review**。
2. 运行 `Annual Review: Rebuild index`。
3. 运行 `Annual Review: Generate report`。
4. 确认报告写入 `Annual Reviews/`，证据链接能回到源笔记。
5. 默认设置下不发生外部网络请求、AI 调用或遥测。

## 验证路径边界

- repo-local validation vault：`tests/fixtures/obsidian-smoke-vault` 同时用于自动化测试样本和本仓库内的 Obsidian 部署/打开 Review Board 验证。
- 普通用户 vault：手动安装验证必须使用显式传入的临时或用户提供 vault 路径，不猜测私人 vault。
- 自定义 agent smoke vault：真实 Obsidian smoke-vault 验证可由 agent/release reviewer 通过 `SMOKE_VAULT_PATH` 显式传入；它提供端到端证据，但不是普通用户路径。

## GitHub release

- [ ] tag 名称与 `manifest.json` 的 `version` 完全一致，不加 `v` 前缀。
- [ ] release 附件包含 `manifest.json`、`main.js`、`styles.css`。
- [ ] release notes 使用 [`docs/github-release-draft.md`](github-release-draft.md) 作为初稿。
- [ ] GitHub Actions 的 CI workflow 通过，并上传 `annual-review-release-assets` artifact。

## 社区插件提交

- [ ] `obsidian-releases` 条目中的 `id` 与 `manifest.json` 一致。
- [ ] 条目包含插件名称、作者、简短描述和 GitHub 仓库。
- [ ] 首个 release 已发布，且 tag 与 manifest version 一致。

参考：

- Obsidian manifest schema: <https://docs.obsidian.md/Reference/Manifest>
- Obsidian sample plugin release steps: <https://github.com/obsidianmd/obsidian-sample-plugin>
- Obsidian community plugin release loading: <https://github.com/obsidianmd/obsidian-releases>
- Obsidian October plugin checklist: <https://docs.obsidian.md/oo/plugin>
