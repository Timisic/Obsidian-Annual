import type {
  HighValueNote,
  HighValueNoteFeedback,
  HighValueNoteKind,
  NoteStats,
  SuggestedNoteAction,
} from "./types";

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

export function buildHighValueNoteInsights(
  notes: NoteStats[],
  year: number,
  generatedAt: string,
): HighValueNoteInsights {
  const sortedNotes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const pathAliases = buildPathAliasMap(sortedNotes);
  const growthTopics = buildGrowthTopics(sortedNotes, year);
  const referenceTime = Date.parse(generatedAt);
  const profiles = sortedNotes.map((note) =>
    buildProfile(note, sortedNotes, pathAliases, growthTopics, year, referenceTime),
  );

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
    outputReadyNotes: outputReadyProfiles
      .slice(0, MAX_NOTES_PER_SECTION)
      .map(toHighValueNote),
    maintenanceNotes: maintenanceProfiles
      .slice(0, MAX_NOTES_PER_SECTION)
      .map(toHighValueNote),
    isolatedPotentialNotes: isolatedProfiles
      .slice(0, MAX_NOTES_PER_SECTION)
      .map(toHighValueNote),
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
  const outboundLinks = Object.values(note.linkCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const periodWordCount =
    new Date(note.ctime).getFullYear() === year ? note.wordCount : 0;
  const daysSinceUpdate = daysBetween(note.mtime, referenceTime);
  const connectedTopicCount = connectedTopics(note, allNotes, pathAliases).size;
  const belongsToGrowthTopic = topics.some((topic) => growthTopics.has(topic));
  const isCore = inboundLinks >= CORE_INBOUND_LINKS;
  const isRecent =
    daysSinceUpdate <= RECENT_UPDATE_DAYS &&
    (periodWordCount > 0 || new Date(note.mtime).getFullYear() === year);
  const isBridge = connectedTopicCount >= TOPIC_BRIDGE_COUNT && outboundLinks > 0;
  const isGrowthLong = belongsToGrowthTopic && periodWordCount >= LONG_NOTE_WORDS;
  const isOutputReady =
    note.wordCount >= LONG_NOTE_WORDS &&
    (isCore || isBridge || isGrowthLong || outboundLinks >= CORE_INBOUND_LINKS);
  const isStaleCore = isCore && daysSinceUpdate > STALE_CORE_DAYS;
  const isIsolatedPotential =
    note.wordCount >= LONG_NOTE_WORDS && inboundLinks === 0 && outboundLinks === 0;

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
  return (
    profile.isCore ||
    profile.isRecent ||
    profile.isBridge ||
    profile.isGrowthLong ||
    profile.isOutputReady ||
    profile.isStaleCore ||
    profile.isIsolatedPotential
  );
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
  if (profile.isStaleCore && profile.isOutputReady) return "更新关键结论并补一段现状评估";
  if (profile.isStaleCore) return "复核过期段落并标注是否继续维护";
  if (profile.isIsolatedPotential && profile.isOutputReady)
    return "补 2-3 个上下文链接后整理成输出草稿";
  if (profile.isIsolatedPotential) return "补充入口链接并决定归档或孵化";
  if (profile.isBridge) return "补一张主题关系图或索引段落";
  if (profile.isCore && profile.isOutputReady) return "提炼成主题索引并列出后续问题";
  if (profile.isCore) return "补充反向入口和下一步问题";
  if (profile.isOutputReady || profile.isGrowthLong) return "整理成文章草稿并补充结论";
  if (profile.isRecent) return "延续最新问题，追加一个可执行小结";
  return "判断是否归档";
}

function noteReason(profile: NoteProfile): string {
  if (profile.isStaleCore) {
    return `核心笔记已有 ${profile.inboundLinks} 个入口，但 ${profile.daysSinceUpdate} 天未回看`;
  }
  if (profile.isIsolatedPotential) {
    return `内容已到 ${profile.note.wordCount} 字词，但还没有进入链接网络`;
  }
  if (profile.isBridge) {
    return `连接 ${profile.connectedTopicCount} 个主题，适合沉淀关系和入口`;
  }
  if (profile.isCore && profile.isOutputReady) {
    return `入链 ${profile.inboundLinks} 次且内容完整，已经具备主题入口价值`;
  }
  if (profile.isCore) {
    return `被多处引用，说明它正在承担知识库入口角色`;
  }
  if (profile.isGrowthLong) {
    return `本期新增内容充足，能代表一个正在展开的方向`;
  }
  if (profile.isOutputReady) {
    return `篇幅和链接证据足够，适合进入输出整理阶段`;
  }
  if (profile.isRecent) {
    return `最近仍在更新，适合趁上下文未冷却继续推进`;
  }
  return "本期有明确活动记录";
}

function inboundLinkCount(
  path: string,
  notes: NoteStats[],
  pathAliases: Map<string, string>,
): number {
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

function connectedTopics(
  note: NoteStats,
  notes: NoteStats[],
  pathAliases: Map<string, string>,
): Set<string> {
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
  return [
    ...new Set(
      [note.folder, ...note.tags]
        .map(normalizeTopic)
        .filter((topic) => topic && !isTimeContainerTopic(topic)),
    ),
  ].sort();
}

function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/^#/, "")
    .replace(/\.md$/iu, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ");
}

function isTimeContainerTopic(topic: string): boolean {
  const value = topic.trim();
  const compact = value.replace(/\s+/gu, "");
  const lower = compact.toLowerCase();
  return (
    /^(?:19|20)\d{2}$/u.test(lower) ||
    /^(?:19|20)\d{2}[-_/年.](?:0?[1-9]|1[0-2])月?$/u.test(lower) ||
    /^(?:19|20)\d{2}[-_/年.](?:0?[1-9]|1[0-2])[-_/日.](?:0?[1-9]|[12]\d|3[01])日?$/u.test(
      lower,
    ) ||
    /^(?:0?[1-9]|1[0-2])月$/u.test(lower) ||
    /^(?:[一二三四五六七八九]|十|十一|十二)月$/u.test(lower) ||
    /^(?:0?[1-9]|1[0-2])$/u.test(lower) ||
    /^(?:q[1-4]|第[一二三四1234]季度)$/u.test(lower)
  );
}

function buildPathAliasMap(notes: NoteStats[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const note of notes) {
    const aliasesForPath = [
      note.path,
      removeMarkdownExtension(note.path),
      titleFromPath(note.path),
    ];
    for (const alias of aliasesForPath) {
      const key = normalizeLinkIdentity(alias);
      if (key && !aliases.has(key)) {
        aliases.set(key, note.path);
      }
    }
  }
  return aliases;
}

function resolveLinkPath(
  link: string,
  pathAliases: Map<string, string>,
): string | undefined {
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
  return (
    b.score - a.score ||
    b.inboundLinks - a.inboundLinks ||
    b.note.wordCount - a.note.wordCount ||
    a.note.path.localeCompare(b.note.path)
  );
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
