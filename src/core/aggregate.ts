import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { buildHighValueNoteInsights } from "./highValueNotes";
import { buildTopicEvolution } from "./topics";
import type {
  AnnualReviewSettings,
  DayBucket,
  MonthBucket,
  NoteStats,
  RankedMetric,
  RankedNote,
  ReportScope,
  SourceFile,
  WordGrowthBucket,
  YearAggregate,
} from "./types";

export function buildYearAggregate(
  files: SourceFile[],
  year: number,
  settings: AnnualReviewSettings,
): YearAggregate {
  const notes = files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => extractNoteStats(file, settings))
    .filter((note) => isActiveInYear(note, year));

  const months = createMonthBuckets(year);
  const days = createDayBuckets(year);
  const activeDates = new Set<string>();
  const tagCounts = new Map<string, number>();
  const folderCounts = new Map<string, number>();
  const linkCounts = new Map<string, number>();
  const representativeByMonth = new Map<string, RankedNote>();

  let createdCount = 0;
  let modifiedCount = 0;
  let totalWords = 0;
  let totalCharacters = 0;
  let taskCount = 0;
  let completedTaskCount = 0;

  for (const note of notes) {
    const createdInYear = getYear(note.ctime) === year;
    const modifiedInYear = getYear(note.mtime) === year;
    if (createdInYear) {
      createdCount += 1;
      activeDates.add(dateKey(note.ctime));
      addToMonth(months, note.ctime, "created", note, true);
      addToDay(days, note.ctime, "created", note, true);
      updateRepresentative(representativeByMonth, monthKey(note.ctime), note);
    }
    if (modifiedInYear) {
      modifiedCount += 1;
      activeDates.add(dateKey(note.mtime));
      addToMonth(months, note.mtime, "modified", note, false);
      addToDay(days, note.mtime, "modified", note, false);
      if (!createdInYear) {
        updateRepresentative(representativeByMonth, monthKey(note.mtime), note);
      }
    }

    if (createdInYear) {
      totalWords += note.wordCount;
      totalCharacters += note.charCount;
      taskCount += note.tasks.total;
      completedTaskCount += note.tasks.completed;
    }
    increment(folderCounts, note.folder);
    note.tags.forEach((tag) => increment(tagCounts, tag));
    for (const [link, count] of Object.entries(note.linkCounts)) {
      increment(linkCounts, link, count);
    }
  }

  const scope: ReportScope = {
    year,
    includeFolders: settings.includeFolders,
    excludeFolders: settings.excludeFolders,
    privacyMode: settings.privacyMode,
  };
  const generatedAt = new Date().toISOString();
  const highValueInsights = buildHighValueNoteInsights(notes, year, generatedAt);

  return {
    year,
    generatedAt,
    scope,
    activeDays: activeDates.size,
    longestStreak: longestDateStreak([...activeDates]),
    createdCount,
    modifiedCount,
    totalWords,
    totalCharacters,
    taskCount,
    completedTaskCount,
    monthBuckets: months,
    dayBuckets: days,
    wordGrowthBuckets: buildWordGrowthBuckets(months),
    topTags: rankedMetrics(tagCounts),
    topFolders: rankedMetrics(folderCounts),
    topLinks: rankedMetrics(linkCounts),
    topNotes: notes.map(toRankedNote).sort(sortRankedNotes).slice(0, 10),
    representativeNotes: [...representativeByMonth.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    topicEvolution: buildTopicEvolution(notes, year),
    ...highValueInsights,
  };
}

function isActiveInYear(note: NoteStats, year: number): boolean {
  return getYear(note.ctime) === year || getYear(note.mtime) === year;
}

function createMonthBuckets(year: number): MonthBucket[] {
  return Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    created: 0,
    modified: 0,
    words: 0,
    characters: 0,
    tasks: 0,
    completedTasks: 0,
  }));
}

function createDayBuckets(year: number): DayBucket[] {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const firstWeekday = start.getDay();
  const days: DayBucket[] = [];

  for (
    let current = new Date(start);
    current < end;
    current.setDate(current.getDate() + 1)
  ) {
    const index = days.length;
    days.push({
      date: dateKey(current.getTime()),
      month: monthKey(current.getTime()),
      dayOfMonth: current.getDate(),
      weekday: current.getDay(),
      week: Math.floor((index + firstWeekday) / 7),
      created: 0,
      modified: 0,
      words: 0,
      characters: 0,
    });
  }

  return days;
}

function addToMonth(
  months: MonthBucket[],
  timestamp: number,
  field: "created" | "modified",
  note: NoteStats,
  includeContent: boolean,
): void {
  const bucket = months[new Date(timestamp).getMonth()];
  if (!bucket) return;
  bucket[field] += 1;
  if (includeContent) {
    bucket.words += note.wordCount;
    bucket.characters += note.charCount;
    bucket.tasks += note.tasks.total;
    bucket.completedTasks += note.tasks.completed;
  }
}

function addToDay(
  days: DayBucket[],
  timestamp: number,
  field: "created" | "modified",
  note: NoteStats,
  includeContent: boolean,
): void {
  const key = dateKey(timestamp);
  const bucket = days.find((day) => day.date === key);
  if (!bucket) return;
  bucket[field] += 1;
  if (includeContent) {
    bucket.words += note.wordCount;
    bucket.characters += note.charCount;
  }
}

function buildWordGrowthBuckets(months: MonthBucket[]): WordGrowthBucket[] {
  let cumulativeWords = 0;
  return months.map((month) => {
    cumulativeWords += month.words;
    return {
      month: month.month,
      wordsGained: month.words,
      cumulativeWords,
    };
  });
}

function updateRepresentative(
  months: Map<string, RankedNote>,
  month: string,
  note: NoteStats,
): void {
  const ranked = toRankedNote(note);
  const existing = months.get(month);
  if (!existing || sortRankedNotes(ranked, existing) < 0) {
    months.set(month, ranked);
  }
}

function toRankedNote(note: NoteStats): RankedNote {
  return {
    path: note.path,
    title: note.path.split("/").pop()?.replace(/\.md$/u, "") ?? note.path,
    words: note.wordCount,
    characters: note.charCount,
  };
}

function rankedMetrics(counts: Map<string, number>): RankedMetric[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function sortRankedNotes(a: RankedNote, b: RankedNote): number {
  return b.words - a.words || b.characters - a.characters || a.path.localeCompare(b.path);
}

function increment(counts: Map<string, number>, key: string, amount = 1): void {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

function getYear(timestamp: number): number {
  return new Date(timestamp).getFullYear();
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function longestDateStreak(dates: string[]): number {
  const sortedTimes = dates.map(localDateTime).sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  let previous: number | undefined;

  for (const time of sortedTimes) {
    if (previous === undefined || time - previous === 86_400_000) {
      current += 1;
    } else if (time !== previous) {
      current = 1;
    }
    best = Math.max(best, current);
    previous = time;
  }

  return best;
}

function localDateTime(date: string): number {
  const [year = "0", month = "1", day = "1"] = date.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}
