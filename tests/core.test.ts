import { describe, expect, it } from "vitest";
import { buildYearAggregate } from "../src/core/aggregate";
import { extractNoteStats, parseFrontmatter } from "../src/core/extract";
import { shouldIncludePath } from "../src/core/filters";
import { renderAnnualReview } from "../src/core/render";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { countText } from "../src/core/tokenizer";
import { COMMAND_IDS } from "../src/core/commands";
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
    expect(aggregate.monthBuckets[3]?.modified).toBe(1);
    expect(aggregate.monthBuckets[3]?.words).toBe(0);
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
    expect(markdown).toContain("| Month | Created | Modified | Words | Characters |");
    expect(markdown).toContain("| 2026-01 |");
    expect(markdown).toContain("| 2026-04 |");
    expect(markdown).not.toContain("| 2026-05 |");
    expect(markdown).not.toContain("| Tasks |");
    expect(markdown).not.toContain("Tasks completed");
    expect(markdown).not.toContain("## Tasks And Project Notes");
    expect(markdown).toContain("## Top Tags");
    expect(markdown).toContain("## Top Links");
    expect(markdown).toContain("## Top Folders");
    expect(markdown).toContain("## Representative Notes");
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
    expect(markdown).toContain("| 月份 | 修改 |");
    expect(markdown).toContain("| 2026-04 | 1 |");
    expect(markdown).not.toContain("| 新建 |");
    expect(markdown).not.toContain("| 字词 |");
    expect(markdown).not.toContain("| 字符 |");
    expect(markdown).not.toContain("| 2026-05 |");
  });
});

describe("plugin command ids", () => {
  it("exposes generate, open dashboard, and rebuild commands", () => {
    expect(COMMAND_IDS).toEqual({
      generate: "generate-annual-review",
      openDashboard: "open-annual-review-dashboard",
      rebuildIndex: "rebuild-annual-review-index",
    });
  });
});
