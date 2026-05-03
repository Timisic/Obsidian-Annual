import type { MonthBucket, RankedMetric, RankedNote, ResolvedAnnualReviewLanguage, YearAggregate } from "./types";

interface RenderOptions {
  language?: ResolvedAnnualReviewLanguage;
}

type MonthMetric = "created" | "modified" | "words" | "characters";

const REPORT_TEXT = {
  en: {
    title: (year: number) => `${year} Annual Review`,
    allMarkdownFiles: "All Markdown files",
    none: "None",
    executiveSummary: "Executive Summary",
    createdModifiedSummary: (created: number, modified: number, activeDays: number) =>
      `Created ${created} notes and modified ${modified} notes across ${activeDays} active days.`,
    contentSummary: (words: number, characters: number) => `Created-note content totals include ${words} counted words and ${characters} non-whitespace characters.`,
    longestStreak: (days: number) => `Longest writing streak: ${days} day${days === 1 ? "" : "s"}.`,
    yearTotals: "Year Totals",
    metric: "Metric",
    value: "Value",
    notesCreated: "Notes created",
    notesModified: "Notes modified",
    activeDays: "Active days",
    longestStreakMetric: "Longest streak",
    createdNoteWords: "Created-note words",
    createdNoteCharacters: "Created-note characters",
    monthlyTimeline: "Monthly Timeline",
    month: "Month",
    created: "Created",
    modified: "Modified",
    words: "Words",
    characters: "Characters",
    noMonthlyActivity: "No monthly activity found.",
    topTags: "Top Tags",
    topFolders: "Top Folders",
    topLinks: "Top Links",
    representativeNotes: "Representative Notes",
    representativeNotesDescription:
      "Representative notes are selected deterministically: each active month contributes the highest-volume note from that month's created notes, or from modified notes when the note was created in another year. Ranking uses counted words, then characters, then path as the tie-breaker. This stable evidence set can be reused by later AI summaries.",
    writingAndActivityRhythm: "Writing And Activity Rhythm",
    noDataFound: "No data found.",
    noRepresentativeNotes: "No representative notes found.",
    noteStats: (words: number, characters: number) => `${words} words, ${characters} chars`,
    noActivity: "No activity was found for the selected year.",
    strongestMonth: (month: string, words: number) => `Most created-note writing volume appears in ${month} with ${words} counted words.`,
  },
  zh: {
    title: (year: number) => `${year} 年度回顾`,
    allMarkdownFiles: "全部 Markdown 文件",
    none: "无",
    executiveSummary: "执行摘要",
    createdModifiedSummary: (created: number, modified: number, activeDays: number) => `创建 ${created} 篇笔记，修改 ${modified} 篇笔记，共 ${activeDays} 个活跃日。`,
    contentSummary: (words: number, characters: number) => `新建笔记内容共 ${words} 个计数字词，${characters} 个非空白字符。`,
    longestStreak: (days: number) => `最长写作连续天数：${days} 天。`,
    yearTotals: "年度统计",
    metric: "指标",
    value: "数值",
    notesCreated: "新建笔记",
    notesModified: "修改笔记",
    activeDays: "活跃日",
    longestStreakMetric: "最长连续天数",
    createdNoteWords: "新建笔记字词",
    createdNoteCharacters: "新建笔记字符",
    monthlyTimeline: "月度时间线",
    month: "月份",
    created: "新建",
    modified: "修改",
    words: "字词",
    characters: "字符",
    noMonthlyActivity: "未找到月度活动。",
    topTags: "高频标签",
    topFolders: "高频文件夹",
    topLinks: "高频链接",
    representativeNotes: "代表笔记",
    representativeNotesDescription:
      "代表笔记采用确定性规则选择：每个活跃月份选出该月新建笔记中内容量最高的一篇；如果笔记不是当年新建但在该月被修改，也会参与该月选择。排序依次比较计数字词、字符数和路径。这个稳定证据集可供后续 AI 总结复用。",
    writingAndActivityRhythm: "写作与活动节奏",
    noDataFound: "未找到数据。",
    noRepresentativeNotes: "未找到代表笔记。",
    noteStats: (words: number, characters: number) => `${words} 字词，${characters} 字符`,
    noActivity: "所选年份未找到活动。",
    strongestMonth: (month: string, words: number) => `新建笔记写作量最高的月份是 ${month}，共 ${words} 个计数字词。`,
  },
} as const;

export function renderAnnualReview(aggregate: YearAggregate, options: RenderOptions = {}): string {
  const language = options.language ?? "en";
  const text = REPORT_TEXT[language];
  return [
    renderMetadata(aggregate, language),
    "",
    `# ${text.title(aggregate.year)}`,
    "",
    `## ${text.executiveSummary}`,
    "",
    `- ${text.createdModifiedSummary(aggregate.createdCount, aggregate.modifiedCount, aggregate.activeDays)}`,
    `- ${text.contentSummary(aggregate.totalWords, aggregate.totalCharacters)}`,
    `- ${text.longestStreak(aggregate.longestStreak)}`,
    "",
    `## ${text.yearTotals}`,
    "",
    `| ${text.metric} | ${text.value} |`,
    "| --- | ---: |",
    `| ${text.notesCreated} | ${aggregate.createdCount} |`,
    `| ${text.notesModified} | ${aggregate.modifiedCount} |`,
    `| ${text.activeDays} | ${aggregate.activeDays} |`,
    `| ${text.longestStreakMetric} | ${aggregate.longestStreak} |`,
    `| ${text.createdNoteWords} | ${aggregate.totalWords} |`,
    `| ${text.createdNoteCharacters} | ${aggregate.totalCharacters} |`,
    "",
    `## ${text.monthlyTimeline}`,
    "",
    renderMonthTable(aggregate.monthBuckets, language),
    "",
    `## ${text.topTags}`,
    "",
    renderMetricList(aggregate.topTags, "#", language),
    "",
    `## ${text.topFolders}`,
    "",
    renderMetricList(aggregate.topFolders, "", language),
    "",
    `## ${text.topLinks}`,
    "",
    renderMetricList(aggregate.topLinks.map((item) => ({ ...item, name: linkName(item.name) })), "", language),
    "",
    `## ${text.representativeNotes}`,
    "",
    text.representativeNotesDescription,
    "",
    renderNoteList(aggregate.representativeNotes, language),
    "",
    `## ${text.writingAndActivityRhythm}`,
    "",
    renderRhythm(aggregate.monthBuckets, language),
    "",
  ].join("\n");
}

function formatScope(items: string[], emptyLabel: string): string {
  return items.length > 0 ? items.join(", ") : emptyLabel;
}

function renderMetadata(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  return [
    "---",
    `generated: ${JSON.stringify(aggregate.generatedAt)}`,
    `year: ${aggregate.year}`,
    `included_scope: ${JSON.stringify(formatScope(aggregate.scope.includeFolders, text.allMarkdownFiles))}`,
    `excluded_scope: ${JSON.stringify(formatScope(aggregate.scope.excludeFolders, text.none))}`,
    `privacy_mode: ${JSON.stringify(aggregate.scope.privacyMode)}`,
    `report_language: ${JSON.stringify(language)}`,
    "---",
  ].join("\n");
}

function renderMonthTable(months: MonthBucket[], language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const activeMonths = months.filter(hasMonthData);
  if (activeMonths.length === 0) {
    return `- ${text.noMonthlyActivity}`;
  }
  const monthMetrics: MonthMetric[] = ["created", "modified", "words", "characters"];
  const metrics = monthMetrics.filter((metric) => activeMonths.some((month) => month[metric] > 0));
  const header = [text.month, ...metrics.map((metric) => text[metric])];
  const alignment = ["---", ...metrics.map(() => "---:")];
  return [
    `| ${header.join(" | ")} |`,
    `| ${alignment.join(" | ")} |`,
    ...activeMonths.map((month) => `| ${[month.month, ...metrics.map((metric) => String(month[metric]))].join(" | ")} |`),
  ].join("\n");
}

function renderMetricList(items: RankedMetric[], prefix = "", language: ResolvedAnnualReviewLanguage = "en"): string {
  if (items.length === 0) {
    return `- ${REPORT_TEXT[language].noDataFound}`;
  }
  return items.map((item) => `- ${prefix}${item.name}: ${item.count}`).join("\n");
}

function renderNoteList(notes: RankedNote[], language: ResolvedAnnualReviewLanguage): string {
  if (notes.length === 0) {
    return `- ${REPORT_TEXT[language].noRepresentativeNotes}`;
  }
  return notes.map((note) => `- ${wikiLink(note.path, note.title)} (${REPORT_TEXT[language].noteStats(note.words, note.characters)})`).join("\n");
}

function renderRhythm(months: MonthBucket[], language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const active = months.filter((month) => month.created > 0 || month.modified > 0);
  if (active.length === 0) {
    return text.noActivity;
  }
  const strongest = [...active].sort((a, b) => b.words - a.words || a.month.localeCompare(b.month))[0];
  return text.strongestMonth(strongest?.month ?? "n/a", strongest?.words ?? 0);
}

function hasMonthData(month: MonthBucket): boolean {
  return month.created > 0 || month.modified > 0 || month.words > 0 || month.characters > 0;
}

function wikiLink(path: string, title: string): string {
  return `[[${path.replace(/\.md$/u, "")}|${title}]]`;
}

function linkName(name: string): string {
  return `[[${name}]]`;
}
