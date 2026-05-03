import { toTopicEvolutionJson } from "./topics";
import type { DayBucket, HighValueNote, MonthBucket, RankedMetric, RankedNote, ResolvedAnnualReviewLanguage, TopicEvolutionData, TopicMonthlyBucket, TopTopic, WordGrowthBucket, YearAggregate } from "./types";

interface RenderOptions {
  language?: ResolvedAnnualReviewLanguage;
  chartPaths?: Partial<Record<AnnualReviewChartKind, string>>;
  periodJudgment?: string;
}

type MonthMetric = "created" | "modified" | "words" | "characters";
export type AnnualReviewChartKind = "daily-cumulative-words" | "daily-word-heatmap" | "word-growth-trend" | "topic-evolution" | "topic-evolution-data";

export interface AnnualReviewChartAsset {
  kind: AnnualReviewChartKind;
  path: string;
  content: string;
}

export function buildAnnualReviewChartPaths(reportFolder: string, year: number): Record<AnnualReviewChartKind, string> {
  const folder = normalizeReportFolder(reportFolder || "Annual Reviews");
  const assetFolder = `${folder}/${year} Annual Review Assets`;
  return {
    "daily-cumulative-words": `${assetFolder}/daily-cumulative-words.svg`,
    "daily-word-heatmap": `${assetFolder}/daily-word-heatmap.svg`,
    "word-growth-trend": `${assetFolder}/word-growth-trend.svg`,
    "topic-evolution": `${assetFolder}/topic-evolution.svg`,
    "topic-evolution-data": `${assetFolder}/topic-evolution.json`,
  };
}

export function buildAnnualReviewChartAssets(aggregate: YearAggregate, options: RenderOptions = {}): AnnualReviewChartAsset[] {
  const language = options.language ?? "en";
  const paths = options.chartPaths ?? buildAnnualReviewChartPaths("Annual Reviews", aggregate.year);
  const assets: AnnualReviewChartAsset[] = [];

  if (aggregate.dayBuckets.length > 0 && paths["daily-cumulative-words"]) {
    assets.push({
      kind: "daily-cumulative-words",
      path: paths["daily-cumulative-words"],
      content: renderDailyCumulativeWordsSvg(aggregate.dayBuckets, language),
    });
  }

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

  if (aggregate.topicEvolution.topTopics.length > 0 && paths["topic-evolution"]) {
    assets.push({
      kind: "topic-evolution",
      path: paths["topic-evolution"],
      content: renderTopicEvolutionSvg(aggregate.topicEvolution, language),
    });
  }

  if (aggregate.topicEvolution.topTopics.length > 0 && paths["topic-evolution-data"]) {
    assets.push({
      kind: "topic-evolution-data",
      path: paths["topic-evolution-data"],
      content: `${JSON.stringify(toTopicEvolutionJson(aggregate.topicEvolution), null, 2)}\n`,
    });
  }

  return assets;
}

const REPORT_TEXT = {
  en: {
    title: (year: number) => `${year} Annual Review`,
    allMarkdownFiles: "All Markdown files",
    none: "None",
    periodJudgment: "One-Sentence Judgment",
    defaultPeriodJudgment: (words: number, activeDays: number, topics: string[]) =>
      `This period added ${formatInteger(words)} words across ${activeDays} writing days; the clearest content themes are ${formatQuotedList(topics)}.`,
    writingGrowth: "Writing Growth",
    totalNewWords: "Total new words",
    writingDays: "Writing days",
    longestWritingStreak: "Longest writing streak",
    dailyCumulativeWordChart: "Daily Cumulative Word Chart",
    dailyCumulativeWordChartLegend: "Embedded SVG chart: the line shows cumulative created-note words by day.",
    monthlyGrowthChart: "Monthly Growth Chart",
    heatmap: "Heatmap",
    growthFeedback: "Writing Growth Feedback",
    strength: "Advantage",
    risk: "Risk",
    suggestion: "Suggestion",
    growthStrength: (activeDays: number, longestStreak: number) => `Writing appeared on ${activeDays} days, and the longest streak reached ${longestStreak} day${longestStreak === 1 ? "" : "s"}.`,
    growthRisk: (activeMonths: number) => `Writing volume is concentrated in ${activeMonths} active month${activeMonths === 1 ? "" : "s"}, so gaps can still hide behind the annual total.`,
    growthSuggestion: "Next period, protect a small weekly writing cadence before optimizing for peak-output days.",
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
    topicEvolution: "Topic Evolution",
    topicEvolutionSummary: (topics: string[]) => `The clearest content growth this period is in ${formatQuotedList(topics)}.`,
    topicEvolutionEmpty: "No topic data found.",
    topicEvolutionLegend: "Stacked SVG chart: monthly created-note words by top topic, with smaller topics grouped as Other.",
    topicEvolutionChart: "Topic evolution",
    topic: "Topic",
    addedWords: "Added words",
    newNotes: "New notes",
    topicFeedback: "Feedback Signals",
    mainThreads: (topics: string[]) => `Main thread: these themes now have enough weight to guide review: ${formatQuotedList(topics)}.`,
    emergingDirection: (topics: string[]) => `Emerging direction: ${formatQuotedList(topics)} started growing recently and deserves a concrete next question.`,
    noEmergingDirection: "Emerging direction: no clear new topic signal yet.",
    needsAttention: (topics: string[]) => `Needs attention: ${formatQuotedList(topics)} has had no new content in recent active months; decide whether to archive or restart it.`,
    noDecliningDirection: "Needs attention: no clearly dormant topic signal yet.",
    nextTopicAction: "Next-period suggestion: turn the leading theme into a small index page with evidence notes and open questions.",
    topTags: "Top Tags",
    topFolders: "Top Folders",
    topLinks: "Top Links",
    highValueNotes: "High Value Notes",
    topHighValueNotes: "Top 10 high-value notes",
    outputReadyNotes: "Output-ready notes",
    maintenanceNotes: "Notes needing maintenance",
    noOutputReadyNotes: "No output-ready notes found.",
    noMaintenanceNotes: "No maintenance-needed notes found.",
    highValueNotesSummary: (count: number, outputReady: number) => `The Top ${count} list below is the first review queue; ${outputReady} notes across the vault currently look output-ready.`,
    highValueNote: "Note",
    highValueType: "Type",
    highValueReason: "Value reason",
    suggestedAction: "Suggested action",
    highValueFeedback: "High Value Note Feedback",
    priorityNotes: (notes: string) => `This period's best notes to keep moving are ${notes}.`,
    outputReadySignal: (count: number) => `${count} notes have enough structure to be shaped into an article, index, or review memo.`,
    staleCoreSignal: (count: number) => `${count} core notes have not been updated for more than 90 days and should be reviewed next period.`,
    noHighValueNotes: "No high-value note signals found.",
    nextPeriodActions: "Next-Period Actions",
    mocAction: (topic: string) => `Create a compact index for ${topic}: evidence notes, current conclusion, and one next question.`,
    isolatedNotesAction: (count: number) => `Connect or decide the fate of ${count} isolated potential note${count === 1 ? "" : "s"}.`,
    noIsolatedNotesAction: "No isolated-potential notes need immediate handling.",
    highValuePushAction: (notes: string) => `Move forward ${notes} as the next high-value note focus.`,
    noHighValuePushAction: "No high-value note push is available from the current signals.",
    nextPeriodSuggestion: "Next Period Suggestion",
    highValueNextStep: "Prioritize these notes instead of adding undifferentiated new content.",
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
    periodJudgment: "本期一句话判断",
    defaultPeriodJudgment: (words: number, activeDays: number, topics: string[]) =>
      `本期新增 ${formatInteger(words)} 个字词，覆盖 ${activeDays} 个写作日；最清晰的内容主题是${formatQuotedList(topics)}。`,
    writingGrowth: "写作增长",
    totalNewWords: "总新增字数",
    writingDays: "写作天数",
    longestWritingStreak: "最长连续写作",
    dailyCumulativeWordChart: "日累计字数图",
    dailyCumulativeWordChartLegend: "内嵌 SVG 图表：折线展示每日新建笔记字词的累计增长。",
    monthlyGrowthChart: "月度增长图",
    heatmap: "热力图",
    growthFeedback: "写作增长反馈",
    strength: "优点",
    risk: "风险",
    suggestion: "建议",
    growthStrength: (activeDays: number, longestStreak: number) => `本期有 ${activeDays} 个写作日，最长连续写作达到 ${longestStreak} 天。`,
    growthRisk: (activeMonths: number) => `写作量集中在 ${activeMonths} 个活跃月份，年度总量可能掩盖阶段性断档。`,
    growthSuggestion: "下期优先保护每周稳定写作节奏，再追求单日高产。",
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
    topicEvolution: "主题演化",
    topicEvolutionSummary: (topics: string[]) => `本期真正有内容增长的主题主要是${formatQuotedList(topics)}。`,
    topicEvolutionEmpty: "未找到主题数据。",
    topicEvolutionLegend: "堆叠 SVG 图表：按 Top 主题展示每月新建笔记字词量，小主题合并为「其他」。",
    topicEvolutionChart: "主题演化",
    topic: "主题",
    addedWords: "新增字数",
    newNotes: "新增笔记",
    topicFeedback: "反馈信号",
    mainThreads: (topics: string[]) => `主要主线：这些主题已经有足够材料支撑年度复盘：${formatQuotedList(topics)}。`,
    emergingDirection: (topics: string[]) => `新兴方向：${formatQuotedList(topics)}最近开始增长，适合追问下一步问题。`,
    noEmergingDirection: "新兴方向：暂未出现明确的新主题信号。",
    needsAttention: (topics: string[]) => `需要关注：${formatQuotedList(topics)}最近多个活跃月份没有新增内容，可以判断是否归档或重启。`,
    noDecliningDirection: "需要关注：暂未出现明显沉寂的主题。",
    nextTopicAction: "下期建议：把领先主题整理成一页小索引，列出证据笔记、当前判断和下一步问题。",
    topTags: "高频标签",
    topFolders: "高频文件夹",
    topLinks: "高频链接",
    highValueNotes: "高价值笔记",
    topHighValueNotes: "Top 10 高价值笔记",
    outputReadyNotes: "可输出笔记",
    maintenanceNotes: "需维护笔记",
    noOutputReadyNotes: "未找到可输出笔记。",
    noMaintenanceNotes: "未找到需维护笔记。",
    highValueNotesSummary: (count: number, outputReady: number) => `下表 Top ${count} 是优先回看队列；全库当前有 ${outputReady} 篇笔记具备输出潜力。`,
    highValueNote: "笔记",
    highValueType: "类型",
    highValueReason: "价值原因",
    suggestedAction: "建议动作",
    highValueFeedback: "高价值笔记反馈",
    priorityNotes: (notes: string) => `本期最值得继续推进的是 ${notes}。`,
    outputReadySignal: (count: number) => `有 ${count} 篇笔记已经具备整理成文章、索引页或复盘备忘的条件。`,
    staleCoreSignal: (count: number) => `有 ${count} 篇核心笔记超过 90 天未更新，建议下期回看维护。`,
    noHighValueNotes: "未找到高价值笔记信号。",
    nextPeriodActions: "下期行动",
    mocAction: (topic: string) => `围绕「${topic}」整理一页小索引：证据笔记、当前判断和一个下一步问题。`,
    isolatedNotesAction: (count: number) => `处理 ${count} 篇孤立潜力笔记，补链或判断是否归档。`,
    noIsolatedNotesAction: "当前没有需要立即处理的孤立潜力笔记。",
    highValuePushAction: (notes: string) => `推进 ${notes} 作为下期高价值笔记重点。`,
    noHighValuePushAction: "当前高价值笔记信号不足，暂无明确推进对象。",
    nextPeriodSuggestion: "下期建议",
    highValueNextStep: "优先处理这些笔记，而不是继续无差别新增内容。",
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

const TOPIC_COLORS = ["#4f7cac", "#d98c46", "#4f9d69", "#8a6fbd", "#c75f7a", "#6f8f2f", "#b07d3c", "#6f7782", "#9aa0a6"];
const OTHER_TOPIC = "其他";

export function renderAnnualReview(aggregate: YearAggregate, options: RenderOptions = {}): string {
  const language = options.language ?? "en";
  const text = REPORT_TEXT[language];
  return [
    renderMetadata(aggregate, language),
    "",
    `# ${text.title(aggregate.year)}`,
    "",
    `## ${text.periodJudgment}`,
    "",
    renderPeriodJudgment(aggregate, language, options.periodJudgment),
    "",
    `## ${text.writingGrowth}`,
    "",
    renderWritingGrowth(aggregate, language, options.chartPaths),
    "",
    `## ${text.topicEvolution}`,
    "",
    renderTopicEvolution(aggregate.topicEvolution, language, options.chartPaths?.["topic-evolution"]),
    "",
    `## ${text.highValueNotes}`,
    "",
    renderHighValueNotes(aggregate, language),
    "",
    `## ${text.nextPeriodActions}`,
    "",
    renderNextPeriodActions(aggregate, language),
    "",
  ].join("\n");
}

function renderPeriodJudgment(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage, periodJudgment?: string): string {
  const text = REPORT_TEXT[language];
  return sanitizeInlineMarkdown(periodJudgment) || text.defaultPeriodJudgment(aggregate.totalWords, aggregate.activeDays, aggregate.topicEvolution.topTopics.slice(0, 3).map((topic) => topic.name));
}

function renderWritingGrowth(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage, chartPaths?: Partial<Record<AnnualReviewChartKind, string>>): string {
  const text = REPORT_TEXT[language];
  return [
    `| ${text.metric} | ${text.value} |`,
    "| --- | ---: |",
    `| ${text.totalNewWords} | ${formatInteger(aggregate.totalWords)} |`,
    `| ${text.writingDays} | ${aggregate.activeDays} |`,
    `| ${text.longestWritingStreak} | ${aggregate.longestStreak} |`,
    "",
    `### ${text.dailyCumulativeWordChart}`,
    "",
    renderDailyCumulativeWords(aggregate.dayBuckets, language, chartPaths?.["daily-cumulative-words"]),
    "",
    `### ${text.monthlyGrowthChart}`,
    "",
    renderWordGrowthTrend(aggregate.wordGrowthBuckets, language, chartPaths?.["word-growth-trend"]),
    "",
    `### ${text.heatmap}`,
    "",
    renderDailyHeatmap(aggregate.dayBuckets, language, chartPaths?.["daily-word-heatmap"]),
    "",
    `### ${text.growthFeedback}`,
    "",
    ...renderGrowthFeedback(aggregate, language),
  ].join("\n");
}

function renderGrowthFeedback(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage): string[] {
  const text = REPORT_TEXT[language];
  const activeMonths = aggregate.monthBuckets.filter((month) => month.words > 0).length;
  return [
    `- ${text.strength}: ${text.growthStrength(aggregate.activeDays, aggregate.longestStreak)}`,
    `- ${text.risk}: ${text.growthRisk(activeMonths)}`,
    `- ${text.suggestion}: ${text.growthSuggestion}`,
  ];
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

function renderDailyCumulativeWords(days: DayBucket[], language: ResolvedAnnualReviewLanguage, chartPath?: string): string {
  const text = REPORT_TEXT[language];
  if (days.length === 0) {
    return text.dailyWordHeatmapEmpty;
  }

  return [
    text.dailyCumulativeWordChartLegend,
    "",
    chartPath ? renderChartReference(chartPath, text.dailyCumulativeWordChart) : renderDailyCumulativeWordsSvg(days, language),
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

function renderTopicEvolution(data: TopicEvolutionData, language: ResolvedAnnualReviewLanguage, chartPath?: string): string {
  const text = REPORT_TEXT[language];
  if (data.topTopics.length === 0) {
    return `- ${text.topicEvolutionEmpty}`;
  }

  const mainTopics = data.topTopics.slice(0, 3).map((topic) => topic.name);
  return [
    text.topicEvolutionSummary(mainTopics),
    "",
    text.topicEvolutionLegend,
    "",
    chartPath ? renderChartReference(chartPath, text.topicEvolutionChart) : renderTopicEvolutionSvg(data, language),
    "",
    `| ${text.topic} | ${text.addedWords} | ${text.newNotes} | ${text.representativeNotes} |`,
    "| --- | ---: | ---: | --- |",
    ...data.topTopics.map(renderTopicTableRow),
    "",
    `### ${text.topicFeedback}`,
    "",
    `- ${text.mainThreads(mainTopics)}`,
    `- ${data.emergingTopics.length > 0 ? text.emergingDirection(data.emergingTopics) : text.noEmergingDirection}`,
    `- ${data.decliningTopics.length > 0 ? text.needsAttention(data.decliningTopics) : text.noDecliningDirection}`,
    `- ${text.nextTopicAction}`,
  ].join("\n");
}

function renderTopicTableRow(topic: TopTopic): string {
  const representativeNotes = topic.representativeNotes.map(wikiLinkPlain).join(", ") || "n/a";
  return tableRow([topic.name, formatInteger(topic.addedWords), String(topic.newNotes), representativeNotes]);
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

function renderDailyCumulativeWordsSvg(days: DayBucket[], language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const width = 820;
  const height = 280;
  const left = 58;
  const right = 24;
  const top = 20;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  let cumulativeWords = 0;
  const points = days.map((day) => {
    cumulativeWords += day.words;
    return {
      ...day,
      cumulativeWords,
    };
  });
  const maxWords = niceMax(Math.max(1, cumulativeWords));
  const ticks = [0, maxWords / 2, maxWords];
  const xScale = (index: number) => left + (plotWidth * index) / Math.max(1, points.length - 1);
  const yScale = (words: number) => top + plotHeight - (words / maxWords) * plotHeight;
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${formatNumber(xScale(index))} ${formatNumber(yScale(point.cumulativeWords))}`)
    .join(" ");

  const grid = ticks
    .map((tick) => {
      const y = top + plotHeight - (tick / maxWords) * plotHeight;
      return [
        `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d0d7de" stroke-width="1" />`,
        `<text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end" fill="currentColor">${Math.round(tick)}</text>`,
      ].join("\n");
    })
    .join("\n");

  const monthTicks = points
    .filter((point) => point.dayOfMonth === 1)
    .map((point, index) => {
      const pointIndex = points.findIndex((candidate) => candidate.date === point.date);
      const labelX = xScale(pointIndex);
      const visibleLabel = index % 2 === 0 || points.length <= 120;
      return [
        `<line x1="${formatNumber(labelX)}" y1="${top + plotHeight}" x2="${formatNumber(labelX)}" y2="${top + plotHeight + 5}" stroke="#57606a" stroke-width="1" />`,
        visibleLabel ? `<text x="${formatNumber(labelX)}" y="${height - 24}" font-size="10" text-anchor="middle" fill="currentColor">${escapeHtml(point.month.slice(5))}</text>` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n");

  const last = points[points.length - 1];
  const endpointDot = last
    ? `<circle class="endpoint-dot" cx="${formatNumber(xScale(points.length - 1))}" cy="${formatNumber(yScale(last.cumulativeWords))}" r="5" fill="#4f7cac"><title>${escapeHtml(`${last.date}: ${last.cumulativeWords} ${text.cumulativeWords}`)}</title></circle>`
    : "";

  return [
    `<svg class="annual-review-chart annual-review-daily-cumulative" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.dailyCumulativeWordChart)}">`,
    `<title>${escapeHtml(text.dailyCumulativeWordChart)}</title>`,
    `<desc>${escapeHtml(text.dailyCumulativeWordChartLegend)}</desc>`,
    grid,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<text x="16" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" fill="currentColor" transform="rotate(-90 16 ${top + plotHeight / 2})">${escapeHtml(text.cumulativeWords)}</text>`,
    `<path class="chart-line" d="${linePath}" fill="none" stroke="#4f7cac" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`,
    monthTicks,
    endpointDot,
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

function renderTopicEvolutionSvg(data: TopicEvolutionData, language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const width = 820;
  const height = 340;
  const left = 62;
  const right = 156;
  const top = 28;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const activeBuckets = data.monthlyBuckets.filter((bucket) => Object.values(bucket.topics).some((words) => words > 0));
  const buckets = activeBuckets.length > 0 ? activeBuckets : data.monthlyBuckets;
  const topicNames = chartTopicNames(data);
  const maxWords = niceMax(Math.max(1, ...buckets.map((bucket) => sumTopicWords(bucket))));
  const barGap = 8;
  const barWidth = Math.max(12, (plotWidth - barGap * Math.max(0, buckets.length - 1)) / Math.max(1, buckets.length));
  const yScale = (words: number) => (words / maxWords) * plotHeight;
  const colors = topicNames.map((name, index) => [name, TOPIC_COLORS[index % TOPIC_COLORS.length] ?? TOPIC_COLORS[0]] as const);
  const colorByTopic = new Map(colors);

  const grid = [0, maxWords / 2, maxWords]
    .map((tick) => {
      const y = top + plotHeight - yScale(tick);
      return [
        `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d0d7de" stroke-width="1" />`,
        `<text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end" fill="currentColor">${Math.round(tick)}</text>`,
      ].join("\n");
    })
    .join("\n");

  const bars = buckets
    .map((bucket, index) => {
      const x = left + index * (barWidth + barGap);
      let y = top + plotHeight;
      const segments = topicNames
        .map((topic) => {
          const words = bucket.topics[topic] ?? 0;
          if (words <= 0) {
            return "";
          }
          const segmentHeight = Math.max(1, yScale(words));
          y -= segmentHeight;
          const title = `${bucket.month}: ${topic} ${words} ${text.words}`;
          return `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(barWidth)}" height="${formatNumber(segmentHeight)}" fill="${colorByTopic.get(topic)}"><title>${escapeHtml(title)}</title></rect>`;
        })
        .filter(Boolean)
        .join("\n");
      return [
        segments,
        `<text x="${formatNumber(x + barWidth / 2)}" y="${height - 28}" font-size="10" text-anchor="middle" fill="currentColor">${escapeHtml(bucket.month.slice(5))}</text>`,
      ].join("\n");
    })
    .join("\n");

  const legend = topicNames
    .map((topic, index) => {
      const x = width - right + 24;
      const y = top + 18 + index * 18;
      return [
        `<rect x="${x}" y="${y - 10}" width="10" height="10" fill="${colorByTopic.get(topic)}" />`,
        `<text x="${x + 16}" y="${y}" font-size="11" fill="currentColor">${escapeHtml(topic)}</text>`,
      ].join("\n");
    })
    .join("\n");

  return [
    `<svg class="annual-review-chart annual-review-topic-evolution" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.topicEvolutionChart)}">`,
    `<title>${escapeHtml(text.topicEvolutionChart)}</title>`,
    `<desc>${escapeHtml(text.topicEvolutionLegend)}</desc>`,
    grid,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<text x="18" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" fill="currentColor" transform="rotate(-90 18 ${top + plotHeight / 2})">${escapeHtml(text.addedWords)}</text>`,
    bars,
    legend,
    "</svg>",
  ].join("\n");
}

function renderChartReference(path: string, alt: string): string {
  return `![[${path}|${alt}|900]]`;
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

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatQuotedList(items: string[]): string {
  if (items.length === 0) {
    return "None";
  }
  return items.map((item) => `「${item}」`).join("、");
}

function sanitizeInlineMarkdown(markdown?: string): string {
  if (!markdown) {
    return "";
  }
  const body = markdown
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  const sentence = body.match(/^(.+?[.!?。！？])(?:\s|$)/u)?.[1] ?? body;
  return sentence.slice(0, 240).trim();
}

function chartTopicNames(data: TopicEvolutionData): string[] {
  const names = data.topTopics.map((topic) => topic.name);
  const hasOther = data.monthlyBuckets.some((bucket) => Object.prototype.hasOwnProperty.call(bucket.topics, OTHER_TOPIC));
  return hasOther ? [...names, OTHER_TOPIC] : names;
}

function sumTopicWords(bucket: TopicMonthlyBucket): number {
  return Object.values(bucket.topics).reduce((sum, words) => sum + words, 0);
}

function noteTitle(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/u, "") ?? path;
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

function renderHighValueNotes(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const topNotes =
    aggregate.highValueNotes.length > 0
      ? [
          `| ${text.highValueNote} | ${text.highValueType} | ${text.highValueReason} | ${text.suggestedAction} |`,
          "| --- | --- | --- | --- |",
          ...aggregate.highValueNotes.map((note) => renderHighValueNoteRow(note)),
        ].join("\n")
      : `- ${text.noHighValueNotes}`;
  return [
    ...(aggregate.highValueNotes.length > 0 ? [text.highValueNotesSummary(aggregate.highValueNotes.length, aggregate.highValueFeedback.outputReadyCount), ""] : []),
    `### ${text.topHighValueNotes}`,
    "",
    topNotes,
    "",
    `### ${text.outputReadyNotes}`,
    "",
    renderHighValueActionList(aggregate.outputReadyNotes, text.noOutputReadyNotes),
    "",
    `### ${text.maintenanceNotes}`,
    "",
    renderHighValueActionList(aggregate.maintenanceNotes, text.noMaintenanceNotes),
  ].join("\n");
}

function renderHighValueNoteRow(note: HighValueNote): string {
  return tableRow([wikiLinkPlain(note.path), note.kind, note.reason, note.suggestedAction]);
}

function renderHighValueFeedback(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage): string[] {
  const text = REPORT_TEXT[language];
  const priorityLinks = aggregate.highValueNotes
    .slice(0, 3)
    .map((note) => wikiLink(note.path, note.title));
  return [
    `- ${text.priorityNotes(formatInlineList(priorityLinks, language))}`,
    `- ${text.outputReadySignal(aggregate.highValueFeedback.outputReadyCount)}`,
    `- ${text.staleCoreSignal(aggregate.highValueFeedback.staleCoreCount)}`,
  ];
}

function renderHighValueActionList(notes: HighValueNote[], emptyText: string): string {
  if (notes.length === 0) {
    return `- ${emptyText}`;
  }
  return notes.map((note) => `- ${wikiLink(note.path, note.title)}: ${note.suggestedAction}`).join("\n");
}

function renderNextPeriodActions(aggregate: YearAggregate, language: ResolvedAnnualReviewLanguage): string {
  const text = REPORT_TEXT[language];
  const topTopic = aggregate.topicEvolution.topTopics[0]?.name ?? (language === "zh" ? "增长最快主题" : "the fastest-growing topic");
  const highValueFocus = aggregate.highValueNotes.slice(0, 2).map((note) => wikiLink(note.path, note.title));
  return [
    `1. ${text.mocAction(topTopic)}`,
    `2. ${aggregate.isolatedPotentialNotes.length > 0 ? text.isolatedNotesAction(aggregate.isolatedPotentialNotes.length) : text.noIsolatedNotesAction}`,
    `3. ${highValueFocus.length > 0 ? text.highValuePushAction(formatInlineList(highValueFocus, language)) : text.noHighValuePushAction}`,
  ].join("\n");
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

function wikiLinkPlain(path: string): string {
  return `[[${path.replace(/\.md$/u, "")}]]`;
}

function linkName(name: string): string {
  return `[[${name}]]`;
}

function tableRow(cells: string[]): string {
  return `| ${cells.map(markdownTableCell).join(" | ")} |`;
}

function markdownTableCell(value: string): string {
  return value.replace(/\r?\n/gu, " ").replace(/\|/gu, "\\|").trim();
}

function formatInlineList(items: string[], language: ResolvedAnnualReviewLanguage): string {
  if (items.length === 0) {
    return REPORT_TEXT[language].none;
  }
  if (items.length === 1) {
    return items[0] ?? "";
  }
  if (items.length === 2) {
    return language === "zh" ? items.join(" 和 ") : items.join(" and ");
  }
  const last = items[items.length - 1] ?? "";
  const first = items.slice(0, -1).join(language === "zh" ? "、" : ", ");
  return language === "zh" ? `${first} 和 ${last}` : `${first}, and ${last}`;
}
