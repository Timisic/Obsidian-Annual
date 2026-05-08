import { describe, expect, it } from "vitest";
import {
  applyReviewAction,
  calculateReviewProgress,
  mergeScannedCandidates,
  type EvidenceSource,
  type ReviewCandidate,
  type ReviewCandidateType,
  type ReviewSessionState,
} from "../src/core/reviewState";
import type { ExplanationReason } from "../src/core/types";

const at = "2026-05-04T15:00:00.000Z";

describe("review state", () => {
  it("requires every candidate to carry evidence", () => {
    const session = sessionWith([candidate("topic-1", "topic", [])]);

    expect(() =>
      applyReviewAction(session, { type: "accept", candidateId: "topic-1", at }),
    ).toThrow("Review candidate topic-1 must include at least one evidence source.");
  });

  it("requires every candidate reason to be traceable", () => {
    const withoutReasons = { ...candidate("topic-1", "topic"), reasons: [] };
    const withoutTrace = {
      ...candidate("topic-2", "topic"),
      reasons: [
        {
          type: "tag",
          label: "Tag signal",
          evidenceId: "missing-trace",
        } as unknown as ExplanationReason,
      ],
    };

    expect(() =>
      applyReviewAction(sessionWith([withoutReasons]), {
        type: "accept",
        candidateId: "topic-1",
        at,
      }),
    ).toThrow("Review candidate topic-1 must include at least one explanation reason.");
    expect(() =>
      applyReviewAction(sessionWith([withoutTrace]), {
        type: "accept",
        candidateId: "topic-2",
        at,
      }),
    ).toThrow(
      "Review candidate topic-2 has an explanation reason without traceable evidence.",
    );
  });

  it("applies MVP review actions and updates progress", () => {
    const session = sessionWith([
      candidate("topic-1", "topic"),
      candidate("topic-2", "topic"),
      candidate("task-1", "task"),
      candidate("note-1", "note"),
      candidate("dormant-1", "dormant-note"),
    ]);

    const accepted = applyReviewAction(session, {
      type: "accept",
      candidateId: "topic-1",
      at,
    });
    const renamed = applyReviewAction(accepted, {
      type: "rename-topic",
      candidateId: "topic-1",
      title: "Writing Systems",
      at,
    });
    const highlighted = applyReviewAction(renamed, {
      type: "add-to-annual-highlights",
      candidateId: "note-1",
      at,
    });
    const actioned = applyReviewAction(highlighted, {
      type: "add-to-actions",
      candidateId: "task-1",
      at,
      decision: {
        id: "decision-1",
        action: "continue",
        label: "Continue the research thread",
        includeInReport: true,
      },
    });
    const archived = applyReviewAction(actioned, {
      type: "archive",
      candidateId: "dormant-1",
      at,
      note: "No longer active.",
    });
    const merged = applyReviewAction(archived, {
      type: "merge-topic",
      sourceCandidateId: "topic-2",
      targetCandidateId: "topic-1",
      at,
    });

    expect(merged.candidates.find((item) => item.id === "topic-1")).toMatchObject({
      status: "renamed",
      userTitle: "Writing Systems",
      mergedSourceIds: ["topic-2"],
    });
    expect(merged.candidates.find((item) => item.id === "topic-2")).toMatchObject({
      status: "merged",
      mergedIntoId: "topic-1",
    });
    expect(merged.candidates.find((item) => item.id === "task-1")).toMatchObject({
      status: "next-action",
      decisionIds: ["decision-1"],
    });
    expect(merged.candidates.find((item) => item.id === "note-1")).toMatchObject({
      status: "accepted",
      includeInAnnualHighlights: true,
    });
    expect(merged.candidates.find((item) => item.id === "dormant-1")).toMatchObject({
      status: "archived",
      userNote: "No longer active.",
    });
    expect(merged.progress).toMatchObject({
      total: 5,
      reviewed: 5,
      candidate: 0,
      accepted: 1,
      renamed: 1,
      merged: 1,
      archived: 1,
      nextAction: 1,
      annualHighlights: 1,
    });
  });

  it("preserves user-decided choices when repeated scans refresh candidates", () => {
    const stored = applyReviewAction(
      sessionWith([candidate("topic-1", "topic"), candidate("note-1", "note")]),
      {
        type: "rename-topic",
        candidateId: "topic-1",
        title: "Local-first review",
        at,
      },
    );
    const rescannedTopic = {
      ...candidate("topic-1", "topic"),
      title: "Machine title",
      reason: "Refreshed machine reason",
      evidence: [
        {
          id: "new-evidence",
          kind: "tag",
          label: "#review",
          target: "#review",
        } satisfies EvidenceSource,
      ],
      score: 99,
    };
    const rescannedNote = {
      ...candidate("note-1", "note"),
      reason: "Updated undecided note reason",
      score: 20,
    };

    const merged = mergeScannedCandidates(
      stored,
      [rescannedTopic, rescannedNote, candidate("project-1", "project")],
      "scan-2",
      at,
    );

    expect(merged.candidates.find((item) => item.id === "topic-1")).toMatchObject({
      status: "renamed",
      userTitle: "Local-first review",
      reason: "Refreshed machine reason",
      score: 99,
    });
    expect(merged.candidates.find((item) => item.id === "note-1")).toMatchObject({
      status: "candidate",
      reason: "Updated undecided note reason",
      score: 20,
    });
    expect(merged.candidates.find((item) => item.id === "project-1")).toMatchObject({
      status: "candidate",
    });
  });

  it("keeps disappeared reviewed candidates with missing evidence but drops disappeared undecided candidates", () => {
    const stored = applyReviewAction(
      sessionWith([candidate("topic-1", "topic"), candidate("note-1", "note")]),
      {
        type: "accept",
        candidateId: "topic-1",
        at,
      },
    );

    const merged = mergeScannedCandidates(stored, [], "scan-empty", at);

    expect(merged.candidates.map((item) => item.id)).toEqual(["topic-1"]);
    expect(merged.candidates[0]?.evidence.every((evidence) => evidence.missing)).toBe(
      true,
    );
  });

  it("calculates progress from statuses without counting candidates as reviewed", () => {
    expect(
      calculateReviewProgress([
        { ...candidate("topic-1", "topic"), status: "candidate" },
        { ...candidate("note-1", "note"), status: "accepted" },
        { ...candidate("task-1", "task"), status: "ignored" },
      ]),
    ).toMatchObject({
      total: 3,
      reviewed: 2,
      candidate: 1,
      accepted: 1,
      ignored: 1,
    });
  });
});

function sessionWith(candidates: ReviewCandidate[]): ReviewSessionState {
  return {
    schemaVersion: 1,
    year: 2026,
    scopeHash: "scope",
    scanId: "scan-1",
    candidates,
    decisions: [],
    progress: calculateReviewProgress(candidates),
    createdAt: at,
    updatedAt: at,
  };
}

function candidate(
  id: string,
  type: ReviewCandidateType,
  evidence: EvidenceSource[] = [evidenceFor(id)],
): ReviewCandidate {
  return {
    id,
    type,
    title: id,
    reason: `Reason for ${id}`,
    reasons: [reasonFor(id)],
    status: "candidate",
    evidence,
    sourcePaths: [`${id}.md`],
    decisionIds: [],
    createdAt: at,
    updatedAt: at,
  };
}

function reasonFor(id: string): ExplanationReason {
  return {
    type: "word-count",
    label: `${id} has enough source text.`,
    evidenceId: `${id}-reason`,
    sourcePath: `${id}.md`,
    statField: "wordCount",
  };
}

function evidenceFor(id: string): EvidenceSource {
  return {
    id: `${id}-evidence`,
    kind: "note",
    label: `${id}.md`,
    target: `${id}.md`,
    sourcePath: `${id}.md`,
    reason: "Source note supports the candidate.",
  };
}
