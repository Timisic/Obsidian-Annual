# Obsidian Annual Review

[English](README.en.md) | [文档索引](docs/README.md) | [产品规格](docs/product-spec.md)

Obsidian Annual Review 是一个本地优先的 Obsidian 插件，用来把一年里的笔记活动整理成一份可编辑、可追溯的年度回顾 Markdown 笔记。

插件会扫描当前 vault 内的 Markdown 笔记、属性、标签、链接、标题、任务和日记路径，聚合出写作增长、主题演化、高价值笔记和下期行动，并生成 `Annual Reviews/YYYY Annual Review.md`。生成结果仍然留在 vault 里，可以继续编辑、链接、同步、版本管理和审阅。

> 当前仓库状态：已经包含 Obsidian 插件脚手架、TypeScript 源码、测试、产品规格和调研文档；尚未发布打包好的社区插件版本。

## 适合谁

- 用 Obsidian 写日记、项目记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 想复盘全年写作量、活跃天数、主题变化和代表性内容的写作者/研究者。
- 希望年度总结保留在本地 Markdown 中，而不是上传到云端报告页的 Obsidian 用户。
- 想先获得可信统计和证据链接，再手动润色年度总结的人。

## 核心功能

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 生成年度回顾 | ✅ 已实现 | 命令面板运行 `Annual Review: Generate report`，生成指定年份的 Markdown 报告。 |
| 仪表盘 | ✅ 已实现 | 命令面板运行 `Annual Review: Open dashboard`，预览年度指标、热门列表并触发生成。 |
| 重建索引 | ✅ 已实现 | 命令面板运行 `Annual Review: Rebuild index`，在 vault 或设置变化后重新扫描。 |
| 本地统计 | ✅ 已实现 | 读取 vault 内 Markdown、frontmatter、标签、Obsidian 解析后的链接、标题、任务和文件时间。 |
| 中英混合计数 | ✅ 已实现 | 同时保留英文词数和 CJK 字符数，适合中文、英文和混合 vault。 |
| 证据链接 | ✅ 已实现 | 报告里的主题和高价值笔记会链接回 Obsidian 源笔记。 |
| 写作增长图表 | ✅ 已实现 | 生成日累计字数、月度增长和每日字数热力图 SVG 资产，并在报告中用 Obsidian 图片链接引用。 |
| ChatGPT provider | 🧪 可选 | 生成报告时可选择 ChatGPT；有 OpenAI API key 时直连 Responses API，否则尝试本地 Codex CLI/auth。 |
| 隐私边界 | ⚠️ 部分实现 | 默认本地处理；AI 需要用户明确选择，脱敏预览仍属于后续阶段。 |

## 最近变更

- **Obsidian 解析链接统计**：在 Obsidian 内使用 `metadataCache.resolvedLinks` / `unresolvedLinks` 统计热门链接，别名、标题锚点、嵌入链接和 Markdown 链接会按实际目标合并。
- **精简最终报告结构**：最终 Markdown 只保留本期一句话判断、写作增长、主题演化、高价值笔记和下期行动五个部分。
- **AI 一句话判断**：生成时可选择 `ChatGPT`。有 OpenAI API key 时直连 Responses API；没有 key 时尝试调用本地 Codex CLI/auth，输出会进入「本期一句话判断」，不会追加额外 AI 段落。
- **独立 SVG 图表资产**：日累计字数图、月度字数增长曲线、每日字数热力图和主题演化图会写入 `Annual Reviews/YYYY Annual Review Assets/`，年度报告用 Obsidian 图片链接引用，并保留数据表核对具体数值。
- **AI 上下文占位脚本**：`npm run ai:context-placeholder` 保留未来 Obsidian skill/CLI 上下文适配器契约；当前脚本不读取 vault，也不发起网络请求。

## ChatGPT provider 与隐私

默认设置保持本地优先：`AI provider` 为 `None`，生成报告不访问网络。要启用 ChatGPT：

1. 打开 Annual Review 插件设置。
2. 将 `AI provider` 设置为 `ChatGPT`。
3. 可选：填入 `OpenAI API key`，并按需修改 `ChatGPT model`。留空时会尝试使用本地 Codex CLI/auth。
4. 运行 `Annual Review: Generate report`，在生成弹窗中确认本次运行的 provider。

隐私边界需要明确：ChatGPT 模式会把本次年度报告所需的统计、链接关系和部分笔记摘录交给所选生成路径。有 API key 时发送到 OpenAI Responses API；无 key 时走本机 Codex CLI/auth 环境。当前实现是显式选择、无硬编码密钥；更细粒度的数据预览、字段脱敏和 Obsidian skill/CLI 上下文增强仍保留在脚本 TODO 中。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 确认项目可运行

```bash
npm run test
npm run typecheck
npm run build
```

这些命令分别验证核心统计逻辑、TypeScript 类型和 Obsidian 插件打包产物。`npm run build` 会生成 `main.js`，用于手动安装到 Obsidian vault。

### 3. 安装到测试 vault

先准备一个 Obsidian 测试 vault，然后把构建产物复制到插件目录：

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp manifest.json main.js "$PLUGIN_DIR/"
```

打开 Obsidian 后进入设置：

1. 关闭安全模式或启用社区插件。
2. 在 Community plugins 中启用 **Annual Review**。
3. 打开插件设置，确认报告目录、包含/排除目录、报告语言、生成器语言、指标开关、隐私模式和 AI provider。

### 4. 生成第一份年度回顾

1. 在命令面板运行 `Annual Review: Rebuild index`，确保插件读取最新 vault 内容。
2. 运行 `Annual Review: Generate report`。
3. 选择要复盘的年份和生成选项。
4. 打开 `Annual Reviews/YYYY Annual Review.md`。
5. 检查本期一句话判断、写作增长图表、主题演化、高价值笔记和下期行动。
6. 按自己的写作风格编辑生成的 Markdown；vault 更新后可以重新运行生成命令。
7. 需要先看指标时，运行 `Annual Review: Open dashboard` 打开仪表盘。

## 常见使用场景

- **个人年终总结**：把 daily notes、项目日志、灵感和任务整理成一份可继续编辑的年度复盘。
- **写作复盘**：查看全年词数/字符数、活跃天数、最长连续记录、最活跃月份和代表性长文。
- **研究复盘**：识别 Top 主题、主题演化、新兴/衰退方向和下期主题建议。
- **项目回顾**：从项目笔记、任务和文件夹活动中整理团队或个人项目的年度材料。
- **vault 整理**：发现高价值笔记、可输出笔记、需维护笔记和孤立潜力笔记。
- **分享前整理**：先在本地生成完整私密报告，再手动挑选可以公开的片段。

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| `manifest.json` | Obsidian 插件清单，插件 ID 为 `annual-review`。 |
| `package.json` | 本地开发脚本：测试、类型检查、构建和 watch。 |
| `src/` | 插件源码：命令、设置、vault 扫描、聚合、渲染、报告写入和仪表盘。 |
| `tests/` | Vitest 测试和 fixture vault。 |
| `docs/` | 产品规格、调研、文档索引和后续说明。 |
| `docs/product-spec.md` | 中文产品规格，包含范围、架构、数据模型、验证计划和阶段路线。 |
| `docs/research/dec-7-project-research.md` | 项目早期调研，保留在 docs 下作为背景资料。 |

## 设计边界

- 默认不访问网络。
- 默认不调用外部 AI。
- 不要求安装 Dataview、Bases、Tasks、Kanban、Projects 或 Novel Word Count。
- 插件运行时不读取当前 Obsidian vault 之外的文件。
- Markdown 年度报告是主要产物，仪表盘只是预览和操作入口。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run test` | 运行 Vitest，覆盖 tokenizer、路径过滤、元数据提取、年度聚合和 Markdown 渲染。 |
| `npm run typecheck` | 运行 TypeScript 类型检查，不生成构建文件。 |
| `npm run build` | 生成可安装到 Obsidian 的 `main.js`。 |
| `npm run dev` | 启动 esbuild watch，适合本地插件开发。 |
| `npm run ai:context-placeholder` | 输出未来 Obsidian skill/CLI AI 上下文适配器的占位契约。 |

## 验证建议

自动验证：

```bash
npm run test
npm run typecheck
npm run build
```

手动验证：

1. 把插件安装到测试 vault。
2. 运行重建索引、生成报告、打开仪表盘。
3. 确认报告文件在 `Annual Reviews/` 下生成，图表 SVG 在 `Annual Reviews/YYYY Annual Review Assets/` 下生成。
4. 确认报告中的 Obsidian 链接能打开源笔记。
5. 准备一个同时包含 `[[标题|别名]]`、`[[路径#标题]]`、嵌入链接和 Markdown 链接的目标笔记，确认热门链接按同一个 Obsidian 解析目标合并统计。
6. 重新生成报告，确认不会重复堆叠旧内容。
7. 在没有第三方插件的干净 vault 中重复核心流程。

## 更多文档

- [英文 README](README.en.md)
- [文档索引](docs/README.md)
- [产品规格](docs/product-spec.md)
- [项目调研](docs/research/dec-7-project-research.md)
