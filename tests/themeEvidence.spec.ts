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
  selectThemeEvidenceNotes,
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
import type { ThemeEvidenceNote } from "../src/core/types";

function evidenceNote(
  id: string,
  path: string,
  overrides: Partial<ThemeEvidenceNote> = {},
): ThemeEvidenceNote {
  return {
    id,
    path,
    title: path.replace(/\.md$/u, ""),
    dateSignals: ["created in review range: 2026-01-01"],
    excerpt: path,
    links: [],
    backlinks: [],
    commonLinks: [],
    frontmatterSignals: [],
    repeatedPhrases: [],
    questionSentences: [],
    entities: [],
    crossFolderLinks: [],
    weakSignals: [],
    localSignals: ["created in review range: 2026-01-01"],
    relatedNotes: [],
    whyIncluded: "test evidence",
    ...overrides,
  };
}

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
      path: "Projects/Research.md",
      title: "Research",
    });
    expect(research?.dateSignals).toContain("created in review range: 2026-01-10");
    expect(research?.links).toContain("Areas/AI Systems.md");
    expect(research?.backlinks).toContain("Daily/2026-02-01.md");
    expect(research?.commonLinks).toContain("Areas/AI Systems.md");
    expect(research?.frontmatterSignals).toContain("topic: Local AI");
    expect(research?.weakSignals).toContain("tag:theme/ai");
    expect(research?.localSignals).toContain("tags present as weak signals");
    expect(research?.repeatedPhrases).toContain("local evidence loop");
    expect(research?.crossFolderLinks).toContain("Areas/AI Systems.md");
    expect(research?.relatedNotes).toContain("Daily/2026-02-01.md");
    expect(research?.whyIncluded).toContain("shared links");

    const legacy = evidencePackage.evidenceNotes.find(
      (note) => note.path === "Projects/Legacy.md",
    );
    expect(legacy?.dateSignals).toContain(
      "resurfaced old note: created 2025-10-01, modified 2026-02-20",
    );
  });

  it("selects provider-visible evidence notes through one diverse entry point", () => {
    const notes = [
      evidenceNote("note:jan-alpha", "Projects/Alpha.md", {
        dateSignals: ["created in review range: 2026-01-02"],
        links: ["Shared/System.md", "Shared/Roadmap.md", "Shared/Review.md"],
        backlinks: ["Daily/2026-01-03.md"],
        commonLinks: ["Shared/System.md", "Shared/Roadmap.md"],
        repeatedPhrases: ["trusted evidence loop"],
        entities: ["Alpha"],
        crossFolderLinks: ["Areas/System.md"],
      }),
      evidenceNote("note:jan-beta", "Projects/Beta.md", {
        dateSignals: ["created in review range: 2026-01-04"],
        links: ["Shared/System.md", "Shared/Roadmap.md"],
        commonLinks: ["Shared/System.md"],
        repeatedPhrases: ["trusted evidence loop"],
      }),
      evidenceNote("note:feb-area", "Areas/Signal.md", {
        dateSignals: ["created in review range: 2026-02-05"],
        links: ["Shared/System.md"],
        commonLinks: ["Shared/System.md"],
      }),
      evidenceNote("note:mar-archive", "Archive/Long Tail.md", {
        dateSignals: ["created in review range: 2026-03-06"],
      }),
      evidenceNote("note:feb-daily", "Daily/2026-02-07.md", {
        dateSignals: ["created in review range: 2026-02-07"],
        weakSignals: ["tag:reflection"],
      }),
      evidenceNote("note:jan-project", "Projects/Gamma.md", {
        dateSignals: ["created in review range: 2026-01-08"],
        links: ["Shared/System.md"],
      }),
    ];

    const selected = selectThemeEvidenceNotes(notes, 4);
    const selectedPaths = selected.map((note) => note.path);

    expect(selectedPaths).toContain("Projects/Alpha.md");
    expect(selectedPaths).toContain("Areas/Signal.md");
    expect(selectedPaths).toContain("Archive/Long Tail.md");
    expect(
      new Set(selected.map((note) => note.dateSignals[0]?.slice(-10, -3))).size,
    ).toBeGreaterThan(1);
    expect(new Set(selected.map((note) => note.path.split("/")[0])).size).toBeGreaterThan(
      1,
    );
    expect(selectedPaths).not.toEqual(
      [...notes]
        .sort(
          (a, b) =>
            b.localSignals.length - a.localSignals.length ||
            b.links.length - a.links.length ||
            a.path.localeCompare(b.path),
        )
        .slice(0, 4)
        .map((note) => note.path),
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

  it("keeps diverse time, folder, connection, and long-tail evidence instead of only top scores", () => {
    const dominantFiles = Array.from({ length: 81 }, (_, index) =>
      sourceFrom({
        path: `Projects/Dominant/High ${String(index + 1).padStart(2, "0")}.md`,
        ctime: "2026-01-10T08:00:00.000Z",
        mtime: "2026-01-11T08:00:00.000Z",
        content: [
          `# Dominant ${index + 1}`,
          "The dominant evidence loop connects repeated planning notes to [[Shared/Hub.md]].",
          "The dominant evidence loop keeps the same high-score connection cluster visible.",
        ].join("\n"),
      }),
    );
    const longTail = sourceFrom({
      path: "Reflections/Long Tail Question.md",
      ctime: "2026-03-20T08:00:00.000Z",
      mtime: "2026-03-21T08:00:00.000Z",
      content: [
        "# Long Tail Question",
        "What quiet March clue should remain visible for review?",
        "#theme/quiet",
      ].join("\n"),
    });
    const aggregate = buildReviewAggregate(
      [...dominantFiles, longTail],
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );

    const evidencePackage = buildThemeEvidencePackage(
      aggregate,
      [...dominantFiles, longTail],
      DEFAULT_SETTINGS,
    );

    expect(evidencePackage.evidenceNotes).toHaveLength(80);
    expect(evidencePackage.evidenceNotes.map((note) => note.path)).toContain(
      "Reflections/Long Tail Question.md",
    );
    expect(evidencePackage.evidenceNotes.map((note) => note.path)).not.toContain(
      "Projects/Dominant/High 81.md",
    );
    expect(
      evidencePackage.evidenceNotes.find(
        (note) => note.path === "Reflections/Long Tail Question.md",
      )?.whyIncluded,
    ).toContain("contains reviewable questions");
  }, 15_000);

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
      outputSchema: {
        themeHypotheses: Array<{
          evidenceNoteIds: string[];
          reportNarrative: string;
        }>;
      };
      acceptanceRules: string[];
    };

    expect(prompt.inputPolicy.allowedInput).toContain("structured evidence package");
    expect(prompt.inputPolicy.weakSignalRule).toContain("weakSignals");
    expect(prompt.evidencePackage.evidenceNotes[0]?.id).toMatch(/^note:/u);
    expect(prompt.evidencePackage.evidenceNotes[0]?.excerpt).not.toContain("---");
    expect(prompt.outputSchema.themeHypotheses[0]?.evidenceNoteIds[0]).toContain(
      "evidence note ids",
    );
    expect(prompt.outputSchema.themeHypotheses[0]?.reportNarrative).toContain(
      "500-800 Chinese characters",
    );
    expect(prompt.outputSchema.themeHypotheses[0]?.reportNarrative).toContain(
      "underlying tension",
    );
    expect(prompt.acceptanceRules).toContain(
      "reportNarrative should connect 2-4 representative evidence notes into a first-pass story, using [[exact/path|readable alias]] links with aliases that remove leading date slugs.",
    );
    expect(prompt.acceptanceRules).toContain(
      "reportNarrative must make a deeper synthesis argument: what changed across the evidence notes, what pattern or contradiction it reveals, why it mattered in the review period, and what remains unresolved.",
    );
    expect(prompt.acceptanceRules).toContain(
      "Avoid generic report-meta sentences such as 'this theme should be treated as an early interpretation' or 'these notes preserve the original tone, judgment, and hesitation'.",
    );
  });

  it("validates AI theme hypotheses against the provider-visible evidence set", async () => {
    const files = Array.from({ length: 35 }, (_, index) =>
      sourceFrom({
        path: `Notes/${String(index).padStart(2, "0")}.md`,
        ctime: "2026-01-10T08:00:00.000Z",
        mtime: "2026-01-10T09:00:00.000Z",
        content: `# Note ${index}\n\nProvider-visible alignment evidence ${index}.`,
      }),
    );
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const enhancements = await renderAiReportEnhancements({
      aggregate,
      files,
      settings: { ...DEFAULT_SETTINGS, aiProvider: "chatgpt" },
      codexExecutor: async () => ({
        ok: true,
        content: JSON.stringify({
          periodJudgment: "Provider-visible validation check.",
          themeHypotheses: [
            {
              id: "theme-hidden",
              title: "Hidden evidence should not validate",
              summary: "This cites a note outside the provider-visible evidence set.",
              connectionExplanation:
                "The cited id belongs to the full eligible pool but not the bounded provider context.",
              evidenceNoteIds: ["note:notes-34-md"],
              source: "ai",
            },
          ],
        }),
      }),
    });

    expect(
      buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS).evidenceNotes,
    ).toHaveLength(35);
    expect(buildAiPrompt(aggregate, files, DEFAULT_SETTINGS)).not.toContain(
      "note:notes-34-md",
    );
    expect(enhancements.themeHypotheses).toEqual([]);
  });

  it("rejects ambiguous title evidence references instead of misbinding them", () => {
    const evidencePackage = {
      reviewRange: "2026-01-01 to 2026-03-31",
      evidenceNotes: [
        evidenceNote("note:projects-meeting-md", "Projects/Meeting.md", {
          title: "Meeting",
        }),
        evidenceNote("note:areas-meeting-md", "Areas/Meeting.md", {
          title: "Meeting",
        }),
      ],
    };

    const parsed = parseThemeHypotheses(
      JSON.stringify({
        themeHypotheses: [
          {
            title: "Ambiguous title",
            summary: "This should not bind a duplicate title to either note.",
            connectionExplanation:
              "The evidence reference uses a title shared by multiple notes.",
            evidenceNotes: ["Meeting"],
          },
          {
            title: "Stable id",
            summary: "Stable ids should still bind.",
            connectionExplanation: "The evidence reference uses the exact note id.",
            evidenceNoteIds: ["note:projects-meeting-md"],
          },
          {
            title: "Exact path",
            summary: "Exact paths should still bind.",
            connectionExplanation: "The evidence reference uses an exact visible path.",
            evidenceNotes: ["Areas/Meeting.md"],
          },
        ],
      }),
      evidencePackage,
    );

    expect(parsed).toHaveLength(2);
    expect(parsed.map((theme) => theme.title)).toEqual(["Stable id", "Exact path"]);
    expect(parsed[0]?.evidenceNoteIds).toEqual(["note:projects-meeting-md"]);
    expect(parsed[1]?.evidenceNoteIds).toEqual(["note:areas-meeting-md"]);
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
            reportNarrative:
              "A report-ready narrative connects [[Projects/Research|Research]] with [[Daily/2026-02-01|Daily evidence]] and keeps the target paths exact.",
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
      reportNarrative: expect.stringContaining("report-ready narrative"),
      evidenceNoteIds: ["note:projects-research-md", "note:daily-2026-02-01-md"],
    });
    expect(parsed[0]?.connectionExplanation).toContain("cross-link");
    expect(parsed[1]?.evidenceNoteIds).toEqual(["note:projects-legacy-md"]);
    expect(parsed[1]?.uncertainty).toContain("Low confidence");
  });

  it("does not misbind duplicate evidence note titles from legacy theme insights", async () => {
    const files = [
      sourceFrom({
        path: "Projects/Research.md",
        ctime: "2026-01-10T08:00:00.000Z",
        mtime: "2026-01-10T09:00:00.000Z",
        content: "# Research\n\nProject research evidence with enough local context.",
      }),
      sourceFrom({
        path: "Areas/Research.md",
        ctime: "2026-02-10T08:00:00.000Z",
        mtime: "2026-02-10T09:00:00.000Z",
        content: "# Research\n\nAreas research evidence with a duplicate title.",
      }),
    ];
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 1, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );

    const enhancements = await renderAiReportEnhancements({
      aggregate,
      files,
      settings: { ...DEFAULT_SETTINGS, aiProvider: "chatgpt" },
      codexExecutor: async () => ({
        ok: true,
        content: JSON.stringify({
          periodJudgment: "Duplicate evidence title check.",
          themeInsights: [
            {
              title: "Ambiguous title fallback",
              synthesis: "This should not bind a duplicate title.",
              connections: "The title Research appears in multiple evidence notes.",
              evidenceNotes: ["Research"],
            },
          ],
        }),
      }),
    });

    expect(enhancements.themeHypotheses).toEqual([]);
  });

  it("does not misbind duplicate evidence note titles when parsing theme hypotheses", () => {
    const evidencePackage = {
      reviewRange: "2026-01-01 to 2026-03-31",
      evidenceNotes: [
        evidenceNoteFixture({
          id: "note:projects-research-md",
          path: "Projects/Research.md",
          title: "Shared Title",
        }),
        evidenceNoteFixture({
          id: "note:archive-research-md",
          path: "Areas/Research.md",
          title: "Shared Title",
        }),
      ],
    };

    const parsed = parseThemeHypotheses(
      JSON.stringify({
        themeHypotheses: [
          {
            title: "Ambiguous title reference",
            summary: "This should not bind either duplicate title.",
            evidenceNotes: ["Shared Title"],
            connectionExplanation: "Duplicate titles are ambiguous.",
            source: "ai",
          },
          {
            title: "Stable id reference",
            summary: "Exact evidence ids remain valid even when titles duplicate.",
            evidenceNoteIds: ["note:projects-research-md"],
            connectionExplanation: "Stable ids are unambiguous.",
            source: "ai",
          },
        ],
      }),
      evidencePackage,
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      title: "Stable id reference",
      evidenceNoteIds: ["note:projects-research-md"],
      uncertainty: expect.stringContaining("Low confidence"),
    });
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
    expect(themes.map((theme) => theme.title).join(" ")).not.toContain("Linked thread:");
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
          localSignals: ["tag:theme/ai"],
          relatedNotes: [],
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
          localSignals: ["tag:theme/ai"],
          relatedNotes: [],
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
      title: "Low-confidence local clue",
      connectionExplanation: expect.stringContaining("weak evidence"),
    });
  });

  it("rewrites Chinese local fallback titles away from raw metadata labels", () => {
    const files = [
      sourceFrom({
        path: "2026月复盘/4月/散步.md",
        ctime: "2026-04-09T08:00:00.000Z",
        mtime: "2026-04-09T09:00:00.000Z",
        content:
          "---\ntheme: ai\n---\n# 散步\n\np-indent 和 [[纪馨玉]] 反复出现在关系回味的记录里。",
      }),
      sourceFrom({
        path: "2026月复盘/4月/对话.md",
        ctime: "2026-04-09T10:00:00.000Z",
        mtime: "2026-04-09T11:00:00.000Z",
        content: "# 对话\n\np-indent 和 [[纪馨玉]] 再次出现，记录靠近之后的边界感。",
      }),
    ];
    const aggregate = buildReviewAggregate(
      files,
      buildQuarterlyReviewSession(2026, 2, DEFAULT_SETTINGS),
      DEFAULT_SETTINGS,
    );
    const themes = buildLocalThemeHypotheses(
      buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS),
      "zh",
    );
    const text = themes
      .map((theme) => [theme.title, theme.summary, theme.connectionExplanation].join(" "))
      .join(" ");

    expect(themes.length).toBeGreaterThan(0);
    expect(text).not.toMatch(
      /2026月复盘|4月中的跨笔记主题|p-indent|纪馨玉|frontmatter|created in review range/u,
    );
    expect(themes[0]?.title).toMatch(/线索|记录/u);
  });
});

function evidenceNoteFixture(input: { id: string; path: string; title: string }) {
  return {
    id: input.id,
    path: input.path,
    title: input.title,
    dateSignals: [],
    excerpt: input.title,
    links: [],
    backlinks: [],
    commonLinks: [],
    frontmatterSignals: [],
    repeatedPhrases: [],
    questionSentences: [],
    entities: [],
    crossFolderLinks: [],
    weakSignals: [],
    localSignals: ["fixture signal"],
    relatedNotes: [],
    whyIncluded: "fixture evidence",
  };
}
