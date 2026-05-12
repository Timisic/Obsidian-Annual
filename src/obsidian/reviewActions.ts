import type { ReviewCandidate } from "../core/reviewState";

export type ReviewBoardActionId =
  | "accept"
  | "ignore"
  | "openSourceNote"
  | "renameTopic"
  | "mergeTopic";

export type ReviewBoardActionKind = "pending" | "accepted" | "closed";

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
      actions: ["accept", "ignore", "openSourceNote"],
    });
  }

  if (candidate.status === "accepted" || candidate.status === "renamed") {
    return withTopicActions(candidate, {
      kind: "accepted",
      actions: ["ignore", "openSourceNote"],
    });
  }

  return { kind: "closed", actions: ["openSourceNote"] };
}

function withTopicActions(
  candidate: ReviewCandidate,
  state: ReviewBoardActionState,
): ReviewBoardActionState {
  if (candidate.type !== "theme-hypothesis") {
    return state;
  }

  return {
    ...state,
    actions: [...state.actions, "renameTopic", "mergeTopic"],
  };
}
