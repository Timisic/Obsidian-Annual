import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAiPrompt, buildCodexPrompt, buildLocalCodexEnv, formatLocalCodexFailure, renderAiReportEnhancements, renderAiReportSection } from "../src/core/ai";
import { buildYearAggregate } from "../src/core/aggregate";
import { extractNoteStats, parseFrontmatter, parseObsidianWikilinks } from "../src/core/extract";
import { shouldIncludePath } from "../src/core/filters";
import { buildHighValueNoteInsights } from "../src/core/highValueNotes";
import { buildAnnualReviewChartAssets, buildAnnualReviewChartPaths, renderAnnualReview } from "../src/core/render";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { countText } from "../src/core/tokenizer";
import { toTopicEvolutionJson } from "../src/core/topics";
import { buildWritingGrowthReport, countWritingWords } from "../src/core/writingGrowth";
import { COMMAND_IDS, COMMAND_NAMES } from "../src/core/commands";
import { writeAnnualReviewOutput } from "../src/obsidian/reportWriter";
import { readVaultMarkdownFiles } from "../src/obsidian/vaultFiles";
import { fixtureFile, fixtureVault } from "./fixtures";

describe("tokenizer", () => {
  it("counts English words, CJK characters, and mixed text", () => {
    expect(countText("hello annual review").words).toBe(3);
    expect(countText("年度回顾").words).toBe(4);
    expect(countText("hello 年度 review").words).toBe(4);
  });
});

describe("writing growth", () => {
  it("counts writing words after removing frontmatter, code blocks, and Markdown syntax", () => {
    const markdown = [
      "---",
      "tags: [draft]",
      "---",
      "# 标题",
      "",
      "hello [[Project Note|项目笔记]] and [visible link](https://example.com)",
      "",
      "```ts",
      "const hiddenWords = 'not counted';",
      "```",
      "",
      "- [ ] 继续写作",
    ].join("\n");

    expect(countWritingWords(markdown)).toBe(16);
  });

  it("builds daily/monthly growth, streaks, top days, feedback, charts, and Markdown", () => {
    const report = buildWritingGrowthReport(
      [
        {
          date: "2026-01-01",
          files: {
            "Daily/A.md": { words: 100 },
            "Projects/B.md": { words: 20 },
          },
        },
        {
          date: "2026-01-02",
          files: {
            "Daily/A.md": { words: 180 },
            "Projects/B.md": { words: 20 },
          },
        },
        {
          date: "2026-01-03",
          files: {
            "Daily/A.md": { words: 200 },
            "Projects/B.md": { words: 120 },
          },
        },
        {
          date: "2026-02-01",
          files: {
            "Daily/A.md": { words: 210 },
            "Projects/B.md": { words: 150 },
            "Projects/C.md": { words: 70 },
          },
        },
      ],
      {
        period: "year",
        year: 2026,
        writingDayThreshold: 50,
      },
    );

    expect(report.summary).toMatchObject({
      total_added_words: 310,
      writing_days: 3,
      longest_streak: 2,
      current_streak: 0,
      peak_month: "2026-01",
      baseline_only: false,
    });
    expect(report.summary.top_days[0]).toEqual({
      date: "2026-01-03",
      added_words: 120,
      main_files: ["Projects/B.md", "Daily/A.md"],
    });
    expect(report.daily.find((day) => day.date === "2026-01-02")?.cumulativeWords).toBe(80);
    expect(report.monthly.find((month) => month.month === "2026-02")?.addedWords).toBe(110);
    expect(report.chartAssets.map((asset) => asset.kind)).toEqual(["word-growth", "monthly-word-growth", "writing-heatmap"]);
    expect(report.markdown).toContain("## 写作增长");
    expect(report.markdown).toContain("![[2026-word-growth.svg]]");
    expect(report.markdown).toContain("### 反馈信号");
  });

  it("marks first run reports as a baseline-only recording", () => {
    const report = buildWritingGrowthReport(
      [
        {
          date: "2026-05-03",
          files: {
            "Inbox.md": { words: 42 },
          },
        },
      ],
      {
        period: "month",
        month: "2026-05",
      },
    );

    expect(report.summary.baseline_only).toBe(true);
    expect(report.summary.baseline_message).toBe("从本次开始记录，下一次运行后将开始计算准确增长。");
    expect(report.markdown).toContain("从本次开始记录");
  });

  it("runs the standalone writing growth CLI with snapshot persistence", () => {
    const outDir = mkdtempSync(join(tmpdir(), "writing-growth-"));
    try {
      const output = execFileSync(
        "node",
        ["scripts/writing-growth-report.mjs", "--vault", "tests/fixtures/vault", "--year", "2026", "--history", "none", "--out", outDir],
        { encoding: "utf8" },
      );
      const [jsonPath, markdownPath] = output.trim().split(/\r?\n/u);
      expect(jsonPath).toContain("2026-writing-growth.json");
      expect(markdownPath).toContain("2026-writing-growth.md");
      expect(JSON.parse(readFileSync(jsonPath ?? "", "utf8")).baseline_only).toBe(true);
      expect(readFileSync(markdownPath ?? "", "utf8")).toContain("从本次开始记录");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("filters", () => {
  it("excludes generated reports, templates, archive folders, and non-markdown files", () => {
    expect(shouldIncludePath("Daily/2026-01-01.md", DEFAULT_SETTINGS)).toBe(true);
    expect(shouldIncludePath("Annual Reviews/2026 Annual Review.md", DEFAULT_SETTINGS)).toBe(false);
    expect(shouldIncludePath("Templates/Daily Template.md", DEFAULT_SETTINGS)).toBe(false);
    expect(shouldIncludePath("Archive/Old.md", DEFAULT_SETTINGS)).toBe(false);
    expect(shouldIncludePath("Assets/photo.png", DEFAULT_SETTINGS)).toBe(false);
  });
});

describe("extraction", () => {
  it("parses common Obsidian wiki-link forms", () => {
    expect(parseObsidianWikilinks("[[笔记]] [[笔记|别名]] [[笔记#标题]] ![[图片#区域|预览]]")).toEqual([
      {
        raw: "[[笔记]]",
        target: "笔记",
        heading: undefined,
        alias: undefined,
        embedded: false,
      },
      {
        raw: "[[笔记|别名]]",
        target: "笔记",
        heading: undefined,
        alias: "别名",
        embedded: false,
      },
      {
        raw: "[[笔记#标题]]",
        target: "笔记",
        heading: "标题",
        alias: undefined,
        embedded: false,
      },
      {
        raw: "![[图片#区域|预览]]",
        target: "图片",
        heading: "区域",
        alias: "预览",
        embedded: true,
      },
    ]);
  });

  it("extracts frontmatter, tags, links, headings, and tasks", async () => {
    const source = await fixtureFile("Daily/2026-01-01.md", "2026-01-01T08:00:00.000Z");
    const note = extractNoteStats(source, DEFAULT_SETTINGS);
    expect(note.frontmatter.tags).toEqual(["journal", "中文"]);
    expect(note.tags).toEqual(["journal", "writing", "中文"]);
    expect(note.links).toContain("Projects/Research");
    expect(note.headings).toContain("Morning");
    expect(note.tasks).toEqual({ total: 2, completed: 1 });
  });

  it("uses Obsidian resolved and unresolved link metadata when provided", () => {
    const note = extractNoteStats(
      {
        path: "Daily/2026-01-03.md",
        ctime: Date.parse("2026-01-03T08:00:00.000Z"),
        mtime: Date.parse("2026-01-03T08:00:00.000Z"),
        content: "[[Research|alias]]\n[[Missing Note]]",
        resolvedLinks: {
          "Projects/Research.md": 4,
          "Shared/Collision.md": 1,
        },
        unresolvedLinks: {
          "Missing Note": 2,
          "Shared/Collision.md": 3,
        },
      },
      DEFAULT_SETTINGS,
    );

    expect(note.linkCounts).toEqual({
      "Missing Note": 2,
      "Projects/Research.md": 4,
      "Shared/Collision.md": 4,
    });
    expect(note.links).toEqual(["Missing Note", "Projects/Research.md", "Shared/Collision.md"]);
  });

  it("falls back to counting raw wiki-link targets outside Obsidian metadata", () => {
    const note = extractNoteStats(
      {
        path: "Daily/2026-01-04.md",
        ctime: Date.parse("2026-01-04T08:00:00.000Z"),
        mtime: Date.parse("2026-01-04T08:00:00.000Z"),
        content: ["[[Research|alias]]", "[[Projects/Research#Plan]]", "![[Research]]"].join("\n"),
      },
      DEFAULT_SETTINGS,
    );

    expect(note.linkCounts).toEqual({
      "Projects/Research": 1,
      Research: 2,
    });
  });

  it("omits link metrics when link collection is disabled", () => {
    const note = extractNoteStats(
      {
        path: "Daily/2026-01-04.md",
        ctime: Date.parse("2026-01-04T08:00:00.000Z"),
        mtime: Date.parse("2026-01-04T08:00:00.000Z"),
        content: "[[Research]]",
        resolvedLinks: {
          "Projects/Research.md": 1,
        },
      },
      {
        ...DEFAULT_SETTINGS,
        includeLinks: false,
      },
    );

    expect(note.links).toEqual([]);
    expect(note.linkCounts).toEqual({});
  });

  it("parses a small YAML frontmatter subset", () => {
    expect(parseFrontmatter("---\ntags: [a, b]\ncategory:\n  - work\n  - personal\n主题: [AI工作流]\ndraft: true\n---\nBody").frontmatter).toEqual({
      tags: ["a", "b"],
      category: ["work", "personal"],
      主题: ["AI工作流"],
      draft: true,
    });
  });

  it("extracts multiline Obsidian frontmatter tags", async () => {
    const note = extractNoteStats(await fixtureFile("Projects/Legacy.md", "2025-12-20T08:00:00.000Z", "2026-04-05T10:00:00.000Z"), DEFAULT_SETTINGS);
    expect(note.frontmatter.tags).toEqual(["legacy", "research"]);
    expect(note.tags).toEqual(["legacy", "research"]);
  });

  it("removes frontmatter-derived tags when frontmatter metrics are disabled", async () => {
    const note = extractNoteStats(await fixtureFile("Projects/Legacy.md", "2025-12-20T08:00:00.000Z", "2026-04-05T10:00:00.000Z"), {
      ...DEFAULT_SETTINGS,
      includeFrontmatter: false,
    });
    expect(note.frontmatter).toEqual({});
    expect(note.tags).toEqual([]);
  });
});

describe("aggregation and rendering", () => {
  it("builds a deterministic year aggregate from fixture vault files", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    expect(aggregate.createdCount).toBe(3);
    expect(aggregate.modifiedCount).toBe(4);
    expect(aggregate.activeDays).toBe(6);
    expect(aggregate.longestStreak).toBe(3);
    expect(aggregate.topTags[0]).toEqual({ name: "journal", count: 2 });
    expect(aggregate.topFolders).toContainEqual({ name: "Daily", count: 2 });
    expect(aggregate.topLinks).toContainEqual({ name: "Projects/Research", count: 2 });
    expect(aggregate.highValueNotes.some((note) => note.path === "Projects/Research.md")).toBe(true);
    expect(aggregate.representativeNotes.map((note) => note.path)).toEqual([
      "Daily/2026-01-01.md",
      "Projects/Legacy.md",
      "Projects/Research.md",
    ]);
    expect(aggregate.dayBuckets).toHaveLength(365);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-01-01")?.words).toBeGreaterThan(0);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-04-05")?.words).toBe(0);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-04-05")?.modified).toBe(1);
    expect(aggregate.wordGrowthBuckets).toHaveLength(12);
    expect(aggregate.wordGrowthBuckets[0]?.wordsGained).toBeGreaterThan(0);
    expect(aggregate.wordGrowthBuckets[aggregate.wordGrowthBuckets.length - 1]?.cumulativeWords).toBe(aggregate.totalWords);
    expect(aggregate.monthBuckets[3]?.modified).toBe(1);
    expect(aggregate.monthBuckets[3]?.words).toBe(0);
    expect(aggregate.topicEvolution.topTopics.length).toBeGreaterThan(0);
    expect(aggregate.topicEvolution.topTopics.length).toBeLessThanOrEqual(8);
  });

  it("builds topic evolution from frontmatter, tags, folders, and report-only fallback clusters", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "Writing/AI Workflow.md",
          ctime: Date.parse("2026-01-10T08:00:00.000Z"),
          mtime: Date.parse("2026-01-12T08:00:00.000Z"),
          frontmatter: {
            topics: ["AI Workflow", "Writing System", "Obsidian Automation", "Overflow Topic"],
          },
          content: "# AI Workflow\n\nCreated words for a durable artificial intelligence workflow note.",
        },
        {
          path: "Projects/Obsidian Report.md",
          ctime: Date.parse("2026-11-05T08:00:00.000Z"),
          mtime: Date.parse("2026-11-06T08:00:00.000Z"),
          content: "# Report\n\n#topic/Obsidian-Data-Report fast growing topic content.",
        },
        {
          path: "Reading Methods.md",
          ctime: Date.parse("2026-02-01T08:00:00.000Z"),
          mtime: Date.parse("2026-02-01T08:00:00.000Z"),
          content: "# Reading Methods\n\nUnlabeled note that relies on report-only fallback clustering.",
        },
        {
          path: "Maintenance/March.md",
          ctime: Date.parse("2026-03-01T08:00:00.000Z"),
          mtime: Date.parse("2026-03-01T08:00:00.000Z"),
          frontmatter: { topic: "Maintenance" },
          content: "Small maintenance note.",
        },
        {
          path: "Maintenance/April.md",
          ctime: Date.parse("2026-04-01T08:00:00.000Z"),
          mtime: Date.parse("2026-04-01T08:00:00.000Z"),
          frontmatter: { topic: "Maintenance" },
          content: "Small maintenance note.",
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );

    const assignments = aggregate.topicEvolution.noteAssignments;
    const frontmatterAssignment = assignments.find((assignment) => assignment.path === "Writing/AI Workflow.md");
    expect(frontmatterAssignment?.topics).toEqual(["AI Workflow", "Writing System", "Obsidian Automation"]);
    expect(frontmatterAssignment?.sources).toEqual({
      "AI Workflow": "frontmatter",
      "Writing System": "frontmatter",
      "Obsidian Automation": "frontmatter",
    });
    expect(frontmatterAssignment?.topics).toHaveLength(3);

    const tagAssignment = assignments.find((assignment) => assignment.path === "Projects/Obsidian Report.md");
    expect(tagAssignment?.topics).toContain("Obsidian Data Report");
    expect(tagAssignment?.sources["Obsidian Data Report"]).toBe("tag");
    expect(tagAssignment?.topics).not.toContain("Projects");

    const fallbackAssignment = assignments.find((assignment) => assignment.path === "Reading Methods.md");
    expect(fallbackAssignment?.topics).toEqual(["Reading Methods"]);
    expect(fallbackAssignment?.sources["Reading Methods"]).toBe("ai-cluster");

    expect(aggregate.topicEvolution.emergingTopics).toContain("Obsidian Data Report");
    expect(aggregate.topicEvolution.decliningTopics).toContain("Reading Methods");
    expect(aggregate.topicEvolution.monthlyBuckets.find((bucket) => bucket.month === "2026-11")?.topics["Obsidian Data Report"]).toBeGreaterThan(0);

    const json = toTopicEvolutionJson(aggregate.topicEvolution);
    expect(json).toMatchObject({
      top_topics: expect.any(Array),
      emerging_topics: expect.arrayContaining(["Obsidian Data Report"]),
      declining_topics: expect.arrayContaining(["Reading Methods"]),
    });
  });

  it("filters month folders from topics and prefers content-derived fallback names", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "1月/AI 焦虑.md",
          ctime: Date.parse("2026-01-10T08:00:00.000Z"),
          mtime: Date.parse("2026-01-10T08:00:00.000Z"),
          content: "# AI 焦虑\n\n" + repeatedWords(120),
        },
        {
          path: "2026-02/财务压力.md",
          ctime: Date.parse("2026-02-10T08:00:00.000Z"),
          mtime: Date.parse("2026-02-10T08:00:00.000Z"),
          content: "# 财务压力\n\n" + repeatedWords(120),
        },
        {
          path: "2026月复盘/4月/2026-04-24 夜半散步.md",
          ctime: Date.parse("2026-04-24T08:00:00.000Z"),
          mtime: Date.parse("2026-04-24T08:00:00.000Z"),
          content: repeatedWords(120),
        },
        {
          path: "Projects/亲密关系.md",
          ctime: Date.parse("2026-03-10T08:00:00.000Z"),
          mtime: Date.parse("2026-03-10T08:00:00.000Z"),
          frontmatter: {
            topics: ["亲密关系"],
          },
          content: "# 关系复盘\n\n" + repeatedWords(120),
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );

    const topicNames = aggregate.topicEvolution.topTopics.map((topic) => topic.name);
    expect(topicNames).toEqual(expect.arrayContaining(["AI 焦虑", "财务压力", "亲密关系", "夜半散步"]));
    expect(topicNames).not.toEqual(expect.arrayContaining(["1月", "4月", "2026 02", "2026 04 24 夜半散步", "2026-02"]));

    const markdown = renderAnnualReview(aggregate, { language: "zh" });
    expect(markdown).toContain("AI 焦虑");
    expect(markdown).toContain("财务压力");
    expect(markdown).not.toContain("本期增长最多的是「1月」");
    expect(markdown).not.toContain("建立或更新「1月」相关 MOC");
  });

  it("uses Obsidian-resolved link counts when available", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "Projects/Research.md",
          ctime: Date.parse("2026-02-10T08:00:00.000Z"),
          mtime: Date.parse("2026-02-10T08:00:00.000Z"),
          content: "# Research\n\nTarget note.",
        },
        {
          path: "Daily/2026-01-03.md",
          ctime: Date.parse("2026-01-03T08:00:00.000Z"),
          mtime: Date.parse("2026-01-03T08:00:00.000Z"),
          content: [
            "[[Research|research alias]]",
            "[[Projects/Research#Plan]]",
            "![[Research]]",
            "[Markdown link](Research.md)",
          ].join("\n"),
          resolvedLinks: {
            "Projects/Research.md": 4,
          },
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );

    expect(aggregate.topLinks).toContainEqual({ name: "Projects/Research.md", count: 4 });
    expect(aggregate.topLinks).not.toContainEqual({ name: "Research", count: 1 });
    expect(aggregate.topLinks).not.toContainEqual({ name: "Projects/Research", count: 1 });
    expect(aggregate.highValueNotes[0]?.inboundLinks).toBe(4);

    const markdown = renderAnnualReview(aggregate);
    expect(markdown).not.toContain("- [[Projects/Research.md]]: 4");
    expect(markdown).toContain("## High Value Notes");
  });

  it("renders the annual review with required plain Markdown sections", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);
    expect(markdown).toContain("# 2026 Annual Review");
    expect(markdown).toMatch(/^---\ngenerated: ".+"\nyear: 2026\nincluded_scope: "All Markdown files"\nexcluded_scope: "\.obsidian, Templates, Archive, Attachments"\nprivacy_mode: "standard"\nreport_language: "en"\n---/u);
    expect(markdown).not.toContain("Generated:");
    expect(markdown).not.toContain("Included scope:");
    expect(markdown).not.toContain("Excluded scope:");
    expect(markdown.match(/^## .+$/gmu)).toEqual([
      "## Annual Overview",
      "## Writing Growth",
      "## Topic Evolution",
      "## High Value Notes",
      "## Next-Period Actions",
    ]);
    expect(markdown).toContain("| Total new words |");
    expect(markdown).toContain("| Writing days |");
    expect(markdown).toContain("| Longest writing streak |");
    expect(markdown).toContain("### Cumulative Growth");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-daily-cumulative\"");
    expect(markdown).toContain("### Monthly New Notes");
    expect(markdown).toContain("### Heatmap");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-heatmap\"");
    expect(markdown).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(markdown).toContain("<rect");
    expect(markdown).toContain("| Month | Words | Active days | Peak day |");
    expect(markdown).not.toContain("Legend: . = 0 words");
    expect(markdown).not.toMatch(/[░▒▓█]/u);
    expect(markdown).not.toContain("## Word Growth Trend");
    expect(markdown).toContain("Notes created in each active month");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-growth\"");
    expect(markdown).not.toContain("| Month | Word growth | Cumulative words |");
    expect(markdown).toContain("## Topic Evolution");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-topic-evolution\"");
    expect(markdown).toContain("content-thread synthesis is generated only when summarization is enabled");
    expect(markdown).not.toContain("| Topic | Added words | New notes | Representative Notes |");
    expect(markdown).not.toContain("| Topic | Added words | New notes | Updated notes |");
    expect(markdown).not.toContain("### Feedback Signals");
    expect(markdown).toContain("### Activity Reading");
    expect(markdown).toContain("Writing appeared on");
    expect(markdown).toContain("Writing volume is concentrated");
    expect(markdown).not.toContain("Tasks completed");
    expect(markdown).not.toContain("## Tasks And Project Notes");
    expect(markdown).not.toContain("## Year Totals");
    expect(markdown).not.toContain("## Monthly Timeline");
    expect(markdown).not.toContain("## Top Tags");
    expect(markdown).not.toContain("## Top Links");
    expect(markdown).not.toContain("## Top Folders");
    expect(markdown).toContain("## High Value Notes");
    expect(markdown).toContain("### Top 10 high-value notes");
    expect(markdown).not.toContain("### Output-ready notes");
    expect(markdown).not.toContain("### Notes needing maintenance");
    expect(markdown).not.toContain("| Note | Type | Value reason | Suggested action |");
    expect(markdown).not.toContain("#### [[");
    expect(markdown).toContain("- [[");
    for (const line of markdown.split(/\r?\n/u).filter((line) => line.startsWith("| "))) {
      expect(line).not.toMatch(/\[\[[^\]]+\|[^\]]+\]\]/u);
    }
    expect(markdown).not.toContain("score");
    expect(markdown).not.toContain("## Representative Notes");
    expect(markdown).not.toContain("Representative notes are selected deterministically");
    expect(markdown).not.toContain("## Data Methodology");
    expect(markdown).not.toContain("## Suggested Next-Year Actions");
    expect(markdown).toContain("## Next-Period Actions");
    expect(markdown).toContain("1. Create a compact index");
    expect(markdown).toContain("2. ");
    expect(markdown).toContain("3. Move forward");
    expect(markdown).toContain("[[Daily/2026-01-01|2026-01-01]]");
  });

  it("renders Chinese reports and omits all-zero month metric columns", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "Archive source.md",
          ctime: new Date("2025-12-01T08:00:00.000Z").getTime(),
          mtime: new Date("2026-04-01T08:00:00.000Z").getTime(),
          content: "legacy content",
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );
    const markdown = renderAnnualReview(aggregate, { language: "zh" });
    expect(markdown).toContain("report_language: \"zh\"");
    expect(markdown).toContain("# 2026 年度回顾");
    expect(markdown.match(/^## .+$/gmu)).toEqual([
      "## 年度总览",
      "## 写作增长",
      "## 主题演化",
      "## 高价值笔记",
      "## 下期行动",
    ]);
    expect(markdown).toContain("### 累计增长");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-daily-cumulative\"");
    expect(markdown).toContain("### 每月新增笔记");
    expect(markdown).toContain("### 热力图");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-heatmap\"");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-growth\"");
    expect(markdown).toContain("## 主题演化");
    expect(markdown).not.toContain("### 反馈信号");
    expect(markdown).toContain("## 高价值笔记");
    expect(markdown).not.toContain("### 可输出笔记");
    expect(markdown).not.toContain("### 需维护笔记");
    expect(markdown).toContain("## 下期行动");
    expect(markdown).not.toContain("## 年度统计");
    expect(markdown).not.toContain("## 月度时间线");
    expect(markdown).not.toContain("代表笔记采用确定性规则选择");
  });

  it("renders AI-synthesized themes and high-value reasons when AI enhancements are present", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate, {
      aiEnabled: true,
      aiEnhancements: {
        periodJudgment: "The year centers on turning daily writing into a research review loop.",
        themeInsights: [
          {
            title: "Research review loop",
            synthesis: "Daily notes and project notes form a reusable evidence loop.",
            connections: "Connects daily capture to project synthesis.",
            evidenceNotes: ["Daily/2026-01-01.md", "Projects/Research.md"],
            nextQuestion: "Which project note should become the entry point?",
          },
        ],
        highValueNotes: [
          {
            path: "Projects/Research.md",
            reason: "This note links source evidence back to the project synthesis and can become the review hub.",
            suggestedAction: "Turn it into a compact Obsidian index with evidence notes.",
          },
        ],
        nextActions: ["Create a review hub from [[Projects/Research]]."],
      },
    });

    expect(markdown).toContain("## Topic Evolution");
    expect(markdown).toContain("### Content Threads");
    expect(markdown).toContain("Research review loop");
    expect(markdown).toContain("[[Daily/2026-01-01]]");
    expect(markdown).not.toContain("| Theme |");
    expect(markdown).not.toContain("| Note | Type | AI value reason | Suggested action |");
    expect(markdown).toContain("#### [[Projects/Research|Research]]");
    expect(markdown).toContain("This note links source evidence back to the project synthesis");
    expect(markdown).toContain("1. Create a review hub from [[Projects/Research]].");
    expect(markdown).not.toContain("### Feedback Signals");
  });

  it("can reference generated chart SVG assets instead of embedding chart SVG in the note", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const chartPaths = buildAnnualReviewChartPaths(DEFAULT_SETTINGS.reportFolder, 2026);
    const markdown = renderAnnualReview(aggregate, { chartPaths });
    const chartAssets = buildAnnualReviewChartAssets(aggregate, { chartPaths });

    expect(markdown).toContain("![[Annual Reviews/2026 Annual Review Assets/daily-cumulative-words.svg|Cumulative Growth|900]]");
    expect(markdown).toContain("![[Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg|Daily Word Heatmap|900]]");
    expect(markdown).toContain("![[Annual Reviews/2026 Annual Review Assets/word-growth-trend.svg|Monthly New Notes|900]]");
    expect(markdown).toContain("![[Annual Reviews/2026 Annual Review Assets/topic-evolution.svg|Topic evolution|900]]");
    expect(markdown).not.toContain("<svg");
    expect(markdown).toContain("| Month | Words | Active days | Peak day |");
    expect(markdown).not.toContain("| Month | Word growth | Cumulative words |");

    expect(chartAssets).toHaveLength(5);
    expect(chartAssets.map((asset) => asset.path)).toEqual([
      "Annual Reviews/2026 Annual Review Assets/daily-cumulative-words.svg",
      "Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg",
      "Annual Reviews/2026 Annual Review Assets/word-growth-trend.svg",
      "Annual Reviews/2026 Annual Review Assets/topic-evolution.svg",
      "Annual Reviews/2026 Annual Review Assets/topic-evolution.json",
    ]);
    expect(chartAssets[0]?.content).toContain("class=\"annual-review-chart annual-review-daily-cumulative\"");
    expect(chartAssets[1]?.content).toContain("class=\"annual-review-chart annual-review-heatmap\"");
    expect(chartAssets[2]?.content).toContain("class=\"annual-review-chart annual-review-growth\"");
    expect(chartAssets[2]?.content).toContain("<rect");
    expect(chartAssets[2]?.content).not.toContain("class=\"chart-line\"");
    expect(chartAssets[3]?.content).toContain("class=\"annual-review-chart annual-review-topic-evolution\"");
    expect(chartAssets[4]?.content).toContain("\"top_topics\"");
    expect(chartAssets[4]?.content).toContain("\"emerging_topics\"");
    expect(chartAssets[4]?.content).toContain("\"declining_topics\"");
  });

  it("identifies high-value, maintenance, output-ready, and isolated potential notes", () => {
    const notes = [
      noteFrom({
        path: "AI工作流.md",
        ctime: "2026-01-01T08:00:00.000Z",
        mtime: "2026-04-20T08:00:00.000Z",
        content: "# AI工作流\n#ai #writing\n[[读书方法]]\n" + repeatedWords(360),
      }),
      noteFrom({
        path: "Obsidian数据报告.md",
        ctime: "2026-02-01T08:00:00.000Z",
        mtime: "2026-04-25T08:00:00.000Z",
        content: "# Obsidian数据报告\n#obsidian\n[[AI工作流]]\n[[写作系统]]\n[[读书方法]]\n" + repeatedWords(330),
      }),
      noteFrom({
        path: "写作系统.md",
        ctime: "2026-03-01T08:00:00.000Z",
        mtime: "2026-04-22T08:00:00.000Z",
        content: "# 写作系统\n#writing\n[[AI工作流]]\n[[读书方法]]\n" + repeatedWords(340),
      }),
      noteFrom({
        path: "读书方法.md",
        ctime: "2025-08-01T08:00:00.000Z",
        mtime: "2026-01-01T08:00:00.000Z",
        content: "# 读书方法\n#writing\n" + repeatedWords(380),
      }),
      noteFrom({
        path: "孤立潜力.md",
        ctime: "2026-04-01T08:00:00.000Z",
        mtime: "2026-04-01T08:00:00.000Z",
        content: "# 孤立潜力\n#ideas\n" + repeatedWords(360),
      }),
      noteFrom({
        path: "输出文章.md",
        ctime: "2026-02-05T08:00:00.000Z",
        mtime: "2026-04-28T08:00:00.000Z",
        content: "# 输出文章\n#writing\n[[AI工作流]]\n" + repeatedWords(500),
      }),
    ];

    const insights = buildHighValueNoteInsights(notes, 2026, "2026-05-03T00:00:00.000Z");

    expect(insights.highValueNotes).toHaveLength(6);
    expect(insights.highValueNotes.every((note) => note.reason.length > 0)).toBe(true);
    expect(insights.highValueNotes.every((note) => typeof note.suggestedAction === "string")).toBe(true);
    expect(insights.highValueNotes.find((note) => note.path === "AI工作流.md")?.inboundLinks).toBe(3);
    expect(insights.highValueNotes.find((note) => note.path === "AI工作流.md")?.outboundLinks).toBe(1);
    expect(insights.maintenanceNotes).toContainEqual(
      expect.objectContaining({
        path: "读书方法.md",
        suggestedAction: "更新关键结论并补一段现状评估",
      }),
    );
    expect(insights.outputReadyNotes.map((note) => note.path)).toContain("输出文章.md");
    expect(insights.isolatedPotentialNotes).toContainEqual(
      expect.objectContaining({
        path: "孤立潜力.md",
        suggestedAction: "补 2-3 个上下文链接后整理成输出草稿",
      }),
    );
    expect(new Set(insights.highValueNotes.map((note) => note.suggestedAction)).size).toBeGreaterThan(1);
    expect(insights.highValueNotes.map((note) => note.suggestedAction)).not.toContain("建立 MOC");
    expect(insights.highValueFeedback.staleCoreCount).toBe(1);
  });

  it("limits high-value notes to a Top 10 result set", () => {
    const notes = Array.from({ length: 12 }, (_, index) =>
      noteFrom({
        path: `Ideas/Note ${String(index + 1).padStart(2, "0")}.md`,
        ctime: "2026-04-01T08:00:00.000Z",
        mtime: "2026-04-20T08:00:00.000Z",
        content: `# Note ${index + 1}\n#ideas\n${repeatedWords(320 + index)}`,
      }),
    );

    const insights = buildHighValueNoteInsights(notes, 2026, "2026-05-03T00:00:00.000Z");

    expect(insights.highValueNotes).toHaveLength(10);
    expect(insights.highValueNotes[0]?.path).toBe("Ideas/Note 12.md");
  });
});

describe("AI provider", () => {
  it("uses local Codex auth when ChatGPT is selected without an API key", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const prompts: string[] = [];
    const section = await renderAiReportSection({
      aggregate,
      files: await fixtureVault(),
      settings: {
        ...DEFAULT_SETTINGS,
        aiProvider: "chatgpt",
      },
      fetcher: async () => {
        throw new Error("fetch should not be called without an API key");
      },
      codexExecutor: async (prompt) => {
        prompts.push(prompt);
        return { ok: true, content: "### Local draft\n\nUse [[Daily/2026-01-01]] as evidence." };
      },
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("\"topLinks\"");
    expect(section).toBe("Use [[Daily/2026-01-01]] as evidence.");
    expect(section).toContain("[[Daily/2026-01-01]]");
    expect(section).not.toContain("Provider:");
    expect(section).not.toContain("AI Integration TODO");
  });

  it("passes the configured local Codex command to the fallback executor", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const commands: string[] = [];
    const absoluteCommand = '/Users/hong/.npm-global/bin/codex exec --color never --sandbox read-only --skip-git-repo-check --output-last-message "$CODEX_ANNUAL_REVIEW_OUTPUT" -';
    const section = await renderAiReportSection({
      aggregate,
      files: await fixtureVault(),
      settings: {
        ...DEFAULT_SETTINGS,
        aiProvider: "chatgpt",
        localCodexCommand: absoluteCommand,
      },
      codexExecutor: async (_prompt, command) => {
        commands.push(command);
        return { ok: true, content: "Local Codex used the configured command." };
      },
    });

    expect(commands).toEqual([absoluteCommand]);
    expect(section).toBe("Local Codex used the configured command.");
  });

  it("reports a readable provider status when local Codex generation is unavailable", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const section = await renderAiReportSection({
      aggregate,
      files: await fixtureVault(),
      settings: {
        ...DEFAULT_SETTINGS,
        aiProvider: "chatgpt",
      },
      codexExecutor: async () => ({ ok: false, content: "codex auth missing" }),
    });

    expect(section).toContain("AI summary unavailable:");
    expect(section).toContain("local Codex generation was unavailable");
    expect(section).toContain("codex auth missing");
    expect(section).not.toContain("AI Integration TODO");
  });

  it("builds a local Codex environment with common macOS CLI install paths", () => {
    const env = buildLocalCodexEnv({ PATH: "/usr/bin:/bin" }, "/tmp/annual-review-output.md");

    expect(env.CODEX_ANNUAL_REVIEW_OUTPUT).toBe("/tmp/annual-review-output.md");
    expect(env.PATH?.split(":").slice(0, 4)).toEqual([
      "/Users/hong/.npm-global/bin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
    ]);
  });

  it("formats Codex command-not-found errors with actionable guidance", () => {
    const message = formatLocalCodexFailure(
      DEFAULT_SETTINGS.localCodexCommand,
      "bash: codex: command not found\nPRIVATE_VAULT_CONTENT",
      "SECRET_PROMPT_TEXT",
      127,
      "/Users/hong/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    );

    expect(message).toContain("Local Codex was not found from Obsidian's runtime PATH");
    expect(message).toContain("running localCodexCommand");
    expect(message).toContain(DEFAULT_SETTINGS.localCodexCommand);
    expect(message).toContain("/Users/hong/.npm-global/bin/codex exec");
    expect(message).toContain("bash: codex: command not found");
    expect(message).not.toContain("PRIVATE_VAULT_CONTENT");
    expect(message).not.toContain("SECRET_PROMPT_TEXT");
  });

  it("uses Obsidian skill and note-link context for the local Codex prompt", async () => {
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const prompt = buildCodexPrompt(aggregate, files, DEFAULT_SETTINGS);

    expect(prompt).toContain("obsidianSkillHandoff");
    expect(prompt).toContain("obsidian-cli");
    expect(prompt).toContain("obsidian-markdown");
    expect(prompt).toContain("obsidian-bases");
    expect(prompt).toContain("\"highValueNotes\"");
    expect(prompt).toContain("\"topLinks\"");
    expect(prompt).toContain("\"contextNotes\"");
    expect(prompt).toContain("\"backlinks\"");
    expect(prompt.length).toBeLessThan(24_000);
  });

  it("calls the OpenAI Responses API and renders returned ChatGPT content", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const section = await renderAiReportSection({
      aggregate,
      files: await fixtureVault(),
      settings: {
        ...DEFAULT_SETTINGS,
        aiProvider: "chatgpt",
        chatGptApiKey: "test-key",
        chatGptModel: "gpt-test",
      },
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ output_text: "### Personalized draft\n\nUse [[Daily/2026-01-01]] as evidence." }), { status: 200 });
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0]?.init.method).toBe("POST");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(String(calls[0]?.init.body)).toContain("\"model\":\"gpt-test\"");
    expect(section).toBe("Use [[Daily/2026-01-01]] as evidence.");
    expect(section).toContain("[[Daily/2026-01-01]]");
    expect(section).not.toContain("Provider:");
  });

  it("normalizes AI-authored .md wikilinks for Obsidian Markdown", async () => {
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const enhancements = await renderAiReportEnhancements({
      aggregate,
      files,
      settings: {
        ...DEFAULT_SETTINGS,
        aiProvider: "chatgpt",
        chatGptApiKey: "test-key",
      },
      fetcher: async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              periodJudgment: "Use [[Daily/2026-01-01.md]] as evidence.",
              themeInsights: [
                {
                  title: "Research loop",
                  synthesis: "Connect [[Daily/2026-01-01.md]] to project synthesis.",
                  connections: "[[Projects/Research.md]] carries the backlink.",
                  evidenceNotes: ["[[Daily/2026-01-01.md]]"],
                  nextQuestion: "How should [[Projects/Research.md]] evolve?",
                },
              ],
              highValueNotes: [
                {
                  path: "Projects/Research.md",
                  reason: "[[Projects/Research.md]] links the evidence.",
                  suggestedAction: "Update [[Projects/Research.md]].",
                },
              ],
              nextActions: ["Promote [[Projects/Research.md]]."],
            }),
          }),
          { status: 200 },
        ),
    });

    expect(enhancements.periodJudgment).toContain("[[Daily/2026-01-01]]");
    expect(enhancements.themeInsights[0]?.connections).toContain("[[Projects/Research]]");
    expect(enhancements.themeInsights[0]?.evidenceNotes).toEqual(["Daily/2026-01-01"]);
    expect(enhancements.highValueNotes[0]?.reason).toContain("[[Projects/Research]]");
    expect(enhancements.nextActions[0]).toContain("[[Projects/Research]]");
  });

  it("builds provider context from annual stats, links, and note evidence", async () => {
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const prompt = buildAiPrompt(aggregate, files, DEFAULT_SETTINGS);

    expect(prompt).toContain("\"topLinks\"");
    expect(prompt).toContain("Projects/Research");
    expect(prompt).toContain("\"linkGraph\"");
    expect(prompt).toContain("\"contextNotes\"");
    expect(prompt).toContain("Daily/2026-01-01.md");
    expect(prompt).toContain("Linked to [[Projects/Research]]");
  });

  it("builds provider context with Obsidian-resolved link destinations", () => {
    const files = [
      {
        path: "Daily/2026-01-03.md",
        ctime: Date.parse("2026-01-03T08:00:00.000Z"),
        mtime: Date.parse("2026-01-03T08:00:00.000Z"),
        content: "[[Research|alias]]\n[Markdown link](Research.md)",
        resolvedLinks: {
          "Projects/Research.md": 2,
        },
      },
    ];
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const prompt = buildAiPrompt(aggregate, files, DEFAULT_SETTINGS);
    const context = JSON.parse(prompt) as { linkGraph: Array<{ links: string[] }>; contextNotes: Array<{ links: string[] }> };

    expect(prompt).toContain("\"topLinks\"");
    expect(prompt).toContain("Projects/Research.md");
    expect(context.linkGraph[0]?.links).toEqual(["Projects/Research.md"]);
    expect(context.contextNotes[0]?.links).toEqual(["Projects/Research.md"]);
  });
});

describe("Obsidian vault adapter", () => {
  it("passes metadata cache link counts into source files", async () => {
    const app = {
      vault: {
        getMarkdownFiles: () => [
          {
            path: "Daily/2026-01-03.md",
            stat: {
              ctime: Date.parse("2026-01-03T08:00:00.000Z"),
              mtime: Date.parse("2026-01-03T09:00:00.000Z"),
            },
          },
        ],
        cachedRead: async () => "[[Research|alias]]",
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { tags: ["journal"] } }),
        resolvedLinks: {
          "Daily/2026-01-03.md": {
            "Projects/Research.md": 2,
          },
        },
        unresolvedLinks: {
          "Daily/2026-01-03.md": {
            "Missing Note": 1,
          },
        },
      },
    };

    const files = await readVaultMarkdownFiles(app as unknown as Parameters<typeof readVaultMarkdownFiles>[0], DEFAULT_SETTINGS);

    expect(files).toEqual([
      {
        path: "Daily/2026-01-03.md",
        ctime: Date.parse("2026-01-03T08:00:00.000Z"),
        mtime: Date.parse("2026-01-03T09:00:00.000Z"),
        frontmatter: { tags: ["journal"] },
        resolvedLinks: {
          "Projects/Research.md": 2,
        },
        unresolvedLinks: {
          "Missing Note": 1,
        },
        content: "[[Research|alias]]",
      },
    ]);
  });

  it("writes chart SVG artifacts before writing the annual report note", async () => {
    const writes: string[] = [];
    const files = new Map<string, { path: string; content: string }>();
    const folders = new Set<string>();
    const app = {
      vault: {
        getFolderByPath: (path: string) => folders.has(path) ? { path } : null,
        createFolder: async (path: string) => {
          folders.add(path);
        },
        getFileByPath: (path: string) => files.get(path) ?? null,
        create: async (path: string, content: string) => {
          writes.push(path);
          const file = { path, content };
          files.set(path, file);
          return file;
        },
        modify: async (file: { path: string; content: string }, content: string) => {
          writes.push(file.path);
          file.content = content;
        },
      },
    };

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      "# 2026 Annual Review",
      [
        {
          kind: "daily-word-heatmap",
          path: "Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg",
          content: "<svg />",
        },
      ],
    );

    expect(writes).toEqual([
      "Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg",
      "Annual Reviews/2026 Annual Review.md",
    ]);
    expect(files.get("Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg")?.content).toBe("<svg />");
    expect(files.get("Annual Reviews/2026 Annual Review.md")?.content).toBe("# 2026 Annual Review");
  });
});

describe("plugin command ids", () => {
  it("exposes stable command ids and English command palette labels", () => {
    expect(COMMAND_IDS).toEqual({
      generate: "generate-annual-review",
      generate2026Smoke: "generate-annual-review-2026",
      openDashboard: "open-annual-review-dashboard",
      rebuildIndex: "rebuild-annual-review-index",
    });
    expect(COMMAND_NAMES).toEqual({
      generate: "Generate report",
      generate2026Smoke: "Generate 2026 report (smoke)",
      openDashboard: "Open dashboard",
      rebuildIndex: "Rebuild index",
    });
  });
});

function sectionBetween(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex);
  return markdown.slice(startIndex, endIndex);
}

function noteFrom(input: { path: string; ctime: string; mtime: string; content: string }) {
  return extractNoteStats(
    {
      path: input.path,
      ctime: Date.parse(input.ctime),
      mtime: Date.parse(input.mtime),
      content: input.content,
    },
    DEFAULT_SETTINGS,
  );
}

function repeatedWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
