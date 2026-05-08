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

- repo-local fixture vault：`tests/fixtures/vault` 只用于自动化测试样本和确定性 fixture，不证明真实 Obsidian 安装可用。
- 普通用户 vault：手动安装验证必须使用显式传入的临时或用户提供 vault 路径，不猜测私人 vault。
- agent smoke vault：真实 Obsidian smoke-vault 验证由 agent/release reviewer 的 Obsidian CLI 工作流执行；它提供端到端证据，但不是公开 package script 或普通用户路径。

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
