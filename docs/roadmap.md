# Roadmap

本路线图围绕 Time Range Review 主线展开。
图表美化、分享导出、多 provider 扩展、Canvas/Bases/HTML 输出、泛用 dashboard、项目管理、任务管理、行动系统和归档系统不进入 MVP 主线；
它们只有在服务于主题复盘、证据复核和受保护 Markdown 报告闭环时才会重新评估。

## Now: Time Range Review 可信小闭环

- Review Session：支持 Annual、Quarterly、Monthly 和 Custom Range，保存 startDate、endDate、preset、include/exclude、隐私模式和输出路径。
- 本地扫描：只读取允许范围内的 Markdown、metadata cache、链接、标签、标题、摘录和时间信号。
- Evidence Notes：把范围内值得复核的源笔记编译成证据笔记，保留路径、摘录、链接和进入证据包的理由。
- Evidence Clusters：基于链接、共同表达、时间分布、文件夹上下文和重新引用痕迹组织证据簇。
- Theme Hypotheses：为每个证据簇生成主题假设、连接解释、代表证据和不确定性说明。
- Theme Review Board：展示主题假设和证据笔记，并支持 Accept、Rename、Merge、Ignore、Open evidence、Re-explain。
- 用户复核要求：主题假设必须被用户接受、改名或合并后才能进入报告。
- Review Report：写入已确认主题、Evidence Notes、Connection Explanation、Methodology 和用户手写区。
- 用户编辑保护：生成区块和用户手写区块分离，重新生成不覆盖手写内容。
- 默认隐私边界：无网络、无外部 AI、无 telemetry。

## Next: 降低主题复核成本

- Preset 体验：为 Annual、Quarterly、Monthly 和 Custom Range 提供清晰的默认命名、日期选择和报告路径。
- 证据预览：在 Review Board 中快速查看源笔记摘录、反链、出链和时间线位置。
- 主题合并建议：发现重复或相近的 Theme Hypotheses，辅助用户合并。
- 重新解释：基于同一证据包刷新 Connection Explanation，并保留用户已确认的主题决策。
- 审核进度：展示待复核、已接受、已忽略、已合并数量。
- 重建索引反馈：展示扫描进度、排除数量和证据编译状态，不扩展成泛用 dashboard 指标墙。
- 冲突处理：目标报告已被编辑时，提供 diff、新副本或备份路径。

## Later: 增强可复核性和 AI 控制

- 发送前 AI 上下文预览：仅在用户显式启用 AI 时展示 provider、时间范围、摘录数量和排除范围。
- 字段级隐私控制：允许从 AI 或主题上下文中排除特定路径、标签或 frontmatter 字段。
- 报告再生成记录：记录每次生成的范围、主题数量、证据数量和用户确认数量。
- 历史 Review Session：允许继续上次未完成的年度、季度、月度或自定义范围复盘。
- 手动补充证据笔记：用户可以把任意源笔记加入本次复盘证据包。
- Prompt-vs-Plugin Benchmark：用同一测试 vault 对比强提示词和插件在遗漏、证据、复核、复现性和用户控制上的差异。
- Obsidian 原生发布准备：README、manifest、版本 release artifact 和社区插件提交材料保持一致。

## Deferred From MVP

- Project candidate 或项目线索管理。
- Task candidate 或任务线索管理。
- Add to actions / Action Item 系统。
- Archive / 归档判断系统。
- Dashboard Chart 和泛用统计面板。
- 分享卡、HTML 导出、Canvas 导出等复盘闭环外的输出形式。
- 多 provider 生态作为主卖点。
- 面向普通用户的 agent 安装主路径。

这些方向不是删除，而是从当前 MVP 降级。
只有当 Theme Hypothesis、Evidence Note、用户复核和 Review Report 闭环稳定后，才重新评估它们是否进入产品主线。

## Explicitly Not On The Main Roadmap

- 以 AI provider 数量作为主功能。
- 默认外部 AI 总结。
- 泛用图表库或复杂数据大屏。
- 把标签统计直接当作主题主流程。
- 把未经用户复核的主题假设写成用户结论。
- 依赖 Dataview、Bases、Tasks、Kanban、Projects 等第三方插件完成核心路径。
