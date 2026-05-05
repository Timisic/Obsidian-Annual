# 文档索引

这里集中放置项目背景、规格和后续说明，避免根目录 README 被历史 ticket、规格草稿和调研内容淹没。

## 入口

- [产品定义](product-definition.md)：说明 Annual Review 的新定位、第一性原理、产品闭环和信任边界。
- [SPEC](product-specification.md)：中文主规格，定义 Review Workflow、数据模型、状态流转、隐私边界、失败场景和验证计划。
- [Review Board v1 规格](review-board-spec.md)：定义 Review Board 的候选类型、状态、操作、最小 UI 和持久化结构。
- [Review Board 对齐决策](review-board-alignment-decisions.md)：记录 Review Board v1 与现有 README/docs 表述的已采纳对齐方向。
- [Feature Inventory](feature-inventory.md)：把功能分为 Core、Support、Backlog、Remove，约束 README 和路线图只展示主流程。
- [Roadmap](roadmap.md)：只保留与年度复盘工作流直接相关的路线。
- [Agent 安装指南](agent-installation.md)：开发和自动化附录，不作为普通用户安装主路径。
- [AI 报告生成设计](ai-report-design.md)：说明 AI 作为可选增强时如何读取受控上下文，并生成可追溯的 Markdown 草稿。
- [项目调研](research/project-research.md)：早期调研资料，记录 Obsidian 年度报告插件方向、竞品启发和技术建议。
- [中文 README](../README.md)：仓库默认入口，面向首次使用和本地开发。
- [English README](../README.en.md)：英文入口，内容与中文 README 对齐。

## 文档维护原则

- 根目录 README 只保留用户和开发者上手所需的内容。
- 规格、调研、验证细节、设计记录放在 `docs/` 下。
- 默认优先写中文；需要英文版本时，用独立文件互相链接。
- 新增文档时，从本索引补上入口，避免只能通过历史任务记录找到。
