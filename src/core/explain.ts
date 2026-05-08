import type { ExplanationReason, NoteStats } from "./types";

const RECENT_UPDATE_DAYS = 30;
const DORMANT_DAYS = 90;
const LONG_NOTE_WORDS = 300;
const LINK_SIGNAL_COUNT = 1;
const TASK_SIGNAL_COUNT = 1;
const TAG_SIGNAL_COUNT = 1;
const TOPIC_BRIDGE_COUNT = 3;

interface BuildExplanationReasonsInput {
  note: NoteStats;
  allNotes: NoteStats[];
  year: number;
  generatedAt: string;
  topics?: string[];
  inboundLinks?: number;
  outboundLinks?: number;
  periodWordCount?: number;
  connectedTopicCount?: number;
  daysSinceUpdate?: number;
}

type ReasonType = ExplanationReason["type"];

const REASON_ORDER: Record<ReasonType, number> = {
  backlink: 0,
  outlink: 1,
  "topic-bridge": 2,
  "word-count": 3,
  task: 4,
  tag: 5,
  "updated-at": 6,
  dormant: 7,
};

export function buildExplanationReasons(
  input: BuildExplanationReasonsInput,
): ExplanationReason[] {
  const pathAliases = buildPathAliasMap(input.allNotes);
  const noteByPath = new Map(input.allNotes.map((note) => [note.path, note]));
  const sourcePath = input.note.path;
  const topics = input.topics ?? topicsFor(input.note);
  const inboundEvidence = inboundLinkEvidence(sourcePath, input.allNotes, pathAliases);
  const outboundEvidence = outboundLinkEvidence(input.note, pathAliases, noteByPath);
  const inboundLinks = input.inboundLinks ?? inboundEvidence.total;
  const outboundLinks =
    input.outboundLinks ??
    Object.values(input.note.linkCounts).reduce((sum, count) => sum + count, 0);
  const periodWordCount =
    input.periodWordCount ??
    (new Date(input.note.ctime).getFullYear() === input.year ? input.note.wordCount : 0);
  const daysSinceUpdate =
    input.daysSinceUpdate ?? daysBetween(input.note.mtime, Date.parse(input.generatedAt));
  const crossTopicPaths = crossTopicRelatedPaths(
    input.note,
    topics,
    outboundEvidence.paths,
    noteByPath,
  );
  const connectedTopicCount =
    input.connectedTopicCount ??
    connectedTopics(input.note, input.allNotes, pathAliases).size;
  const reasons: ExplanationReason[] = [];

  if (inboundLinks >= LINK_SIGNAL_COUNT && inboundEvidence.paths.length > 0) {
    reasons.push({
      type: "backlink",
      label: `有 ${inboundLinks} 个反链入口指向这篇笔记`,
      value: inboundLinks,
      statField: "inboundLinks",
      relatedPaths: inboundEvidence.paths,
      evidenceId: evidenceId(sourcePath, "backlink"),
    });
  }

  if (outboundLinks >= LINK_SIGNAL_COUNT && outboundEvidence.paths.length > 0) {
    reasons.push({
      type: "outlink",
      label: `向外连接 ${outboundLinks} 次，可沿相关笔记复核上下文`,
      value: outboundLinks,
      statField: "outboundLinks",
      sourcePath,
      relatedPaths: outboundEvidence.paths,
      evidenceId: evidenceId(sourcePath, "outlink"),
    });
  }

  if (connectedTopicCount >= TOPIC_BRIDGE_COUNT && crossTopicPaths.length > 0) {
    reasons.push({
      type: "topic-bridge",
      label: `连接 ${connectedTopicCount} 个主题，可能是跨主题桥接候选`,
      value: connectedTopicCount,
      statField: "connectedTopicCount",
      sourcePath,
      relatedPaths: crossTopicPaths,
      evidenceId: evidenceId(sourcePath, "topic-bridge"),
    });
  }

  if (input.note.wordCount >= LONG_NOTE_WORDS) {
    reasons.push({
      type: "word-count",
      label: `当前正文约 ${input.note.wordCount} 字词，已有足够材料可复核`,
      value: input.note.wordCount,
      statField: "wordCount",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "word-count"),
    });
  } else if (periodWordCount > 0) {
    reasons.push({
      type: "word-count",
      label: `本期新增约 ${periodWordCount} 字词，说明今年有可观测活动`,
      value: periodWordCount,
      statField: "periodWordCount",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "period-word-count"),
    });
  }

  if (input.note.tasks.total >= TASK_SIGNAL_COUNT) {
    reasons.push({
      type: "task",
      label: `包含 ${input.note.tasks.total} 个任务，其中 ${input.note.tasks.completed} 个已完成`,
      value: input.note.tasks.total,
      statField: "tasks.total",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "task"),
    });
  }

  if (input.note.tags.length >= TAG_SIGNAL_COUNT) {
    reasons.push({
      type: "tag",
      label: `带有标签 ${input.note.tags.map((tag) => `#${tag}`).join("、")}`,
      value: input.note.tags.join(", "),
      statField: "tags",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "tag"),
    });
  }

  if (daysSinceUpdate <= RECENT_UPDATE_DAYS && Number.isFinite(input.note.mtime)) {
    reasons.push({
      type: "updated-at",
      label: `最近 ${daysSinceUpdate} 天内更新过，复核时上下文仍较新`,
      value: dateKey(input.note.mtime),
      statField: "mtime",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "updated-at"),
    });
  }

  if (daysSinceUpdate > DORMANT_DAYS) {
    reasons.push({
      type: "dormant",
      label: `${daysSinceUpdate} 天未更新，适合确认是否继续维护`,
      value: daysSinceUpdate,
      statField: "daysSinceUpdate",
      sourcePath,
      evidenceId: evidenceId(sourcePath, "dormant"),
    });
  }

  return reasons.filter(hasTraceableEvidence).sort(sortReasons);
}

export function summarizeExplanationReasons(reasons: ExplanationReason[]): string {
  if (reasons.length === 0) {
    return "缺少可追溯证据，需人工复核后再判断";
  }
  const [first, second] = reasons;
  if (!second) {
    return first.label;
  }
  return `${first.label}；${second.label}`;
}

export function hasTraceableEvidence(reason: ExplanationReason): boolean {
  return Boolean(
    reason.sourcePath ||
    reason.statField ||
    (reason.relatedPaths && reason.relatedPaths.length > 0),
  );
}

function sortReasons(a: ExplanationReason, b: ExplanationReason): number {
  return (
    REASON_ORDER[a.type] - REASON_ORDER[b.type] ||
    evidencePath(a).localeCompare(evidencePath(b)) ||
    a.label.localeCompare(b.label)
  );
}

function evidencePath(reason: ExplanationReason): string {
  return [
    reason.sourcePath ?? "",
    ...(reason.relatedPaths ?? []),
    reason.statField ?? "",
  ].join("|");
}

function inboundLinkEvidence(
  path: string,
  notes: NoteStats[],
  pathAliases: Map<string, string>,
): { total: number; paths: string[] } {
  let total = 0;
  const paths = new Set<string>();
  for (const note of notes) {
    if (note.path === path) {
      continue;
    }
    for (const [link, amount] of Object.entries(note.linkCounts)) {
      if (resolveLinkPath(link, pathAliases) === path) {
        total += amount;
        paths.add(note.path);
      }
    }
  }
  return { total, paths: [...paths].sort() };
}

function outboundLinkEvidence(
  note: NoteStats,
  pathAliases: Map<string, string>,
  noteByPath: Map<string, NoteStats>,
): { paths: string[] } {
  const paths = new Set<string>();
  for (const link of Object.keys(note.linkCounts)) {
    const targetPath = resolveLinkPath(link, pathAliases);
    if (targetPath && noteByPath.has(targetPath) && targetPath !== note.path) {
      paths.add(targetPath);
    }
  }
  return { paths: [...paths].sort() };
}

function crossTopicRelatedPaths(
  note: NoteStats,
  sourceTopics: string[],
  outboundPaths: string[],
  noteByPath: Map<string, NoteStats>,
): string[] {
  const sourceTopicSet = new Set(sourceTopics);
  return outboundPaths
    .filter((path) => {
      const target = noteByPath.get(path);
      if (!target || target.path === note.path) {
        return false;
      }
      return topicsFor(target).some((topic) => !sourceTopicSet.has(topic));
    })
    .sort();
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

function evidenceId(path: string, type: string): string {
  const pathKey = Array.from(path)
    .map((char) => char.codePointAt(0)?.toString(36) ?? "")
    .join("-");
  return `${pathKey}-${type}`;
}
