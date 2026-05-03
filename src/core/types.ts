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

export type TopicSource = "frontmatter" | "tag" | "folder" | "ai-cluster";

export interface NoteTopicAssignment {
  path: string;
  topics: string[];
  sources: Record<string, TopicSource>;
}

export interface TopicMonthlyBucket {
  month: string;
  topics: Record<string, number>;
}

export interface TopTopic {
  name: string;
  addedWords: number;
  newNotes: number;
  updatedNotes: number;
  representativeNotes: string[];
}

export interface TopicEvolutionData {
  topTopics: TopTopic[];
  emergingTopics: string[];
  decliningTopics: string[];
  monthlyBuckets: TopicMonthlyBucket[];
  noteAssignments: NoteTopicAssignment[];
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

export type SuggestedNoteAction = "继续扩展" | "整理成文章" | "建立 MOC" | "补充链接" | "更新旧内容" | "判断是否归档";

export type HighValueNoteKind = "核心笔记" | "活跃笔记" | "桥接笔记" | "输出候选" | "需维护" | "孤立潜力";

export interface HighValueNote {
  path: string;
  title: string;
  kind: HighValueNoteKind;
  reason: string;
  suggestedAction: SuggestedNoteAction;
  inboundLinks: number;
  outboundLinks: number;
  topics: string[];
  lastUpdated: string;
  periodWordCount: number;
}

export interface HighValueNoteFeedback {
  priorityNoteTitles: string[];
  outputReadyCount: number;
  staleCoreCount: number;
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
  topicEvolution: TopicEvolutionData;
  highValueNotes: HighValueNote[];
  outputReadyNotes: HighValueNote[];
  maintenanceNotes: HighValueNote[];
  isolatedPotentialNotes: HighValueNote[];
  highValueFeedback: HighValueNoteFeedback;
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
