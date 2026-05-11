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

import { reviewCandidateFixture, withFakeDocument } from "./testHelpers";

describe("plugin command ids", () => {
  it("exposes stable command ids and English command palette labels", () => {
    expect(COMMAND_IDS).toEqual({
      generate: "generate-annual-review",
      generateSmoke2026: "generate-annual-review-2026",
      generateSmoke2026Custom: "generate-annual-review-2026-custom-range",
      generateSmoke2026Q1: "generate-annual-review-2026-q1",
      openDashboard: "open-annual-review-dashboard",
      rebuildIndex: "rebuild-annual-review-index",
    });
    expect(COMMAND_NAMES).toEqual({
      generate: "Generate report",
      generateSmoke2026: "Smoke: Generate 2026 report",
      generateSmoke2026Custom: "Smoke: Generate 2026 custom range report",
      generateSmoke2026Q1: "Smoke: Generate 2026 Q1 report",
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
      "text.openSourceNote",
    ]) {
      expect(source).toContain(actionText);
    }

    for (const actionType of [
      '"accept"',
      '"ignore"',
      '"rename-topic"',
      '"merge-topic"',
    ]) {
      expect(source).toContain(actionType);
    }

    expect(source).toContain("this.controller.openSourceNote(candidate.id)");
  });

  it("builds a concise selected-note detail model from local candidate data", () => {
    const candidate = reviewCandidateFixture("detail", "Detail Topic", "candidate", {
      reason: "Fallback reason that should not win when excerpt evidence exists.",
      rank: 4,
      rankReason: "Ranked because the note has review-worthy local evidence.",
      evidence: [
        {
          id: "detail-excerpt",
          kind: "excerpt",
          label: "Projects/Detail.md",
          target: "Projects/Detail.md",
          sourcePath: "Projects/Detail.md",
          excerpt:
            "This note captures the main review decision and enough local context to summarize it.",
          reason: "excerpt",
        },
      ],
      sourcePaths: ["Projects/Detail.md"],
    });

    const detail = buildReviewDetailModel(candidate);

    expect(detail.summary).toBe(
      "This note captures the main review decision and enough local context to summarize it.",
    );
    expect(detail.metadata).toEqual([
      "theme-hypothesis / candidate",
      "rank 4",
      "Ranked because the note has review-worthy local evidence.",
    ]);
    expect(detail.evidence).toHaveLength(1);
    expect(detail.linkedNotes).toEqual({
      paths: ["Projects/Detail.md"],
      layout: "inline",
    });
  });

  it("formats many selected-note linked notes as a list model", () => {
    const candidate = reviewCandidateFixture("links", "Linked Topic", "candidate", {
      sourcePaths: ["Projects/A.md", "Projects/B.md", "Projects/C.md", "Projects/D.md"],
      evidence: [
        {
          id: "links-evidence",
          kind: "note",
          label: "Projects/A.md",
          target: "Projects/A.md",
          sourcePath: "Projects/A.md",
        },
      ],
      reasons: [
        {
          type: "topic-bridge",
          label: "Connects many project notes.",
          evidenceId: "links-evidence",
          sourcePath: "Projects/A.md",
          relatedPaths: [
            "Projects/B.md",
            "Projects/C.md",
            "Projects/D.md",
            "Projects/E.md",
          ],
        },
      ],
    });

    expect(buildReviewDetailModel(candidate).linkedNotes).toEqual({
      paths: [
        "Projects/A.md",
        "Projects/B.md",
        "Projects/C.md",
        "Projects/D.md",
        "Projects/E.md",
      ],
      layout: "list",
    });
  });

  it("advances Review Board selection to the next actionable pending candidate after a decision", () => {
    const candidates = [
      reviewCandidateFixture("current", "Current Topic", "accepted"),
      reviewCandidateFixture("topic", "Topic Signal", "candidate"),
      reviewCandidateFixture("next", "Next Theme", "candidate"),
      reviewCandidateFixture("closed", "Closed Topic", "ignored"),
    ];

    expect(
      getActionCandidateId({
        type: "accept",
        candidateId: "current",
        at: "2026-05-08T00:00:00.000Z",
      }),
    ).toBe("current");
    expect(isPendingReviewQueueCandidate(candidates[1] as ReviewCandidate)).toBe(true);
    expect(isPendingReviewQueueCandidate(candidates[2] as ReviewCandidate)).toBe(true);
    expect(getNextReviewSelection(candidates, "current")).toBe("topic");
  });

  it("keeps pending theme hypotheses in Review Board queue fallback selection", () => {
    const candidates = [
      reviewCandidateFixture("current", "Current Note", "accepted"),
      reviewCandidateFixture("topic", "Topic Signal", "candidate"),
      reviewCandidateFixture("closed", "Closed Topic", "ignored"),
    ];

    expect(getNextReviewSelection(candidates, "current")).toBe("topic");
  });
});
