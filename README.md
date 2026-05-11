# Obsidian Time Range Review

[English](README.en.md) | [文档索引](docs/README.md) | [SPEC](docs/product-specification.md)

Obsidian Time Range Review is an AI-assisted review plugin that helps users rediscover forgotten notes, uncover hidden themes across a selected time range, and generate evidence-backed Markdown review reports inside their vault.

它是一个本地优先、证据约束的 Obsidian 时间范围复盘插件。用户可以选择年度、季度、月度或自定义时间范围，
让插件编译源笔记证据包，用 AI 生成可复核的语义主题假设和连接解释，
再把用户确认后的主题、证据和说明写入 vault 内的 Markdown 复盘报告。

它解决四个问题：

- **遗忘**：一段时间写了很多笔记，复盘时只记得最近、最强烈或标题最显眼的内容。
- **连接断裂**：笔记之间的真实关系常常没有被双链、标签或文件夹完整表达。
- **不信任一次性 AI 总结**：AI 可以写出漂亮总结，但用户需要知道它看了什么、为什么这样连接、哪些结论仍需复核。
- **复盘范围不止一年**：真实复盘可能是年度、季度、月度，也可能是任意项目期、休假期、学习期或恢复期。

插件的承诺不是“一键替你总结人生”，而是：

```text
选择时间范围 -> 编译证据笔记 -> 生成主题假设 -> 用户复核 -> 写入确认后的 Markdown 报告
```

Annual Review 只是一个 preset；同一套产品定义也覆盖 Quarterly Review、Monthly Review 和 Custom Range。
每个 Theme Hypothesis / 主题假设都必须绑定 Evidence Notes / 证据笔记、连接解释和不确定性说明；
用户需要在 Review Board 中接受、改名、合并或忽略后，主题才会进入最终报告。

## 适合谁

- 用 Obsidian 写 daily notes、工作记录、读书笔记、研究笔记或 evergreen notes 的个人用户。
- 想复盘一段时间，而不想先手动整理完整个 vault 的用户。
- 希望 AI 帮忙提炼主题和解释关系，但不希望 AI 替自己下结论的人。
- 需要把复盘结果留在本地 Markdown，并能用 Obsidian Sync、Git 或其他版本管理工具审阅差异的人。

## 核心概念

| 概念                        | 含义                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| Review Session              | 一次复盘的时间范围、扫描范围、隐私设置、AI 设置、状态和报告路径。 |
| Evidence Note               | 进入证据包的源笔记，带路径、标题、摘录、链接和时间信号。          |
| Evidence Cluster            | 一组可能互相关联、共同支撑某条主题假设的证据笔记。                |
| Theme Hypothesis / 主题假设 | 插件基于证据簇提出的主题主线。它是待复核假设，不是用户结论。      |
| Theme Decision              | 用户对主题假设的接受、改名、合并或忽略。                          |
| Review Report               | 写入 vault 的 Markdown 复盘报告，只沉淀用户确认后的内容和证据。   |

项目线索、任务线索、行动项和归档判断相关能力会作为后续扩展重新评估，
但不属于当前 MVP 的核心对象或首屏承诺。

## Review Board 复核闭环

`Annual Review: Open Review Board` 打开当前 Review Session 的主题假设队列。
每张主题卡片展示：

- 主题标题和一句话解释。
- 代表 Evidence Notes。
- 这些笔记为什么可能属于同一条思考线的 Connection Explanation。
- 证据链接、摘录和不确定性说明。
- 用户操作：Accept、Rename、Merge、Ignore、Open Source Note。

主题假设需要用户复核。插件可以提示“这些笔记可能共同表达了什么”，
但最终报告只写入用户确认过的主题名称、解释、证据和用户补充。

## AI 的角色

AI 是核心分析层中的 **主题假设生成器和关系解释器**，不是最后一步的美化器：

- 它只基于受控 Evidence Package 生成语义 Theme Hypotheses。
- 它解释 Evidence Notes 之间细微但可追溯的连接。
- 它必须把输出绑定到源笔记、摘录、路径和用户可复核的理由。
- 它标注不确定性和需要用户重点复核的地方。
- 它可以在用户确认主题后辅助整理报告文字，但不能替代证据复核和主题判断。

用户必须显式选择 AI provider 或本地 CLI 路径，并在发送前确认时间范围、摘录数量、排除范围和目标边界。
插件应避免不受控的全 vault 总结：它先编译范围内证据包，再把有限上下文交给 AI 或本地规则生成可复核假设。
默认模式不访问网络、不调用外部 provider、不发送遥测。

## 图表的角色

图表保留在 Review Report 中作为 activity evidence / 活动证据。它们帮助用户理解：

- activity rhythm / 活跃节奏；
- writing bursts / 写作爆发；
- dormant periods / 沉寂阶段；
- theme formation context / 主题形成的时间背景。

图表支持主题复盘和证据解释，但不主导产品身份；核心仍是证据包、AI 主题假设、用户复核和 Markdown 报告。

## 和完整提示词的差异

一份强提示词也可以让大模型读取大量笔记并生成总结。插件额外提供的是：

- 本地扫描和范围控制：Annual / Quarterly / Monthly / Custom Range、include/exclude、隐私边界。
- 证据可复核：每个主题假设绑定 Obsidian 源笔记、摘录和连接解释。
- 用户确认状态：接受、改名、合并、忽略会保存到 Review Session。
- 可复现输出：报告只写入用户确认内容，重新生成不覆盖用户手写区。
- Obsidian 原生体验：直接打开源笔记，长期保留 Markdown 工件。

## TODO: Prompt-vs-Plugin Benchmark

After the core product loop is complete, compare this plugin against a strong prompt that asks an LLM to read the same vault and summarize the review themes.

The benchmark should compare:

- missed important notes;
- evidence accuracy;
- theme stability;
- user reviewability;
- Obsidian navigation;
- privacy and context control;
- regeneration consistency.

## 隐私与编辑保护

- 默认不访问网络，不调用外部 AI，不发送 telemetry。
- 默认只读取当前 vault 内允许范围的 Markdown 和 Obsidian metadata cache。
- 报告目录、模板、附件和用户排除范围不会进入扫描输入。
- 生成内容写入插件管理区块，用户手写区块保留给个人叙事和修改。
- 重新生成只替换可再生区块，不覆盖用户手写内容。
- 每个主题假设和连接解释都保留源笔记证据，用户可复核后再采纳。

## 安装和路径边界

文档中的 vault 路径分为三类，避免把测试路径当成用户路径：

- **普通用户 vault**：用户自己的 Obsidian vault。社区插件安装和手动安装都以这个路径为目标。
- **repo-local validation vault**：`tests/fixtures/obsidian-smoke-vault`，用于单元测试样本和本仓库内 Review Board 部署验证。
- **自定义 smoke vault**：自动化 agent/release reviewer 可通过 `SMOKE_VAULT_PATH` 指向显式提供的本地测试 vault；它不是普通用户安装路径。

### 从 Obsidian 社区插件安装

插件进入社区插件列表后：

1. 打开 Obsidian `Settings -> Community plugins`。
2. 搜索 **Annual Review**。
3. 点击 **Install**，再点击 **Enable**。

### 手动安装发布包

```bash
npm install
npm run release:plugin
```

然后复制发布产物到 vault 插件目录：

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

打开 Obsidian 后，在 `Settings -> Community plugins` 中启用 **Annual Review**。

## 当前可用命令

| 命令                               | 用途                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `Annual Review: Rebuild index`     | 重新扫描当前 Review Session 允许范围内的 Markdown 笔记，并记录 snapshot。       |
| `Annual Review: Open Review Board` | 打开主题假设队列，用于复核证据笔记、连接解释和主题决策。                        |
| `Annual Review: Generate report`   | 为 Annual / Quarterly / Monthly / Custom Range 写入受保护的 Markdown 复盘报告。 |

## 开发命令

| 命令                | 用途                                       |
| ------------------- | ------------------------------------------ |
| `npm run test`      | 运行 Vitest。                              |
| `npm run typecheck` | 运行 TypeScript 类型检查，不生成构建文件。 |
| `npm run build`     | 生成可安装到 Obsidian 的插件 bundle。      |
| `npm run format`    | 使用 Prettier 格式化代码和文档。           |

## 本地验证

```bash
npm install
npm run test
npm run typecheck
npm run build
```

手动 smoke 路径：

1. 安装并启用插件。
2. 创建 Annual、Quarterly、Monthly 或 Custom Range Review Session。
3. 运行 `Annual Review: Rebuild index`。
4. 打开 Review Board，确认 Theme Hypotheses、Evidence Notes、Connection Explanation 和复核操作可见。
5. 接受、改名、合并或忽略若干主题假设。
6. 运行 `Annual Review: Generate report`。
7. 确认报告只包含用户确认后的主题、证据链接、方法说明和用户手写区，并且源笔记可回链打开。

## 更多文档

- [Product Definition](docs/product-definition.md)
- [SPEC](docs/product-specification.md)
- [Prompt-vs-Plugin Benchmark](docs/prompt-vs-plugin-benchmark.md)
- [Roadmap](docs/roadmap.md)
- [文档索引](docs/README.md)
- [Data Methodology](docs/data-methodology.md)
- [发布检查清单](docs/release-checklist.md)
