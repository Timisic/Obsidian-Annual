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

import { sourceFrom, themeEvidenceFiles } from "./testHelpers";

describe("theme evidence", () => {
  it("compiles local evidence signals into a bounded evidence package", () => {
    const files = themeEvidenceFiles();
    const session = buildQuarterlyReviewSession(
      2026,
      1,
      DEFAULT_SETTINGS,
      "2026-04-01T00:00:00.000Z",
    );
    const aggregate = buildReviewAggregate(files, session, DEFAULT_SETTINGS);
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);

    expect(evidencePackage.reviewRange).toBe("2026-01-01 to 2026-03-31");
    expect(evidencePackage.evidenceNotes.length).toBeGreaterThanOrEqual(4);

    const research = evidencePackage.evidenceNotes.find(
      (note) => note.path === "Projects/Research.md",
    );
    expect(research).toMatchObject({
      id: "note:projects-research-md",
      title: "Research",
    });
    expect(research?.dateSignals).toContain("created in review range: 2026-01-10");
    expect(research?.links).toContain("Areas/AI Systems.md");
    expect(research?.backlinks).toContain("Daily/2026-02-01.md");
    expect(research?.commonLinks).toContain("Areas/AI Systems.md");
    expect(research?.frontmatterSignals).toContain("topic: Local AI");
    expect(research?.weakSignals).toContain("tag:theme/ai");
    expect(research?.repeatedPhrases).toContain("local evidence loop");
    expect(research?.crossFolderLinks).toContain("Areas/AI Systems.md");
    expect(research?.whyIncluded).toContain("shared links");

    const legacy = evidencePackage.evidenceNotes.find(
      (note) => note.path === "Projects/Legacy.md",
    );
    expect(legacy?.dateSignals).toContain(
      "resurfaced old note: created 2025-10-01, modified 2026-02-20",
    );
  });

  it("excludes out-of-range notes from the AI evidence package", () => {
    const files = [
      ...themeEvidenceFiles(),
      sourceFrom({
        path: "Projects/Out of Range.md",
        ctime: "2026-04-10T08:00:00.000Z",
        mtime: "2026-04-10T09:00:00.000Z",
        content:
          "# Out of Range\n\nThe local evidence loop appears after the requested review window.",
      }),
    ];
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);

    expect(evidencePackage.reviewRange).toBe("2026-01-01 to 2026-03-31");
    expect(evidencePackage.evidenceNotes.map((note) => note.path)).not.toContain(
      "Projects/Out of Range.md",
    );
    expect(buildThemeHypothesisPrompt(evidencePackage)).not.toContain("Out of Range");
  });

  it("builds an AI prompt that exposes only the structured evidence package", () => {
    const files = themeEvidenceFiles();
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);
    const prompt = JSON.parse(buildThemeHypothesisPrompt(evidencePackage)) as {
      inputPolicy: { allowedInput: string; weakSignalRule: string };
      evidencePackage: { evidenceNotes: Array<{ id: string; excerpt: string }> };
      outputSchema: { themeHypotheses: Array<{ evidenceNoteIds: string[] }> };
    };

    expect(prompt.inputPolicy.allowedInput).toContain("structured evidence package");
    expect(prompt.inputPolicy.weakSignalRule).toContain("weakSignals");
    expect(prompt.evidencePackage.evidenceNotes[0]?.id).toMatch(/^note:/u);
    expect(prompt.evidencePackage.evidenceNotes[0]?.excerpt).not.toContain("---");
    expect(prompt.outputSchema.themeHypotheses[0]?.evidenceNoteIds[0]).toContain(
      "evidence note ids",
    );
  });

  it("parses AI theme hypotheses back to evidence note ids and marks weak singles", () => {
    const files = themeEvidenceFiles();
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);
    const parsed = parseThemeHypotheses(
      JSON.stringify({
        themeHypotheses: [
          {
            id: "theme-ai-local-loop",
            title: "Local evidence loop",
            summary: "The notes connect AI review work to local evidence.",
            evidenceNoteIds: ["note:projects-research-md", "note:daily-2026-02-01-md"],
            connectionExplanation:
              "Both notes share the local evidence loop phrase and cross-link through AI Systems.",
            source: "ai",
          },
          {
            title: "Single note clue",
            summary: "One note may become a theme.",
            evidenceNotes: ["Projects/Legacy.md"],
            connectionExplanation: "The old note resurfaced during the review range.",
            source: "mixed",
          },
          {
            title: "Invented clue",
            summary: "Invalid evidence should be dropped.",
            evidenceNoteIds: ["note:missing"],
            connectionExplanation: "No valid evidence id.",
            source: "ai",
          },
        ],
      }),
      evidencePackage,
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      id: "theme-ai-local-loop",
      source: "ai",
      evidenceNoteIds: ["note:projects-research-md", "note:daily-2026-02-01-md"],
    });
    expect(parsed[0]?.connectionExplanation).toContain("cross-link");
    expect(parsed[1]?.evidenceNoteIds).toEqual(["note:projects-legacy-md"]);
    expect(parsed[1]?.uncertainty).toContain("Low confidence");
  });

  it("falls back to auditable local theme clues without AI", () => {
    const files = themeEvidenceFiles();
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const evidencePackage = buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS);
    const themes = buildLocalThemeHypotheses(evidencePackage);

    expect(themes.length).toBeGreaterThan(0);
    expect(
      themes.every(
        (theme) => theme.connectionExplanation && theme.evidenceNoteIds.length >= 2,
      ),
    ).toBe(true);
    expect(themes.every((theme) => theme.source === "local")).toBe(true);
    expect(themes.map((theme) => theme.title)).toContain("Linked thread: AI Systems");
    expect(themes[0]?.title).not.toContain("theme/ai");

    const weakTagThemes = buildLocalThemeHypotheses({
      reviewRange: "2026-01-01 to 2026-03-31",
      evidenceNotes: [
        {
          id: "note:a",
          path: "A.md",
          title: "A",
          dateSignals: [],
          excerpt: "A",
          links: [],
          backlinks: [],
          commonLinks: [],
          frontmatterSignals: [],
          repeatedPhrases: [],
          questionSentences: [],
          entities: [],
          crossFolderLinks: [],
          weakSignals: ["tag:theme/ai"],
          whyIncluded: "tag evidence",
        },
        {
          id: "note:b",
          path: "B.md",
          title: "B",
          dateSignals: [],
          excerpt: "B",
          links: [],
          backlinks: [],
          commonLinks: [],
          frontmatterSignals: [],
          repeatedPhrases: [],
          questionSentences: [],
          entities: [],
          crossFolderLinks: [],
          weakSignals: ["tag:theme/ai"],
          whyIncluded: "tag evidence",
        },
      ],
    });
    expect(weakTagThemes[0]).toMatchObject({
      title: "Weak tag clue: theme/ai",
      connectionExplanation: expect.stringContaining("weak evidence"),
    });
  });
});
