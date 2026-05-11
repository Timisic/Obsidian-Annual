# 文档索引

这里集中放置项目背景、规格和后续说明，避免根目录 README 被历史 ticket、规格草稿和调研内容淹没。

当前 MVP 的 canonical scope 以 README、产品规格、数据口径、路线图、发布检查清单和 Prompt-vs-Plugin Benchmark 为准。历史功能盘点、Review Board 规格草稿和 agent/release 草案已归档到 [`archive/`](archive/)，仅用于追溯早期决策。

## 入口

- [SPEC](product-specification.md)：中文主规格，定义 MVP Review Workflow、数据模型、状态流转、隐私边界、失败场景和验证计划。
- [Data Methodology](data-methodology.md)：解释 vault snapshot、当前 vault 推断、历史 snapshot 统计、扫描范围和增长限制。
- [Prompt-vs-Plugin Benchmark](prompt-vs-plugin-benchmark.md)：核心产品完成后用于验证插件相对完整提示词和大模型读取 vault 的真实差异。
- [Roadmap](roadmap.md)：只保留与年度复盘工作流直接相关的路线。
- [发布检查清单](release-checklist.md)：发布前验证 manifest、构建、release assets、手动安装、smoke-vault 验证和社区提交材料。
- [历史文档归档](archive/)：早期功能盘点、Review Board 对齐记录、AI 报告设计、评分方法、agent 安装指南和 release 草案。
- [产品定义](product-definition.md)：早期产品定位记录；如果与 SPEC 或 README 不一致，以 canonical docs 为准。
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
