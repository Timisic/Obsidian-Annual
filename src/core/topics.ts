import type { NoteStats, NoteTopicAssignment, TopicEvolutionData, TopicMonthlyBucket, TopicSource, TopTopic } from "./types";

const MAX_TOPICS_PER_NOTE = 3;
const MAX_REPORTED_TOPICS = 8;
const REPRESENTATIVE_NOTE_LIMIT = 2;
const RECENT_MONTH_WINDOW = 3;
const OTHER_TOPIC = "其他";

const FRONTMATTER_TOPIC_KEYS = [
  "topic",
  "topics",
  "theme",
  "themes",
  "category",
  "categories",
  "area",
  "areas",
  "domain",
  "domains",
  "subject",
  "subjects",
  "project",
  "projects",
  "annual_review_topic",
  "annual_review_topics",
  "annual_review_theme",
  "annual_review_themes",
  "主题",
  "领域",
];

const FOLDER_STOPWORDS = new Set(["", "/", "daily", "dailies", "journal", "journals", "notes", "note", "inbox"]);
const TAG_PREFIXES = new Set(["topic", "topics", "theme", "themes", "主题", "领域"]);

interface TopicAccumulator {
  name: string;
  addedWords: number;
  newNotes: Set<string>;
  updatedNotes: Set<string>;
  representativeNotes: Map<string, { path: string; words: number; characters: number }>;
  monthlyWords: Map<string, number>;
}

export function buildTopicEvolution(notes: NoteStats[], year: number): TopicEvolutionData {
  const months = createMonthKeys(year);
  const assignments = notes.map(assignTopics);
  const accumulators = new Map<string, TopicAccumulator>();

  for (const [index, note] of notes.entries()) {
    const assignment = assignments[index];
    if (!assignment || assignment.topics.length === 0) {
      continue;
    }

    const createdInYear = getYear(note.ctime) === year;
    const modifiedInYear = getYear(note.mtime) === year;
    for (const topic of assignment.topics) {
      const accumulator = getAccumulator(accumulators, topic);
      if (createdInYear) {
        accumulator.addedWords += note.wordCount;
        accumulator.newNotes.add(note.path);
        incrementMonth(accumulator.monthlyWords, monthKey(note.ctime), note.wordCount);
      }
      if (modifiedInYear) {
        accumulator.updatedNotes.add(note.path);
      }
      updateRepresentative(accumulator, note);
    }
  }

  const rankedTopics = [...accumulators.values()].map(toTopTopic).sort(sortTopTopics);
  const topTopics = rankedTopics.slice(0, MAX_REPORTED_TOPICS);
  const monthlyBuckets = buildMonthlyBuckets(months, accumulators, topTopics.map((topic) => topic.name));
  const { emergingTopics, decliningTopics } = detectSignals(months, accumulators, rankedTopics.map((topic) => topic.name));

  return {
    topTopics,
    emergingTopics,
    decliningTopics,
    monthlyBuckets,
    noteAssignments: assignments.filter((assignment) => assignment.topics.length > 0),
  };
}

export function toTopicEvolutionJson(data: TopicEvolutionData): Record<string, unknown> {
  return {
    top_topics: data.topTopics.map((topic) => ({
      name: topic.name,
      added_words: topic.addedWords,
      new_notes: topic.newNotes,
      updated_notes: topic.updatedNotes,
      representative_notes: topic.representativeNotes,
    })),
    emerging_topics: data.emergingTopics,
    declining_topics: data.decliningTopics,
    monthly_topic_words: data.monthlyBuckets.map((bucket) => ({
      month: bucket.month,
      topics: bucket.topics,
    })),
    note_topics: data.noteAssignments.map((assignment) => ({
      path: assignment.path,
      topics: assignment.topics,
      sources: assignment.sources,
    })),
  };
}

function assignTopics(note: NoteStats): NoteTopicAssignment {
  const topics: string[] = [];
  const sources: Record<string, TopicSource> = {};
  const add = (topic: string, source: TopicSource) => {
    const normalized = normalizeTopic(topic);
    if (!normalized || isTimeContainerTopic(normalized) || topics.includes(normalized) || topics.length >= MAX_TOPICS_PER_NOTE) {
      return;
    }
    topics.push(normalized);
    sources[normalized] = source;
  };

  for (const key of FRONTMATTER_TOPIC_KEYS) {
    collectValues(note.frontmatter[key]).forEach((value) => add(value, "frontmatter"));
    if (topics.length >= MAX_TOPICS_PER_NOTE) {
      break;
    }
  }

  for (const tag of note.tags) {
    add(topicFromTag(tag), "tag");
  }

  if (topics.length === 0) {
    add(inferClusterTopic(note), "ai-cluster");
  }

  if (topics.length === 0) {
    add(topicFromFolder(note.folder), "folder");
  }

  return {
    path: note.path,
    topics,
    sources,
  };
}

function collectValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectValues);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(/[,;，、\n]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function topicFromTag(tag: string): string {
  const cleaned = tag.trim().replace(/^#/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length > 1 && TAG_PREFIXES.has(parts[0]?.toLowerCase() ?? "")) {
    return parts.slice(1).join("/");
  }
  return parts[parts.length - 1] ?? cleaned;
}

function topicFromFolder(folder: string): string {
  const parts = folder.split("/").map((part) => part.trim()).filter(Boolean);
  const leaf = parts[parts.length - 1] ?? "";
  return FOLDER_STOPWORDS.has(leaf.toLowerCase()) ? "" : leaf;
}

function inferClusterTopic(note: NoteStats): string {
  const heading = note.headings.find(Boolean);
  if (heading) {
    return heading;
  }
  return note.path.split("/").pop()?.replace(/\.md$/u, "") ?? note.path;
}

function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/^#/, "")
    .replace(/\.md$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ");
}

function isTimeContainerTopic(topic: string): boolean {
  const value = topic.trim();
  const compact = value.replace(/\s+/gu, "");
  const lower = compact.toLowerCase();
  if (!lower) {
    return true;
  }

  if (/^(?:19|20)\d{2}$/u.test(lower)) {
    return true;
  }
  if (/^(?:19|20)\d{2}[-_/年.](?:0?[1-9]|1[0-2])月?$/u.test(lower)) {
    return true;
  }
  if (/^(?:19|20)\d{2}[-_/年.](?:0?[1-9]|1[0-2])[-_/日.](?:0?[1-9]|[12]\d|3[01])日?$/u.test(lower)) {
    return true;
  }
  if (/^(?:0?[1-9]|1[0-2])月$/u.test(lower)) {
    return true;
  }
  if (/^(?:[一二三四五六七八九]|十|十一|十二)月$/u.test(lower)) {
    return true;
  }
  if (/^(?:0?[1-9]|1[0-2])$/u.test(lower)) {
    return true;
  }
  if (/^(?:q[1-4]|第[一二三四1234]季度)$/u.test(lower)) {
    return true;
  }
  if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/u.test(lower)) {
    return true;
  }
  return false;
}

function getAccumulator(accumulators: Map<string, TopicAccumulator>, topic: string): TopicAccumulator {
  const existing = accumulators.get(topic);
  if (existing) {
    return existing;
  }
  const next: TopicAccumulator = {
    name: topic,
    addedWords: 0,
    newNotes: new Set(),
    updatedNotes: new Set(),
    representativeNotes: new Map(),
    monthlyWords: new Map(),
  };
  accumulators.set(topic, next);
  return next;
}

function incrementMonth(months: Map<string, number>, month: string, words: number): void {
  months.set(month, (months.get(month) ?? 0) + words);
}

function updateRepresentative(accumulator: TopicAccumulator, note: NoteStats): void {
  const existing = accumulator.representativeNotes.get(note.path);
  if (!existing || note.wordCount > existing.words || (note.wordCount === existing.words && note.charCount > existing.characters)) {
    accumulator.representativeNotes.set(note.path, {
      path: note.path,
      words: note.wordCount,
      characters: note.charCount,
    });
  }
}

function toTopTopic(accumulator: TopicAccumulator): TopTopic {
  const representativeNotes = [...accumulator.representativeNotes.values()]
    .sort((a, b) => b.words - a.words || b.characters - a.characters || a.path.localeCompare(b.path))
    .slice(0, REPRESENTATIVE_NOTE_LIMIT)
    .map((note) => note.path);

  return {
    name: accumulator.name,
    addedWords: accumulator.addedWords,
    newNotes: accumulator.newNotes.size,
    updatedNotes: accumulator.updatedNotes.size,
    representativeNotes,
  };
}

function sortTopTopics(a: TopTopic, b: TopTopic): number {
  return b.addedWords - a.addedWords || b.newNotes - a.newNotes || b.updatedNotes - a.updatedNotes || a.name.localeCompare(b.name);
}

function buildMonthlyBuckets(months: string[], accumulators: Map<string, TopicAccumulator>, topTopics: string[]): TopicMonthlyBucket[] {
  const topTopicSet = new Set(topTopics);
  return months.map((month) => {
    const topics: Record<string, number> = {};
    let other = 0;
    for (const accumulator of accumulators.values()) {
      const words = accumulator.monthlyWords.get(month) ?? 0;
      if (words <= 0) {
        continue;
      }
      if (topTopicSet.has(accumulator.name)) {
        topics[accumulator.name] = words;
      } else {
        other += words;
      }
    }
    if (other > 0) {
      topics[OTHER_TOPIC] = other;
    }
    return { month, topics };
  });
}

function detectSignals(
  months: string[],
  accumulators: Map<string, TopicAccumulator>,
  rankedTopicNames: string[],
): { emergingTopics: string[]; decliningTopics: string[] } {
  const activeMonths = months.filter((month) => [...accumulators.values()].some((topic) => (topic.monthlyWords.get(month) ?? 0) > 0));
  const recentMonths = activeMonths.length > 0 ? activeMonths.slice(-RECENT_MONTH_WINDOW) : months.slice(-RECENT_MONTH_WINDOW);
  const recentSet = new Set(recentMonths);
  const earlierMonths = months.filter((month) => !recentSet.has(month));
  const rank = new Map(rankedTopicNames.map((name, index) => [name, index]));

  const scored = [...accumulators.values()].map((topic) => {
    const recentWords = sumMonths(topic.monthlyWords, recentMonths);
    const earlierWords = sumMonths(topic.monthlyWords, earlierMonths);
    return { name: topic.name, recentWords, earlierWords };
  });

  return {
    emergingTopics: scored
      .filter((topic) => topic.recentWords > 0 && topic.earlierWords === 0)
      .sort((a, b) => b.recentWords - a.recentWords || (rank.get(a.name) ?? 0) - (rank.get(b.name) ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((topic) => topic.name),
    decliningTopics: scored
      .filter((topic) => topic.earlierWords > 0 && topic.recentWords === 0)
      .sort((a, b) => b.earlierWords - a.earlierWords || (rank.get(a.name) ?? 0) - (rank.get(b.name) ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((topic) => topic.name),
  };
}

function sumMonths(words: Map<string, number>, months: string[]): number {
  return months.reduce((sum, month) => sum + (words.get(month) ?? 0), 0);
}

function createMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function getYear(timestamp: number): number {
  return new Date(timestamp).getFullYear();
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
