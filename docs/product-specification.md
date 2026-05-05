# Annual Review SPEC

状态：DEC-39 重新定位版。本文定义目标产品体验，不把当前代码实现当作上限。
技术栈：TypeScript + Obsidian API + esbuild + Vitest。

## 1. 产品定位

Annual Review 是 Obsidian 的年度复盘工作流插件。它从用户一年的笔记中
生成候选主题、候选笔记和行动线索，引导用户逐项审核、取舍和决策，
最终输出一份可追溯、可编辑、可重复生成的 Markdown 年报。

核心体验是 Review Workflow，不是统计面板，也不是 AI 总结生成器。年报文件是最终工件；真正的产品价值来自扫描、候选、审核、决策和证据复核。

## 2. 产品原则

- 复盘流程优先：先帮助用户完成筛选、接受、取舍和行动，再生成年报。
- 证据优先：每个主题、笔记推荐和行动建议都能回到源笔记、标签、链接、任务或时间线。
- 用户判断优先：插件只给候选项、理由和证据；最终主题命名、价值判断和行动决定由用户接受或取舍。
- 小闭环优先：先跑通扫描、候选、审核、决策、年报，再扩展图表或导出。
- 本地与可回滚优先：默认无网络；不覆盖用户编辑；生成内容可备份、可 diff、可复核。

## 3. 目标用户与痛点

目标用户：

- 长期使用 Obsidian 写 daily notes、项目记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 年底希望快速完成第一轮有意义复盘，而不是先手动整理大量笔记的人。
- 不信任黑盒总结，但愿意接受带理由、证据和可撤回状态的候选推荐的人。

核心痛点：

- 不知道哪些内容值得回看。
- 不知道哪些主题真正贯穿全年。
- 不知道哪些笔记应继续推进、合并、归档或放弃。
- 容易遗忘沉睡但仍有价值的笔记。
- 不信任自动生成的漂亮总结。

## 4. Review Workflow

目标闭环：

```text
选择年份和范围
  -> 扫描 vault
  -> 生成候选
  -> Review Board 审核
  -> 行动决策
  -> 可重复生成的 Markdown 年报
```

### 4.1 选择年份和范围

用户选择：

- 年份。
- include folders。
- exclude folders 和 exclude patterns。
- 是否包含任务、链接、frontmatter、标题。
- 隐私模式。
- 生成语言。

默认排除：

- `.obsidian`。
- 报告目录。
- 模板目录。
- 归档目录。
- 附件目录。
- 用户显式排除的路径。

### 4.2 扫描

插件读取：

- `app.vault.getMarkdownFiles()`。
- `vault.cachedRead(file)`。
- `metadataCache.getFileCache(file)`。
- `metadataCache.resolvedLinks` 和 `metadataCache.unresolvedLinks`。
- frontmatter / Properties。
- Markdown 标签、wiki links、嵌入、标题和任务。
- 文件路径、目录、ctime、mtime。

插件不读取：

- vault 外部文件。
- 非 Markdown 文件正文。
- 默认排除范围内的 Markdown。
- 生成出的年报和资产目录。

### 4.3 候选生成

候选类型：

| 类型 | 用途 | 证据 |
| --- | --- | --- |
| `topic` | 贯穿全年的主题或方向 | 标签、文件夹、标题、链接、月度分布、代表笔记 |
| `note` | 值得回看的代表笔记 | 字数、链接、任务、修改时间、主题归属、上下文摘录 |
| `project` | 可能需要继续推进的项目线 | 文件夹、任务、双链、时间跨度 |
| `task` | 需要年度层面判断或下一步行动的任务/任务簇 | Markdown 任务、任务状态、上下文标题、源笔记 |
| `dormant-note` | 很久未动但可能有价值的笔记 | 历史链接、主题归属、最后修改时间 |
| `bridge-note` | 连接多个主题或项目区域的桥接笔记 | 反链、出链、跨文件夹连接、主题跨度 |

`Anomaly` 不作为 Review Board v1 候选类型；它是候选生成阶段的扫描信号，可用于解释 `topic`、`note`、`project`、`task`、`dormant-note` 或 `bridge-note` 为什么出现。

每个候选项必须包含：

- 稳定 ID。
- 类型。
- 建议标题。
- 简短理由。
- evidence links。
- 初始状态。
- 可选分数和排序解释。

### 4.4 Review Board

Review Board 是复盘主界面。用户逐项处理候选，而不是直接接受一份完整总结。

必需操作：

- Accept：接受候选进入年报候选结果。
- Rename topic：改主题或候选名称。
- Merge topic：合并重复主题。
- Ignore：本次复盘忽略。
- Archive：标记为归档方向。
- Add to annual highlights：加入年度精选。
- Add to actions：记录下一步行动。
- Open source note：打开源笔记、标签、链接、任务或时间线证据。

推荐交互：

- 左侧候选队列。
- 右侧证据、理由和操作按钮。
- 底部复盘进度。
- 可筛选待审核、已接受、行动、已忽略/归档项。
- 进度显示，例如 `7/18 reviewed`。

### 4.5 行动决策

行动是年报的核心输出之一。候选被接受后，Review Board v1 的按钮只使用 DEC-40 操作集；行动记录可以保留更具体的结果标签，方便年报表达。

| Review Board 操作 | 含义 |
| --- | --- |
| Accept | 接受候选作为年度复盘结果。 |
| Ignore | 本次复盘不采用，但保留状态。 |
| Merge topic | 将重复主题合并到目标主题。 |
| Rename topic | 使用用户命名替代机器建议标题。 |
| Add to annual highlights | 将主题、笔记或桥接笔记加入年度精选。 |
| Add to actions | 将候选转为下一步行动，可附带 continue、archive、drop、convert-to-project 或 revisit 等结果标签。 |
| Open source note | 打开候选或证据来源，不改变状态。 |

行动记录应包含：

- action label。
- 用户备注。
- 来源候选。
- evidence links。
- 创建时间。
- 是否写入年报。

### 4.6 年报生成

默认路径：

```text
Annual Reviews/YYYY Annual Review.md
```

年报结构：

- YAML frontmatter：年份、生成时间、扫描范围、隐私模式、插件版本。
- 方法说明：本次扫描了什么、排除了什么、哪些内容由用户接受。
- 年度主题：至少 3 个用户接受主题，包含理由和证据。
- 代表笔记：至少 5 篇用户接受笔记，包含为什么值得回看。
- 行动决定：至少 3 条用户接受行动。
- 用户手写区：保留给个人叙事、反思和补充。
- 再生成记录：说明哪些区块可再生、哪些区块由用户维护。

AI 可以作为可选步骤帮助润色已接受内容，但不能替代候选、审核、决策和证据链。

## 5. 数据模型

### 5.1 NoteSignal

```ts
type NoteSignal = {
  path: string;
  title: string;
  ctime: number;
  mtime: number;
  yearTouched: number[];
  tags: string[];
  folders: string[];
  linksOut: string[];
  linksIn: string[];
  headings: string[];
  tasks: TaskSignal[];
  wordCount: number;
  cjkCharCount: number;
};
```

### 5.2 Candidate

```ts
type CandidateStatus =
  | "candidate"
  | "accepted"
  | "renamed"
  | "merged"
  | "ignored"
  | "archived"
  | "next-action";

type ReviewCandidate = {
  id: string;
  type: "topic" | "note" | "project" | "task" | "dormant-note" | "bridge-note";
  title: string;
  reason: string;
  evidence: EvidenceRef[];
  sourcePaths: string[];
  score?: number;
  status: CandidateStatus;
  mergedIntoId?: string;
  userTitle?: string;
  userNote?: string;
  decisionIds: string[];
};
```

### 5.3 EvidenceRef

```ts
type EvidenceRef = {
  id: string;
  kind: "note" | "tag" | "link" | "task" | "timeline" | "folder" | "excerpt";
  label: string;
  target: string;
  sourcePath?: string;
  excerpt?: string;
  reason?: string;
  missing?: boolean;
};
```

### 5.4 Decision

```ts
type ReviewDecision = {
  id: string;
  candidateId: string;
  action: "continue" | "merge" | "archive" | "drop" | "convert-to-project" | "revisit" | "custom";
  label: string;
  note: string;
  evidence: EvidenceRef[];
  createdAt: string;
  includeInReport: boolean;
};
```

### 5.5 ReviewSession

```ts
type ReviewSession = {
  id: string;
  year: number;
  scope: ReviewScope;
  status: ReviewSessionStatus;
  candidates: ReviewCandidate[];
  decisions: ReviewDecision[];
  reportPath?: string;
  createdAt: string;
  updatedAt: string;
};
```

## 6. 状态流转

### 6.1 ReviewSessionStatus

```text
new
  -> scanning
  -> candidates-ready
  -> reviewing
  -> ready-to-generate
  -> generating
  -> report-written
```

失败状态：

```text
scan-failed
generation-failed
write-conflict
cancelled
```

恢复规则：

- `scan-failed`：保留错误说明，允许修改范围后重试。
- `generation-failed`：保留已接受候选和行动，允许跳过 AI 或只重新生成年报。
- `write-conflict`：不覆盖已有用户编辑，提示创建副本或查看 diff。
- `cancelled`：保留会话草稿，允许继续或删除。

### 6.2 CandidateStatus

```text
candidate
  -> accepted
  -> renamed
  -> merged
  -> ignored
  -> archived
  -> next-action
```

规则：

- `accepted`、`renamed`、`merged` 可进入年报。
- `ignored` 默认不进入年报，但保留在会话记录中。
- `archived` 可进入行动决定区，作为明确取舍。
- `next-action` 可进入行动决定区，并且必须关联行动记录。
- `merged` 必须记录目标候选 ID。
- 重复扫描不得覆盖 `accepted`、`renamed`、`merged`、`ignored`、`archived` 或 `next-action` 等用户已决定状态。

## 7. 用户编辑保护

年报使用区块边界保护用户编辑：

```md
<!-- annual-review:generated:start section=\"themes\" -->
...
<!-- annual-review:generated:end section=\"themes\" -->

<!-- annual-review:user:start section=\"reflection\" -->
用户写作区
<!-- annual-review:user:end section=\"reflection\" -->
```

规则：

- 只替换 `annual-review:generated` 区块。
- 不修改 `annual-review:user` 区块。
- 未识别的手写内容默认保留。
- 重新生成前读取当前文件并合并，而不是从空文件覆盖。
- 如果区块结构损坏，写入新副本并提示用户手动合并。
- 可选创建 `Annual Reviews/.history/YYYY Annual Review.<timestamp>.md` 备份。

## 8. 隐私边界

默认模式：

- 无网络请求。
- 无外部 AI。
- 无 telemetry。
- 不读取 vault 外部文件。
- 不扫描排除范围。
- 不把报告生成结果再次作为下一轮输入。

AI opt-in 模式：

- 用户必须显式选择 provider。
- 发送前展示上下文摘要、摘录数量、目标 provider 和排除范围。
- 只发送已接受候选、必要统计和有限摘录。
- 不发送完整 vault。
- 不写入硬编码密钥。
- provider 失败时回退到本地确定性年报。

## 9. 失败场景

| 场景 | 风险 | 处理 |
| --- | --- | --- |
| vault 很大导致扫描慢 | 用户以为卡死 | 展示进度、允许取消、保留已扫描结果 |
| include/exclude 配置错误 | 候选不可信 | 在年报方法说明中列出扫描范围和排除范围 |
| metadata cache 不完整 | 链接/标签证据缺失 | 标注证据来源，允许重建索引 |
| 候选质量差 | 用户失去信任 | 每项展示理由、分数来源和忽略操作 |
| 重复主题过多 | 审核成本高 | 支持合并、重命名和批量忽略 |
| AI 输出失败或不可解析 | 年报中断 | 回退确定性模板，保留用户已接受内容 |
| 重新生成遇到用户编辑 | 内容丢失 | 只替换 generated 区块，必要时写副本 |
| 目标文件被外部同步修改 | 覆盖冲突 | 比较 mtime/hash，提示 diff 或新副本 |
| 源笔记被删除或移动 | 证据链接失效 | 标注 missing evidence，允许重新扫描 |

## 10. 成功标准

- 用户 10-15 分钟内完成第一轮有意义的年度复盘。
- 年报中至少包含 3 个用户接受的年度主题。
- 年报中至少包含 5 篇用户接受的代表笔记。
- 年报中至少包含 3 条用户接受行动。
- 每个推荐项都有简短理由和 evidence links。
- 重新生成不会抹掉用户手写内容。
- 默认模式无网络请求。

## 11. 非目标

- 不做不可解释的一键自动总结。
- 不把 AI provider 数量作为核心竞争力。
- 不优先做泛用图表、分享页或导出矩阵。
- 不依赖 Dataview、Bases、Tasks、Kanban、Projects 或其他第三方插件完成核心路径。
- 不在默认模式下读取 vault 外部文件或发送网络请求。

## 12. 验证计划

自动验证：

```bash
npm run test
npm run typecheck
npm run build
```

核心行为测试应覆盖：

- 路径过滤和报告目录排除。
- NoteSignal 提取。
- Candidate 生成和稳定排序。
- Candidate 状态流转。
- Decision 创建和年报写入。
- generated/user 区块合并，确认重新生成不覆盖手写内容。
- 默认无 AI provider 时不访问网络。
- AI provider 失败时回退确定性报告。

手动验证：

1. 在测试 vault 中选择年份和扫描范围。
2. 运行重建索引。
3. 查看主题、笔记、项目、任务、沉睡笔记和桥接笔记候选。
4. 接受、重命名、合并主题、忽略和归档若干候选。
5. 为至少 3 个接受项添加行动决定。
6. 生成年报，确认报告包含方法说明、证据链接、已接受主题、代表笔记和行动。
7. 编辑用户手写区，重新生成，确认手写内容仍在。
8. 默认设置下确认没有外部网络请求。
