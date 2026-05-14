import type {
  DayBucket,
  MonthBucket,
  ResolvedAnnualReviewLanguage,
  TopicEvolutionData,
  TopicMonthlyBucket,
} from "./types";

export interface ChartLabels {
  dailyCumulativeGrowth: string;
  dailyCumulativeWords: string;
  cumulativeWords: string;
  dailyWordHeatmap: string;
  dailyWordHeatmapLegend: string;
  words: string;
  created: string;
  modified: string;
  wordGrowthTrend: string;
  wordGrowthYAxis: string;
  wordGrowth: string;
  topicEvolutionChart: string;
  topicEvolutionLegend: string;
  addedWords: string;
}

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

export function renderDailyCumulativeWordsSvg(
  days: DayBucket[],
  _language: ResolvedAnnualReviewLanguage,
  text: ChartLabels,
): string {
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

export function renderDailyHeatmapSvg(
  days: DayBucket[],
  language: ResolvedAnnualReviewLanguage,
  text: ChartLabels,
): string {
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

export function renderMonthlyCreatedNotesSvg(
  months: MonthBucket[],
  _language: ResolvedAnnualReviewLanguage,
  text: ChartLabels,
): string {
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

export function renderTopicEvolutionSvg(
  data: TopicEvolutionData,
  _language: ResolvedAnnualReviewLanguage,
  text: ChartLabels,
): string {
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

export function activePeriodMonths(months: MonthBucket[]): MonthBucket[] {
  const lastActiveIndex = lastIndexOf(months, hasMonthData);
  return lastActiveIndex >= 0 ? months.slice(0, lastActiveIndex + 1) : [];
}

export function activePeriodDays(days: DayBucket[]): DayBucket[] {
  const lastActiveIndex = lastIndexOf(days, hasDayData);
  return lastActiveIndex >= 0 ? days.slice(0, lastActiveIndex + 1) : [];
}

function hasMonthData(month: MonthBucket): boolean {
  return (
    month.created > 0 || month.modified > 0 || month.words > 0 || month.characters > 0
  );
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
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
