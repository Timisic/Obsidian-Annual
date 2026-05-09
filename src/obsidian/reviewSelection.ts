import type { ReviewAction, ReviewCandidate } from "../core/reviewState";

export function isPendingReviewQueueCandidate(candidate: ReviewCandidate): boolean {
  return candidate.status === "candidate" && candidate.type !== "topic";
}

export function isReviewBoardQueueCandidate(candidate: ReviewCandidate): boolean {
  return candidate.status !== "candidate" || isPendingReviewQueueCandidate(candidate);
}

export function getActionCandidateId(action: ReviewAction): string | null {
  if (action.type === "merge-topic") {
    return action.sourceCandidateId;
  }
  if (action.type === "open-source-note") {
    return null;
  }
  return action.candidateId;
}

export function getNextReviewSelection(
  candidates: ReviewCandidate[],
  completedCandidateId: string,
): string | null {
  const pending = candidates.find(
    (candidate) =>
      isPendingReviewQueueCandidate(candidate) && candidate.id !== completedCandidateId,
  );
  if (pending) {
    return pending.id;
  }

  return (
    candidates.find(
      (candidate) =>
        isReviewBoardQueueCandidate(candidate) && candidate.id !== completedCandidateId,
    )?.id ?? null
  );
}
