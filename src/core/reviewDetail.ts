import type { EvidenceSource, ReviewCandidate } from "./reviewState";

const INLINE_LINK_LIMIT = 3;
const SUMMARY_LIMIT = 220;

export interface ReviewLinkedNotes {
  paths: string[];
  layout: "inline" | "list";
}

export interface ReviewDetailModel {
  summary: string;
  metadata: string[];
  evidence: EvidenceSource[];
  linkedNotes: ReviewLinkedNotes;
}

export function buildReviewDetailModel(candidate: ReviewCandidate): ReviewDetailModel {
  const linkedPaths = uniqueNonEmpty([
    ...candidate.sourcePaths,
    ...candidate.evidence.flatMap((item) => [
      item.sourcePath,
      markdownTarget(item.target),
    ]),
    ...candidate.reasons.flatMap((reason) => [
      reason.sourcePath,
      ...(reason.relatedPaths ?? []),
    ]),
  ]);

  return {
    summary: summarizeCandidate(candidate),
    metadata: candidateMetadata(candidate),
    evidence: candidate.evidence,
    linkedNotes: {
      paths: linkedPaths,
      layout: linkedPaths.length > INLINE_LINK_LIMIT ? "list" : "inline",
    },
  };
}

function summarizeCandidate(candidate: ReviewCandidate): string {
  const excerpt =
    candidate.evidence.find((item) => item.excerpt?.trim())?.excerpt ??
    candidate.reason ??
    candidate.rankReason ??
    candidate.title;
  return conciseText(excerpt);
}

function candidateMetadata(candidate: ReviewCandidate): string[] {
  return [
    `${candidate.type} / ${candidate.status}`,
    candidate.rank ? `rank ${candidate.rank}` : "",
    candidate.rankReason ? conciseText(candidate.rankReason, 140) : "",
  ].filter(Boolean);
}

function markdownTarget(target: string): string {
  return target.endsWith(".md") ? target : "";
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function conciseText(value: string, limit = SUMMARY_LIMIT): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}...`;
}
