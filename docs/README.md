# 文档索引

这里集中放置项目背景、规格和后续说明，避免根目录 README 被历史 ticket、规格草稿和调研内容淹没。

当前 MVP 的 canonical scope 以 [Feature Scope](feature-scope.md) 和 [Feature Inventory](feature-inventory.md) 的 Core/Support/Backlog/Remove 分类为准。README 面向普通用户上手，SPEC 说明目标行为和验证要求；如果三者表述不一致，先按 Feature Scope 收敛主路径，再更新 README 和 SPEC。

## 入口

- [产品定义](product-definition.md)：说明 Annual Review 的定位、第一性原理、产品闭环和信任边界。
- [SPEC](product-specification.md)：中文主规格，定义 MVP Review Workflow、数据模型、状态流转、隐私边界、失败场景和验证计划。
- [Review Board v1 规格](review-board-spec.md)：定义 Review Board 的候选类型、状态、操作、最小 UI 和持久化结构。
- [Feature Scope](feature-scope.md)：列出 DEC-77 后保留、暂缓/隐藏和移出当前 MVP surface 的功能。
- [Review Board 对齐决策](review-board-alignment-decisions.md)：记录 Review Board v1 与现有 README/docs 表述的已采纳对齐方向。
- [Feature Inventory](feature-inventory.md)：把功能分为 Core、Support、Backlog、Remove，约束 README 和路线图只展示主流程。
- [Roadmap](roadmap.md)：只保留与年度复盘工作流直接相关的路线。
- [发布检查清单](release-checklist.md)：发布前验证 manifest、构建、release assets、手动安装、smoke-vault 验证和社区提交材料。
- [GitHub release 草案](github-release-draft.md)：首个 `0.1.0` release 的标题、说明和资产清单草稿。
- [Agent 安装指南](agent-installation.md)：开发和自动化附录，不作为普通用户安装主路径。
- [AI 报告生成设计](ai-report-design.md)：可选增强设计记录；不作为当前普通用户主路径或默认能力承诺。
- [Data Methodology](data-methodology.md)：解释 vault snapshot、当前 vault 推断、历史 snapshot 统计、扫描范围和增长限制。
- [项目调研](research/project-research.md)：早期调研资料，已由 Feature Inventory/Review Board 决策裁剪；其中 dashboard、导出、分享和 agent 安装设想不代表当前 MVP surface。
- [中文 README](../README.md)：仓库默认入口，面向首次使用和本地开发。
- [English README](../README.en.md)：英文入口，内容与中文 README 对齐。

## 文档维护原则

- 根目录 README 只保留用户和开发者上手所需的内容。
- 规格、调研、验证细节、设计记录放在 `docs/` 下。
- 普通用户安装、开发者 release、agent smoke-vault 验证必须分开描述，不把本地验证 vault 当成用户安装路径。
- AI、Dashboard、图表、导出和 provider 扩展只能在明确标注为可选或 backlog 时出现。
- 默认优先写中文；需要英文版本时，用独立文件互相链接。
- 新增文档时，从本索引补上入口，避免只能通过历史任务记录找到。
