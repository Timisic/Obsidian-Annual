export type AnnualReviewLanguage = "system" | "zh" | "en";
export type ResolvedAnnualReviewLanguage = Exclude<AnnualReviewLanguage, "system">;

export interface AnnualReviewSettings {
  reportFolder: string;
  includeFolders: string[];
  excludeFolders: string[];
  excludePatterns: string[];
  includeTasks: boolean;
  includeLinks: boolean;
  includeFrontmatter: boolean;
  includeHeadings: boolean;
  privacyMode: "standard" | "private";
  aiProvider: "none" | "chatgpt";
  chatGptApiKey: string;
  chatGptModel: string;
  reportLanguage: AnnualReviewLanguage;
  generatorLanguage: AnnualReviewLanguage;
}

export interface ReportScope {
  year: number;
  includeFolders: string[];
  excludeFolders: string[];
  privacyMode: AnnualReviewSettings["privacyMode"];
}

export interface TaskStats {
  total: number;
  completed: number;
}

export interface NoteStats {
  path: string;
  ctime: number;
  mtime: number;
  folder: string;
  month: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
  /**
   * Ranked link metric inputs. In Obsidian runtime, keys are resolved vault paths
   * plus unresolved target text from metadataCache. Outside Obsidian, keys are
   * raw wiki-link targets parsed from Markdown.
   */
  linkCounts: LinkCounts;
  headings: string[];
  tasks: TaskStats;
  wordCount: number;
  charCount: number;
}

export interface MonthBucket {
  month: string;
  created: number;
  modified: number;
  words: number;
  characters: number;
  tasks: number;
  completedTasks: number;
}

export interface DayBucket {
  date: string;
  month: string;
  dayOfMonth: number;
  weekday: number;
  week: number;
  created: number;
  modified: number;
  words: number;
  characters: number;
}

export interface WordGrowthBucket {
  month: string;
  wordsGained: number;
  cumulativeWords: number;
}

export interface RankedMetric {
  name: string;
  count: number;
}

export interface RankedNote {
  path: string;
  title: string;
  words: number;
  characters: number;
}

export interface YearAggregate {
  year: number;
  generatedAt: string;
  scope: ReportScope;
  activeDays: number;
  longestStreak: number;
  createdCount: number;
  modifiedCount: number;
  totalWords: number;
  totalCharacters: number;
  taskCount: number;
  completedTaskCount: number;
  monthBuckets: MonthBucket[];
  dayBuckets: DayBucket[];
  wordGrowthBuckets: WordGrowthBucket[];
  topTags: RankedMetric[];
  topFolders: RankedMetric[];
  topLinks: RankedMetric[];
  topNotes: RankedNote[];
  representativeNotes: RankedNote[];
}

export interface SourceFile {
  path: string;
  ctime: number;
  mtime: number;
  content: string;
  frontmatter?: Record<string, unknown>;
  /**
   * Obsidian metadataCache.resolvedLinks[file.path]: destination vault paths
   * mapped to the number of links from this source file.
   */
  resolvedLinks?: LinkCounts;
  /**
   * Obsidian metadataCache.unresolvedLinks[file.path]: unresolved target text
   * mapped to the number of links from this source file.
   */
  unresolvedLinks?: LinkCounts;
}

/**
 * Link metric counts keyed by link identity. See NoteStats.linkCounts for the
 * runtime-specific key contract.
 */
export type LinkCounts = Record<string, number>;

export interface GenerateReportOptions {
  year: number;
  settings: AnnualReviewSettings;
}
