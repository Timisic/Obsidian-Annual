import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { reviewSessionContainsDate } from "./reviewSession";
import type {
  AnnualReviewSettings,
  NoteStats,
  SourceFile,
  ThemeEvidenceNote,
  ThemeEvidencePackage,
  ThemeHypothesis,
  ThemeHypothesisSource,
  YearAggregate,
} from "./types";

const MAX_EVIDENCE_NOTES = 80;
const MAX_EVIDENCE_EXCERPT_CHARS = 700;
const MAX_LOCAL_THEMES = 6;
const MAX_EVIDENCE_PER_THEME = 5;
const WEAK_SIGNAL_PREFIX = "tag:";

interface ActiveNoteEntry {
  file: SourceFile;
  note: NoteStats;
}

interface ThemeCluster {
  key: string;
  label: string;
  kind: "link" | "phrase" | "entity" | "folder" | "weak-tag" | "note";
  noteIds: Set<string>;
}

export function buildThemeEvidencePackage(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
): ThemeEvidencePackage {
  const activeEntries = files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => ({ file, note: extractNoteStats(file, settings) }))
    .filter((entry) => isActiveInReviewRange(entry.note, aggregate))
    .sort((a, b) => a.note.path.localeCompare(b.note.path));
  const noteByPath = new Map(activeEntries.map((entry) => [entry.note.path, entry]));
  const backlinksByPath = buildBacklinkIndex(activeEntries);
  const commonLinks = buildCommonLinkIndex(activeEntries);
  const repeatedPhrases = buildRepeatedPhraseIndex(activeEntries);

  const evidenceNotes = activeEntries
    .map((entry) =>
      buildEvidenceNote(
        entry,
        aggregate,
        noteByPath,
        backlinksByPath.get(entry.note.path) ?? [],
        commonLinks.get(entry.note.path) ?? [],
        repeatedPhrases.get(entry.note.path) ?? [],
      ),
    )
    .sort((a, b) => evidenceScore(b) - evidenceScore(a) || a.path.localeCompare(b.path))
    .slice(0, MAX_EVIDENCE_NOTES);

  return {
    reviewRange: `${aggregate.session.startDate} to ${aggregate.session.endDate}`,
    evidenceNotes,
  };
}

export function buildThemeHypothesisPrompt(
  evidencePackage: ThemeEvidencePackage,
): string {
  return JSON.stringify(
    {
      task: "Generate review theme hypotheses from the supplied Obsidian evidence package.",
      inputPolicy: {
        allowedInput:
          "Use only reviewRange and evidenceNotes from this structured evidence package. Do not infer from an entire vault or request full note contents.",
        evidenceIdRule:
          "Every hypothesis must cite evidenceNoteIds using exact evidenceNotes[].id values.",
        weakSignalRule:
          "weakSignals, including tags, may support a hypothesis but must not be the primary connection.",
      },
      outputSchema: {
        themeHypotheses: [
          {
            id: "stable short id",
            title: "synthesized theme title",
            summary: "short evidence-grounded summary",
            evidenceNoteIds: ["exact evidence note ids"],
            connectionExplanation:
              "why these evidence notes belong together; cite local signals",
            uncertainty:
              "required when fewer than two evidence notes support the hypothesis",
            source: "ai",
          },
        ],
      },
      acceptanceRules: [
        "Each theme must have at least two evidenceNoteIds unless uncertainty explicitly marks low confidence.",
        "Each theme must include connectionExplanation.",
        "Tags are weak signals only.",
        "Do not invent evidence note ids.",
      ],
      evidencePackage,
    },
    null,
    2,
  );
}

export function parseThemeHypotheses(
  content: string,
  evidencePackage: ThemeEvidencePackage,
): ThemeHypothesis[] {
  const parsed = parseJsonValue(content);
  const rawThemes = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? arrayValue((parsed as Record<string, unknown>).themeHypotheses).length > 0
        ? arrayValue((parsed as Record<string, unknown>).themeHypotheses)
        : arrayValue((parsed as Record<string, unknown>).themes)
      : [];
  const ids = new Set(evidencePackage.evidenceNotes.map((note) => note.id));
  const evidenceNoteById = new Map(
    evidencePackage.evidenceNotes.map((note) => [note.id, note]),
  );
  const idByPath = new Map(
    evidencePackage.evidenceNotes.flatMap((note) => [
      [normalizeEvidenceReference(note.path), note.id] as const,
      [normalizeEvidenceReference(note.path.replace(/\.md$/iu, "")), note.id] as const,
      [normalizeEvidenceReference(note.title), note.id] as const,
    ]),
  );

  return rawThemes
    .map((value, index) =>
      toThemeHypothesis(value, index, ids, idByPath, evidenceNoteById),
    )
    .filter((theme): theme is ThemeHypothesis => Boolean(theme))
    .slice(0, MAX_LOCAL_THEMES);
}

export function buildLocalThemeHypotheses(
  evidencePackage: ThemeEvidencePackage,
): ThemeHypothesis[] {
  const noteById = new Map(evidencePackage.evidenceNotes.map((note) => [note.id, note]));
  const clusters = buildLocalClusters(evidencePackage.evidenceNotes);
  const strongThemes = clusters
    .filter((cluster) => cluster.noteIds.size >= 2)
    .sort(sortClusters)
    .slice(0, MAX_LOCAL_THEMES)
    .map((cluster) => clusterToTheme(cluster, noteById, false));

  if (strongThemes.length > 0) {
    return strongThemes;
  }

  return evidencePackage.evidenceNotes.slice(0, Math.min(3, MAX_LOCAL_THEMES)).map(
    (note, index): ThemeHypothesis => ({
      id: `theme:local:low-confidence:${index + 1}`,
      title: `Review clue: ${note.title}`,
      summary: note.whyIncluded,
      evidenceNoteIds: [note.id],
      evidenceNotes: [note],
      sourcePaths: [note.path],
      localSignals: note.localSignals,
      aiSignals: [],
      connectionExplanation:
        "Only one evidence note is available for this local clue, so it should be reviewed before being promoted into a theme.",
      uncertainty: "Low confidence: fewer than two evidence notes support this clue.",
      source: "local",
    }),
  );
}

function buildEvidenceNote(
  entry: ActiveNoteEntry,
  aggregate: YearAggregate,
  noteByPath: Map<string, ActiveNoteEntry>,
  backlinks: string[],
  commonLinks: string[],
  repeatedPhrases: string[],
): ThemeEvidenceNote {
  const { file, note } = entry;
  const createdInRange = reviewSessionContainsDate(aggregate.session, createdTime(note));
  const modifiedInRange = reviewSessionContainsDate(
    aggregate.session,
    modifiedTime(note),
  );
  const dateSignals = [
    createdInRange ? `created in review range: ${dateKey(createdTime(note))}` : "",
    modifiedInRange ? `modified in review range: ${dateKey(modifiedTime(note))}` : "",
    !createdInRange && modifiedInRange
      ? `resurfaced old note: created ${dateKey(createdTime(note))}, modified ${dateKey(
          modifiedTime(note),
        )}`
      : "",
  ].filter(Boolean);
  const links = Object.keys(note.linkCounts).sort();
  const frontmatterSignals = frontmatterSignalValues(note.frontmatter);
  const weakSignals = note.tags.map((tag) => `${WEAK_SIGNAL_PREFIX}${tag}`);
  const entities = extractEntities(file.content, note, links);
  const questionSentences = extractQuestionSentences(file.content);
  const crossFolderLinks = links
    .map((link) => resolveLinkTarget(link, noteByPath))
    .filter((path) => {
      const target = noteByPath.get(path);
      return target && target.note.folder !== note.folder;
    })
    .sort();
  const reasons = [
    ...dateSignals,
    backlinks.length > 0 ? `${backlinks.length} backlinks` : "",
    links.length > 0 ? `${links.length} outbound links` : "",
    commonLinks.length > 0 ? `shared links: ${commonLinks.slice(0, 3).join(", ")}` : "",
    repeatedPhrases.length > 0
      ? `repeated phrases: ${repeatedPhrases.slice(0, 3).join(", ")}`
      : "",
    questionSentences.length > 0 ? "contains reviewable questions" : "",
    entities.length > 0 ? `entities: ${entities.slice(0, 3).join(", ")}` : "",
    crossFolderLinks.length > 0
      ? `cross-folder links: ${crossFolderLinks.slice(0, 3).join(", ")}`
      : "",
    frontmatterSignals.length > 0 ? "frontmatter context present" : "",
    weakSignals.length > 0 ? "tags present as weak signals" : "",
  ].filter(Boolean);

  return {
    id: evidenceNoteId(note.path),
    path: note.path,
    sourcePath: note.path,
    title: titleFromPath(note.path),
    dateSignals,
    excerpt: excerpt(file.content),
    localSignals: [
      ...dateSignals,
      ...links.map((link) => `outlink:${link}`),
      ...backlinks.map((path) => `backlink:${path}`),
      ...commonLinks.map((link) => `shared-link:${link}`),
      ...repeatedPhrases.map((phrase) => `repeated-phrase:${phrase}`),
      ...questionSentences.map((question) => `question:${question}`),
      ...entities.map((entity) => `entity:${entity}`),
      ...crossFolderLinks.map((path) => `cross-folder-link:${path}`),
      ...frontmatterSignals.map((signal) => `frontmatter:${signal}`),
      ...weakSignals,
    ],
    relatedNotes: uniqueStrings([...backlinks, ...crossFolderLinks]),
    links,
    backlinks,
    commonLinks,
    frontmatterSignals,
    repeatedPhrases,
    questionSentences,
    entities,
    crossFolderLinks,
    weakSignals,
    whyIncluded:
      reasons.length > 0
        ? reasons.slice(0, 5).join("; ")
        : "Active note in the review range with local metadata evidence.",
  };
}

function buildBacklinkIndex(entries: ActiveNoteEntry[]): Map<string, string[]> {
  const backlinks = new Map<string, string[]>();
  for (const target of entries) {
    const incoming = entries
      .filter((source) => source.note.path !== target.note.path)
      .filter((source) =>
        Object.keys(source.note.linkCounts).some((link) =>
          linkTargetMatches(link, target.note.path),
        ),
      )
      .map((source) => source.note.path)
      .sort();
    backlinks.set(target.note.path, incoming);
  }
  return backlinks;
}

function buildCommonLinkIndex(entries: ActiveNoteEntry[]): Map<string, string[]> {
  const pathsByLink = new Map<string, Set<string>>();
  for (const { note } of entries) {
    for (const link of Object.keys(note.linkCounts)) {
      const normalized = normalizeLinkIdentity(link);
      if (!pathsByLink.has(normalized)) {
        pathsByLink.set(normalized, new Set());
      }
      pathsByLink.get(normalized)?.add(note.path);
    }
  }
  const common = new Map<string, string[]>();
  for (const { note } of entries) {
    common.set(
      note.path,
      Object.keys(note.linkCounts)
        .filter((link) => (pathsByLink.get(normalizeLinkIdentity(link))?.size ?? 0) >= 2)
        .sort(),
    );
  }
  return common;
}

function buildRepeatedPhraseIndex(entries: ActiveNoteEntry[]): Map<string, string[]> {
  const phraseDocs = new Map<string, Set<string>>();
  const phrasesByPath = new Map<string, string[]>();
  for (const { file, note } of entries) {
    const phrases = extractPhraseCandidates(file.content);
    phrasesByPath.set(note.path, phrases);
    for (const phrase of phrases) {
      if (!phraseDocs.has(phrase)) {
        phraseDocs.set(phrase, new Set());
      }
      phraseDocs.get(phrase)?.add(note.path);
    }
  }
  const global = new Set(
    [...phraseDocs.entries()]
      .filter(([, paths]) => paths.size >= 2)
      .map(([phrase]) => phrase),
  );
  const byNote = new Map<string, string[]>();
  for (const [path, phrases] of phrasesByPath.entries()) {
    byNote.set(path, phrases.filter((phrase) => global.has(phrase)).slice(0, 6));
  }
  return byNote;
}

function buildLocalClusters(notes: ThemeEvidenceNote[]): ThemeCluster[] {
  const clusters = new Map<string, ThemeCluster>();
  const add = (kind: ThemeCluster["kind"], label: string, noteId: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    const key = `${kind}:${normalizeLinkIdentity(cleanLabel)}`;
    if (!clusters.has(key)) {
      clusters.set(key, { key, label: cleanLabel, kind, noteIds: new Set() });
    }
    clusters.get(key)?.noteIds.add(noteId);
  };

  for (const note of notes) {
    note.commonLinks.forEach((link) => add("link", link, note.id));
    note.repeatedPhrases.forEach((phrase) => add("phrase", phrase, note.id));
    note.entities.forEach((entity) => add("entity", entity, note.id));
    note.crossFolderLinks.forEach((link) => add("link", link, note.id));
    folderParts(note.path).forEach((folder) => add("folder", folder, note.id));
    note.weakSignals.forEach((signal) =>
      add("weak-tag", signal.replace(WEAK_SIGNAL_PREFIX, ""), note.id),
    );
  }

  for (const note of notes) {
    add("note", note.title, note.id);
  }

  return [...clusters.values()];
}

function clusterToTheme(
  cluster: ThemeCluster,
  noteById: Map<string, ThemeEvidenceNote>,
  lowConfidence: boolean,
): ThemeHypothesis {
  const noteIds = [...cluster.noteIds]
    .sort((a, b) => {
      const noteA = noteById.get(a);
      const noteB = noteById.get(b);
      return (noteB ? evidenceScore(noteB) : 0) - (noteA ? evidenceScore(noteA) : 0);
    })
    .slice(0, MAX_EVIDENCE_PER_THEME);
  const noteTitles = noteIds
    .map((id) => noteById.get(id)?.title)
    .filter((title): title is string => Boolean(title));
  const signal =
    cluster.kind === "weak-tag"
      ? `weak tag signal "${cluster.label}"`
      : `${cluster.kind} signal "${cluster.label}"`;

  return {
    id: `theme:local:${slug(cluster.key)}`,
    title: localThemeTitle(cluster),
    summary: `Local evidence groups ${noteTitles.join(", ")} around ${signal}.`,
    evidenceNoteIds: noteIds,
    evidenceNotes: noteIds
      .map((id) => noteById.get(id))
      .filter((note): note is ThemeEvidenceNote => Boolean(note)),
    sourcePaths: noteIds
      .map((id) => noteById.get(id)?.path)
      .filter((path): path is string => Boolean(path)),
    localSignals: uniqueStrings(
      noteIds.flatMap((id) => noteById.get(id)?.localSignals ?? []),
    ).slice(0, 20),
    aiSignals: [],
    connectionExplanation:
      cluster.kind === "weak-tag"
        ? `These notes share tag "${cluster.label}", but tags are treated as weak evidence and should be confirmed against excerpts, links, and date signals.`
        : `These notes share ${signal}, with supporting local metadata such as excerpts, links, backlinks, dates, or cross-folder connections.`,
    uncertainty: lowConfidence
      ? "Low confidence: fewer than two evidence notes support this clue."
      : undefined,
    source: "local",
  };
}

function toThemeHypothesis(
  value: unknown,
  index: number,
  validIds: Set<string>,
  idByPath: Map<string, string>,
  evidenceNoteById: Map<string, ThemeEvidenceNote>,
): ThemeHypothesis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = stringValue(record.title);
  const summary = stringValue(record.summary) || stringValue(record.synthesis);
  const connectionExplanation =
    stringValue(record.connectionExplanation) || stringValue(record.connections);
  if (!title || !summary || !connectionExplanation) {
    return null;
  }
  const rawIds =
    arrayValue(record.evidenceNoteIds).length > 0
      ? arrayValue(record.evidenceNoteIds)
      : arrayValue(record.evidenceNotes);
  const evidenceNoteIds = [
    ...new Set(
      rawIds
        .map((item) => normalizeEvidenceId(item, validIds, idByPath))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (evidenceNoteIds.length === 0) {
    return null;
  }
  const uncertainty = stringValue(record.uncertainty);
  return {
    id: stringValue(record.id) || `theme:ai:${index + 1}`,
    title,
    summary,
    evidenceNoteIds,
    evidenceNotes: evidenceNoteIds
      .map((id) => evidenceNoteById.get(id))
      .filter((note): note is ThemeEvidenceNote => Boolean(note)),
    sourcePaths: evidenceNoteIds
      .map((id) => evidenceNoteById.get(id)?.path)
      .filter((path): path is string => Boolean(path)),
    localSignals: uniqueStrings(
      evidenceNoteIds.flatMap((id) => evidenceNoteById.get(id)?.localSignals ?? []),
    ).slice(0, 20),
    aiSignals: uniqueStrings([
      stringValue(record.connectionExplanation),
      stringValue(record.connections),
      stringValue(record.uncertainty),
    ]).filter(Boolean),
    connectionExplanation,
    uncertainty:
      evidenceNoteIds.length < 2 && !uncertainty
        ? "Low confidence: fewer than two evidence notes support this hypothesis."
        : uncertainty || undefined,
    source: sourceValue(record.source),
  };
}

function normalizeEvidenceId(
  value: unknown,
  validIds: Set<string>,
  idByPath: Map<string, string>,
): string | null {
  const text = stringValue(value);
  if (!text) return null;
  if (validIds.has(text)) return text;
  return idByPath.get(normalizeEvidenceReference(text)) ?? null;
}

function evidenceScore(note: ThemeEvidenceNote): number {
  return (
    note.dateSignals.length * 3 +
    note.backlinks.length * 3 +
    note.links.length * 2 +
    note.commonLinks.length * 4 +
    note.repeatedPhrases.length * 3 +
    note.questionSentences.length * 2 +
    note.entities.length * 2 +
    note.crossFolderLinks.length * 4 +
    note.frontmatterSignals.length +
    note.weakSignals.length
  );
}

function sortClusters(a: ThemeCluster, b: ThemeCluster): number {
  const strength = (cluster: ThemeCluster) =>
    cluster.noteIds.size * 10 + clusterKindWeight(cluster.kind);
  return strength(b) - strength(a) || a.key.localeCompare(b.key);
}

function clusterKindWeight(kind: ThemeCluster["kind"]): number {
  switch (kind) {
    case "link":
      return 8;
    case "phrase":
      return 7;
    case "entity":
      return 6;
    case "folder":
      return 4;
    case "weak-tag":
      return 1;
    case "note":
      return 0;
  }
}

function localThemeTitle(cluster: ThemeCluster): string {
  switch (cluster.kind) {
    case "link":
      return `Linked thread: ${titleFromPath(cluster.label)}`;
    case "phrase":
      return `Recurring phrase: ${cluster.label}`;
    case "entity":
      return `Recurring entity: ${cluster.label}`;
    case "folder":
      return `Folder thread: ${cluster.label}`;
    case "weak-tag":
      return `Weak tag clue: ${cluster.label}`;
    case "note":
      return `Review clue: ${cluster.label}`;
  }
}

function isActiveInReviewRange(note: NoteStats, aggregate: YearAggregate): boolean {
  return (
    reviewSessionContainsDate(aggregate.session, createdTime(note)) ||
    reviewSessionContainsDate(aggregate.session, modifiedTime(note))
  );
}

function createdTime(note: NoteStats): number {
  return note.noteDate?.timestamp ?? note.ctime;
}

function modifiedTime(note: NoteStats): number {
  return note.noteDate?.timestamp ?? note.mtime;
}

function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function folderParts(path: string): string[] {
  const parts = path.split("/").slice(0, -1);
  return parts.filter(
    (part) => part && !/^(?:daily|dailies|notes|journal)$/iu.test(part),
  );
}

function excerpt(content: string): string {
  const body = content
    .replace(/^---\n[\s\S]*?\n---\n?/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (body.length <= MAX_EVIDENCE_EXCERPT_CHARS) {
    return body;
  }
  return `${body.slice(0, MAX_EVIDENCE_EXCERPT_CHARS).trim()}...`;
}

function frontmatterSignalValues(frontmatter: Record<string, unknown>): string[] {
  return Object.entries(frontmatter)
    .flatMap(([key, value]) =>
      collectPrimitiveValues(value).map((item) =>
        /^tags?$/iu.test(key) ? `weak ${key}: ${item}` : `${key}: ${item}`,
      ),
    )
    .slice(0, 8);
}

function collectPrimitiveValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectPrimitiveValues);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .split(/[,;，、\n]+/u)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  return [];
}

function extractQuestionSentences(content: string): string[] {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/u, "")
    .split(/(?<=[?？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[?？]$/u.test(sentence))
    .map((sentence) => sanitizeInlineText(sentence, 180))
    .slice(0, 3);
}

function extractEntities(content: string, note: NoteStats, links: string[]): string[] {
  const fromLinks = links.map(titleFromPath);
  const capitalized =
    content.match(/\b[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,3}\b/gu) ?? [];
  const fromFrontmatter = Object.entries(note.frontmatter)
    .filter(([key]) => !/^tags?$/iu.test(key))
    .flatMap(([, value]) => collectPrimitiveValues(value));
  return [...new Set([...fromLinks, ...capitalized, ...fromFrontmatter])]
    .map((item) => sanitizeInlineText(item, 80))
    .filter((item) => item.length >= 3 && !/^(the|and|but|this|that)$/iu.test(item))
    .slice(0, 8);
}

function extractPhraseCandidates(content: string): string[] {
  const words = content
    .replace(/^---\n[\s\S]*?\n---\n?/u, "")
    .toLocaleLowerCase()
    .match(/[\p{Letter}\p{Number}][\p{Letter}\p{Number}'-]{2,}/gu);
  if (!words) return [];
  const candidates = new Set<string>();
  for (let index = 0; index < words.length - 2; index += 1) {
    const phrase = words.slice(index, index + 3);
    if (phrase.some((word) => STOPWORDS.has(word))) {
      continue;
    }
    candidates.add(phrase.join(" "));
  }
  return [...candidates].slice(0, 40);
}

function resolveLinkTarget(
  link: string,
  noteByPath: Map<string, ActiveNoteEntry>,
): string {
  const normalized = normalizeLinkIdentity(link);
  for (const path of noteByPath.keys()) {
    if (
      normalizeLinkIdentity(path) === normalized ||
      normalizeLinkIdentity(path.replace(/\.md$/iu, "")) === normalized ||
      normalizeLinkIdentity(titleFromPath(path)) === normalized
    ) {
      return path;
    }
  }
  return link;
}

function linkTargetMatches(link: string, path: string): boolean {
  return (
    normalizeLinkIdentity(link) === normalizeLinkIdentity(path) ||
    normalizeLinkIdentity(link) === normalizeLinkIdentity(path.replace(/\.md$/iu, "")) ||
    normalizeLinkIdentity(link) === normalizeLinkIdentity(titleFromPath(path))
  );
}

function normalizeEvidenceReference(value: string): string {
  const wikilink = value.match(/^\[\[([^\]|#\]]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/u)?.[1];
  return normalizeLinkIdentity(wikilink || value);
}

function normalizeLinkIdentity(value: string): string {
  return value.trim().replace(/\.md$/iu, "").replace(/\\/gu, "/").toLocaleLowerCase();
}

function evidenceNoteId(path: string): string {
  return `note:${slug(path)}`;
}

function slug(value: string): string {
  return (
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 80) || stableHash(value)
  );
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function parseJsonValue(content: string): unknown {
  const candidates = [
    content.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1],
    content,
    content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? sanitizeInlineText(value, 700) : "";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sourceValue(value: unknown): ThemeHypothesisSource {
  return value === "local" || value === "ai" || value === "mixed" ? value : "ai";
}

function sanitizeInlineText(value: string, maxLength: number): string {
  return value.replace(/\r?\n/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "what",
  "when",
  "where",
  "should",
  "could",
  "would",
]);
