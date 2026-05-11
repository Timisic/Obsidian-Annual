# Obsidian Time Range Review 插件复审与3 Issue 执行版

> 建议存放位置：`docs/pivot/2026-05-11-pivot-review-3-issues.md`  
> 本文用于承接当前产品转向：从“年度报告生成器”收敛为“基于时间范围的主题复盘插件”。

---

## 0. 本轮结论

这次更新后，项目方向已经明显更清楚：它不应该继续被定义为一个简单的 Annual Review 生成器，而应该被定义为一个 **Time Range Review / 时间范围主题复盘插件**。

它的核心价值是：

> 帮助用户在指定时间范围内找回被遗忘的关键笔记，发现分散笔记之间的隐含主题关系，并通过 AI 辅助分析与用户复核，生成一份有证据、有连接、有可追溯来源的复盘报告。

这个方向比“生成一份漂亮年报”更稳，也更能和一份完整 prompt 拉开差异。

当前文档已经开始对齐这个方向，但工程主路径还没有完全跟上。尤其是：

1. 文档已经转向 Time Range Review，但部分代码仍然围绕 `year` / `annual`。
2. 文档强调 semantic theme hypothesis，但 Review Board 仍有旧的 topic / tag / note candidate 影子。
3. AI 在产品中应该是核心分析能力，但 README 里部分表达仍容易让 AI 看起来像边缘增强。
4. 图表不应该被砍掉，它们是活动证据层，应该保留在报告正文中。
5. 文档数量偏多，需要归档和合并，避免 docs 本身变成认知负担。

---

## 1. 产品第一性原理

用户复盘时真正遇到的问题不是“缺少一篇总结”，而是：

### 1.1 遗忘

用户一年或一段时间内写了很多笔记，但复盘时常常只记得最近的、情绪强烈的、标题显眼的内容。很多早期笔记、旧想法、曾经重要但后来被淹没的判断，会在复盘时消失。

插件应该帮助用户重新找回这些内容。

---

### 1.2 连接断裂

用户可能写过很多相关笔记，但这些笔记分布在不同文件夹、不同时间、不同上下文中。单篇笔记看起来只是碎片，放在一起才可能形成一条主题线索。

插件应该帮助用户看到：

- 哪些笔记反复围绕同一个问题展开；
- 哪些旧笔记在后来被重新激活；
- 哪些跨文件夹内容形成了隐含主题；
- 哪些看似无关的笔记之间存在微妙关系。

---

### 1.3 不信任自动总结

大模型可以直接总结笔记，但用户会怀疑：

- 它到底看了哪些笔记；
- 哪些结论有证据；
- 哪些主题是模型编出来的；
- 为什么这些笔记被放在一起；
- 下次再问是否会得到完全不同的答案。

插件应该用“证据包 + 主题假设 + 用户复核”来解决这个问题。

---

### 1.4 时间范围不固定

复盘不应该只发生在年底。用户可能想复盘：

- 一整年；
- 一个季度；
- 一个月；
- 一段项目周期；
- 一段情绪波动期；
- 一段研究或学习阶段。

因此产品主定义应从 **Annual Review** 扩展为 **Time Range Review**。Annual / Quarterly / Monthly 可以作为默认 preset，自定义时间范围应该是一等能力。

---

## 2. 新产品定义

建议在 README / SPEC 中统一使用下面的定义：

> **Obsidian Time Range Review** is an AI-assisted review plugin that helps you rediscover forgotten notes, uncover hidden themes across a selected time range, and generate evidence-backed Markdown review reports inside your vault.

中文定义：

> **Obsidian Time Range Review** 是一个 AI 辅助的时间范围复盘插件。它帮助用户在指定时间范围内找回被遗忘的关键笔记，发现笔记之间的隐藏主题关系，并在 Obsidian 中生成有证据、有来源、可复核的 Markdown 复盘报告。

这里的关键词是：

- Time Range Review
- AI-assisted
- Rediscover forgotten notes
- Hidden themes
- Evidence-backed
- User review
- Markdown report inside Obsidian

---

## 3. 和“一份完整 prompt”相比，插件的差异在哪里

必须承认：如果大模型能够读取整个 vault，一份强 prompt 也可以直接生成年度主题、代表笔记和总结报告。

所以插件的差异不能建立在“AI 会总结”上。插件真正的差异在于：

| 维度          | 完整 prompt                | 插件                                                           |
| ------------- | -------------------------- | -------------------------------------------------------------- |
| 输入          | 通常直接把大量笔记交给模型 | 先根据时间范围、链接、标题、路径、重复概念、本地信号编译证据包 |
| 范围控制      | 容易混入范围外内容         | 所有分析绑定 ReviewSession 的 start/end                        |
| 证据          | 模型可能只给结论           | 每条主题假设绑定证据笔记、来源路径和连接解释                   |
| 用户控制      | 主要靠追问                 | 用户可以接受、改名、合并、忽略、查看证据                       |
| 复现性        | 每次对话可能漂移           | 复盘 session、证据包、用户决策可以保存在 vault 中              |
| Obsidian 体验 | 跳转、修改、写回都麻烦     | 可以直接打开源笔记、写入 Markdown 报告、保护用户手写区         |
| 隐私与成本    | 可能全量发送笔记           | 可以只发送受控摘录和证据包                                     |
| 长期价值      | 结果容易散落在聊天记录     | 报告、证据和用户确认状态留在 vault 中                          |

因此插件不是要和大模型抢“总结能力”，而是要把大模型放进一个更可靠的复盘流程里：

```text
选择时间范围
→ 本地扫描与证据包编译
→ AI 提炼主题假设与连接解释
→ 用户复核
→ 生成可追溯报告
```

---

## 4. AI 的定位

AI 不应该被写成一个边缘增强功能。这个项目要形成 semantic theme analysis，AI 是核心能力。

更合适的定位是：

> AI is a core analysis layer, but it is constrained by evidence packages and user review.

也就是说，AI 负责：

- 从证据笔记中提炼主题假设；
- 给主题命名；
- 解释多篇笔记之间的关系；
- 发现用户可能忽略的微妙连接；
- 帮助生成复盘报告的叙事草稿。

插件负责：

- 控制时间范围；
- 编译证据包；
- 限制 AI 输入；
- 展示证据来源；
- 保存用户确认状态；
- 写回 Obsidian 报告；
- 防止报告变成不可复核的漂亮总结。

README 中可以强调：

- AI 是核心分析层；
- 用户需要明确选择 provider / key / local CLI；
- 发送给 AI 的内容应该可预览；
- 主题结论必须绑定证据笔记；
- 用户确认后才进入最终报告。

不建议把 AI 表达成“默认不联网、默认不用 AI、AI 可选润色”这种过弱定位，因为这会削弱项目真正的产品价值。

---

## 5. 图表的定位

当前已有图表是合理的，应该保留。

图表不是产品主价值，但它们是复盘中的 **活动证据层**。它们可以帮助用户理解：

- 哪些月份写作或思考更密集；
- 哪些时间段出现主题爆发；
- 哪些阶段存在断档；
- 某些主题是否和写作节律、项目周期、生活阶段有关。

因此报告不需要把图表全部放到附录。更合适的结构是：

```text
1. Review Range
2. Activity Evidence / 写作与活动证据图表
3. Confirmed Theme Hypotheses
4. Evidence Notes and Hidden Connections
5. User Reflection
6. Data Methodology
```

图表可以保留在正文早期位置，但它们不能抢走主题复盘的主线。图表应该服务于主题解释，而不是让产品退回“年度统计仪表盘”。

---

## 6. 当前仓库仍需要修正的关键断点

### 6.1 Time Range 概念和 year-only 代码仍未完全对齐

产品已经转向 Annual / Quarterly / Monthly / Custom Range，但代码和 UI 中仍可能存在 `selectedYear`、`previewYear`、annual-only 输出路径等残留。

需要统一成 `ReviewSession`：

```text
ReviewSession {
  type: annual | quarterly | monthly | custom
  startDate
  endDate
  label
  outputPath or outputLabel
}
```

所有扫描、AI、Review Board、报告生成都应消费 `ReviewSession`。

---

### 6.2 Review Board 的候选对象还需要彻底转成主题假设

Review Board 不应该审核 tag、topic、task、project、单篇 note title。

它应该只审核一种对象：

```text
Theme Hypothesis
```

每条主题假设应包含：

- 标题；
- 一句话解释；
- 代表证据笔记；
- 多篇笔记之间的连接解释；
- 本地信号；
- AI 信号；
- 不确定性；
- 用户操作状态。

---

### 6.3 AI semantic themes 和 Review Board 状态需要打通

真实生成报告中，AI 提炼出的内容主线已经比较接近目标形态。但已确认主题假设部分仍可能像单篇笔记候选列表。

接下来需要让 Review Board 审核的对象直接来自 AI + evidence package 生成的 semantic themes，而不是来自旧 topic evolution 或 note candidate。

---

### 6.4 报告生成需要保护用户手写区

报告可以重新生成，但用户手写反思区不能被覆盖。

必须有明确 marker，例如：

```md
<!-- time-range-review:generated:start -->
<!-- time-range-review:generated:end -->

<!-- time-range-review:user-reflection:start -->
<!-- time-range-review:user-reflection:end -->
```

并增加测试：

```text
已有报告包含用户手写内容
重新生成报告
机器生成区被替换
用户手写区保持不变
```

---

### 6.5 文档仍然偏多

文档方向已经对齐，但数量仍然偏多。建议保留主文档，其他转入 `docs/archive/`，避免后续 agent 被多个历史 spec 干扰。

建议保留：

```text
README.md
README.en.md
docs/product-specification.md
docs/data-methodology.md
docs/prompt-vs-plugin-benchmark.md
docs/roadmap.md
docs/release-checklist.md
```

建议归档：

```text
docs/feature-inventory.md
docs/feature-scope.md
docs/review-board-spec.md
docs/review-board-alignment-decisions.md
docs/ai-report-design.md
docs/scoring-method.md
docs/agent-installation.md
docs/github-release-draft.md
docs/pivot/older drafts
docs/research/
```

---

## 7. 最终压缩后的 3 个 Issue

下面是建议交给 agent 的最终 issue 结构。它把原本的 5 个 issue 压缩成 3 个：

```text
第一批并行：
Issue 1：Product Definition and Docs Alignment
Issue 2：Engineering Hygiene, Test Structure, and Docs Archive

第二批串行：
Issue 3：Implement Time Range Review Core Loop
```

---

# Issue 1：Product Definition and Docs Alignment

## Goal

Unify the project definition, README, and product docs around **AI-assisted Time Range Review**.

The project should be presented as a plugin that helps users rediscover forgotten notes, uncover hidden themes, review AI-generated theme hypotheses with evidence, and generate evidence-backed Markdown reports for annual, quarterly, monthly, or custom time ranges.

## Background

The project has shifted from an annual report generator to a Time Range Review tool.

The core user pains are:

1. Users forget older notes during review.
2. Users cannot easily see hidden connections across scattered notes.
3. Users do not fully trust one-shot AI summaries.
4. Users need review ranges beyond one year.

AI should be described as a core analysis layer, not a minor optional beautifier. Charts should be retained as activity evidence, not removed.

## Scope

Update documentation and product language only.

Do not implement major code changes in this issue unless they are small naming or metadata updates.

## Files to inspect and update

- `README.md`
- `README.en.md`
- `docs/product-specification.md`
- `docs/data-methodology.md`
- `docs/prompt-vs-plugin-benchmark.md`
- `docs/roadmap.md`
- `manifest.json`
- `package.json`

## Required changes

### 1. Product definition

Use a definition close to:

```text
Obsidian Time Range Review is an AI-assisted review plugin that helps users rediscover forgotten notes, uncover hidden themes across a selected time range, and generate evidence-backed Markdown review reports inside their vault.
```

### 2. Core pain points

README should clearly explain:

- Forgotten notes;
- Broken connections between scattered notes;
- Lack of trust in one-shot AI summaries;
- Need for annual / quarterly / monthly / custom review ranges.

### 3. AI positioning

Make AI a core analysis layer.

Clarify that:

- AI generates semantic theme hypotheses from evidence packages;
- AI explains subtle connections between notes;
- AI output must be tied to source notes and user review;
- Users choose the provider or local CLI path explicitly;
- The plugin should avoid uncontrolled full-vault summarization.

Avoid language that makes AI sound like a minor optional polishing feature.

### 4. Chart positioning

Charts should remain in the review report as activity evidence.

Clarify that charts help users understand:

- activity rhythm;
- writing bursts;
- dormant periods;
- context for theme formation.

Charts should support the review, not dominate the product identity.

### 5. Remove or downgrade off-scope concepts

Project / task / action / archive should not be described as MVP core objects.

They can be mentioned as future possibilities only if necessary.

### 6. Prompt-vs-Plugin comparison

README should include a TODO or benchmark section:

```md
## TODO: Prompt-vs-Plugin Benchmark

After the core product loop is complete, compare this plugin against a strong prompt that asks an LLM to read the same vault and summarize the review themes.

The benchmark should compare:

- missed important notes;
- evidence accuracy;
- theme stability;
- user reviewability;
- Obsidian navigation;
- privacy and context control;
- regeneration consistency.
```

## Deliverables

- Updated README and English README.
- Updated product specification.
- Updated roadmap.
- Updated package / manifest description if needed.
- A clear TODO section for the prompt-vs-plugin benchmark.
- No references to project/task/action/archive as MVP core workflow.

## Acceptance criteria

- A new user can understand within 30 seconds:
  - what the plugin does;
  - why it is different from a one-shot LLM prompt;
  - why AI is central but evidence-constrained;
  - which review ranges are supported.
- README, SPEC, and roadmap use the same product definition.
- The docs no longer present the product as a generic annual report generator.
- Charts are retained as activity evidence.
- AI is described as a core analysis layer.

## Parallelization

This issue can run in parallel with Issue 2.

---

# Issue 2：Engineering Hygiene, Test Structure, and Docs Archive

## Goal

Improve maintainability before the core implementation work. Reduce future agent confusion by formatting code, splitting tests, and archiving redundant docs.

## Background

The project has many docs from previous product directions. The codebase also contains some formatting and test-structure issues that make review harder. Since future work will be done by agents, the repository should be easier to patch, diff, and test.

## Scope

This issue should focus on repository hygiene, test structure, and documentation organization.

Avoid major product logic changes.

## Files and folders to inspect

- `src/`
- `tests/`
- `.github/workflows/`
- `docs/`
- `package.json`
- `prettier.config.*`
- `eslint.config.*`
- `tsconfig.json`

## Required changes

### 1. Formatting

Run Prettier / formatter across:

- TypeScript files;
- Markdown files;
- JSON files;
- YAML files.

Large one-line files should be reformatted into reviewable diffs.

### 2. Test structure

Split large tests into smaller focused specs where reasonable.

Suggested structure:

```text
tests/reviewSession.spec.ts
tests/themeEvidence.spec.ts
tests/reviewBoard.spec.ts
tests/reportWriter.spec.ts
tests/timeRangeScope.spec.ts
tests/promptVsPluginFixture.spec.ts
```

If full split is too large, at least create the first three most important files:

```text
reviewSession.spec.ts
themeEvidence.spec.ts
reportWriter.spec.ts
```

### 3. Critical tests to add or prepare

Add tests for:

```text
custom range excludes out-of-range notes
AI/evidence package excludes out-of-range notes
report regeneration preserves user reflection section
```

If implementation is not ready, add TODO tests or skipped tests with clear descriptions.

### 4. Docs archive

Keep canonical docs:

```text
README.md
README.en.md
docs/product-specification.md
docs/data-methodology.md
docs/prompt-vs-plugin-benchmark.md
docs/roadmap.md
docs/release-checklist.md
```

Move older or overlapping docs into:

```text
docs/archive/
```

Candidate files:

```text
docs/feature-inventory.md
docs/feature-scope.md
docs/review-board-spec.md
docs/review-board-alignment-decisions.md
docs/ai-report-design.md
docs/scoring-method.md
docs/agent-installation.md
docs/github-release-draft.md
```

Do not delete them unless clearly obsolete. Archive first.

### 5. CI sanity

Ensure CI still runs:

```text
npm test
npm run typecheck
npm run build
npm run lint
```

If a command does not exist, document the actual available command.

## Deliverables

- Formatted repository.
- Split or partially split tests.
- Added or prepared critical tests.
- `docs/archive/` created with older docs moved there.
- Updated docs index if one exists.
- CI passes or known failures are documented.

## Acceptance criteria

- Code diffs are readable.
- Tests are easier to navigate.
- Future agents are less likely to use outdated docs.
- Core docs are easy to identify.
- No major product behavior changes are introduced in this issue.

## Parallelization

This issue can run in parallel with Issue 1.

---

# Issue 3：Implement Time Range Review Core Loop

## Goal

Implement the core product loop:

```text
ReviewSession
→ Evidence Package
→ AI Theme Hypothesis
→ Theme Review Board
→ Confirmed Markdown Report
```

This issue replaces the older annual-only / topic-only / note-candidate workflow with a unified Time Range Review workflow.

## Background

The product is now defined as an AI-assisted Time Range Review plugin.

The Review Board should not present project, task, archive, action, or raw tag/topic candidates as core MVP objects. It should present semantic theme hypotheses backed by evidence notes.

AI is central to theme analysis, but it must operate on a controlled evidence package and produce reviewable outputs tied to source notes.

Charts should remain in the report as activity evidence.

## Scope

This is the main implementation issue. It may touch core logic, Obsidian UI, AI context generation, review state, rendering, tests, and fixture outputs.

Because it is large, it must be implemented in phases. Do not skip phases.

---

## Phase 1：Unify ReviewSession

### Required changes

All generation, preview, AI, Review Board, and report paths should be driven by a `ReviewSession`.

A session should support:

```text
annual
quarterly
monthly
custom
```

It should contain:

```text
type
startDate
endDate
label
outputPath or outputLabel
```

### Inspect and update

- `src/core/reviewSession.ts`
- `src/obsidian/yearModal.ts`
- `src/obsidian/dashboardView.ts`
- `src/main.ts`
- `src/core/ai.ts`
- related command registration files

### Requirements

- Add Monthly option if missing from UI.
- Reduce or remove `selectedYear` / `previewYear` as the main workflow contract.
- Annual should be a preset, not the only mental model.
- AI context and evidence package must use session start/end.
- Custom range must not include notes outside the selected range.

### Acceptance criteria

- Annual, Quarterly, Monthly, and Custom can be represented as sessions.
- The UI can initiate at least Annual, Quarterly, Monthly, and Custom reviews.
- Core evidence and AI filtering respect session boundaries.
- Tests cover at least one custom range case.

---

## Phase 2：Build Evidence Package

### Required changes

Build an evidence package for the selected ReviewSession.

The evidence package should combine local signals such as:

- note title;
- path;
- created / modified time;
- backlinks;
- outlinks;
- shared links;
- repeated phrases;
- questions;
- entities;
- headings;
- folders;
- weak tags;
- activity bursts.

Tags can be used as weak signals, but they should not directly become themes.

### Inspect and update

- `src/core/themeEvidence.ts`
- `src/core/extract.ts`
- `src/core/aggregate.ts`
- `src/core/topics.ts`
- `src/core/types.ts`

### Acceptance criteria

Each evidence item should expose:

```text
sourcePath
title
date signals
short excerpt or summary
localSignals
related notes
why it is included
```

---

## Phase 3：Generate AI Theme Hypotheses

### Required changes

Use the evidence package to generate semantic theme hypotheses.

Each theme hypothesis should contain:

```text
id
title
summary
connectionExplanation
evidenceNotes
sourcePaths
localSignals
aiSignals
uncertainty
```

AI should not receive uncontrolled full-vault context by default. It should receive the evidence package or a previewable subset.

### Inspect and update

- `src/core/ai.ts`
- `src/core/themeEvidence.ts`
- AI provider settings
- prompt construction logic

### Requirements

- AI should explain why notes belong together.
- AI should identify subtle relationships, not just summarize individual notes.
- Each theme must cite source notes.
- Low-confidence themes should be marked as uncertain.

### Acceptance criteria

- Generated theme hypotheses are semantic themes, not raw tags or note titles.
- Each theme has evidence notes and connection explanation.
- AI input can be inspected or logged in development mode without exposing secrets.
- No range-outside notes are included in AI evidence for custom range.

---

## Phase 4：Simplify Review Board

### Required changes

Review Board should present only `Theme Hypothesis` cards.

Each card should support:

```text
accept
rename
merge
ignore
view evidence
open source note
regenerate explanation if AI provider is available
```

Remove or hide MVP UI for:

```text
project candidate
task candidate
archive
next action
raw tag topic
single note title as theme
```

### Inspect and update

- `src/core/reviewState.ts`
- `src/core/reviewCandidates.ts`
- `src/obsidian/reviewDetail.ts`
- `src/obsidian/reviewSelection.ts`
- `src/obsidian/dashboardView.ts`
- related CSS / styles

### Acceptance criteria

- Board displays semantic theme cards.
- User can accept, rename, merge, ignore.
- User can inspect evidence notes for each theme.
- Source note links open in Obsidian.
- Old project/task/action/archive concepts are not part of the MVP board.

---

## Phase 5：Generate Confirmed Report

### Required changes

Report should consume confirmed theme decisions.

Recommended report structure:

```text
# Review Report: <range label>

## Review Range

## Activity Evidence
- cumulative growth chart
- monthly/new notes chart if relevant
- activity heatmap or active days chart
- short interpretation of rhythm and bursts

## Confirmed Theme Hypotheses
For each confirmed theme:
- theme title
- user-renamed title if applicable
- summary
- evidence notes
- connection explanation
- uncertainty if any

## Rediscovered Notes
Notes surfaced because they were forgotten, old, or unexpectedly connected.

## Hidden Connections
Cross-note or cross-folder relationships worth revisiting.

## User Reflection
Protected user-written area.

## Data Methodology
Explain date range, source files, AI use, local signals, limitations.
```

### Report protection

Use explicit markers:

```md
<!-- time-range-review:generated:start -->
<!-- time-range-review:generated:end -->

<!-- time-range-review:user-reflection:start -->
<!-- time-range-review:user-reflection:end -->
```

Regeneration must update only generated sections and preserve user reflection.

### Inspect and update

- `src/core/render.ts`
- `src/obsidian/reportWriter.ts`
- tests fixture reports
- chart asset generation if applicable

### Acceptance criteria

- Charts remain in the report as activity evidence.
- Confirmed themes are the center of the report.
- User reflection survives regeneration.
- Report includes evidence links.
- Report includes data methodology.
- Report does not present AI conclusions without source notes.

---

## Phase 6：Smoke test with real vault fixture

### Required smoke vault

Use the existing fixture vault:

```text
/Users/hong/code/Obsidian-Annual/tests/fixtures/obsidian-smoke-vault
```

If Obsidian CLI is available locally, use it to open or run the plugin against this vault.

If CLI is not available, document the fallback manual verification steps.

### Required verification

Generate at least:

```text
1 annual review
1 quarterly or custom range review
```

The generated report should be inspected for:

- correct time range;
- charts present;
- semantic theme hypotheses present;
- evidence notes linked;
- no project/task/action/archive MVP clutter;
- AI output tied to evidence notes;
- user reflection section preserved after regeneration;
- source note links working in Obsidian.

### Deliverables from this phase

- Updated fixture report if expected.
- Short PR note describing:
  - which vault was used;
  - which review ranges were generated;
  - where the generated report is located;
  - whether Obsidian CLI was used;
  - any manual verification steps.
- Screenshots are optional but helpful.

---

## Phase 7：Tests

Add or update tests for:

```text
ReviewSession annual / quarterly / monthly / custom
custom range filtering
evidence package generation
AI evidence context range filtering
theme hypothesis shape
review state accept / rename / merge / ignore
report regeneration preserving user reflection
fixture report generation
```

## Final deliverables

- Unified ReviewSession workflow.
- Evidence package builder connected to session range.
- AI theme hypothesis generation connected to evidence package.
- Review Board showing semantic theme cards only.
- Confirmed report generated from accepted themes.
- Charts retained as activity evidence.
- User reflection protected.
- Smoke test using `/Users/hong/code/Obsidian-Annual/tests/fixtures/obsidian-smoke-vault`.
- Tests updated.

## Acceptance criteria

- The product can be used for annual, quarterly, monthly, and custom review ranges.
- The core UI no longer feels like a year-only annual report generator.
- The Review Board does not use raw tags or note titles as final theme candidates.
- AI generates evidence-backed semantic themes.
- The final report clearly differs from a one-shot LLM prompt because it contains review state, evidence links, source-note navigation, and regeneration protection.
- The smoke vault can produce a real report demonstrating the product loop.

## Execution requirement

This issue must be implemented in order:

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

After each phase, run available tests and write a short progress note in the PR description.

Do not skip directly to report rendering before ReviewSession and Theme Hypothesis are implemented.

---

## 8. Recommended execution order

If there are two agents:

```text
Agent A → Issue 1
Agent B → Issue 2

After both finish:
Agent A or B → Issue 3
```

If there is only one agent:

```text
Issue 1
→ Issue 2
→ Issue 3
```

If speed matters more than clean separation:

```text
Issue 1 and Issue 2 can be started together.
Issue 3 should wait until the product language and repo hygiene are stable.
```

---

## 9. Do not add these features yet

To keep the product aligned with its first principles, do not add the following as MVP features:

```text
project management
task review
next action planning
archive workflow
GTD workflow
generic dashboard builder
large chart library expansion
full-vault unrestricted AI summarization
```

These features can come later only if they strengthen the core loop:

```text
time range
→ evidence notes
→ AI theme hypothesis
→ user review
→ evidence-backed report
```

---

## 10. Final recommendation

The project is now worth continuing, but the next step should not be adding more features.

The next step is to make one narrow loop excellent:

```text
Choose a time range.
Find evidence notes.
Use AI to propose hidden themes.
Let the user confirm or correct them.
Generate a report with charts, evidence links, and protected reflection.
```

If this loop works well on the smoke vault, the plugin has a real product identity.

If this loop does not work, more charts, more settings, or more report sections will only make the project harder to understand.
