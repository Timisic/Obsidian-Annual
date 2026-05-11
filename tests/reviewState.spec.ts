import { describe, expect, it } from "vitest";
import { buildYearAggregate } from "../src/core/aggregate";
import { buildReviewSession } from "../src/core/reviewCandidates";
import { renderAnnualReview } from "../src/core/render";
import {
  applyReviewAction,
  calculateReviewProgress,
  mergeScannedCandidates,
  type EvidenceSource,
  type ReviewCandidate,
  type ReviewSessionState,
} from "../src/core/reviewState";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import type { ExplanationReason } from "../src/core/types";
import { fixtureVault } from "./fixtures";

const at = "2026-05-04T15:00:00.000Z";

describe("review state", () => {
  it("requires every candidate to carry evidence", () => {
    const session = sessionWith([candidate("topic-1", [])]);

    expect(() =>
      applyReviewAction(session, { type: "accept", candidateId: "topic-1", at }),
    ).toThrow("Review candidate topic-1 must include at least one evidence source.");
  });

  it("requires every candidate reason to be traceable", () => {
    const withoutReasons = { ...candidate("topic-1"), reasons: [] };
    const withoutTrace = {
      ...candidate("topic-2"),
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
      candidate("topic-1"),
      candidate("topic-2"),
      candidate("topic-3"),
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
    const ignored = applyReviewAction(renamed, {
      type: "ignore",
      candidateId: "topic-3",
      at,
      note: "Not central this year.",
    });
    const merged = applyReviewAction(ignored, {
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
    expect(merged.candidates.find((item) => item.id === "topic-3")).toMatchObject({
      status: "ignored",
      userNote: "Not central this year.",
    });
    expect(merged.decisions.map((decision) => decision.action)).toEqual([
      "accept",
      "rename",
      "ignore",
      "merge",
    ]);
    expect(merged.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId: "topic-1",
          action: "rename",
          label: "Writing Systems",
          includeInReport: true,
        }),
        expect.objectContaining({
          candidateId: "topic-2",
          action: "merge",
          label: "topic-2 -> Writing Systems",
          includeInReport: true,
        }),
        expect.objectContaining({
          candidateId: "topic-3",
          action: "ignore",
          includeInReport: false,
        }),
      ]),
    );
    const mergeDecision = merged.decisions.find(
      (decision) => decision.action === "merge",
    );
    expect(
      merged.candidates.find((item) => item.id === "topic-1")?.decisionIds,
    ).toContain(mergeDecision?.id);
    expect(
      merged.candidates.find((item) => item.id === "topic-2")?.decisionIds,
    ).toContain(mergeDecision?.id);
    expect(merged.progress).toMatchObject({
      total: 3,
      reviewed: 3,
      candidate: 0,
      renamed: 1,
      merged: 1,
      ignored: 1,
    });
  });

  it("preserves user-decided choices when repeated scans refresh candidates", () => {
    const stored = applyReviewAction(
      sessionWith([candidate("topic-1"), candidate("note-1")]),
      {
        type: "rename-topic",
        candidateId: "topic-1",
        title: "Local-first review",
        at,
      },
    );
    const rescannedTopic = {
      ...candidate("topic-1"),
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
      ...candidate("note-1"),
      reason: "Updated undecided note reason",
      score: 20,
    };

    const merged = mergeScannedCandidates(
      stored,
      [rescannedTopic, rescannedNote, candidate("topic-3")],
      "scan-2",
      at,
    );

    expect(merged.candidates.find((item) => item.id === "topic-1")).toMatchObject({
      status: "renamed",
      userTitle: "Local-first review",
      reason: "Refreshed machine reason",
      score: 99,
    });
    expect(merged.decisions).toHaveLength(1);
    expect(merged.decisions[0]).toMatchObject({
      candidateId: "topic-1",
      action: "rename",
      label: "Local-first review",
      includeInReport: true,
    });
    expect(merged.candidates.find((item) => item.id === "note-1")).toMatchObject({
      status: "candidate",
      reason: "Updated undecided note reason",
      score: 20,
    });
    expect(merged.candidates.find((item) => item.id === "topic-3")).toMatchObject({
      status: "candidate",
    });
  });

  it("keeps disappeared reviewed candidates with missing evidence but drops disappeared undecided candidates", () => {
    const stored = applyReviewAction(
      sessionWith([candidate("topic-1"), candidate("note-1")]),
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
        { ...candidate("topic-1"), status: "candidate" },
        { ...candidate("note-1"), status: "accepted" },
        { ...candidate("topic-2"), status: "ignored" },
      ]),
    ).toMatchObject({
      total: 3,
      reviewed: 2,
      candidate: 1,
      accepted: 1,
      ignored: 1,
    });
  });

  it("builds stable review sessions from aggregate signals and preserves decisions on rescan", async () => {
    const aggregate = buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS);
    const session = buildReviewSession(aggregate);
    const topic = session.candidates.find((item) => item.type === "theme-hypothesis");

    expect(session.candidates.length).toBeGreaterThan(0);
    expect(session.session).toMatchObject({
      preset: "annual",
      label: "2026 Annual Review",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(topic?.evidence.length).toBeGreaterThan(0);
    expect(topic?.sourcePaths[0]).toMatch(/\.md$/u);

    const accepted = applyReviewAction(session, {
      type: "accept",
      candidateId: topic?.id ?? session.candidates[0]?.id ?? "",
      at,
    });
    const legacyStored = { ...accepted, session: undefined };
    const rescanned = buildReviewSession(
      buildYearAggregate(await fixtureVault(), 2026, DEFAULT_SETTINGS),
      legacyStored,
    );

    expect(
      rescanned.candidates.find((item) => item.id === (topic?.id ?? ""))?.status,
    ).toBe("accepted");
    expect(rescanned.session?.id).toBe(session.session?.id);
  });

  it("renders accepted review decisions while excluding ignored candidates and forced actions", () => {
    const session = sessionWith([candidate("accepted-note"), candidate("ignored-note")]);
    const accepted = applyReviewAction(session, {
      type: "accept",
      candidateId: "accepted-note",
      at,
    });
    const ignored = applyReviewAction(accepted, {
      type: "ignore",
      candidateId: "ignored-note",
      at,
    });
    const aggregate = aggregateForReport();
    const markdown = renderAnnualReview(aggregate, {
      language: "en",
      reviewSession: ignored,
    });

    expect(markdown).toContain("[[accepted-note|Accepted Note]]");
    expect(markdown).toContain("- AI summary: AI summary for Accepted Note");
    expect(markdown).toContain("- Why this theme exists: Reason for Accepted Note");
    expect(markdown).toContain(
      "- Connection explanation: Accepted Note connects multiple evidence notes.",
    );
    expect(markdown).toContain("- Local signals: Accepted Note has local evidence");
    expect(markdown).toContain(
      "- [[accepted-note]] — Source note supports the candidate.",
    );
    expect(markdown).not.toContain("[[ignored-note|Ignored Note]]");
    expect(markdown).not.toContain("Turn accepted evidence into a follow-up review");
    expect(markdown).not.toContain("Confirm, rename, ignore, or archive");
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
  evidence: EvidenceSource[] = [evidenceFor(id)],
): ReviewCandidate {
  return {
    id,
    type: "theme-hypothesis",
    title: id,
    reason: `Reason for ${id}`,
    aiSummary: `AI summary for ${id}`,
    connectionExplanation: `${id} connects multiple evidence notes.`,
    localSignals: [`${id} has local evidence`],
    source: "ai",
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

function aggregateForReport() {
  return buildYearAggregate(
    [
      {
        path: "accepted-note.md",
        ctime: Date.parse("2026-01-01T08:00:00.000Z"),
        mtime: Date.parse("2026-01-01T08:00:00.000Z"),
        content: "accepted note has enough review words ".repeat(80),
      },
      {
        path: "ignored-note.md",
        ctime: Date.parse("2026-01-02T08:00:00.000Z"),
        mtime: Date.parse("2026-01-02T08:00:00.000Z"),
        content: "ignored note has enough review words ".repeat(80),
      },
      {
        path: "action-note.md",
        ctime: Date.parse("2026-01-03T08:00:00.000Z"),
        mtime: Date.parse("2026-01-03T08:00:00.000Z"),
        content: "action note has enough review words ".repeat(80),
      },
    ],
    2026,
    DEFAULT_SETTINGS,
  );
}
