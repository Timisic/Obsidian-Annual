import type { DayBucket, MonthBucket, RankedMetric, RankedNote, ResolvedAnnualReviewLanguage, WordGrowthBucket, YearAggregate } from "./types";

interface RenderOptions {
  language?: ResolvedAnnualReviewLanguage;
  chartPaths?: Partial<Record<AnnualReviewChartKind, string>>;
}

type MonthMetric = "created" | "modified" | "words" | "characters";
export type AnnualReviewChartKind = "daily-word-heatmap" | "word-growth-trend";

export interface AnnualReviewChartAsset {
  kind: AnnualReviewChartKind;
  path: string;
  content: string;
}

export function buildAnnualReviewChartPaths(reportFolder: string, year: number): Record<AnnualReviewChartKind, string> {
  const folder = normalizeReportFolder(reportFolder || "Annual Reviews");
  const assetFolder = `${folder}/${year} Annual Review Assets`;
  return {
    "daily-word-heatmap": `${assetFolder}/daily-word-heatmap.svg`,
    "word-growth-trend": `${assetFolder}/word-growth-trend.svg`,
  };
}

export function buildAnnualReviewChartAssets(aggregate: YearAggregate, options: RenderOptions = {}): AnnualReviewChartAsset[] {
  const language = options.language ?? "en";
  const paths = options.chartPaths ?? buildAnnualReviewChartPaths("Annual Reviews", aggregate.year);
  const assets: AnnualReviewChartAsset[] = [];

  if (aggregate.dayBuckets.length > 0 && paths["daily-word-heatmap"]) {
    assets.push({
      kind: "daily-word-heatmap",
      path: paths["daily-word-heatmap"],
      content: renderDailyHeatmapSvg(aggregate.dayBuckets, language),
    });
  }

  if (aggregate.wordGrowthBuckets.length > 0 && paths["word-growth-trend"]) {
    assets.push({
      kind: "word-growth-trend",
      path: paths["word-growth-trend"],
      content: renderWordGrowthSvg(aggregate.wordGrowthBuckets, language),
    });
  }

  return assets;
}

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
    dailyWordHeatmap: "Daily Word Heatmap",
    dailyWordHeatmapEmpty: "No daily word data found.",
    dailyWordHeatmapLegend: "Embedded SVG chart: darker cells show higher daily created-note word volume.",
    dailyWordHeatmapColumn: "Daily word heatmap",
    peakDay: "Peak day",
    notAvailable: "n/a",
    wordGrowthTrend: "Word Growth Trend",
    wordGrowthTrendEmpty: "No word growth data found.",
    wordGrowthYAxis: "Y-axis: monthly created-note word growth. Cumulative words are listed in the data table.",
    wordGrowth: "Word growth",
    trend: "Trend",
    cumulativeWords: "Cumulative words",
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
    dailyWordHeatmap: "每日字词热力图",
    dailyWordHeatmapEmpty: "未找到每日字词数据。",
    dailyWordHeatmapLegend: "内嵌 SVG 图表：颜色越深表示每日新建笔记字词量越高。",
    dailyWordHeatmapColumn: "每日字词热力图",
    peakDay: "峰值日",
    notAvailable: "无",
    wordGrowthTrend: "字词增长趋势",
    wordGrowthTrendEmpty: "未找到字词增长数据。",
    wordGrowthYAxis: "纵轴：每月新建笔记字词增长量。累计字词列在数据表中。",
    wordGrowth: "字词增长",
    trend: "趋势",
    cumulativeWords: "累计字词",
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
    `## ${text.dailyWordHeatmap}`,
    "",
    renderDailyHeatmap(aggregate.dayBuckets, language, options.chartPaths?.["daily-word-heatmap"]),
    "",
    `## ${text.wordGrowthTrend}`,
    "",
    renderWordGrowthTrend(aggregate.wordGrowthBuckets, language, options.chartPaths?.["word-growth-trend"]),
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

function renderDailyHeatmap(days: DayBucket[], language: ResolvedAnnualReviewLanguage, chartPath?: string): string {
  const text = REPORT_TEXT[language];
  if (days.length === 0) {
    return text.dailyWordHeatmapEmpty;
  }

  const monthRows = new Map<string, DayBucket[]>();
  for (const day of days) {
    const month = monthRows.get(day.month) ?? [];
    month.push(day);
    monthRows.set(day.month, month);
  }

  return [
    text.dailyWordHeatmapLegend,
    "",
    chartPath ? renderChartReference(chartPath, text.dailyWordHeatmap) : renderDailyHeatmapSvg(days, language),
    "",
    `| ${text.month} | ${text.words} | ${text.activeDays} | ${text.peakDay} |`,
    "| --- | ---: | ---: | --- |",
    ...[...monthRows.entries()].map(([month, monthDays]) => {
      const totalWords = monthDays.reduce((sum, day) => sum + day.words, 0);
      const activeDays = monthDays.filter((day) => day.words > 0).length;
      const peak = [...monthDays].sort((a, b) => b.words - a.words || a.date.localeCompare(b.date))[0];
      const peakLabel = peak && peak.words > 0 ? `${peak.date} (${peak.words})` : text.notAvailable;
      return `| ${month} | ${totalWords} | ${activeDays} | ${peakLabel} |`;
    }),
  ].join("\n");
}

function renderWordGrowthTrend(growth: WordGrowthBucket[], language: ResolvedAnnualReviewLanguage, chartPath?: string): string {
  const text = REPORT_TEXT[language];
  if (growth.length === 0) {
    return text.wordGrowthTrendEmpty;
  }

  return [
    text.wordGrowthYAxis,
    "",
    chartPath ? renderChartReference(chartPath, text.wordGrowthTrend) : renderWordGrowthSvg(growth, language),
    "",
    `| ${text.month} | ${text.wordGrowth} | ${text.cumulativeWords} |`,
    "| --- | ---: | ---: |",
    ...growth.map((bucket) => `| ${bucket.month} | ${bucket.wordsGained} | ${bucket.cumulativeWords} |`),
  ].join("\n");
}

function renderDailyHeatmapSvg(days: DayBucket[], language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const cell = 10;
  const gap = 3;
  const left = 34;
  const top = 26;
  const maxWeek = Math.max(0, ...days.map((day) => day.week));
  const width = left + (maxWeek + 1) * (cell + gap) + 24;
  const height = top + 7 * (cell + gap) + 30;
  const maxWords = Math.max(1, ...days.map((day) => day.words));
  const firstMonthDays = days.filter((day) => day.dayOfMonth === 1);
  const weekdayLabels = language === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"];

  const monthLabels = firstMonthDays
    .map((day) => `<text x="${left + day.week * (cell + gap)}" y="14" font-size="10" fill="currentColor">${escapeHtml(day.month.slice(5))}</text>`)
    .join("\n");
  const weekdays = weekdayLabels
    .map((label, index) => `<text x="8" y="${top + index * (cell + gap) + 9}" font-size="9" fill="currentColor">${escapeHtml(label)}</text>`)
    .join("\n");
  const cells = days
    .map((day) => {
      const x = left + day.week * (cell + gap);
      const y = top + day.weekday * (cell + gap);
      const title = `${day.date}: ${day.words} ${text.words}, ${day.created} ${text.created}, ${day.modified} ${text.modified}`;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(day.words, maxWords)}"><title>${escapeHtml(title)}</title></rect>`;
    })
    .join("\n");

  return [
    `<svg class="annual-review-chart annual-review-heatmap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.dailyWordHeatmap)}">`,
    `<title>${escapeHtml(text.dailyWordHeatmap)}</title>`,
    `<desc>${escapeHtml(text.dailyWordHeatmapLegend)}</desc>`,
    monthLabels,
    weekdays,
    cells,
    "</svg>",
  ].join("\n");
}

function renderWordGrowthSvg(growth: WordGrowthBucket[], language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const width = 760;
  const height = 280;
  const left = 58;
  const right = 22;
  const top = 20;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxGrowth = niceMax(Math.max(1, ...growth.map((bucket) => bucket.wordsGained)));
  const ticks = [0, maxGrowth / 2, maxGrowth];
  const xScale = (index: number) => left + (plotWidth * index) / Math.max(1, growth.length - 1);
  const yScale = (words: number) => top + plotHeight - (words / maxGrowth) * plotHeight;
  const linePath = growth
    .map((bucket, index) => `${index === 0 ? "M" : "L"} ${formatNumber(xScale(index))} ${formatNumber(yScale(bucket.wordsGained))}`)
    .join(" ");

  const grid = ticks
    .map((tick) => {
      const y = top + plotHeight - (tick / maxGrowth) * plotHeight;
      return [
        `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d0d7de" stroke-width="1" />`,
        `<text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end" fill="currentColor">${Math.round(tick)}</text>`,
      ].join("\n");
    })
    .join("\n");

  const xTicks = growth
    .map((bucket, index) => {
      const labelX = xScale(index);
      const label = bucket.month.slice(5);
      const title = `${bucket.month}: ${bucket.wordsGained} ${text.wordGrowth}, ${bucket.cumulativeWords} ${text.cumulativeWords}`;
      return [
        `<line x1="${formatNumber(labelX)}" y1="${top + plotHeight}" x2="${formatNumber(labelX)}" y2="${top + plotHeight + 5}" stroke="#57606a" stroke-width="1" />`,
        `<text x="${formatNumber(labelX)}" y="${height - 24}" font-size="10" text-anchor="middle" fill="currentColor">${escapeHtml(label)}</text>`,
        bucket.wordsGained > 0
          ? `<circle cx="${formatNumber(labelX)}" cy="${formatNumber(yScale(bucket.wordsGained))}" r="4" fill="#b95e43"><title>${escapeHtml(title)}</title></circle>`
          : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n");

  const last = growth[growth.length - 1];
  const endpointDot = last
    ? `<circle class="endpoint-dot" cx="${formatNumber(xScale(growth.length - 1))}" cy="${formatNumber(yScale(last.wordsGained))}" r="5" fill="#b95e43"><title>${escapeHtml(`${last.month}: ${last.wordsGained} ${text.wordGrowth}`)}</title></circle>`
    : "";

  return [
    `<svg class="annual-review-chart annual-review-growth" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.wordGrowthTrend)}">`,
    `<title>${escapeHtml(text.wordGrowthTrend)}</title>`,
    `<desc>${escapeHtml(text.wordGrowthYAxis)}</desc>`,
    grid,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<text x="16" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" fill="currentColor" transform="rotate(-90 16 ${top + plotHeight / 2})">${escapeHtml(text.wordGrowth)}</text>`,
    `<path class="chart-line" d="${linePath}" fill="none" stroke="#b95e43" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`,
    xTicks,
    endpointDot,
    "</svg>",
  ].join("\n");
}

function renderChartReference(path: string, alt: string): string {
  return `![[${path}|${alt}]]`;
}

function normalizeReportFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/gu, "").replace(/\/{2,}/gu, "/") || "Annual Reviews";
}

function heatColor(words: number, maxWords: number): string {
  if (words <= 0) {
    return "#ebedf0";
  }
  const colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"];
  const index = Math.min(colors.length - 1, Math.ceil((words / maxWords) * colors.length) - 1);
  return colors[index] ?? colors[0];
}

function niceMax(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const niceScaled = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return niceScaled * power;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
