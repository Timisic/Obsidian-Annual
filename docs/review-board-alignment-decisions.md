# Review Board 对齐决策

状态：DEC-40 文档/README 对齐建议已采纳。

本文档记录 Review Board v1 被接受后，README/docs 已采用的需求、功能和定义对齐方向。它本身不扩大产品范围。

## 审计范围

已扫描：

- `README.md`
- `README.en.md`
- `docs/README.md`
- `docs/product-definition.md`
- `docs/product-specification.md`
- `docs/feature-inventory.md`
- `docs/roadmap.md`
- `docs/ai-report-design.md`
- `docs/agent-installation.md`
- `docs/research/project-research.md`
- `docs/writing-growth.config.example.json`

## 已采纳决策

| 领域                     | 原有措辞                                                                                                                   | Review Board v1 措辞                                                                                                   | 已采纳方向                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 候选项状态名称           | `docs/product-specification.md` 使用 `confirmed`；README 使用“确认”。                                                      | DEC-40 要求使用 `accepted`。                                                                                           | 内部状态和规格统一为 `accepted`；中文面向用户文案使用“接受”，必要时保留“人工确认/取舍”来表达用户判断。                                |
| 候选项类型集合           | 现有 SPEC 包含 `Annual Theme`、`Representative Note`、`Project Thread`、`Action Candidate`、`Dormant Asset` 和 `Anomaly`。 | DEC-40 要求使用 `topic`、`note`、`project`、`task`、`dormant-note` 和 `bridge-note`。                                  | 规格统一为 DEC-40 类型集合；`Anomaly` 降级为扫描信号；`Action Candidate` 合并进 `task` 或 `next-action` 状态。                        |
| Review Board 布局        | 现有 SPEC 建议左侧候选队列、中间证据/原因、右侧决策/报告预览。                                                             | DEC-40 要求左侧候选项列表、右侧证据/操作、底部进度。                                                                   | MVP 移除独立报告预览区，只保留左侧列表、右侧证据/操作、底部进度。                                                                     |
| 操作词汇                 | 现有文档使用 Continue、Merge、Archive、Drop、Convert to project、Revisit。                                                 | DEC-40 的操作是 accept、ignore、merge topic、rename topic、add to annual highlights、add to action、open source note。 | Review Board 按钮使用 DEC-40 操作集合；年报行动可用更具体的行动标签表达 continue、archive、drop、convert-to-project、revisit 等结果。 |
| 持久化位置               | 现有文档聚焦于受保护的 Markdown 年度报告再生成。                                                                           | DEC-40 要求使用插件数据或年度回顾状态文件，并避免污染用户正文。                                                        | 插件 data 是规范状态存储；`.annual-review/YYYY.review-state.json` 仅作为需要 vault 级可迁移性时的可选状态文件。                       |
| 源笔记元数据             | The Queue 和 Spaced Everything 将回顾元数据存入 frontmatter/properties，但当前 Annual Review 文档强调受保护的报告区块。    | DEC-40 明确避免污染用户正文；规范建议不要为回顾状态写入源笔记 frontmatter。                                            | MVP 禁止把 Review Board 状态写入源笔记 frontmatter；未来若需要，只能作为显式 opt-in 导出。                                            |
| “Open Review Board” 命令 | README 和命令 ID 暴露 `Annual Review: Open Review Board`，但当前实现的命令 ID 是 `open-annual-review-dashboard`。          | DEC-40 将 Review Board 视为主要 MVP UI。                                                                               | 保持内部命令 ID 稳定，继续对用户展示 `Annual Review: Open Review Board`。                                                             |
| Writing Growth 文档      | `docs/writing-growth.config.example.json` 描述了独立的写作成长报告配置。                                                   | Review Board v1 只将 writing growth 作为笔记/主题候选项的可能证据。                                                    | Writing growth 继续作为辅助报告/配置示例，不进入 Review Board MVP 主路径；未来可作为候选证据来源补充。                                |

## 对齐规则

- 内部使用 `accepted`，因为它是 DEC-40 要求的状态。
- 中文面向用户的文案保留为“接受”或“确认接受”，以保持清晰。
- 将 `Anomaly` 视为扫描信号，而不是 Review Board v1 候选项类型。
- 将 `Action Candidate` 视为 `task`，或视为已接受后移入 `next-action` 的候选项。
- 将插件数据作为规范状态存储；仅在需要可迁移性时添加 `.annual-review/YYYY.review-state.json`。
- MVP 中不要将 Review Board 状态写入源笔记 frontmatter。

## DEC-54 MVP 表面裁剪决策

| 领域 | 决策 | 理由 |
| --- | --- | --- |
| Review Board view | 保留 `Annual Review: Open Review Board` 命令和内部 `open-annual-review-dashboard` ID，但界面只展示范围、索引、报告动作、候选主题、建议复核候选和候选行动。 | Review Board 是 Core；宽泛 dashboard 指标是 Backlog，不能作为主路径能力出现。 |
| Dashboard analytics | 从 Review Board 视图移除月度趋势、每日热力图、字词增长、高频标签/文件夹/链接和代表笔记列表。 | 这些指标可作为报告方法或候选证据的内部输入，但不应替代审核/决策工作流。 |
| Package scripts | `release:*` 保留为发布资产生成；显式 vault 部署改名为 `dev:deploy-plugin`；smoke vault 部署限定为 `dev:deploy-smoke`；AI placeholder 和 writing-growth helper 不再暴露为 package scripts。 | 发布和开发验证是 Support；placeholder/backlog helper 不能污染普通开发者看到的 MVP surface。 |
| Optional AI settings | 设置页只在 provider 显式切到 ChatGPT 后显示模型、API key 和本地 Codex fallback 配置。 | AI 是 Support，默认必须保持本地优先；provider 细节不应成为默认设置表面。 |
