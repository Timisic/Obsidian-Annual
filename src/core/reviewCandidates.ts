import {
  calculateReviewProgress,
  mergeScannedCandidates,
  type EvidenceSource,
  type EvidenceSourceKind,
  type ReviewCandidate,
  type ReviewCandidateType,
  type ReviewSessionState,
} from "./reviewState";
import { normalizeReviewCandidateTitle } from "./reviewTitle";
import type { ExplanationReason, HighValueNote, TopTopic, YearAggregate } from "./types";

export function buildReviewSession(
  aggregate: YearAggregate,
  stored?: ReviewSessionState,
): ReviewSessionState {
  const scopeHash = reviewScopeHash(aggregate);
  const scanId = `${aggregate.year}:${scopeHash}:${aggregate.generatedAt}`;
  const scannedCandidates = buildReviewCandidates(aggregate);
  if (
    stored &&
    stored.schemaVersion === 1 &&
    stored.year === aggregate.year &&
    stored.scopeHash === scopeHash
  ) {
    return mergeScannedCandidates(
      stored,
      scannedCandidates,
      scanId,
      aggregate.generatedAt,
    );
  }
  return {
    schemaVersion: 1,
    year: aggregate.year,
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
      includeFolders: [...aggregate.scope.includeFolders].sort(),
      excludeFolders: [...aggregate.scope.excludeFolders].sort(),
      excludePatterns: [...aggregate.scope.excludePatterns].sort(),
      reportFolder: aggregate.scope.reportFolder,
      privacyMode: aggregate.scope.privacyMode,
    }),
  );
}

function buildReviewCandidates(aggregate: YearAggregate): ReviewCandidate[] {
  return [
    ...aggregate.topicEvolution.topTopics.flatMap((topic, index) =>
      topicCandidate(aggregate, topic, index),
    ),
    ...aggregate.highValueNotes.map((note, index) =>
      highValueNoteCandidate(aggregate, note, index),
    ),
  ].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id));
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
  const id = candidateId(aggregate.year, "topic", topic.name);
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
      type: "topic",
      title,
      reason: `${title} added ${topic.addedWords} words across ${topic.newNotes} new notes and ${topic.updatedNotes} updated notes.`,
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
      rankReason: "Ranked by topic growth and representative notes.",
      decisionIds: [],
      createdAt: aggregate.generatedAt,
      updatedAt: aggregate.generatedAt,
    },
  ];
}

function highValueNoteCandidate(
  aggregate: YearAggregate,
  note: HighValueNote,
  index: number,
): ReviewCandidate {
  const id = candidateId(aggregate.year, noteCandidateType(note), note.path);
  const evidence = evidenceFromReasons(id, note);
  const reasons = traceableReasons(note, evidence[0]);
  return {
    id,
    type: noteCandidateType(note),
    title: note.title,
    reason: note.reason,
    reasons,
    status: "candidate",
    evidence,
    sourcePaths: [note.path],
    score: note.inboundLinks * 10 + note.outboundLinks * 4 + note.periodWordCount,
    rank: 100 + index + 1,
    rankReason: `${note.suggestionLabel}; ${note.kind}; ${note.suggestedAction}`,
    decisionIds: [],
    createdAt: aggregate.generatedAt,
    updatedAt: aggregate.generatedAt,
  };
}

function noteCandidateType(note: HighValueNote): ReviewCandidateType {
  if (note.suggestionLabel === "possible-bridge" || note.kind === "桥接笔记") {
    return "bridge-note";
  }
  if (note.kind === "需维护") {
    return "dormant-note";
  }
  return "note";
}

function evidenceFromReasons(id: string, note: HighValueNote): EvidenceSource[] {
  const evidence = note.reasons
    .map((reason, index) => {
      const sourcePath = reason.sourcePath ?? reason.relatedPaths?.[0] ?? note.path;
      return {
        id: `${id}:evidence:${index + 1}`,
        kind: evidenceKind(reason),
        label: reason.label,
        target: sourcePath,
        sourcePath,
        reason: reason.statField ? `${reason.type}; ${reason.statField}` : reason.type,
      } satisfies EvidenceSource;
    })
    .filter((item) => item.sourcePath);
  return evidence.length > 0
    ? evidence
    : [
        {
          id: `${id}:evidence:1`,
          kind: "note",
          label: note.path,
          target: note.path,
          sourcePath: note.path,
          reason: note.suggestedAction,
        },
      ];
}

function traceableReasons(
  note: HighValueNote,
  fallbackEvidence?: EvidenceSource,
): ExplanationReason[] {
  const reasons = note.reasons.filter(
    (reason) =>
      reason.sourcePath ||
      reason.statField ||
      (reason.relatedPaths && reason.relatedPaths.length > 0),
  );
  if (reasons.length > 0) {
    return reasons;
  }
  return [
    {
      type: "word-count",
      label: note.reason,
      evidenceId: fallbackEvidence?.id ?? `${note.path}:evidence`,
      sourcePath: note.path,
      statField: "wordCount",
    },
  ];
}

function evidenceKind(reason: ExplanationReason): EvidenceSourceKind {
  switch (reason.type) {
    case "backlink":
    case "outlink":
    case "topic-bridge":
      return "link";
    case "task":
      return "task";
    case "tag":
      return "tag";
    case "updated-at":
    case "dormant":
      return "timeline";
    default:
      return "note";
  }
}

function candidateId(year: number, type: ReviewCandidateType, value: string): string {
  return `review:${year}:${type}:${slug(value)}`;
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
