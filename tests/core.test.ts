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
import { sourceFrom } from "./testHelpers";

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
      "Projects/Legacy.md",
      "Projects/Research.md",
      "Review Fixtures/2026-01-01.md",
    ]);
    expect(snapshot.notes).not.toContainEqual(
      expect.objectContaining({ path: "Annual Reviews/2026 Annual Review.md" }),
    );
    expect(snapshot.notes).not.toContainEqual(
      expect.objectContaining({ path: "Archive/Old.md" }),
    );
    expect(snapshot.notes[2]).toMatchObject({
      folder: "Review Fixtures",
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
    const source = await fixtureFile(
      "Review Fixtures/2026-01-01.md",
      "2026-01-01T08:00:00.000Z",
    );
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
