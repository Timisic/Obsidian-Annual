import { describe, expect, it } from "vitest";
import { buildYearAggregate } from "../src/core/aggregate";
import { buildReviewSession } from "../src/core/reviewCandidates";
import { renderAnnualReview } from "../src/core/render";
import { buildThemeEvidencePackage } from "../src/core/themeEvidence";
import {
  applyReviewAction,
  calculateReviewProgress,
  isPendingReviewQueueCandidate,
  isReviewBoardQueueCandidate,
  isReviewReportCandidate,
  mergeScannedCandidates,
  shouldIncludeReviewDecisionInReport,
  type EvidenceSource,
  type ReviewCandidate,
  type ReviewSessionState,
} from "../src/core/reviewState";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import type { ExplanationReason } from "../src/core/types";
import { normalizeReviewSessions } from "../src/core/reviewSessionPersistence";
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


  it("centralizes Review Board queue and report inclusion rules", () => {
    const pending = candidate("pending");
    const accepted = { ...candidate("accepted"), status: "accepted" as const };
    const renamed = { ...candidate("renamed"), status: "renamed" as const };
    const merged = { ...candidate("merged"), status: "merged" as const };
    const ignored = { ...candidate("ignored"), status: "ignored" as const };

    expect(isPendingReviewQueueCandidate(pending)).toBe(true);
    expect([pending, accepted, renamed, ignored].map(isReviewBoardQueueCandidate)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isReviewBoardQueueCandidate(merged)).toBe(false);
    expect([pending, accepted, renamed, merged, ignored].map(isReviewReportCandidate)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);

    expect(shouldIncludeReviewDecisionInReport("accept", "candidate")).toBe(true);
    expect(shouldIncludeReviewDecisionInReport("ignore", "candidate")).toBe(false);
    expect(shouldIncludeReviewDecisionInReport("merge", "merged")).toBe(true);
    expect(shouldIncludeReviewDecisionInReport("rename", "candidate")).toBe(false);
    expect(shouldIncludeReviewDecisionInReport("rename", "accepted")).toBe(true);
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

  it("preserves renamed candidate titles when repeated scans refresh candidates", () => {
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
      status: "candidate",
      userTitle: "Local-first review",
      reason: "Refreshed machine reason",
      score: 99,
    });
    expect(merged.decisions).toHaveLength(1);
    expect(merged.decisions[0]).toMatchObject({
      candidateId: "topic-1",
      action: "rename",
      label: "Local-first review",
      includeInReport: false,
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

  it("does not mark saved evidence missing when a rescan still sees the source note under a new semantic candidate", () => {
    const stored = applyReviewAction(sessionWith([candidate("old-ai-theme")]), {
      type: "accept",
      candidateId: "old-ai-theme",
      at,
    });
    const rescanned = candidate("new-ai-theme", [
      {
        id: "new-ai-theme-evidence",
        kind: "note",
        label: "same source",
        target: "old-ai-theme.md",
        sourcePath: "old-ai-theme.md",
      },
    ]);

    const merged = mergeScannedCandidates(stored, [rescanned], "scan-2", at);

    expect(
      merged.candidates.find((item) => item.id === "old-ai-theme")?.evidence,
    ).toEqual([
      expect.objectContaining({
        sourcePath: "old-ai-theme.md",
        missing: false,
      }),
    ]);
  });

  it("does not mark reviewed AI evidence missing when AI regeneration is unavailable but source notes still exist", () => {
    const stored = applyReviewAction(sessionWith([candidate("old-ai-theme")]), {
      type: "accept",
      candidateId: "old-ai-theme",
      at,
    });

    const merged = mergeScannedCandidates(
      stored,
      [],
      "scan-without-ai",
      at,
      [],
      undefined,
      ["old-ai-theme.md"],
    );

    expect(
      merged.candidates.find((item) => item.id === "old-ai-theme")?.evidence,
    ).toEqual([
      expect.objectContaining({
        sourcePath: "old-ai-theme.md",
        missing: false,
      }),
    ]);
  });

  it("keeps a reviewed candidate id and decision when provider rewords a theme with overlapping evidence", () => {
    const stored = applyReviewAction(
      sessionWith([
        candidate("old-ai-theme", [
          evidenceForPath("old-ai-theme", "Daily/2026-01-01.md"),
          evidenceForPath("old-ai-theme", "Projects/Research.md"),
          evidenceForPath("old-ai-theme", "Areas/AI Systems.md"),
        ]),
      ]),
      {
        type: "accept",
        candidateId: "old-ai-theme",
        at,
      },
    );
    const rescanned = {
      ...candidate("new-provider-wording", [
        evidenceForPath("new-provider-wording", "Projects/Research.md"),
        evidenceForPath("new-provider-wording", "Daily/2026-01-01.md"),
        evidenceForPath("new-provider-wording", "Projects/New Context.md"),
      ]),
      title: "Provider reworded theme",
      reason: "Provider phrased the same evidence cluster differently.",
      score: 98,
    };

    const merged = mergeScannedCandidates(stored, [rescanned], "scan-2", at);

    expect(merged.candidates).toHaveLength(1);
    expect(merged.candidates[0]).toMatchObject({
      id: "old-ai-theme",
      status: "accepted",
      title: "Provider reworded theme",
      reason: "Provider phrased the same evidence cluster differently.",
      score: 98,
      decisionIds: stored.candidates[0]?.decisionIds,
    });
    expect(merged.decisions[0]).toMatchObject({
      candidateId: "old-ai-theme",
      action: "accept",
    });
    expect(merged.candidates[0]?.evidence.map((evidence) => evidence.sourcePath)).toEqual(
      ["Projects/Research.md", "Daily/2026-01-01.md", "Projects/New Context.md"],
    );
  });

  it("does not bind a reviewed decision to a reworded theme with only incidental evidence overlap", () => {
    const stored = applyReviewAction(
      sessionWith([
        candidate("old-ai-theme", [
          evidenceForPath("old-ai-theme", "Daily/2026-01-01.md"),
          evidenceForPath("old-ai-theme", "Projects/Research.md"),
          evidenceForPath("old-ai-theme", "Areas/AI Systems.md"),
        ]),
      ]),
      {
        type: "accept",
        candidateId: "old-ai-theme",
        at,
      },
    );
    const rescanned = candidate("new-provider-wording", [
      evidenceForPath("new-provider-wording", "Projects/Research.md"),
      evidenceForPath("new-provider-wording", "Archive/Unrelated.md"),
      evidenceForPath("new-provider-wording", "Daily/2026-02-01.md"),
    ]);

    const merged = mergeScannedCandidates(stored, [rescanned], "scan-2", at);

    expect(merged.candidates.map((candidate) => candidate.id)).toEqual([
      "old-ai-theme",
      "new-provider-wording",
    ]);
    expect(
      merged.candidates.find((candidate) => candidate.id === "old-ai-theme")?.status,
    ).toBe("accepted");
    expect(
      merged.candidates.find((candidate) => candidate.id === "new-provider-wording")
        ?.status,
    ).toBe("candidate");
  });

  it("does not preserve a reviewed candidate id when evidence overlap matches are ambiguous", () => {
    const stored = applyReviewAction(
      sessionWith([
        candidate("old-ai-theme", [
          evidenceForPath("old-ai-theme", "Daily/2026-01-01.md"),
          evidenceForPath("old-ai-theme", "Projects/Research.md"),
          evidenceForPath("old-ai-theme", "Areas/AI Systems.md"),
        ]),
      ]),
      {
        type: "accept",
        candidateId: "old-ai-theme",
        at,
      },
    );
    const firstRewording = candidate("first-provider-wording", [
      evidenceForPath("first-provider-wording", "Daily/2026-01-01.md"),
      evidenceForPath("first-provider-wording", "Projects/Research.md"),
      evidenceForPath("first-provider-wording", "Projects/New Context.md"),
    ]);
    const secondRewording = candidate("second-provider-wording", [
      evidenceForPath("second-provider-wording", "Daily/2026-01-01.md"),
      evidenceForPath("second-provider-wording", "Projects/Research.md"),
      evidenceForPath("second-provider-wording", "Areas/New Context.md"),
    ]);

    const merged = mergeScannedCandidates(
      stored,
      [firstRewording, secondRewording],
      "scan-2",
      at,
    );

    expect(merged.candidates.map((candidate) => candidate.id)).toEqual([
      "old-ai-theme",
      "first-provider-wording",
      "second-provider-wording",
    ]);
    expect(
      merged.candidates.find((candidate) => candidate.id === "old-ai-theme")?.status,
    ).toBe("accepted");
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
    const files = await fixtureVault();
    const aggregate = buildYearAggregate(files, 2026, DEFAULT_SETTINGS);
    const session = buildReviewSession(aggregate, undefined, {
      evidencePackage: buildThemeEvidencePackage(aggregate, files, DEFAULT_SETTINGS),
    });
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
    const rescannedFiles = await fixtureVault();
    const rescannedAggregate = buildYearAggregate(rescannedFiles, 2026, DEFAULT_SETTINGS);
    const rescanned = buildReviewSession(rescannedAggregate, legacyStored, {
      evidencePackage: buildThemeEvidencePackage(
        rescannedAggregate,
        rescannedFiles,
        DEFAULT_SETTINGS,
      ),
    });

    expect(
      rescanned.candidates.find((item) => item.id === (topic?.id ?? ""))?.status,
    ).toBe("accepted");
    expect(rescanned.session?.id).toBe(session.session?.id);
  });

  it("keeps legacy persisted review sessions without a session object", () => {
    const accepted = applyReviewAction(sessionWith([candidate("legacy-topic")]), {
      type: "accept",
      candidateId: "legacy-topic",
      at,
    });
    const legacyStored = { ...accepted, session: undefined };

    expect(normalizeReviewSessions({ legacy: legacyStored })).toEqual({
      legacy: legacyStored,
    });
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
    expect(markdown).toContain("**AI summary**: AI summary for Accepted Note");
    expect(markdown).toContain("**Why this theme exists**: Reason for Accepted Note");
    expect(markdown).toContain(
      "**Connection explanation**: Accepted Note connects multiple evidence notes.",
    );
    expect(markdown).toContain("**Local signals**: Accepted Note has local evidence");
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

function evidenceForPath(id: string, path: string): EvidenceSource {
  return {
    id: `${id}:${path}:evidence`,
    kind: "note",
    label: path,
    target: path,
    sourcePath: path,
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
