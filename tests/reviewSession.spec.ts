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
import { buildReviewAggregate, buildYearAggregate } from "../src/core/aggregate";
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
import {
  buildCustomReviewSession,
  buildMonthlyReviewSession,
  buildQuarterlyReviewSession,
} from "../src/core/reviewSession";
import { buildReviewSession } from "../src/core/reviewCandidates";
import {
  buildLocalThemeHypotheses,
  buildThemeEvidencePackage,
  buildThemeHypothesisPrompt,
  parseThemeHypotheses,
} from "../src/core/themeEvidence";
import { buildReviewDetailModel } from "../src/core/reviewDetail";
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
  REVIEW_USER_REFLECTION_END_MARKER,
  REVIEW_USER_REFLECTION_START_MARKER,
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
  isPendingReviewQueueCandidate,
} from "../src/obsidian/reviewSelection";
import { readVaultMarkdownFiles } from "../src/obsidian/vaultFiles";
import { fixtureFile, fixtureVault } from "./fixtures";

import {
  noteFrom,
  repeatedWords,
  reviewCandidateFixture,
  reviewSessionFixture,
  sectionBetween,
  sourceFrom,
} from "./testHelpers";

describe("aggregation and rendering", () => {
  it("builds a deterministic year aggregate from fixture vault files", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    expect(aggregate.createdCount).toBe(3);
    expect(aggregate.modifiedCount).toBe(4);
    expect(aggregate.activeDays).toBe(5);
    expect(aggregate.longestStreak).toBe(2);
    expect(aggregate.topTags[0]).toEqual({ name: "journal", count: 2 });
    expect(aggregate.topFolders).toContainEqual({
      name: "Review Fixtures",
      count: 2,
    });
    expect(aggregate.topLinks).toContainEqual({ name: "Projects/Research", count: 2 });
    expect(
      aggregate.highValueNotes.some((note) => note.path === "Projects/Research.md"),
    ).toBe(true);
    expect(aggregate.representativeNotes.map((note) => note.path)).toEqual([
      "Projects/Legacy.md",
      "Projects/Research.md",
      "Review Fixtures/2026-01-01.md",
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

  it("filters aggregates by quarterly and custom review sessions", async () => {
    const files = await fixtureVault();
    const q1 = buildQuarterlyReviewSession(
      2026,
      1,
      DEFAULT_SETTINGS,
      "2026-05-01T00:00:00.000Z",
    );
    const q1Aggregate = buildReviewAggregate(files, q1, DEFAULT_SETTINGS);

    expect(q1Aggregate.session).toMatchObject({
      preset: "quarterly",
      label: "2026 Q1 Review",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
    expect(q1Aggregate.createdCount).toBe(3);
    expect(q1Aggregate.modifiedCount).toBe(3);
    expect(q1Aggregate.monthBuckets.map((month) => month.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(q1Aggregate.dayBuckets).toHaveLength(90);
    expect(q1Aggregate.representativeNotes.map((note) => note.path)).not.toContain(
      "Projects/Legacy.md",
    );

    const january = buildMonthlyReviewSession(
      2026,
      1,
      DEFAULT_SETTINGS,
      "2026-05-01T00:00:00.000Z",
    );
    const januaryAggregate = buildReviewAggregate(files, january, DEFAULT_SETTINGS);

    expect(januaryAggregate.session).toMatchObject({
      preset: "monthly",
      label: "2026-01 Review",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(januaryAggregate.monthBuckets.map((month) => month.month)).toEqual([
      "2026-01",
    ]);
    expect(januaryAggregate.dayBuckets).toHaveLength(31);

    const custom = buildCustomReviewSession({
      label: "2026 Legacy Followup Review",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      settings: DEFAULT_SETTINGS,
      timestamp: "2026-05-01T00:00:00.000Z",
    });
    const customAggregate = buildReviewAggregate(files, custom, DEFAULT_SETTINGS);

    expect(customAggregate.session).toMatchObject({
      preset: "custom",
      label: "2026 Legacy Followup Review",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
    });
    expect(customAggregate.createdCount).toBe(0);
    expect(customAggregate.modifiedCount).toBe(1);
    expect(customAggregate.activeDays).toBe(1);
    expect(customAggregate.totalWords).toBe(0);
    expect(customAggregate.dayBuckets.map((day) => day.date)).toContain("2026-04-05");
  });

  it("excludes out-of-range notes from custom range aggregates", () => {
    const files = [
      sourceFrom({
        path: "Daily/2026-01-15.md",
        ctime: "2026-01-15T08:00:00.000Z",
        mtime: "2026-01-15T09:00:00.000Z",
        content: "# Inside\n\ninside range words linked to [[Projects/Inside]].",
      }),
      sourceFrom({
        path: "Daily/2026-01-05.md",
        ctime: "2026-01-05T08:00:00.000Z",
        mtime: "2026-01-05T09:00:00.000Z",
        content: "# Before\n\nbefore range words linked to [[Projects/Before]].",
      }),
      sourceFrom({
        path: "Daily/2026-01-25.md",
        ctime: "2026-01-25T08:00:00.000Z",
        mtime: "2026-01-25T09:00:00.000Z",
        content: "# After\n\nafter range words linked to [[Projects/After]].",
      }),
    ];
    const session = buildCustomReviewSession({
      label: "Mid January Review",
      startDate: "2026-01-10",
      endDate: "2026-01-20",
      settings: DEFAULT_SETTINGS,
      timestamp: "2026-02-01T00:00:00.000Z",
    });

    const aggregate = buildReviewAggregate(files, session, DEFAULT_SETTINGS);

    expect(aggregate.createdCount).toBe(1);
    expect(aggregate.modifiedCount).toBe(1);
    expect(aggregate.topNotes.map((note) => note.path)).toEqual(["Daily/2026-01-15.md"]);
    expect(aggregate.topLinks).toEqual([{ name: "Projects/Inside", count: 1 }]);
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-01-15")).toMatchObject({
      created: 1,
      modified: 1,
    });
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-01-05")).toBeUndefined();
    expect(aggregate.dayBuckets.find((day) => day.date === "2026-01-25")).toBeUndefined();

    const aiPrompt = buildAiPrompt(aggregate, files, DEFAULT_SETTINGS);
    expect(aiPrompt).toContain("inside range words");
    expect(aiPrompt).not.toContain("before range words");
    expect(aiPrompt).not.toContain("after range words");
  });

  it("uses explicit note dates to distribute flattened-mtime daily notes", async () => {
    const flattenedTime = "2026-05-09T10:55:29.000Z";
    const dailyPaths = [
      "Review Fixtures/2026-01-05.md",
      "Review Fixtures/2026-02-05.md",
      "Review Fixtures/2026-03-01.md",
      "Review Fixtures/2026-04-04.md",
      "Review Fixtures/2026-05-02.md",
    ];
    const aggregate = buildYearAggregate(
      dailyPaths.map((path, index) => ({
        path,
        ctime: Date.parse(flattenedTime),
        mtime: Date.parse(flattenedTime),
        content: `# Fixture ${index + 1}\n\nSynthetic review note content for month ${index + 1}.`,
      })),
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

  it("prefers frontmatter create metadata before filesystem timestamps", () => {
    const flattenedTime = Date.parse("2026-05-09T10:55:29.000Z");
    const aggregate = buildYearAggregate(
      [
        {
          path: "Inbox/Imported note.md",
          ctime: flattenedTime,
          mtime: flattenedTime,
          content:
            "---\ncreate: 2026-02-14 10:00\n---\n\nfrontmatter dated imported note",
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
    expect(markdown).toContain("## Main Themes");
  });

  it("renders the annual review with required plain Markdown sections", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);
    expect(markdown).toContain("# 2026 Annual Review");
    expect(markdown).toMatch(/^---\ngenerated: ".+"\nyear: 2026/u);
    expect(markdown).toContain("cssclasses:\n  - p-indent");
    expect(markdown).toContain('growth_data_source: "current-vault inference"');
    expect(markdown).toContain(
      'activity_date_sources: "frontmatter date: 0; path/filename date: 2; filesystem timestamp: 2"',
    );
    expect(markdown).toContain('report_language: "en"');
    expect(markdown).not.toContain("Included scope:");
    expect(markdown).not.toContain("Excluded scope:");
    expect(markdown.match(/^## .+$/gmu)).toEqual([
      "## Overview",
      "## Activity Rhythm",
      "## Main Themes",
      "## Worth Rereading",
      "## Reflection Questions",
      "## User Reflection",
      "## Methodology",
    ]);
    expect(markdown).toContain("Activity Evidence shows");
    expect(markdown).not.toContain("| Writing days |");
    expect(markdown).not.toContain("| Longest writing streak |");
    expect(markdown).toContain("### Cumulative Growth");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-daily-cumulative"',
    );
    expect(markdown).toContain("### Monthly New Notes");
    expect(markdown).toContain("### Heatmap");
    expect(markdown).toContain('class="annual-review-chart annual-review-heatmap"');
    expect(markdown).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markdown).toContain("<rect");
    expect(markdown).not.toContain("| Month | Words | Active days | Peak day |");
    expect(markdown).not.toContain("Legend: . = 0 words");
    expect(markdown).not.toMatch(/[░▒▓█]/u);
    expect(markdown).not.toContain("## Word Growth Trend");
    expect(markdown).toContain("Notes created in each active month");
    expect(markdown).toContain('class="annual-review-chart annual-review-growth"');
    expect(markdown).not.toContain("| Month | Word growth | Cumulative words |");
    expect(markdown).toContain("### Theme Signal Chart");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-topic-evolution"',
    );
    expect(markdown).toContain("### Theme Signal Chart");
    expect(markdown).not.toContain(
      "| Topic | Added words | New notes | Representative Notes |",
    );
    expect(markdown).not.toContain("| Topic | Added words | New notes | Updated notes |");
    expect(markdown).not.toContain("### Feedback Signals");
    expect(markdown).not.toContain("### Activity Reading");
    expect(markdown).not.toContain("Writing appeared on");
    expect(markdown).not.toContain("Writing volume is concentrated");
    expect(markdown).not.toContain("Tasks completed");
    expect(markdown).not.toContain("## Tasks And Project Notes");
    expect(markdown).not.toContain("## Year Totals");
    expect(markdown).not.toContain("## Monthly Timeline");
    expect(markdown).not.toContain("## Top Tags");
    expect(markdown).not.toContain("## Top Links");
    expect(markdown).not.toContain("## Top Folders");
    expect(markdown).toContain("## Main Themes");
    expect(markdown).toContain("No Review Board state is available");
    expect(markdown).not.toContain("### Main Themes");
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
    expect(markdown).toContain("## Methodology");
    expect(markdown).not.toContain("## Suggested Next-Year Actions");
    expect(markdown).toContain("## Reflection Questions");
    expect(markdown).toContain(
      "What boundary would you set before the next similar situation",
    );
    expect(markdown).not.toContain("Which Evidence Notes now seem more worth rereading");
    expect(markdown).not.toContain("- Create a compact index");
    expect(markdown).not.toContain("- No extra theme-hypothesis prompt is available");
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
      'activity_date_sources: "frontmatter date: 0; 路径/文件名日期: 0; 文件系统时间戳: 1"',
    );
    expect(markdown).not.toContain(
      "本次活动日期只能使用文件系统 ctime/mtime。如果这些文件经过复制、checkout 或批量部署",
    );
  });

  it("labels fallback growth as current-vault inference when no historical snapshot is available", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);

    expect(markdown).toContain('growth_data_source: "current-vault inference"');
    expect(markdown).toContain("Methodology");
    expect(markdown).toContain("Activity rhythm comes from Markdown Evidence Notes");
    expect(markdown).toContain("complete Evidence Audit material stays");
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
    expect(markdown).toContain("Activity rhythm uses plugin snapshots");
    expect(markdown).not.toContain("- Snapshot word delta:");
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
      "## 总览",
      "## 年度节奏",
      "## 主要主线",
      "## 值得重读的笔记",
      "## 留给自己的问题",
      "## 我的补充",
      "## 方法与数据口径",
    ]);
    expect(markdown).toContain("### 累计增长");
    expect(markdown).toContain(
      'class="annual-review-chart annual-review-daily-cumulative"',
    );
    expect(markdown).toContain("### 每月新增笔记");
    expect(markdown).toContain("### 热力图");
    expect(markdown).toContain('class="annual-review-chart annual-review-heatmap"');
    expect(markdown).toContain('class="annual-review-chart annual-review-growth"');
    expect(markdown).not.toContain("## 主题演化");
    expect(markdown).not.toContain("### 反馈信号");
    expect(markdown).toContain("## 主要主线");
    expect(markdown).toContain("还没有 Review Board 状态可确认主题");
    expect(markdown).not.toContain("### 可输出笔记");
    expect(markdown).not.toContain("### 需维护笔记");
    expect(markdown).toContain("## 留给自己的问题");
    expect(markdown).not.toContain("## 年度统计");
    expect(markdown).not.toContain("## 月度时间线");
    expect(markdown).not.toContain("代表笔记采用确定性规则选择");
    expect(markdown).not.toContain("补 2-3 个上下文链接后整理成输出草稿");
    expect(markdown).not.toContain("作为本范围的代表笔记重新检查");
  });

  it("renders AI-synthesized themes and review-candidate reasons when AI enhancements are present", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate, {
      aiEnabled: true,
      aiEnhancements: {
        themeHypotheses: [],
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

    expect(markdown).toContain("## Reflection Questions");
    expect(markdown).toContain("Research review loop");
    expect(markdown).not.toContain("[[Daily/2026-01-01]]");
    expect(markdown).not.toContain("| Theme |");
    expect(markdown).not.toContain(
      "| Note | Type | AI value reason | Suggested action |",
    );
    expect(markdown).not.toContain("#### [[Projects/Research|Research]]");
    expect(markdown).not.toContain(
      "This note links source evidence back to the project synthesis",
    );
    expect(markdown).not.toContain("- Create a review hub from [[Projects/Research]].");
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
    expect(markdown).not.toContain("| Month | Words | Active days | Peak day |");
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

  it("generates chart asset paths from the review session label", () => {
    expect(buildAnnualReviewChartPaths("Annual Reviews", "2026 Q1 Review")).toEqual({
      "daily-cumulative-words":
        "Annual Reviews/2026 Q1 Review Assets/daily-cumulative-words.svg",
      "daily-word-heatmap": "Annual Reviews/2026 Q1 Review Assets/daily-word-heatmap.svg",
      "word-growth-trend": "Annual Reviews/2026 Q1 Review Assets/word-growth-trend.svg",
      "topic-evolution": "Annual Reviews/2026 Q1 Review Assets/topic-evolution.svg",
      "topic-evolution-data": "Annual Reviews/2026 Q1 Review Assets/topic-evolution.json",
    });
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

    expect(markdown).toContain("No Review Board state is available");
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

    expect(markdown).toContain("## Main Themes");
    expect(markdown).toContain("### Accepted Topic");
    expect(markdown).toContain("### Renamed Topic");
    expect(markdown).not.toContain("Merged source themes do not appear independently:");
    expect(markdown).not.toContain("[[Projects/Merged|Merged Topic]]");
    expect(markdown).not.toContain("Ignored Topic");
    expect(markdown).not.toContain("[[Projects/Merged|Merged Topic]] (merged)");
    expect(markdown).not.toContain("Unreviewed Topic");
    expect(markdown).toContain("accepted unsupported reason");
    expect(markdown).not.toContain("These 4 reviewed candidates are included");
    expect(markdown).not.toContain("Manual confirmation:");
    expect(markdown).not.toContain("Convert accepted topic into project");
  });

  it("renders only reviewed Review Board decisions in the default Chinese report", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate, {
      language: "zh",
      reviewSession: reviewSessionFixture(),
    });

    expect(markdown).toContain("## 主要主线");
    expect(markdown).toContain("### Accepted Topic");
    expect(markdown).not.toContain("合并来源");
    expect(markdown).not.toContain("Ignored Topic");
    expect(markdown).not.toContain("[[Projects/Merged|Merged Topic]] (merged)");
    expect(markdown).not.toContain("下面 4 个已审核候选");
    expect(markdown).not.toContain("人工确认:");
    expect(markdown).not.toContain("因此，这条主线在报告里应该被当作一个初步成形的解释");
    expect(markdown).not.toContain("把这些代表笔记串起来看");
  });

  it("uses long AI report narratives without adding generic fallback prose", async () => {
    const evidencePaths = [
      "2026月复盘/2月/2026-02-22 AI越来越快.md",
      "2026月复盘/3月/2026-03-04 ALL-in-AI.md",
      "2026月复盘/4月/2026-04-04 懵逼同时有AI压力感.md",
      "2026月复盘/4月/2026-04-12 探索期有充足额度才有更多可能.md",
    ];
    const aggregate = buildYearAggregate(
      evidencePaths.map((path, index) =>
        sourceFrom({
          path,
          ctime: `2026-0${Math.min(index + 2, 4)}-0${index + 1}T08:00:00.000Z`,
          mtime: `2026-0${Math.min(index + 2, 4)}-0${index + 1}T10:00:00.000Z`,
          content: "AI agency tools pressure workflow context ".repeat(80),
        }),
      ),
      2026,
      DEFAULT_SETTINGS,
    );
    const aiReportNarrative =
      "这一条主线关注的是自己如何在 AI 加速里重新夺回主导权。" +
      "[[2026月复盘/2月/2026-02-22 AI越来越快|AI越来越快]] 先把 AI 放在长期变量里，提醒自己不能只把它当成临时工具，而要看见它会持续改变学习、写作、编码和判断方式。" +
      "到 [[2026月复盘/3月/2026-03-04 ALL-in-AI|ALL in AI]]，这种观察已经转成投入姿态：愿意把时间、注意力和试错额度都压到这个方向上。" +
      "但 [[2026月复盘/4月/2026-04-04 懵逼同时有AI压力感|懵逼同时有AI压力感]] 又把另一面写出来，工具越强，越容易让人被速度、信息密度和新范式推着走。" +
      "[[2026月复盘/4月/2026-04-12 探索期有充足额度才有更多可能|探索期有充足额度才有更多可能]] 则把问题推进到资源、额度、账号稳定性和实验空间。" +
      "把这些笔记放在一起看，年度主线不是简单的工具热情，而是一次关于判断流程、上下文管理和工作边界的训练：既要拥抱 AI 带来的放大效应，也要避免把安全感完全交给工具速度。" +
      "后续报告可以继续追问这种主导权是否真的变成了可复用的工作流：例如怎样拆任务、怎样保存上下文、怎样判断模型输出是否值得相信，以及怎样把一次次尝试沉淀成项目资产。" +
      "这样写既保留了四篇证据笔记里的现场感，也把年度复盘从“我用过哪些 AI 工具”推进到“我如何重新组织自己的学习和生产系统”。";
    const reviewSession = reviewSessionFixture();
    reviewSession.candidates = [
      reviewCandidateFixture("ai", "AI 主导权", "accepted", {
        aiSummary: aiReportNarrative,
        connectionExplanation: "这些笔记共同呈现 AI 工具投入、压力和资源边界。",
        reason: "AI 工具从机会变成压力，也迫使自己重新设计判断流程。",
        uncertainty: "后续是否沉淀成稳定工作流仍需继续观察。",
        evidence: evidencePaths.map((path) => ({
          id: path,
          kind: "note",
          label: path.split("/").pop()?.replace(/\.md$/u, "") ?? path,
          target: path,
          sourcePath: path,
        })),
        sourcePaths: evidencePaths,
      }),
    ];
    const markdown = renderAnnualReview(aggregate, {
      language: "zh",
      reviewSession,
    });
    const reviewSection = sectionBetween(markdown, "## 主要主线", "## 值得重读的笔记");

    expect(reviewSection).toContain("### AI 主导权");
    expect(reviewSection).toContain(
      "这一条主线关注的是自己如何在 AI 加速里重新夺回主导权。",
    );
    expect(reviewSection).toContain("后续是否沉淀成稳定工作流仍需继续观察。");
    expect(reviewSection).not.toContain("把这些代表笔记串起来看");
    expect(reviewSection).not.toContain("因此，这条主线在报告里应该");
    expect(reviewSection).not.toContain("这些笔记共同呈现 AI 工具投入、压力和资源边界");
    expect(reviewSection).not.toContain("AI 工具从机会变成压力");
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
    const reviewSection = sectionBetween(markdown, "## 主要主线", "## 值得重读的笔记");

    expect(reviewSection).toContain("### Clippings");
    expect(reviewSection).not.toContain("|[[Clippings]]");
    expect(reviewSection).not.toMatch(/\[\[[^\]|]+\|\[\[/u);
    expect(
      parseObsidianWikilinks(reviewSection).some((link) => link.target === "Clippings"),
    ).toBe(false);
  });

  it("uses readable evidence aliases without date prefixes", async () => {
    const aggregate = buildYearAggregate(
      [
        sourceFrom({
          path: "2026月复盘/2月/2026-02-22 AI越来越快.md",
          ctime: "2026-02-22T08:00:00.000Z",
          mtime: "2026-02-22T10:00:00.000Z",
          content: "AI tools and agency ".repeat(80),
        }),
      ],
      2026,
      DEFAULT_SETTINGS,
    );
    const reviewSession = reviewSessionFixture();
    reviewSession.candidates = [
      reviewCandidateFixture("ai", "AI 主导权", "accepted", {
        evidence: [
          {
            id: "ai-evidence",
            kind: "note",
            label: "2026-02-22 AI越来越快",
            target: "2026月复盘/2月/2026-02-22 AI越来越快.md",
            sourcePath: "2026月复盘/2月/2026-02-22 AI越来越快.md",
            reason: "created in review range: 2026-02-22; frontmatter context present",
          },
        ],
        sourcePaths: ["2026月复盘/2月/2026-02-22 AI越来越快.md"],
      }),
    ];
    const markdown = renderAnnualReview(aggregate, {
      language: "zh",
      reviewSession,
    });

    expect(markdown).toContain("[[2026月复盘/2月/2026-02-22 AI越来越快|AI越来越快]]");
    expect(markdown).not.toContain("|2026-02-22 AI越来越快");
    expect(markdown).not.toContain("|2026 02 22 AI越来越快");
  });

  it("normalizes wikilink-shaped topic names before they enter Review Board state", async () => {
    const files = [
      sourceFrom({
        path: "Daily/Clippings/为什么我劝你自己搭一个 Agent，哪怕现有的已经够好了.md",
        ctime: "2026-01-01T08:00:00.000Z",
        mtime: "2026-01-01T10:00:00.000Z",
        content: "AI agent notes ".repeat(80),
      }),
      sourceFrom({
        path: "Daily/Clippings/Followup.md",
        ctime: "2026-01-02T08:00:00.000Z",
        mtime: "2026-01-02T10:00:00.000Z",
        content: "AI agent notes connect to the same clipping folder. ".repeat(40),
      }),
    ];
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);

    const reviewSession = buildReviewSession(aggregate, undefined, { evidencePackage });
    const topicCandidate = reviewSession.candidates.find(
      (candidate) => candidate.type === "theme-hypothesis",
    );

    expect(topicCandidate).toMatchObject({
      title: "Cross note theme in Clippings",
      reason: expect.stringContaining("local semantic clue"),
    });
    expect(topicCandidate?.reason).not.toContain("[[Clippings]]");
  });

  it("separates degraded local clues from the primary queue when configured AI returns no themes", async () => {
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const reviewSession = buildReviewSession(aggregate, undefined, {
      evidencePackage: buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS),
      language: "zh",
      aiConfigured: true,
      aiAttempted: true,
      aiFailureMessage: "AI unavailable",
    });

    expect(reviewSession.candidates).toEqual([]);
    expect(reviewSession.localFallbackCandidates?.length).toBeGreaterThan(0);
    expect(reviewSession.themeGeneration).toMatchObject({
      mode: "degraded-local",
      aiConfigured: true,
      aiAttempted: true,
    });
    expect(
      reviewSession.localFallbackCandidates
        ?.map((candidate) => [candidate.title, candidate.reason].join(" "))
        .join(" "),
    ).not.toMatch(
      /created in review range|modified in review range|frontmatter|月中的跨笔记主题/u,
    );
  });

  it("uses supplied AI themes as the primary Review Board queue", async () => {
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);
    const firstNote = evidencePackage.evidenceNotes[0];
    expect(firstNote).toBeDefined();

    const reviewSession = buildReviewSession(aggregate, undefined, {
      evidencePackage,
      language: "zh",
      aiConfigured: true,
      aiAttempted: true,
      themeHypotheses: [
        {
          id: "theme:ai:understanding-anxiety",
          title: "从技术兴奋走向理解焦虑",
          summary: "几篇笔记共同记录了从尝试技术到担心理解不足的变化。",
          connectionExplanation: "这些证据都围绕技术探索后的理解压力展开。",
          evidenceNoteIds: [firstNote?.id ?? ""],
          localSignals: [],
          source: "ai",
        },
      ],
    });

    expect(reviewSession.candidates).toHaveLength(1);
    expect(reviewSession.candidates[0]).toMatchObject({
      title: "从技术兴奋走向理解焦虑",
      source: "ai",
    });
    expect(reviewSession.localFallbackCandidates).toEqual([]);
    expect(reviewSession.themeGeneration?.mode).toBe("ai");
  });

  it("keeps the scoring method documentation present and bounded", () => {
    const method = readFileSync("docs/archive/scoring-method.md", "utf8");

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
