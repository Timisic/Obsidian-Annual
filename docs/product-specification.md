# Time Range Review SPEC

状态：MVP 规格。本文定义 Time Range Review 的最小可发布闭环。
技术栈：TypeScript + Obsidian API + esbuild + Vitest。

## 1. 产品定位

Obsidian Time Range Review is an AI-assisted review plugin that helps users rediscover forgotten notes, uncover hidden themes across a selected time range, and generate evidence-backed Markdown review reports inside their vault.

它支持 Annual、Quarterly、Monthly 和 Custom Range Review Session，
从用户指定范围内的 Markdown 笔记中编译 Evidence Package，
由 AI 或本地规则生成需要用户复核的 semantic Theme Hypotheses，
并把用户确认后的主题写成可追溯、可编辑、可重复生成的叙事型 Markdown Review Report。

核心体验是 Theme Review Workflow，不是统计面板，也不是一次性 AI 自动总结生成器。
AI 是核心分析层：它基于受控证据包提出主题假设、解释跨笔记关系、标注不确定性；
最终主题判断必须由用户在 Review Board 中确认。

## 2. 产品原则

- 时间范围优先：所有流程围绕 Review Session 的 startDate、endDate、preset 和扫描范围运行。
- 遗忘优先：先把被时间淹没但仍有价值的 Evidence Notes 带回用户眼前。
- 连接优先：发现跨笔记、跨文件夹、跨时间的隐藏关系，并解释为什么这些笔记可能属于同一主题。
- 证据优先：每个 Theme Hypothesis 都必须绑定 Evidence Notes、摘录、链接和不确定性说明。
- AI 受控优先：AI 只能处理用户确认范围内的证据包、provider 或本地 CLI 路径必须显式选择，避免不受控的全 vault 总结。
- 图表证据优先：图表用于说明 activity rhythm、writing bursts、dormant periods 和主题形成的时间背景，不作为产品主身份。
- 用户判断优先：主题假设需要用户复核；未经确认不得写成用户结论。
- 叙事报告优先：默认 Review Report 是面向重读的段落式复盘，不是 Review Board 审计导出或字段式 AI 报告。
- 本地与可回滚优先：默认无网络；不覆盖用户编辑；生成内容可备份、可 diff、可复核。

## 3. 目标用户与痛点

目标用户：

- 长期使用 Obsidian 写 daily notes、工作记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 想复盘年度、季度、月份或一段自定义时间，但不想先整理完整个 vault 的用户。
- 希望 AI 帮忙提炼主题和解释关系，但要求每条结论都有证据且能被自己确认的人。

核心痛点：

- 遗忘：重要笔记被时间、数量和近期记忆淹没。
- 连接断裂：真实关系常常没有被标签、文件夹和双链完整表达。
- 不信任自动总结：用户需要知道 AI 看了什么、为什么这样连接、哪些地方仍不确定。
- 复盘范围不止一年：用户需要 Annual、Quarterly、Monthly 和 Custom Range，而不是固定年度报告。

## 4. Review Workflow

目标闭环：

```text
选择时间范围
  -> 扫描允许范围
  -> 编译 Evidence Notes
  -> 聚合 Evidence Clusters
  -> 生成 Theme Hypotheses
  -> Review Board 用户复核
  -> 写入 Review Report
```

### 4.1 选择时间范围

用户选择：

- preset：Annual、Quarterly、Monthly 或 Custom Range。
- startDate 和 endDate。
- include folders。
- exclude folders 和 exclude patterns。
- 是否包含 frontmatter、标题、链接、摘录和时间线信号。
- 隐私模式。
- 生成语言。
- AI provider 或 local CLI path，必须由用户显式选择；默认不调用外部 provider。

默认排除：

- `.obsidian`。
- 报告目录。
- 模板目录。
- 附件目录。
- 用户显式排除的路径。

### 4.2 扫描与证据编译

插件读取：

- `app.vault.getMarkdownFiles()`。
- `vault.cachedRead(file)`。
- `metadataCache.getFileCache(file)`。
- `metadataCache.resolvedLinks` 和 `metadataCache.unresolvedLinks`。
- frontmatter / Properties。
- Markdown 标签、wiki links、嵌入、标题和摘录。
- 文件路径、目录、ctime、mtime。

插件不读取：

- vault 外部文件。
- 非 Markdown 文件正文。
- 默认排除范围内的 Markdown。
- 生成出的复盘报告和资产目录。

Evidence Note 必须来自允许范围内的源笔记，并保留可打开的 Obsidian 路径。

### 4.3 Evidence Notes

Evidence Note 是支撑主题假设的源笔记，而不是需要用户逐项清空的候选对象。

每个 Evidence Note 包含：

- 稳定 ID。
- 源路径和显示标题。
- 日期信号：创建、修改、范围内活跃或被引用时间。
- 摘录。
- 入链、出链、标签、标题和文件夹上下文。
- 为什么进入证据包的本地理由。
- 缺失或移动时的 missing evidence 标记。

### 4.4 Evidence Clusters

Evidence Cluster 是一组可能相关的 Evidence Notes。
聚合信号可以包括：

- 显式双链、反链、共同链接。
- 重复表达、相似问题、实体名和关键词。
- 跨文件夹连接。
- 时间分布和活跃峰值。
- 旧笔记在当前范围内被重新引用的痕迹。

Evidence Cluster 是 AI 或本地规则生成主题假设的输入，不直接作为用户结论。

### 4.5 Theme Hypotheses

Theme Hypothesis / 主题假设是基于 Evidence Cluster 提出的复盘主线。
它不是 tag 统计，也不是用户结论。

每个 Theme Hypothesis 必须包含：

- 稳定 ID。
- 建议标题。
- 一句话解释。
- Connection Explanation：这些 Evidence Notes 为什么可能属于同一条思考线。
- Evidence Notes 列表。
- 代表摘录和 Obsidian 源链接。
- 不确定性说明。
- 信号来源或可选置信度。
- 初始状态 `candidate`。

### 4.6 Review Board

Review Board 是主题复核界面。用户处理 Theme Hypothesis，而不是直接接受完整 AI 总结。

必需操作：

- Accept：确认主题进入 Review Report 输入。
- Rename：使用用户命名替代建议标题。
- Merge：把重复或相近主题合并到目标主题。
- Ignore：本次复盘不采用，但保留状态。
- Open evidence：打开源笔记或证据摘录。
- Re-explain：可选后续能力；当前 MVP 不把它作为必需操作。

推荐交互：

- 左侧主题假设队列。
- 右侧证据笔记、连接解释、不确定性和操作按钮。
- 待复核、已接受、已忽略、已合并筛选。
- 进度显示，例如 `4/9 reviewed`。

### 4.7 Review Report

默认路径：

```text
Annual Reviews/<range label>.md
```

示例：

```text
Annual Reviews/2026 Annual Review.md
Annual Reviews/2026 Q1 Review.md
Annual Reviews/2026-03 Review.md
Annual Reviews/2026-03-01 to 2026-04-15 Review.md
```

默认报告形态是 Narrative Review Report / 叙事型复盘报告。它适用于 Annual、Quarterly、Monthly 和 Custom Range；范围越短，主题数量可以越少，但不得为凑数把弱线索包装成主线。

推荐结构：

- YAML frontmatter：preset、startDate、endDate、生成时间、隐私模式、插件版本等机器可读元数据。
- Overview / 总览：用 2-4 段说明这个时间范围的总体变化、主要张力和最值得记住的东西。
- Activity Rhythm / 年度节奏或阶段节奏：保留累计增长、月度/阶段增长、热力图和主题演化等图表；每张图只配一句人话解释。
- Main Themes / 主要主线：默认 3-5 条强主线；月度或短自定义范围可以少于 3 条。每条主线使用段落式叙事，保留源笔记的语气和关键词，但必须有清楚逻辑。
- Representative Evidence / 代表证据：每条主线只保留 2-4 条代表 Evidence Note 链接，每条链接使用人话 alias 和极短说明。
- Worth Rereading / 值得重读的笔记：3-7 条被重新带回眼前的关键笔记，说明为什么值得重读；不得写成自动任务建议。
- Reflection Questions / 留给自己的问题：3-5 个继续思考的问题，不写成 action items 或下一步待办。
- User Reflection / 我的补充：用户手写区，保留给个人补记，重新生成不得覆盖。
- Methodology / 方法与数据口径：只保留极短人话说明，解释时间范围、证据来源、AI 使用边界和主题需用户确认；不列出扫描目录、排除目录、snapshot、语言或 frontmatter 计数等详细技术口径。

主题渲染规则：

- 主题标题使用普通 Markdown 标题，不使用 wikilink；标题优先来自用户在 Review Board 中接受或重命名后的名称。
- 正文使用克制、自然、解释性的复盘叙事；可以少量出现“我”，但不伪装成用户亲手写的全文自述。
- 不出现字段式标签：`AI 总结`、`为什么这个主题存在`、`连接解释`、`本地信号`、`复核提示`、`合并来源`。
- Connection Explanation 应吸收到主题段落里，而不是作为独立字段。
- 可以少量吸收原笔记短语来保留文字气质；默认不做大段原文摘录。
- 正文中的 Obsidian wikilinks 必须带可读 alias；目标路径必须准确，alias 可以为报告语境生成，但不得把证据笔记改写成过度结论。
- 标准报告默认可以保留人名、关系、金钱等敏感细节；只有显式隐私选择才做去标识化或摘要化处理。
- 完整 Evidence Notes、本地信号、隐藏连接簇、合并来源、创建/修改时间、实体、反链和出链属于 Evidence Audit；默认保留在 Review Board 或插件状态中，不写入普通报告，也不作为普通附录。

AI 是主题假设和关系解释的核心分析层，但必须受证据包和用户选择的 provider / local CLI path 约束。
AI 输出需要绑定源笔记、摘录和可复核理由；它可以在用户确认后帮助组织报告文字，
但不能替代主题假设复核和用户确认。

## 5. 数据模型

### 5.1 ReviewSession

```ts
type ReviewPreset = "annual" | "quarterly" | "monthly" | "custom";

type ReviewSession = {
  id: string;
  preset: ReviewPreset;
  startDate: string;
  endDate: string;
  scope: ReviewScope;
  privacyMode: "standard" | "private";
  aiProviderId?: string;
  localCliPath?: string;
  status: ReviewSessionStatus;
  evidenceNoteIds: string[];
  evidenceClusterIds: string[];
  themeHypothesisIds: string[];
  themeDecisionIds: string[];
  reportPath?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 EvidenceNote

```ts
type EvidenceNote = {
  id: string;
  path: string;
  title: string;
  ctime: number;
  mtime: number;
  activeDates: string[];
  tags: string[];
  folders: string[];
  linksOut: string[];
  linksIn: string[];
  headings: string[];
  excerpts: EvidenceExcerpt[];
  localReason: string;
  missing?: boolean;
};
```

### 5.3 EvidenceCluster

```ts
type EvidenceCluster = {
  id: string;
  evidenceNoteIds: string[];
  signals: ClusterSignal[];
  localSummary: string;
  createdAt: string;
};
```

### 5.4 ThemeHypothesis

```ts
type ThemeHypothesisStatus = "candidate" | "accepted" | "renamed" | "merged" | "ignored";

type ThemeHypothesis = {
  id: string;
  clusterId: string;
  title: string;
  summary: string;
  connectionExplanation: string;
  uncertainty: string;
  evidenceNoteIds: string[];
  representativeExcerptIds: string[];
  status: ThemeHypothesisStatus;
  userTitle?: string;
  mergedIntoId?: string;
  userNote?: string;
  signalSources: string[];
};
```

### 5.5 ThemeDecision

```ts
type ThemeDecision = {
  id: string;
  themeHypothesisId: string;
  decision: "accept" | "rename" | "merge" | "ignore";
  userTitle?: string;
  targetThemeHypothesisId?: string;
  note: string;
  createdAt: string;
  includeInReport: boolean;
};
```

## 6. 状态流转

### 6.1 ReviewSessionStatus

```text
new
  -> scanning
  -> evidence-ready
  -> clustering
  -> themes-ready
  -> reviewing
  -> ready-to-generate
  -> generating
  -> report-written
```

失败状态：

```text
scan-failed
theme-generation-failed
write-conflict
cancelled
```

恢复规则：

- `scan-failed`：保留错误说明，允许修改范围后重试。
- `theme-generation-failed`：保留 Evidence Notes 和 Evidence Clusters，允许跳过 AI 或只用本地规则。
- `write-conflict`：不覆盖已有用户编辑，提示创建副本或查看 diff。
- `cancelled`：保留会话草稿，允许继续或删除。

### 6.2 ThemeHypothesisStatus

```text
candidate
  -> accepted
  -> renamed
  -> merged
  -> ignored
```

规则：

- `accepted` 和 `renamed` 可进入报告。
- `merged` 必须记录目标主题 ID，并由目标主题承载合并后的证据。
- `ignored` 默认不进入报告，但保留在会话记录中。
- 重复扫描或重新解释不得覆盖用户已经做出的主题决策。
- 所有写入报告的主题都必须经过用户复核。

## 7. 用户编辑保护

报告使用区块边界保护用户编辑：

```md
<!-- review:generated:start section="confirmed-themes" -->

...

<!-- review:generated:end section="confirmed-themes" -->

## 我的补充

<!-- review:user:start section="reflection" -->

用户写作区

<!-- review:user:end section="reflection" -->
```

规则：

- 只替换 `review:generated` 区块。
- 不修改 `review:user` 区块。
- 未识别的手写内容默认保留。
- 重新生成前读取当前文件并合并，而不是从空文件覆盖。
- 如果区块结构损坏，写入新副本并提示用户手动合并。
- 可选创建 `Annual Reviews/.history/<range label>.<timestamp>.md` 备份。

## 8. 隐私边界

默认模式：

- 无网络请求。
- 无外部 AI provider；仍可使用本地规则生成基础证据簇和可复核占位主题。
- 无 telemetry。
- 不读取 vault 外部文件。
- 不扫描排除范围。
- 不把生成出的报告再次作为下一轮输入。
- 不默认改写或删除源证据中的人名、关系和金钱细节；这些细节是复盘真实性的一部分。

AI opt-in 模式：

- 用户必须显式选择 provider 或 local CLI path。
- 发送前展示时间范围、上下文摘要、摘录数量、目标 provider / local CLI path 和排除范围。
- 只发送 Evidence Notes 的必要摘录、主题聚合输入和有限统计。
- 不发送完整 vault。
- 不写入硬编码密钥。
- provider 或 local CLI 失败时回退到本地确定性报告。

## 9. 失败场景

| 场景                     | 风险              | 处理                                   |
| ------------------------ | ----------------- | -------------------------------------- |
| vault 很大导致扫描慢     | 用户以为卡死      | 展示进度、允许取消、保留已扫描结果     |
| include/exclude 配置错误 | 主题不可信        | 在 Review Board / session metadata 中暴露范围配置，报告只保留短版口径 |
| metadata cache 不完整    | 链接/标签证据缺失 | 标注证据来源，允许重建索引             |
| 证据簇质量差             | 主题假设牵强      | 展示信号来源、不确定性和忽略操作       |
| 重复主题过多             | 审核成本高        | 支持合并、改名和批量忽略               |
| AI 输出失败或不可解析    | 主题生成中断      | 回退本地规则或保留证据等待重试         |
| 重新生成遇到用户编辑     | 内容丢失          | 只替换 generated 区块，必要时写副本    |
| 目标文件被外部同步修改   | 覆盖冲突          | 比较 mtime/hash，提示 diff 或新副本    |
| 源笔记被删除或移动       | 证据链接失效      | 标注 missing evidence，允许重新扫描    |

## 10. 非目标

- 不做不可解释的一键自动总结。
- 不把 AI provider 数量作为核心竞争力。
- 不优先做泛用图表、分享页或导出矩阵。
- 不依赖 Dataview、Bases、Tasks、Kanban、Projects 或其他第三方插件完成核心路径。
- 不把项目线索、任务线索、下一步行动或归档判断作为当前 MVP 的核心对象。
- 不在默认模式下读取 vault 外部文件或发送网络请求。

## 11. 验证计划

自动验证：

```bash
npm run test
npm run typecheck
npm run build
```

文档和 release 交接还应运行：

```bash
npm run format:check
npm run release:check
```

核心行为测试应覆盖：

- Annual / Quarterly / Monthly / Custom Range 的 startDate/endDate 解析。
- 路径过滤和报告目录排除。
- Evidence Note 提取和稳定 ID。
- Evidence Cluster 聚合和排序。
- Theme Hypothesis 生成、状态流转和用户决策保留。
- Review Report 写入和 generated/user 区块合并。
- 默认无外部 provider / local CLI path 时不访问网络。
- AI provider 或 local CLI 失败时回退本地确定性报告。

手动验证路径：

1. 在测试 vault 中创建 Annual、Quarterly、Monthly 或 Custom Range Review Session。
2. 运行重建索引。
3. 查看 Theme Hypotheses、Evidence Notes、Connection Explanation 和不确定性说明。
4. 接受、改名、合并或忽略若干主题假设。
5. 生成 Review Report，确认报告以段落式叙事呈现已确认主题，包含活动图表、带 alias 的代表证据链接、极短方法说明和用户手写区。
6. 编辑用户手写区，重新生成，确认手写内容仍在。
7. 默认设置下确认没有外部网络请求。
