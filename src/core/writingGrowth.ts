export type WritingGrowthPeriod = "year" | "month" | "custom";

export interface WritingGrowthSnapshotFile {
  words: number;
}

export interface WritingGrowthSnapshot {
  date: string;
  files: Record<string, WritingGrowthSnapshotFile | number>;
}

export interface WritingGrowthOptions {
  period: WritingGrowthPeriod;
  year?: number;
  month?: string;
  startDate?: string;
  endDate?: string;
  writingDayThreshold?: number;
  chartPaths?: Partial<Record<WritingGrowthChartKind, string>>;
}

export type WritingGrowthChartKind =
  | "word-growth"
  | "monthly-word-growth"
  | "writing-heatmap";

export interface WritingGrowthDaily {
  date: string;
  addedWords: number;
  cumulativeWords: number;
  mainFiles: string[];
}

export interface WritingGrowthMonth {
  month: string;
  addedWords: number;
  cumulativeWords: number;
}

export interface WritingGrowthTopDay {
  date: string;
  added_words: number;
  main_files: string[];
}

export interface WritingGrowthFeedback {
  strength: string;
  risk: string;
  suggestion: string;
}

export interface WritingGrowthSummary {
  total_added_words: number;
  writing_days: number;
  longest_streak: number;
  current_streak: number;
  peak_month: string | null;
  top_days: WritingGrowthTopDay[];
  baseline_only: boolean;
  baseline_message?: string;
}

export interface WritingGrowthReport {
  period: {
    type: WritingGrowthPeriod;
    startDate: string;
    endDate: string;
  };
  summary: WritingGrowthSummary;
  daily: WritingGrowthDaily[];
  monthly: WritingGrowthMonth[];
  feedback: WritingGrowthFeedback;
  markdown: string;
  chartAssets: Array<{
    kind: WritingGrowthChartKind;
    path: string;
    content: string;
  }>;
}

interface NormalizedSnapshot {
  date: string;
  files: Record<string, number>;
  totalWords: number;
}

const DEFAULT_THRESHOLD = 50;
const BASELINE_MESSAGE = "从本次开始记录，下一次运行后将开始计算准确增长。";

export function countWritingWords(markdown: string): number {
  const text = cleanMarkdownForWritingCount(markdown);
  let words = 0;
  const withoutLatin = text.replace(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu, (match) => {
    if (containsCjk(match)) {
      return match;
    }
    words += 1;
    return " ";
  });

  for (const char of withoutLatin) {
    if (
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
        char,
      )
    ) {
      words += 1;
    }
  }
  return words;
}

export function cleanMarkdownForWritingCount(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, " ")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/~~~[\s\S]*?~~~/gu, " ")
    .replace(/`[^`\n]*`/gu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/!\[\[[^\]]+\]\]/gu, " ")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu, "$2 $1")
    .replace(/!\[[^\]]*\]\([^)]+\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, " ")
    .replace(/^\s{0,3}>\s?/gmu, " ")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gmu, " ")
    .replace(/^\s*[-*+]\s+/gmu, " ")
    .replace(/^\s*\d+[.)]\s+/gmu, " ")
    .replace(/[*_~=#>|()[\]{}]/gu, " ");
}

export function buildWritingGrowthReport(
  snapshots: WritingGrowthSnapshot[],
  options: WritingGrowthOptions,
): WritingGrowthReport {
  const period = resolvePeriod(options);
  const threshold = options.writingDayThreshold ?? DEFAULT_THRESHOLD;
  const normalized = normalizeSnapshots(snapshots).filter(
    (snapshot) => snapshot.date <= period.endDate,
  );
  const days = enumerateDates(period.startDate, period.endDate);
  const snapshotsByDate = new Map(
    normalized.map((snapshot) => [snapshot.date, snapshot]),
  );
  const previousSnapshot = [...normalized]
    .reverse()
    .find((snapshot) => snapshot.date < period.startDate);
  const inPeriodSnapshots = normalized.filter(
    (snapshot) => snapshot.date >= period.startDate && snapshot.date <= period.endDate,
  );
  const baselineOnly =
    normalized.length <= 1 || (inPeriodSnapshots.length <= 1 && !previousSnapshot);

  let previous = previousSnapshot ?? inPeriodSnapshots[0];
  let cumulativeWords = 0;
  const daily: WritingGrowthDaily[] = [];

  for (const date of days) {
    const snapshot = snapshotsByDate.get(date);
    let addedWords = 0;
    let mainFiles: string[] = [];
    if (snapshot && previous && snapshot !== previous) {
      const fileGrowth = calculateFileGrowth(previous, snapshot);
      addedWords = fileGrowth.reduce((sum, file) => sum + file.addedWords, 0);
      mainFiles = fileGrowth.slice(0, 3).map((file) => file.path);
      previous = snapshot;
    } else if (snapshot && !previous) {
      previous = snapshot;
    }

    cumulativeWords += addedWords;
    daily.push({ date, addedWords, cumulativeWords, mainFiles });
  }

  const monthly = buildMonthlyGrowth(daily);
  const writingDays = daily.filter((day) => day.addedWords >= threshold).length;
  const activeMonths = monthly.filter((month) => month.addedWords > 0);
  const summary: WritingGrowthSummary = {
    total_added_words: daily.reduce((sum, day) => sum + day.addedWords, 0),
    writing_days: writingDays,
    longest_streak: longestWritingStreak(daily, threshold),
    current_streak: currentWritingStreak(daily, threshold),
    peak_month:
      activeMonths.length > 0
        ? ([...activeMonths].sort(
            (a, b) => b.addedWords - a.addedWords || a.month.localeCompare(b.month),
          )[0]?.month ?? null)
        : null,
    top_days: daily
      .filter((day) => day.addedWords > 0)
      .sort((a, b) => b.addedWords - a.addedWords || a.date.localeCompare(b.date))
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        added_words: day.addedWords,
        main_files: day.mainFiles,
      })),
    baseline_only: baselineOnly,
    ...(baselineOnly ? { baseline_message: BASELINE_MESSAGE } : {}),
  };
  const feedback = buildWritingGrowthFeedback(summary, daily.length);
  const chartPaths = options.chartPaths ?? buildWritingGrowthChartPaths(period.startDate);
  const chartAssets = buildWritingGrowthChartAssets(daily, monthly, chartPaths);
  const markdown = renderWritingGrowthMarkdown(summary, feedback, chartPaths);

  return {
    period,
    summary,
    daily,
    monthly,
    feedback,
    markdown,
    chartAssets,
  };
}

export function buildWritingGrowthChartPaths(
  periodStartDate: string,
): Record<WritingGrowthChartKind, string> {
  const prefix = periodStartDate.slice(0, 7).endsWith("-01")
    ? periodStartDate.slice(0, 4)
    : periodStartDate.slice(0, 7);
  return {
    "word-growth": `${prefix}-word-growth.svg`,
    "monthly-word-growth": `${prefix}-monthly-word-growth.svg`,
    "writing-heatmap": `${prefix}-writing-heatmap.svg`,
  };
}

export function buildWritingGrowthChartAssets(
  daily: WritingGrowthDaily[],
  monthly: WritingGrowthMonth[],
  chartPaths: Partial<Record<WritingGrowthChartKind, string>>,
): WritingGrowthReport["chartAssets"] {
  return [
    chartPaths["word-growth"]
      ? {
          kind: "word-growth" as const,
          path: chartPaths["word-growth"],
          content: renderDailyCumulativeSvg(daily),
        }
      : undefined,
    chartPaths["monthly-word-growth"]
      ? {
          kind: "monthly-word-growth" as const,
          path: chartPaths["monthly-word-growth"],
          content: renderMonthlyAddedSvg(monthly),
        }
      : undefined,
    chartPaths["writing-heatmap"]
      ? {
          kind: "writing-heatmap" as const,
          path: chartPaths["writing-heatmap"],
          content: renderWritingHeatmapSvg(daily),
        }
      : undefined,
  ].filter((asset): asset is WritingGrowthReport["chartAssets"][number] =>
    Boolean(asset),
  );
}

export function renderWritingGrowthMarkdown(
  summary: WritingGrowthSummary,
  feedback: WritingGrowthFeedback,
  chartPaths: Partial<Record<WritingGrowthChartKind, string>>,
): string {
  const lines = [
    "## 写作增长",
    "",
    summary.baseline_only
      ? `${summary.baseline_message ?? BASELINE_MESSAGE}`
      : `本期新增字数 ${formatInteger(summary.total_added_words)}，写作天数 ${summary.writing_days} 天，最长连续写作 ${summary.longest_streak} 天。`,
    "",
  ];

  for (const kind of ["word-growth", "monthly-word-growth", "writing-heatmap"] as const) {
    const path = chartPaths[kind];
    if (path) {
      lines.push(`![[${path}]]`);
    }
  }

  lines.push(
    "",
    "### 反馈信号",
    "",
    `- 做得好的地方：${feedback.strength}`,
    `- 需要关注的地方：${feedback.risk}`,
    `- 下期建议：${feedback.suggestion}`,
    "",
  );
  return lines.join("\n");
}

function normalizeSnapshots(snapshots: WritingGrowthSnapshot[]): NormalizedSnapshot[] {
  const byDate = new Map<string, NormalizedSnapshot>();
  for (const snapshot of snapshots) {
    if (!isDateKey(snapshot.date)) {
      continue;
    }
    const files = Object.fromEntries(
      Object.entries(snapshot.files)
        .map(
          ([path, value]) =>
            [path, typeof value === "number" ? value : value.words] as const,
        )
        .filter(([, words]) => Number.isFinite(words) && words >= 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    byDate.set(snapshot.date, {
      date: snapshot.date,
      files,
      totalWords: Object.values(files).reduce((sum, words) => sum + words, 0),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function resolvePeriod(options: WritingGrowthOptions): WritingGrowthReport["period"] {
  if (options.period === "year") {
    const year = options.year ?? Number(options.startDate?.slice(0, 4));
    if (!Number.isInteger(year) || year < 1000) {
      throw new Error("Year period requires a valid year.");
    }
    return { type: "year", startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (options.period === "month") {
    const month = options.month ?? options.startDate?.slice(0, 7);
    if (!month || !/^\d{4}-\d{2}$/u.test(month)) {
      throw new Error("Month period requires YYYY-MM.");
    }
    const [yearPart = "0", monthPart = "1"] = month.split("-");
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return {
      type: "month",
      startDate: `${month}-01`,
      endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (
    !options.startDate ||
    !options.endDate ||
    !isDateKey(options.startDate) ||
    !isDateKey(options.endDate) ||
    options.startDate > options.endDate
  ) {
    throw new Error("Custom period requires valid startDate and endDate.");
  }
  return { type: "custom", startDate: options.startDate, endDate: options.endDate };
}

function calculateFileGrowth(
  previous: NormalizedSnapshot,
  current: NormalizedSnapshot,
): Array<{ path: string; addedWords: number }> {
  const paths = new Set([...Object.keys(previous.files), ...Object.keys(current.files)]);
  return [...paths]
    .map((path) => ({
      path,
      addedWords: Math.max(0, (current.files[path] ?? 0) - (previous.files[path] ?? 0)),
    }))
    .filter((file) => file.addedWords > 0)
    .sort((a, b) => b.addedWords - a.addedWords || a.path.localeCompare(b.path));
}

function buildMonthlyGrowth(daily: WritingGrowthDaily[]): WritingGrowthMonth[] {
  const months = new Map<string, WritingGrowthMonth>();
  for (const day of daily) {
    const month = day.date.slice(0, 7);
    const bucket = months.get(month) ?? { month, addedWords: 0, cumulativeWords: 0 };
    bucket.addedWords += day.addedWords;
    months.set(month, bucket);
  }

  let cumulative = 0;
  return [...months.values()].map((month) => {
    cumulative += month.addedWords;
    return { ...month, cumulativeWords: cumulative };
  });
}

function buildWritingGrowthFeedback(
  summary: WritingGrowthSummary,
  periodDays: number,
): WritingGrowthFeedback {
  if (summary.baseline_only) {
    return {
      strength: "已建立当前字数基线。",
      risk: "历史增长不足，暂时无法判断节奏稳定性。",
      suggestion: "保持定期运行，积累至少两次快照后再观察趋势。",
    };
  }

  const writingRatio = periodDays > 0 ? summary.writing_days / periodDays : 0;
  const topShare =
    summary.total_added_words > 0
      ? summary.top_days.reduce((sum, day) => sum + day.added_words, 0) /
        summary.total_added_words
      : 0;
  return {
    strength:
      writingRatio >= 0.45 || summary.longest_streak >= 14
        ? `本期写作天数较多，最长连续写作达到 ${summary.longest_streak} 天，说明记录习惯较稳定。`
        : `本期已经形成 ${summary.writing_days} 个写作日，最长连续写作 ${summary.longest_streak} 天。`,
    risk:
      topShare >= 0.45
        ? "新增字数主要集中在少数几天，说明写作节奏仍有波动。"
        : "整体没有明显依赖少数高产日，但仍需要关注低产间隔。",
    suggestion:
      summary.current_streak > 0
        ? "下期优先延续当前连续写作节奏，减少长时间中断。"
        : "下期优先保持每周稳定写作，而不是追求单日高产。",
  };
}

function longestWritingStreak(daily: WritingGrowthDaily[], threshold: number): number {
  let best = 0;
  let current = 0;
  for (const day of daily) {
    current = day.addedWords >= threshold ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function currentWritingStreak(daily: WritingGrowthDaily[], threshold: number): number {
  let streak = 0;
  for (let index = daily.length - 1; index >= 0; index -= 1) {
    if ((daily[index]?.addedWords ?? 0) < threshold) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (
    let current = localDate(startDate);
    current <= localDate(endDate);
    current = addDays(current, 1)
  ) {
    dates.push(dateKey(current));
  }
  return dates;
}

function localDate(date: string): Date {
  const [year = "0", month = "1", day = "1"] = date.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function containsCjk(value: string): boolean {
  return Array.from(value).some((char) =>
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char),
  );
}

function renderDailyCumulativeSvg(daily: WritingGrowthDaily[]): string {
  const width = 760;
  const height = 280;
  const left = 60;
  const right = 24;
  const top = 22;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = niceMax(Math.max(1, ...daily.map((day) => day.cumulativeWords)));
  const xScale = (index: number) =>
    left + (plotWidth * index) / Math.max(1, daily.length - 1);
  const yScale = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
  const path = daily
    .map(
      (day, index) =>
        `${index === 0 ? "M" : "L"} ${formatNumber(xScale(index))} ${formatNumber(yScale(day.cumulativeWords))}`,
    )
    .join(" ");
  const ticks = [0, maxValue / 2, maxValue].map((tick) => {
    const y = yScale(tick);
    return `<line x1="${left}" y1="${formatNumber(y)}" x2="${width - right}" y2="${formatNumber(y)}" stroke="#d8dee4"/><text x="${left - 8}" y="${formatNumber(y + 4)}" font-size="10" text-anchor="end">${Math.round(tick)}</text>`;
  });
  const labels = pickDateLabels(daily).map(({ day, index }) => {
    const x = xScale(index);
    return `<text x="${formatNumber(x)}" y="${height - 20}" font-size="10" text-anchor="middle">${escapeHtml(day.date.slice(5))}</text>`;
  });
  return [
    `<svg class="writing-growth-chart writing-growth-cumulative" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="每日累计新增字数">`,
    "<title>每日累计新增字数</title>",
    ...ticks,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a"/>`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a"/>`,
    `<path d="${path}" fill="none" stroke="#2f6f73" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...labels,
    "</svg>",
  ].join("\n");
}

function renderMonthlyAddedSvg(monthly: WritingGrowthMonth[]): string {
  const width = 760;
  const height = 280;
  const left = 54;
  const right = 24;
  const top = 22;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = niceMax(Math.max(1, ...monthly.map((month) => month.addedWords)));
  const barGap = 8;
  const barWidth = Math.max(
    10,
    (plotWidth - barGap * Math.max(0, monthly.length - 1)) / Math.max(1, monthly.length),
  );
  const bars = monthly.map((month, index) => {
    const heightValue = (month.addedWords / maxValue) * plotHeight;
    const x = left + index * (barWidth + barGap);
    const y = top + plotHeight - heightValue;
    return [
      `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(barWidth)}" height="${formatNumber(heightValue)}" rx="3" fill="#b95e43"><title>${escapeHtml(`${month.month}: ${month.addedWords}`)}</title></rect>`,
      `<text x="${formatNumber(x + barWidth / 2)}" y="${height - 20}" font-size="10" text-anchor="middle">${escapeHtml(month.month.slice(5))}</text>`,
    ].join("\n");
  });
  return [
    `<svg class="writing-growth-chart writing-growth-monthly" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="月度新增字数">`,
    "<title>月度新增字数</title>",
    `<text x="18" y="${top + plotHeight / 2}" font-size="11" text-anchor="middle" transform="rotate(-90 18 ${top + plotHeight / 2})">新增字数</text>`,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#57606a"/>`,
    `<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#57606a"/>`,
    ...bars,
    "</svg>",
  ].join("\n");
}

function renderWritingHeatmapSvg(daily: WritingGrowthDaily[]): string {
  const cell = 10;
  const gap = 3;
  const left = 34;
  const top = 26;
  const startWeekday = daily[0] ? localDate(daily[0].date).getDay() : 0;
  const maxWeek = Math.max(
    0,
    ...daily.map((_, index) => Math.floor((index + startWeekday) / 7)),
  );
  const width = left + (maxWeek + 1) * (cell + gap) + 24;
  const height = top + 7 * (cell + gap) + 30;
  const maxWords = Math.max(1, ...daily.map((day) => day.addedWords));
  const cells = daily
    .map((day, index) => {
      const weekday = localDate(day.date).getDay();
      const week = Math.floor((index + startWeekday) / 7);
      const x = left + week * (cell + gap);
      const y = top + weekday * (cell + gap);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(day.addedWords, maxWords)}"><title>${escapeHtml(`${day.date}: ${day.addedWords}`)}</title></rect>`;
    })
    .join("\n");
  return [
    `<svg class="writing-growth-chart writing-growth-heatmap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="写作热力图">`,
    "<title>写作热力图</title>",
    cells,
    "</svg>",
  ].join("\n");
}

function pickDateLabels(
  daily: WritingGrowthDaily[],
): Array<{ day: WritingGrowthDaily; index: number }> {
  if (daily.length <= 2) {
    return daily.map((day, index) => ({ day, index }));
  }
  const labels: Array<{ day: WritingGrowthDaily; index: number }> = [];
  for (let index = 0; index < daily.length; index += 1) {
    const day = daily[index];
    if (day && (day.date.endsWith("-01") || index === daily.length - 1)) {
      labels.push({ day, index });
    }
  }
  return labels;
}

function heatColor(words: number, maxWords: number): string {
  if (words <= 0) return "#ebedf0";
  const colors = ["#b7e4c7", "#74c69d", "#2d6a4f", "#1b4332"];
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
