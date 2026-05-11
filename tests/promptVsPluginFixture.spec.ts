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
    expect(prompt).toContain("Review Fixtures/2026-01-01.md");
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
