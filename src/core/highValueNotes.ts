import type { HighValueNote, HighValueNoteFeedback, HighValueNoteKind, NoteStats, SuggestedNoteAction } from "./types";

const RECENT_UPDATE_DAYS = 30;
const STALE_CORE_DAYS = 90;
const CORE_INBOUND_LINKS = 2;
const LONG_NOTE_WORDS = 300;
const TOPIC_BRIDGE_COUNT = 3;
const MAX_NOTES_PER_SECTION = 10;

interface HighValueNoteInsights {
  highValueNotes: HighValueNote[];
  outputReadyNotes: HighValueNote[];
  maintenanceNotes: HighValueNote[];
  isolatedPotentialNotes: HighValueNote[];
  highValueFeedback: HighValueNoteFeedback;
}

interface NoteProfile {
  note: NoteStats;
  title: string;
  topics: string[];
  inboundLinks: number;
  outboundLinks: number;
  periodWordCount: number;
  lastUpdated: string;
  daysSinceUpdate: number;
  connectedTopicCount: number;
  belongsToGrowthTopic: boolean;
  isCore: boolean;
  isRecent: boolean;
  isBridge: boolean;
  isGrowthLong: boolean;
  isOutputReady: boolean;
  isStaleCore: boolean;
  isIsolatedPotential: boolean;
  score: number;
}

export function buildHighValueNoteInsights(notes: NoteStats[], year: number, generatedAt: string): HighValueNoteInsights {
  const sortedNotes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const pathAliases = buildPathAliasMap(sortedNotes);
  const growthTopics = buildGrowthTopics(sortedNotes, year);
  const referenceTime = Date.parse(generatedAt);
  const profiles = sortedNotes.map((note) => buildProfile(note, sortedNotes, pathAliases, growthTopics, year, referenceTime));

  const highValueProfiles = profiles
    .filter(hasHighValueSignal)
    .sort(sortProfiles)
    .slice(0, MAX_NOTES_PER_SECTION);
  const outputReadyProfiles = profiles
    .filter((profile) => profile.isOutputReady)
    .sort(sortProfiles);
  const maintenanceProfiles = profiles
    .filter((profile) => profile.isStaleCore)
    .sort(sortProfiles);
  const isolatedProfiles = profiles
    .filter((profile) => profile.isIsolatedPotential)
    .sort(sortProfiles);

  return {
    highValueNotes: highValueProfiles.map(toHighValueNote),
    outputReadyNotes: outputReadyProfiles.slice(0, MAX_NOTES_PER_SECTION).map(toHighValueNote),
    maintenanceNotes: maintenanceProfiles.slice(0, MAX_NOTES_PER_SECTION).map(toHighValueNote),
    isolatedPotentialNotes: isolatedProfiles.slice(0, MAX_NOTES_PER_SECTION).map(toHighValueNote),
    highValueFeedback: {
      priorityNoteTitles: highValueProfiles.slice(0, 3).map((profile) => profile.title),
      outputReadyCount: outputReadyProfiles.length,
      staleCoreCount: maintenanceProfiles.length,
    },
  };
}

function buildProfile(
  note: NoteStats,
  allNotes: NoteStats[],
  pathAliases: Map<string, string>,
  growthTopics: Set<string>,
  year: number,
  referenceTime: number,
): NoteProfile {
  const title = titleFromPath(note.path);
  const topics = topicsFor(note);
  const inboundLinks = inboundLinkCount(note.path, allNotes, pathAliases);
  const outboundLinks = Object.values(note.linkCounts).reduce((sum, count) => sum + count, 0);
  const periodWordCount = new Date(note.ctime).getFullYear() === year ? note.wordCount : 0;
  const daysSinceUpdate = daysBetween(note.mtime, referenceTime);
  const connectedTopicCount = connectedTopics(note, allNotes, pathAliases).size;
  const belongsToGrowthTopic = topics.some((topic) => growthTopics.has(topic));
  const isCore = inboundLinks >= CORE_INBOUND_LINKS;
  const isRecent = daysSinceUpdate <= RECENT_UPDATE_DAYS && (periodWordCount > 0 || new Date(note.mtime).getFullYear() === year);
  const isBridge = connectedTopicCount >= TOPIC_BRIDGE_COUNT && outboundLinks > 0;
  const isGrowthLong = belongsToGrowthTopic && periodWordCount >= LONG_NOTE_WORDS;
  const isOutputReady = note.wordCount >= LONG_NOTE_WORDS && (isCore || isBridge || isGrowthLong || outboundLinks >= CORE_INBOUND_LINKS);
  const isStaleCore = isCore && daysSinceUpdate > STALE_CORE_DAYS;
  const isIsolatedPotential = note.wordCount >= LONG_NOTE_WORDS && inboundLinks === 0 && outboundLinks === 0;

  return {
    note,
    title,
    topics,
    inboundLinks,
    outboundLinks,
    periodWordCount,
    lastUpdated: dateKey(note.mtime),
    daysSinceUpdate,
    connectedTopicCount,
    belongsToGrowthTopic,
    isCore,
    isRecent,
    isBridge,
    isGrowthLong,
    isOutputReady,
    isStaleCore,
    isIsolatedPotential,
    score: scoreProfile({
      note,
      inboundLinks,
      outboundLinks,
      connectedTopicCount,
      isCore,
      isRecent,
      isBridge,
      isGrowthLong,
      isOutputReady,
      isStaleCore,
      isIsolatedPotential,
    }),
  };
}

function scoreProfile(profile: {
  note: NoteStats;
  inboundLinks: number;
  outboundLinks: number;
  connectedTopicCount: number;
  isCore: boolean;
  isRecent: boolean;
  isBridge: boolean;
  isGrowthLong: boolean;
  isOutputReady: boolean;
  isStaleCore: boolean;
  isIsolatedPotential: boolean;
}): number {
  let score = 0;
  if (profile.isCore) score += 60;
  if (profile.isRecent) score += 35;
  if (profile.isBridge) score += 35;
  if (profile.isGrowthLong) score += 35;
  if (profile.isOutputReady) score += 25;
  if (profile.isStaleCore) score += 45;
  if (profile.isIsolatedPotential) score += 30;
  score += Math.min(25, profile.note.wordCount / 100);
  score += profile.inboundLinks * 6;
  score += profile.outboundLinks * 2;
  score += profile.connectedTopicCount * 3;
  return score;
}

function hasHighValueSignal(profile: NoteProfile): boolean {
  return profile.isCore || profile.isRecent || profile.isBridge || profile.isGrowthLong || profile.isOutputReady || profile.isStaleCore || profile.isIsolatedPotential;
}

function toHighValueNote(profile: NoteProfile): HighValueNote {
  return {
    path: profile.note.path,
    title: profile.title,
    kind: noteKind(profile),
    reason: noteReason(profile),
    suggestedAction: suggestedAction(profile),
    inboundLinks: profile.inboundLinks,
    outboundLinks: profile.outboundLinks,
    topics: profile.topics,
    lastUpdated: profile.lastUpdated,
    periodWordCount: profile.periodWordCount,
  };
}

function noteKind(profile: NoteProfile): HighValueNoteKind {
  if (profile.isStaleCore) return "需维护";
  if (profile.isIsolatedPotential) return "孤立潜力";
  if (profile.isBridge) return "桥接笔记";
  if (profile.isOutputReady) return "输出候选";
  if (profile.isCore) return "核心笔记";
  return "活跃笔记";
}

function suggestedAction(profile: NoteProfile): SuggestedNoteAction {
  if (profile.isStaleCore) return "更新旧内容";
  if (profile.isIsolatedPotential) return "补充链接";
  if (profile.isBridge || profile.isCore) return "建立 MOC";
  if (profile.isOutputReady || profile.isGrowthLong) return "整理成文章";
  if (profile.isRecent) return "继续扩展";
  return "判断是否归档";
}

function noteReason(profile: NoteProfile): string {
  const reasons: string[] = [];
  if (profile.isCore) {
    reasons.push(`入链 ${profile.inboundLinks} 次`);
  }
  if (profile.isStaleCore) {
    reasons.push(`超过 ${STALE_CORE_DAYS} 天未更新`);
  }
  if (profile.isRecent) {
    reasons.push(`近 ${RECENT_UPDATE_DAYS} 天持续更新`);
  }
  if (profile.isBridge) {
    reasons.push(`连接 ${profile.connectedTopicCount} 个主题`);
  }
  if (profile.isGrowthLong) {
    reasons.push("属于本期增长主题且内容较长");
  } else if (profile.isOutputReady) {
    reasons.push("内容较完整，具备输出潜力");
  }
  if (profile.isIsolatedPotential) {
    reasons.push("内容较多但缺少链接");
  }
  return reasons.length > 0 ? reasons.join("，") : "本期有明确活动记录";
}

function inboundLinkCount(path: string, notes: NoteStats[], pathAliases: Map<string, string>): number {
  let count = 0;
  for (const note of notes) {
    if (note.path === path) {
      continue;
    }
    for (const [link, amount] of Object.entries(note.linkCounts)) {
      if (resolveLinkPath(link, pathAliases) === path) {
        count += amount;
      }
    }
  }
  return count;
}

function connectedTopics(note: NoteStats, notes: NoteStats[], pathAliases: Map<string, string>): Set<string> {
  const topics = new Set(topicsFor(note));
  const noteByPath = new Map(notes.map((entry) => [entry.path, entry]));
  for (const link of Object.keys(note.linkCounts)) {
    const targetPath = resolveLinkPath(link, pathAliases);
    const target = targetPath ? noteByPath.get(targetPath) : undefined;
    if (!target) {
      continue;
    }
    topicsFor(target).forEach((topic) => topics.add(topic));
  }
  return topics;
}

function buildGrowthTopics(notes: NoteStats[], year: number): Set<string> {
  const topicWords = new Map<string, number>();
  for (const note of notes) {
    if (new Date(note.ctime).getFullYear() !== year) {
      continue;
    }
    for (const topic of topicsFor(note)) {
      topicWords.set(topic, (topicWords.get(topic) ?? 0) + note.wordCount);
    }
  }
  return new Set(
    [...topicWords.entries()]
      .filter(([, words]) => words > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([topic]) => topic),
  );
}

function topicsFor(note: NoteStats): string[] {
  return [...new Set([note.folder, ...note.tags].map((topic) => topic.trim()).filter(Boolean))].sort();
}

function buildPathAliasMap(notes: NoteStats[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const note of notes) {
    const aliasesForPath = [note.path, removeMarkdownExtension(note.path), titleFromPath(note.path)];
    for (const alias of aliasesForPath) {
      const key = normalizeLinkIdentity(alias);
      if (key && !aliases.has(key)) {
        aliases.set(key, note.path);
      }
    }
  }
  return aliases;
}

function resolveLinkPath(link: string, pathAliases: Map<string, string>): string | undefined {
  return pathAliases.get(normalizeLinkIdentity(link));
}

function normalizeLinkIdentity(value: string): string {
  return removeMarkdownExtension(value.trim()).replace(/\\/gu, "/").toLocaleLowerCase();
}

function removeMarkdownExtension(path: string): string {
  return path.replace(/\.md$/iu, "");
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function sortProfiles(a: NoteProfile, b: NoteProfile): number {
  return b.score - a.score || b.inboundLinks - a.inboundLinks || b.note.wordCount - a.note.wordCount || a.note.path.localeCompare(b.note.path);
}

function daysBetween(from: number, to: number): number {
  if (!Number.isFinite(to)) {
    return 0;
  }
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
