import { toTopicEvolutionJson } from "./topics";
import {
  activePeriodDays,
  activePeriodMonths,
  renderDailyCumulativeWordsSvg,
  renderDailyHeatmapSvg,
  renderMonthlyCreatedNotesSvg,
  renderTopicEvolutionSvg,
} from "./chartSvg";
import { reviewCandidateDisplayTitle } from "./reviewTitle";
import {
  REVIEW_USER_REFLECTION_END_MARKER,
  REVIEW_USER_REFLECTION_START_MARKER,
} from "./reportBoundary";
import { buildAnnualReviewChartPaths, type AnnualReviewChartKind } from "./reportPaths";
import {
  isReviewReportCandidate,
  type ReviewCandidate,
  type ReviewSessionState,
} from "./reviewState";
import type {
  AiHighValueNoteInsight,
  AiReportEnhancements,
  AiThemeInsight,
  DayBucket,
  ExplanationReason,
  HighValueNote,
  MonthBucket,
  RankedMetric,
  RankedNote,
  ResolvedAnnualReviewLanguage,
  ThemeEvidenceNote,
  ThemeEvidencePackage,
  TopicEvolutionData,
  TopTopic,
  YearAggregate,
} from "./types";

interface RenderOptions {
  language?: ResolvedAnnualReviewLanguage;
  chartPaths?: Partial<Record<AnnualReviewChartKind, string>>;
  periodJudgment?: string;
  aiEnhancements?: AiReportEnhancements;
  aiEnabled?: boolean;
  reviewSession?: ReviewSessionState;
  themeEvidencePackage?: ThemeEvidencePackage;
}

type MonthMetric = "created" | "modified" | "words" | "characters";

export type { AnnualReviewChartKind };
export { buildAnnualReviewChartPaths };

export interface AnnualReviewChartAsset {
  kind: AnnualReviewChartKind;
  path: string;
  content: string;
}

export function buildAnnualReviewChartAssets(
  aggregate: YearAggregate,
  options: RenderOptions = {},
): AnnualReviewChartAsset[] {
  const language = options.language ?? "en";
  const text = REPORT_TEXT[language];
  const paths =
    options.chartPaths ??
    buildAnnualReviewChartPaths("Annual Reviews", aggregate.session.label);
  const assets: AnnualReviewChartAsset[] = [];

  if (aggregate.dayBuckets.length > 0 && paths["daily-cumulative-words"]) {
    assets.push({
      kind: "daily-cumulative-words",
      path: paths["daily-cumulative-words"],
      content: renderDailyCumulativeWordsSvg(
        activePeriodDays(aggregate.dayBuckets),
        language,
        text,
      ),
    });
  }

  if (aggregate.dayBuckets.length > 0 && paths["daily-word-heatmap"]) {
    assets.push({
      kind: "daily-word-heatmap",
      path: paths["daily-word-heatmap"],
      content: renderDailyHeatmapSvg(
        activePeriodDays(aggregate.dayBuckets),
        language,
        text,
      ),
    });
  }

  if (aggregate.monthBuckets.length > 0 && paths["word-growth-trend"]) {
    assets.push({
      kind: "word-growth-trend",
      path: paths["word-growth-trend"],
      content: renderMonthlyCreatedNotesSvg(
        activePeriodMonths(aggregate.monthBuckets),
        language,
        text,
      ),
    });
  }

  const topicEvolution =
    reviewSessionTopicEvolution(options.reviewSession) ?? aggregate.topicEvolution;

  if (topicEvolution.topTopics.length > 0 && paths["topic-evolution"]) {
    assets.push({
      kind: "topic-evolution",
      path: paths["topic-evolution"],
      content: renderTopicEvolutionSvg(topicEvolution, language, text),
    });
  }

  if (topicEvolution.topTopics.length > 0 && paths["topic-evolution-data"]) {
    assets.push({
      kind: "topic-evolution-data",
      path: paths["topic-evolution-data"],
      content: `${JSON.stringify(toTopicEvolutionJson(topicEvolution), null, 2)}\n`,
    });
  }

  return assets;
}

const REPORT_TEXT = {
  en: {
    title: (label: string) => label,
    allMarkdownFiles: "All Markdown files",
    none: "None",
    dataMethodology: "Data Methodology",
    currentVaultInference: "current-vault inference",
    historicalSnapshotStatistics: "historical snapshot statistics",
    scopeMismatch:
      "current-vault inference; historical snapshot unavailable because scan scope changed",
    snapshotWordDelta: "Snapshot word delta",
    snapshotBaseline: "Snapshot baseline",
    currentSnapshot: "Current snapshot",
    scanScope: "Scan scope",
    excludedScope: "Excluded scope",
    growthDataSource: "Growth data source",
    reportFolder: "Report folder",
    excludePatterns: "Excluded patterns",
    activityDateSources: "Activity date sources",
    frontmatterDate: "frontmatter date",
    pathDate: "path/filename date",
    filesystemTimestamp: "filesystem timestamp",
    filesystemDateWarning: (count: number, total: number) =>
      count === total
        ? "Only filesystem ctime/mtime was available for activity dates. If these files were copied, checked out, or batch deployed, the activity rhythm can reflect that operation time instead of the real writing dates."
        : `${count} of ${total} active notes could only use filesystem ctime/mtime for activity dates. Copied, checked-out, or batch-deployed files may have flattened timestamps, so interpret those dates as a limited fallback.`,
    methodologyHistorical: (baseline: string, current: string) =>
      `Historical snapshot statistics compare the vault snapshot captured at ${baseline} with the current snapshot captured at ${current}. Mtime-only batch changes do not count as word growth unless note word counts changed.`,
    methodologyFallback:
      "Growth is labeled as current vault inference because no comparable historical snapshot is available yet. Counts are derived from current file timestamps and are not a historical word-count delta.",
    methodologyScopeMismatch: (baseline: string) =>
      `A previous snapshot from ${baseline} exists, but its include/exclude scope differs from this run. Historical comparison is disabled to avoid mixing incompatible scan ranges.`,
    periodJudgment: "Annual Overview",
    defaultPeriodJudgment: (words: number, activeDays: number, _topics: string[]) =>
      `This review covers ${formatInteger(words)} new words across ${activeDays} writing days. The local evidence points to the year's writing rhythm, strongest activity windows, and notes worth revisiting; turning those signals into content threads works best when summary generation is enabled.`,
    writingGrowth: "Writing Growth",
    totalNewWords: "Total new words",
    writingDays: "Writing days",
    longestWritingStreak: "Longest writing streak",
    dailyCumulativeGrowth: "Cumulative Growth",
    dailyCumulativeWords: "Cumulative words",
    monthlyGrowthChart: "Monthly New Notes",
    heatmap: "Heatmap",
    growthFeedback: "Activity Reading",
    strength: "Advantage",
    risk: "Risk",
    suggestion: "Suggestion",
    growthStrength: (activeDays: number, longestStreak: number) =>
      `Writing appeared on ${activeDays} days, and the longest streak reached ${longestStreak} day${longestStreak === 1 ? "" : "s"}.`,
    growthRisk: (activeMonths: number) =>
      `Writing volume is concentrated in ${activeMonths} active month${activeMonths === 1 ? "" : "s"}, so gaps can still hide behind the annual total.`,
    growthSuggestion:
      "Next period, protect a small weekly writing cadence before optimizing for peak-output days.",
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
    dailyWordHeatmapLegend: "Darker cells show higher daily created-note word volume.",
    dailyWordHeatmapColumn: "Daily word heatmap",
    peakDay: "Peak day",
    notAvailable: "n/a",
    wordGrowthTrend: "Monthly New Notes",
    wordGrowthTrendEmpty: "No monthly note data found.",
    wordGrowthYAxis: "Notes created in each active month.",
    wordGrowth: "New notes",
    trend: "Trend",
    cumulativeWords: "Cumulative words",
    topicEvolution: "Topic Evolution",
    aiThemeSynthesis: "Content Threads",
    localTopicSignals: "Local Topic Signals",
    aiTheme: "Theme",
    aiThemeSummaryColumn: "Summary",
    aiThemeConnections: "Connections",
    aiThemeNextQuestion: "Next question",
    aiThemeSummary: (topics: string[]) =>
      `The main content threads this period are ${formatQuotedList(topics)}.`,
    topicEvolutionSummary: (topics: string[]) =>
      `The clearest content growth this period is in ${formatQuotedList(topics)}.`,
    topicEvolutionEmpty: "No topic data found.",
    topicEvolutionNeedsSynthesis:
      "The local report keeps this as source evidence; content-thread synthesis is generated only when summarization is enabled.",
    topicEvolutionLegend:
      "Stacked SVG chart: monthly created-note words by top topic, with smaller topics grouped as Other.",
    topicEvolutionChart: "Topic evolution",
    topic: "Topic",
    addedWords: "Added words",
    newNotes: "New notes",
    topicFeedback: "Feedback Signals",
    mainThreads: (topics: string[]) =>
      `Main thread: these themes now have enough weight to guide review: ${formatQuotedList(topics)}.`,
    emergingDirection: (topics: string[]) =>
      `Emerging direction: ${formatQuotedList(topics)} started growing recently and deserves a concrete next question.`,
    noEmergingDirection: "Emerging direction: no clear new topic signal yet.",
    needsAttention: (topics: string[]) =>
      `Needs attention: ${formatQuotedList(topics)} has had no new content in recent active months; decide whether to archive or restart it.`,
    noDecliningDirection: "Needs attention: no clearly dormant topic signal yet.",
    topTags: "Top Tags",
    topFolders: "Top Folders",
    topLinks: "Top Links",
    highValueNotes: "Theme Hypotheses",
    uncertainty: "Uncertainty",
    userNote: "User note",
    missingEvidence: "missing after rescan",
    outputReadyNotes: "Output-ready notes",
    maintenanceNotes: "Notes needing maintenance",
    noOutputReadyNotes: "No output-ready notes found.",
    noMaintenanceNotes: "No maintenance-needed notes found.",
    noHighValueNotes: "No theme-hypothesis evidence signals found.",
    noReviewedCandidates:
      "No reviewed Theme Hypotheses are ready for the report yet. Accept or rename proposals in Review Board before including them here.",
    nextPeriodActions: "Reflection Prompts",
    aiNextActions: "Reflection Prompts",
    writingAndActivityRhythm: "Writing And Activity Rhythm",
    noDataFound: "No data found.",
    noteStats: (words: number, characters: number) =>
      `${words} words, ${characters} chars`,
    noActivity: "No activity was found for the selected year.",
    strongestMonth: (month: string, words: number) =>
      `Most created-note writing volume appears in ${month} with ${words} counted words.`,
  },
  zh: {
    title: (label: string) => label,
    allMarkdownFiles: "全部 Markdown 文件",
    none: "无",
    dataMethodology: "数据口径",
    currentVaultInference: "当前 vault 推断",
    historicalSnapshotStatistics: "历史 snapshot 统计",
    scopeMismatch: "当前 vault 推断；扫描范围变化导致历史 snapshot 不可比较",
    snapshotWordDelta: "Snapshot 字数增量",
    snapshotBaseline: "Snapshot 基线",
    currentSnapshot: "当前 Snapshot",
    scanScope: "扫描范围",
    excludedScope: "排除范围",
    growthDataSource: "增长数据来源",
    reportFolder: "报告目录",
    excludePatterns: "排除模式",
    activityDateSources: "活动日期来源",
    frontmatterDate: "frontmatter date",
    pathDate: "路径/文件名日期",
    filesystemTimestamp: "文件系统时间戳",
    filesystemDateWarning: (count: number, total: number) =>
      count === total
        ? "本次活动日期只能使用文件系统 ctime/mtime。如果这些文件经过复制、checkout 或批量部署，活动节奏可能反映操作时间，而不是真实写作日期。"
        : `${total} 篇活跃笔记中有 ${count} 篇只能使用文件系统 ctime/mtime 作为活动日期。复制、checkout 或批量部署可能压平这些时间戳，因此这些日期只能作为受限 fallback 解读。`,
    methodologyHistorical: (baseline: string, current: string) =>
      `增长数据使用历史 snapshot 统计：对比 ${baseline} 捕获的 vault snapshot 与 ${current} 捕获的当前 snapshot。仅 mtime 批量变化不会计入字数增长，除非笔记字数实际改变。`,
    methodologyFallback:
      "增长数据标记为当前 vault 推断，因为还没有可比较的历史 snapshot。相关计数来自当前文件时间戳，不应解读为精确历史字数增量。",
    methodologyScopeMismatch: (baseline: string) =>
      `存在 ${baseline} 的旧 snapshot，但它的包含/排除范围与本次运行不同。为避免跨范围误导，本次不做历史增量比较。`,
    periodJudgment: "年度总览",
    defaultPeriodJudgment: (words: number, activeDays: number, _topics: string[]) =>
      `这一年新增 ${formatInteger(words)} 个字词，分布在 ${activeDays} 个写作日里。单看本地指标，已经能看出写作节奏、活跃月份和需要回看的核心笔记；如果启用总结生成，这些证据还可以继续提炼成更完整的内容主线。`,
    writingGrowth: "写作增长",
    totalNewWords: "总新增字数",
    writingDays: "写作天数",
    longestWritingStreak: "最长连续写作",
    dailyCumulativeGrowth: "累计增长",
    dailyCumulativeWords: "累计字词",
    monthlyGrowthChart: "每月新增笔记",
    heatmap: "热力图",
    growthFeedback: "活动解读",
    strength: "优点",
    risk: "风险",
    suggestion: "建议",
    growthStrength: (activeDays: number, longestStreak: number) =>
      `本期有 ${activeDays} 个写作日，最长连续写作达到 ${longestStreak} 天。`,
    growthRisk: (activeMonths: number) =>
      `写作量集中在 ${activeMonths} 个活跃月份，年度总量可能掩盖阶段性断档。`,
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
    dailyWordHeatmapLegend: "颜色越深，表示当天新建笔记字词量越高。",
    dailyWordHeatmapColumn: "每日字词热力图",
    peakDay: "峰值日",
    notAvailable: "无",
    wordGrowthTrend: "每月新增笔记",
    wordGrowthTrendEmpty: "未找到月度新增笔记数据。",
    wordGrowthYAxis: "每根柱表示该活跃月份新建的笔记数。",
    wordGrowth: "新增笔记",
    trend: "趋势",
    cumulativeWords: "累计字词",
    topicEvolution: "主题演化",
    aiThemeSynthesis: "内容主线",
    localTopicSignals: "本地主题信号",
    aiTheme: "主题",
    aiThemeSummaryColumn: "总结",
    aiThemeConnections: "关联",
    aiThemeNextQuestion: "下一步问题",
    aiThemeSummary: (topics: string[]) =>
      `本期内容主线可以概括为${formatQuotedList(topics)}。`,
    topicEvolutionSummary: (topics: string[]) =>
      `本期真正有内容增长的主题主要是${formatQuotedList(topics)}。`,
    topicEvolutionEmpty: "未找到主题数据。",
    topicEvolutionNeedsSynthesis:
      "本地报告只保留原始证据图表；内容主线会在启用总结后生成。",
    topicEvolutionLegend:
      "堆叠 SVG 图表：按 Top 主题展示每月新建笔记字词量，小主题合并为「其他」。",
    topicEvolutionChart: "主题演化",
    topic: "主题",
    addedWords: "新增字数",
    newNotes: "新增笔记",
    topicFeedback: "反馈信号",
    mainThreads: (topics: string[]) =>
      `主要主线：这些主题已经有足够材料支撑年度复盘：${formatQuotedList(topics)}。`,
    emergingDirection: (topics: string[]) =>
      `新兴方向：${formatQuotedList(topics)}最近开始增长，适合追问下一步问题。`,
    noEmergingDirection: "新兴方向：暂未出现明确的新主题信号。",
    needsAttention: (topics: string[]) =>
      `需要关注：${formatQuotedList(topics)}最近多个活跃月份没有新增内容，可以判断是否归档或重启。`,
    noDecliningDirection: "需要关注：暂未出现明显沉寂的主题。",
    topTags: "高频标签",
    topFolders: "高频文件夹",
    topLinks: "高频链接",
    highValueNotes: "主题假设",
    uncertainty: "不确定性",
    userNote: "用户备注",
    missingEvidence: "重新扫描后缺失",
    outputReadyNotes: "可输出笔记",
    maintenanceNotes: "需维护笔记",
    noOutputReadyNotes: "未找到可输出笔记。",
    noMaintenanceNotes: "未找到需维护笔记。",
    noHighValueNotes: "未找到主题假设证据信号。",
    noReviewedCandidates:
      "还没有可写入年报的主题假设。请先在 Review Board 接受或重命名主题假设。",
    nextPeriodActions: "复盘提示",
    aiNextActions: "复盘提示",
    writingAndActivityRhythm: "写作与活动节奏",
    noDataFound: "未找到数据。",
    noteStats: (words: number, characters: number) => `${words} 字词，${characters} 字符`,
    noActivity: "所选年份未找到活动。",
    strongestMonth: (month: string, words: number) =>
      `新建笔记写作量最高的月份是 ${month}，共 ${words} 个计数字词。`,
  },
} as const;

export function renderAnnualReview(
  aggregate: YearAggregate,
  options: RenderOptions = {},
): string {
  const language = options.language ?? "en";
  const aiEnhancements = hasAiEnhancements(options.aiEnhancements)
    ? options.aiEnhancements
    : undefined;
  const aiEnabled = options.aiEnabled || Boolean(aiEnhancements);
  const reviewSession = options.reviewSession;
  return [
    renderMetadata(aggregate, language),
    "",
    `# ${reportHeading(aggregate, language)}`,
    "",
    `## ${language === "zh" ? "总览" : "Overview"}`,
    "",
    renderOverview(
      aggregate,
      language,
      options.periodJudgment ?? aiEnhancements?.periodJudgment,
      reviewSession,
    ),
    "",
    `## ${language === "zh" ? "年度节奏" : "Activity Rhythm"}`,
    "",
    renderWritingGrowth(aggregate, language, options.chartPaths, options.reviewSession),
    "",
    `## ${language === "zh" ? "主要主线" : "Main Themes"}`,
    "",
    renderHighValueNotes(
      aggregate,
      language,
      aiEnhancements?.highValueNotes,
      aiEnabled,
      reviewSession,
    ),
    "",
    `## ${language === "zh" ? "值得重读的笔记" : "Worth Rereading"}`,
    "",
    renderWorthRereading(
      aggregate,
      language,
      reviewSession,
      options.themeEvidencePackage,
    ),
    "",
    `## ${language === "zh" ? "留给自己的问题" : "Reflection Questions"}`,
    "",
    renderReflectionQuestions(
      aggregate,
      language,
      aiEnhancements?.nextActions,
      aiEnhancements?.themeInsights,
      reviewSession,
      options.themeEvidencePackage,
    ),
    "",
    `## ${language === "zh" ? "我的补充" : "User Reflection"}`,
    "",
    REVIEW_USER_REFLECTION_START_MARKER,
    "",
    REVIEW_USER_REFLECTION_END_MARKER,
    "",
    `## ${language === "zh" ? "方法与数据口径" : "Methodology"}`,
    "",
    renderDataMethodology(aggregate, language, aiEnabled),
    "",
  ].join("\n");
}

function hasAiEnhancements(
  enhancements?: AiReportEnhancements,
): enhancements is AiReportEnhancements {
  return Boolean(
    enhancements &&
    (enhancements.periodJudgment ||
      enhancements.themeInsights.length > 0 ||
      enhancements.highValueNotes.length > 0 ||
      enhancements.nextActions.length > 0),
  );
}

function reportTitle(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  if (
    language === "zh" &&
    aggregate.session.preset === "annual" &&
    aggregate.session.label === `${aggregate.year} Annual Review`
  ) {
    return `${aggregate.year} 年度回顾`;
  }
  return aggregate.session.label;
}

function reportHeading(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return reportTitle(aggregate, language);
}

function renderOverview(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  periodJudgment?: string,
  reviewSession?: ReviewSessionState,
): string {
  const confirmedThemes = reviewSession ? reportIncludedCandidates(reviewSession) : [];
  const hasConfirmedThemes = confirmedThemes.length > 0;
  const overview =
    hasConfirmedThemes && !periodJudgment
      ? renderCompactPeriodJudgment(aggregate, language)
      : renderPeriodJudgment(aggregate, language, periodJudgment);
  const range =
    language === "zh"
      ? `本次 Review Session 覆盖 ${aggregate.session.startDate} 到 ${aggregate.session.endDate}（${aggregate.session.preset}）。`
      : `This Review Session covers ${aggregate.session.startDate} to ${aggregate.session.endDate} (${aggregate.session.preset}).`;
  const themeSentence = hasConfirmedThemes
    ? language === "zh"
      ? `这版只保留 Review Board 已确认主题：${formatInlineList(
          confirmedThemes.map((candidate) =>
            sanitizeHeading(
              reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
            ),
          ),
          language,
        )}。`
      : `This version keeps only Review Board-confirmed themes: ${formatInlineList(
          confirmedThemes.map((candidate) =>
            sanitizeHeading(
              reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
            ),
          ),
          language,
        )}.`
    : language === "zh"
      ? "当前还没有已接受或重命名的主题进入报告；可以先把这一版当作活动节奏和待复核证据的阅读底稿。"
      : "No accepted or renamed themes have entered the report yet; use this version as activity context until Review Board decisions are made.";

  return [range, overview, themeSentence].join("\n\n");
}

function renderCompactPeriodJudgment(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return language === "zh"
    ? `新增 ${formatInteger(aggregate.totalWords)} 个字词，分布在 ${aggregate.activeDays} 个写作日；重点不是活动量本身，而是这些笔记怎样把反复出现的判断、场景、风险、关系和状态线索串成可复核的主线。`
    : `${formatInteger(aggregate.totalWords)} new words across ${aggregate.activeDays} writing days; the useful signal is not volume alone, but how repeated judgments, contexts, risks, relationships, and state changes become reviewable themes.`;
}

function renderReviewRange(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const label = language === "zh" ? "范围" : "Range";
  const preset = language === "zh" ? "类型" : "Type";
  const generated = language === "zh" ? "生成时间" : "Generated";
  const summary = renderPeriodJudgment(aggregate, language);
  return [
    `- ${label}: ${aggregate.session.startDate} to ${aggregate.session.endDate}`,
    `- ${preset}: ${aggregate.session.preset}`,
    `- ${generated}: ${aggregate.generatedAt}`,
    "",
    summary,
  ].join("\n");
}

function renderPeriodJudgment(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  periodJudgment?: string,
): string {
  const text = REPORT_TEXT[language];
  return (
    sanitizeParagraphMarkdown(periodJudgment) ||
    text.defaultPeriodJudgment(
      aggregate.totalWords,
      aggregate.activeDays,
      aggregate.topicEvolution.topTopics.slice(0, 3).map((topic) => topic.name),
    )
  );
}

function renderWritingGrowth(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  chartPaths?: Partial<Record<AnnualReviewChartKind, string>>,
  reviewSession?: ReviewSessionState,
): string {
  const text = REPORT_TEXT[language];
  const days = activePeriodDays(aggregate.dayBuckets);
  const months = activePeriodMonths(aggregate.monthBuckets);
  const topicEvolution =
    reviewSessionTopicEvolution(reviewSession) ?? aggregate.topicEvolution;
  return [
    renderActivityRhythmOverview(aggregate, language),
    "",
    `### ${text.dailyCumulativeGrowth}`,
    "",
    renderCumulativeGrowthInterpretation(aggregate, language),
    "",
    renderDailyCumulativeWords(days, language, chartPaths?.["daily-cumulative-words"]),
    "",
    `### ${text.monthlyGrowthChart}`,
    "",
    renderMonthlyGrowthInterpretation(months, language),
    "",
    renderMonthlyCreatedNotes(months, language, chartPaths?.["word-growth-trend"]),
    "",
    `### ${text.heatmap}`,
    "",
    renderHeatmapInterpretation(days, language),
    "",
    renderDailyHeatmap(days, language, chartPaths?.["daily-word-heatmap"]),
    ...(topicEvolution.topTopics.length > 0
      ? [
          "",
          `### ${language === "zh" ? "主题信号图" : "Theme Signal Chart"}`,
          "",
          renderTopicEvolutionInterpretation(topicEvolution, language),
          "",
          chartPaths?.["topic-evolution"]
            ? renderChartReference(
                chartPaths["topic-evolution"],
                text.topicEvolutionChart,
              )
            : renderTopicEvolutionSvg(topicEvolution, language, text),
        ]
      : []),
  ].join("\n");
}

function renderActivityRhythmOverview(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const activeMonths = aggregate.monthBuckets.filter((month) => month.words > 0).length;
  return language === "zh"
    ? `活动证据显示，本期新增 ${formatInteger(aggregate.totalWords)} 个字词，分布在 ${aggregate.activeDays} 个写作日和 ${activeMonths} 个活跃月份里。下面的图表保留节奏证据，用来解释写作峰值、间隔和主题形成背景。`
    : `Activity Evidence shows ${formatInteger(aggregate.totalWords)} new words across ${aggregate.activeDays} writing days and ${activeMonths} active months. The charts stay here as rhythm evidence for bursts, gaps, and theme-formation context.`;
}

function renderCumulativeGrowthInterpretation(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return language === "zh"
    ? `累计曲线用来观察本期内容是在少数爆发日完成，还是沿着多个写作日逐步累积；最长连续写作为 ${aggregate.longestStreak} 天。`
    : `Use the cumulative curve to see whether the range grew through a few bursts or through repeated writing days; the longest streak is ${aggregate.longestStreak} day${aggregate.longestStreak === 1 ? "" : "s"}.`;
}

function hasMonthData(month: MonthBucket): boolean {
  return (
    month.created > 0 || month.modified > 0 || month.words > 0 || month.characters > 0
  );
}

function renderMonthlyGrowthInterpretation(
  months: MonthBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const active = months.filter(hasMonthData);
  const strongest = [...active].sort(
    (a, b) =>
      b.created - a.created || b.words - a.words || a.month.localeCompare(b.month),
  )[0];
  if (!strongest) {
    return language === "zh"
      ? "本期没有足够的月度新增笔记信号。"
      : "This range has no clear monthly new-note signal.";
  }
  return language === "zh"
    ? `${strongest.month} 是新增笔记最明显的阶段；它提供了理解本期节奏的一个入口，而不是完整结论。`
    : `${strongest.month} has the clearest new-note signal; treat it as an entry point into the range's rhythm, not as the whole conclusion.`;
}

function renderHeatmapInterpretation(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const activeDays = days.filter((day) => day.words > 0);
  const peak = [...activeDays].sort(
    (a, b) => b.words - a.words || a.date.localeCompare(b.date),
  )[0];
  if (!peak) {
    return language === "zh"
      ? "热力图没有显示明确的每日字数活动。"
      : "The heatmap does not show a clear daily word-activity pattern.";
  }
  return language === "zh"
    ? `热力图突出每日写作密度；${peak.date} 是本期最明显的高峰日。`
    : `The heatmap highlights daily writing density; ${peak.date} is the clearest peak day in this range.`;
}

function renderTopicEvolutionInterpretation(
  data: TopicEvolutionData,
  language: ResolvedAnnualReviewLanguage,
): string {
  const topics = data.topTopics.slice(0, 3).map((topic) => topic.name);
  if (topics.length === 0) {
    return language === "zh"
      ? "主题图没有足够数据形成稳定主线。"
      : "The topic chart does not have enough data to suggest stable threads.";
  }
  return language === "zh"
    ? `主题图只作为背景节奏：${formatQuotedList(topics)} 是本期较明显的内容信号，仍需以已确认主题为准。`
    : `The topic chart is background rhythm: ${formatQuotedList(topics)} are visible content signals, while confirmed themes remain the report authority.`;
}

function renderGrowthFeedback(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const text = REPORT_TEXT[language];
  const activeMonths = aggregate.monthBuckets.filter((month) => month.words > 0).length;
  return [
    `${text.growthStrength(aggregate.activeDays, aggregate.longestStreak)} ${text.growthRisk(activeMonths)} ${text.growthSuggestion}`,
  ];
}

function renderSnapshotMetricRows(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const text = REPORT_TEXT[language];
  if (aggregate.snapshotComparison.source !== "historical-snapshot") {
    return [];
  }
  return [
    `| ${text.snapshotWordDelta} | ${formatSignedInteger(aggregate.snapshotComparison.wordDelta)} |`,
  ];
}

function formatScope(items: string[], emptyLabel: string): string {
  return items.length > 0 ? items.join(", ") : emptyLabel;
}

function renderMetadata(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  return [
    "---",
    `generated: ${JSON.stringify(aggregate.generatedAt)}`,
    `year: ${aggregate.year}`,
    `review_preset: ${JSON.stringify(aggregate.session.preset)}`,
    `review_label: ${JSON.stringify(aggregate.session.label)}`,
    `start_date: ${JSON.stringify(aggregate.session.startDate)}`,
    `end_date: ${JSON.stringify(aggregate.session.endDate)}`,
    "cssclasses:",
    "  - p-indent",
    `growth_data_source: ${JSON.stringify(growthDataSourceLabel(aggregate, language))}`,
    `activity_date_sources: ${JSON.stringify(activityDateSourceSummary(aggregate, language))}`,
    `included_scope: ${JSON.stringify(formatScope(aggregate.scope.includeFolders, text.allMarkdownFiles))}`,
    `excluded_scope: ${JSON.stringify(formatScope(aggregate.scope.excludeFolders, text.none))}`,
    `excluded_patterns: ${JSON.stringify(formatScope(aggregate.scope.excludePatterns, text.none))}`,
    `report_folder: ${JSON.stringify(aggregate.scope.reportFolder)}`,
    `privacy_mode: ${JSON.stringify(aggregate.scope.privacyMode)}`,
    `report_language: ${JSON.stringify(language)}`,
    "---",
  ].join("\n");
}

function renderDataMethodology(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  aiEnabled = false,
): string {
  const comparison = aggregate.snapshotComparison;
  const dataBoundary =
    comparison.source === "historical-snapshot"
      ? language === "zh"
        ? "活动节奏参考插件 snapshot 与当前笔记统计；只把真实字数变化作为增长证据。"
        : "Activity rhythm uses plugin snapshots alongside current note statistics; only real word-count changes count as growth evidence."
      : comparison.source === "scope-mismatch"
        ? language === "zh"
          ? "历史 snapshot 与本次范围不一致，因此活动节奏按当前 Review Session 的证据解释。"
          : "The historical snapshot scope differs, so rhythm evidence is interpreted within the current Review Session only."
        : language === "zh"
          ? "活动节奏来自当前 Review Session 内可读取的 Markdown Evidence Notes。"
          : "Activity rhythm comes from Markdown Evidence Notes readable within the current Review Session.";
  const aiBoundary = aiEnabled
    ? language === "zh"
      ? "AI 只可基于本次 Evidence Package 辅助生成 Theme Hypotheses 和文字组织。"
      : "AI may only use this Evidence Package to assist Theme Hypotheses and prose organization."
    : language === "zh"
      ? "未启用 AI 时，主题候选来自本地证据信号。"
      : "When AI is disabled, theme candidates come from local evidence signals.";
  const confirmationBoundary =
    language === "zh"
      ? "只有用户在 Review Board 接受或重命名的主题会进入 Narrative Review Report；完整 Evidence Audit 留在 Review Board 或未来显式导出中。"
      : "Only themes accepted or renamed in Review Board enter the Narrative Review Report; complete Evidence Audit material stays in Review Board or a future explicit export.";

  return [
    dataBoundary,
    language === "zh"
      ? `回顾范围：${aggregate.session.startDate} 到 ${aggregate.session.endDate}（${aggregate.session.preset}）。`
      : `Review range: ${aggregate.session.startDate} to ${aggregate.session.endDate} (${aggregate.session.preset}).`,
    aiBoundary,
    confirmationBoundary,
  ].join("\n\n");
}

function activityDateSourceSummary(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const sources = aggregate.activityDateSources;
  return [
    `${text.frontmatterDate}: ${sources.frontmatter}`,
    `${text.pathDate}: ${sources.path}`,
    `${text.filesystemTimestamp}: ${sources.filesystem}`,
  ].join("; ");
}

function renderFilesystemDateWarning(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const filesystemCount = aggregate.activityDateSources.filesystem;
  if (filesystemCount === 0) {
    return [];
  }
  const total = Object.values(aggregate.activityDateSources).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total === 0) {
    return [];
  }
  return [`- ${REPORT_TEXT[language].filesystemDateWarning(filesystemCount, total)}`];
}

function growthDataSourceLabel(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  if (aggregate.snapshotComparison.source === "historical-snapshot") {
    return text.historicalSnapshotStatistics;
  }
  if (aggregate.snapshotComparison.source === "scope-mismatch") {
    return text.scopeMismatch;
  }
  return text.currentVaultInference;
}

function formatSignedInteger(value: number): string {
  return value > 0 ? `+${formatInteger(value)}` : formatInteger(value);
}

function renderMonthTable(
  months: MonthBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const activeMonths = months.filter(hasMonthData);
  if (activeMonths.length === 0) {
    return `- ${text.noMonthlyActivity}`;
  }
  const monthMetrics: MonthMetric[] = ["created", "modified", "words", "characters"];
  const metrics = monthMetrics.filter((metric) =>
    activeMonths.some((month) => month[metric] > 0),
  );
  const header = [text.month, ...metrics.map((metric) => text[metric])];
  const alignment = ["---", ...metrics.map(() => "---:")];
  return [
    `| ${header.join(" | ")} |`,
    `| ${alignment.join(" | ")} |`,
    ...activeMonths.map(
      (month) =>
        `| ${[month.month, ...metrics.map((metric) => String(month[metric]))].join(" | ")} |`,
    ),
  ].join("\n");
}

function renderDailyHeatmap(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
  chartPath?: string,
): string {
  const text = REPORT_TEXT[language];
  if (days.length === 0) {
    return text.dailyWordHeatmapEmpty;
  }
  return chartPath
    ? renderChartReference(chartPath, text.dailyWordHeatmap)
    : renderDailyHeatmapSvg(days, language, text);
}

function renderDailyCumulativeWords(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
  chartPath?: string,
): string {
  const text = REPORT_TEXT[language];
  if (days.length === 0) {
    return text.dailyWordHeatmapEmpty;
  }
  return chartPath
    ? renderChartReference(chartPath, text.dailyCumulativeGrowth)
    : renderDailyCumulativeWordsSvg(days, language, text);
}

function renderMonthlyCreatedNotes(
  months: MonthBucket[],
  language: ResolvedAnnualReviewLanguage,
  chartPath?: string,
): string {
  const text = REPORT_TEXT[language];
  if (months.length === 0) {
    return text.wordGrowthTrendEmpty;
  }

  return [
    chartPath
      ? renderChartReference(chartPath, text.wordGrowthTrend)
      : renderMonthlyCreatedNotesSvg(months, language, text),
  ].join("\n");
}

function reviewSessionTopicEvolution(
  reviewSession?: ReviewSessionState,
): TopicEvolutionData | null {
  if (!reviewSession) {
    return null;
  }
  const semanticCandidates = reportIncludedCandidates(reviewSession).filter(
    (candidate) => candidate.source !== "local",
  );
  if (semanticCandidates.length === 0) {
    return emptyTopicEvolution();
  }
  const fallbackMonth =
    reviewSession.session?.startDate.slice(0, 7) ??
    `${reviewSession.year ?? new Date().getFullYear()}-01`;
  const candidatePaths = new Map(
    semanticCandidates.map((candidate) => [
      candidate.id,
      traceableReviewCandidatePaths(candidate),
    ]),
  );
  const monthKeys = [
    ...new Set(
      semanticCandidates.flatMap((candidate) =>
        (candidatePaths.get(candidate.id) ?? []).map((path) =>
          reviewCandidatePathMonth(path, fallbackMonth),
        ),
      ),
    ),
  ].sort();
  const months = monthKeys.length > 0 ? monthKeys : [fallbackMonth];
  const topCandidates = semanticCandidates.slice(0, 8);
  const topTopics = topCandidates.map((candidate) => {
    const paths = candidatePaths.get(candidate.id) ?? [];
    return {
      name: reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
      addedWords: Math.max(1, paths.length || candidate.evidence.length) * 100,
      newNotes: paths.length,
      updatedNotes: paths.length,
      representativeNotes: paths.slice(0, 4),
    };
  });
  const monthlyBuckets = months.map((month) => ({
    month,
    topics: Object.fromEntries(
      topCandidates.map((candidate) => {
        const name = reviewCandidateDisplayTitle(candidate.title, candidate.userTitle);
        const paths = candidatePaths.get(candidate.id) ?? [];
        const matchingPaths = paths.filter(
          (path) => reviewCandidatePathMonth(path, fallbackMonth) === month,
        );
        return [name, matchingPaths.length * 100];
      }),
    ),
  }));
  return {
    topTopics,
    emergingTopics: topTopics.slice(0, 3).map((topic) => topic.name),
    decliningTopics: [],
    monthlyBuckets,
    noteAssignments: topCandidates.flatMap((candidate) =>
      (candidatePaths.get(candidate.id) ?? []).map((path) => ({
        path,
        topics: [reviewCandidateDisplayTitle(candidate.title, candidate.userTitle)],
        sources: {
          [reviewCandidateDisplayTitle(candidate.title, candidate.userTitle)]:
            "ai-cluster" as const,
        },
      })),
    ),
  };
}

function emptyTopicEvolution(): TopicEvolutionData {
  return {
    topTopics: [],
    emergingTopics: [],
    decliningTopics: [],
    monthlyBuckets: [],
    noteAssignments: [],
  };
}

function traceableReviewCandidatePaths(candidate: ReviewCandidate): string[] {
  return [
    ...candidate.sourcePaths,
    ...candidate.evidence.flatMap((evidence) => [evidence.sourcePath, evidence.target]),
  ]
    .map((path) => path?.trim())
    .filter((path): path is string => Boolean(path))
    .filter((path, index, paths) => paths.indexOf(path) === index);
}

function reviewCandidatePathMonth(path: string, fallbackMonth: string): string {
  return pathDateKey(path)?.slice(0, 7) ?? fallbackMonth;
}

function pathDateKey(path: string): string | null {
  const match = path.match(/(?:^|[/\s_-])(\d{4})[-_.](\d{2})[-_.](\d{2})(?=$|[^\d])/u);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function renderChartReference(path: string, alt: string): string {
  return `![[${path}|${alt}|900]]`;
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
  const body = normalizeGeneratedMarkdown(markdown)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(
      /\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu,
      (_match, path: string, suffix = "") => `[[${path}${suffix}]]`,
    )
    .replace(
      /\[\[([^\]|#\]]+)(#[^\]|]+)?\]\]/gu,
      (_match, target: string, heading = "") =>
        wikiLinkWithAlias(target, heading, cleanEvidenceAlias(target)),
    )
    .replace(/\s+/gu, " ")
    .trim();
  const sentence = body.match(/^(.+?[.!?。！？])(?:\s|$)/u)?.[1] ?? body;
  return sentence.slice(0, 240).trim();
}

function sanitizeParagraphMarkdown(markdown?: string): string {
  if (!markdown) {
    return "";
  }
  return normalizeGeneratedMarkdown(markdown)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(
      /\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu,
      (_match, path: string, suffix = "") => `[[${path}${suffix}]]`,
    )
    .replace(
      /\[\[([^\]|#\]]+)(#[^\]|]+)?\]\]/gu,
      (_match, target: string, heading = "") =>
        wikiLinkWithAlias(target, heading, cleanEvidenceAlias(target)),
    )
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 900);
}

function normalizeGeneratedMarkdown(markdown: string): string {
  return markdown.trim();
}

function sanitizeHeading(markdown?: string): string {
  return sanitizeInlineMarkdown(markdown).replace(/^#+\s*/u, "") || "Untitled";
}

function noteTitle(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/u, "") ?? path;
}

function renderMetricList(
  items: RankedMetric[],
  prefix = "",
  language: ResolvedAnnualReviewLanguage = "en",
): string {
  if (items.length === 0) {
    return `- ${REPORT_TEXT[language].noDataFound}`;
  }
  return items.map((item) => `- ${prefix}${item.name}: ${item.count}`).join("\n");
}

function renderHighValueNotes(
  _aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  _aiNotes: AiHighValueNoteInsight[] = [],
  _aiEnabled = false,
  reviewSession?: ReviewSessionState,
): string {
  if (reviewSession) {
    return renderReviewedCandidates(reviewSession, language);
  }
  return language === "zh"
    ? "- 还没有 Review Board 状态可确认主题；默认报告不会把未复核 Theme Hypotheses 写成结论。"
    : "- No Review Board state is available to confirm themes; the default report does not turn unreviewed Theme Hypotheses into conclusions.";
}

function renderReviewedCandidates(
  reviewSession: ReviewSessionState,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const candidates = reportIncludedCandidates(reviewSession);
  if (candidates.length === 0) {
    return language === "zh"
      ? "- 还没有已接受或重命名的主题进入报告。请先在 Review Board 复核 Theme Hypotheses。"
      : "- No accepted or renamed themes are ready for the report yet. Review Theme Hypotheses in Review Board first.";
  }
  return candidates
    .flatMap((candidate) => renderReviewedCandidate(candidate, reviewSession, language))
    .join("\n");
}

function renderReviewedCandidate(
  candidate: ReviewCandidate,
  _reviewSession: ReviewSessionState,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const paragraphs = reviewCandidateNarrativeParagraphs(candidate, language);
  const title = sanitizeHeading(
    reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
  );
  const rows = [
    `### ${title}`,
    "",
    ...(paragraphs.length > 0
      ? paragraphs.flatMap((paragraph) => [paragraph, ""])
      : [
          language === "zh"
            ? "这条主线已经由用户确认，但还需要回到 Representative Evidence 中重新补充叙事。"
            : "This theme has been confirmed by the user, but its narrative still needs to be reread against the Representative Evidence.",
          "",
        ]),
    `${language === "zh" ? "代表证据" : "Representative evidence"}:`,
    ...renderReviewCandidateEvidence(candidate, language),
  ];
  if (candidate.userNote?.trim()) {
    rows.push("", sanitizeParagraphMarkdown(candidate.userNote));
  }
  rows.push("");
  return rows;
}

function reviewCandidateNarrativeParagraphs(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const summary = reviewCandidateSummary(candidate, language);
  const uncertainty = reviewCandidateUncertainty(candidate, language);
  if (isReportReadyNarrative(summary, language)) {
    return uniqueParagraphs([summary, uncertainty]);
  }
  const paragraphs = uniqueParagraphs([
    summary,
    reviewCandidateConnection(candidate, language),
    reviewCandidateReason(candidate, language),
    uncertainty,
  ]);
  return paragraphs;
}

function isReportReadyNarrative(
  paragraph: string,
  language: ResolvedAnnualReviewLanguage,
): boolean {
  const plainText = plainNarrativeText(paragraph);
  if (!plainText) {
    return false;
  }
  const wikilinkCount = (paragraph.match(/\[\[[^\]]+\]\]/gu) ?? []).length;
  if (language === "zh") {
    const plainCharacters = Array.from(plainText.replace(/\s+/gu, "")).length;
    const rawCharacters = Array.from(paragraph.replace(/\s+/gu, "")).length;
    return (
      (plainCharacters >= 180 || rawCharacters >= 240) &&
      (wikilinkCount >= 2 || plainCharacters >= 650)
    );
  }
  const words = plainText.match(/[\p{L}\p{N}'-]+/gu)?.length ?? 0;
  return words >= 90 && (wikilinkCount >= 2 || words >= 260);
}

function plainNarrativeText(markdown: string): string {
  return markdown
    .replace(/\[\[[^\]|#\]]+(?:#[^\]|]+)?\|([^\]]+)\]\]/gu, "$1")
    .replace(/\[\[([^\]|#\]]+)(?:#[^\]|]+)?\]\]/gu, "$1")
    .replace(/[`*_~>#-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueParagraphs(paragraphs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const paragraph of paragraphs.map((item) => item.trim()).filter(Boolean)) {
    const identity = paragraph.toLocaleLowerCase();
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(paragraph);
  }
  return result;
}

function reviewCandidateSummary(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return (
    sanitizeCandidateParagraph(candidate, candidate.aiSummary, language) ||
    sanitizeCandidateParagraph(candidate, candidate.reason, language) ||
    sanitizeHeading(reviewCandidateDisplayTitle(candidate.title, candidate.userTitle))
  );
}

function reviewCandidateReason(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return (
    sanitizeCandidateParagraph(candidate, candidate.reason, language) ||
    sanitizeHeading(reviewCandidateDisplayTitle(candidate.title, candidate.userTitle))
  );
}

function reviewCandidateConnection(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const candidateConnection = sanitizeCandidateParagraph(
    candidate,
    candidate.connectionExplanation,
    language,
  );
  if (candidateConnection) {
    return candidateConnection;
  }
  const traceableReasons = candidate.reasons.filter(reasonHasEvidence);
  const reasonLabels = traceableReasons
    .map((reason) => sanitizeCandidateInline(candidate, reason.label, language))
    .filter(Boolean);
  if (reasonLabels.length > 0) {
    return reasonLabels.join(" ");
  }
  const evidenceReasons = candidate.evidence
    .map((evidence) => sanitizeCandidateInline(candidate, evidence.reason, language))
    .filter(Boolean);
  if (evidenceReasons.length > 0) {
    return evidenceReasons.join(" ");
  }
  return language === "zh"
    ? "在判断这个提案是否成为主题前，请先一起复核这些代表证据。"
    : "Review the linked evidence notes together before deciding whether this proposal is a real theme.";
}

function traceableEvidence(candidate: ReviewCandidate): ReviewCandidate["evidence"] {
  return candidate.evidence.filter((evidence) => !evidence.missing);
}

function reviewCandidateUncertainty(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string {
  return sanitizeCandidateParagraph(candidate, candidate.uncertainty, language);
}

function renderReviewCandidateEvidence(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const rows = traceableEvidence(candidate)
    .slice(0, 4)
    .map((evidence) => {
      const target = evidence.sourcePath || evidence.target;
      const link = target
        ? wikiLink(target, readableEvidenceAlias(evidence.label, target))
        : sanitizeInlineMarkdown(evidence.label);
      const reason = reviewCandidateEvidenceReason(candidate, evidence, language);
      const comment = sanitizeCandidateInline(candidate, evidence.userComment, language);
      const commentText = comment
        ? language === "zh"
          ? `；${comment}`
          : `; comment: ${comment}`
        : "";
      return `- ${link}${reason ? `: ${reason}` : ""}${commentText}`;
    });
  return rows.length > 0
    ? rows
    : [
        language === "zh"
          ? "- 暂无可追溯的 Representative Evidence；请回到 Review Board 重新复核。"
          : "- No traceable Representative Evidence is available; return to Review Board before relying on this theme.",
      ];
}

function reviewCandidateEvidenceReason(
  candidate: ReviewCandidate,
  evidence: ReviewCandidate["evidence"][number],
  language: ResolvedAnnualReviewLanguage,
): string {
  const reason = sanitizeCandidateInline(candidate, evidence.reason, language);
  if (reason && !isTechnicalEvidenceReason(reason) && !isGenericEvidenceReason(reason)) {
    return reason;
  }
  return "";
}

function isTechnicalEvidenceReason(reason: string): boolean {
  return /(?:created in review range|modified in review range|backlinks?|outbound links?|shared links?|entities?:|frontmatter context present|tags present as weak signals|cross-folder links?|contains reviewable questions|创建于回顾范围|修改于回顾范围|反向链接|出链|共享链接|实体：|存在属性上下文|标签仅作为弱信号|跨文件夹链接|包含可复核问题)/iu.test(
    reason,
  );
}

function isGenericEvidenceReason(reason: string): boolean {
  return /(?:representative evidence note|代表证据|适合回看原文|original tone and judgment|原始语气)/iu.test(
    reason,
  );
}

function readableEvidenceAlias(label: string | undefined, path: string): string {
  const alias = cleanEvidenceAlias(label);
  return alias || cleanEvidenceAlias(noteTitle(path)) || noteTitle(path);
}

function cleanEvidenceAlias(value: string | undefined): string {
  const alias = (value ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(/\[\[/gu, "")
    .replace(/\]\]/gu, "")
    .split("|")
    .pop()
    ?.split("/")
    .pop()
    ?.replace(/\.md$/iu, "")
    ?.trim();
  if (!alias) {
    return "";
  }
  const normalized = reviewCandidateDisplayTitle(stripLeadingDatePrefix(alias));
  if (/^[a-z0-9][a-z0-9 _-]*$/u.test(normalized) && /[a-z]/u.test(normalized)) {
    return normalized
      .replace(/[_-]+/gu, " ")
      .replace(/\s+/gu, " ")
      .replace(/\b[a-z]/gu, (char) => char.toLocaleUpperCase());
  }
  return normalized;
}

function stripLeadingDatePrefix(value: string): string {
  return value
    .replace(
      /^(?:19|20)\d{2}[-_.年\s]+(?:1[0-2]|0?[1-9])[-_.月\s]+(?:3[01]|[12]\d|0?[1-9])日?\s*/u,
      "",
    )
    .trim();
}

function sanitizeCandidateParagraph(
  candidate: ReviewCandidate,
  markdown?: string,
  language: ResolvedAnnualReviewLanguage = "en",
): string {
  return replaceCandidateRawTitle(
    candidate,
    localizeReviewCandidateText(sanitizeParagraphMarkdown(markdown), language),
  );
}

function sanitizeCandidateInline(
  candidate: ReviewCandidate,
  markdown?: string,
  language: ResolvedAnnualReviewLanguage = "en",
): string {
  return replaceCandidateRawTitle(
    candidate,
    localizeReviewCandidateText(sanitizeInlineMarkdown(markdown), language),
  );
}

function localizeReviewCandidateText(
  value: string,
  language: ResolvedAnnualReviewLanguage,
): string {
  if (language !== "zh" || !value) {
    return value;
  }
  return value
    .replace(
      /^Local evidence groups (.+) around (.+)\.$/u,
      "本地证据把 $1 归为同一个主题线索，主要依据是 $2。",
    )
    .replace(
      /^These notes share (.+), with supporting local metadata such as excerpts, links, backlinks, dates, or cross-folder connections\.$/u,
      "这些笔记共享 $1，并由摘录、链接、反向链接、日期或跨文件夹连接等本地元数据支撑。",
    )
    .replace(
      /^These notes share tag "(.+)", but tags are treated as weak evidence and should be confirmed against excerpts, links, and date signals\.$/u,
      "这些笔记共享标签“$1”，但标签只作为弱证据；需要结合摘录、链接和日期信号复核。",
    )
    .replace(
      /^Only one evidence note is available for this local clue, so it should be reviewed before being promoted into a theme\.$/u,
      "这个本地线索目前只有一条代表证据，提升为主题前需要先复核。",
    )
    .replace(
      /^Low confidence: fewer than two evidence notes support (this clue|this hypothesis)\.$/u,
      "低置信度：少于两条代表证据支撑这个假设。",
    )
    .replace(/topTags:/gu, "高频标签：")
    .replace(/tags present as weak signals/gu, "标签仅作为弱信号")
    .replace(/frontmatter context present/gu, "存在属性上下文")
    .replace(/contains reviewable questions/gu, "包含可复核问题")
    .replace(/reviewable questions/gu, "可复核问题")
    .replace(/created in review range: /gu, "创建于回顾范围：")
    .replace(/modified in review range: /gu, "修改于回顾范围：")
    .replace(/^resurfaced old note: created /u, "旧笔记重新出现：创建于 ")
    .replace(/, modified /u, "，修改于 ")
    .replace(/shared links: /gu, "共享链接：")
    .replace(/repeated phrases: /gu, "重复短语：")
    .replace(/entities: /gu, "实体：")
    .replace(/cross-folder links: /gu, "跨文件夹链接：")
    .replace(/\bweak tags\b/gu, "弱标签")
    .replace(/\btag:/gu, "标签：")
    .replace(/\bbacklinks\b/gu, "反向链接")
    .replace(/\boutbound links\b/gu, "出链")
    .replace(/\d+ 反向链接/gu, (match) => `${match.replace(" 反向链接", "")} 条反向链接`)
    .replace(/\d+ 出链/gu, (match) => `${match.replace(" 出链", "")} 条出链`);
}

function replaceCandidateRawTitle(candidate: ReviewCandidate, value: string): string {
  const displayTitle = reviewCandidateDisplayTitle(candidate.title, candidate.userTitle);
  const rawTitle = candidate.title.trim();
  if (!rawTitle || rawTitle === displayTitle) {
    return value;
  }
  let normalized = value.replaceAll(rawTitle, displayTitle);
  const rawWikilinkTarget = rawTitle.match(
    /^\[\[([^\]|#\]]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/u,
  )?.[1];
  if (rawWikilinkTarget) {
    normalized = normalized.replaceAll(
      wikiLinkWithAlias(rawWikilinkTarget, "", cleanEvidenceAlias(rawWikilinkTarget)),
      displayTitle,
    );
  }
  return normalized;
}

function reportIncludedCandidates(reviewSession: ReviewSessionState): ReviewCandidate[] {
  return reviewSession.candidates.filter(isReviewReportCandidate);
}

function reasonHasEvidence(reason: ExplanationReason): boolean {
  return Boolean(
    reason.sourcePath ||
    reason.statField ||
    (reason.relatedPaths && reason.relatedPaths.length > 0),
  );
}

function renderWorthRereading(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  reviewSession?: ReviewSessionState,
  themeEvidencePackage?: ThemeEvidencePackage,
): string {
  const blockedPaths = new Set(
    reviewSession?.candidates
      .filter(
        (candidate) => candidate.status === "ignored" || candidate.status === "merged",
      )
      .flatMap((candidate) => candidate.sourcePaths) ?? [],
  );
  const confirmedThemeReasons = reviewSessionWorthRereadingReasons(
    reviewSession,
    language,
  );
  const evidenceTargets = evidencePackageReviewTargets(
    themeEvidencePackage,
    reviewSession,
    language,
  );
  const notes = prioritizedWorthRereadingNotes(
    [
      ...aggregate.maintenanceNotes,
      ...aggregate.isolatedPotentialNotes,
      ...aggregate.representativeNotes.map((note) => ({
        path: note.path,
        title: note.title,
        suggestedAction:
          language === "zh"
            ? "作为本范围的代表笔记重新检查。"
            : "Revisit as a representative note from this range.",
      })),
      ...evidenceTargets,
    ].filter((note) => !blockedPaths.has(note.path)),
    confirmedThemeReasons,
  ).slice(0, 6);
  if (notes.length === 0) {
    return `- ${REPORT_TEXT[language].noDataFound}`;
  }
  const rows = notes.map((note) => ({
    note,
    reason: worthRereadingReason(note, language, confirmedThemeReasons.get(note.path)),
  }));
  const reasonCounts = rows.reduce((counts, row) => {
    const key = normalizeRepeatedReportText(row.reason);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());
  return rows
    .map(({ note, reason }) => {
      const link = wikiLink(note.path, readableEvidenceAlias(note.title, note.path));
      const repeated =
        (reasonCounts.get(normalizeRepeatedReportText(reason)) ?? 0) > 1 &&
        !isConfirmedThemeWorthRereadingReason(reason);
      return `- ${link}${reason && !repeated ? `: ${reason}` : ""}`;
    })
    .join("\n");
}

function prioritizedWorthRereadingNotes(
  notes: Array<{ path: string; title?: string; suggestedAction?: string }>,
  confirmedThemeReasons: Map<string, string>,
): Array<{ path: string; title?: string; suggestedAction?: string }> {
  const firstSeen = new Map<string, number>();
  const unique = notes.filter((note, index) => {
    if (firstSeen.has(note.path)) {
      return false;
    }
    firstSeen.set(note.path, index);
    return true;
  });
  return unique.sort(
    (a, b) =>
      worthRereadingPriority(b, confirmedThemeReasons) -
        worthRereadingPriority(a, confirmedThemeReasons) ||
      (firstSeen.get(a.path) ?? 0) - (firstSeen.get(b.path) ?? 0),
  );
}

function worthRereadingPriority(
  note: { path: string; suggestedAction?: string },
  confirmedThemeReasons: Map<string, string>,
): number {
  let priority = 0;
  if (confirmedThemeReasons.has(note.path)) {
    priority += 30;
  }
  const action = sanitizeInlineMarkdown(note.suggestedAction);
  if (action && !isGenericWorthRereadingReason(action)) {
    priority += action.includes("手动复核") || /manual review/iu.test(action) ? 35 : 10;
  }
  return priority;
}

function worthRereadingReason(
  note: { path: string; title?: string; suggestedAction?: string },
  language: ResolvedAnnualReviewLanguage,
  confirmedThemeReason = "",
): string {
  const suggestedAction = sanitizeInlineMarkdown(note.suggestedAction);
  const representativeFallback =
    language === "zh"
      ? "作为本范围的代表笔记重新检查。"
      : "Revisit as a representative note from this range.";
  if (
    suggestedAction === representativeFallback ||
    isGenericWorthRereadingReason(suggestedAction)
  ) {
    return confirmedThemeReason;
  }
  return suggestedAction || confirmedThemeReason;
}

function isGenericWorthRereadingReason(reason: string): boolean {
  return /(?:补\s*2-3\s*个上下文链接后整理成输出草稿|revisit as a representative note|representative note from this range|it resurfaced in this range|重新浮现|原始语气、关系和未解决问题)/iu.test(
    reason,
  );
}

function isConfirmedThemeWorthRereadingReason(reason: string): boolean {
  return /(?:支撑已确认主线|supports the confirmed theme)/iu.test(reason);
}

function reviewSessionWorthRereadingReasons(
  reviewSession: ReviewSessionState | undefined,
  language: ResolvedAnnualReviewLanguage,
): Map<string, string> {
  const reasons = new Map<string, string>();
  if (!reviewSession) {
    return reasons;
  }
  for (const candidate of reportIncludedCandidates(reviewSession).filter(
    (item) => item.source !== "local",
  )) {
    const title = sanitizeInlineMarkdown(
      reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
    );
    const themeReason =
      sanitizeCandidateInline(candidate, candidate.reason, language) ||
      sanitizeCandidateInline(candidate, candidate.connectionExplanation, language);
    const reason = worthRereadingThemeReason(title, themeReason, language);
    if (!reason) {
      continue;
    }
    for (const path of traceableReviewCandidatePaths(candidate)) {
      if (!reasons.has(path)) {
        reasons.set(path, reason);
      }
    }
  }
  return reasons;
}

function evidencePackageReviewTargets(
  evidencePackage: ThemeEvidencePackage | undefined,
  reviewSession: ReviewSessionState | undefined,
  language: ResolvedAnnualReviewLanguage,
): Array<{ path: string; title?: string; suggestedAction?: string }> {
  if (!evidencePackage) {
    return [];
  }
  const confirmedPaths = new Set(
    reviewSession
      ? reportIncludedCandidates(reviewSession).flatMap(traceableReviewCandidatePaths)
      : [],
  );
  return evidencePackage.evidenceNotes
    .filter((note) => !confirmedPaths.has(note.path))
    .filter(isManualReviewEvidenceTarget)
    .sort(sortManualReviewEvidenceTargets)
    .slice(0, 3)
    .map((note) => ({
      path: note.path,
      title: note.title,
      suggestedAction: manualReviewTargetReason(note, language),
    }));
}

function isManualReviewEvidenceTarget(note: ThemeEvidenceNote): boolean {
  return (
    isBackgroundEvidenceNote(note) ||
    isProjectLikeEvidenceNote(note) ||
    note.relatedNotes.length >= 3 ||
    note.crossFolderLinks.length > 0
  );
}

function isBackgroundEvidenceNote(note: ThemeEvidenceNote): boolean {
  return note.dateSignals.length === 0 && hasRelationshipSignal(note);
}

function isProjectLikeEvidenceNote(note: ThemeEvidenceNote): boolean {
  return /(?:^|\/)(?:projects?|areas?|resources?|reference|research|archive)\//iu.test(
    note.path,
  );
}

function hasRelationshipSignal(note: ThemeEvidenceNote): boolean {
  return (
    note.backlinks.length > 0 ||
    note.links.length > 0 ||
    note.commonLinks.length > 0 ||
    note.relatedNotes.length > 0 ||
    note.crossFolderLinks.length > 0
  );
}

function sortManualReviewEvidenceTargets(
  a: ThemeEvidenceNote,
  b: ThemeEvidenceNote,
): number {
  return (
    manualReviewEvidenceScore(b) - manualReviewEvidenceScore(a) ||
    a.path.localeCompare(b.path)
  );
}

function manualReviewEvidenceScore(note: ThemeEvidenceNote): number {
  return (
    (isBackgroundEvidenceNote(note) ? 30 : 0) +
    (isProjectLikeEvidenceNote(note) ? 20 : 0) +
    note.backlinks.length * 3 +
    note.crossFolderLinks.length * 2 +
    note.relatedNotes.length
  );
}

function manualReviewTargetReason(
  note: ThemeEvidenceNote,
  language: ResolvedAnnualReviewLanguage,
): string {
  const relationship = manualReviewRelationshipSummary(note, language);
  if (language === "zh") {
    return `手动复核：${relationship}，确认它只是背景，还是漏掉了一条应进入主线的关系。`;
  }
  return `Manual review: ${relationship}; decide whether this is only background context or a missed relationship that should enter the main themes.`;
}

function manualReviewRelationshipSummary(
  note: ThemeEvidenceNote,
  language: ResolvedAnnualReviewLanguage,
): string {
  const signals: string[] = [];
  if (note.dateSignals.length === 0) {
    signals.push(
      language === "zh"
        ? "它不是本期直接活动笔记"
        : "it was not directly active in this range",
    );
  }
  if (note.backlinks.length > 0) {
    signals.push(
      language === "zh"
        ? `被 ${note.backlinks.length} 条本期证据链接回来`
        : `it is linked back from ${note.backlinks.length} evidence note${note.backlinks.length === 1 ? "" : "s"}`,
    );
  }
  if (note.crossFolderLinks.length > 0 || isProjectLikeEvidenceNote(note)) {
    signals.push(
      language === "zh"
        ? "承担跨文件夹/项目上下文"
        : "it carries cross-folder or project context",
    );
  }
  return signals.length > 0
    ? signals.join(language === "zh" ? "，" : ", ")
    : language === "zh"
      ? "它带有未进入已确认主线的关系信号"
      : "it carries relationship signals not yet used by confirmed themes";
}

function worthRereadingThemeReason(
  title: string,
  reason: string,
  language: ResolvedAnnualReviewLanguage,
): string {
  if (!title) {
    return "";
  }
  const prefix =
    language === "zh"
      ? `支撑已确认主线「${title}」`
      : `Supports the confirmed theme “${title}”`;
  if (!reason) {
    return language === "zh"
      ? `${prefix}，适合回到原文复核。`
      : `${prefix}; revisit the source note to verify the evidence.`;
  }
  return `${prefix}: ${truncateInlineReason(reason, language === "zh" ? 72 : 120)}`;
}

function truncateInlineReason(reason: string, maxCharacters: number): string {
  const normalized = reason.trim().replace(/\s+/gu, " ");
  const characters = Array.from(normalized);
  if (characters.length <= maxCharacters) {
    return normalized;
  }
  return `${characters
    .slice(0, maxCharacters - 1)
    .join("")
    .trim()}…`;
}

function normalizeRepeatedReportText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function renderReflectionQuestions(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  aiActions: string[] = [],
  aiThemes: AiThemeInsight[] = [],
  reviewSession?: ReviewSessionState,
  themeEvidencePackage?: ThemeEvidencePackage,
): string {
  const aiQuestions = aiActions
    .map((action) => sanitizeInlineMarkdown(action))
    .filter((action) => isReflectionQuestion(action));
  const themes =
    reviewSession && reportIncludedCandidates(reviewSession).length > 0
      ? reportIncludedCandidates(reviewSession)
          .slice(0, 3)
          .map((candidate) =>
            sanitizeHeading(
              reviewCandidateDisplayTitle(candidate.title, candidate.userTitle),
            ),
          )
      : aiThemes
          .slice(0, 3)
          .map((theme) => sanitizeHeading(theme.title))
          .filter(Boolean);
  const topic =
    themes[0] ||
    aggregate.topicEvolution.topTopics[0]?.name ||
    (language === "zh" ? "本期最明显的主题" : "the clearest theme in this range");
  const manualQuestions = manualReviewReflectionQuestions(
    themeEvidencePackage,
    reviewSession,
    topic,
    language,
  );
  const fallback = reflectionFallbackQuestions(themes, topic, language);
  return [...aiQuestions, ...manualQuestions, ...fallback]
    .slice(0, 5)
    .map((question) => `- ${question}`)
    .join("\n");
}

function manualReviewReflectionQuestions(
  evidencePackage: ThemeEvidencePackage | undefined,
  reviewSession: ReviewSessionState | undefined,
  _topic: string,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  return evidencePackageReviewTargets(evidencePackage, reviewSession, language)
    .slice(0, 2)
    .map((note) => {
      const link = wikiLink(note.path, readableEvidenceAlias(note.title, note.path));
      return language === "zh"
        ? `回到 ${link} 看：它只是本期已确认主线背后的背景索引，还是说明还有一条没有被写进主线的关系？`
        : `Return to ${link}: is it only background context behind the confirmed themes, or does it point to a relationship that still has not made it into the main themes?`;
    });
}

function reflectionFallbackQuestions(
  themes: string[],
  topic: string,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const secondTheme = themes.find((theme) => theme !== topic);
  if (language === "zh") {
    return [
      `围绕「${topic}」，今年真正变化的是你的判断标准、行动节奏，还是只是多了一套解释自己的语言？`,
      secondTheme
        ? `「${topic}」和「${secondTheme}」背后是否有同一个模式：你把安全感交给了工具、关系、金钱、平台或他人反馈中的哪一个？`
        : `「${topic}」背后最难承认的取舍是什么：你想获得什么，同时又害怕失去什么？`,
      "下次类似情境再次出现时，你要提前设定哪一个边界，才不会只在事后复盘里理解自己？",
    ];
  }
  return [
    `Around ${topic}, did your actual standards and rhythms change, or did you mostly gain a better explanation for the same behavior?`,
    secondTheme
      ? `Do ${topic} and ${secondTheme} share one deeper pattern: where are you outsourcing safety to tools, relationships, money, platforms, or feedback?`
      : `What is the hardest tradeoff behind ${topic}: what are you trying to gain, and what are you afraid to lose?`,
    "What boundary would you set before the next similar situation, so the lesson does not only appear during the retrospective?",
  ];
}

function isReflectionQuestion(value: string): boolean {
  return (
    /[?？]$/u.test(value) &&
    !/^(?:create|add|write|turn|inspect|compare|整理|补|检查|创建|写)/iu.test(value)
  );
}

function renderRhythm(
  months: MonthBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const active = months.filter((month) => month.created > 0 || month.modified > 0);
  if (active.length === 0) {
    return text.noActivity;
  }
  const strongest = [...active].sort(
    (a, b) => b.words - a.words || a.month.localeCompare(b.month),
  )[0];
  return text.strongestMonth(strongest?.month ?? "n/a", strongest?.words ?? 0);
}

function wikiLink(path: string, title: string): string {
  return `[[${path.replace(/\.md$/u, "")}|${title}]]`;
}

function wikiLinkWithAlias(target: string, heading: string, alias: string): string {
  const normalizedTarget = `${target}${heading}`.replace(/\.md(?=#|$)/iu, "");
  return `[[${normalizedTarget}|${alias || noteTitle(target)}]]`;
}

function normalizeNotePath(path: string): string {
  return path.replace(/\.md$/iu, "");
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

function formatInlineList(
  items: string[],
  language: ResolvedAnnualReviewLanguage,
): string {
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
