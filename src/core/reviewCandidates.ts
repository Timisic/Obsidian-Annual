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
  YearAggregate,
} from "./types";

export function buildReviewSession(
  aggregate: YearAggregate,
  stored?: ReviewSessionState,
  evidencePackage?: ThemeEvidencePackage,
): ReviewSessionState {
  const scopeHash = reviewScopeHash(aggregate);
  const scanId = `${aggregate.year}:${scopeHash}:${aggregate.generatedAt}`;
  const scannedCandidates = buildReviewCandidates(aggregate, evidencePackage);
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
  evidencePackage?: ThemeEvidencePackage,
): ReviewCandidate[] {
  if (!evidencePackage) {
    return [];
  }
  return buildLocalThemeHypotheses(evidencePackage)
    .flatMap((theme, index) => themeCandidate(aggregate, theme, index))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id));
}

function themeCandidate(
  aggregate: YearAggregate,
  theme: ThemeHypothesis,
  index: number,
): ReviewCandidate[] {
  const sourcePaths = theme.sourcePaths.slice(0, 5);
  if (sourcePaths.length === 0) {
    return [];
  }
  const title = normalizeReviewCandidateTitle(theme.title);
  const id = candidateId(aggregate.session.id, theme.id);
  const evidence = theme.evidenceNotes.map((note, evidenceIndex) =>
    evidenceFromThemeNote(id, note, evidenceIndex),
  );
  return [
    {
      id,
      type: "theme-hypothesis",
      title,
      reason: theme.summary,
      reasons: evidence.map((item) => ({
        type: "topic-bridge",
        label: theme.connectionExplanation,
        evidenceId: item.id,
        sourcePath: item.sourcePath ?? sourcePaths[0] ?? "",
        relatedPaths: sourcePaths.filter((path) => path !== item.sourcePath),
      })),
      status: "candidate",
      evidence,
      sourcePaths,
      score: theme.evidenceNoteIds.length * 10 + theme.localSignals.length,
      rank: index + 1,
      rankReason:
        theme.uncertainty ??
        "Ranked by evidence-note count and local connection signals.",
      decisionIds: [],
      createdAt: aggregate.generatedAt,
      updatedAt: aggregate.generatedAt,
    },
  ];
}

function evidenceFromThemeNote(
  candidateIdValue: string,
  note: ThemeEvidenceNote,
  index: number,
): EvidenceSource {
  return {
    id: `${candidateIdValue}:evidence:${index + 1}`,
    kind: "note",
    label: note.title,
    target: note.sourcePath,
    sourcePath: note.sourcePath,
    excerpt: note.excerpt,
    reason: note.whyIncluded,
  };
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
