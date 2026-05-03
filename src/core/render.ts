import type { MonthBucket, RankedMetric, RankedNote, YearAggregate } from "./types";

export function renderAnnualReview(aggregate: YearAggregate): string {
  return [
    `# ${aggregate.year} Annual Review`,
    "",
    `Generated: ${aggregate.generatedAt}`,
    `Included scope: ${formatScope(aggregate.scope.includeFolders, "All Markdown files")}`,
    `Excluded scope: ${formatScope(aggregate.scope.excludeFolders, "None")}`,
    `Privacy mode: ${aggregate.scope.privacyMode}`,
    "",
    "## Executive Summary",
    "",
    `- Created ${aggregate.createdCount} notes and modified ${aggregate.modifiedCount} notes across ${aggregate.activeDays} active days.`,
    `- Created-note content totals include ${aggregate.totalWords} counted words and ${aggregate.totalCharacters} non-whitespace characters.`,
    `- Longest writing streak: ${aggregate.longestStreak} day${aggregate.longestStreak === 1 ? "" : "s"}.`,
    `- Tracked ${aggregate.completedTaskCount}/${aggregate.taskCount} completed Markdown tasks.`,
    "",
    "## Year Totals",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Notes created | ${aggregate.createdCount} |`,
    `| Notes modified | ${aggregate.modifiedCount} |`,
    `| Active days | ${aggregate.activeDays} |`,
    `| Longest streak | ${aggregate.longestStreak} |`,
    `| Created-note words | ${aggregate.totalWords} |`,
    `| Created-note characters | ${aggregate.totalCharacters} |`,
    `| Tasks completed | ${aggregate.completedTaskCount}/${aggregate.taskCount} |`,
    "",
    "## Monthly Timeline",
    "",
    renderMonthTable(aggregate.monthBuckets),
    "",
    "## Top Tags",
    "",
    renderMetricList(aggregate.topTags, "#"),
    "",
    "## Top Folders",
    "",
    renderMetricList(aggregate.topFolders),
    "",
    "## Top Links",
    "",
    renderMetricList(aggregate.topLinks.map((item) => ({ ...item, name: linkName(item.name) }))),
    "",
    "## Representative Notes",
    "",
    renderNoteList(aggregate.representativeNotes),
    "",
    "## Writing And Activity Rhythm",
    "",
    renderRhythm(aggregate.monthBuckets),
    "",
    "## Tasks And Project Notes",
    "",
    `Markdown task completion: ${aggregate.completedTaskCount}/${aggregate.taskCount}.`,
    "",
    "## Data Methodology",
    "",
    "- The plugin scans Markdown files in the active vault using Obsidian vault APIs.",
    "- Generated annual review notes are excluded from future scans by default.",
    "- A note is counted for activity when its created or modified timestamp falls inside that year.",
    "- Word, character, and task totals are attributed to the selected year only for notes created in that year; legacy notes modified during the year contribute modification activity and evidence links without inflating writing volume.",
    "- Word count treats Latin words as tokens and CJK characters as individual countable units; character count excludes whitespace.",
    "- Top lists sort by count descending, then name/path ascending for stable tie-breaking.",
    "- Links are Obsidian wiki links collected from note bodies; generated reports stay local and do not require network access.",
    "",
    "## Suggested Next-Year Actions",
    "",
    "- Review months with low activity and add context while the year is still memorable.",
    "- Turn representative notes into index or MOC notes where useful.",
    "- Clean up high-value tags and folders before starting the next annual review cycle.",
    "",
  ].join("\n");
}

function formatScope(items: string[], emptyLabel: string): string {
  return items.length > 0 ? items.join(", ") : emptyLabel;
}

function renderMonthTable(months: MonthBucket[]): string {
  return [
    "| Month | Created | Modified | Words | Characters | Tasks |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...months.map((month) => `| ${month.month} | ${month.created} | ${month.modified} | ${month.words} | ${month.characters} | ${month.completedTasks}/${month.tasks} |`),
  ].join("\n");
}

function renderMetricList(items: RankedMetric[], prefix = ""): string {
  if (items.length === 0) {
    return "- No data found.";
  }
  return items.map((item) => `- ${prefix}${item.name}: ${item.count}`).join("\n");
}

function renderNoteList(notes: RankedNote[]): string {
  if (notes.length === 0) {
    return "- No representative notes found.";
  }
  return notes.map((note) => `- ${wikiLink(note.path, note.title)} (${note.words} words, ${note.characters} chars)`).join("\n");
}

function renderRhythm(months: MonthBucket[]): string {
  const active = months.filter((month) => month.created > 0 || month.modified > 0);
  if (active.length === 0) {
    return "No activity was found for the selected year.";
  }
  const strongest = [...active].sort((a, b) => b.words - a.words || a.month.localeCompare(b.month))[0];
  return `Most created-note writing volume appears in ${strongest?.month ?? "n/a"} with ${strongest?.words ?? 0} counted words.`;
}

function wikiLink(path: string, title: string): string {
  return `[[${path.replace(/\.md$/u, "")}|${title}]]`;
}

function linkName(name: string): string {
  return `[[${name}]]`;
}
