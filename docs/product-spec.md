# Obsidian Annual Review 产品规格

状态：MVP 基础版已实现，后续功能按阶段推进
技术栈：TypeScript + Obsidian API + esbuild
背景调研：[项目调研](research/dec-7-project-research.md)

## 1. 目标

构建一个本地优先的 Obsidian 插件，把用户 vault 中一年的笔记活动整理成可编辑、可追溯的年度回顾 Markdown。

第一版不做独立的营销式网页报告。核心产物是 vault 内的 `Annual Reviews/YYYY Annual Review.md`，因为 Obsidian 用户通常更需要可编辑、可链接、可同步、可版本管理的本地文档。

## 2. 产品原则

- 本地优先：默认只读取当前 vault，不访问网络。
- Markdown 优先：年度回顾笔记是主要交付物，仪表盘只是预览和操作入口。
- 证据可追溯：提到具体笔记、标签、文件夹和链接时，应尽量提供源笔记链接或统计口径。
- Obsidian 原生：优先使用命令面板、设置页、`ItemView`、vault 文件 API 和主题变量。
- 可选分享：分享图、HTML、Canvas、AI 摘要都必须由用户主动触发。
- 依赖克制：MVP 不强依赖 Dataview、Bases、Tasks、Kanban、Projects 或其他第三方插件。

## 3. 目标用户

- 用 daily notes、项目笔记、读书笔记和 evergreen notes 记录生活/工作的个人用户。
- 关注写作量、活跃节奏、主题变化和知识结构的写作者/研究者。
- 使用 Obsidian Properties、Bases、Dataview 风格字段或任务系统，但仍希望核心年度报告能从纯 Markdown 中生成的高级用户。

## 4. MVP 用户路径

1. 用户安装插件并打开设置。
2. 用户确认报告目录、包含/排除目录、隐私模式和指标开关。
3. 用户在命令面板运行 `Annual Review: Rebuild index`。
4. 用户运行 `Annual Review: Generate report`。
5. 插件扫描 vault Markdown 文件和 metadata cache。
6. 插件写入 `Annual Reviews/YYYY Annual Review.md`。
7. 用户打开报告，检查证据链接，手动编辑年度叙事。
8. 用户可运行 `Annual Review: Open dashboard` 预览指标并重新生成报告。

## 5. 范围

### 5.1 命令

- `Annual Review: Generate report`
  - 选择年份。
  - 使用全 vault 或配置的包含目录。
  - 根据隐私和指标设置生成 Markdown 报告。
- `Annual Review: Open dashboard`
  - 打开 Obsidian `ItemView`，展示年度指标和热门列表。
  - 提供生成、重新生成和打开报告入口。
- `Annual Review: Rebuild index`
  - 清理缓存并重新扫描 vault。

### 5.2 设置

- 报告目录，默认 `Annual Reviews/`。
- 包含目录和排除目录。
- 指标开关：任务、链接、frontmatter、标题等。
- 隐私模式。
- 适合 CJK 和中英混合 vault 的计数策略。

### 5.3 数据来源

MVP 只需要 Obsidian 官方 API 和 Markdown 内容：

- `app.vault.getMarkdownFiles()`
- `vault.cachedRead(file)`
- `metadataCache.getFileCache(file)`
- frontmatter / Properties
- 标签、链接、嵌入、标题
- Markdown 任务
- 文件路径、目录、ctime、mtime

第三方插件只作为未来 adapter 的输入来源，核心路径不能依赖它们是否安装。

### 5.4 指标

MVP 指标包括：

- 写作增长：总新增字数、写作天数、最长连续写作、日累计字数、月度增长和每日热力图。
- 主题演化：Top 5-8 主题、主题演化图、新兴主题、衰退主题和下期主题建议。
- 高价值笔记：Top 10 高价值笔记、可输出笔记、需维护笔记和每篇建议动作。
- 下期行动：建立/更新 MOC、处理孤立笔记、推进 1-2 个高价值笔记。
- 启用任务解析时的任务统计。

统计要求：

- 同时保留英文词数和 CJK 字符数。
- 明确区分 created、modified、content-in-year 三类口径。
- top-N 排序必须稳定，例如先按数量降序，再按路径升序。

### 5.5 Markdown 报告

默认路径：

```text
Annual Reviews/YYYY Annual Review.md
```

建议章节：

- 标题和生成元数据。
- 本期一句话判断。
- 写作增长：总新增字数、写作天数、最长连续写作、日累计字数图、月度增长图、热力图，以及 1 条优点、1 条风险、1 条建议。
- 主题演化：Top 5-8 主题、主题演化图、新兴主题、衰退主题和 1 条下期建议。
- 高价值笔记：Top 10 高价值笔记、可输出笔记、需维护笔记，每篇都包含建议动作。
- 下期行动：建立/更新 MOC、处理孤立笔记、推进 1-2 个高价值笔记。

报告中命名具体笔记时应使用 Obsidian wiki link。用户编辑报告不应破坏插件状态。

### 5.6 仪表盘

仪表盘是功能性控制面，不是主要产物：

- 年份选择。
- 范围和隐私状态。
- 索引新鲜度和重建入口。
- 年度总览指标。
- 月度趋势。
- 热门标签、文件夹、链接和笔记列表。
- 生成、重新生成和打开报告按钮。

## 6. 当前不做

- 默认云端分析或托管报告页。
- 默认 AI 生成总结。
- 读取当前 vault 之外的私有文件。
- 完整 Canvas 生成。
- 完整分享卡编辑器。
- 强依赖 Dataview、Bases、Tasks、Kanban 或 Projects。
- 把年度报告主路径做成只能在仪表盘里查看。

## 7. 架构

当前源码按功能边界组织：

```text
src/
  main.ts
  core/
    aggregate.ts
    commands.ts
    extract.ts
    filters.ts
    render.ts
    settings.ts
    tokenizer.ts
    types.ts
  obsidian/
    dashboardView.ts
    reportWriter.ts
    vaultFiles.ts
    yearModal.ts
```

数据流：

```text
Vault Markdown files
  -> scanner + metadata extractor
  -> NoteStats[]
  -> YearAggregate
  -> Markdown report + dashboard preview
```

后续可增强索引层：

- 用路径、mtime、size 和 schema version 缓存文件统计。
- 在 vault create/modify/delete/rename 事件后只重算变化文件。
- 避免 Obsidian 启动时阻塞全量扫描。
- 在仪表盘展示索引新鲜度。

## 8. 核心数据模型

```ts
export interface NoteStats {
  path: string;
  ctime: number;
  mtime: number;
  folder: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
  headings: string[];
  tasks: TaskStats;
  wordCount: number;
  charCount: number;
}

export interface YearAggregate {
  year: number;
  generatedAt: string;
  activeDays: number;
  createdCount: number;
  modifiedCount: number;
  totalWords: number;
  totalCharacters: number;
  monthBuckets: MonthBucket[];
  topTags: RankedMetric[];
  topFolders: RankedMetric[];
  topLinks: RankedMetric[];
  representativeNotes: RankedNote[];
}
```

## 9. 隐私和 AI 边界

默认行为：

- 不访问网络。
- 不调用外部 AI。
- 不上传统计数据。
- 不要求 telemetry。
- 生成报告保存在 vault 内。

未来 AI provider 必须满足：

- 明确 opt-in。
- 提交前展示将发送的数据。
- 支持脱敏和排除。
- 保留源笔记证据链接。
- 只在用户确认后本地缓存结果。

## 10. 验证计划

自动测试应覆盖：

- 英文、中文、中英混合和空内容 tokenizer。
- 路径过滤：报告目录、模板、归档、非 Markdown 文件。
- frontmatter、标签、链接、标题和任务提取。
- 年度聚合、月度桶、连续记录、top-N 稳定排序。
- Markdown renderer 章节和源笔记链接。
- 插件命令 ID 注册。

手动验证：

1. 在 Obsidian 桌面测试 vault 中安装构建后的插件。
2. 运行 `Annual Review: Rebuild index`。
3. 运行 `Annual Review: Generate report`。
4. 确认 `Annual Reviews/YYYY Annual Review.md` 已生成。
5. 确认报告链接能打开源笔记。
6. 打开仪表盘，确认指标和重新生成入口可用。
7. 在没有第三方插件的干净 vault 中重复核心流程。
8. 确认生成报告在移动端或只读客户端中仍然可读。

## 11. 阶段路线

| 阶段 | 重点 | 交付 |
| --- | --- | --- |
| Phase 0 | 规格和样本 | 产品规格、调研、fixture vault、统计口径。 |
| Phase 1 | 本地统计引擎 | 扫描、tokenizer、元数据提取、聚合、Markdown 输出。 |
| Phase 2 | Obsidian 命令和设置 | 命令面板、设置页、报告写入、基础缓存。 |
| Phase 3 | 仪表盘 | `ItemView`、年份/范围控制、指标总览、热门列表。 |
| Phase 4 | 导出和 adapter | 隐私友好的分享卡、Canvas/Bases 输出、Markdown-backed 第三方数据 adapter。 |
| Phase 5 | 可选 AI | opt-in AI provider、脱敏预览、证据链接和本地缓存。 |

## 12. 风险和缓解

| 风险 | 缓解 |
| --- | --- |
| 大 vault 扫描慢 | 增量缓存、事件驱动更新、手动重建入口、启动延迟扫描。 |
| CJK 计数不准 | 同时记录词数和字符数，增加 CJK fixture。 |
| 用户不信任主题标签 | 展示数据口径和源笔记链接，避免黑盒人格判断。 |
| 隐私顾虑 | 默认离线，导出/AI 都要明确确认范围。 |
| 第三方插件数据不稳定 | 先读 Markdown 事实，adapter 可选且隔离。 |
| 报告过期 | 展示生成时间和索引状态，允许重新生成。 |

## 13. 非谈判边界

- 不把外部 AI 或云服务作为默认路径。
- 不要求安装 Dataview 或 Novel Word Count。
- 不在没有证据链接或口径说明时把生成叙事当成权威结论。
- 不让仪表盘取代 Markdown 报告。
- 插件运行时不读取或上传当前 vault 之外的文件。
