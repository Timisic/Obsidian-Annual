import { describe, expect, it } from "vitest";
import { buildAiPrompt, renderAiReportSection } from "../src/core/ai";
import { buildYearAggregate } from "../src/core/aggregate";
import { extractNoteStats, parseFrontmatter } from "../src/core/extract";
import { shouldIncludePath } from "../src/core/filters";
import { renderAnnualReview } from "../src/core/render";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { countText } from "../src/core/tokenizer";
import { COMMAND_IDS, COMMAND_NAMES } from "../src/core/commands";
import { readVaultMarkdownFiles } from "../src/obsidian/vaultFiles";
import { fixtureFile, fixtureVault } from "./fixtures";

describe("tokenizer", () => {
  it("counts English words, CJK characters, and mixed text", () => {
    expect(countText("hello annual review").words).toBe(3);
    expect(countText("年度回顾").words).toBe(4);
    expect(countText("hello 年度 review").words).toBe(4);
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
    expect(parseFrontmatter("---\ntags: [a, b]\ncategory:\n  - work\n  - personal\ndraft: true\n---\nBody").frontmatter).toEqual({
      tags: ["a", "b"],
      category: ["work", "personal"],
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

    const markdown = renderAnnualReview(aggregate);
    expect(markdown).toContain("- [[Projects/Research.md]]: 4");
  });

  it("renders the annual review with required plain Markdown sections", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const markdown = renderAnnualReview(aggregate);
    expect(markdown).toContain("# 2026 Annual Review");
    expect(markdown).toMatch(/^---\ngenerated: ".+"\nyear: 2026\nincluded_scope: "All Markdown files"\nexcluded_scope: "\.obsidian, Templates, Archive, Attachments"\nprivacy_mode: "standard"\nreport_language: "en"\n---/u);
    expect(markdown).not.toContain("Generated:");
    expect(markdown).not.toContain("Included scope:");
    expect(markdown).not.toContain("Excluded scope:");
    expect(markdown).toContain("## Year Totals");
    expect(markdown).toContain("## Monthly Timeline");
    expect(markdown).toContain("## Daily Word Heatmap");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-heatmap\"");
    expect(markdown).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(markdown).toContain("<rect");
    expect(markdown).toContain("| Month | Words | Active days | Peak day |");
    expect(markdown).not.toContain("Legend: . = 0 words");
    expect(markdown).not.toMatch(/[░▒▓█]/u);
    expect(markdown).toContain("## Word Growth Trend");
    expect(markdown).toContain("Y-axis: monthly created-note word growth");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-growth\"");
    const monthlySection = sectionBetween(markdown, "## Monthly Timeline", "## Daily Word Heatmap");
    expect(monthlySection).toContain("| Month | Created | Modified | Words | Characters |");
    expect(monthlySection).toContain("| 2026-01 |");
    expect(monthlySection).toContain("| 2026-04 |");
    expect(monthlySection).not.toContain("| 2026-05 |");
    expect(monthlySection).not.toContain("| Tasks |");
    expect(markdown).not.toContain("Tasks completed");
    expect(markdown).not.toContain("## Tasks And Project Notes");
    expect(markdown).toContain("## Top Tags");
    expect(markdown).toContain("## Top Links");
    expect(markdown).toContain("## Top Folders");
    expect(markdown).toContain("## Representative Notes");
    expect(markdown).toContain("Representative notes are selected deterministically");
    expect(markdown).toContain("This stable evidence set can be reused by later AI summaries.");
    expect(markdown).not.toContain("## Data Methodology");
    expect(markdown).not.toContain("## Suggested Next-Year Actions");
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
    expect(markdown).toContain("## 年度统计");
    expect(markdown).toContain("## 每日字词热力图");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-heatmap\"");
    expect(markdown).toContain("## 字词增长趋势");
    expect(markdown).toContain("class=\"annual-review-chart annual-review-growth\"");
    expect(markdown).toContain("代表笔记采用确定性规则选择");
    const monthlySection = sectionBetween(markdown, "## 月度时间线", "## 每日字词热力图");
    expect(monthlySection).toContain("| 月份 | 修改 |");
    expect(monthlySection).toContain("| 2026-04 | 1 |");
    expect(monthlySection).not.toContain("| 新建 |");
    expect(monthlySection).not.toContain("| 字词 |");
    expect(monthlySection).not.toContain("| 字符 |");
    expect(monthlySection).not.toContain("| 2026-05 |");
  });
});

describe("AI provider", () => {
  it("skips network calls when ChatGPT is selected without an API key", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
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
    });

    expect(section).toContain("ChatGPT provider was selected, but no OpenAI API key is configured");
    expect(section).toContain("AI Integration TODO");
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
    expect(section).toContain("Provider: ChatGPT (gpt-test)");
    expect(section).toContain("Personalized draft");
    expect(section).toContain("[[Daily/2026-01-01]]");
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
});

describe("plugin command ids", () => {
  it("exposes stable command ids and English command palette labels", () => {
    expect(COMMAND_IDS).toEqual({
      generate: "generate-annual-review",
      openDashboard: "open-annual-review-dashboard",
      rebuildIndex: "rebuild-annual-review-index",
    });
    expect(COMMAND_NAMES).toEqual({
      generate: "Generate report",
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
