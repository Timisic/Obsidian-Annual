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
}

export interface GenerateReportOptions {
  year: number;
  settings: AnnualReviewSettings;
}
