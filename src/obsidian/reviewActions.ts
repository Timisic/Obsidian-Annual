import type { ReviewCandidate } from "../core/reviewState";

export type ReviewBoardActionId =
  | "accept"
  | "addHighlight"
  | "addAction"
  | "ignore"
  | "openSourceNote"
  | "renameTopic"
  | "mergeTopic";

export type ReviewBoardActionKind = "pending" | "accepted" | "action" | "closed";

export interface ReviewBoardActionState {
  kind: ReviewBoardActionKind;
  actions: ReviewBoardActionId[];
}

export function getReviewBoardActionState(
  candidate: ReviewCandidate,
): ReviewBoardActionState {
  if (candidate.status === "candidate") {
    return withTopicActions(candidate, {
      kind: "pending",
      actions: ["accept", "addHighlight", "addAction", "ignore", "openSourceNote"],
    });
  }

  if (candidate.status === "accepted" || candidate.status === "renamed") {
    const actions: ReviewBoardActionId[] = ["addAction", "openSourceNote"];
    if (!candidate.includeInAnnualHighlights) {
      actions.unshift("addHighlight");
    }
    return withTopicActions(candidate, { kind: "accepted", actions });
  }

  if (candidate.status === "next-action") {
    return { kind: "action", actions: ["openSourceNote"] };
  }

  return { kind: "closed", actions: ["openSourceNote"] };
}

function withTopicActions(
  candidate: ReviewCandidate,
  state: ReviewBoardActionState,
): ReviewBoardActionState {
  if (candidate.type !== "topic") {
    return state;
  }

  return {
    ...state,
    actions: [...state.actions, "renameTopic", "mergeTopic"],
  };
}
