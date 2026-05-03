# AI+data 报告生成设计

状态：设计草案
适用范围：年度报告、月度报告，以及后续可扩展的周期复盘
关联规格：[产品规格](product-spec.md)

## 1. 设计目标

AI 不应该替代本地统计引擎，也不应该把用户 vault 当成一个可以随意上传的黑盒。它的职责是把已经可追溯的数据、双链关系和有限摘录整理成更像人的复盘草稿，并保留所有关键判断的证据入口。

目标包括：

- 让年度/月度报告从“统计表”升级为“可编辑的叙事草稿”。
- 让 AI 只基于插件明确提供的上下文工作，不直接漫游 vault。
- 通过 CLI 或 skill 形成可审计、可替换的上下文读取层。
- 保留本地优先默认行为：不开启 AI 时不访问网络、不调用外部模型。
- 每个 AI 结论都尽量能回到 Obsidian wiki link、路径、标签或统计口径。

## 2. AI 可以生成什么

### 2.1 年度报告增强

年度报告适合让 AI 生成长周期判断，但不适合让 AI 重新计算指标。最终报告保持精简结构，AI 只填充「本期一句话判断」，其余章节由确定性数据生成：

- 一句话判断：基于写作增长、主题演化和高价值笔记生成 1 句可编辑总结。
- 写作增长表达：确定性报告提供总新增字数、写作天数、最长连续写作、日累计字数图、月度增长图、热力图和 1 条优点/风险/建议。
- 主题演化表达：确定性报告提供 Top 5-8 主题、主题演化图、新兴主题、衰退主题和 1 条下期建议。
- 高价值笔记表达：确定性报告提供 Top 10 高价值笔记、可输出笔记、需维护笔记和每篇建议动作。
- 下期行动表达：确定性报告提供 MOC、孤立笔记和 1-2 个高价值笔记推进项。

### 2.2 月度报告增强

月度报告更适合短周期、可行动的反馈：

- 本月新增/修改内容概览。
- 本月主题变化和上月延续线索。
- 本月最值得回看的笔记清单。
- 本月完成、搁置和反复出现的项目线索。
- 下月关注建议，例如需要补链、补 frontmatter、整理 MOC 的区域。

月报可以作为年报的中间缓存：每月生成的 AI 草稿保存在 vault 内，年报可以只读取这些月报摘要和关键证据，而不是重新给 AI 发送全年大量摘录。

### 2.3 报告形态

AI 生成内容应进入最终报告的固定槽位，而不是新增独立章节：

- `## 本期一句话判断`：AI provider 开启时写入 1 句总结；未开启或不可用时使用确定性判断。
- `## 写作增长`：固定包含总新增字数、写作天数、最长连续写作、日累计字数图、月度增长图、热力图和 1 条优点/风险/建议。
- `## 主题演化`：固定包含 Top 5-8 主题、主题演化图、新兴主题、衰退主题和 1 条下期建议。
- `## 高价值笔记`：固定包含 Top 10 高价值笔记、可输出笔记、需维护笔记和每篇建议动作。
- `## 下期行动`：固定包含 MOC、孤立笔记和 1-2 个高价值笔记推进项。

## 3. 数据来源和双链读取

AI 上下文由插件和本地适配层共同准备。核心原则是“插件负责读取和过滤，AI 只看被授权的上下文包”。

### 3.1 插件内确定性数据

已有代码路径可以作为第一层数据源：

- `readVaultMarkdownFiles` 从当前 Obsidian vault 读取 Markdown 文件和 `metadataCache` 链接信息。
- `extractNoteStats` 抽取 frontmatter、标签、标题、任务、字数和链接。
- `buildYearAggregate` 聚合写作增长、主题演化、高价值笔记、孤立潜力笔记和支持仪表盘预览的热门指标。
- `buildAiPrompt` 已经把年度统计、`linkGraph` 和 `contextNotes` 打包为 provider 上下文。

这层数据应继续保持确定性、可测试和不依赖 AI。

### 3.2 双链上下文

双链不只是 `[[A]] -> [[B]]` 的边，还应该形成可解释的上下文结构：

| 上下文 | 来源 | 用途 |
| --- | --- | --- |
| outgoing links | `metadataCache.resolvedLinks[file.path]` / `unresolvedLinks` | 说明某篇笔记主动引用了哪些主题或项目。 |
| incoming links | 由所有 outgoing links 反向聚合 | 找出被频繁引用的中心笔记和年度主题。 |
| co-links | 同一篇笔记中共同出现的链接 | 识别主题组合，例如“项目 A + 读书 B”。 |
| path clusters | 文件夹、日记路径、项目路径 | 区分 daily、project、reading、archive 等写作场景。 |
| headings and excerpts | Markdown 标题和受限摘录 | 给 AI 最小必要语义证据。 |

AI 输出必须优先引用规范化后的目标路径，例如 `[[Projects/Research.md]]`，避免把别名、标题锚点或未解析文本当成不同对象重复解释。

### 3.3 CLI 或 skill 读取层

未来可以把“上下文增强”做成本地 CLI 或 Obsidian skill。它不直接替代插件扫描，而是在插件确定范围后补充更高阶语义：

```text
Obsidian plugin
  -> deterministic aggregate JSON
  -> scoped note manifest
  -> local CLI / skill context adapter
  -> provider-ready context Markdown or JSON
  -> AI provider
  -> editable report Markdown
```

建议契约：

```json
{
  "input": {
    "period": "2026 or 2026-03",
    "periodType": "year | month",
    "vaultRoot": "trusted local vault root",
    "scope": {
      "includeFolders": [],
      "excludeFolders": ["Templates", "Archive", "Annual Reviews"],
      "privacyMode": "standard | private"
    },
    "aggregatePath": "path/to/aggregate.json",
    "noteManifestPath": "path/to/notes.json"
  },
  "output": {
    "contextMarkdown": "provider-ready context with evidence links",
    "contextJson": "structured context for Responses API or local Codex",
    "redactions": [],
    "warnings": []
  }
}
```

CLI/skill 允许做的事情：

- 根据 manifest 读取被允许的笔记全文或片段。
- 生成 incoming-link、co-link、主题簇和时间线补充上下文。
- 应用脱敏规则，例如移除指定文件夹、标签、属性、任务正文或摘录。
- 输出预览给插件，让用户确认后再调用外部 provider。

CLI/skill 不允许做的事情：

- 绕过插件设置读取排除目录。
- 默认读取 vault 外部文件。
- 默认发起网络请求。
- 在没有用户确认时把全文发送给外部 AI。
- 把 AI 结果写回源笔记正文。

## 4. 生成流程

### 4.1 年报流程

1. 用户运行 `Annual Review: Generate report` 并选择年份、范围、语言和 AI provider。
2. 插件按现有过滤规则扫描 vault，生成年度统计和图表资产。
3. 如果 AI provider 为 `None`，直接生成确定性 Markdown 报告。
4. 如果 AI provider 被启用，插件生成上下文包：
   - 年度聚合指标。
   - 月度桶和字数增长。
   - top 标签、文件夹、链接。
   - 代表笔记和受限摘录。
   - 双链图谱摘要。
5. 可选 CLI/skill 读取 manifest 并补充 incoming links、co-links 和主题簇。
6. 插件展示发送预览、摘录数量、被省略数量、脱敏规则和 provider。
7. 用户确认后调用 ChatGPT API 或本地 Codex CLI/auth。
8. 插件把 AI 片段追加到年度报告 Markdown 中。
9. 报告保存在 `Annual Reviews/YYYY Annual Review.md`，用户继续编辑。

### 4.2 月报流程

月报使用同一套管线，但 period 改为月份：

```text
selected month
  -> notes created/modified in month
  -> monthly aggregate
  -> month-local link graph
  -> AI monthly reflection
  -> Monthly Reviews/YYYY-MM Review.md
```

月报需要额外关注：

- 与上月相比新增/消失的主题。
- 上月行动建议是否在本月有对应笔记或任务更新。
- 本月高频链接是否会成为年报主题候选。

## 5. 上下文预算和隐私边界

上下文不能无限扩大。建议分层发送：

1. 总是发送：统计汇总、top-N、代表笔记路径、链接图摘要。
2. 默认发送：每篇入选代表笔记的短摘录。
3. 用户确认后发送：更长摘录、任务正文、frontmatter 自定义字段。
4. 默认不发送：排除目录、报告目录、附件、图片 OCR、全文 vault dump、vault 外部文件。

预览界面至少展示：

- provider 名称和调用路径。
- 将发送的笔记数量、摘录字符上限、被省略数量。
- 将发送的 top 标签、top 链接和代表笔记路径。
- 应用的脱敏规则。
- 可能影响质量的警告，例如“只有 2 篇笔记可用”或“隐私模式隐藏了任务正文”。

## 6. 输出质量要求

AI 片段必须满足：

- 不重算插件已经给出的数字。
- 不编造未在上下文中出现的人、地点、项目或结论。
- 引用具体笔记时使用 wiki link 或路径。
- 明确区分“证据支持的观察”和“建议”。
- 允许用户删除 AI 段落后仍保留完整确定性报告。

推荐提示词约束：

```text
Use only the supplied JSON/Markdown context.
Preserve source note paths when making claims.
Do not infer private facts absent from the context.
When evidence is weak, say so briefly.
Return editable Markdown, not final publication copy.
```

## 7. MVP 拆分建议

### Phase A：文档和上下文契约

- 固化本文件中的 CLI/skill 输入输出契约。
- 让 `scripts/obsidian-ai-context-placeholder.mjs` 输出与契约一致的字段。
- 在测试中锁定 `buildAiPrompt` 的关键字段：统计、linkGraph、contextNotes、omittedNoteCount。

### Phase B：本地预览和确认

- 在生成前展示 provider-ready context 摘要。
- 支持用户确认或取消。
- 支持基础脱敏：文件夹、标签、笔记正文摘录。

### Phase C：双链增强

- 生成 incoming links 和 co-links。
- 识别年度/月度主题簇。
- 把主题簇作为 AI 上下文，但仍保留源笔记证据。

### Phase D：月报复用

- 增加月度 aggregate 和 `Monthly Reviews/YYYY-MM Review.md`。
- 年报读取月报摘要，减少全年上下文发送量。
- 标记哪些年报段落来自月报缓存，哪些来自年度重新生成。

## 8. 验证方式

自动验证：

- `buildAiPrompt` 包含年度/月度聚合、top links、linkGraph、contextNotes 和省略计数。
- Obsidian resolved links 被规范化到同一目标路径。
- 排除目录不会进入 AI context。
- 隐私模式和摘录上限不会被 CLI/skill 绕过。

手动验证：

1. 准备包含 daily notes、项目笔记、别名链接、标题锚点、未解析链接和中文内容的测试 vault。
2. 生成本地年度报告，确认无 AI 时不访问网络。
3. 启用 AI provider，确认插件展示上下文预览。
4. 确认 AI 段落引用的笔记链接可以在 Obsidian 打开。
5. 删除 AI 段落后，确定性统计报告仍完整可读。

## 9. 开放问题

- 月报是否进入 MVP，还是只作为年报 AI 上下文压缩方案保留到后续阶段。
- CLI/skill 的正式入口名称和分发方式。
- 是否需要支持本地模型 provider，还是先聚焦 ChatGPT 和本地 Codex CLI/auth。
- 脱敏规则应以插件设置保存，还是每次生成时临时选择。
