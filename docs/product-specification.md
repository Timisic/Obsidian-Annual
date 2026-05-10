# Time Range Review SPEC

状态：MVP 规格。本文定义 Time Range Review 的最小可发布闭环。
技术栈：TypeScript + Obsidian API + esbuild + Vitest。

## 1. 产品定位

Obsidian Annual Review 是 Obsidian 的时间范围主题复盘插件。
它支持 Annual、Quarterly、Monthly 和 Custom Range Review Session，
从用户指定范围内的 Markdown 笔记中编译 Evidence Notes，
生成需要用户复核的 Theme Hypotheses，
并把用户确认后的主题、证据和连接解释写入可追溯、可编辑、可重复生成的 Markdown Review Report。

核心体验是 Theme Review Workflow，不是统计面板，也不是 AI 自动总结生成器。
AI 的正确角色是主题提炼和关系解释；最终主题判断必须由用户在 Review Board 中确认。

## 2. 产品原则

- 时间范围优先：所有流程围绕 Review Session 的 startDate、endDate、preset 和扫描范围运行。
- 遗忘优先：先把被时间淹没但仍有价值的 Evidence Notes 带回用户眼前。
- 连接优先：发现跨笔记、跨文件夹、跨时间的隐藏关系，并解释为什么这些笔记可能属于同一主题。
- 证据优先：每个 Theme Hypothesis 都必须绑定 Evidence Notes、摘录、链接和不确定性说明。
- 用户判断优先：主题假设需要用户复核；未经确认不得写成用户结论。
- 本地与可回滚优先：默认无网络；不覆盖用户编辑；生成内容可备份、可 diff、可复核。

## 3. 目标用户与痛点

目标用户：

- 长期使用 Obsidian 写 daily notes、项目记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 想复盘年度、季度、月份或一段自定义时间，但不想先整理完整个 vault 的用户。
- 希望 AI 帮忙提炼主题和解释关系，但要求每条结论都有证据且能被自己确认的人。

核心痛点：

- 遗忘：重要笔记被时间、数量和近期记忆淹没。
- 连接断裂：真实关系常常没有被标签、文件夹和双链完整表达。
- 不信任自动总结：用户需要知道 AI 看了什么、为什么这样连接、哪些地方仍不确定。

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
- AI provider，可选且默认关闭。

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
- 初始状态 `proposed`。

### 4.6 Review Board

Review Board 是主题复核界面。用户处理 Theme Hypothesis，而不是直接接受完整 AI 总结。

必需操作：

- Accept：确认主题进入 Review Report 输入。
- Rename：使用用户命名替代建议标题。
- Merge：把重复或相近主题合并到目标主题。
- Ignore：本次复盘不采用，但保留状态。
- Open evidence：打开源笔记或证据摘录。
- Re-explain：基于相同证据重新生成或刷新连接解释。

推荐交互：

- 左侧主题假设队列。
- 右侧证据笔记、连接解释、不确定性和操作按钮。
- 待复核、已接受、已忽略、已合并筛选。
- 进度显示，例如 `4/9 reviewed`。

### 4.7 Review Report

默认路径：

```text
Reviews/<range label> Review.md
```

示例：

```text
Reviews/2026 Annual Review.md
Reviews/2026 Q1 Review.md
Reviews/2026-03 Review.md
Reviews/2026-03-01 to 2026-04-15 Review.md
```

报告结构：

- YAML frontmatter：preset、startDate、endDate、生成时间、扫描范围、隐私模式、插件版本。
- Methodology：本次扫描了什么、排除了什么、是否使用 AI、哪些内容由用户确认。
- Confirmed Themes：用户接受或改名后的主题，包含解释和 Evidence Notes。
- Rediscovered Notes：被重新带回眼前的关键证据笔记。
- Connection Explanations：主题内笔记关系说明。
- User Reflection：用户手写区，保留给个人叙事和补充。
- Regeneration Notes：说明哪些区块可再生、哪些区块由用户维护。

AI 可以作为可选步骤帮助润色已确认内容或重新解释证据关系，
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
  privacyMode: "local-only" | "ai-assisted";
  aiProviderId?: string;
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
type ThemeHypothesisStatus = "proposed" | "accepted" | "renamed" | "merged" | "ignored";

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
proposed
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
- 可选创建 `Reviews/.history/<range label> Review.<timestamp>.md` 备份。

## 8. 隐私边界

默认模式：

- 无网络请求。
- 无外部 AI。
- 无 telemetry。
- 不读取 vault 外部文件。
- 不扫描排除范围。
- 不把生成出的报告再次作为下一轮输入。

AI opt-in 模式：

- 用户必须显式选择 provider。
- 发送前展示时间范围、上下文摘要、摘录数量、目标 provider 和排除范围。
- 只发送 Evidence Notes 的必要摘录、主题聚合输入和有限统计。
- 不发送完整 vault。
- 不写入硬编码密钥。
- provider 失败时回退到本地确定性报告。

## 9. 失败场景

| 场景                     | 风险              | 处理                                   |
| ------------------------ | ----------------- | -------------------------------------- |
| vault 很大导致扫描慢     | 用户以为卡死      | 展示进度、允许取消、保留已扫描结果     |
| include/exclude 配置错误 | 主题不可信        | 在报告方法说明中列出扫描范围和排除范围 |
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
- 默认无 AI provider 时不访问网络。
- AI provider 失败时回退本地确定性报告。

手动验证路径：

1. 在测试 vault 中创建 Annual、Quarterly、Monthly 或 Custom Range Review Session。
2. 运行重建索引。
3. 查看 Theme Hypotheses、Evidence Notes、Connection Explanation 和不确定性说明。
4. 接受、改名、合并或忽略若干主题假设。
5. 生成 Review Report，确认报告包含方法说明、证据链接、已确认主题和用户手写区。
6. 编辑用户手写区，重新生成，确认手写内容仍在。
7. 默认设置下确认没有外部网络请求。
