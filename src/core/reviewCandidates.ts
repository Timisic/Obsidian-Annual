import {
  calculateReviewProgress,
  mergeScannedCandidates,
  type EvidenceSource,
  type ReviewCandidate,
  type ReviewSessionState,
} from "./reviewState";
import { normalizeReviewCandidateTitle } from "./reviewTitle";
import type { TopTopic, YearAggregate } from "./types";

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

function buildReviewCandidates(aggregate: YearAggregate): ReviewCandidate[] {
  return aggregate.topicEvolution.topTopics
    .flatMap((topic, index) => topicCandidate(aggregate, topic, index))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id));
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
