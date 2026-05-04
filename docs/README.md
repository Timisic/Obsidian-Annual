# 文档索引

这里集中放置项目背景、规格和后续说明，避免根目录 README 被历史 ticket、规格草稿和调研内容淹没。

## 入口

- [产品规格](product-specification.md)：中文主规格，说明当前已实现功能、范围、架构、隐私边界、验证计划和待办路线。
- [Agent 安装指南](agent-installation.md)：给用户代理的插件安装、构建和 vault 部署指南。
- [AI 报告生成设计](ai-report-design.md)：说明年度/月度报告中 AI 如何通过 CLI 或 skill 读取双链上下文，并生成可追溯的 Markdown 草稿。
- [项目调研](research/project-research.md)：早期调研资料，记录 Obsidian 年度报告插件方向、竞品启发和技术建议。
- [中文 README](../README.md)：仓库默认入口，面向首次使用和本地开发。
- [English README](../README.en.md)：英文入口，内容与中文 README 对齐。

## 文档维护原则

- 根目录 README 只保留用户和开发者上手所需的内容。
- 规格、调研、验证细节、设计记录放在 `docs/` 下。
- 默认优先写中文；需要英文版本时，用独立文件互相链接。
- 新增文档时，从本索引补上入口，避免只能通过历史任务记录找到。
