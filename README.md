# Obsidian Annual Review

[English](README.en.md) | [文档索引](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Annual Review 是一个本地优先的年度复盘工作流插件，
帮助你从一年的笔记中筛选候选主题、复核候选笔记、形成行动决定，
并输出可追溯、可编辑、可重复生成的 Markdown 年报。

它只承诺一个主流程：本地扫描 vault，给出带推荐理由和证据链接的候选项，由你在 Review Board 中接受后写入受保护的 Markdown 年报。

## 适合谁

- 用 Obsidian 写日记复盘、项目记录、读书笔记、研究笔记的个人用户。
- 想在 10-15 分钟内完成第一轮年度复盘，而不是先整理完整个 vault 的用户。
- 希望推荐项带有理由和源笔记链接，最终判断仍由自己确认的人。
- 需要把年报保留为本地 Markdown，并配合 Obsidian Sync、Git 或其他版本管理工具审阅差异的人。

## 核心流程

```text
扫描范围 -> 生成候选 -> Review Board 审核 -> 决策 -> Markdown 年报
```

1. **扫描**：选择年份、包含/排除目录和隐私模式，插件只读取当前 vault 内允许范围的 Markdown、属性、标签、链接、任务和时间线信号，并在 rebuild/run 时记录 vault snapshot。
2. **候选**：插件提出主题、笔记、项目、任务、沉睡笔记和桥接笔记候选，并给出可审计的“为什么被推荐”理由、统计字段和证据链接；异常活动只作为生成候选的信号。如果你显式启用 AI，它只能增强候选理由和补充可复核线索。
3. **审核**：你在 Review Board 中逐项接受、重命名、合并主题、忽略、归档，或把候选项加入行动。
4. **决策**：你为已接受的主题、笔记、项目、任务、沉睡笔记和桥接笔记写下年度精选或下一步行动。
5. **年报**：插件把已接受内容、证据链接、行动决定、图表资产和方法说明写入 `Annual Reviews/YYYY Annual Review.md`。

> 截图占位：Review Board 候选列表、证据链接、行动决定和生成后的 Markdown 年报。

## Review Board 审核闭环

`Annual Review: Open Review Board` 打开的是当前年份/范围的候选队列。队列会显示每个候选的类型、标题、当前状态、推荐理由、证据数量和审核进度；选择候选后，右侧展示源笔记、标签、任务或摘录证据，并可直接打开源笔记复核。

MVP 决策动作包括：

- `Accept`：接受候选，让它进入年报候选输入。
- `Ignore`：忽略候选，后续生成年报时排除它。
- `Rename topic`：用用户确认后的标题写入报告。
- `Merge topic`：把主题合并到目标主题，不再作为独立候选输出。
- `Add to annual highlights`：把候选标记为年度精选。
- `Add to actions`：把候选转成下一步行动。
- `Open source note`：打开证据来源，不改变审核状态。

审核状态保存在插件自己的数据中，不写入源笔记 frontmatter。重复 rebuild index 时，未决候选可以刷新理由和证据；已经接受、重命名、合并、忽略、精选或加入行动的用户决策会保留。生成年报时只读取已接受/精选/行动决策，并排除忽略或已合并为来源的候选。

## 隐私边界

- 默认不访问网络，不调用外部 AI，不发送遥测。
- 默认只读取当前 Obsidian vault 内的 Markdown 和 Obsidian metadata cache。
- 报告目录、模板、归档、附件和用户排除范围不会进入扫描输入。
- `annual-review-snapshots.json` 保存在插件自己的 `.obsidian/plugins/<plugin-id>/` 数据目录中，用于后续比较字数增量；它不写入源笔记 frontmatter。
- AI 只作为可选的候选增强和报告草稿辅助步骤；核心审核、取舍、行动决定和证据复核仍由用户完成。
- 如果用户显式启用外部 AI，插件在发送前说明 provider、上下文范围、摘录数量和可排除内容。

## 本插件如何保护用户编辑

- 年报是普通 Markdown 文件，保存在 vault 内，可以用 Obsidian、Git 或同步工具查看历史差异。
- 生成内容应写入插件管理区块，用户手写区块保留给个人叙事和修改。
- 重新生成只替换可再生区块，不覆盖用户手写内容。
- 重新生成前应保留上一版备份或形成可 diff 的变更，方便回滚。
- 每个候选项和行动建议都保留源笔记、标签、链接、任务或时间线证据，用户可以复核后再采纳。

## 数据口径

- 有可比较的历史 snapshot 时，年报会展示基于 snapshot 的真实 vault 字数增量。
- 没有历史 snapshot，或 include/exclude 范围变化导致 snapshot 不可比较时，增长统计会标记为“当前 vault 推断”，避免把 `ctime`/`mtime` 推断写成确定历史结论。
- Snapshot 捕获复用同一套 include/exclude folder、exclude pattern 和报告目录排除规则；被排除目录不会进入 snapshot 或增量统计。
- 详细格式和限制见 [Data Methodology](docs/data-methodology.md)。

## 安装方式

### 从 Obsidian 社区插件安装

插件进入社区插件列表后：

1. 打开 Obsidian `Settings -> Community plugins`。
2. 搜索 **Annual Review**。
3. 点击 **Install**，再点击 **Enable**。

### 手动安装发布包

```bash
npm install
npm run release:plugin
```

然后复制发布产物到 vault 插件目录：

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

打开 Obsidian 后，在 `Settings -> Community plugins` 中启用 **Annual Review**。

## 当前可用命令

| 命令                               | 用途                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `Annual Review: Rebuild index`     | 重新扫描当前 vault 中允许范围的 Markdown 笔记，并记录 snapshot。                 |
| `Annual Review: Generate report`   | 选择年份和生成选项，写入受保护的年度 Markdown 报告。                             |
| `Annual Review: Open Review Board` | 打开候选审核队列，用于复核证据并执行接受、忽略、重命名、合并、精选、行动等决策。 |

## 开发命令

| 命令                        | 用途                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `npm run test`              | 运行 Vitest，覆盖 tokenizer、路径过滤、元数据提取、年度聚合和 Markdown 渲染。          |
| `npm run typecheck`         | 运行 TypeScript 类型检查，不生成构建文件。                                             |
| `npm run build`             | 生成可安装到 Obsidian 的插件 bundle。                                                  |
| `npm run lint`              | 运行 ESLint。                                                                          |
| `npm run release:plugin`    | 生成 `dist/annual-review/` 发布资产。                                                  |
| `npm run dev`               | 启动 esbuild watch，适合本地插件开发。                                                 |
| `npm run dev:deploy-plugin` | 开发/agent smoke 验证用：显式传入测试 vault 后部署到 `.obsidian`，不作为普通安装路径。 |

## 验证建议

自动验证：

```bash
npm run test
npm run typecheck
npm run build
npm run lint
```

手动验证：

1. 在测试 vault 中启用插件。
2. 运行 `Annual Review: Rebuild index`。
3. 运行 `Annual Review: Open Review Board`，确认候选队列、推荐理由、证据来源和进度可见。
4. 对至少一个候选执行接受、忽略、重命名、合并、加入年度精选或加入行动，并确认打开源笔记可用。
5. 重新加载插件或重新运行 rebuild index，确认已做出的用户决策没有被覆盖。
6. 运行 `Annual Review: Generate report`。
7. 确认报告生成在 `Annual Reviews/` 下，接受/精选/行动决策进入报告，忽略候选被排除，并且候选项能回链到源笔记。
8. 修改年报中的用户手写区块后重新生成，确认手写内容未被覆盖。
9. 在默认设置下确认没有外部网络请求或 AI 调用。

## 更多文档

- [Product Definition](docs/product-definition.md)
- [SPEC](docs/product-specification.md)
- [Feature Inventory](docs/feature-inventory.md)
- [Roadmap](docs/roadmap.md)
- [文档索引](docs/README.md)
- [AI 报告生成设计](docs/ai-report-design.md)
- [Data Methodology](docs/data-methodology.md)
- [发布检查清单](docs/release-checklist.md)
