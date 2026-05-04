# Obsidian Annual Review 产品规格

状态：本地优先年度回顾插件已进入可用 MVP；文档按当前 `main` 分支实现更新。
技术栈：TypeScript + Obsidian API + esbuild + Vitest。
背景调研：[项目调研](research/project-research.md)。

## 1. 产品目标

Obsidian Annual Review 把当前 vault 中一年的 Markdown 笔记活动整理成可编辑、可追溯的年度回顾笔记。核心产物是 `Annual Reviews/YYYY Annual Review.md`，同时生成图表 SVG 和主题演化 JSON 资产，保留 Obsidian wiki link，方便用户继续编辑、链接、同步、版本管理和人工审阅。

## 2. 当前产品原则

- 本地优先：默认只读取当前 vault，不访问网络。
- Markdown 优先：年度回顾笔记是主要交付物，仪表盘承担预览、重建索引和触发生成职责。
- 证据可追溯：主题、高价值笔记和代表性内容尽量回链到源笔记。
- Obsidian 原生：使用命令面板、设置页、`ItemView`、vault 文件 API、metadata cache 和主题变量。
- AI 明确 opt-in：用户选择 ChatGPT 后，才会通过 OpenAI Responses API 或本地 Codex CLI/auth 生成增强内容。
- 依赖克制：核心路径不依赖 Dataview、Bases、Tasks、Kanban、Projects 或 Novel Word Count。
- 分支名可维护：仓库协作分支只使用 ASCII 字符，避免 GitHub head ref Unicode 提示。

## 3. 目标用户

- 用 daily notes、项目笔记、读书笔记、研究笔记和 evergreen notes 记录长期材料的 Obsidian 用户。
- 想复盘写作量、活跃天数、主题变化、代表性内容和下一阶段行动的写作者或研究者。
- 需要本地 Markdown 年度总结，并希望生成内容可继续手动润色的人。
- 愿意在明确隐私边界内使用 ChatGPT 或本地 Codex 生成更完整叙事的人。

## 4. 已实现用户路径

1. 用户安装插件并打开设置。
2. 用户确认报告目录、包含/排除目录、语言、隐私模式、指标开关和 AI provider。
3. 用户运行 `Annual Review: Rebuild index`，或由生成/仪表盘预览触发读取。
4. 插件通过 Obsidian API 扫描 vault Markdown 文件和 metadata cache。
5. 用户运行 `Annual Review: Generate report`，在弹窗中选择年份、范围、语言、隐私模式、指标开关和本次 AI provider。
6. 插件聚合年度数据，必要时调用 ChatGPT 或本地 Codex。
7. 插件写入 `Annual Reviews/YYYY Annual Review.md`，并写入 `Annual Reviews/YYYY Annual Review Assets/` 下的 SVG/JSON 资产。
8. 用户打开报告，检查图表、wiki link、主题演化、高价值笔记和下期行动。
9. 用户运行 `Annual Review: Open dashboard` 查看指标预览、趋势、热力图、热门标签/文件夹/链接和代表性笔记。

## 5. 当前命令

| 命令 | 用途 |
| --- | --- |
| `Annual Review: Generate report` | 打开年份弹窗，生成指定年份年度回顾。 |
| `Annual Review: Generate 2026 report (smoke)` | 用于 smoke vault 的固定年份验证命令。 |
| `Annual Review: Open dashboard` | 打开右侧仪表盘，预览指标并触发生成或重建索引。 |
| `Annual Review: Rebuild index` | 清理当前索引缓存并重新读取 vault Markdown 文件。 |

## 6. 当前设置

| 设置 | 当前行为 |
| --- | --- |
| `reportFolder` | 默认 `Annual Reviews`，报告和资产写入该目录，并从扫描输入中排除。 |
| `includeFolders` | 可限制扫描范围；为空时扫描所有符合条件的 Markdown。 |
| `excludeFolders` | 默认排除 `.obsidian`、`Templates`、`Archive`、`Attachments`。 |
| `excludePatterns` | 支持额外排除模式。 |
| `includeTasks` | 控制 Markdown 任务统计。 |
| `includeLinks` | 控制 Obsidian resolved/unresolved link 统计。 |
| `includeFrontmatter` | 控制 frontmatter / Properties 参与提取。 |
| `includeHeadings` | 控制标题提取。 |
| `privacyMode` | `private` 会在报告元数据中标记隐私敏感。 |
| `reportLanguage` | `system`、`zh`、`en`，控制报告语言。 |
| `generatorLanguage` | `system`、`zh`、`en`，控制设置页和弹窗语言。 |
| `aiProvider` | `none` 或 `chatgpt`。默认 `none`。 |
| `chatGptApiKey` | 有 key 时走 OpenAI Responses API。 |
| `chatGptModel` | 默认 `gpt-4.1`。 |
| `localCodexCommand` | 无 API key 且选择 ChatGPT 时的本地 Codex fallback。 |

## 7. 数据来源和过滤

当前实现读取：

- `app.vault.getMarkdownFiles()`。
- `vault.cachedRead(file)`。
- `metadataCache.getFileCache(file)`。
- `metadataCache.resolvedLinks` 和 `metadataCache.unresolvedLinks`。
- frontmatter / Properties。
- Markdown 标签、wiki link、嵌入、标题和任务。
- 文件路径、目录、ctime、mtime。

过滤策略：

- 只处理 Markdown 文件。
- 排除报告目录、模板、归档、附件目录和用户配置的排除范围。
- 支持 includeFolders 缩小扫描范围。
- 生成报告和图表资产不会再次成为下一次年度报告输入。

## 8. 聚合指标

当前年度聚合输出 `YearAggregate`，包含：

- 年份、生成时间、报告范围和隐私模式。
- 活跃天数、最长连续记录天数。
- 年内创建笔记数、年内修改笔记数。
- 创建笔记的英文词数和 CJK 字符数。
- 任务总数和完成任务数。
- 月度桶、每日桶和月度新增趋势。
- Top 标签、文件夹、链接、代表性笔记和 Top 笔记。
- 主题演化数据，包括 Top topics、新兴主题、衰退主题、月度主题桶和笔记主题分配。
- 高价值笔记、输出候选、需维护笔记、孤立潜力笔记和反馈信号。

排序要求：top-N 先按主要分数降序，再使用路径或名称做稳定 tie-break。

## 9. 年度 Markdown 报告

默认路径：

```text
Annual Reviews/YYYY Annual Review.md
```

默认资产目录：

```text
Annual Reviews/YYYY Annual Review Assets/
```

报告包含：

- YAML frontmatter：生成时间、年份、范围、排除范围、隐私模式和报告语言。
- 本期一句话判断。
- 写作增长：总新增字数、写作天数、最长连续记录、年度总览、月度时间线和活动反馈。
- 图表：每日累计字数、每日字数热力图、月度新增笔记趋势。
- 主题演化：主题 SVG、主题 JSON、Top topics、新兴主题、衰退主题和下一步建议。
- 高价值笔记：Top 10、输出候选、需维护笔记、孤立潜力笔记和建议动作。
- 下期行动：基于本地信号或 AI 增强内容生成。

当用户启用 ChatGPT 时，报告会优先使用 AI 返回的年度判断、内容线程、高价值笔记理由和下一步行动。AI 输出解析失败时，报告回退到本地统计模板。

## 10. 仪表盘

仪表盘是 Obsidian `ItemView`，当前功能包括：

- 年份输入和预览按钮。
- 生成报告按钮。
- 重建索引按钮。
- 包含范围、排除范围、隐私模式、AI provider 和索引状态卡片。
- 上一份报告打开入口。
- 创建数、修改数、活跃天数和词数总览。
- 月度趋势条形图。
- 每日字数热力图。
- 月度新增趋势。
- Top 标签、文件夹、链接和代表性笔记列表。

仍需加强的体验包括索引新鲜度解释、长任务进度、历史报告列表和大 vault 场景下的响应反馈。

## 11. AI provider 和隐私边界

默认行为：

- 不访问网络。
- 不调用外部 AI。
- 不上传统计数据。
- 不要求 telemetry。
- 生成报告保存在 vault 内。

ChatGPT 模式：

- 用户必须在设置或生成弹窗中选择 `ChatGPT`。
- 有 API key 时，插件调用 OpenAI Responses API。
- 无 API key 时，插件调用配置的本地 Codex CLI/auth 命令。
- 上下文包含年度统计、链接关系、部分笔记摘录、反链和相邻笔记信息。
- Prompt 要求返回 JSON，并要求保留源笔记路径、避免虚构私有事实、避免公式化对比句式。

待补充能力：

- 发送前预览。
- 字段级脱敏。
- 更细粒度的排除规则。
- 本地模型 provider 评估。
- 长会话 app-server 集成评估。

## 12. 架构

当前源码结构：

```text
src/
  main.ts                         # Obsidian 插件入口、命令注册、设置页、运行流程
  core/
    aggregate.ts                  # 年度聚合
    ai.ts                         # ChatGPT / 本地 Codex 报告增强
    commands.ts                   # 命令 ID 和命令名
    extract.ts                    # frontmatter、标签、链接、标题、任务提取
    filters.ts                    # 路径包含/排除
    highValueNotes.ts             # 高价值笔记和建议动作
    language.ts                   # 中英文 UI 文案
    render.ts                     # 年度报告 Markdown、SVG 和 JSON 资产渲染
    settings.ts                   # 默认设置和列表解析
    tokenizer.ts                  # 英文词数和 CJK 字符计数
    topics.ts                     # 主题演化
    types.ts                      # 类型契约
    writingGrowth.ts              # 独立写作增长报告核心
  obsidian/
    dashboardView.ts              # 仪表盘 ItemView
    progressModal.ts              # 生成进度弹窗
    reportWriter.ts               # 报告和资产写入
    vaultFiles.ts                 # Obsidian vault 读取
    yearModal.ts                  # 生成年份弹窗
scripts/
  deploy-plugin.mjs               # 构建并部署到 vault
  writing-growth-report.mjs       # 独立写作增长 CLI
  obsidian-ai-context-placeholder.mjs
```

数据流：

```text
Vault Markdown files
  -> path filters
  -> metadata + Markdown extractor
  -> NoteStats[]
  -> YearAggregate
  -> optional AI enhancements
  -> Markdown report + SVG/JSON assets + dashboard preview
```

## 13. 验证计划

自动验证：

```bash
npm run test
npm run typecheck
npm run build
```

测试覆盖应包含：

- 英文、中文、中英混合和空内容 tokenizer。
- 路径过滤：报告目录、模板、归档、附件和非 Markdown 文件。
- frontmatter、标签、Obsidian resolved/unresolved link、标题和任务提取。
- 年度聚合、月度桶、每日桶、连续记录、top-N 稳定排序。
- 主题演化：frontmatter、标签、文件夹和 fallback cluster。
- 高价值笔记：核心笔记、输出候选、需维护、孤立潜力和 Top 10 限制。
- Markdown renderer：中英文报告、frontmatter、wiki link、图表引用、AI 增强回退。
- 图表资产写入顺序。
- AI provider：OpenAI Responses API、本地 Codex fallback、失败状态提示。
- Obsidian 命令 ID 和命令名。

手动验证：

1. 在 Obsidian 桌面测试 vault 中安装构建产物。
2. 运行 `Annual Review: Rebuild index`。
3. 运行 `Annual Review: Generate report`。
4. 确认报告和资产目录生成。
5. 确认报告链接能打开源笔记。
6. 打开仪表盘，确认年份预览、重新生成和打开报告入口可用。
7. 在没有第三方插件的干净 vault 中重复核心流程。
8. 在 ChatGPT 关闭、有 API key、无 API key 本地 Codex 三种场景中验证隐私提示和失败文案。

## 14. 当前 To Do

| 方向 | 待办 | 来源线索 |
| --- | --- | --- |
| 大 vault 性能 | 增量索引、事件驱动更新、启动延迟扫描和更明确的重建状态。 | `Rebuild index`、dashboard index 状态、早期规格中的缓存规划。 |
| AI 隐私控制 | 发送前预览、脱敏、排除字段和上下文大小解释。 | PR #18 ChatGPT 增强、AI 设计文档。 |
| 主题质量 | 进一步削弱 raw tag、月份文件夹和单篇标题对主题名称的影响。 | PR #18 AI 总结、`topics.ts` fallback 规则。 |
| 高价值笔记 | 让理由更多引用正文、反链和相邻笔记上下文。 | PR #13 高价值笔记、PR #18 AI 高价值理由。 |
| 仪表盘 | 历史报告列表、索引新鲜度解释、长任务进度和错误恢复。 | PR #16 可读性和 dashboard fit。 |
| 导出分享 | 分享卡、Canvas、Bases、HTML 等用户主动触发的输出。 | 早期规格 Phase 4。 |
| 本地 AI | 改善 macOS GUI Codex 路径发现、错误提示和本地模型 provider 评估。 | PR #17 本地 Codex 路径。 |
| 分支卫生 | 合并后自动删除 head branch，所有分支统一 ASCII 命名。 | PR #19 清理分支、GitHub head ref Unicode 提示。 |

## 15. 阶段路线

| 阶段 | 状态 | 重点 |
| --- | --- | --- |
| Phase 0 | 已完成 | 规格、调研、fixture vault、统计口径。 |
| Phase 1 | 已完成 | 扫描、tokenizer、元数据提取、聚合、Markdown 输出。 |
| Phase 2 | 已完成 | 命令面板、设置页、报告写入、基础索引缓存。 |
| Phase 3 | 已完成基础版 | `ItemView` 仪表盘、年份/范围控制、指标总览、热门列表。 |
| Phase 4 | 待推进 | 增量索引、导出分享、Canvas/Bases adapter、历史报告管理。 |
| Phase 5 | 进行中 | opt-in ChatGPT、本地 Codex fallback、证据链接、上下文治理。 |

## 16. 风险和缓解

| 风险 | 缓解 |
| --- | --- |
| 大 vault 扫描慢 | 使用 include/exclude 缩小范围，推进增量缓存和事件驱动更新。 |
| AI 上下文过宽 | 限制摘录数量和长度，增加发送前预览、脱敏和排除规则。 |
| 主题名称不稳定 | 优先 frontmatter 主题和标签，过滤月份/路径噪声，继续改进内容聚类。 |
| Obsidian GUI 环境找不到 Codex | 支持本地 Codex 命令配置，文档建议使用绝对路径。 |
| 图表资产路径变化影响链接 | 集中通过 `buildAnnualReviewChartPaths` 生成路径，测试覆盖 wiki link 引用。 |
| 分支名 Unicode 提示 | 使用 ASCII 分支命名，合并后删除 head branch，必要时重新开 ASCII 分支 PR。 |
