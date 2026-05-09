import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getReviewBoardActionState } from "../src/obsidian/reviewActions";
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

  it("renders pending candidates with the primary decision flow", () => {
    expect(getReviewBoardActionState(candidate("pending", "candidate"))).toEqual({
      kind: "pending",
      actions: [
        "accept",
        "addHighlight",
        "addAction",
        "ignore",
        "openSourceNote",
        "renameTopic",
        "mergeTopic",
      ],
    });
  });

  it("renders accepted candidates without pending accept or ignore controls", () => {
    expect(getReviewBoardActionState(candidate("accepted", "accepted"))).toEqual({
      kind: "accepted",
      actions: [
        "addHighlight",
        "addAction",
        "openSourceNote",
        "renameTopic",
        "mergeTopic",
      ],
    });
  });

  it("renders closed candidates as navigation-only decisions", () => {
    for (const status of ["ignored", "archived", "merged"] as const) {
      expect(getReviewBoardActionState(candidate(status, status))).toEqual({
        kind: "closed",
        actions: ["openSourceNote"],
      });
    }
  });

  it("keeps already highlighted accepted candidates minimal", () => {
    expect(
      getReviewBoardActionState(
        candidate("highlighted", "accepted", { includeInAnnualHighlights: true }),
      ),
    ).toEqual({
      kind: "accepted",
      actions: ["addAction", "openSourceNote", "renameTopic", "mergeTopic"],
    });
  });
});

function candidate(
  id: string,
  status: ReviewCandidate["status"],
  overrides: Partial<ReviewCandidate> = {},
): ReviewCandidate {
  return {
    id,
    type: "topic",
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
