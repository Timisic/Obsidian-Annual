# Obsidian Annual Review 项目推进总纲

> 用途：给 agent 执行后续优化任务。  
> 当前假设：项目准备公开发布；核心优先级高于功能数量；AI 保留为可选能力，低于复盘流程、信任机制和工程底盘。

---

## 0. 项目重新定义

### 一句话定义

**Annual Review 是 Obsidian 的年度复盘工作流插件，帮助用户从一年的笔记中筛选重要主题、复核关键笔记、形成行动决定，并输出可追溯、可编辑、可重复生成的 Markdown 年报。**

### 第一性原理

1. **复盘流程优先**：年报文件是最终工件，核心体验是引导用户完成筛选、确认、取舍和行动。
2. **证据优先**：每个主题、笔记推荐和行动建议都应能回到源笔记、标签、链接、任务或时间线。
3. **用户判断优先**：插件只给候选项、理由和证据；最终主题、价值判断和行动决定由用户确认。
4. **小闭环优先**：先跑通“扫描 → 候选 → 审核 → 决策 →（AI）-> 年报”，再扩展图表、导出。
5. **本地与可回滚优先**：默认无网络；不覆盖用户编辑；生成内容可备份、可 diff、可复核。配合git插件。

### 核心用户痛点

用户一年写了很多 Obsidian 笔记，但年底面临四个问题：

- 不知道哪些内容值得回看。
- 不知道哪些主题真正贯穿全年。
- 不知道哪些笔记应继续推进、合并、归档或放弃，忽略遗忘了一些有价值的笔记。
- 不信任自动生成的漂亮总结。

### 产品闭环

1. 用户选择年份和扫描范围。
2. 插件生成候选：主题、笔记、项目、任务、异常活动、沉睡资产。
3. 用户进入 Review Board，逐项确认、重命名、合并、忽略、归档。
4. 插件结合AI生成年度报告，包含已确认内容、证据链接、行动决定和方法说明。
5. 用户可重新生成部分区块，同时保留个人编辑区。

### 成功标准

- 用户 10-15 分钟内能完成第一轮有意义的年度复盘。
- 年报中至少包含 3 个用户确认的年度主题、5 篇代表笔记、3 条行动。
- 每个推荐项都有“为什么被选中”的简短理由和证据链接。
- 重新生成不会抹掉用户手写内容。
- 默认模式无网络请求。

---

## 1. 推荐推进顺序

### Phase 0：定义冻结

目标：统一项目方向，删除模糊承诺。  
完成后，README、spec、roadmap 都围绕“可信复盘工作流”。

### Phase 1：工程可信底盘

目标：让项目像一个可安装、可审查、可发布的 Obsidian 插件。  
优先处理代码格式、manifest、发布流程、移动端/桌面边界、README 安装方式。

### Phase 2：Review Board MVP

目标：把“生成报告”升级成“完成复盘”。  
实现候选队列、状态管理、复盘进度、逐项操作、年度报告生成。

### Phase 3：证据与解释系统

目标：让用户信任推荐。  
每个候选项展示来源、评分因素、置信度、可编辑理由。

### Phase 4：数据质量与历史快照

目标：提升“年度增长”类指标的可信度。  
加入轻量 snapshot，减少仅依赖 ctime/mtime 带来的偏差。

### Phase 5：AI 可选助手

目标：只让 AI 做有边界的润色和草稿。  
先实现发送前预览、脱敏、摘录限制、证据绑定，再考虑更多 provider。

---

## 2. Agent Issues

### Issue 01 — 重新定义项目定位，并重写 README/spec

**目标**  
把项目从“年度统计报告生成器”收束为“可信、有选择、有行动结果的年度复盘工作流”。

**参考材料**

- 当前仓库 README：https://github.com/Timisic/Obsidian-Annual
- Obsidian Sample Plugin 发布说明：https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian community releases 机制：https://github.com/obsidianmd/obsidian-releases
- Journal Bases 的 periodic review 思路：https://github.com/dsebastien/obsidian-journal-base
- Vault Review 的逐项复盘思路：https://github.com/SashaKryzh/obsidian-vault-review

**任务**

1. 新建或重写 `docs/product-definition.md`。
2. 更新 `docs/product-specification.md`，把核心体验定义为 Review Workflow。这个可以直接就叫SPEC.md
3. 重写 README 首屏：一句话定位、适合谁、核心流程、隐私边界、安装方式、截图占位。
4. 删除 README 中削弱信任的表达，例如过早强调 agent 安装、过度 AI provider 承诺、泛泛的图表扩展。
5. 增加“本插件如何保护用户编辑”和“本插件如何处理隐私”的说明。

**交付物**

- `docs/product-definition.md`
- 更新后的 `docs/product-specification.md`
- 更新后的 `README.md` / `README.en.md`
- `docs/roadmap.md`，只保留与复盘工作流相关的路线

**验收标准**

- README 首屏 10 秒内能说明插件解决什么痛点。
- README 明确展示流程：扫描、候选、审核、决策、年报。
- README 不把 AI 放在核心卖点。
- spec 中包含用户旅程、数据模型、状态流转、隐私边界、失败场景。

---

### Issue 02 — 设计 Review Board v1 的产品规格

**目标**  
定义 Review Board 的最小可用交互，让用户逐项完成年度复盘。

**参考材料**

- Vault Review：snapshot、逐项 review、progress stats  
  https://github.com/SashaKryzh/obsidian-vault-review
- The Queue：低摩擦逐项处理和“别让笔记沉没”的产品表达  
  https://www.obsidianstats.com/plugins/the-queue
- Journal Bases：daily → weekly → monthly → quarterly → yearly 的层级复盘  
  https://github.com/dsebastien/obsidian-journal-base
- Spaced Everything：context、review outcome、反馈驱动下次出现  
  https://github.com/zachmueller/spaced-everything

**任务**

1. 定义 Review Board 的候选类型：主题、笔记、项目、任务、沉睡笔记、桥接笔记。
2. 定义状态：`candidate`、`accepted`、`renamed`、`merged`、`ignored`、`archived`、`next-action`。
3. 定义操作：接受、忽略、合并主题、重命名主题、加入年度精选、加入明年行动、打开源笔记。
4. 定义最小 UI：左侧候选列表，右侧证据和操作按钮，下方复盘进度。
5. 定义持久化结构：建议用插件 data 或年度 review state 文件，避免污染用户正文。

**交付物**

- `docs/review-board-spec.md`
- `src/core/reviewState.ts` 的接口草案
- `tests/reviewState.spec.ts` 的测试草案
- UI wireframe 草图，可用 Markdown 表格表达

**验收标准**

- 一个 agent 或开发者能按文档实现 Review Board MVP。
- 状态流转明确，重复扫描不会丢失用户已确认的选择。
- 每个候选项都有证据来源字段。

---

### Issue 03 — 功能精简与项目瘦身

**目标**  
砍掉与“可信年度复盘工作流”关系弱、信任成本高、维护成本高的功能与承诺。

**优先砍掉或移入 backlog**

1. 分享卡、Canvas、Bases、HTML 导出。
2. 过度美化图表。
3. 宽泛的 dashboard 指标堆叠。
4. 直接宣称“高价值笔记”的绝对判断。
5. 无保护的报告覆盖式重生成。
6. 面向普通用户的 agent 安装主路径。
7. 与年度复盘无关的开发 smoke 命令暴露。

**保留的最小功能**

1. 年份与范围选择。
2. Vault 扫描。
3. 候选主题和候选笔记。
4. Review Board。
5. 证据链接和推荐理由。
6. 用户确认状态。
7. 可保护用户编辑的 Markdown 年报。
8. 默认本地运行。

**任务**

1. 建立 `docs/feature-inventory.md`，把功能分为 Core、Support、Backlog、Remove。
2. 修改 README 和 roadmap，只展示 Core 和少量 Support。
3. 对代码中的非核心入口做隐藏、删除或 backlog 标记。
4. 把“Top 10 高价值笔记”改名为“Suggested review candidates”。
5. 对所有带判断色彩的文案增加“推荐理由”和“可人工确认”。

**交付物**

- `docs/feature-inventory.md`
- 更新后的 README / roadmap
- PR 中列出被删除、被隐藏、被延期的功能

**验收标准**

- 新用户读 README 后只感知一个主流程。
- 插件命令面板只保留必要命令。
- 无核心证据链的功能不会出现在主路线中。

---

### Issue 04 — 工程底盘：对齐 Obsidian 插件发布标准

**目标**  
让项目具备公开发布的基本可信度。

**参考材料**

- Obsidian Sample Plugin：https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian API plugin structure：https://github.com/obsidianmd/obsidian-api
- Obsidian community releases：https://github.com/obsidianmd/obsidian-releases
- Obsidian October plugin checklist：https://docs.obsidian.md/oo/plugin

**任务**

1. 加入 Prettier、ESLint、GitHub Actions。
2. 清理所有本机路径、个人 smoke vault 路径、空 author 信息。
3. 修正 `manifest.json`：author、description、isDesktopOnly、minAppVersion。
4. 保留 Node/CLI 能力，将插件标记为 desktop-only
5. 建立标准 release 脚本，输出 `manifest.json`、`main.js`、`styles.css`。
6. 写 `docs/release-checklist.md`。

**交付物**

- `.eslintrc` / eslint flat config
- Prettier config
- GitHub Actions workflow
- 更新后的 `manifest.json`
- `docs/release-checklist.md`
- 首个 GitHub release 草案

**验收标准**

- `npm run test && npm run typecheck && npm run build && npm run lint` 全部通过。
- 仓库无本机绝对路径。
- 插件可通过 release assets 手动安装。

---

### Issue 05 — 报告重生成保护机制

【先确认Agent能否在本仓库内建一个vault然后用obsidian相关的skill，以及自行调用ob cli去验证】

**目标**  
用户多次生成报告时，机器内容可更新，用户手写内容不丢失。

**参考材料**

- Obsidian API 中推荐使用 `Vault.process` 处理后台文件更新：https://docs.obsidian.md/oo/plugin
- 当前项目报告生成逻辑：`src/obsidian/reportWriter.ts`

**任务**

1. 为年报引入 protected section：用户编辑区不被插件覆盖。
2. 为机器生成区引入 marker：`annual-review:start/end`。
3. 重新生成时只更新机器生成区。
4. 首次覆盖旧报告前创建备份或弹窗确认。
5. 增加测试：旧报告含用户编辑内容，重新生成后仍保留。

**交付物**

- 更新后的 report writer
- `tests/reportWriter-preserve-user-content.spec.ts`
- README 中的“重新生成说明”

**验收标准**

- 用户手写区不会被覆盖。
- 机器生成区可重复更新。
- 测试覆盖初次生成、重复生成、缺少 marker、旧版报告迁移。

---

### Issue 06 — 推荐解释系统：让每个候选项可审计

**目标**  
让用户知道插件为什么推荐某个主题或笔记。

**参考材料**

- Dashboard Navigator 的可导航统计：https://github.com/drbap/dashboard-navigator-for-obsidian
- Writer Statistics Dashboard 的过滤和指标边界：https://github.com/CodyBontecou/obsidian-writer-stats
- 当前项目 topic/high-value note 逻辑

**任务**

1. 为每个候选项生成 `reason[]`。
2. reason 类型至少包含：反链、出链、字数、更新时间、任务、标签、跨主题连接、沉睡时间。
3. 展示“证据链接”：源笔记、相关笔记。
4. 将绝对标签改为建议标签：`suggested`、`needs-review`、`possible-bridge`。
5. 增加方法说明：统计口径和限制。

**交付物**

- `src/core/explain.ts`
- 更新后的候选数据结构
- 更新后的报告渲染
- `docs/scoring-method.md`

**验收标准**

- 每个候选项至少有 1 条具体理由。
- 理由能链接回源笔记或统计字段。
- 报告不出现无证据支撑的强判断。

---

### Issue 07 — 数据质量：增长 snapshot

**目标**  
减少仅依赖文件 ctime/mtime 对年度增长指标造成的偏差。

**任务**

1. 定义 `annual-review-snapshots.json` 数据结构。
2. 每次 rebuild 或定期记录 note word count、modified time、folder、tags。
3. 报告中区分“当前 vault 推断”和“历史 snapshot 统计”。
4. 无历史数据时，降低增长指标语气。
5. 增加 include/exclude folder 规则。

**交付物**

- `src/core/snapshot.ts`
- `docs/data-methodology.md`
- 测试 fixture：导入旧笔记、批量修改、排除目录

**验收标准**

- 报告明确说明统计口径。
- 有 snapshot 时能展示真实增量。
- 无 snapshot 时不会给出过度确定的增长结论。

---

### Issue 08 — AI 安全边界与预览

**目标**  
保留 AI 草稿能力，同时把隐私和准确性风险降到最低。

**参考材料**

- 当前 `docs/ai-report-design.md`
- Obsidian 插件 checklist 对敏感信息和网络请求的提醒：https://docs.obsidian.md/oo/plugin

**任务**

1. AI 默认关闭。
2. 调用前显示 payload preview。
3. 支持排除文件夹、字段脱敏、摘录长度限制。
4. AI 只能基于已确认候选项生成草稿。
5. AI 输出段落必须附 evidence links 或引用已确认候选。
6. README 中将 AI 放在“可选增强”区域。

**交付物**

- `docs/ai-privacy-policy.md`
- `src/core/aiPayloadPreview.ts`
- 设置页中的 AI 安全选项
- AI 调用测试

**验收标准**

- 默认运行不访问网络。
- 用户能在发送前看到将发送的内容。
- AI 草稿不会绕过 Review Board 的用户确认结果。

---

### Issue 09 — Demo vault、截图和样例年报

**目标**  
让用户在安装前看到真实效果。

**参考材料**

- Yearly Glance README 的截图式展示：https://github.com/Moyf/yearly-glance
- Dashboard Navigator README 的截图和功能展示：https://github.com/drbap/dashboard-navigator-for-obsidian
- Obsidian Sample Plugin 的安装说明：https://github.com/obsidianmd/obsidian-sample-plugin

**任务**

1. 建立小型 demo vault，包含 daily notes、项目笔记、读书笔记、任务和标签。
2. 生成一份样例年度报告。
3. 制作 README 截图：Review Board、候选解释、最终年报。
4. 写 BRAT/manual/community install 三种路径。

**交付物**

- `demo-vault/`
- `docs/examples/2026 Annual Review.md`
- `docs/screenshots/`
- README 安装和示例区域

**验收标准**

- 用户无需安装即可理解产物长什么样。
- 样例报告能体现“证据、选择、行动”。
- README 包含可复制的安装步骤。

---

## 3. 同类项目借鉴清单

> 文件建议路径：`docs/research/comparable-projects.md`

### 3.1 Journal Bases Plugin

地址：https://github.com/dsebastien/obsidian-journal-base

可借鉴点：

- 把复盘设计成层级流程：daily → weekly → monthly → quarterly → yearly。
- 多列钻取视图适合年终复盘：从年看季度，从季度看月，从月看周。
- “读取子级笔记，提炼到父级总结”的工作流很适合 Annual Review。

建议借鉴：

- Review Board 中增加 period drill-down。
- 年报生成前先让用户确认季度/月度主题。
- 提供“缺失周期笔记”的创建入口。

---

### 3.2 Vault Review

地址：https://github.com/SashaKryzh/obsidian-vault-review

可借鉴点：

- snapshot 很重要：先冻结一批待复盘对象，再逐项处理。
- 随机或逐项打开笔记，降低整理大型 vault 的压力。
- 进度统计能给用户持续推进感。

建议借鉴：

- 创建年度 review snapshot。
- 每个候选笔记都有状态。
- Review Board 显示复盘进度。

---

### 3.3 The Queue

地址：https://www.obsidianstats.com/plugins/the-queue

可借鉴点：

- 核心表达很清晰：避免笔记被收藏后遗忘。
- 浮动操作条适合低摩擦处理当前笔记。
- 随机重访可以帮助用户发现被遗忘的价值。

建议借鉴：

- Review Board 增加“下一个候选”按钮。
- 每个候选有快速操作：接受、忽略、稍后、加入明年行动。
- 支持“随机复盘沉睡笔记”。

---

### 3.4 Spaced Everything

地址：https://github.com/zachmueller/spaced-everything

可借鉴点：

- context 过滤可以避免不同生活/工作领域混在一起。
- review outcome 能把用户反馈变成调度逻辑。
- 用前置 onboarding 让笔记进入复盘系统。

建议借鉴：

- Annual Review 支持 context：work、personal、research、writing。
- 用户对候选项的反馈影响后续推荐。
- 支持“今年忽略，明年再看”。

---

### 3.5 Incremental Writing

地址：https://github.com/bjsi/incremental-writing

可借鉴点：

- 队列和优先级比单次报告更适合长期写作系统。
- note/block 级别复盘能支持更细粒度的年度摘录。
- scheduling options 提醒我们：复盘可以分批完成。

建议借鉴：

- Annual Review 支持候选优先级。
- 支持分多次完成复盘。
- 后期可支持 block-level annual highlights。

---

### 3.6 Syro

地址：https://github.com/piyooko/obsidian-syro

可借鉴点：

- 右侧队列、标签过滤、阅读进度和 timeline 的组合很适合处理大量材料。
- “回到原文上下文”的设计能提升信任。
- 现代 UI 展示降低用户进入门槛。

建议借鉴：

- 候选详情必须能一键打开源笔记和上下文。
- 对长笔记保留摘录位置或 heading 位置。
- Review Board 保持右侧栏形态，减少打断。

---

### 3.7 Writer Statistics Dashboard

地址：https://github.com/CodyBontecou/obsidian-writer-stats

可借鉴点：

- typed/pasted 区分提升写作统计可信度。
- daily goal、streak、folder filtering 都是清晰、有边界的指标。
- status bar 和侧边 dashboard 提供轻量反馈。

建议借鉴：

- 年度增长指标要说明统计口径。
- 加 include/exclude folder。
- 只展示和复盘有关的指标，避免 dashboard 变成噪声。

---

### 3.8 Dashboard Navigator

地址：https://github.com/drbap/dashboard-navigator-for-obsidian

可借鉴点：

- dashboard 应服务导航和行动。
- 文件类型、标签、最近文件、搜索过滤都可转化为复盘入口。
- 截图和 README 展示很完整。

建议借鉴：

- Annual dashboard 中的每个数字都能点击进入候选列表。
- 统计卡片服务 Review Board。
- README 加真实截图。

---

### 3.9 Yearly Glance

地址：https://github.com/Moyf/yearly-glance

可借鉴点：

- 年度视图有很强的视觉记忆点。
- 可定制事件、过滤、点击编辑有助于年度回看。
- README 首屏展示截图和定位，用户理解成本低。

建议借鉴：

- 后期为年度报告增加 year-at-a-glance summary。
- 年度视图只展示已确认的重要节点。
- 视觉功能放在 Review Board 成熟后推进。

---

### 3.10 Yearly Timeline

地址：https://github.com/elaine2700/yearly-timeline-obsidian-plugin

可借鉴点：

- timeline 适合表达年度事件、主题转折、项目推进。
- 垂直时间线对年度报告更自然。

建议借鉴：

- 年报中生成“已确认年度节点”时间线。
- 节点来自用户确认项，避免把普通修改误判为重要事件。

---

### 3.11 Simple Archiver

地址：https://github.com/mfarr/obsidian-archive

可借鉴点：

- 归档操作应可逆，且保留相对路径。
- 自动归档规则可以处理沉睡笔记。
- 文件菜单操作适合低摩擦整理。

建议借鉴：

- Review Board 支持“建议归档”。
- 归档操作默认二次确认。
- 提供 undo 或恢复说明。

---

### 3.12 Obsidian Sample Plugin / API / Checklist

地址：

- https://github.com/obsidianmd/obsidian-sample-plugin
- https://github.com/obsidianmd/obsidian-api
- https://docs.obsidian.md/oo/plugin

可借鉴点：

- 标准发布资产：`manifest.json`、`main.js`、`styles.css`。
- manifest、release tag、versions.json 要一致。
- 移动端兼容需要避免顶层 Node 模块。
- lint、CI、release checklist 会显著提升信任。

建议借鉴：

- 先把工程底盘对齐官方模板。
- 发布前跑 checklist。
- README 明确安装方式和 release 方式。

---

## 4. 功能砍除原则

### 保留

只保留直接服务年度复盘闭环的能力：

- 扫描年度范围。
- 生成候选项。
- 用户确认和取舍。
- 证据链接。
- 可保护编辑的年报。
- 默认本地运行。

### 延后

- AI 多 provider。
- 图表美化。
- 分享卡。
- Canvas / Bases / HTML 导出。
- 大型 dashboard。
- 自动归档规则。
- block-level highlights。

### 删除或隐藏

- 没有用户价值的 smoke 命令。
- 个人本机路径。
- 过度确定的“高价值”文案。
- 没有保护机制的覆盖式写入。
- README 中把 agent 安装当主路径的内容。

---

## 5. 最小 MVP 定义

### MVP 名称

**Annual Review Workflow v1**

### MVP 功能

1. 选择年份和扫描范围。
2. 扫描 vault，生成主题候选和笔记候选。
3. 打开 Review Board。
4. 对候选项执行接受、忽略、重命名、合并、加入明年行动。
5. 生成带证据链接的年报。
6. 重新生成时保留用户手写区。
7. 默认无网络请求。

### MVP 不做

- 多 AI provider。
- 对外分享导出。
- 全量 vault analytics。
- 花哨图表。
- 自动判断人生方向。

---

## 6. 给 agent 的统一执行原则

1. 每个 PR 只围绕一个目标。
2. 所有新增推荐都必须有 evidence 字段。
3. 所有用户可编辑文件都必须有保护策略。
4. 所有 README 新卖点都必须有对应截图、样例或代码实现。
5. 所有 AI 相关改动必须默认关闭，并提供发送前预览。
6. 所有功能都要能回答：它如何帮助用户完成年度复盘中的筛选、确认、取舍或行动？

---

## 7. 推荐的首批 PR 顺序

1. PR 01：产品定义与 README 重写。
2. PR 02：feature inventory 与 roadmap 瘦身。
3. PR 03：工程底盘与 release checklist。
4. PR 04：报告重生成保护机制。
5. PR 05：Review Board spec 与 state model。
6. PR 06：Review Board MVP。
7. PR 07：候选解释系统。
8. PR 08：demo vault、样例报告、截图。
9. PR 09：AI payload preview。
10. PR 10：snapshot 数据质量。

---

## 8. 核心判断

这个项目的未来价值来自一个清晰闭环：

**帮助用户从一年的 Obsidian 笔记中，完成可信筛选、人工确认、年度判断和下一年行动。**

所有偏离这个闭环的功能都先降级。所有增强这个闭环的工程、文档、UI、数据和 AI 能力都优先。
