# Obsidian Review：产品转向与执行计划

> 工作名建议：**Obsidian Review** 或 **Annual Review**  
> 产品实质：**时间范围复盘插件**  
> 默认 preset：Annual Review、Quarterly Review、Monthly Review、自定义日期范围  
> 核心价值：帮助用户找回被遗忘的笔记，发现跨笔记的隐藏主题关系，并把 AI 生成的洞察变成可复核、可确认、可留存的 Obsidian 工件。

---

## 1. 一句话定义

**Obsidian Review 帮助用户在任意时间范围内，从分散笔记中找回被遗忘的关键内容，生成可复核的主题假设，展示支撑这些主题的证据笔记和连接解释，并在用户确认后输出可追溯的 Markdown 复盘报告。**

更适合 README 首屏的版本：

> Rediscover forgotten notes and review the hidden themes that connected a period of your life.  
> Local-first. Evidence-backed. Confirmed by you.

中文版本：

> 找回被遗忘的笔记，复核一段时间里真正连接你的隐藏主题。

---

## 2. 产品解决的核心痛点

### 痛点一：遗忘

用户一年、一个季度，或一段自定义时间内写了很多笔记。到复盘时，用户通常只记得最近的、情绪最强的、标题最显眼的内容。

插件的解决方式：

- 从时间范围内找出代表笔记。
- 找出旧笔记在当前时间范围内重新出现的痕迹。
- 找出被后续笔记引用、改写、补充或呼应的内容。
- 把被时间淹没但仍然和主题有关的笔记重新带回用户眼前。

### 痛点二：连接断裂

用户知道自己写过很多东西，但很难看出这些笔记之间的关系。双链可以捕获一部分显式连接，但大量真实关系并没有被用户手动链接。

插件的解决方式：

- 把笔记组织成主题证据簇。
- 识别跨文件夹、跨月份、跨概念的重复问题和相似表达。
- 让 AI 在受控证据包里提炼“主题假设”。
- 为每个主题解释：这些笔记为什么可能属于同一条思考线。

### 痛点三：不信任自动总结

大模型可以写出漂亮总结，但用户很难判断它看了什么、漏了什么、有没有编造关系。

插件的解决方式：

- 每条主题都绑定源笔记。
- 每条主题都展示代表证据和连接解释。
- 用户可以接受、改名、合并、忽略。
- 最终报告区分“AI 草稿”和“用户确认内容”。
- 重新生成时保留用户修改和确认状态。

### 痛点四：复盘范围不固定

用户并不只在年底复盘。真实使用场景包括：

- 年度复盘
- 季度复盘
- 月度复盘
- 一段关系结束后的复盘
- 一个项目结束后的复盘
- 一段高强度学习期、创作期或职业转折期的复盘

插件的解决方式：

- 把“年份”抽象成 `Review Session`。
- session 支持 `startDate`、`endDate`、preset、include/exclude 范围。
- Annual Review 和 Quarterly Review 作为默认入口保留。
- 报告文件命名根据范围生成，例如：
  - `Reviews/2026 Annual Review.md`
  - `Reviews/2026 Q1 Review.md`
  - `Reviews/2026-03-01 to 2026-04-15 Review.md`

---

## 3. 和“一份完整提示词”的差异

### 大模型可以吞掉的部分

如果大模型能读取完整 vault，一份强提示词可以完成很多事情：

- 总结年度主题。
- 提取代表笔记。
- 生成复盘报告。
- 给出下一步建议。
- 发现一部分语义关系。
- 把报告写得很顺。

因此，插件的价值不能停留在“把 vault 交给 AI，然后生成总结”。

### 插件需要形成的差异

插件的核心差异在于：**它把复盘变成一个有状态、有证据、有交互、有留存的过程。**

| 维度          | 完整提示词                   | 插件                                     |
| ------------- | ---------------------------- | ---------------------------------------- |
| 输入          | 直接读取大量笔记或整个 vault | 先本地编译证据包，再交给 AI 提炼         |
| 输出          | 一次性总结                   | 主题假设、证据笔记、用户决策、最终报告   |
| 证据          | 依赖模型自己引用，容易漂移   | 每条主题绑定 Obsidian 源笔记链接         |
| 用户控制      | 主要靠追问                   | 接受、改名、合并、忽略、查看证据         |
| 复现性        | 每次回答可能不同             | session、snapshot、decision state 可保存 |
| 隐私          | 常常需要大范围发送内容       | 可限制范围、摘录、排除目录和 provider    |
| Obsidian 体验 | 需要手动跳转和核查           | 直接打开源笔记、保留 Markdown 报告       |
| 长期价值      | 聊天记录容易消散             | 复盘状态和报告留在 vault 内              |

### 插件对 AI 的正确使用方式

插件不应该把 AI 当成“报告生成器”。更好的角色是：

> AI 是主题提炼器和关系解释器；插件是证据编译器、复盘界面、状态管理器和报告写入器。

建议流程：

```text
vault 原始笔记
  -> 本地扫描信号
  -> 候选证据池
  -> 主题证据簇
  -> AI 生成主题假设与连接解释
  -> 用户在 Review Board 中确认
  -> 写入可追溯 Markdown 报告
```

---

## 4. 新产品闭环

最小闭环建议压成 5 步：

```text
选择时间范围
  -> 编译证据
  -> 生成主题假设
  -> 用户复核主题卡片
  -> 输出确认后的复盘报告
```

### 4.1 选择时间范围

用户选择：

- Annual preset
- Quarterly preset
- Monthly preset
- Custom date range
- include folders
- exclude folders
- privacy mode
- AI provider，可选

### 4.2 编译证据

插件先本地扫描，生成证据包。证据包包括：

- 源笔记路径
- 标题
- 日期信号
- 摘录
- 链接关系
- 反链数量
- 出链关系
- 重复表达
- 主题词
- 文件夹上下文
- 修改时间和创建时间
- 被后续笔记重新引用的痕迹

### 4.3 生成主题假设

主题假设不等于 tag 统计。tags 只能作为弱信号。

每个主题假设应包含：

- 主题标题
- 一句话解释
- 代表笔记
- 连接解释
- 证据链接
- 不确定性说明
- 可选置信度或信号来源

建议命名：

- `Theme Hypothesis`
- `主题假设`
- `思考主线`
- `复盘主线`

### 4.4 Theme Review Board

Review Board 只服务一个对象：**主题假设卡片**。

每张卡片包含：

```text
主题假设：在智能加速中重建判断力

为什么出现：
你在 3-5 月多次写到 AI、Agent、理解边界、产品判断和职业焦虑。
这些笔记分布在不同文件夹，但反复围绕“工具变强后，人还需要什么判断力”展开。

代表笔记：
- 2026-04-04 懵逼同时有 AI 压力感
- 知识可以生成，意图只能发现
- Don't Delegate Understanding
- Mike Krieger 谈 AI 产品：构建更容易，判断更难

连接解释：
这些笔记共同形成一条线：执行能力被 AI 放大后，真正稀缺的东西转向意图、判断、验收和理解。

操作：
接受 / 改名 / 合并 / 忽略 / 查看证据 / 重新解释
```

### 4.5 生成复盘报告

报告只写入用户确认后的主题。

报告结构建议：

```markdown
# 2026 Q1 Review

## Review Range

2026-01-01 to 2026-03-31

## Confirmed Themes

### 1. 在智能加速中重建判断力

- Summary
- Evidence Notes
- Connection Explanation
- User Reflection

## Rediscovered Notes

被重新带回眼前的关键笔记。

## Methodology

本报告基于哪些路径、哪些信号、是否使用 AI、发送了哪些类型的上下文。

## User Notes

用户自由编辑区，不被重新生成覆盖。
```

---

## 5. 核心对象重新定义

| 对象               | 定义                                                  | 是否 MVP 核心 |
| ------------------ | ----------------------------------------------------- | ------------- |
| `Review Session`   | 一次复盘的时间范围、扫描范围、AI 设置、状态和输出路径 | 是            |
| `Evidence Note`    | 进入证据包的源笔记，带路径、摘录、链接和时间信号      | 是            |
| `Evidence Cluster` | 一组可能相关的证据笔记                                | 是            |
| `Theme Hypothesis` | AI 或本地规则基于证据簇提出的主题假设                 | 是            |
| `Theme Decision`   | 用户对主题的接受、改名、合并、忽略                    | 是            |
| `Review Report`    | 用户确认后的 Markdown 复盘报告                        | 是            |
| `Task`             | Markdown 任务或行动项                                 | 暂缓          |
| `Project`          | 项目线索                                              | 暂缓          |
| `Action Item`      | 下一步行动                                            | 暂缓          |
| `Archive`          | 归档判断                                              | 暂缓          |
| `Dashboard Chart`  | 图表统计                                              | 暂缓          |

---

## 6. 候选笔记如何被找到

候选笔记不应叫“高价值笔记”。更合适的叫法是：

> Evidence Notes：支撑某条主题假设的证据笔记。

### 第一层：本地确定性信号

先用本地信号生成候选池，目标是降低遗漏：

- 时间范围内新建或频繁修改的笔记。
- 被多次反链引用的笔记。
- 字数较长且有明确标题结构的笔记。
- 旧笔记在本次范围内被重新引用。
- 跨文件夹产生连接的笔记。
- 多次出现的关键词、问题句、实体名。
- daily / weekly / monthly notes 中反复出现的笔记或概念。

### 第二层：关系构图

构建轻量关系图，目标是找连接：

- note ↔ note：双链、反链、共同链接。
- note ↔ time：月份、活跃日、爆发期。
- note ↔ phrase：重复表达、相似问题。
- note ↔ entity：人名、工具名、概念名。
- note ↔ folder：生活、职业、AI、交易、关系等区域。

### 第三层：AI 主题提炼

AI 只读取证据包，目标是命名和解释：

- 主题标题。
- 主题一句话解释。
- 代表笔记。
- 这些笔记之间的关系。
- 哪些关系有不确定性。
- 哪些笔记可能需要用户重点复核。

---

## 7. 功能取舍

### 保留

- 自定义时间范围。
- Annual / Quarterly / Monthly preset。
- 本地扫描。
- 证据笔记。
- 主题假设。
- AI 主题提炼，可选。
- Theme Review Board。
- 接受、改名、合并、忽略。
- 源笔记跳转。
- 可追溯 Markdown 报告。
- 用户手写区保护。
- 数据口径说明。

### 暂缓

- project candidate。
- task candidate。
- Add to actions。
- Archive。
- 下一步行动项。
- dashboard 统计图。
- 分享导出。
- 多 provider 生态。
- 复杂权重调参 UI。

### 删除或隐藏

- 把 tags 直接当作 topic 的主流程。
- 把报告说成自动理解用户全年。
- 把图表、任务和行动项放在 MVP 首屏。
- 把 Review Board 做成多对象任务管理器。

---

## 8. README 中建议加入的 TODO：Prompt-vs-Plugin Benchmark

这个 TODO 很重要。它用于回答一个根本问题：

> 一份强提示词已经能让大模型读取全部笔记并总结主题，这个插件还能额外提供什么？

建议 README 增加：

```markdown
## TODO: Prompt-vs-Plugin Benchmark

在产品核心闭环完成后，用同一个测试 vault 做一次对比：

1. 让一个大模型直接读取所有允许范围内的笔记。
2. 使用一份完整提示词，让模型总结指定时间范围内的主题。
3. 使用 Annual Review 插件生成主题假设、证据卡片和确认后报告。
4. 对比两种方式在遗漏、证据、可复核性、Obsidian 跳转、复现性和用户控制上的差异。
```

### Benchmark Prompt 草案

```text
你是一个帮助我复盘 Obsidian vault 的严谨研究助理。

请读取我提供的所有 Markdown 笔记，并围绕指定时间范围做复盘：
- 时间范围：{startDate} 到 {endDate}
- 目标：找出这一段时间里反复出现、彼此连接、可能被我忽略的重要主题。
- 请不要只统计 tags。
- 请优先发现跨笔记、跨文件夹、跨时间的隐藏关系。
- 每个主题必须提供源笔记证据。
- 如果某个主题缺乏证据，请标注为低置信度。
- 请区分：你从笔记中看到的事实、你的推断、以及建议我继续复核的地方。

输出格式：
1. 3-7 个主题
2. 每个主题的一句话解释
3. 每个主题的代表笔记
4. 每个主题中笔记之间的连接解释
5. 被重新发现的关键旧笔记
6. 可能遗漏或不确定的地方
7. 一份最终复盘报告草稿
```

### 对比指标

| 指标                               | 直接提示词 | 插件                     |
| ---------------------------------- | ---------- | ------------------------ |
| 是否能打开源笔记复核               | 低         | 高                       |
| 是否保留用户确认状态               | 低         | 高                       |
| 是否能重生成且不覆盖用户手写内容   | 低         | 高                       |
| 是否能限制发送给 AI 的内容         | 中         | 高                       |
| 是否能复现同一轮复盘               | 中         | 高                       |
| 是否能稳定记录主题改名、合并、忽略 | 低         | 高                       |
| 是否能在 Obsidian 内形成长期工件   | 中         | 高                       |
| 是否能发现语义连接                 | 高         | 高，前提是 AI 提炼做得好 |

### Benchmark 成功标准

插件不需要在“文字漂亮程度”上赢过大模型。插件需要在这些方面赢：

- 更容易复核。
- 更少遗漏被时间淹没的证据笔记。
- 更清楚地解释主题和笔记的关系。
- 更稳定地保留用户确认状态。
- 更安全地控制 AI 输入范围。
- 更自然地留存在 Obsidian 工作流中。

---

## 9. 压缩后的 Agent Issue 清单

下面把 13 个 issue 压缩成 6 个。前三个属于方向层，可以并行或半并行；后三个属于产品核心层，需要串行。

### 执行顺序总览

```text
方向层，可并行：
  Issue 01 产品定义与 README/SPEC 重写
  Issue 02 功能收敛与术语清理
  Issue 03 Prompt-vs-Plugin Benchmark 文档

产品核心层，需要串行：
  Issue 04 Time Range Review Session
    -> Issue 05 Theme Evidence Compiler + AI Theme Hypothesis
      -> Issue 06 Theme Review Board + Confirmed Report
```

---

### Issue 01｜产品定义与 README/SPEC 重写

**执行关系**：方向层，可先做；Issue 02 和 Issue 03 可并行参考本 issue 的定义。

**目标**

把项目从“年度复盘工作流”收敛为“时间范围主题复盘插件”。Annual Review 作为默认 preset 保留。

**需要修改**

- `README.md`
- `README.en.md`
- `docs/product-definition.md`
- `docs/product-specification.md`
- `docs/roadmap.md`

**核心改动**

- 增加自定义时间范围。
- 强调三个核心痛点：遗忘、连接断裂、不信任自动总结。
- 把 `topic` 改成 `Theme Hypothesis` / `主题假设`。
- 把 `note candidate` 改成 `Evidence Note`。
- 明确 AI 的角色：主题提炼和关系解释。
- 明确插件和完整提示词的差异。
- 删除或降级 project、task、action、archive 的 MVP 表述。

**交付物**

- 新版 README 首屏文案。
- 新版 product definition。
- 新版 SPEC 的核心对象与流程。
- Roadmap 改成 Time Range Review 路线。

**验收标准**

- README 首屏能在 10 秒内说明项目解决什么痛点。
- 文档中不再把 task/project/action/archive 写成 MVP 核心对象。
- 文档明确 Annual / Quarterly / Monthly / Custom Range。
- 文档明确“主题假设需要用户复核”。

---

### Issue 02｜功能收敛与术语清理

**执行关系**：方向层，建议在 Issue 01 后执行；也可以由另一个 agent 并行列清单，等 Issue 01 合并后统一改。

**目标**

清理会让用户认知负担过高的对象和动作，让 MVP 只围绕“主题假设 + 证据笔记 + 用户确认 + 复盘报告”。

**需要检查**

- README 和 docs。
- Review Board 文案。
- candidate 类型定义。
- report renderer。
- test fixtures。
- command 名称和 UI labels。

**保留**

- Review Session。
- Evidence Note。
- Evidence Cluster。
- Theme Hypothesis。
- Theme Decision。
- Review Report。
- Accept / Rename / Merge / Ignore / Open Source Note。

**暂缓或隐藏**

- project candidate。
- task candidate。
- dormant-note 作为独立候选类型。
- bridge-note 作为独立候选类型。
- Add to actions。
- Archive。
- Annual highlights。
- 强任务化的 action section。

**交付物**

- 一份 `docs/feature-scope.md`。
- 被删除、暂缓、保留的功能表。
- 对应文档和测试 fixture 的术语更新 PR。

**验收标准**

- 用户流程中只需要理解一种卡片：Theme Hypothesis。
- tags 只作为弱信号，不再作为主题主路径。
- Review Board 不再像任务管理器。
- 报告不强制生成下一步行动项。

---

### Issue 03｜Prompt-vs-Plugin Benchmark 文档

**执行关系**：方向层，可与 Issue 01 并行。最终放入 README 的 TODO 或 `docs/benchmark.md`。

**目标**

建立一个对比实验，检验插件相对“一份完整提示词 + 大模型读取所有笔记”的真实差异。

**需要参考**

- Karpathy 的 LLM Wiki 思路：LLM 可以维护持久的 interlinked markdown wiki，插件需要承认这种能力。
- 当前 tests fixture 中的真实 review 报告。
- 一个固定测试 vault。

**交付物**

- `docs/prompt-vs-plugin-benchmark.md`
- README TODO 小节。
- Benchmark prompt。
- 对比指标表。
- 成功标准。
- 失败判断：如果插件只在文字生成上和 prompt 竞争，应判定产品方向失败。

**验收标准**

- 文档能清楚说明大模型可以吞掉哪些部分。
- 文档能说明插件保留的差异化：证据编译、状态、交互、Obsidian 跳转、复现、隐私范围控制。
- README 有一条明确 TODO：核心产品完成后执行该 benchmark。

---

### Issue 04｜Time Range Review Session

**执行关系**：产品核心层，串行第一步。依赖 Issue 01 的产品定义。

**目标**

把年份抽象成通用时间范围，让 Annual Review、Quarterly Review 和 Custom Review 共享同一套 session 模型。

**建议数据结构**

```ts
type ReviewPreset = "annual" | "quarterly" | "monthly" | "custom";

interface ReviewSession {
  id: string;
  preset: ReviewPreset;
  label: string;
  startDate: string;
  endDate: string;
  includeFolders: string[];
  excludeFolders: string[];
  excludePatterns: string[];
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**需要修改**

- 设置界面或命令入口。
- 现有年份选择逻辑。
- snapshot / index / report 路径。
- tests fixture 的范围命名。

**交付物**

- 支持 Annual preset。
- 支持 Quarterly preset。
- 支持 Custom date range。
- session state 可保存和重载。
- 报告路径根据 session label 生成。

**验收标准**

- 用户可以生成 2026 Annual Review。
- 用户可以生成 2026 Q1 Review。
- 用户可以生成任意日期范围 review。
- 旧 yearly 逻辑迁移后仍能工作。
- tests 覆盖 session range 过滤。

---

### Issue 05｜Theme Evidence Compiler + AI Theme Hypothesis

**执行关系**：产品核心层，串行第二步。依赖 Issue 04。

**目标**

建立插件的核心差异化：先用本地信号编译证据包，再让 AI 基于证据包生成主题假设和连接解释。

**本地证据信号**

- 时间范围内的新建、修改、活跃笔记。
- 反链和出链。
- 共同链接。
- 旧笔记在当前范围内的回流。
- 标题、路径、frontmatter、摘录。
- 重复短语、问题句、实体词。
- 跨文件夹连接。

**AI 输入限制**

AI 不读取整个 vault。AI 读取结构化证据包：

```json
{
  "reviewRange": "2026-01-01 to 2026-03-31",
  "evidenceNotes": [
    {
      "path": "...",
      "title": "...",
      "dateSignals": ["..."],
      "excerpt": "...",
      "links": ["..."],
      "whyIncluded": "..."
    }
  ]
}
```

**AI 输出**

```ts
interface ThemeHypothesis {
  id: string;
  title: string;
  summary: string;
  evidenceNoteIds: string[];
  connectionExplanation: string;
  uncertainty?: string;
  source: "local" | "ai" | "mixed";
}
```

**交付物**

- Evidence compiler。
- AI prompt template。
- AI response parser。
- 无 AI 时的 fallback：基于本地证据簇生成粗主题。
- tests 覆盖 evidence package 和 theme hypothesis。

**验收标准**

- 每个主题至少有 2 篇 evidence notes，除非明确标注低置信度。
- 每个主题都有 connection explanation。
- tags 只能作为弱信号。
- AI 输出必须能回到 evidence note IDs。
- 没有 AI key 时，插件仍能生成可审核的本地主题线索。

---

### Issue 06｜Theme Review Board + Confirmed Report

**执行关系**：产品核心层，串行第三步。依赖 Issue 05。可变形执行：先做 Markdown/fixture 版本，再做完整 UI。

**目标**

让用户审核主题假设，并把用户确认后的内容写入复盘报告。

**Review Board 最小动作**

- Accept。
- Rename。
- Merge。
- Ignore。
- Open source note。
- Ask AI to explain again，可选。

**报告只读取**

- accepted themes。
- renamed themes。
- merged theme decisions。
- evidence notes。
- user reflection blocks。
- methodology。

**报告不强制包含**

- task。
- project。
- action item。
- archive。
- annual highlights。

**交付物**

- Theme Review Board UI。
- decision state 保存和重载。
- report renderer。
- 用户手写区保护。
- 重新生成不覆盖用户编辑。
- tests fixture 更新。

**验收标准**

- 用户能完成 3-7 个主题卡片的审核。
- 用户能打开源笔记复核。
- 用户改名后的主题进入报告。
- ignored themes 不进入报告。
- merged themes 不重复进入报告。
- 重新生成保留用户手写区。
- 报告中每个主题都能回链证据笔记。

---

## 10. 对 agent 的执行建议

优先级建议：

1. 先跑 Issue 01 和 Issue 03。
2. Issue 02 在 Issue 01 合并后立刻清理。
3. 再进入 Issue 04。
4. Issue 05 是产品成败核心，应该给最多时间。
5. Issue 06 可以先做极简 UI 或 Markdown prototype，不要一开始追求漂亮界面。

关键提醒：

- 不要再扩展 task/project/action 方向。
- 不要把 tags 当主题生成主路径。
- 不要让 AI 直接读取整个 vault 作为默认路径。
- 不要把报告生成当成产品核心。
- 产品核心是：**证据编译 → 主题假设 → 用户复核 → 可追溯报告**。

---

## 11. 参考资料

- 当前项目仓库：<https://github.com/Timisic/Obsidian-Annual>
- 当前产品定义文档：<https://github.com/Timisic/Obsidian-Annual/blob/main/docs/product-definition.md>
- 当前 SPEC：<https://github.com/Timisic/Obsidian-Annual/blob/main/docs/product-specification.md>
- Karpathy LLM Wiki：<https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
