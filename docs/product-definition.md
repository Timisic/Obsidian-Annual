# Product Definition: Time Range Review

## 一句话定位

Obsidian Time Range Review is an AI-assisted review plugin that helps users rediscover forgotten notes, uncover hidden themes across a selected time range, and generate evidence-backed Markdown review reports inside their vault.

它是 Obsidian 的本地优先、证据约束 **Time Range Review / 时间范围主题复盘** 插件。
它帮助用户在 Annual、Quarterly、Monthly 或 Custom Range 中找回被遗忘的关键笔记，
由 AI 基于受控证据包生成可复核的 Theme Hypotheses / 主题假设，
解释支撑这些主题的 Evidence Notes / 证据笔记之间的细微关系，
并在用户确认后输出可追溯、可编辑、可重复生成的叙事型 Markdown 复盘报告。

## 定位转换

旧定位容易被理解为“年度复盘工作流”或“年报生成器”：扫描一年的 vault、生成候选项、做行动决定、输出年报。

新定位是“时间范围主题复盘插件”：

- 时间范围可以是 Annual、Quarterly、Monthly 或 Custom Range。
- 核心输出不是自动总结，而是用户复核后的主题主线和证据。
- AI 是核心分析层，用于基于证据包生成语义主题假设和关系解释，不是替用户下结论。
- Review Board 只把 Theme Hypothesis 当作需要用户复核的假设。
- Markdown 报告把用户确认后的主题写成段落式复盘叙事，并保留代表证据、活动证据图表、留给自己的问题和个人补充。

## 第一性原理

1. 遗忘优先：复盘首先要把被时间淹没但仍有价值的笔记带回用户眼前。
2. 连接优先：插件要帮助用户看见跨笔记、跨文件夹、跨月份的隐藏关系。
3. 证据优先：每个主题假设都必须能回到 Evidence Notes、摘录、链接和时间信号。
4. AI 受控优先：用户显式选择 provider 或 local CLI path，AI 只处理有限证据包，避免不受控的全 vault 总结。
5. 用户判断优先：Theme Hypothesis 是待复核假设；最终主题名称、价值判断和报告内容由用户确认。
6. 图表证据优先：图表说明 activity rhythm、writing bursts、dormant periods 和主题形成背景，不替代主题复核。
7. 叙事报告优先：默认报告服务于未来重读和理解，不是 Review Board 的完整审计导出。
8. 本地与可回滚优先：默认无网络；不覆盖用户编辑；生成内容可备份、可 diff、可复核。

## 核心用户痛点

### 遗忘

用户在一年、一个季度、一个月或一段自定义时间里写了很多笔记。
复盘时，用户通常只记得最近的、情绪最强的、标题最显眼的内容。

插件需要从时间范围内找出代表笔记、重新出现的旧笔记、被后续笔记引用或呼应的内容，
把被时间淹没但仍然和主题有关的笔记重新带回用户眼前。

### 连接断裂

用户知道自己写过很多东西，但很难看出笔记之间的真实关系。
双链、标签和文件夹只能捕获显式连接，大量关系需要从重复表达、相似问题、时间分布和上下文中推断。

插件需要把 Evidence Notes 组织成 Evidence Clusters，
并让 AI 或本地规则把这些证据簇提炼成可复核的 Theme Hypotheses。

### 不信任自动总结

大模型可以写出漂亮总结，但用户很难判断它看了什么、漏了什么、有没有编造关系。

插件需要让每条主题假设都绑定证据笔记、连接解释和不确定性说明。
用户必须能接受、改名、合并或忽略；Review Board 保留完整复核材料，最终报告只把用户确认后的主题写成可读叙事。

### 复盘范围不止一年

用户需要 Annual、Quarterly、Monthly 和 Custom Range，而不是固定年度报告。
同一套证据编译、主题假设、Review Board 和 Markdown 报告闭环必须适配任意明确时间范围。

## 产品闭环

```text
选择时间范围
  -> 编译证据笔记
  -> 聚合证据簇
  -> 生成主题假设
  -> Review Board 用户复核
  -> 写入确认后的 Markdown 复盘报告
```

用户完成一次复盘后，应获得：

- 默认 3-5 个用户确认后的强主题主线；短月度或自定义范围可以更少，但不应硬凑弱主题。
- 每个主题的段落式叙事、2-4 条带 alias 的代表 Evidence Note 链接，以及必要的不确定性表达。
- 值得重读的关键旧笔记，而不是自动任务建议。
- 活动节奏、写作爆发、沉寂阶段和主题形成背景的图表证据。
- 留给自己的反思问题，而不是 action items。
- 极短方法说明：时间范围、证据来源、AI 使用边界和主题需用户确认。
- 一份可继续编辑、可重新生成、可 diff 的 Markdown 复盘报告。

## 核心对象

| 对象                        | 定义                                                                          | MVP 角色 |
| --------------------------- | ----------------------------------------------------------------------------- | -------- |
| Review Session              | 一次复盘的时间范围、扫描范围、隐私设置、AI 设置、状态和报告路径。             | 核心     |
| Evidence Note               | 进入证据包的源笔记，带路径、标题、日期信号、摘录、链接和上下文。              | 核心     |
| Evidence Cluster            | 一组可能相关、共同支撑同一条主题主线的证据笔记。                              | 核心     |
| Theme Hypothesis / 主题假设 | 基于证据簇提出的主题解释。它需要用户复核，不能直接当作结论。                  | 核心     |
| Theme Decision              | 用户对主题假设的接受、改名、合并或忽略。                                      | 核心     |
| Review Report               | 保存在 vault 内的叙事型 Markdown 复盘报告，只写入用户确认后的主题和代表证据。 | 核心     |

项目线索、任务线索、行动项和归档判断是后续可能扩展的复盘辅助能力。
它们不属于当前 MVP 的核心对象，也不应出现在 README 首屏承诺中。

## AI 与插件的分工

AI 是核心分析层，可以：

- 基于受控 Evidence Package 提出 semantic Theme Hypotheses。
- 解释 Evidence Notes 之间细微但可追溯的关系。
- 标注不确定性、遗漏风险和需要用户重点复核的证据。
- 在用户确认后把成立的主题组织成段落式复盘叙事。

插件必须：

- 本地扫描 vault 并编译 Evidence Notes。
- 控制时间范围、include/exclude、隐私边界、provider 或 local CLI path 上下文。
- 在 Review Board 中呈现证据、解释和用户决策。
- 保存 Review Session、Theme Decision 和报告写入状态。
- 保护用户手写内容，支持重新生成和 diff。

AI 不应该：

- 默认读取完整 vault 或进行不受控全 vault 总结。
- 默认访问网络。
- 把未经复核的主题假设写成用户结论。
- 替用户做价值判断、取舍或最终命名。
- 把完整本地信号、合并来源、隐藏连接和所有证据笔记默认塞进 Review Report 正文或普通附录。

## 插件与完整提示词的差异

| 维度          | 完整提示词                     | 插件                                                     |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| 输入          | 直接读取大量笔记或整个 vault。 | 先本地扫描，再编译受控证据包。                           |
| 输出          | 一次性总结。                   | 主题假设、证据笔记、用户决策和最终报告。                 |
| 证据          | 依赖模型引用，容易漂移。       | 每条主题绑定 Obsidian 源笔记、摘录和连接解释。           |
| 用户控制      | 主要靠追问。                   | 接受、改名、合并、忽略、查看证据。                       |
| 复现性        | 每次回答可能不同。             | Review Session、snapshot、decision state 可保存。        |
| 隐私          | 常常需要大范围发送内容。       | 可限制范围、摘录、排除目录、provider 和 local CLI path。 |
| Obsidian 体验 | 需要手动跳转和核查。           | 直接打开源笔记，保留 Markdown 报告。                     |

插件不需要在“文字漂亮程度”上胜过大模型。
插件必须在可复核、可控制、可复现、可留存上胜出。

## 信任边界

插件可以：

- 扫描当前 vault 内允许范围的 Markdown。
- 编译 Evidence Notes 和 Evidence Clusters。
- 使用本地规则或用户显式启用的 AI 生成 Theme Hypotheses。
- 帮用户在 Review Board 中复核、改名、合并或忽略主题假设。
- 把用户确认后的内容写入 Markdown 复盘报告。
- 把完整证据和本地信号留在 Review Board 或显式审计导出中。

插件不应该：

- 默认访问网络。
- 默认调用外部 AI。
- 读取 vault 外部文件。
- 把自动判断伪装成用户结论。
- 覆盖用户手写报告内容。
- 把图表、多 provider、项目线索或行动项放在主题复盘闭环之前。

## 成功标准

- README 首屏 10 秒内能说明插件解决遗忘、连接断裂、不信任一次性 AI 总结和复盘范围不止一年四个痛点。
- 用户能创建 Annual / Quarterly / Monthly / Custom Range Review Session。
- 每个 Theme Hypothesis 都有 Evidence Notes、连接解释和不确定性说明。
- 文档明确 Theme Hypothesis / 主题假设需要用户复核。
- 复盘报告以主题优先的段落式叙事呈现用户确认内容，保留活动证据图表、代表证据链接、值得重读的笔记、留给自己的问题和用户手写区。
- 默认模式无网络请求。
- 重新生成不会抹掉用户手写内容。
