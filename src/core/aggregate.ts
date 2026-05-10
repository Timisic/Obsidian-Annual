import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { buildHighValueNoteInsights } from "./highValueNotes";
import {
  buildAnnualReviewSession,
  reviewSessionContainsDate,
  reviewSessionDayKeys,
  reviewSessionMonthKeys,
  reviewSessionYear,
} from "./reviewSession";
import { createSnapshotScope } from "./snapshot";
import { buildTopicEvolution } from "./topics";
import type {
  AnnualReviewSettings,
  DayBucket,
  MonthBucket,
  NoteStats,
  RankedMetric,
  RankedNote,
  ReportScope,
  ReviewSession,
  SnapshotComparison,
  SourceFile,
  WordGrowthBucket,
  YearAggregate,
} from "./types";

interface BuildYearAggregateOptions {
  snapshotComparison?: SnapshotComparison;
}

export function buildYearAggregate(
  files: SourceFile[],
  year: number,
  settings: AnnualReviewSettings,
  options: BuildYearAggregateOptions = {},
): YearAggregate {
  return buildReviewAggregate(
    files,
    buildAnnualReviewSession(year, settings),
    settings,
    options,
  );
}

export function buildReviewAggregate(
  files: SourceFile[],
  session: ReviewSession,
  settings: AnnualReviewSettings,
  options: BuildYearAggregateOptions = {},
): YearAggregate {
  const notes = files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => extractNoteStats(file, settings))
    .filter((note) => isActiveInSession(note, session));
  const activityDateSources = {
    frontmatter: 0,
    path: 0,
    filesystem: 0,
  };

  const year = reviewSessionYear(session);
  const months = createMonthBuckets(session);
  const days = createDayBuckets(session);
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
    const createdTime = activityCreatedTime(note);
    const modifiedTime = activityModifiedTime(note);
    activityDateSources[note.noteDate?.source ?? "filesystem"] += 1;
    const createdInSession = reviewSessionContainsDate(session, createdTime);
    const modifiedInSession = reviewSessionContainsDate(session, modifiedTime);
    if (createdInSession) {
      createdCount += 1;
      activeDates.add(dateKey(createdTime));
      addToMonth(months, createdTime, "created", note, true);
      addToDay(days, createdTime, "created", note, true);
      updateRepresentative(representativeByMonth, monthKey(createdTime), note);
    }
    if (modifiedInSession) {
      modifiedCount += 1;
      activeDates.add(dateKey(modifiedTime));
      addToMonth(months, modifiedTime, "modified", note, false);
      addToDay(days, modifiedTime, "modified", note, false);
      if (!createdInSession) {
        updateRepresentative(representativeByMonth, monthKey(modifiedTime), note);
      }
    }

    if (createdInSession) {
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
    preset: session.preset,
    label: session.label,
    startDate: session.startDate,
    endDate: session.endDate,
    reportFolder: settings.reportFolder,
    includeFolders: settings.includeFolders,
    excludeFolders: settings.excludeFolders,
    excludePatterns: settings.excludePatterns,
    privacyMode: settings.privacyMode,
  };
  const generatedAt = new Date().toISOString();
  const highValueInsights = buildHighValueNoteInsights(notes, year, generatedAt);
  const snapshotComparison =
    options.snapshotComparison ??
    buildCurrentVaultInference(totalWords, notes.length, settings, generatedAt);

  return {
    year,
    session,
    generatedAt,
    scope,
    snapshotComparison,
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
    activityDateSources,
    topTags: rankedMetrics(tagCounts),
    topFolders: rankedMetrics(folderCounts),
    topLinks: rankedMetrics(linkCounts),
    topNotes: notes.map(toRankedNote).sort(sortRankedNotes).slice(0, 10),
    representativeNotes: [...representativeByMonth.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    topicEvolution: buildTopicEvolution(notes, session),
    ...highValueInsights,
  };
}

function buildCurrentVaultInference(
  totalWords: number,
  noteCount: number,
  settings: AnnualReviewSettings,
  capturedAt: string,
): SnapshotComparison {
  return {
    source: "current-vault-inference",
    currentCapturedAt: capturedAt,
    baselineTotalWords: 0,
    currentTotalWords: totalWords,
    wordDelta: totalWords,
    noteCountDelta: noteCount,
    addedNotes: [],
    removedNotes: [],
    changedNotes: [],
    scope: createSnapshotScope(settings),
  };
}

function isActiveInSession(note: NoteStats, session: ReviewSession): boolean {
  return (
    reviewSessionContainsDate(session, activityCreatedTime(note)) ||
    reviewSessionContainsDate(session, activityModifiedTime(note))
  );
}

function activityCreatedTime(note: NoteStats): number {
  return note.noteDate?.timestamp ?? note.ctime;
}

function activityModifiedTime(note: NoteStats): number {
  return note.noteDate?.timestamp ?? note.mtime;
}

function createMonthBuckets(session: ReviewSession): MonthBucket[] {
  return reviewSessionMonthKeys(session).map((month) => ({
    month,
    created: 0,
    modified: 0,
    words: 0,
    characters: 0,
    tasks: 0,
    completedTasks: 0,
  }));
}

function createDayBuckets(session: ReviewSession): DayBucket[] {
  const dayKeys = reviewSessionDayKeys(session);
  const start = new Date(localDateTime(session.startDate));
  const firstWeekday = start.getDay();
  return dayKeys.map((date, index) => {
    const current = new Date(localDateTime(date));
    return {
      date,
      month: monthKey(current.getTime()),
      dayOfMonth: current.getDate(),
      weekday: current.getDay(),
      week: Math.floor((index + firstWeekday) / 7),
      created: 0,
      modified: 0,
      words: 0,
      characters: 0,
    };
  });
}

function addToMonth(
  months: MonthBucket[],
  timestamp: number,
  field: "created" | "modified",
  note: NoteStats,
  includeContent: boolean,
): void {
  const key = monthKey(timestamp);
  const bucket = months.find((month) => month.month === key);
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
