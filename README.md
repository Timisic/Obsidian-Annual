# Obsidian Annual Review

[English](README.en.md) | [文档索引](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Annual Review 是一个本地优先的年度复盘工作流插件，
帮助你从一年的笔记中筛选重要主题、复核关键笔记、形成行动决定，
并输出可追溯、可编辑、可重复生成的 Markdown 年报。

它解决的不是“生成一份漂亮总结”，而是年底最难的四件事：不知道哪些内容值得回看、不知道哪些主题贯穿全年、不知道哪些笔记该继续推进或归档，以及不信任没有证据的自动总结。

## 适合谁

- 用 Obsidian 写日记、项目记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 想在 10-15 分钟内完成第一轮年度复盘，而不是先整理完整个 vault 的用户。
- 希望推荐项带有理由和源笔记链接，最终判断仍由自己确认的人。
- 需要把年报保留为本地 Markdown，并配合 Obsidian Sync、Git 或其他版本管理工具审阅差异的人。

## 核心流程

```text
扫描范围 -> 生成候选 -> Review Board 审核 -> 决策 -> Markdown 年报
```

1. **扫描**：选择年份、包含/排除目录和隐私模式，插件只读取当前 vault 内允许范围的 Markdown、属性、标签、链接、任务和时间线信号。
2. **候选**：插件提出年度主题、代表笔记、项目/任务线索、异常活动和沉睡资产，并给出“为什么被选中”的理由。
3. **审核**：你在 Review Board 中逐项确认、重命名、合并、忽略或归档候选项。
4. **决策**：你为确认过的主题和笔记写下继续推进、合并、归档、放弃或转成项目的行动。
5. **年报**：插件把已确认内容、证据链接、行动决定和方法说明写入 `Annual Reviews/YYYY Annual Review.md`。

> 截图占位：Review Board 候选列表、证据链接、行动决定和生成后的 Markdown 年报。

## 隐私边界

- 默认不访问网络，不调用外部 AI，不发送遥测。
- 默认只读取当前 Obsidian vault 内的 Markdown 和 Obsidian metadata cache。
- 报告目录、模板、归档、附件和用户排除范围不会进入扫描输入。
- AI 只作为可选的报告草稿增强步骤；核心候选、审核、决策和证据链不依赖 AI。
- 如果用户显式启用外部 AI，插件必须在发送前说明 provider、上下文范围、摘录数量和可排除内容。

## 本插件如何保护用户编辑

- 年报是普通 Markdown 文件，保存在 vault 内，可以用 Obsidian、Git 或同步工具查看历史差异。
- 生成内容应写入插件管理区块，用户手写区块保留给个人叙事和修改。
- 重新生成只替换可再生区块，不覆盖用户手写内容。
- 重新生成前应保留上一版备份或形成可 diff 的变更，方便回滚。
- 每个候选项和行动建议都保留源笔记、标签、链接、任务或时间线证据，用户可以复核后再采纳。

## 安装方式

### 从 Obsidian 社区插件安装

插件进入社区插件列表后：

1. 打开 Obsidian `Settings -> Community plugins`。
2. 搜索 **Annual Review**。
3. 点击 **Install**，再点击 **Enable**。

### 手动安装开发版

```bash
npm install
npm run build
```

然后复制构建产物到 vault 插件目录：

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js styles.css versions.json "$PLUGIN_DIR/"
```

打开 Obsidian 后，在 `Settings -> Community plugins` 中启用 **Annual Review**。

## 当前可用命令

| 命令 | 用途 |
| --- | --- |
| `Annual Review: Rebuild index` | 重新扫描当前 vault 中允许范围的 Markdown 笔记。 |
| `Annual Review: Generate report` | 选择年份和生成选项，写入年度 Markdown 报告。 |
| `Annual Review: Open dashboard` | 打开本地预览和控制界面，用于查看候选信号与触发生成。 |

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run test` | 运行 Vitest，覆盖 tokenizer、路径过滤、元数据提取、年度聚合和 Markdown 渲染。 |
| `npm run typecheck` | 运行 TypeScript 类型检查，不生成构建文件。 |
| `npm run build` | 生成可安装到 Obsidian 的插件 bundle。 |
| `npm run dev` | 启动 esbuild watch，适合本地插件开发。 |
| `npm run deploy:plugin` | 构建插件并可部署到任意 vault 的 `.obsidian`。 |
| `npm run deploy:smoke` | 构建并部署到仓库配置的 smoke vault。 |

## 验证建议

自动验证：

```bash
npm run test
npm run typecheck
npm run build
```

手动验证：

1. 在测试 vault 中启用插件。
2. 运行 `Annual Review: Rebuild index`。
3. 运行 `Annual Review: Generate report`。
4. 确认报告生成在 `Annual Reviews/` 下，并且候选项能回链到源笔记。
5. 修改年报中的用户手写区块后重新生成，确认手写内容未被覆盖。
6. 在默认设置下确认没有外部网络请求或 AI 调用。

## 更多文档

- [Product Definition](docs/product-definition.md)
- [SPEC](docs/product-specification.md)
- [Roadmap](docs/roadmap.md)
- [文档索引](docs/README.md)
- [AI 报告生成设计](docs/ai-report-design.md)
