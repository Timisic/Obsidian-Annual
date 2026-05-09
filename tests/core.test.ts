import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildAiPrompt,
  buildCodexPrompt,
  buildLocalCodexEnv,
  formatLocalCodexFailure,
  renderAiReportEnhancements,
  renderAiReportSection,
} from "../src/core/ai";
import { buildYearAggregate } from "../src/core/aggregate";
import { buildExplanationReasons } from "../src/core/explain";
import {
  extractNoteStats,
  parseFrontmatter,
  parseObsidianWikilinks,
} from "../src/core/extract";
import { shouldIncludePath } from "../src/core/filters";
import { buildHighValueNoteInsights } from "../src/core/highValueNotes";
import {
  buildAnnualReviewChartAssets,
  buildAnnualReviewChartPaths,
  renderAnnualReview,
} from "../src/core/render";
import { buildReviewSession } from "../src/core/reviewCandidates";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import {
  createVaultSnapshot,
  normalizeSnapshotFile,
  selectSnapshotComparison,
  SNAPSHOT_SCHEMA_VERSION,
} from "../src/core/snapshot";
import { countText } from "../src/core/tokenizer";
import { toTopicEvolutionJson } from "../src/core/topics";
import { buildWritingGrowthReport, countWritingWords } from "../src/core/writingGrowth";
import { COMMAND_IDS, COMMAND_NAMES, COMMAND_SURFACE } from "../src/core/commands";
import type { ReviewCandidate, ReviewSessionState } from "../src/core/reviewState";
import {
  ANNUAL_REVIEW_END_MARKER,
  ANNUAL_REVIEW_START_MARKER,
  writeAnnualReviewOutput,
} from "../src/obsidian/reportWriter";
import {
  AnnualReviewProgressIndicator,
  clampProgress,
} from "../src/obsidian/progressModal";
import { getAnnualReviewDashboardLeaf } from "../src/obsidian/dashboardLeaf";
import {
  getActionCandidateId,
  getNextReviewSelection,
} from "../src/obsidian/reviewSelection";
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
    expect(report.daily.find((day) => day.date === "2026-01-02")?.cumulativeWords).toBe(
      80,
    );
    expect(report.monthly.find((month) => month.month === "2026-02")?.addedWords).toBe(
      110,
    );
    expect(report.chartAssets.map((asset) => asset.kind)).toEqual([
      "word-growth",
      "monthly-word-growth",
      "writing-heatmap",
    ]);
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
    expect(report.summary.baseline_message).toBe(
      "从本次开始记录，下一次运行后将开始计算准确增长。",
    );
    expect(report.markdown).toContain("从本次开始记录");
  });

  it("runs the standalone writing growth CLI with snapshot persistence", () => {
    const outDir = mkdtempSync(join(tmpdir(), "writing-growth-"));
    try {
      const output = execFileSync(
        "node",
        [
          "scripts/writing-growth-report.mjs",
          "--vault",
          "tests/fixtures/obsidian-smoke-vault",
          "--year",
          "2026",
          "--history",
          "none",
          "--out",
          outDir,
        ],
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
    expect(
      shouldIncludePath("Annual Reviews/2026 Annual Review.md", DEFAULT_SETTINGS),
    ).toBe(false);
    expect(shouldIncludePath("Templates/Daily Template.md", DEFAULT_SETTINGS)).toBe(
      false,
    );
    expect(shouldIncludePath("Archive/Old.md", DEFAULT_SETTINGS)).toBe(false);
    expect(shouldIncludePath("Assets/photo.png", DEFAULT_SETTINGS)).toBe(false);
  });
});

describe("vault snapshots", () => {
  it("creates deterministic snapshots from the filtered vault scope", async () => {
    const snapshot = createVaultSnapshot(
      await fixtureVault(),
      {
        ...DEFAULT_SETTINGS,
        excludePatterns: ["2026-01-02"],
      },
      "2026-05-08T00:00:00.000Z",
    );

    expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.scope).toMatchObject({
      includeFolders: [],
      excludeFolders: [".obsidian", "Archive", "Attachments", "Templates"],
      excludePatterns: ["2026-01-02"],
      reportFolder: "Annual Reviews",
    });
    expect(snapshot.notes.map((note) => note.path)).toEqual([
      "Daily/2026-01-01.md",
      "Projects/Legacy.md",
      "Projects/Research.md",
    ]);
    expect(snapshot.notes).not.toContainEqual(
      expect.objectContaining({ path: "Annual Reviews/2026 Annual Review.md" }),
    );
    expect(snapshot.notes).not.toContainEqual(
      expect.objectContaining({ path: "Archive/Old.md" }),
    );
    expect(snapshot.notes[0]).toMatchObject({
      folder: "Daily",
      modifiedTime: Date.parse("2026-01-01T10:00:00.000Z"),
      tags: ["journal", "writing", "中文"],
    });
  });

  it("normalizes snapshot files and computes real deltas across imports and batch mtimes", () => {
    const baseline = createVaultSnapshot(
      [
        sourceFrom({
          path: "Projects/Stable.md",
          ctime: "2025-01-01T08:00:00.000Z",
          mtime: "2026-01-01T08:00:00.000Z",
          content: "one two three",
        }),
      ],
      DEFAULT_SETTINGS,
      "2026-01-01T00:00:00.000Z",
    );
    const current = createVaultSnapshot(
      [
        sourceFrom({
          path: "Projects/Stable.md",
          ctime: "2025-01-01T08:00:00.000Z",
          mtime: "2026-04-01T08:00:00.000Z",
          content: "one two three",
        }),
        sourceFrom({
          path: "Projects/Imported.md",
          ctime: "2024-01-01T08:00:00.000Z",
          mtime: "2026-04-01T08:00:00.000Z",
          content: "imported words are real vault growth",
        }),
      ],
      DEFAULT_SETTINGS,
      "2026-04-01T00:00:00.000Z",
    );

    const normalized = normalizeSnapshotFile({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      snapshots: [current, baseline],
    });
    const comparison = selectSnapshotComparison(normalized.snapshots, current);

    expect(normalized.snapshots.map((snapshot) => snapshot.capturedAt)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]);
    expect(comparison).toMatchObject({
      source: "historical-snapshot",
      baselineCapturedAt: "2026-01-01T00:00:00.000Z",
      currentCapturedAt: "2026-04-01T00:00:00.000Z",
      wordDelta: 6,
      addedNotes: ["Projects/Imported.md"],
      changedNotes: [],
    });
  });

  it("refuses historical deltas when snapshot scan scopes differ", () => {
    const baseline = createVaultSnapshot(
      [
        sourceFrom({
          path: "Projects/A.md",
          ctime: "2026-01-01T08:00:00.000Z",
          mtime: "2026-01-01T08:00:00.000Z",
          content: "baseline words",
        }),
      ],
      DEFAULT_SETTINGS,
      "2026-01-01T00:00:00.000Z",
    );
    const current = createVaultSnapshot(
      [
        sourceFrom({
          path: "Projects/A.md",
          ctime: "2026-01-01T08:00:00.000Z",
          mtime: "2026-02-01T08:00:00.000Z",
          content: "baseline words plus more",
        }),
      ],
      {
        ...DEFAULT_SETTINGS,
        includeFolders: ["Projects"],
      },
      "2026-02-01T00:00:00.000Z",
    );

    expect(selectSnapshotComparison([baseline], current)).toMatchObject({
      source: "scope-mismatch",
      wordDelta: 0,
      baselineCapturedAt: "2026-01-01T00:00:00.000Z",
      currentCapturedAt: "2026-02-01T00:00:00.000Z",
    });
  });
});

describe("extraction", () => {
  it("parses common Obsidian wiki-link forms", () => {
    expect(
      parseObsidianWikilinks("[[笔记]] [[笔记|别名]] [[笔记#标题]] ![[图片#区域|预览]]"),
    ).toEqual([
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
    expect(note.links).toEqual([
      "Missing Note",
      "Projects/Research.md",
      "Shared/Collision.md",
    ]);
  });

  it("falls back to counting raw wiki-link targets outside Obsidian metadata", () => {
    const note = extractNoteStats(
      {
        path: "Daily/2026-01-04.md",
        ctime: Date.parse("2026-01-04T08:00:00.000Z"),
        mtime: Date.parse("2026-01-04T08:00:00.000Z"),
        content: [
          "[[Research|alias]]",
          "[[Projects/Research#Plan]]",
          "![[Research]]",
        ].join("\n"),
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
    expect(
      parseFrontmatter(
        "---\ntags: [a, b]\ncategory:\n  - work\n  - personal\n主题: [AI工作流]\ndraft: true\n---\nBody",
      ).frontmatter,
    ).toEqual({
      tags: ["a", "b"],
      category: ["work", "personal"],
      主题: ["AI工作流"],
      draft: true,
    });
  });

  it("extracts multiline Obsidian frontmatter tags", async () => {
    const note = extractNoteStats(
      await fixtureFile(
        "Projects/Legacy.md",
        "2025-12-20T08:00:00.000Z",
        "2026-04-05T10:00:00.000Z",
      ),
      DEFAULT_SETTINGS,
    );
    expect(note.frontmatter.tags).toEqual(["legacy", "research"]);
    expect(note.tags).toEqual(["legacy", "research"]);
  });

  it("removes frontmatter-derived tags when frontmatter metrics are disabled", async () => {
    const note = extractNoteStats(
      await fixtureFile(
        "Projects/Legacy.md",
        "2025-12-20T08:00:00.000Z",
        "2026-04-05T10:00:00.000Z",
      ),
      {
        ...DEFAULT_SETTINGS,
        includeFrontmatter: false,
      },
    );
    expect(note.frontmatter).toEqual({});
    expect(note.tags).toEqual([]);
  });
});

describe("aggregation and rendering", () => {
  it("builds a deterministic year aggregate from fixture vault files", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    expect(aggregate.createdCount).toBe(3);
    expect(aggregate.modifiedCount).toBe(4);
    expect(aggregate.activeDays).toBe(5);
    expect(aggregate.longestStreak).toBe(2);
    expect(aggregate.topTags[0]).toEqual({ name: "journal", count: 2 });
    expect(aggregate.topFolders).toContainEqual({ name: "Daily", count: 2 });
    expect(aggregate.topLinks).toContainEqual({ name: "Projects/Research", count: 2 });
    expect(
      aggregate.highValueNotes.some((note) => note.path === "Projects/Research.md"),
    ).toBe(true);
    expect(aggregate.representativeNotes.map((note) => note.path)).toEqual([
      "Daily/2026-01-01.md",
      "Projects/Legacy.md",
      "Projects/Research.md",
    ]);
    expect(aggregate.dayBuckets).toHaveLength(365);
    expect(
      aggregate.dayBuckets.find((day) => day.date === "2026-01-01")?.words,
    ).toBeGreaterThan(0);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-04-05")?.words).toBe(0);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-04-05")?.modified).toBe(
      1,
    );
    expect(aggregate.wordGrowthBuckets).toHaveLength(12);
    expect(aggregate.wordGrowthBuckets[0]?.wordsGained).toBeGreaterThan(0);
    expect(
      aggregate.wordGrowthBuckets[aggregate.wordGrowthBuckets.length - 1]
        ?.cumulativeWords,
    ).toBe(aggregate.totalWords);
    expect(aggregate.monthBuckets[3]?.modified).toBe(1);
    expect(aggregate.monthBuckets[3]?.words).toBe(0);
    expect(aggregate.topicEvolution.topTopics.length).toBeGreaterThan(0);
    expect(aggregate.topicEvolution.topTopics.length).toBeLessThanOrEqual(8);
  });

  it("uses explicit note dates to distribute flattened-mtime daily notes", async () => {
    const flattenedTime = "2026-05-09T10:55:29.000Z";
    const dailyPaths = [
      "Daily/2026月复盘/1月/2026-01-05 论个人睡眠与精神状态.md",
      "Daily/2026月复盘/2月/2026-02-05 环境促进想法转变.md",
      "Daily/2026月复盘/3月/2026-03-01 Linya不去北京了.md",
      "Daily/2026月复盘/4月/2026-04-04 懵逼同时有AI压力感.md",
      "Daily/2026月复盘/5月/2026-05-02 表达不清本质是思考不清.md",
    ];
    const aggregate = buildYearAggregate(
      await Promise.all(
        dailyPaths.map((path) => fixtureFile(path, flattenedTime, flattenedTime)),
      ),
      2026,
      DEFAULT_SETTINGS,
    );

    expect(aggregate.activityDateSources).toEqual({
      frontmatter: 0,
      path: 5,
      filesystem: 0,
    });
    expect(aggregate.activeDays).toBe(5);
    expect(aggregate.monthBuckets.slice(0, 5).every((month) => month.words > 0)).toBe(
      true,
    );
    expect(aggregate.monthBuckets[4]?.words).toBeLessThan(aggregate.totalWords);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-01-05")?.words).toBe(
      aggregate.monthBuckets[0]?.words,
    );
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-05-09")?.words).toBe(0);
  });

  it("prefers frontmatter date metadata before filesystem timestamps", () => {
    const flattenedTime = Date.parse("2026-05-09T10:55:29.000Z");
    const aggregate = buildYearAggregate(
      [
        {
          path: "Inbox/Imported note.md",
          ctime: flattenedTime,
          mtime: flattenedTime,
          content: "---\ndate: 2026-02-14\n---\n\nfrontmatter dated imported note",
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );

    expect(aggregate.activityDateSources).toEqual({
      frontmatter: 1,
      path: 0,
      filesystem: 0,
    });
    expect(aggregate.monthBuckets[1]?.words).toBeGreaterThan(0);
    expect(aggregate.monthBuckets[4]?.words).toBe(0);
  });

  it("builds topic evolution from frontmatter, tags, folders, and report-only fallback clusters", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "Writing/AI Workflow.md",
          ctime: Date.parse("2026-01-10T08:00:00.000Z"),
          mtime: Date.parse("2026-01-12T08:00:00.000Z"),
          frontmatter: {
            topics: [
              "AI Workflow",
              "Writing System",
              "Obsidian Automation",
              "Overflow Topic",
            ],
          },
          content:
            "# AI Workflow\n\nCreated words for a durable artificial intelligence workflow note.",
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
          content:
            "# Reading Methods\n\nUnlabeled note that relies on report-only fallback clustering.",
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
    const frontmatterAssignment = assignments.find(
      (assignment) => assignment.path === "Writing/AI Workflow.md",
    );
    expect(frontmatterAssignment?.topics).toEqual([
      "AI Workflow",
      "Writing System",
      "Obsidian Automation",
    ]);
    expect(frontmatterAssignment?.sources).toEqual({
      "AI Workflow": "frontmatter",
      "Writing System": "frontmatter",
      "Obsidian Automation": "frontmatter",
    });
    expect(frontmatterAssignment?.topics).toHaveLength(3);

    const tagAssignment = assignments.find(
      (assignment) => assignment.path === "Projects/Obsidian Report.md",
    );
    expect(tagAssignment?.topics).toContain("Obsidian Data Report");
    expect(tagAssignment?.sources["Obsidian Data Report"]).toBe("tag");
    expect(tagAssignment?.topics).not.toContain("Projects");

    const fallbackAssignment = assignments.find(
      (assignment) => assignment.path === "Reading Methods.md",
    );
    expect(fallbackAssignment?.topics).toEqual(["Reading Methods"]);
    expect(fallbackAssignment?.sources["Reading Methods"]).toBe("ai-cluster");

    expect(aggregate.topicEvolution.emergingTopics).toContain("Obsidian Data Report");
    expect(aggregate.topicEvolution.decliningTopics).toContain("Reading Methods");
    expect(
      aggregate.topicEvolution.monthlyBuckets.find((bucket) => bucket.month === "2026-11")
        ?.topics["Obsidian Data Report"],
    ).toBeGreaterThan(0);

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
    expect(topicNames).toEqual(
      expect.arrayContaining(["AI 焦虑", "财务压力", "亲密关系", "夜半散步"]),
    );
    expect(topicNames).not.toEqual(
      expect.arrayContaining(["1月", "4月", "2026 02", "2026 04 24 夜半散步", "2026-02"]),
    );

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
    expect(aggregate.topLinks).not.toContainEqual({
      name: "Projects/Research",
      count: 1,
    });
    expect(aggregate.highValueNotes[0]?.inboundLinks).toBe(4);

    const markdown = renderAnnualReview(aggregate);
    expect(markdown).not.toContain("- [[Projects/Research.md]]: 4");
    expect(markdown).toContain("## Review Candidates");
  });

  it("renders the annual review with required plain Markdown sections", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);
    expect(markdown).toContain("# 2026 Annual Review");
    expect(markdown).toMatch(
      /^---\ngenerated: ".+"\nyear: 2026\ngrowth_data_source: "current-vault inference"\nactivity_date_sources: "frontmatter date: 0; path\/filename date: 2; filesystem timestamp: 2"\nincluded_scope: "All Markdown files"\nexcluded_scope: "\.obsidian, Templates, Archive, Attachments"\nexcluded_patterns: "None"\nreport_folder: "Annual Reviews"\nprivacy_mode: "standard"\nreport_language: "en"\n---/u,
    );
    expect(markdown).not.toContain("Generated:");
    expect(markdown).not.toContain("Included scope:");
    expect(markdown).not.toContain("Excluded scope:");
    expect(markdown.match(/^## .+$/gmu)).toEqual([
      "## Annual Overview",
      "## Writing Growth",
      "## Topic Evolution",
      "## Review Candidates",
      "## Next-Period Actions",
      "## Data Methodology",
    ]);
    expect(markdown).toContain("| Total new words |");
    expect(markdown).toContain("| Writing days |");
    expect(markdown).toContain("| Longest writing streak |");
    expect(markdown).toContain("### Cumulative Growth");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-daily-cumulative"',
    );
    expect(markdown).toContain("### Monthly New Notes");
    expect(markdown).toContain("### Heatmap");
    expect(markdown).toContain('class="annual-review-chart annual-review-heatmap"');
    expect(markdown).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markdown).toContain("<rect");
    expect(markdown).toContain("| Month | Words | Active days | Peak day |");
    expect(markdown).not.toContain("Legend: . = 0 words");
    expect(markdown).not.toMatch(/[░▒▓█]/u);
    expect(markdown).not.toContain("## Word Growth Trend");
    expect(markdown).toContain("Notes created in each active month");
    expect(markdown).toContain('class="annual-review-chart annual-review-growth"');
    expect(markdown).not.toContain("| Month | Word growth | Cumulative words |");
    expect(markdown).toContain("## Topic Evolution");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-topic-evolution"',
    );
    expect(markdown).toContain(
      "content-thread synthesis is generated only when summarization is enabled",
    );
    expect(markdown).not.toContain(
      "| Topic | Added words | New notes | Representative Notes |",
    );
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
    expect(markdown).toContain("## Review Candidates");
    expect(markdown).toContain("No reviewed Review Board decisions are ready");
    expect(markdown).not.toContain("### Suggested review candidates");
    expect(markdown).not.toContain("### Output-ready notes");
    expect(markdown).not.toContain("### Notes needing maintenance");
    expect(markdown).not.toContain("| Note | Type | Value reason | Suggested action |");
    expect(markdown).not.toContain("#### [[");
    expect(markdown).not.toContain("Recommendation rationale:");
    expect(markdown).not.toContain("Suggestion label:");
    expect(markdown).not.toContain("Auditable reasons:");
    expect(markdown).not.toContain("Source note:");
    expect(markdown).not.toContain("Stat field:");
    expect(markdown).not.toContain("Type: 核心笔记");
    expect(markdown).not.toContain("Type: 输出候选");
    expect(markdown).not.toContain("Type: 桥接笔记");
    expect(markdown).not.toContain("Manual confirmation:");
    for (const line of markdown.split(/\r?\n/u).filter((line) => line.startsWith("| "))) {
      expect(line).not.toMatch(/\[\[[^\]]+\|[^\]]+\]\]/u);
    }
    expect(markdown).not.toContain("score");
    expect(markdown).not.toContain("## Representative Notes");
    expect(markdown).not.toContain("Representative notes are selected deterministically");
    expect(markdown).toContain("## Data Methodology");
    expect(markdown).not.toContain("## Suggested Next-Year Actions");
    expect(markdown).toContain("## Next-Period Actions");
    expect(markdown).toContain("1. Create a compact index");
    expect(markdown).toContain("2. ");
    expect(markdown).toContain("3. No review-candidate push is available");
  });

  it("warns when annual activity dates are filesystem-only", () => {
    const aggregate = buildYearAggregate(
      [
        {
          path: "Inbox.md",
          ctime: Date.parse("2026-05-09T08:00:00.000Z"),
          mtime: Date.parse("2026-05-09T08:00:00.000Z"),
          content: "filesystem only imported note",
        },
      ],
      2026,
      DEFAULT_SETTINGS,
    );
    const markdown = renderAnnualReview(aggregate, { language: "zh" });

    expect(markdown).toContain(
      "- 活动日期来源: frontmatter date: 0; 路径/文件名日期: 0; 文件系统时间戳: 1",
    );
    expect(markdown).toContain(
      "本次活动日期只能使用文件系统 ctime/mtime。如果这些文件经过复制、checkout 或批量部署",
    );
  });

  it("labels fallback growth as current-vault inference when no historical snapshot is available", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);

    expect(markdown).toContain('growth_data_source: "current-vault inference"');
    expect(markdown).toContain("Data Methodology");
    expect(markdown).toContain("current vault inference");
    expect(markdown).toContain("not a historical word-count delta");
  });

  it("renders historical snapshot statistics when comparable snapshots are available", async () => {
    const current = createVaultSnapshot(
      await fixtureVault(),
      DEFAULT_SETTINGS,
      "2026-05-08T00:00:00.000Z",
    );
    const baseline = createVaultSnapshot(
      [
        sourceFrom({
          path: "Daily/2026-01-01.md",
          ctime: "2026-01-01T08:00:00.000Z",
          mtime: "2026-01-01T10:00:00.000Z",
          content: "small baseline",
        }),
      ],
      DEFAULT_SETTINGS,
      "2026-01-01T00:00:00.000Z",
    );
    const comparison = selectSnapshotComparison([baseline], current);
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS, {
      snapshotComparison: comparison,
    });
    const markdown = renderAnnualReview(aggregate);

    expect(markdown).toContain('growth_data_source: "historical snapshot statistics"');
    expect(markdown).toContain("Growth data source: historical snapshot statistics");
    expect(markdown).toContain("- Snapshot word delta:");
    expect(markdown).not.toContain("Snapshot baseline");
    expect(markdown).not.toContain("Current snapshot");
    expect(markdown).not.toContain("2026-01-01T00:00:00.000Z");
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
    expect(markdown).toContain('report_language: "zh"');
    expect(markdown).toContain("# 2026 年度回顾");
    expect(markdown.match(/^## .+$/gmu)).toEqual([
      "## 年度总览",
      "## 写作增长",
      "## 主题演化",
      "## 候选回看笔记",
      "## 下期行动",
      "## 数据口径",
    ]);
    expect(markdown).toContain("### 累计增长");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-daily-cumulative"',
    );
    expect(markdown).toContain("### 每月新增笔记");
    expect(markdown).toContain("### 热力图");
    expect(markdown).toContain('class="annual-review-chart annual-review-heatmap"');
    expect(markdown).toContain('class="annual-review-chart annual-review-growth"');
    expect(markdown).toContain("## 主题演化");
    expect(markdown).not.toContain("### 反馈信号");
    expect(markdown).toContain("## 候选回看笔记");
    expect(markdown).toContain("还没有可写入年报的 Review Board 审核决策");
    expect(markdown).not.toContain("### 可输出笔记");
    expect(markdown).not.toContain("### 需维护笔记");
    expect(markdown).toContain("## 下期行动");
    expect(markdown).not.toContain("## 年度统计");
    expect(markdown).not.toContain("## 月度时间线");
    expect(markdown).not.toContain("代表笔记采用确定性规则选择");
  });

  it("renders AI-synthesized themes and review-candidate reasons when AI enhancements are present", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate, {
      aiEnabled: true,
      aiEnhancements: {
        periodJudgment:
          "The year centers on turning daily writing into a research review loop.",
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
            reason:
              "This note links source evidence back to the project synthesis and can become the review hub.",
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
    expect(markdown).not.toContain(
      "| Note | Type | AI value reason | Suggested action |",
    );
    expect(markdown).toContain("#### [[Projects/Research|Research]]");
    expect(markdown).toContain(
      "This note links source evidence back to the project synthesis",
    );
    expect(markdown).toContain("1. Create a review hub from [[Projects/Research]].");
    expect(markdown).not.toContain("### Feedback Signals");
  });

  it("can reference generated chart SVG assets instead of embedding chart SVG in the note", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const chartPaths = buildAnnualReviewChartPaths(DEFAULT_SETTINGS.reportFolder, 2026);
    const markdown = renderAnnualReview(aggregate, { chartPaths });
    const chartAssets = buildAnnualReviewChartAssets(aggregate, { chartPaths });

    expect(markdown).toContain(
      "![[Annual Reviews/2026 Annual Review Assets/daily-cumulative-words.svg|Cumulative Growth|900]]",
    );
    expect(markdown).toContain(
      "![[Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg|Daily Word Heatmap|900]]",
    );
    expect(markdown).toContain(
      "![[Annual Reviews/2026 Annual Review Assets/word-growth-trend.svg|Monthly New Notes|900]]",
    );
    expect(markdown).toContain(
      "![[Annual Reviews/2026 Annual Review Assets/topic-evolution.svg|Topic evolution|900]]",
    );
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
    expect(chartAssets[0]?.content).toContain(
      'class="annual-review-chart annual-review-daily-cumulative"',
    );
    expect(chartAssets[1]?.content).toContain(
      'class="annual-review-chart annual-review-heatmap"',
    );
    expect(chartAssets[2]?.content).toContain(
      'class="annual-review-chart annual-review-growth"',
    );
    expect(chartAssets[2]?.content).toContain("<rect");
    expect(chartAssets[2]?.content).not.toContain('class="chart-line"');
    expect(chartAssets[3]?.content).toContain(
      'class="annual-review-chart annual-review-topic-evolution"',
    );
    expect(chartAssets[4]?.content).toContain('"top_topics"');
    expect(chartAssets[4]?.content).toContain('"emerging_topics"');
    expect(chartAssets[4]?.content).toContain('"declining_topics"');
  });

  it("identifies review candidates, maintenance, output-ready, and isolated potential notes", () => {
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
        content:
          "# Obsidian数据报告\n#obsidian\n[[AI工作流]]\n[[写作系统]]\n[[读书方法]]\n" +
          repeatedWords(330),
      }),
      noteFrom({
        path: "写作系统.md",
        ctime: "2026-03-01T08:00:00.000Z",
        mtime: "2026-04-22T08:00:00.000Z",
        content:
          "# 写作系统\n#writing\n[[AI工作流]]\n[[读书方法]]\n" + repeatedWords(340),
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
    expect(insights.highValueNotes.every((note) => note.reasons.length > 0)).toBe(true);
    expect(
      insights.highValueNotes.every((note) =>
        note.reasons.every((reason) =>
          Boolean(
            reason.sourcePath ||
            reason.statField ||
            (reason.relatedPaths && reason.relatedPaths.length > 0),
          ),
        ),
      ),
    ).toBe(true);
    expect(
      insights.highValueNotes.every((note) =>
        ["suggested", "needs-review", "possible-bridge"].includes(note.suggestionLabel),
      ),
    ).toBe(true);
    expect(insights.highValueNotes.map((note) => note.suggestionLabel)).toContain(
      "needs-review",
    );
    expect(insights.highValueNotes.map((note) => note.suggestionLabel)).toContain(
      "possible-bridge",
    );
    expect(
      insights.highValueNotes.every((note) => typeof note.suggestedAction === "string"),
    ).toBe(true);
    expect(
      insights.highValueNotes.find((note) => note.path === "AI工作流.md")?.inboundLinks,
    ).toBe(3);
    expect(
      insights.highValueNotes.find((note) => note.path === "AI工作流.md")?.outboundLinks,
    ).toBe(1);
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
    expect(
      new Set(insights.highValueNotes.map((note) => note.suggestedAction)).size,
    ).toBeGreaterThan(1);
    expect(insights.highValueNotes.map((note) => note.suggestedAction)).not.toContain(
      "建立 MOC",
    );
    expect(insights.highValueFeedback.staleCoreCount).toBe(1);
  });

  it("generates deterministic traceable explanation reasons from local signals", () => {
    const notes = [
      noteFrom({
        path: "Hub/Research.md",
        ctime: "2026-01-01T08:00:00.000Z",
        mtime: "2026-04-25T08:00:00.000Z",
        content:
          "# Research\n#strategy\n- [x] Ship baseline\n[[Daily/2026-01-02]]\n" +
          repeatedWords(320),
      }),
      noteFrom({
        path: "Daily/2026-01-02.md",
        ctime: "2026-01-02T08:00:00.000Z",
        mtime: "2026-01-02T08:00:00.000Z",
        content: "# Daily\n#journal\n[[Hub/Research]]",
      }),
      noteFrom({
        path: "Projects/Launch.md",
        ctime: "2026-02-02T08:00:00.000Z",
        mtime: "2026-02-02T08:00:00.000Z",
        content: "# Launch\n#project\n[[Research]]",
      }),
    ];

    const reasons = buildExplanationReasons({
      note: notes[0],
      allNotes: notes,
      year: 2026,
      generatedAt: "2026-05-03T00:00:00.000Z",
    });

    expect(reasons.map((reason) => reason.type)).toEqual([
      "backlink",
      "outlink",
      "topic-bridge",
      "word-count",
      "task",
      "tag",
      "updated-at",
    ]);
    expect(reasons[0]).toMatchObject({
      type: "backlink",
      statField: "inboundLinks",
      relatedPaths: ["Daily/2026-01-02.md", "Projects/Launch.md"],
    });
    expect(reasons.every((reason) => reason.evidenceId.length > 0)).toBe(true);
    expect(
      reasons.every((reason) =>
        Boolean(
          reason.sourcePath ||
          reason.statField ||
          (reason.relatedPaths && reason.relatedPaths.length > 0),
        ),
      ),
    ).toBe(true);
  });

  it("renders no-evidence candidates without a strong recommendation", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const firstCandidate = aggregate.highValueNotes[0];
    if (!firstCandidate) {
      throw new Error("Fixture aggregate should include a review candidate.");
    }
    const markdown = renderAnnualReview({
      ...aggregate,
      highValueNotes: [
        {
          ...firstCandidate,
          reason: "Unsupported strong claim",
          reasons: [],
        },
      ],
    });

    expect(markdown).toContain("No reviewed Review Board decisions are ready");
    expect(markdown).not.toContain(
      "No auditable evidence was generated for this candidate",
    );
    expect(markdown).not.toContain("Unsupported strong claim");
    expect(markdown).not.toContain("Suggested action:");
    expect(markdown).not.toContain("Manual confirmation:");
  });

  it("renders only reviewed Review Board decisions in the default English report", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const reviewSession = reviewSessionFixture();
    const markdown = renderAnnualReview(aggregate, { reviewSession });

    expect(markdown).toContain("### Suggested review candidates");
    expect(markdown).toContain("[[Projects/Accepted|Accepted Topic]] (accepted)");
    expect(markdown).toContain("[[Projects/Renamed|Renamed Topic]] (renamed)");
    expect(markdown).toContain("[[Projects/Action|Action Topic]] (next-action)");
    expect(markdown).toContain("[[Projects/Highlight|Highlight Topic]] (candidate)");
    expect(markdown).toContain("### Annual Highlights");
    expect(markdown).not.toContain("Ignored Topic");
    expect(markdown).not.toContain("Merged Topic");
    expect(markdown).not.toContain("Unreviewed Topic");
    expect(markdown).not.toContain("accepted unsupported reason");
    expect(markdown).not.toContain("These 4 reviewed candidates are included");
    expect(markdown).not.toContain("Manual confirmation:");
    expect(markdown).toContain("1. Convert accepted topic into project");
  });

  it("renders only reviewed Review Board decisions in the default Chinese report", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate, {
      language: "zh",
      reviewSession: reviewSessionFixture(),
    });

    expect(markdown).toContain("### Suggested review candidates");
    expect(markdown).toContain("[[Projects/Accepted|Accepted Topic]] (accepted)");
    expect(markdown).toContain("[[Projects/Highlight|Highlight Topic]] (candidate)");
    expect(markdown).not.toContain("Ignored Topic");
    expect(markdown).not.toContain("Merged Topic");
    expect(markdown).not.toContain("下面 4 个已审核候选");
    expect(markdown).not.toContain("人工确认:");
  });

  it("renders wikilink-shaped Review Board topic titles as clean report aliases", async () => {
    const aggregate = buildYearAggregate(
      [
        sourceFrom({
          path: "Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了.md",
          ctime: "2026-01-01T08:00:00.000Z",
          mtime: "2026-01-01T10:00:00.000Z",
          content: "AI agent notes ".repeat(80),
        }),
      ],
      2026,
      DEFAULT_SETTINGS,
    );
    const reviewSession = reviewSessionFixture();
    reviewSession.candidates = [
      reviewCandidateFixture("clippings", "[[Clippings]]", "accepted", {
        sourcePaths: [
          "Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了.md",
        ],
      }),
    ];
    const markdown = renderAnnualReview(aggregate, {
      language: "zh",
      reviewSession,
    });
    const reviewSection = sectionBetween(markdown, "## 候选回看笔记", "## 数据口径");

    expect(reviewSection).toContain(
      "[[Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了|Clippings]] (accepted)",
    );
    expect(reviewSection).not.toContain("|[[Clippings]]");
    expect(reviewSection).not.toMatch(/\[\[[^\]|]+\|\[\[/u);
    expect(
      parseObsidianWikilinks(reviewSection).some((link) => link.target === "Clippings"),
    ).toBe(false);
  });

  it("normalizes wikilink-shaped topic names before they enter Review Board state", async () => {
    const aggregate = buildYearAggregate(
      [
        sourceFrom({
          path: "Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了.md",
          ctime: "2026-01-01T08:00:00.000Z",
          mtime: "2026-01-01T10:00:00.000Z",
          content: "AI agent notes ".repeat(80),
        }),
      ],
      2026,
      DEFAULT_SETTINGS,
    );
    aggregate.topicEvolution.topTopics = [
      {
        name: "[[Clippings]]",
        addedWords: 1200,
        newNotes: 2,
        updatedNotes: 1,
        representativeNotes: [
          "Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了.md",
        ],
      },
    ];

    const reviewSession = buildReviewSession(aggregate);
    const topicCandidate = reviewSession.candidates.find(
      (candidate) => candidate.type === "topic",
    );

    expect(topicCandidate).toMatchObject({
      title: "Clippings",
      reason: expect.stringContaining("Clippings added"),
    });
    expect(topicCandidate?.reason).not.toContain("[[Clippings]]");
  });

  it("keeps the scoring method documentation present and bounded", () => {
    const method = readFileSync("docs/scoring-method.md", "utf8");

    expect(method).toContain("统计口径");
    expect(method).toContain("阈值");
    expect(method).toContain("排序");
    expect(method).toContain("过滤边界");
    expect(method).toContain("隐私");
    expect(method).toContain("已知限制");
  });

  it("limits review candidates to a 10-note result set", () => {
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
        return {
          ok: true,
          content: "### Local draft\n\nUse [[Daily/2026-01-01]] as evidence.",
        };
      },
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('"topLinks"');
    expect(section).toBe("Use [[Daily/2026-01-01]] as evidence.");
    expect(section).toContain("[[Daily/2026-01-01]]");
    expect(section).not.toContain("Provider:");
    expect(section).not.toContain("AI Integration TODO");
  });

  it("passes the configured local Codex command to the fallback executor", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const commands: string[] = [];
    const absoluteCommand =
      '$HOME/.npm-global/bin/codex exec --color never --sandbox read-only --skip-git-repo-check --output-last-message "$CODEX_ANNUAL_REVIEW_OUTPUT" -';
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
    const env = buildLocalCodexEnv(
      { PATH: "/usr/bin:/bin" },
      "/tmp/annual-review-output.md",
    );

    expect(env.CODEX_ANNUAL_REVIEW_OUTPUT).toBe("/tmp/annual-review-output.md");
    expect(env.PATH?.split(":").slice(0, 4)).toEqual([
      join(homedir(), ".npm-global", "bin"),
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
      "$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    );

    expect(message).toContain("Local Codex was not found from Obsidian's runtime PATH");
    expect(message).toContain("running localCodexCommand");
    expect(message).toContain(DEFAULT_SETTINGS.localCodexCommand);
    expect(message).toContain("$HOME/.npm-global/bin/codex exec");
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
    expect(prompt).not.toContain("obsidian-bases");
    expect(prompt).toContain('"highValueNotes"');
    expect(prompt).toContain('"topLinks"');
    expect(prompt).toContain('"contextNotes"');
    expect(prompt).toContain('"backlinks"');
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
        return new Response(
          JSON.stringify({
            output_text:
              "### Personalized draft\n\nUse [[Daily/2026-01-01]] as evidence.",
          }),
          { status: 200 },
        );
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0]?.init.method).toBe("POST");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    expect(String(calls[0]?.init.body)).toContain('"model":"gpt-test"');
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

    expect(prompt).toContain('"topLinks"');
    expect(prompt).toContain("Projects/Research");
    expect(prompt).toContain('"linkGraph"');
    expect(prompt).toContain('"contextNotes"');
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
    const context = JSON.parse(prompt) as {
      linkGraph: Array<{ links: string[] }>;
      contextNotes: Array<{ links: string[] }>;
    };

    expect(prompt).toContain('"topLinks"');
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

    const files = await readVaultMarkdownFiles(
      app as unknown as Parameters<typeof readVaultMarkdownFiles>[0],
      DEFAULT_SETTINGS,
    );

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
    const { app, files, writes } = createReportWriterMockApp();

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      ["---", "year: 2026", "---", "# 2026 Annual Review"].join("\n"),
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
    expect(
      files.get("Annual Reviews/2026 Annual Review Assets/daily-word-heatmap.svg")
        ?.content,
    ).toBe("<svg />");
    const reportContent = files.get("Annual Reviews/2026 Annual Review.md")?.content;
    expect(reportContent?.split(/\r?\n/u)[0]).toBe("---");
    expect(reportContent?.match(/^---$/gmu)).toHaveLength(2);
    expect(reportContent).toBe(
      [
        "---",
        "year: 2026",
        "---",
        "",
        ANNUAL_REVIEW_START_MARKER,
        "# 2026 Annual Review",
        ANNUAL_REVIEW_END_MARKER,
      ].join("\n"),
    );
  });

  it("preserves user-authored content outside annual review markers when regenerating", async () => {
    const existingReport = [
      "User preface stays exactly.",
      "",
      ANNUAL_REVIEW_START_MARKER,
      "# 2026 Annual Review",
      "Old machine section.",
      ANNUAL_REVIEW_END_MARKER,
      "",
      "- [ ] User action item stays exactly.",
    ].join("\n");
    const { app, files, modifyCalls, processCalls } = createReportWriterMockApp([
      ["Annual Reviews/2026 Annual Review.md", existingReport],
    ]);

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      ["---", "year: 2026", "---", "# 2026 Annual Review", "New machine section."].join(
        "\n",
      ),
      [],
    );

    expect(processCalls).toEqual(["Annual Reviews/2026 Annual Review.md"]);
    expect(modifyCalls).not.toContain("Annual Reviews/2026 Annual Review.md");
    expect(files.get("Annual Reviews/2026 Annual Review.md")?.content).toBe(
      [
        "---",
        "year: 2026",
        "---",
        "",
        ANNUAL_REVIEW_START_MARKER,
        "# 2026 Annual Review",
        "New machine section.",
        ANNUAL_REVIEW_END_MARKER,
        "",
        "User preface stays exactly.",
        "",
        "- [ ] User action item stays exactly.",
        "",
      ].join("\n"),
    );
  });

  it("creates a full backup before converting a legacy annual report without markers", async () => {
    const legacyReport = [
      "# 2026 Annual Review",
      "",
      "User summary that must be recoverable.",
    ].join("\n");
    const { app, files, writes, processCalls } = createReportWriterMockApp([
      ["Annual Reviews/2026 Annual Review.md", legacyReport],
    ]);

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      [
        "---",
        "year: 2026",
        "---",
        "# 2026 Annual Review",
        "Regenerated machine section.",
      ].join("\n"),
      [],
    );

    const backupPath = writes.find((path) =>
      /^Annual Reviews\/2026 Annual Review Backup .+\.md$/u.test(path),
    );
    expect(backupPath).toBeDefined();
    expect(writes.indexOf(backupPath ?? "")).toBeLessThan(
      writes.indexOf("Annual Reviews/2026 Annual Review.md"),
    );
    expect(files.get(backupPath ?? "")?.content).toBe(legacyReport);
    expect(processCalls).toEqual(["Annual Reviews/2026 Annual Review.md"]);
    expect(files.get("Annual Reviews/2026 Annual Review.md")?.content).toBe(
      [
        "---",
        "year: 2026",
        "---",
        "",
        ANNUAL_REVIEW_START_MARKER,
        "# 2026 Annual Review",
        "Regenerated machine section.",
        ANNUAL_REVIEW_END_MARKER,
      ].join("\n"),
    );
  });

  it("replaces managed frontmatter once when regenerating a marked annual report", async () => {
    const existingReport = [
      "---",
      "year: 2026",
      "old: true",
      "---",
      "",
      ANNUAL_REVIEW_START_MARKER,
      "# 2026 Annual Review",
      "Old machine section.",
      ANNUAL_REVIEW_END_MARKER,
      "",
      "User notes stay.",
    ].join("\n");
    const { app, files } = createReportWriterMockApp([
      ["Annual Reviews/2026 Annual Review.md", existingReport],
    ]);

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      ["---", "year: 2026", "old: false", "---", "# 2026 Annual Review"].join("\n"),
      [],
    );

    const reportContent =
      files.get("Annual Reviews/2026 Annual Review.md")?.content ?? "";
    expect(reportContent.split(/\r?\n/u)[0]).toBe("---");
    expect(reportContent.match(/^---$/gmu)).toHaveLength(2);
    expect(reportContent).not.toContain("old: true");
    expect(reportContent).toContain("old: false");
    expect(reportContent).toContain("User notes stay.");
    expect(reportContent.match(/annual-review:start/gu)).toHaveLength(1);
    expect(reportContent.match(/annual-review:end/gu)).toHaveLength(1);
  });
});

type ReportWriterMockFile = { path: string; content: string };

function createReportWriterMockApp(initialFiles: Array<[string, string]> = []): {
  app: {
    vault: {
      getFolderByPath: (path: string) => { path: string } | null;
      createFolder: (path: string) => Promise<void>;
      getFileByPath: (path: string) => ReportWriterMockFile | null;
      create: (path: string, content: string) => Promise<ReportWriterMockFile>;
      modify: (file: ReportWriterMockFile, content: string) => Promise<void>;
      read: (file: ReportWriterMockFile) => Promise<string>;
      process: (
        file: ReportWriterMockFile,
        fn: (content: string) => string,
      ) => Promise<string>;
    };
  };
  files: Map<string, ReportWriterMockFile>;
  writes: string[];
  modifyCalls: string[];
  processCalls: string[];
} {
  const writes: string[] = [];
  const modifyCalls: string[] = [];
  const processCalls: string[] = [];
  const files = new Map<string, ReportWriterMockFile>();
  const folders = new Set<string>();

  for (const [path, content] of initialFiles) {
    files.set(path, { path, content });
    const folder = path.split("/").slice(0, -1).join("/");
    if (folder) {
      folders.add(folder);
    }
  }

  return {
    app: {
      vault: {
        getFolderByPath: (path: string) => (folders.has(path) ? { path } : null),
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
        modify: async (file: ReportWriterMockFile, content: string) => {
          writes.push(file.path);
          modifyCalls.push(file.path);
          file.content = content;
        },
        read: async (file: ReportWriterMockFile) => file.content,
        process: async (file: ReportWriterMockFile, fn: (content: string) => string) => {
          writes.push(file.path);
          processCalls.push(file.path);
          file.content = fn(file.content);
          return file.content;
        },
      },
    },
    files,
    writes,
    modifyCalls,
    processCalls,
  };
}

describe("plugin command ids", () => {
  it("exposes stable command ids and English command palette labels", () => {
    expect(COMMAND_IDS).toEqual({
      generate: "generate-annual-review",
      generateSmoke2026: "generate-annual-review-2026",
      openDashboard: "open-annual-review-dashboard",
      rebuildIndex: "rebuild-annual-review-index",
    });
    expect(COMMAND_NAMES).toEqual({
      generate: "Generate report",
      generateSmoke2026: "Smoke: Generate 2026 report",
      openDashboard: "Open Review Board",
      rebuildIndex: "Rebuild index",
    });
    expect(COMMAND_SURFACE).toEqual([
      { id: "generate-annual-review", name: "Generate report" },
      { id: "open-annual-review-dashboard", name: "Open Review Board" },
      { id: "rebuild-annual-review-index", name: "Rebuild index" },
    ]);
    expect(COMMAND_SURFACE.map((command) => command.id)).not.toContain(
      "generate-smoke-report",
    );
  });
});

describe("MVP public surface", () => {
  it("keeps package scripts on release and dev-only deploy surfaces", () => {
    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"))
      .scripts as Record<string, string>;

    expect(scripts["release:plugin"]).toBe("node scripts/deploy-plugin.mjs --no-deploy");
    expect(scripts["release:check"]).toContain("release:plugin");
    expect(scripts["dev:deploy-plugin"]).toBe("node scripts/deploy-plugin.mjs");
    expect(scripts["dev:deploy-smoke"]).toBe("node scripts/deploy-smoke.mjs");
    expect(scripts).not.toHaveProperty("deploy:plugin");
    expect(scripts).not.toHaveProperty("deploy:smoke");
    expect(scripts).not.toHaveProperty("ai:context-placeholder");
    expect(scripts).not.toHaveProperty("writing-growth");
    expect(JSON.stringify(scripts)).not.toMatch(
      /install-smoke|smoke-vault|validation vault|\/Users\/hong/u,
    );
  });

  it("keeps the smoke deploy default on a repo-local Obsidian validation vault", () => {
    const source = readFileSync(join(process.cwd(), "scripts/deploy-smoke.mjs"), "utf8");

    expect(source).toContain("tests/fixtures/obsidian-smoke-vault");
    expect(source).not.toMatch(/\/Users\/hong|install-smoke-vault/u);
  });

  it("uses the repo-local Obsidian validation vault as the only fixture vault", () => {
    const fixtureSource = readFileSync(join(process.cwd(), "tests/fixtures.ts"), "utf8");

    expect(fixtureSource).toContain('fixtures", "obsidian-smoke-vault');
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "vault"))).toBe(false);
  });

  it("keeps the Review Board view off broad dashboard analytics", () => {
    const source = readFileSync(
      join(process.cwd(), "src/obsidian/dashboardView.ts"),
      "utf8",
    );

    expect(source).toContain("reviewQueue");
    expect(source).toContain("applyReviewAction");
    expect(source).not.toMatch(
      /renderTrend|renderHeatmap|renderGrowth|topTags|topFolders|topLinks|monthlyTrend|dailyWordHeatmap|wordGrowth/u,
    );
    expect(source).toContain(
      "this.renderReviewBoard(container, reviewSession);\n    renderControls();",
    );
  });

  it("selects an existing Review Board leaf before opening a normal workspace leaf", () => {
    const existingLeaf = { id: "existing" };
    const fallbackLeaf = { id: "fallback" };
    const workspace = {
      getLeavesOfType: vi.fn(() => [existingLeaf]),
      getLeaf: vi.fn(() => fallbackLeaf),
    };

    expect(getAnnualReviewDashboardLeaf(workspace, "annual-review-dashboard")).toEqual({
      leaf: existingLeaf,
      isExistingView: true,
    });
    expect(workspace.getLeavesOfType).toHaveBeenCalledWith("annual-review-dashboard");
    expect(workspace.getLeaf).not.toHaveBeenCalled();
  });

  it("opens a new Review Board in a normal workspace leaf when none exists", () => {
    const fallbackLeaf = { id: "fallback" };
    const workspace = {
      getLeavesOfType: vi.fn(() => []),
      getLeaf: vi.fn(() => fallbackLeaf),
    };

    expect(getAnnualReviewDashboardLeaf(workspace, "annual-review-dashboard")).toEqual({
      leaf: fallbackLeaf,
      isExistingView: false,
    });
    expect(workspace.getLeaf).toHaveBeenCalledWith(false);

    const pluginSource = readFileSync(join(process.cwd(), "src/main.ts"), "utf8");
    expect(pluginSource).not.toContain("getRightLeaf");
  });

  it("uses a floating progress indicator instead of an Obsidian modal", () => {
    const progressSource = readFileSync(
      join(process.cwd(), "src/obsidian/progressModal.ts"),
      "utf8",
    );

    expect(progressSource).not.toContain("extends Modal");
    expect(progressSource).toContain("annual-review-progress-indicator");
    expect(progressSource).toContain('container.setAttribute("role", "status")');
  });

  it("updates and closes the floating progress indicator lifecycle", () => {
    withFakeDocument((root) => {
      const indicator = new AnnualReviewProgressIndicator(
        {} as ConstructorParameters<typeof AnnualReviewProgressIndicator>[0],
        "Generating 2026 annual review",
      );

      indicator.open();
      const container = root.querySelector(".annual-review-progress-indicator");
      expect(container).not.toBeNull();
      expect(container?.getAttribute("role")).toBe("status");

      indicator.update("Reading vault notes", 8);
      const status = root.querySelector(".annual-review-progress-status");
      const progress = root.querySelector("progress");
      expect(status?.textContent).toBe("Reading vault notes");
      expect(progress?.value).toBe(8);

      indicator.update("Writing annual review note", 150);
      expect(progress?.value).toBe(100);

      indicator.close();
      expect(root.children).toHaveLength(0);
    });
  });

  it("clamps progress percentages to the native progress range", () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(35)).toBe(35);
    expect(clampProgress(105)).toBe(100);
  });

  it("keeps core Review Board actions available in the compact audit view", () => {
    const source = readFileSync(
      join(process.cwd(), "src/obsidian/dashboardView.ts"),
      "utf8",
    );

    for (const actionText of [
      "text.accept",
      "text.ignore",
      "text.renameTopic",
      "text.mergeTopic",
      "text.addHighlight",
      "text.addAction",
      "text.openSourceNote",
    ]) {
      expect(source).toContain(actionText);
    }

    for (const actionType of [
      '"accept"',
      '"ignore"',
      '"rename-topic"',
      '"merge-topic"',
      '"add-to-annual-highlights"',
      '"add-to-actions"',
    ]) {
      expect(source).toContain(actionType);
    }

    expect(source).toContain("this.controller.openSourceNote(candidate.id)");
  });

  it("advances Review Board selection to the next pending candidate after a decision", () => {
    const candidates = [
      reviewCandidateFixture("current", "Current Topic", "accepted"),
      reviewCandidateFixture("next", "Next Topic", "candidate"),
      reviewCandidateFixture("closed", "Closed Topic", "ignored"),
    ];

    expect(
      getActionCandidateId({
        type: "accept",
        candidateId: "current",
        at: "2026-05-08T00:00:00.000Z",
      }),
    ).toBe("current");
    expect(getNextReviewSelection(candidates, "current")).toBe("next");
  });
});

function sectionBetween(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex);
  return markdown.slice(startIndex, endIndex);
}

function reviewSessionFixture(): ReviewSessionState {
  const candidates = [
    reviewCandidateFixture("accepted", "Accepted Topic", "accepted"),
    reviewCandidateFixture("renamed", "Renamed Topic", "renamed"),
    reviewCandidateFixture("action", "Action Topic", "next-action"),
    reviewCandidateFixture("highlight", "Highlight Topic", "candidate", {
      includeInAnnualHighlights: true,
    }),
    reviewCandidateFixture("ignored", "Ignored Topic", "ignored"),
    reviewCandidateFixture("merged", "Merged Topic", "merged"),
    reviewCandidateFixture("unreviewed", "Unreviewed Topic", "candidate"),
  ];

  return {
    schemaVersion: 1,
    year: 2026,
    scopeHash: "scope",
    scanId: "scan",
    candidates,
    decisions: [
      {
        id: "decision-action",
        candidateId: "action",
        action: "convert-to-project",
        label: "Convert accepted topic into project",
        evidence: candidates[2]?.evidence ?? [],
        includeInReport: true,
        createdAt: "2026-05-08T00:00:00.000Z",
      },
    ],
    progress: {
      total: candidates.length,
      reviewed: 5,
      candidate: 2,
      accepted: 1,
      renamed: 1,
      merged: 1,
      ignored: 1,
      archived: 0,
      nextAction: 1,
      annualHighlights: 1,
    },
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
  };
}

class FakeDomElement {
  readonly children: FakeDomElement[] = [];
  className = "";
  textContent = "";
  max = 0;
  value = 0;
  private parent: FakeDomElement | null = null;
  private readonly attributes = new Map<string, string>();

  constructor(private readonly tagName: string) {}

  appendChild(child: FakeDomElement): FakeDomElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  remove(): void {
    const siblings = this.parent?.children;
    const index = siblings?.indexOf(this) ?? -1;
    if (siblings && index >= 0) {
      siblings.splice(index, 1);
    }
    this.parent = null;
  }

  querySelector(selector: string): FakeDomElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) {
        return child;
      }
      const nested = child.querySelector(selector);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  private matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.className.split(/\s+/u).includes(selector.slice(1));
    }
    return this.tagName === selector.toLowerCase();
  }
}

function withFakeDocument(run: (root: FakeDomElement) => void): void {
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const previousDocument = globalThis.document;
  const root = new FakeDomElement("body");

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: root,
      createElement: (tagName: string) => new FakeDomElement(tagName.toLowerCase()),
    },
  });

  try {
    run(root);
  } finally {
    if (hadDocument) {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

function reviewCandidateFixture(
  id: string,
  title: string,
  status: ReviewCandidate["status"],
  overrides: Partial<ReviewCandidate> = {},
): ReviewCandidate {
  const sourcePath = `Projects/${id[0]?.toUpperCase() ?? ""}${id.slice(1)}.md`;
  return {
    id,
    type: "topic",
    title,
    reason: `${id} unsupported reason`,
    reasons: [],
    status,
    evidence: [
      {
        id: `${id}-evidence`,
        kind: "note",
        label: title,
        target: sourcePath,
        sourcePath,
      },
    ],
    sourcePaths: [sourcePath],
    decisionIds: [],
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    ...overrides,
  };
}

function noteFrom(input: {
  path: string;
  ctime: string;
  mtime: string;
  content: string;
}) {
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

function sourceFrom(input: {
  path: string;
  ctime: string;
  mtime: string;
  content: string;
}) {
  return {
    path: input.path,
    ctime: Date.parse(input.ctime),
    mtime: Date.parse(input.mtime),
    content: input.content,
  };
}

function repeatedWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}
