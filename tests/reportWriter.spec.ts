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

import { createReportWriterMockApp } from "./testHelpers";

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
        "",
        REVIEW_USER_REFLECTION_START_MARKER,
        "",
        REVIEW_USER_REFLECTION_END_MARKER,
      ].join("\n"),
    );
  });

  it("writes custom review reports using the session label path", async () => {
    const { app, files, writes } = createReportWriterMockApp();

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      "2026 Q1 Review",
      ["---", 'review_label: "2026 Q1 Review"', "---", "# 2026 Q1 Review"].join("\n"),
      [],
    );

    expect(writes).toEqual(["Annual Reviews/2026 Q1 Review.md"]);
    expect(files.get("Annual Reviews/2026 Q1 Review.md")?.content).toContain(
      "# 2026 Q1 Review",
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
        REVIEW_USER_REFLECTION_START_MARKER,
        "",
        REVIEW_USER_REFLECTION_END_MARKER,
      ].join("\n"),
    );
  });

  it("preserves user reflection blocks when regenerating a marked annual report", async () => {
    const existingReport = [
      ANNUAL_REVIEW_START_MARKER,
      "# 2026 Annual Review",
      "Old machine section.",
      ANNUAL_REVIEW_END_MARKER,
      "",
      REVIEW_USER_REFLECTION_START_MARKER,
      "",
      "This is my handwritten reflection.",
      "",
      REVIEW_USER_REFLECTION_END_MARKER,
    ].join("\n");
    const { app, files } = createReportWriterMockApp([
      ["Annual Reviews/2026 Annual Review.md", existingReport],
    ]);

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      "# 2026 Annual Review\nNew machine section.",
      [],
    );

    const reportContent =
      files.get("Annual Reviews/2026 Annual Review.md")?.content ?? "";
    expect(reportContent).toContain("New machine section.");
    expect(reportContent).not.toContain("Old machine section.");
    expect(reportContent).toContain("This is my handwritten reflection.");
    expect(reportContent.match(/time-range-review:user-reflection:start/gu)).toHaveLength(
      1,
    );
    expect(reportContent.match(/time-range-review:user-reflection:end/gu)).toHaveLength(
      1,
    );
  });

  it("repairs reports whose generated marker was written before frontmatter", async () => {
    const existingReport = [
      ANNUAL_REVIEW_START_MARKER,
      "---",
      "year: 2026",
      "---",
      "# Old machine report",
      ANNUAL_REVIEW_END_MARKER,
    ].join("\n");
    const { app, files } = createReportWriterMockApp([
      ["Annual Reviews/2026 Annual Review.md", existingReport],
    ]);

    await writeAnnualReviewOutput(
      app as unknown as Parameters<typeof writeAnnualReviewOutput>[0],
      "Annual Reviews",
      2026,
      ["---", "year: 2026", "---", "# 2026 Annual Review"].join("\n"),
      [],
    );

    const reportContent =
      files.get("Annual Reviews/2026 Annual Review.md")?.content ?? "";
    expect(reportContent.split(/\r?\n/u).slice(0, 3)).toEqual([
      "---",
      "year: 2026",
      "---",
    ]);
    expect(reportContent).toMatch(
      /^---\nyear: 2026\n---\n\n<!-- time-range-review:generated:start -->/u,
    );
    expect(reportContent).not.toContain("# Old machine report");
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
        "",
        REVIEW_USER_REFLECTION_START_MARKER,
        "",
        REVIEW_USER_REFLECTION_END_MARKER,
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
    expect(reportContent.match(/time-range-review:generated:start/gu)).toHaveLength(1);
    expect(reportContent.match(/time-range-review:generated:end/gu)).toHaveLength(1);
  });
});
