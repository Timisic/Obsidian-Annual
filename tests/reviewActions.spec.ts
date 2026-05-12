import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getReviewBoardActionState } from "../src/obsidian/reviewActions";
import { isMergeTargetCandidate } from "../src/obsidian/reviewSelection";
import type { ReviewCandidate } from "../src/core/reviewState";

const at = "2026-05-09T00:00:00.000Z";

describe("Review Board action rendering state", () => {
  it("keeps the action panel above variable candidate detail content", () => {
    const source = readFileSync(
      join(process.cwd(), "src/obsidian/dashboardView.ts"),
      "utf8",
    );

    expect(
      source.indexOf("this.renderDecisionControls(detail, session, current);"),
    ).toBeLessThan(source.indexOf('cls: "annual-review-board-summary"'));
    expect(
      source.indexOf("this.renderDecisionControls(detail, session, current);"),
    ).toBeLessThan(source.indexOf('cls: "annual-review-board-evidence"'));
  });

  it("does not render raw candidate type or status labels in the visible queue", () => {
    const source = readFileSync(
      join(process.cwd(), "src/obsidian/dashboardView.ts"),
      "utf8",
    );

    expect(source).not.toContain("[${candidate.type}]");
    expect(source).toContain("candidateStatusLabel(candidate, text)");
  });

  it("renders pending candidates with the primary decision flow", () => {
    expect(getReviewBoardActionState(candidate("pending", "candidate"))).toEqual({
      kind: "pending",
      actions: ["accept", "ignore", "openSourceNote", "renameTopic", "mergeTopic"],
    });
  });

  it("renders accepted candidates with post-confirmation ignore controls", () => {
    expect(getReviewBoardActionState(candidate("accepted", "accepted"))).toEqual({
      kind: "accepted",
      actions: ["ignore", "openSourceNote", "renameTopic", "mergeTopic"],
    });
  });

  it("renders closed candidates as navigation-only decisions", () => {
    for (const status of ["ignored", "merged"] as const) {
      expect(getReviewBoardActionState(candidate(status, status))).toEqual({
        kind: "closed",
        actions: ["openSourceNote"],
      });
    }
  });

  it("keeps ignored and merged proposals out of merge targets", () => {
    expect(isMergeTargetCandidate(candidate("pending", "candidate"))).toBe(true);
    expect(isMergeTargetCandidate(candidate("accepted", "accepted"))).toBe(true);
    expect(isMergeTargetCandidate(candidate("renamed", "renamed"))).toBe(true);
    expect(isMergeTargetCandidate(candidate("ignored", "ignored"))).toBe(false);
    expect(isMergeTargetCandidate(candidate("merged", "merged"))).toBe(false);
  });
});

function candidate(
  id: string,
  status: ReviewCandidate["status"],
  overrides: Partial<ReviewCandidate> = {},
): ReviewCandidate {
  return {
    id,
    type: "theme-hypothesis",
    title: id,
    reason: `Reason for ${id}`,
    reasons: [
      {
        type: "tag",
        label: "Tag signal",
        evidenceId: `${id}-reason`,
        sourcePath: `${id}.md`,
      },
    ],
    status,
    evidence: [
      {
        id: `${id}-evidence`,
        kind: "note",
        label: `${id}.md`,
        target: `${id}.md`,
        sourcePath: `${id}.md`,
      },
    ],
    sourcePaths: [`${id}.md`],
    decisionIds: [],
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}
