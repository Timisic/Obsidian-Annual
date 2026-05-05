# Agent 安装指南

本文面向用户的 Agent，用于帮用户把 Obsidian Annual Review 安装到一个 Obsidian vault 中。这个仓库是 Obsidian 插件仓库，普通用户只需要安装、启用并运行插件。

默认仓库地址：`https://github.com/Timisic/Obsidian-Annual.git`

## Agent 任务

请完成以下目标：

1. 获取仓库源码。
2. 安装依赖。
3. 构建 Obsidian 插件产物。
4. 把插件复制到用户指定 vault 的 `.obsidian/plugins/annual-review/` 目录。
5. 告诉用户如何在 Obsidian 中启用插件并生成第一份年度回顾。

## 前置条件

- Node.js 20 或更新版本。
- npm。
- Git。
- 用户提供一个 Obsidian vault 路径。

如果用户没有提供 vault 路径，先询问 vault 的本地路径。不要猜测用户的私人 vault 位置。

## 获取仓库

```bash
git clone https://github.com/Timisic/Obsidian-Annual.git
cd Obsidian-Annual
```

## 安装依赖并构建

```bash
npm install
npm run release:plugin
```

构建成功后，`dist/annual-review/` 会包含手动安装所需的发布资产。

## 安装到用户的 Obsidian vault

推荐使用仓库脚本：

```bash
npm run deploy:plugin -- --target /path/to/YourVault/.obsidian
```

把 `/path/to/YourVault` 替换为用户的 vault 路径。

也可以手动复制：

```bash
VAULT="/path/to/YourVault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/annual-review"
mkdir -p "$PLUGIN_DIR"
cp dist/annual-review/{manifest.json,main.js,styles.css} "$PLUGIN_DIR/"
```

## 让用户在 Obsidian 中启用插件

安装完成后，请让用户打开 Obsidian，并按以下步骤操作：

1. 打开 Settings。
2. 进入 Community plugins。
3. 如果 Safe mode 或 Restricted mode 已开启，先允许社区插件。
4. 在 Installed plugins 中启用 **Annual Review**。
5. 打开 Annual Review 设置页，确认报告目录、包含/排除目录、报告语言、隐私模式和 AI provider。

## 生成第一份年度回顾

让用户在 Obsidian 命令面板中依次运行：

1. `Annual Review: Rebuild index`
2. `Annual Review: Generate report`

然后检查：

- 报告文件：`Annual Reviews/YYYY Annual Review.md`
- 图表资产目录：`Annual Reviews/YYYY Annual Review Assets/`
- 报告中的 Obsidian wiki link 是否能打开源笔记。

需要先看指标时，可以运行：

```text
Annual Review: Open Review Board
```

## ChatGPT 设置

默认 `AI provider` 为 `None`，插件会在本地生成报告，不访问网络。

如果用户想使用 ChatGPT：

1. 打开 Annual Review 设置页。
2. 将 `AI provider` 改为 `ChatGPT`。
3. 有 OpenAI API key 时，填入 `OpenAI API key`。
4. 没有 API key 时，可以配置本机 Codex CLI 路径作为本地 fallback。
5. 提醒用户：ChatGPT 模式会把年度报告所需的统计、链接关系和部分笔记摘录发送到所选生成路径。

## 常见问题

### Obsidian 中看不到插件

检查插件文件是否位于：

```text
/path/to/YourVault/.obsidian/plugins/annual-review/
```

并确认目录内至少包含：

```text
manifest.json
main.js
styles.css
```

### 构建失败

请确认 Node.js 和 npm 可用：

```bash
node --version
npm --version
```

然后重新运行：

```bash
npm install
npm run build
```

### 生成报告为空或内容很少

检查插件设置中的 include / exclude 目录。若 include 目录设置过窄，插件可能只扫描了少量笔记。

### macOS Obsidian 找不到 codex

GUI 应用的 PATH 可能缺少 shell 初始化路径。把 `Local Codex command` 改成 `codex` 可执行文件的绝对路径。
