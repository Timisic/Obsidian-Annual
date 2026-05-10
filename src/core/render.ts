import { toTopicEvolutionJson } from "./topics";
import { reviewCandidateDisplayTitle } from "./reviewTitle";
import type { ReviewCandidate, ReviewSessionState } from "./reviewState";
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
  TopicEvolutionData,
  TopicMonthlyBucket,
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
}

type MonthMetric = "created" | "modified" | "words" | "characters";
export type AnnualReviewChartKind =
  | "daily-cumulative-words"
  | "daily-word-heatmap"
  | "word-growth-trend"
  | "topic-evolution"
  | "topic-evolution-data";

export interface AnnualReviewChartAsset {
  kind: AnnualReviewChartKind;
  path: string;
  content: string;
}

export function buildAnnualReviewChartPaths(
  reportFolder: string,
  year: number,
): Record<AnnualReviewChartKind, string> {
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

export function buildAnnualReviewChartAssets(
  aggregate: YearAggregate,
  options: RenderOptions = {},
): AnnualReviewChartAsset[] {
  const language = options.language ?? "en";
  const paths =
    options.chartPaths ?? buildAnnualReviewChartPaths("Annual Reviews", aggregate.year);
  const assets: AnnualReviewChartAsset[] = [];

  if (aggregate.dayBuckets.length > 0 && paths["daily-cumulative-words"]) {
    assets.push({
      kind: "daily-cumulative-words",
      path: paths["daily-cumulative-words"],
      content: renderDailyCumulativeWordsSvg(
        activePeriodDays(aggregate.dayBuckets),
        language,
      ),
    });
  }

  if (aggregate.dayBuckets.length > 0 && paths["daily-word-heatmap"]) {
    assets.push({
      kind: "daily-word-heatmap",
      path: paths["daily-word-heatmap"],
      content: renderDailyHeatmapSvg(activePeriodDays(aggregate.dayBuckets), language),
    });
  }

  if (aggregate.monthBuckets.length > 0 && paths["word-growth-trend"]) {
    assets.push({
      kind: "word-growth-trend",
      path: paths["word-growth-trend"],
      content: renderMonthlyCreatedNotesSvg(
        activePeriodMonths(aggregate.monthBuckets),
        language,
      ),
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
    nextTopicAction:
      "Next-period suggestion: turn the leading theme into a small index page with evidence notes and open questions.",
    topTags: "Top Tags",
    topFolders: "Top Folders",
    topLinks: "Top Links",
    highValueNotes: "Theme Hypotheses",
    aiValueReason: "Recommendation rationale",
    topHighValueNotes: "Confirmed theme hypotheses",
    outputReadyNotes: "Output-ready notes",
    maintenanceNotes: "Notes needing maintenance",
    noOutputReadyNotes: "No output-ready notes found.",
    noMaintenanceNotes: "No maintenance-needed notes found.",
    highValueNotesSummary: (count: number) =>
      `These ${count} evidence notes may support theme hypotheses because their content, links, or activity signals give concrete reasons to inspect them.`,
    highValueNote: "Note",
    highValueType: "Suggestion label",
    highValueReason: "Recommendation rationale",
    highValueReasonList: "Auditable reasons",
    highValueEvidence: "Evidence",
    highValueSourceNote: "Source note",
    highValueRelatedNotes: "Related notes",
    highValueStatField: "Stat field",
    highValueNoAuditableEvidence:
      "No auditable evidence was generated for this evidence note; review the source note before treating it as a recommendation.",
    suggestedAction: "Review prompt",
    manualConfirmation: "Manual confirmation",
    manualConfirmationInstruction:
      "Confirm, rename, merge, or ignore this theme hypothesis before including it in the annual report.",
    highValueFeedback: "Evidence Note Reading",
    priorityNotes: (notes: string) =>
      `Evidence notes to inspect first: ${notes}. Use them to confirm or refine theme hypotheses manually.`,
    outputReadySignal: (count: number) =>
      `${count} notes have enough structure to be shaped into an article, index, or review memo.`,
    staleCoreSignal: (count: number) =>
      `${count} core notes have not been updated for more than 90 days and should be reviewed next period.`,
    noHighValueNotes: "No theme-hypothesis evidence signals found.",
    noReviewedCandidates:
      "No confirmed Theme Hypotheses are ready for the report yet. Accept or rename hypotheses in Review Board before including them here.",
    nextPeriodActions: "Reflection Prompts",
    aiNextActions: "Reflection Prompts",
    mocAction: (topic: string) =>
      `Create a compact index for ${topic}: evidence notes, current conclusion, and one next question.`,
    isolatedNotesAction: (count: number) =>
      `Optional review prompt: inspect ${count} isolated potential note${count === 1 ? "" : "s"} if they help explain a theme.`,
    noIsolatedNotesAction:
      "No isolated-potential evidence note needs review for the current report.",
    highValuePushAction: (notes: string) =>
      `Optional review prompt: compare ${notes} against the confirmed theme hypotheses.`,
    noHighValuePushAction:
      "No extra theme-hypothesis prompt is available from the current signals.",
    nextPeriodSuggestion: "Reflection Prompt",
    highValueNextStep:
      "Review these evidence notes with their rationale before changing the report narrative.",
    representativeNotes: "Representative Notes",
    representativeNotesDescription:
      "Representative notes are selected deterministically: each active month contributes the highest-volume note from that month's created notes, or from modified notes when the note was created in another year. Ranking uses counted words, then characters, then path as the tie-breaker. This stable evidence set can be reused by later AI summaries.",
    writingAndActivityRhythm: "Writing And Activity Rhythm",
    noDataFound: "No data found.",
    noRepresentativeNotes: "No representative notes found.",
    noteStats: (words: number, characters: number) =>
      `${words} words, ${characters} chars`,
    noActivity: "No activity was found for the selected year.",
    strongestMonth: (month: string, words: number) =>
      `Most created-note writing volume appears in ${month} with ${words} counted words.`,
  },
  zh: {
    title: (year: number) => `${year} 年度回顾`,
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
    nextTopicAction:
      "下期建议：把领先主题整理成一页小索引，列出证据笔记、当前判断和下一步问题。",
    topTags: "高频标签",
    topFolders: "高频文件夹",
    topLinks: "高频链接",
    highValueNotes: "主题假设",
    aiValueReason: "推荐理由",
    topHighValueNotes: "已确认主题假设",
    outputReadyNotes: "可输出笔记",
    maintenanceNotes: "需维护笔记",
    noOutputReadyNotes: "未找到可输出笔记。",
    noMaintenanceNotes: "未找到需维护笔记。",
    highValueNotesSummary: (count: number) =>
      `下面 ${count} 篇笔记因为内容、链接或活动信号而被建议回看。请逐篇人工确认或否决，再把它们视为年度代表内容。`,
    highValueNote: "笔记",
    highValueType: "建议标签",
    highValueReason: "推荐理由",
    highValueReasonList: "可审计理由",
    highValueEvidence: "证据",
    highValueSourceNote: "源笔记",
    highValueRelatedNotes: "相关笔记",
    highValueStatField: "统计字段",
    highValueNoAuditableEvidence:
      "此候选项没有生成可审计证据；请先打开源笔记复核，不要把它当作确定推荐。",
    suggestedAction: "复盘提示",
    manualConfirmation: "人工确认",
    manualConfirmationInstruction: "请人工确认、重命名、合并或忽略主题假设后再写入年报。",
    highValueFeedback: "证据笔记解读",
    priorityNotes: (notes: string) =>
      `建议优先检查的证据笔记：${notes}。用它们人工确认或修正主题假设。`,
    outputReadySignal: (count: number) =>
      `有 ${count} 篇笔记已经具备整理成文章、索引页或复盘备忘的条件。`,
    staleCoreSignal: (count: number) =>
      `有 ${count} 篇核心笔记超过 90 天未更新，建议下期回看维护。`,
    noHighValueNotes: "未找到主题假设证据信号。",
    noReviewedCandidates:
      "还没有可写入年报的主题假设。请先在 Review Board 接受或重命名主题假设。",
    nextPeriodActions: "复盘提示",
    aiNextActions: "复盘提示",
    mocAction: (topic: string) =>
      `围绕「${topic}」整理一页小索引：证据笔记、当前判断和一个下一步问题。`,
    isolatedNotesAction: (count: number) =>
      `可选复盘提示：检查 ${count} 篇孤立潜力笔记，看它们是否能解释某个主题。`,
    noIsolatedNotesAction: "当前报告没有需要额外回看的孤立证据笔记。",
    highValuePushAction: (notes: string) =>
      `可选复盘提示：把 ${notes} 与已确认主题假设对照检查。`,
    noHighValuePushAction: "当前主题假设信号不足，暂无额外复盘提示。",
    nextPeriodSuggestion: "复盘提示",
    highValueNextStep: "结合推荐理由人工确认这些证据笔记，再决定是否改写报告叙事。",
    representativeNotes: "代表笔记",
    representativeNotesDescription:
      "代表笔记采用确定性规则选择：每个活跃月份选出该月新建笔记中内容量最高的一篇；如果笔记不是当年新建但在该月被修改，也会参与该月选择。排序依次比较计数字词、字符数和路径。这个稳定证据集可供后续 AI 总结复用。",
    writingAndActivityRhythm: "写作与活动节奏",
    noDataFound: "未找到数据。",
    noRepresentativeNotes: "未找到代表笔记。",
    noteStats: (words: number, characters: number) => `${words} 字词，${characters} 字符`,
    noActivity: "所选年份未找到活动。",
    strongestMonth: (month: string, words: number) =>
      `新建笔记写作量最高的月份是 ${month}，共 ${words} 个计数字词。`,
  },
} as const;

const TOPIC_COLORS = [
  "#4f7cac",
  "#d98c46",
  "#4f9d69",
  "#8a6fbd",
  "#c75f7a",
  "#6f8f2f",
  "#b07d3c",
  "#6f7782",
  "#9aa0a6",
];
const OTHER_TOPIC = "其他";

export function renderAnnualReview(
  aggregate: YearAggregate,
  options: RenderOptions = {},
): string {
  const language = options.language ?? "en";
  const text = REPORT_TEXT[language];
  const aiEnhancements = hasAiEnhancements(options.aiEnhancements)
    ? options.aiEnhancements
    : undefined;
  const aiEnabled = options.aiEnabled || Boolean(aiEnhancements);
  return [
    renderMetadata(aggregate, language),
    "",
    `# ${text.title(aggregate.year)}`,
    "",
    `## ${text.periodJudgment}`,
    "",
    renderPeriodJudgment(
      aggregate,
      language,
      aiEnhancements?.periodJudgment || options.periodJudgment,
    ),
    "",
    `## ${text.writingGrowth}`,
    "",
    renderWritingGrowth(aggregate, language, options.chartPaths),
    "",
    `## ${text.topicEvolution}`,
    "",
    renderTopicEvolution(
      aggregate.topicEvolution,
      language,
      options.chartPaths?.["topic-evolution"],
      aiEnhancements?.themeInsights,
      aiEnabled,
    ),
    "",
    `## ${text.highValueNotes}`,
    "",
    renderHighValueNotes(
      aggregate,
      language,
      aiEnhancements?.highValueNotes,
      aiEnabled,
      options.reviewSession,
    ),
    "",
    `## ${text.nextPeriodActions}`,
    "",
    renderNextPeriodActions(
      aggregate,
      language,
      aiEnhancements?.nextActions,
      aiEnhancements?.themeInsights,
      options.reviewSession,
    ),
    "",
    `## ${text.dataMethodology}`,
    "",
    renderDataMethodology(aggregate, language),
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
): string {
  const text = REPORT_TEXT[language];
  const days = activePeriodDays(aggregate.dayBuckets);
  const months = activePeriodMonths(aggregate.monthBuckets);
  return [
    `| ${text.metric} | ${text.value} |`,
    "| --- | ---: |",
    ...renderSnapshotMetricRows(aggregate, language),
    `| ${text.totalNewWords} | ${formatInteger(aggregate.totalWords)} |`,
    `| ${text.notesCreated} | ${aggregate.createdCount} |`,
    `| ${text.notesModified} | ${aggregate.modifiedCount} |`,
    `| ${text.writingDays} | ${aggregate.activeDays} |`,
    `| ${text.longestWritingStreak} | ${aggregate.longestStreak} |`,
    "",
    `### ${text.dailyCumulativeGrowth}`,
    "",
    renderDailyCumulativeWords(days, language, chartPaths?.["daily-cumulative-words"]),
    "",
    `### ${text.monthlyGrowthChart}`,
    "",
    renderMonthlyCreatedNotes(months, language, chartPaths?.["word-growth-trend"]),
    "",
    `### ${text.heatmap}`,
    "",
    renderDailyHeatmap(days, language, chartPaths?.["daily-word-heatmap"]),
    "",
    `### ${text.growthFeedback}`,
    "",
    ...renderGrowthFeedback(aggregate, language),
  ].join("\n");
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
): string {
  const text = REPORT_TEXT[language];
  const comparison = aggregate.snapshotComparison;
  const methodology =
    comparison.source === "historical-snapshot"
      ? language === "zh"
        ? "增长数据来自插件自有 snapshot 的字数差异；只统计字数实际变化，避免把批量 mtime 变化写成年增长。"
        : "Growth data comes from word-count differences in plugin-owned snapshots; only real word-count changes are counted, avoiding mtime-only batch edits."
      : comparison.source === "scope-mismatch"
        ? language === "zh"
          ? "本次扫描范围与历史 snapshot 不一致，因此只展示当前 vault 推断，避免跨范围比较。"
          : "The scan scope differs from the historical snapshot, so this report uses current-vault inference instead of mixing incompatible ranges."
        : text.methodologyFallback;

  const scopeLabel = language === "zh" ? "范围" : "Scope";
  const excludedLabel = language === "zh" ? "排除" : "excluded";
  const patternsLabel = language === "zh" ? "排除模式" : "patterns";
  const reportFolderLabel = language === "zh" ? "报告目录" : "report folder";

  return [
    `- ${text.growthDataSource}: ${growthDataSourceLabel(aggregate, language)}`,
    `- ${text.activityDateSources}: ${activityDateSourceSummary(aggregate, language)}`,
    ...renderFilesystemDateWarning(aggregate, language),
    ...(comparison.source === "historical-snapshot"
      ? [`- ${text.snapshotWordDelta}: ${formatSignedInteger(comparison.wordDelta)}`]
      : []),
    `- ${scopeLabel}: ${formatScope(aggregate.scope.includeFolders, text.allMarkdownFiles)}; ${excludedLabel}: ${formatScope(aggregate.scope.excludeFolders, text.none)}; ${patternsLabel}: ${formatScope(aggregate.scope.excludePatterns, text.none)}; ${reportFolderLabel}: ${aggregate.scope.reportFolder}`,
    `- ${methodology}`,
  ].join("\n");
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

  const monthRows = new Map<string, DayBucket[]>();
  for (const day of days) {
    const month = monthRows.get(day.month) ?? [];
    month.push(day);
    monthRows.set(day.month, month);
  }

  return [
    chartPath
      ? renderChartReference(chartPath, text.dailyWordHeatmap)
      : renderDailyHeatmapSvg(days, language),
    "",
    `| ${text.month} | ${text.words} | ${text.activeDays} | ${text.peakDay} |`,
    "| --- | ---: | ---: | --- |",
    ...[...monthRows.entries()].map(([month, monthDays]) => {
      const totalWords = monthDays.reduce((sum, day) => sum + day.words, 0);
      const activeDays = monthDays.filter((day) => day.words > 0).length;
      const peak = [...monthDays].sort(
        (a, b) => b.words - a.words || a.date.localeCompare(b.date),
      )[0];
      const peakLabel =
        peak && peak.words > 0 ? `${peak.date} (${peak.words})` : text.notAvailable;
      return `| ${month} | ${totalWords} | ${activeDays} | ${peakLabel} |`;
    }),
  ].join("\n");
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
    : renderDailyCumulativeWordsSvg(days, language);
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
      : renderMonthlyCreatedNotesSvg(months, language),
  ].join("\n");
}

function renderTopicEvolution(
  data: TopicEvolutionData,
  language: ResolvedAnnualReviewLanguage,
  chartPath?: string,
  aiThemes: AiThemeInsight[] = [],
  aiEnabled = false,
): string {
  const text = REPORT_TEXT[language];
  if (aiThemes.length > 0) {
    return renderAiThemeEvolution(data, language, aiThemes);
  }

  if (data.topTopics.length === 0) {
    return `- ${text.topicEvolutionEmpty}`;
  }

  const rows = [
    text.topicEvolutionNeedsSynthesis,
    "",
    chartPath
      ? renderChartReference(chartPath, text.topicEvolutionChart)
      : renderTopicEvolutionSvg(data, language),
  ];

  return rows.join("\n");
}

function renderTopicTableRow(topic: TopTopic): string {
  const representativeNotes =
    topic.representativeNotes.map(wikiLinkPlain).join(", ") || "n/a";
  return tableRow([
    topic.name,
    formatInteger(topic.addedWords),
    String(topic.newNotes),
    representativeNotes,
  ]);
}

function renderAiThemeEvolution(
  _data: TopicEvolutionData,
  language: ResolvedAnnualReviewLanguage,
  themes: AiThemeInsight[],
): string {
  const text = REPORT_TEXT[language];
  const themeNames = themes.slice(0, 3).map((theme) => theme.title);
  return [
    text.aiThemeSummary(themeNames),
    "",
    `### ${text.aiThemeSynthesis}`,
    "",
    ...themes.flatMap((theme) => renderAiThemeSection(theme, text)),
  ].join("\n");
}

function renderAiThemeSection(
  theme: AiThemeInsight,
  text: (typeof REPORT_TEXT)[ResolvedAnnualReviewLanguage],
): string[] {
  const rows = [
    `#### ${sanitizeHeading(theme.title)}`,
    "",
    sanitizeParagraphMarkdown(theme.synthesis) || text.noDataFound,
  ];
  if (theme.connections) {
    rows.push(
      "",
      `${text.aiThemeConnections}: ${sanitizeParagraphMarkdown(theme.connections)}`,
    );
  }
  if (theme.nextQuestion) {
    rows.push(
      "",
      `${text.aiThemeNextQuestion}: ${sanitizeInlineMarkdown(theme.nextQuestion)}`,
    );
  }
  if (theme.evidenceNotes.length > 0) {
    rows.push(
      "",
      `- ${text.representativeNotes}:`,
      ...theme.evidenceNotes.map((note) => `  - ${wikiLinkPlain(note)}`),
    );
  }
  rows.push("");
  return rows;
}

function renderDailyCumulativeWordsSvg(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const width = 820;
  const height = 280;
  const left = 62;
  const right = 26;
  const top = 24;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const cumulativeDays = days.reduce<Array<DayBucket & { cumulativeWords: number }>>(
    (acc, day) => {
      const previous = acc[acc.length - 1];
      const cumulativeWords = (previous?.cumulativeWords ?? 0) + day.words;
      acc.push({ ...day, cumulativeWords });
      return acc;
    },
    [],
  );
  const maxWords = niceMax(
    Math.max(1, ...cumulativeDays.map((day) => day.cumulativeWords)),
  );
  const xScale = (index: number) =>
    left + (plotWidth * index) / Math.max(1, cumulativeDays.length - 1);
  const yScale = (value: number) => top + plotHeight - (value / maxWords) * plotHeight;
  const ticks = [0, maxWords / 2, maxWords];

  const grid = ticks
    .map((tick) => {
      const y = yScale(tick);
      return [
        `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d0d7de" stroke-width="1" />`,
        `<text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end" fill="currentColor">${Math.round(tick)}</text>`,
      ].join("\n");
    })
    .join("\n");
  const path = cumulativeDays
    .map(
      (day, index) =>
        `${index === 0 ? "M" : "L"} ${formatNumber(xScale(index))} ${formatNumber(yScale(day.cumulativeWords))}`,
    )
    .join(" ");
  const monthLabels = cumulativeDays
    .filter((day, index) => index === 0 || day.dayOfMonth === 1)
    .map((day, index) => {
      const dayIndex = cumulativeDays.indexOf(day);
      const anchor = index === 0 ? "start" : "middle";
      return `<text x="${formatNumber(xScale(dayIndex))}" y="${height - 20}" font-size="10" text-anchor="${anchor}" fill="currentColor">${escapeHtml(day.month.slice(5))}</text>`;
    })
    .join("\n");

  return [
    `<svg class="annual-review-chart annual-review-daily-cumulative" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.dailyCumulativeGrowth)}">`,
    `<title>${escapeHtml(text.dailyCumulativeGrowth)}</title>`,
    grid,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<text x="18" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" fill="currentColor" transform="rotate(-90 18 ${top + plotHeight / 2})">${escapeHtml(text.dailyCumulativeWords)}</text>`,
    `<path d="${path}" fill="none" stroke="#4f7cac" stroke-width="3" stroke-linejoin="round" />`,
    ...cumulativeDays.map((day, index) => {
      const title = `${day.date}: ${day.cumulativeWords} ${text.cumulativeWords}`;
      return `<circle cx="${formatNumber(xScale(index))}" cy="${formatNumber(yScale(day.cumulativeWords))}" r="2.6" fill="#4f7cac"><title>${escapeHtml(title)}</title></circle>`;
    }),
    monthLabels,
    "</svg>",
  ].join("\n");
}

function renderDailyHeatmapSvg(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
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
  const weekdayLabels =
    language === "zh"
      ? ["日", "一", "二", "三", "四", "五", "六"]
      : ["S", "M", "T", "W", "T", "F", "S"];

  const monthLabels = firstMonthDays
    .map(
      (day) =>
        `<text x="${left + day.week * (cell + gap)}" y="14" font-size="10" fill="currentColor">${escapeHtml(day.month.slice(5))}</text>`,
    )
    .join("\n");
  const weekdays = weekdayLabels
    .map(
      (label, index) =>
        `<text x="8" y="${top + index * (cell + gap) + 9}" font-size="9" fill="currentColor">${escapeHtml(label)}</text>`,
    )
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

function renderMonthlyCreatedNotesSvg(
  months: MonthBucket[],
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const width = 760;
  const height = 280;
  const left = 58;
  const right = 22;
  const top = 20;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxGrowth = niceMax(Math.max(1, ...months.map((bucket) => bucket.created)));
  const ticks = [0, maxGrowth / 2, maxGrowth];
  const barGap = 8;
  const barWidth = Math.max(
    16,
    (plotWidth - barGap * Math.max(0, months.length - 1)) / Math.max(1, months.length),
  );
  const xScale = (index: number) => left + index * (barWidth + barGap);
  const yScale = (value: number) => (value / maxGrowth) * plotHeight;

  const grid = ticks
    .map((tick) => {
      const y = top + plotHeight - (tick / maxGrowth) * plotHeight;
      return [
        `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d0d7de" stroke-width="1" />`,
        `<text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end" fill="currentColor">${Math.round(tick)}</text>`,
      ].join("\n");
    })
    .join("\n");

  const bars = months
    .map((bucket, index) => {
      const label = bucket.month.slice(5);
      const value = bucket.created;
      const barHeight = yScale(value);
      const x = xScale(index);
      const y = top + plotHeight - barHeight;
      const title = `${bucket.month}: ${value} ${text.wordGrowth}`;
      return [
        value > 0
          ? `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(barWidth)}" height="${formatNumber(barHeight)}" rx="3" fill="#b95e43"><title>${escapeHtml(title)}</title></rect>`
          : "",
        `<text x="${formatNumber(x + barWidth / 2)}" y="${height - 24}" font-size="10" text-anchor="middle" fill="currentColor">${escapeHtml(label)}</text>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    `<svg class="annual-review-chart annual-review-growth" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(text.wordGrowthTrend)}">`,
    `<title>${escapeHtml(text.wordGrowthTrend)}</title>`,
    `<desc>${escapeHtml(text.wordGrowthYAxis)}</desc>`,
    grid,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a" stroke-width="1" />`,
    `<text x="16" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" fill="currentColor" transform="rotate(-90 16 ${top + plotHeight / 2})">${escapeHtml(text.wordGrowth)}</text>`,
    bars,
    "</svg>",
  ].join("\n");
}

function renderTopicEvolutionSvg(
  data: TopicEvolutionData,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const width = 820;
  const height = 340;
  const left = 62;
  const right = 156;
  const top = 28;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const activeBuckets = data.monthlyBuckets.filter((bucket) =>
    Object.values(bucket.topics).some((words) => words > 0),
  );
  const buckets = activeBuckets.length > 0 ? activeBuckets : data.monthlyBuckets;
  const topicNames = chartTopicNames(data);
  const maxWords = niceMax(
    Math.max(1, ...buckets.map((bucket) => sumTopicWords(bucket))),
  );
  const barGap = 8;
  const barWidth = Math.max(
    12,
    (plotWidth - barGap * Math.max(0, buckets.length - 1)) / Math.max(1, buckets.length),
  );
  const yScale = (words: number) => (words / maxWords) * plotHeight;
  const colors = topicNames.map(
    (name, index) =>
      [name, TOPIC_COLORS[index % TOPIC_COLORS.length] ?? TOPIC_COLORS[0]] as const,
  );
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
  return (
    folder
      .trim()
      .replace(/^\/+|\/+$/gu, "")
      .replace(/\/{2,}/gu, "/") || "Annual Reviews"
  );
}

function heatColor(words: number, maxWords: number): string {
  if (words <= 0) {
    return "#ebedf0";
  }
  const colors = ["#9be9a8", "#40c463", "#30a14e", "#216e39"];
  const index = Math.min(
    colors.length - 1,
    Math.ceil((words / maxWords) * colors.length) - 1,
  );
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
  const body = softenFormulaicContrast(markdown)
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

function sanitizeParagraphMarkdown(markdown?: string): string {
  if (!markdown) {
    return "";
  }
  return softenFormulaicContrast(markdown)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 900);
}

function softenFormulaicContrast(markdown: string): string {
  return markdown
    .replace(/不再只是[^，。；]+，而是/gu, "更具体地说，是")
    .replace(/并不只是[^，。；]+，而是/gu, "更关键的是")
    .replace(/并不只是/gu, "除了")
    .replace(/不只是[^，。；]+，而是/gu, "更关键的是")
    .replace(/不是[^，。；]+，而是/gu, "更关键的是")
    .replace(/，而不是/gu, "，避免")
    .replace(/not just [^,.;]+, but /giu, "")
    .replace(/not only [^,.;]+, but also /giu, "");
}

function sanitizeHeading(markdown?: string): string {
  return sanitizeInlineMarkdown(markdown).replace(/^#+\s*/u, "") || "Untitled";
}

function chartTopicNames(data: TopicEvolutionData): string[] {
  const names = data.topTopics.map((topic) => topic.name);
  const hasOther = data.monthlyBuckets.some((bucket) =>
    Object.prototype.hasOwnProperty.call(bucket.topics, OTHER_TOPIC),
  );
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
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  aiNotes: AiHighValueNoteInsight[] = [],
  aiEnabled = false,
  reviewSession?: ReviewSessionState,
): string {
  const text = REPORT_TEXT[language];
  if (reviewSession) {
    return renderReviewedCandidates(reviewSession, language);
  }
  if (!aiEnabled) {
    return `- ${text.noReviewedCandidates}`;
  }
  const aiNoteMap = new Map(aiNotes.map((note) => [normalizeNotePath(note.path), note]));
  const topNotes =
    aggregate.highValueNotes.length > 0
      ? aiEnabled
        ? aggregate.highValueNotes.flatMap((note) =>
            renderHighValueNoteSection(
              note,
              aiNoteMap.get(normalizeNotePath(note.path)),
              text,
            ),
          )
        : aggregate.highValueNotes.flatMap((note) =>
            renderHighValueNoteSection(note, undefined, text),
          )
      : [`- ${text.noHighValueNotes}`];
  const rows = [
    ...(aggregate.highValueNotes.length > 0
      ? [text.highValueNotesSummary(aggregate.highValueNotes.length), ""]
      : []),
    `### ${text.topHighValueNotes}`,
    "",
    ...topNotes,
  ];

  return rows.join("\n");
}

function renderReviewedCandidates(
  reviewSession: ReviewSessionState,
  language: ResolvedAnnualReviewLanguage,
): string {
  const text = REPORT_TEXT[language];
  const candidates = reportIncludedCandidates(reviewSession);
  if (candidates.length === 0) {
    return `- ${text.noReviewedCandidates}`;
  }
  return [
    `### ${text.topHighValueNotes}`,
    "",
    ...candidates.flatMap((candidate) => renderReviewedCandidate(candidate, language)),
  ].join("\n");
}

function renderReviewedCandidate(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
  const title = reviewCandidateLink(candidate);
  return [
    `- ${title} (${candidate.status})${reviewCandidateEvidenceSuffix(candidate, language)}`,
  ];
}

function reviewCandidateEvidenceSuffix(
  candidate: ReviewCandidate,
  language: ResolvedAnnualReviewLanguage,
): string {
  const evidence = candidate.evidence
    .filter((item) => !item.missing)
    .slice(0, 4)
    .map((item) => item.sourcePath || item.target)
    .filter(Boolean);

  if (evidence.length === 0) {
    return "";
  }

  return ` - ${REPORT_TEXT[language].highValueEvidence}: ${evidence.map(wikiLinkPlain).join(", ")}`;
}

function reportIncludedCandidates(reviewSession: ReviewSessionState): ReviewCandidate[] {
  return reviewSession.candidates.filter((candidate) => {
    if (candidate.status === "ignored" || candidate.status === "merged") {
      return false;
    }
    return candidate.status === "accepted" || candidate.status === "renamed";
  });
}

function reviewCandidateLink(candidate: ReviewCandidate): string {
  const title = reviewCandidateDisplayTitle(candidate.title, candidate.userTitle);
  const path = candidate.sourcePaths[0];
  return path ? wikiLink(path, title) : sanitizeHeading(title);
}

function renderHighValueNoteSection(
  note: HighValueNote,
  aiNote?: AiHighValueNoteInsight,
  text?: (typeof REPORT_TEXT)[ResolvedAnnualReviewLanguage],
): string[] {
  const labels = text ?? REPORT_TEXT.en;
  const traceableReasons = note.reasons.filter(reasonHasEvidence);
  const reason = sanitizeParagraphMarkdown(aiNote?.reason || note.reason);
  const action = sanitizeInlineMarkdown(aiNote?.suggestedAction || note.suggestedAction);
  if (traceableReasons.length === 0) {
    return [
      `#### ${wikiLink(note.path, note.title)}`,
      "",
      `${labels.highValueType}: ${note.suggestionLabel}。${labels.highValueNoAuditableEvidence}`,
      "",
    ];
  }
  return [
    `#### ${wikiLink(note.path, note.title)}`,
    "",
    `${labels.highValueType}: ${note.suggestionLabel}。${labels.highValueReason}: ${reason}`,
    "",
    `${labels.highValueReasonList}:`,
    ...traceableReasons.flatMap((candidateReason) =>
      renderExplanationReason(candidateReason, labels),
    ),
    "",
    `${labels.suggestedAction}: ${action}`,
    "",
  ];
}

function renderExplanationReason(
  reason: ExplanationReason,
  labels: (typeof REPORT_TEXT)[ResolvedAnnualReviewLanguage],
): string[] {
  const evidence = [
    reason.sourcePath
      ? `${labels.highValueSourceNote}: ${wikiLinkPlain(reason.sourcePath)}`
      : "",
    reason.relatedPaths && reason.relatedPaths.length > 0
      ? `${labels.highValueRelatedNotes}: ${reason.relatedPaths.map(wikiLinkPlain).join(", ")}`
      : "",
    reason.statField ? `${labels.highValueStatField}: \`${reason.statField}\`` : "",
  ].filter(Boolean);
  return [
    `- ${sanitizeInlineMarkdown(reason.label)}`,
    `  - ${labels.highValueEvidence}: ${evidence.join("; ")}`,
  ];
}

function reasonHasEvidence(reason: ExplanationReason): boolean {
  return Boolean(
    reason.sourcePath ||
    reason.statField ||
    (reason.relatedPaths && reason.relatedPaths.length > 0),
  );
}

function renderHighValueFeedback(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
): string[] {
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
  return notes
    .map((note) => `- ${wikiLink(note.path, note.title)}: ${note.suggestedAction}`)
    .join("\n");
}

function renderNextPeriodActions(
  aggregate: YearAggregate,
  language: ResolvedAnnualReviewLanguage,
  aiActions: string[] = [],
  aiThemes: AiThemeInsight[] = [],
  reviewSession?: ReviewSessionState,
): string {
  if (aiActions.length > 0) {
    return aiActions.map((action) => `- ${action}`).join("\n");
  }
  const text = REPORT_TEXT[language];
  const topTopic =
    aiThemes[0]?.title ||
    aggregate.topicEvolution.topTopics[0]?.name ||
    (language === "zh" ? "增长最快主题" : "the fastest-growing topic");
  const highValueFocus = reviewSession
    ? reportIncludedCandidates(reviewSession).slice(0, 2).map(reviewCandidateLink)
    : [];
  return [
    `- ${text.mocAction(topTopic)}`,
    `- ${aggregate.isolatedPotentialNotes.length > 0 ? text.isolatedNotesAction(aggregate.isolatedPotentialNotes.length) : text.noIsolatedNotesAction}`,
    `- ${highValueFocus.length > 0 ? text.highValuePushAction(formatInlineList(highValueFocus, language)) : text.noHighValuePushAction}`,
  ].join("\n");
}

function renderNoteList(
  notes: RankedNote[],
  language: ResolvedAnnualReviewLanguage,
): string {
  if (notes.length === 0) {
    return `- ${REPORT_TEXT[language].noRepresentativeNotes}`;
  }
  return notes
    .map(
      (note) =>
        `- ${wikiLink(note.path, note.title)} (${REPORT_TEXT[language].noteStats(note.words, note.characters)})`,
    )
    .join("\n");
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

function hasMonthData(month: MonthBucket): boolean {
  return (
    month.created > 0 || month.modified > 0 || month.words > 0 || month.characters > 0
  );
}

function activePeriodMonths(months: MonthBucket[]): MonthBucket[] {
  const lastActiveIndex = lastIndexOf(months, hasMonthData);
  return lastActiveIndex >= 0 ? months.slice(0, lastActiveIndex + 1) : [];
}

function activePeriodDays(days: DayBucket[]): DayBucket[] {
  const lastActiveIndex = lastIndexOf(days, hasDayData);
  return lastActiveIndex >= 0 ? days.slice(0, lastActiveIndex + 1) : [];
}

function hasDayData(day: DayBucket): boolean {
  return day.created > 0 || day.modified > 0 || day.words > 0 || day.characters > 0;
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) {
      return index;
    }
  }
  return -1;
}

function wikiLink(path: string, title: string): string {
  return `[[${path.replace(/\.md$/u, "")}|${title}]]`;
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
