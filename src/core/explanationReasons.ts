import type { ExplanationReason } from "./types";

export type TraceableExplanationReason = ExplanationReason &
  (
    | { sourcePath: string }
    | { statField: string }
    | { relatedPaths: [string, ...string[]] }
  );

export function isTraceableExplanationReason(
  reason: ExplanationReason,
): reason is TraceableExplanationReason {
  return Boolean(
    reason.sourcePath?.trim() ||
    reason.statField?.trim() ||
    (reason.relatedPaths && reason.relatedPaths.length > 0),
  );
}

export function assertExplanationReasonsTraceable(
  candidateId: string,
  reasons: ExplanationReason[],
): void {
  if (reasons.length === 0) {
    throw new Error(
      `Review candidate ${candidateId} must include at least one explanation reason.`,
    );
  }

  for (const reason of reasons) {
    if (!isTraceableExplanationReason(reason)) {
      throw new Error(
        `Review candidate ${candidateId} has an explanation reason without traceable evidence.`,
      );
    }
  }
}
