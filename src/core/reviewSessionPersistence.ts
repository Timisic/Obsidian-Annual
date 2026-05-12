import { calculateReviewProgress, type ReviewSessionState } from "./reviewState";

export function normalizeReviewSessions(
  sessions?: Record<string, ReviewSessionState>,
): Record<string, ReviewSessionState> {
  if (!sessions) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(sessions)
      .filter(([, session]) =>
        Boolean(
          session &&
          session.schemaVersion === 1 &&
          session.candidates.every((candidate) => candidate.type === "theme-hypothesis"),
        ),
      )
      .map(([key, session]) => [key, normalizeReviewSession(session)]),
  );
}

function normalizeReviewSession(session: ReviewSessionState): ReviewSessionState {
  const hasAiPrimary = session.candidates.some((candidate) => candidate.source === "ai");
  const mixedLocalPrimary = session.candidates.filter((candidate) =>
    isLocalReviewCandidate(candidate),
  );
  if (!hasAiPrimary || mixedLocalPrimary.length === 0) {
    return session;
  }
  const candidates = session.candidates.filter(
    (candidate) => !isLocalReviewCandidate(candidate),
  );
  const localFallbackCandidates = [
    ...(session.localFallbackCandidates ?? []),
    ...mixedLocalPrimary,
  ];
  return {
    ...session,
    candidates,
    localFallbackCandidates,
    themeGeneration: session.themeGeneration ?? {
      mode: "ai",
      aiConfigured: true,
      aiAttempted: true,
      message:
        "Older local Review Board candidates were moved out of the primary AI queue.",
    },
    progress: calculateReviewProgress(candidates),
  };
}

function isLocalReviewCandidate(
  candidate: ReviewSessionState["candidates"][number],
): boolean {
  return candidate.source === "local" || candidate.source === "local-fallback";
}
