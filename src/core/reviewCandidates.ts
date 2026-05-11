import {
  calculateReviewProgress,
  mergeScannedCandidates,
  type EvidenceSource,
  type ReviewCandidate,
  type ReviewSessionState,
} from "./reviewState";
import { normalizeReviewCandidateTitle } from "./reviewTitle";
import { buildLocalThemeHypotheses } from "./themeEvidence";
import type {
  ThemeEvidenceNote,
  ThemeEvidencePackage,
  ThemeHypothesis,
  TopTopic,
  YearAggregate,
} from "./types";

export interface BuildReviewSessionOptions {
  themeHypotheses?: ThemeHypothesis[];
  evidencePackage?: ThemeEvidencePackage;
  language?: "en" | "zh";
}

export function buildReviewSession(
  aggregate: YearAggregate,
  stored?: ReviewSessionState,
  options: BuildReviewSessionOptions = {},
): ReviewSessionState {
  const scopeHash = reviewScopeHash(aggregate);
  const scanId = `${aggregate.year}:${scopeHash}:${aggregate.generatedAt}`;
  const scannedCandidates = buildReviewCandidates(aggregate, options);
  if (
    stored &&
    stored.schemaVersion === 1 &&
    stored.year === aggregate.year &&
    (!stored.session || stored.session.id === aggregate.session.id) &&
    stored.scopeHash === scopeHash
  ) {
    return mergeScannedCandidates(
      { ...stored, session: aggregate.session },
      scannedCandidates,
      scanId,
      aggregate.generatedAt,
    );
  }
  return {
    schemaVersion: 1,
    year: aggregate.year,
    session: aggregate.session,
    scopeHash,
    scanId,
    candidates: scannedCandidates,
    decisions: [],
    progress: calculateReviewProgress(scannedCandidates),
    createdAt: aggregate.generatedAt,
    updatedAt: aggregate.generatedAt,
  };
}

export function reviewScopeHash(aggregate: YearAggregate): string {
  return stableHash(
    JSON.stringify({
      year: aggregate.year,
      preset: aggregate.session.preset,
      label: aggregate.session.label,
      startDate: aggregate.session.startDate,
      endDate: aggregate.session.endDate,
      includeFolders: [...aggregate.scope.includeFolders].sort(),
      excludeFolders: [...aggregate.scope.excludeFolders].sort(),
      excludePatterns: [...aggregate.scope.excludePatterns].sort(),
      reportFolder: aggregate.scope.reportFolder,
      privacyMode: aggregate.scope.privacyMode,
    }),
  );
}

function buildReviewCandidates(
  aggregate: YearAggregate,
  options: BuildReviewSessionOptions,
): ReviewCandidate[] {
  const evidencePackage = options.evidencePackage;
  const suppliedThemes = options.themeHypotheses ?? [];
  const themes =
    suppliedThemes.length > 0
      ? suppliedThemes
      : evidencePackage
        ? buildLocalThemeHypotheses(evidencePackage, options.language)
        : [];
  const evidenceById = new Map(
    evidencePackage?.evidenceNotes.map((note) => [note.id, note]) ?? [],
  );

  if (themes.length > 0) {
    return themes
      .map((theme, index) => themeCandidate(aggregate, theme, index, evidenceById))
      .filter((candidate): candidate is ReviewCandidate => Boolean(candidate))
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id));
  }

  return aggregate.topicEvolution.topTopics
    .flatMap((topic, index) => topicCandidate(aggregate, topic, index))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id));
}

function themeCandidate(
  aggregate: YearAggregate,
  theme: ThemeHypothesis,
  index: number,
  evidenceById: Map<string, ThemeEvidenceNote>,
): ReviewCandidate | null {
  const sourcePaths = theme.evidenceNoteIds
    .map((id) => evidenceById.get(id)?.path)
    .filter((path): path is string => Boolean(path));
  if (sourcePaths.length === 0) {
    return null;
  }
  const title = normalizeReviewCandidateTitle(theme.title);
  const id = candidateId(aggregate.session.id, theme.id || title);
  const evidence: EvidenceSource[] = theme.evidenceNoteIds.flatMap(
    (noteId, evidenceIndex) => {
      const note = evidenceById.get(noteId);
      if (!note) {
        return [];
      }
      return [
        {
          id: `${id}:evidence:${evidenceIndex + 1}`,
          kind: "note",
          label: note.title,
          target: note.path,
          sourcePath: note.path,
          excerpt: note.excerpt,
          reason: note.whyIncluded,
        } satisfies EvidenceSource,
      ];
    },
  );
  if (evidence.length === 0) {
    return null;
  }
  const localSignals =
    theme.localSignals.length > 0
      ? theme.localSignals
      : evidence.map((item) => item.reason ?? "").filter(Boolean);
  return {
    id,
    type: "theme-hypothesis",
    title,
    reason: theme.summary,
    aiSummary: theme.summary,
    connectionExplanation: theme.connectionExplanation,
    localSignals,
    uncertainty: theme.uncertainty,
    source: theme.source,
    reasons: evidence.map((item, reasonIndex) => ({
      type: "topic-bridge",
      label:
        localSignals[reasonIndex % Math.max(1, localSignals.length)] ??
        theme.connectionExplanation,
      evidenceId: item.id,
      sourcePath: item.sourcePath ?? sourcePaths[0] ?? "",
      relatedPaths: sourcePaths.filter((path) => path !== item.sourcePath),
      statField: "connectedTopicCount",
    })),
    status: "candidate",
    evidence,
    sourcePaths,
    score: Math.max(1, evidence.length * 100 - index),
    rank: index + 1,
    rankReason:
      theme.source === "ai"
        ? "Ranked by AI semantic theme order from the bounded evidence package."
        : "Ranked by local evidence-cluster strength from the bounded evidence package.",
    decisionIds: [],
    createdAt: aggregate.generatedAt,
    updatedAt: aggregate.generatedAt,
  };
}

function topicCandidate(
  aggregate: YearAggregate,
  topic: TopTopic,
  index: number,
): ReviewCandidate[] {
  const sourcePaths = topic.representativeNotes.slice(0, 5);
  if (sourcePaths.length === 0) {
    return [];
  }
  const title = normalizeReviewCandidateTitle(topic.name);
  const id = candidateId(aggregate.session.id, topic.name);
  const evidence: EvidenceSource[] = sourcePaths.map((path, evidenceIndex) => ({
    id: `${id}:evidence:${evidenceIndex + 1}`,
    kind: "note",
    label: path,
    target: path,
    sourcePath: path,
    reason: `${title} representative source note.`,
  }));
  return [
    {
      id,
      type: "theme-hypothesis",
      title,
      reason: `${title} added ${topic.addedWords} words across ${topic.newNotes} new notes and ${topic.updatedNotes} updated notes.`,
      aiSummary: `${title} is a legacy activity-derived clue and should be regenerated from the bounded evidence package before final review.`,
      connectionExplanation:
        "Legacy topic-evolution fallback; use only when semantic evidence-package hypotheses are unavailable.",
      localSignals: [
        `topic growth: ${topic.addedWords} words`,
        `new notes: ${topic.newNotes}`,
        `updated notes: ${topic.updatedNotes}`,
      ],
      uncertainty:
        "Fallback clue: regenerate semantic theme hypotheses before relying on this candidate.",
      source: "local-fallback",
      reasons: evidence.map((item) => ({
        type: "word-count",
        label: `${title} evidence appears in ${item.sourcePath}.`,
        evidenceId: item.id,
        sourcePath: item.sourcePath ?? sourcePaths[0] ?? "",
        statField: "wordCount",
      })),
      status: "candidate",
      evidence,
      sourcePaths,
      score: topic.addedWords + topic.newNotes * 10 + topic.updatedNotes,
      rank: index + 1,
      rankReason: "Legacy fallback ranked by topic growth and representative notes.",
      decisionIds: [],
      createdAt: aggregate.generatedAt,
      updatedAt: aggregate.generatedAt,
    },
  ];
}

function candidateId(sessionId: string, value: string): string {
  return `review:${slug(sessionId)}:theme-hypothesis:${slug(value)}`;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
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
