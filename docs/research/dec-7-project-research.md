# DEC-7 项目调研：Obsidian 年度报告插件方向

调研日期：2026-05-03

## 结论摘要

适配 Obsidian 的年度报告不应该先做成一个独立的「大屏营销页」。更合适的第一版是本地优先的 Obsidian 插件：扫描 vault 中的 Markdown、属性、标签、链接和日记文件，生成一份可编辑的年度回顾笔记，并提供一个轻量 dashboard/view 用于预览、筛选、重新生成和导出分享图。

原因：

- Obsidian 已经有字数、数据库视图、Canvas、Workspaces、Graph 等本地组织能力；用户更信任可追溯、可编辑的 Markdown 产物，而不是黑盒云端报告。
- 现有插件覆盖了字数、写作热力图、看板、数据查询、图表等单点需求，但没有成熟的「面向个人知识库内容理解 + 年度叙事 + 可分享导出」的一体化插件。
- 年度报告类产品的核心不是图表堆砌，而是把数据变成故事：全年节奏、峰值月份、主题迁移、代表性内容、惊喜洞察、可分享卡片。

推荐 MVP：

1. `Generate Annual Review` 命令：选择年份、范围、隐私选项，生成 `Annual Reviews/YYYY.md`。
2. 自定义 `ItemView`：提供年度统计总览、主题/标签/链接趋势、月份时间线、代表性笔记、导出按钮。
3. 本地索引层：使用 Obsidian `Vault`、`MetadataCache`、文件事件和插件数据文件缓存统计结果。
4. 可选联动：读取 Dataview 风格字段、Bases/Properties、Daily/Periodic Notes、Tasks、Kanban/Projects 的 Markdown 数据；不要强依赖第三方插件作为核心路径。

## 调研 1：Obsidian 是否已有类似能力

### 核心能力

Obsidian 自带的能力已经能覆盖部分「统计/看板/年度回顾」的基础 UI：

- Word count 是核心插件，显示当前笔记的字数和字符数，并支持 CJK 语言；桌面端显示在状态栏，移动端显示在右侧边栏顶部。来源：[Obsidian Help: Word count](https://obsidian.md/help/Plugins/Word%2Bcount)。
- Bases 是核心插件，可把文件按属性做表格、列表、卡片、地图等视图，支持过滤、排序、分组、公式、汇总。来源：[Obsidian Help: Core plugins](https://help.obsidian.md/plugins)、[Bases Views](https://obsidian.md/help/bases/views)、[Table summaries](https://obsidian.md/help/bases/views/table)。
- Canvas 适合做自由布局和可视化回顾墙，`.canvas` 使用 JSON Canvas 开放格式。来源：[Obsidian Help: Canvas](https://help.obsidian.md/plugins/canvas)。
- Workspaces 可保存年度回顾专用布局，例如左侧年度报告、右侧 Graph/Backlinks/Properties。来源：[Obsidian Help: Workspaces](https://obsidian.md/help/plugins/workspaces)。
- Graph view 可呈现笔记关系，但对年度报告来说更适合做「主题迁移/关系密度」的辅助视图，不宜作为主要阅读入口。

### 相关社区插件

| 类别 | 插件/能力 | 对年度报告的启发 | 局限 |
| --- | --- | --- | --- |
| 字数/写作统计 | Novel Word Count | 在文件树旁展示每个文件、文件夹、vault 的字数、页数、阅读时间等，说明「局部统计贴近原生 UI」是用户可接受的。来源：[GitHub](https://github.com/isaaclyman/novel-word-count-obsidian)、[Obsidian Stats](https://www.moritzjung.dev/obsidian-stats/plugins/novel-word-count/) | 偏实时统计，不负责年度叙事。 |
| 字数/写作统计 | Daily Stats / Daily Statistics / Keep the Rhythm | 日字数、历史日志、贡献热力图、周目标等适合借鉴为年度活跃度模块。来源：[Daily Stats GitHub](https://github.com/dhruvik7/obsidian-daily-stats)、[Daily Statistics](https://www.obsidianstats.com/plugins/daily-statistics)、[Keep the Rhythm](https://github.com/benjaminezequiel/keep-the-rhythm) | 数据通常保存在插件私有 JSON，跨设备/跨插件联动可能不稳定。 |
| 数据查询 | Dataview | 从 frontmatter 和 inline fields 建立查询层，是 Obsidian 用户做自定义 dashboard 的事实标准之一。来源：[Dataview GitHub](https://github.com/blacksmithgu/obsidian-dataview) | Dataview 结果不是所有场景都能作为稳定数据源；年度报告插件应能独立扫描 vault。 |
| 项目/看板 | Kanban、Projects、Base Board | Kanban 提供 Markdown-backed board；Projects 提供 table/board/calendar/gallery；Base Board 展示了基于 Bases/属性的看板方向。来源：[Kanban](https://github.com/mgmeyers/obsidian-kanban)、[Projects](https://github.com/obsmd-projects/obsidian-projects)、[Base Board 论坛帖](https://forum.obsidian.md/t/new-plugin-base-board-a-property-driven-kanban-board-powered-by-obsidian-bases/111507) | 这些是项目管理视图，不负责个人内容总结。 |
| 图表 | ChartsView / Tracker | 可借鉴图表、时间序列、每日笔记追踪能力。来源：[ChartsView](https://github.com/caronchen/obsidian-chartsview-plugin)、[Tracker](https://github.com/pyrochlore/obsidian-tracker) | 图表插件偏表达层，缺少年度故事结构。 |

### 是否已有年度报告插件

没有找到成熟、主流的 Obsidian 社区插件专门做个人 vault 的年度报告。现有相近内容主要有三类：

- Obsidian Stats 做过「Obsidian Plugins Wrapped」，但对象是插件生态，不是用户自己的 vault。来源：[Obsidian Plugins Wrapped 2025](https://www.obsidianstats.com/posts/2025-12-04-wrapped-2025)。
- 社区有人用 Claude Code/prompt 生成 `Obsidian Wrapped` 和分析型年终回顾笔记。来源：[Obsidian Forum: 2025 Obsidian Wrapped](https://forum.obsidian.md/t/2025-obsidian-wrapped-create-year-in-review-summary-notes-with-claude-code/108908)。
- 用户通过 Dataview、Periodic Notes、手写年度回顾来拼装个人总结。

这说明机会点不在「字数统计」本身，而在把 Obsidian 本地数据转成可信、可重跑、可编辑、可分享的年度回顾体验。

## 现有 App 年度报告是怎么做的

### 通用模式

音乐、小红书、购物、社交类年度报告通常包含以下结构：

1. 入口明显：年底在首页、搜索、顶部 tab 或弹窗给入口。
2. 资格阈值：数据量不足时给替代体验，避免空报告。
3. 故事流：用卡片/分页串起「总量 -> 排名 -> 阶段变化 -> 个性标签 -> 彩蛋」。
4. 个人身份标签：给用户一个可传播的人设，例如年度听歌人格、年度关键词、兴趣类别。
5. 可分享资产：每个关键数据故事都能生成竖版分享卡，适配社媒。
6. 方法说明：数据口径要解释清楚，避免用户对排名不信任。
7. 回流动作：生成歌单、收藏清单、年度榜单、购物复盘、继续探索推荐。

### 参考案例

- Spotify Wrapped：官方描述为年度个性化音频回顾，并持续加入可分享数据故事、音乐阶段、AI DJ/AI Podcast/AI Playlist、创作者 microsite 等互动层。来源：[Spotify Wrapped 2024](https://newsroom.spotify.com/2024-12-04/wrapped-user-experience-2024)、[Wrapped methodology](https://newsroom.spotify.com/2025-12-05/wrapped-methodology-explained/)。
- Apple Music Replay：按播放历史、播放次数、播放时长统计歌曲、艺人、专辑、歌单、类型等，并提供月度洞察、年终高光视频。来源：[Apple Support: Apple Music Replay](https://support.apple.com/en-ie/109356)。
- 小红书/QQ 音乐/微博/网易云等中文 App：年底集中上线年度报告入口，常见内容包括浏览笔记类型、互动好友、年度歌手、听歌时长、歌单、评论/互动等。来源：[新浪：年度报告上线观察](https://finance.sina.com.cn/wm/2025-12-27/doc-inhefuwi9912796.shtml)、[新浪科技：2025 年度报告观察](https://finance.sina.com.cn/tech/roll/2026-01-01/doc-inheuffu3232883.shtml)。
- 购物类年度账单/报告：通常围绕消费金额、品类、地点、时间、优惠、会员权益、年度关键词组织；可借鉴其「账本式复盘 + 情绪化文案」结构，但 Obsidian 插件应避免制造消费型焦虑。

### 对 Obsidian 的转译

Obsidian 年度报告的故事模块可以设计为：

- 年度输入：新建/修改笔记数、字数/字符数、活跃天数、最长连续记录、最密集月份。
- 年度主题：高频标签、属性、文件夹、链接对象、标题关键词、代表性 MOC/Index。
- 年度关系：新增链接、孤岛笔记、被链接最多笔记、桥接主题。
- 年度节奏：按月/季度展示写作量、主题变化、任务完成、阅读/项目记录。
- 年度作品：字数最高、链接最多、被反复修改、最早/最新、随机惊喜笔记。
- 年度人格：根据数据生成轻量标签，但必须展示依据，避免黑盒判断。
- 继续行动：生成下一年模板、补齐缺失属性、整理孤岛笔记、导出回顾。

## 适配 Obsidian 的 UI 形式

推荐按「原生入口 + 可编辑产物 + 轻量仪表盘 + 分享导出」组合，而不是只做一个网页式活动页。

### 一级入口

- Command palette：`Annual Review: Generate report`、`Annual Review: Open dashboard`。
- Ribbon icon：适合年度报告入口，但不要常驻太多 UI。
- Status bar：仅显示索引状态或年度活跃摘要，例如 `2026: 43 active days`。

### 主体验

1. Markdown 报告笔记
   - 默认生成 `Annual Reviews/2026 Annual Review.md`。
   - 包含摘要、统计表、月份回顾、主题变化、代表笔记链接、数据口径。
   - 优点：可编辑、可版本控制、可发布、可被 Dataview/Bases 继续消费。

2. 自定义 dashboard view
   - 用 `ItemView` 做交互式预览、筛选和导出。
   - 左侧：年份、范围、文件夹/标签过滤、隐私选项。
   - 中间：年度故事卡/图表。
   - 右侧：数据口径、代表笔记、重算按钮。

3. Bases/Properties 友好
   - 可生成 `annual_review_year`、`annual_review_theme`、`annual_review_score` 等可选属性。
   - 可输出一个 `.base` 或配置建议，让用户用 Bases 浏览年度素材。

4. Canvas 可选
   - 生成 `YYYY Annual Review.canvas` 作为视觉回顾墙：月份、代表笔记、主题群、链接网络。
   - 不作为 MVP 强依赖，因为 Canvas 布局成本更高。

### 分享形式

- 本地生成 PNG/SVG/HTML share cards，默认脱敏，只包含用户选择公开的数据。
- 分享图优先竖版卡片，适配小红书/朋友圈/微博。
- 不默认上传云端；AI 摘要也应提供本地/外部服务明确 opt-in。

## 调研 2：最适配技术与最佳实践

### 技术选择

| 层级 | 推荐 | 理由 |
| --- | --- | --- |
| 插件语言 | TypeScript + Obsidian API | 官方插件路径，类型和生态最匹配。来源：[Obsidian Developer Docs](https://docs.obsidian.md/Home)。 |
| 模板/构建 | 官方 `obsidian-sample-plugin` + esbuild | 官方模板依赖最新 `obsidian.d.ts`，并提供 TypeScript、manifest、styles、构建发布基础。来源：[obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)。 |
| 数据读取 | `app.vault.getMarkdownFiles()`、`vault.cachedRead()`、`metadataCache`、文件事件 | 官方 Vault 文档示例即用 `Vault` 读取 Markdown 文件并计算内容长度。来源：[Obsidian Developer Docs: Vault](https://docs.obsidian.md/Plugins/Vault)。 |
| UI | 原生 DOM + `ItemView`；图表可用轻量 SVG/Canvas | 避免引入重型前端框架；Obsidian 主题/CSS 兼容性更好。 |
| 持久化 | `loadData()`/`saveData()` 保存索引缓存与设置；报告内容写入 Markdown 文件 | 私有缓存和用户可见成果分离，便于同步和迁移。 |
| AI/主题分析 | MVP 先做规则/统计；AI 摘要作为可选 provider | 用户 vault 隐私敏感；AI 需要明确 opt-in、脱敏和数据预览。 |

### 推荐数据模型

核心实体：

- `NoteStats`：path、ctime、mtime、frontmatter、tags、links、wordCount、charCount、headingCount、taskCount、folder、month。
- `YearAggregate`：year、activeDays、createdCount、modifiedCount、totalWords、monthBuckets、topTags、topLinks、topFolders、topNotes。
- `ThemeCluster`：label、keywords、notes、months、confidence、source。
- `ReportSection`：id、title、metric、evidenceNotes、renderedMarkdown、shareCardConfig。

数据口径：

- 明确区分 created、modified、content-in-year 三类指标。
- 对中文优先用字符数/CJK-aware tokenizer；英文用 word tokenizer；报告中同时显示「字数/字符数」口径。
- 默认排除 `.obsidian/`、templates、attachments、归档目录；允许用户配置 include/exclude。
- 对 AI/主题标签必须保留 evidence notes，避免不可解释。

### Spec 与测试建议

建议先写规格，再实现：

- `SPEC.md`：数据范围、隐私边界、统计口径、UI 入口、导出格式。
- `fixtures/`：小型 vault 样本，覆盖中文、英文、混合语言、frontmatter、tags、links、daily notes、tasks。
- `docs/validation.md`：手工验证流程，包含 Obsidian 桌面启动、生成报告、重算、导出、移动端只读检查。

测试分层：

- 单元测试：tokenizer、frontmatter 解析、路径过滤、月度聚合、top N 稳定排序。
- fixture 测试：给定 vault 样本，快照比对 `YearAggregate` 和生成 Markdown。
- 插件集成测试：在测试 vault 中加载插件，执行命令，确认输出文件和 view 状态。
- E2E/手工测试：Obsidian Electron 环境自动化可以后置；MVP 阶段至少保留可重复手工脚本。

### 插件联动方式

优先「读取 Markdown 事实」，谨慎依赖第三方插件 API：

- Dataview：读取 frontmatter/inline fields 产生的数据形态；如果检测到 Dataview，可提供 query snippet 或兼容字段，但核心统计不要依赖 Dataview 运行。
- Bases/Properties：把年度报告需要的字段写成标准 properties，便于用户用 Bases 继续查看。
- Daily Notes / Periodic Notes：通过路径模式、文件名日期、frontmatter 日期识别，不强依赖插件。
- Tasks：解析 Markdown task 语法和常见 done/date markers；检测 Tasks 插件时再扩展高级语法。
- Kanban/Projects：它们多以 Markdown/YAML 保存 board/project 信息，可作为输入源，但要把解析逻辑放在 adapter 层。
- Canvas：可输出 JSON Canvas 文件，但必须保留 Markdown 报告作为主产物。

### 风险与边界

- 性能：大 vault 全量扫描要做增量索引、节流、缓存；不要在启动时阻塞。
- 隐私：默认本地处理；外部 AI/导出/分享必须显式确认范围。
- 数据准确性：年度报告对「为什么我是这个结果」非常敏感，必须有数据口径页和 evidence 链接。
- 主题兼容：UI 遵守 Obsidian CSS 变量，避免固定颜色和过度动画。
- 移动端：MVP 可保证生成的 Markdown 可读；复杂 dashboard 可先标注桌面优先。

## 建议实施路线

### Phase 0：规格和样本

- 写 `SPEC.md`、测试 vault fixtures、统计口径表。
- 确认 MVP 不使用云端 AI，不新增重依赖。

### Phase 1：本地统计引擎

- 实现文件扫描、tokenizer、metadata 抽取、缓存和年度聚合。
- 输出稳定 JSON 和 Markdown 报告。

### Phase 2：Obsidian UI

- 命令、设置页、ribbon/status bar、dashboard `ItemView`。
- 支持年份/范围筛选、重算、打开报告。

### Phase 3：叙事与导出

- 主题/标签/链接故事模块。
- 分享卡导出，默认脱敏。
- 可选 Canvas/Bases 输出。

### Phase 4：插件联动与 AI

- Adapter 层支持 Dataview/Bases/Daily Notes/Tasks/Kanban/Projects。
- AI 摘要作为 opt-in provider，要求数据预览、脱敏和本地缓存。

## 最小验收建议

第一版完成时应能验证：

- 在一个包含中文日记、英文笔记、标签、链接、任务、frontmatter 的测试 vault 中生成年度报告。
- 报告包含全年总量、活跃天数、月度趋势、top 标签/链接/文件夹、代表笔记、数据口径。
- 用户能从命令面板生成/重算/打开报告。
- 所有输出均留在 vault 内，且无需联网。
- 对外分享需要用户显式选择导出内容。

