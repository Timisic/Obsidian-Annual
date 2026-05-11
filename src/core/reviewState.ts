import type { ExplanationReason } from "./types";
import type { ReviewSession } from "./types";

export type ReviewCandidateType = "theme-hypothesis";

export type ReviewCandidateStatus =
  | "candidate"
  | "accepted"
  | "renamed"
  | "merged"
  | "ignored";

export type EvidenceSourceKind =
  | "note"
  | "tag"
  | "link"
  | "task"
  | "timeline"
  | "folder"
  | "excerpt";

export interface EvidenceSource {
  id: string;
  kind: EvidenceSourceKind;
  label: string;
  target: string;
  sourcePath?: string;
  excerpt?: string;
  reason?: string;
  missing?: boolean;
}

export interface ReviewDecision {
  id: string;
  candidateId: string;
  action: "accept" | "rename" | "merge" | "ignore" | "custom";
  label: string;
  note?: string;
  evidence: EvidenceSource[];
  includeInReport: boolean;
  createdAt: string;
}

export interface ReviewCandidate {
  id: string;
  type: ReviewCandidateType;
  title: string;
  reason: string;
  aiSummary?: string;
  connectionExplanation?: string;
  localSignals?: string[];
  uncertainty?: string;
  source?: string;
  reasons: ExplanationReason[];
  status: ReviewCandidateStatus;
  evidence: EvidenceSource[];
  sourcePaths: string[];
  score?: number;
  rank?: number;
  rankReason?: string;
  userTitle?: string;
  userNote?: string;
  mergedIntoId?: string;
  mergedSourceIds?: string[];
  decisionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
  candidate: number;
  accepted: number;
  renamed: number;
  merged: number;
  ignored: number;
}

export interface ReviewSessionState {
  schemaVersion: 1;
  year: number;
  session?: ReviewSession;
  scopeHash: string;
  scanId: string;
  candidates: ReviewCandidate[];
  decisions: ReviewDecision[];
  progress: ReviewProgress;
  createdAt: string;
  updatedAt: string;
}

export type ReviewAction =
  | { type: "accept"; candidateId: string; at: string }
  | { type: "ignore"; candidateId: string; at: string; note?: string }
  | {
      type: "merge-topic";
      sourceCandidateId: string;
      targetCandidateId: string;
      at: string;
      note?: string;
    }
  | {
      type: "rename-topic";
      candidateId: string;
      title: string;
      at: string;
      note?: string;
    }
  | { type: "open-source-note"; candidateId: string; evidenceId?: string };

const USER_DECIDED_STATUSES = new Set<ReviewCandidateStatus>([
  "accepted",
  "renamed",
  "merged",
  "ignored",
]);

export function assertCandidateHasEvidence(candidate: ReviewCandidate): void {
  if (candidate.evidence.length === 0) {
    throw new Error(
      `Review candidate ${candidate.id} must include at least one evidence source.`,
    );
  }
  if (candidate.reasons.length === 0) {
    throw new Error(
      `Review candidate ${candidate.id} must include at least one explanation reason.`,
    );
  }
  for (const reason of candidate.reasons) {
    if (
      !reason.sourcePath &&
      !reason.statField &&
      (!reason.relatedPaths || reason.relatedPaths.length === 0)
    ) {
      throw new Error(
        `Review candidate ${candidate.id} has an explanation reason without traceable evidence.`,
      );
    }
  }
}

export function applyReviewAction(
  session: ReviewSessionState,
  action: ReviewAction,
): ReviewSessionState {
  if (action.type === "open-source-note") {
    return session;
  }

  const candidates = session.candidates.map((candidate) => ({
    ...candidate,
    evidence: [...candidate.evidence],
    decisionIds: [...candidate.decisionIds],
  }));
  const decisions = [...session.decisions];
  const findCandidate = (id: string) => {
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate) {
      throw new Error(`Unknown review candidate: ${id}`);
    }
    return candidate;
  };

  if (action.type === "merge-topic") {
    const source = findCandidate(action.sourceCandidateId);
    const target = findCandidate(action.targetCandidateId);
    if (source.type !== "theme-hypothesis" || target.type !== "theme-hypothesis") {
      throw new Error(
        "merge-topic requires both source and target candidates to be theme hypotheses.",
      );
    }
    source.status = "merged";
    source.mergedIntoId = target.id;
    source.userNote = action.note ?? source.userNote;
    source.updatedAt = action.at;
    target.mergedSourceIds = [...new Set([...(target.mergedSourceIds ?? []), source.id])];
    target.evidence = mergeEvidence(target.evidence, source.evidence);
    target.updatedAt = action.at;
    const decision = buildReviewDecision({
      candidateId: source.id,
      action: "merge",
      label: `${displayCandidateTitle(source)} -> ${displayCandidateTitle(target)}`,
      note: action.note,
      evidence: source.evidence,
      includeInReport: true,
      at: action.at,
      targetCandidateId: target.id,
    });
    recordDecision(decisions, [source, target], decision);
    return refreshSession({ ...session, candidates, decisions, updatedAt: action.at });
  }

  const candidate = findCandidate(action.candidateId);

  switch (action.type) {
    case "accept":
      candidate.status = "accepted";
      candidate.updatedAt = action.at;
      recordDecision(
        decisions,
        [candidate],
        buildReviewDecision({
          candidateId: candidate.id,
          action: "accept",
          label: displayCandidateTitle(candidate),
          evidence: candidate.evidence,
          includeInReport: true,
          at: action.at,
        }),
      );
      break;
    case "ignore":
      candidate.status = "ignored";
      candidate.userNote = action.note ?? candidate.userNote;
      candidate.updatedAt = action.at;
      recordDecision(
        decisions,
        [candidate],
        buildReviewDecision({
          candidateId: candidate.id,
          action: "ignore",
          label: displayCandidateTitle(candidate),
          note: action.note,
          evidence: candidate.evidence,
          includeInReport: false,
          at: action.at,
        }),
      );
      break;
    case "rename-topic":
      if (candidate.type !== "theme-hypothesis") {
        throw new Error("rename-topic requires a theme hypothesis candidate.");
      }
      if (action.title.trim().length === 0) {
        throw new Error("rename-topic requires a non-empty title.");
      }
      candidate.status = "renamed";
      candidate.userTitle = action.title.trim();
      candidate.userNote = action.note ?? candidate.userNote;
      candidate.updatedAt = action.at;
      recordDecision(
        decisions,
        [candidate],
        buildReviewDecision({
          candidateId: candidate.id,
          action: "rename",
          label: candidate.userTitle,
          note: action.note,
          evidence: candidate.evidence,
          includeInReport: true,
          at: action.at,
        }),
      );
      break;
  }

  return refreshSession({
    ...session,
    candidates,
    decisions,
    updatedAt: "at" in action ? action.at : session.updatedAt,
  });
}

export function mergeScannedCandidates(
  stored: ReviewSessionState,
  scannedCandidates: ReviewCandidate[],
  scanId: string,
  updatedAt: string,
): ReviewSessionState {
  const scanHasAiThemes = scannedCandidates.some(
    (candidate) => candidate.source === "ai",
  );
  const scannedById = new Map(
    scannedCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const candidates = stored.candidates
    .map((storedCandidate) => {
      const scanned = scannedById.get(storedCandidate.id);
      if (!scanned) {
        return storedCandidate.status === "candidate" ||
          isLegacyThinCandidate(storedCandidate) ||
          (scanHasAiThemes && storedCandidate.source !== "ai")
          ? undefined
          : markMissingEvidence(storedCandidate, updatedAt);
      }
      scannedById.delete(storedCandidate.id);
      assertCandidateHasEvidence(scanned);
      if (USER_DECIDED_STATUSES.has(storedCandidate.status)) {
        return {
          ...scanned,
          status: storedCandidate.status,
          userTitle: storedCandidate.userTitle,
          userNote: storedCandidate.userNote,
          mergedIntoId: storedCandidate.mergedIntoId,
          mergedSourceIds: storedCandidate.mergedSourceIds,
          decisionIds: storedCandidate.decisionIds,
          createdAt: storedCandidate.createdAt,
          updatedAt,
        };
      }
      return { ...scanned, createdAt: storedCandidate.createdAt, updatedAt };
    })
    .filter((candidate): candidate is ReviewCandidate => candidate !== undefined);

  for (const candidate of scannedById.values()) {
    assertCandidateHasEvidence(candidate);
    candidates.push(candidate);
  }

  return refreshSession({ ...stored, scanId, candidates, updatedAt });
}

export function calculateReviewProgress(candidates: ReviewCandidate[]): ReviewProgress {
  const progress: ReviewProgress = {
    total: candidates.length,
    reviewed: 0,
    candidate: 0,
    accepted: 0,
    renamed: 0,
    merged: 0,
    ignored: 0,
  };

  for (const candidate of candidates) {
    switch (candidate.status) {
      case "candidate":
        progress.candidate += 1;
        break;
      case "accepted":
        progress.accepted += 1;
        progress.reviewed += 1;
        break;
      case "renamed":
        progress.renamed += 1;
        progress.reviewed += 1;
        break;
      case "merged":
        progress.merged += 1;
        progress.reviewed += 1;
        break;
      case "ignored":
        progress.ignored += 1;
        progress.reviewed += 1;
        break;
    }
  }

  return progress;
}

function refreshSession(session: ReviewSessionState): ReviewSessionState {
  for (const candidate of session.candidates) {
    assertCandidateHasEvidence(candidate);
  }
  return {
    ...session,
    progress: calculateReviewProgress(session.candidates),
  };
}

function mergeEvidence(
  targetEvidence: EvidenceSource[],
  sourceEvidence: EvidenceSource[],
): EvidenceSource[] {
  const merged = new Map(targetEvidence.map((evidence) => [evidence.id, evidence]));
  for (const evidence of sourceEvidence) {
    if (!merged.has(evidence.id)) {
      merged.set(evidence.id, evidence);
    }
  }
  return [...merged.values()];
}

function buildReviewDecision(input: {
  candidateId: string;
  action: ReviewDecision["action"];
  label: string;
  note?: string;
  evidence: EvidenceSource[];
  includeInReport: boolean;
  at: string;
  targetCandidateId?: string;
}): ReviewDecision {
  return {
    id: ["decision", input.action, input.candidateId, input.targetCandidateId, input.at]
      .filter(Boolean)
      .join(":"),
    candidateId: input.candidateId,
    action: input.action,
    label: input.label,
    note: input.note,
    evidence: input.evidence.map((evidence) => ({ ...evidence })),
    includeInReport: input.includeInReport,
    createdAt: input.at,
  };
}

function recordDecision(
  decisions: ReviewDecision[],
  candidates: ReviewCandidate[],
  decision: ReviewDecision,
): void {
  decisions.push(decision);
  for (const candidate of candidates) {
    candidate.decisionIds = [...new Set([...candidate.decisionIds, decision.id])];
  }
}

function displayCandidateTitle(candidate: ReviewCandidate): string {
  return candidate.userTitle || candidate.title;
}

function markMissingEvidence(
  candidate: ReviewCandidate,
  updatedAt: string,
): ReviewCandidate {
  return {
    ...candidate,
    evidence: candidate.evidence.map((evidence) => ({ ...evidence, missing: true })),
    updatedAt,
  };
}

function isLegacyThinCandidate(candidate: ReviewCandidate): boolean {
  return (
    candidate.type === "theme-hypothesis" &&
    !candidate.aiSummary &&
    !candidate.connectionExplanation &&
    (!candidate.localSignals || candidate.localSignals.length === 0)
  );
}
