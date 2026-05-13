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
const MAX_THEME_HYPOTHESES = 15;
const MAX_LOCAL_THEMES = 10;
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

  const evidenceNotes = selectDiverseEvidenceNotes(
    activeEntries.map((entry) =>
      buildEvidenceNote(
        entry,
        aggregate,
        noteByPath,
        backlinksByPath.get(entry.note.path) ?? [],
        commonLinks.get(entry.note.path) ?? [],
        repeatedPhrases.get(entry.note.path) ?? [],
      ),
    ),
  );

  return {
    reviewRange: `${aggregate.session.startDate} to ${aggregate.session.endDate}`,
    evidenceNotes: selectThemeEvidenceNotes(evidenceNotes, MAX_EVIDENCE_NOTES),
  };
}

export function selectThemeEvidenceNotes(
  notes: ThemeEvidenceNote[],
  limit = MAX_EVIDENCE_NOTES,
): ThemeEvidenceNote[] {
  if (limit <= 0) {
    return [];
  }

  const ranked = [...notes].sort(sortEvidenceNotes);
  if (ranked.length <= limit) {
    return ranked;
  }

  const selected: ThemeEvidenceNote[] = [];
  const selectedIds = new Set<string>();
  const add = (note: ThemeEvidenceNote | undefined) => {
    if (!note || selectedIds.has(note.id) || selected.length >= limit) {
      return;
    }
    selected.push(note);
    selectedIds.add(note.id);
  };

  add(ranked[0]);
  for (const [, bucket] of [...buildDiversityBuckets(ranked).entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    add(bucket.sort(sortEvidenceNotes).find((note) => !selectedIds.has(note.id)));
  }

  while (selected.length < limit) {
    const next = ranked
      .filter((note) => !selectedIds.has(note.id))
      .sort(
        (a, b) =>
          diversityAdjustedEvidenceScore(b, selected) -
            diversityAdjustedEvidenceScore(a, selected) || a.path.localeCompare(b.path),
      )[0];
    if (!next) {
      break;
    }
    add(next);
  }

  return selected;
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
        titleRule:
          "Generate 5-15 mutually distinct semantic themes when enough evidence exists. Titles must be synthesized themes, not months, folders, tags, frontmatter keys, entity names, repeated phrases, or link names.",
      },
      outputSchema: {
        themeHypotheses: [
          {
            id: "stable short id",
            title: "synthesized theme title",
            summary: "short evidence-grounded summary",
            reportNarrative:
              "reader-facing draft for the default Narrative Review Report; 500-800 Chinese characters or 280-450 English words; use 2-4 exact-path wikilinks with readable aliases and no date prefixes; go beyond topical grouping into the underlying tension, value shift, fear/desire, tradeoff, contradiction, or recurring decision pattern",
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
        "Each strong theme should include reportNarrative that can be used directly in the Review Report after user acceptance.",
        "reportNarrative should connect 2-4 representative evidence notes into a first-pass story, using [[exact/path|readable alias]] links with aliases that remove leading date slugs.",
        "reportNarrative must make a deeper synthesis argument: what changed across the evidence notes, what pattern or contradiction it reveals, why it mattered in the review period, and what remains unresolved.",
        "Avoid generic report-meta sentences such as 'this theme should be treated as an early interpretation' or 'these notes preserve the original tone, judgment, and hesitation'.",
        "Tags are weak signals only.",
        "Prefer 5-15 independent themes; merge overlapping themes instead of repeating a local signal.",
        "Theme titles and summaries must be natural semantic interpretations, not raw local metadata.",
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
  const idByPath = buildEvidenceReferenceIndex(evidencePackage.evidenceNotes);

  return rawThemes
    .map((value, index) =>
      toThemeHypothesis(
        value,
        index,
        ids,
        idByPath,
        new Map(evidencePackage.evidenceNotes.map((note) => [note.id, note])),
      ),
    )
    .filter((theme): theme is ThemeHypothesis => Boolean(theme))
    .slice(0, MAX_THEME_HYPOTHESES);
}

export function buildLocalThemeHypotheses(
  evidencePackage: ThemeEvidencePackage,
  language: "en" | "zh" = "en",
): ThemeHypothesis[] {
  const noteById = new Map(evidencePackage.evidenceNotes.map((note) => [note.id, note]));
  const clusters = buildLocalClusters(evidencePackage.evidenceNotes);
  const strongThemes = clusters
    .filter((cluster) => cluster.noteIds.size >= 2)
    .sort(sortClusters)
    .slice(0, MAX_LOCAL_THEMES)
    .map((cluster) => clusterToTheme(cluster, noteById, false, language));

  if (strongThemes.length > 0) {
    return strongThemes;
  }

  return evidencePackage.evidenceNotes.slice(0, Math.min(3, MAX_LOCAL_THEMES)).map(
    (note, index): ThemeHypothesis => ({
      id: `theme:local:low-confidence:${index + 1}`,
      title:
        language === "zh" ? "需要复核的单篇笔记线索" : "Single-note clue needing review",
      summary:
        language === "zh"
          ? "这条本地线索来自单篇证据笔记；请结合正文摘录和链接上下文判断是否值得提升为主题。"
          : note.whyIncluded,
      evidenceNoteIds: [note.id],
      connectionExplanation:
        language === "zh"
          ? "这个本地线索目前只有一条证据笔记，提升为主题前需要先复核。"
          : "Only one evidence note is available for this local clue, so it should be reviewed before being promoted into a theme.",
      localSignals: note.localSignals,
      uncertainty:
        language === "zh"
          ? "低置信度：少于两条证据笔记支撑这个线索。"
          : "Low confidence: fewer than two evidence notes support this clue.",
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
  const relatedNotes = [
    ...backlinks,
    ...links.map((link) => resolveLinkTarget(link, noteByPath)),
    ...commonLinks.map((link) => resolveLinkTarget(link, noteByPath)),
    ...crossFolderLinks,
  ]
    .filter(Boolean)
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .slice(0, 12);

  return {
    id: evidenceNoteId(note.path),
    path: note.path,
    title: titleFromPath(note.path),
    dateSignals,
    excerpt: excerpt(file.content),
    links,
    backlinks,
    commonLinks,
    frontmatterSignals,
    repeatedPhrases,
    questionSentences,
    entities,
    crossFolderLinks,
    weakSignals,
    localSignals: reasons,
    relatedNotes,
    whyIncluded:
      reasons.length > 0
        ? reasons.slice(0, 5).join("; ")
        : "Active note in the review range with local metadata evidence.",
  };
}

function selectDiverseEvidenceNotes(notes: ThemeEvidenceNote[]): ThemeEvidenceNote[] {
  const ranked = [...notes].sort(sortEvidenceNotes);
  const selected: ThemeEvidenceNote[] = [];
  const selectedIds = new Set<string>();

  const add = (note: ThemeEvidenceNote | undefined) => {
    if (!note || selectedIds.has(note.id) || selected.length >= MAX_EVIDENCE_NOTES) {
      return;
    }
    selected.push(note);
    selectedIds.add(note.id);
  };

  add(ranked[0]);

  for (const bucket of buildDiversityBuckets(ranked).values()) {
    add(bucket.sort(sortEvidenceNotes)[0]);
  }

  while (selected.length < MAX_EVIDENCE_NOTES) {
    const next = ranked
      .filter((note) => !selectedIds.has(note.id))
      .sort(
        (a, b) =>
          diversityAdjustedEvidenceScore(b, selected) -
            diversityAdjustedEvidenceScore(a, selected) || a.path.localeCompare(b.path),
      )[0];
    if (!next) {
      break;
    }
    add(next);
  }

  return selected;
}

function buildDiversityBuckets(
  notes: ThemeEvidenceNote[],
): Map<string, ThemeEvidenceNote[]> {
  const buckets = new Map<string, ThemeEvidenceNote[]>();
  for (const note of notes) {
    for (const key of diversityBucketKeys(note)) {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)?.push(note);
    }
  }
  return buckets;
}

function buildPeriodGroups(notes: ThemeEvidenceNote[]): Map<string, ThemeEvidenceNote[]> {
  return groupEvidenceNotesByKeys(notes, timePeriodKeys);
}

function buildFolderGroups(notes: ThemeEvidenceNote[]): Map<string, ThemeEvidenceNote[]> {
  return groupEvidenceNotesByKeys(notes, folderCoverageKeys);
}

function buildConnectionGroups(
  notes: ThemeEvidenceNote[],
): Map<string, ThemeEvidenceNote[]> {
  return groupEvidenceNotesByKeys(notes, connectionClusterKeys);
}

function buildLongTailGroups(
  notes: ThemeEvidenceNote[],
): Map<string, ThemeEvidenceNote[]> {
  return groupEvidenceNotesByKeys(notes, longTailClueKeys);
}

function groupEvidenceNotesByKeys(
  notes: ThemeEvidenceNote[],
  keyBuilder: (note: ThemeEvidenceNote) => string[],
): Map<string, ThemeEvidenceNote[]> {
  const groups = new Map<string, ThemeEvidenceNote[]>();
  for (const note of notes) {
    for (const key of keyBuilder(note)) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(note);
    }
  }
  return groups;
}

function diversityAdjustedEvidenceScore(
  note: ThemeEvidenceNote,
  selected: ThemeEvidenceNote[],
): number {
  const selectedKeys = new Set(selected.flatMap(diversityBucketKeys));
  const novelty = diversityBucketKeys(note).filter(
    (key) => !selectedKeys.has(key),
  ).length;
  return evidenceScore(note) + novelty * 100;
}

function diversityBucketKeys(note: ThemeEvidenceNote): string[] {
  return [
    ...timePeriodKeys(note),
    ...folderCoverageKeys(note),
    ...connectionClusterKeys(note),
    ...longTailClueKeys(note),
  ];
}

function timePeriodKeys(note: ThemeEvidenceNote): string[] {
  return note.dateSignals
    .flatMap((signal) => signal.match(/\d{4}-\d{2}/gu) ?? [])
    .map((period) => `time:${period}`);
}

function folderCoverageKeys(note: ThemeEvidenceNote): string[] {
  return folderParts(note.path).map(
    (folder) => `folder:${normalizeLinkIdentity(folder)}`,
  );
}

function connectionClusterKeys(note: ThemeEvidenceNote): string[] {
  return [
    ...note.commonLinks.map((link) => `common-link:${normalizeLinkIdentity(link)}`),
    ...note.repeatedPhrases.map((phrase) => `phrase:${normalizeLinkIdentity(phrase)}`),
    ...note.entities.map((entity) => `entity:${normalizeLinkIdentity(entity)}`),
    ...note.crossFolderLinks.map((path) => `cross-folder:${normalizeLinkIdentity(path)}`),
  ].slice(0, 12);
}

function longTailClueKeys(note: ThemeEvidenceNote): string[] {
  return [
    note.questionSentences.length > 0 ? "long-tail:question" : "",
    note.frontmatterSignals.length > 0 ? "long-tail:frontmatter" : "",
    note.weakSignals.length > 0 ? "long-tail:weak-signal" : "",
    note.dateSignals.some((signal) => signal.includes("resurfaced old note"))
      ? "long-tail:resurfaced"
      : "",
  ].filter(Boolean);
}

function sortEvidenceNotes(a: ThemeEvidenceNote, b: ThemeEvidenceNote): number {
  return evidenceScore(b) - evidenceScore(a) || a.path.localeCompare(b.path);
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
  language: "en" | "zh",
): ThemeHypothesis {
  const noteIds = [...cluster.noteIds]
    .sort((a, b) => {
      const noteA = noteById.get(a);
      const noteB = noteById.get(b);
      return (noteB ? evidenceScore(noteB) : 0) - (noteA ? evidenceScore(noteA) : 0);
    })
    .slice(0, MAX_EVIDENCE_PER_THEME);
  const signal =
    cluster.kind === "weak-tag"
      ? `weak tag signal "${cluster.label}"`
      : `${cluster.kind} signal "${cluster.label}"`;

  return {
    id: `theme:local:${slug(cluster.key)}`,
    title: localThemeTitle(cluster, language),
    summary:
      language === "zh"
        ? `${noteIds.length} 条证据笔记形成一个待复核的本地语义线索；请结合摘录、链接、日期和跨文件夹关系判断是否能提升为主题。`
        : `${noteIds.length} evidence notes form a local semantic clue; review excerpts, links, dates, and cross-folder relationships before promoting it into a theme.`,
    evidenceNoteIds: noteIds,
    connectionExplanation:
      cluster.kind === "weak-tag"
        ? language === "zh"
          ? "这些笔记共享同类弱标签信号，但标签只作为证据线索；需要结合摘录、链接和日期信号复核。"
          : `These notes share tag "${cluster.label}", but tags are treated as weak evidence and should be confirmed against excerpts, links, and date signals.`
        : language === "zh"
          ? `这些笔记共享同类${localSignalKindLabel(cluster, language)}，并由摘录、链接、反向链接、日期或跨文件夹连接等证据线索支撑。`
          : `These notes share ${signal}, with supporting local metadata such as excerpts, links, backlinks, dates, or cross-folder connections.`,
    localSignals: noteIds
      .flatMap((id) => noteById.get(id)?.localSignals ?? [])
      .filter((signal, index, signals) => signals.indexOf(signal) === index)
      .slice(0, 8),
    uncertainty: lowConfidence
      ? language === "zh"
        ? "低置信度：少于两条证据笔记支撑这个线索。"
        : "Low confidence: fewer than two evidence notes support this clue."
      : undefined,
    source: "local",
  };
}

function toThemeHypothesis(
  value: unknown,
  index: number,
  validIds: Set<string>,
  idByPath: Map<string, string>,
  noteById: Map<string, ThemeEvidenceNote>,
): ThemeHypothesis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = stringValue(record.title);
  const summary = stringValue(record.summary) || stringValue(record.synthesis);
  const reportNarrative =
    stringValue(record.reportNarrative) ||
    stringValue(record.narrativeDraft) ||
    stringValue(record.reportDraft);
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
  const localSignals = normalizedSignalList(record.localSignals);
  return {
    id: stringValue(record.id) || `theme:ai:${index + 1}`,
    title,
    summary,
    reportNarrative: reportNarrative || undefined,
    evidenceNoteIds,
    connectionExplanation,
    localSignals:
      localSignals.length > 0
        ? localSignals
        : evidenceNoteIds
            .flatMap((id) => noteById.get(id)?.localSignals ?? [])
            .filter(
              (signal, signalIndex, signals) => signals.indexOf(signal) === signalIndex,
            )
            .slice(0, 8),
    uncertainty:
      evidenceNoteIds.length < 2 && !uncertainty
        ? "Low confidence: fewer than two evidence notes support this hypothesis."
        : uncertainty || undefined,
    source: sourceValue(record.source),
  };
}

function buildEvidenceReferenceIndex(notes: ThemeEvidenceNote[]): Map<string, string> {
  const idsByReference = new Map<string, Set<string>>();
  const addReference = (reference: string, id: string) => {
    const normalized = normalizeEvidenceReference(reference);
    if (!normalized) return;
    if (!idsByReference.has(normalized)) {
      idsByReference.set(normalized, new Set());
    }
    idsByReference.get(normalized)?.add(id);
  };

  for (const note of notes) {
    addReference(note.path, note.id);
    addReference(note.path.replace(/\.md$/iu, ""), note.id);
    addReference(note.title, note.id);
  }

  return new Map(
    [...idsByReference.entries()]
      .filter(([, ids]) => ids.size === 1)
      .map(([reference, ids]) => [reference, [...ids][0] as string]),
  );
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

function localThemeTitle(cluster: ThemeCluster, language: "en" | "zh"): string {
  switch (cluster.kind) {
    case "link":
      return language === "zh"
        ? "围绕同一对象反复展开的记录"
        : `Evidence pattern around ${titleFromPath(cluster.label)}`;
    case "phrase":
      return language === "zh"
        ? "反复出现的想法线索"
        : `Recurring idea: ${cluster.label}`;
    case "entity":
      return language === "zh"
        ? "多篇笔记里的重复指称线索"
        : `Repeated reference needing interpretation`;
    case "folder":
      return language === "zh"
        ? "同一空间中的跨笔记线索"
        : `Cross-note theme in ${titleFromPath(cluster.label)}`;
    case "weak-tag":
      return language === "zh" ? "低置信度本地线索" : `Low-confidence local clue`;
    case "note":
      return language === "zh"
        ? "需要复核的单篇笔记线索"
        : `Single-note clue needing review`;
  }
}

function localSignalKindLabel(cluster: ThemeCluster, language: "en" | "zh"): string {
  if (language !== "zh") {
    return `${cluster.kind} signal`;
  }
  switch (cluster.kind) {
    case "link":
      return "链接信号";
    case "phrase":
      return "重复短语";
    case "entity":
      return "重复指称";
    case "folder":
      return "文件夹信号";
    case "weak-tag":
      return "弱标签信号";
    case "note":
      return "单篇笔记信号";
  }
}

function normalizedSignalList(value: unknown): string[] {
  return arrayValue(value).map(stringValue).filter(Boolean).slice(0, 8);
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

function sourceValue(value: unknown): ThemeHypothesisSource {
  return value === "local" || value === "ai" || value === "mixed" ? value : "ai";
}

function sanitizeInlineText(value: string, maxLength: number): string {
  return value
    .replace(
      /\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu,
      (_match, path: string, suffix = "") => `[[${path}${suffix}]]`,
    )
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
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
