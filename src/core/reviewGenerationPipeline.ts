import { renderAiReportEnhancements } from "./ai";
import { buildReviewAggregate } from "./aggregate";
import type { BuildReviewSessionOptions } from "./reviewCandidates";
import type { ReviewSessionState } from "./reviewState";
import {
  buildAnnualReviewChartAssets,
  buildAnnualReviewChartPaths,
  renderAnnualReview,
  type AnnualReviewChartAsset,
  type AnnualReviewChartKind,
} from "./render";
import { buildThemeEvidencePackage } from "./themeEvidence";
import type {
  AiReportEnhancements,
  AnnualReviewSettings,
  ResolvedAnnualReviewLanguage,
  ReviewSession,
  SnapshotComparison,
  SourceFile,
  ThemeEvidencePackage,
  YearAggregate,
} from "./types";

export interface ReviewGenerationPipelineInput {
  files: SourceFile[];
  session: ReviewSession;
  settings: AnnualReviewSettings;
  snapshotComparison: SnapshotComparison;
  reportLanguage: ResolvedAnnualReviewLanguage;
  refreshReviewSession: (
    aggregate: YearAggregate,
    options: BuildReviewSessionOptions,
  ) => Promise<ReviewSessionState>;
  onBeforeRender?: () => void;
}

export interface ReviewGenerationPipelineResult {
  aggregate: YearAggregate;
  aiEnhancements: AiReportEnhancements;
  evidencePackage: ThemeEvidencePackage;
  reviewSession: ReviewSessionState;
  chartPaths: Record<AnnualReviewChartKind, string>;
  chartAssets: AnnualReviewChartAsset[];
  markdown: string;
}

export async function buildReviewGenerationPipeline(
  input: ReviewGenerationPipelineInput,
): Promise<ReviewGenerationPipelineResult> {
  const aggregate = buildReviewAggregate(input.files, input.session, input.settings, {
    snapshotComparison: input.snapshotComparison,
  });
  const aiEnhancements = await renderAiReportEnhancements({
    aggregate,
    files: input.files,
    settings: input.settings,
  });
  const evidencePackage = buildThemeEvidencePackage(
    aggregate,
    input.files,
    input.settings,
  );
  const aiConfigured = input.settings.aiProvider !== "none";
  const reviewSession = await input.refreshReviewSession(aggregate, {
    themeHypotheses: aiEnhancements.themeHypotheses,
    evidencePackage,
    language: input.reportLanguage,
    aiConfigured,
    aiAttempted: aiConfigured,
    aiFailureMessage:
      aiConfigured && aiEnhancements.themeHypotheses.length === 0
        ? aiEnhancements.periodJudgment
        : undefined,
  });

  input.onBeforeRender?.();
  const chartPaths = buildAnnualReviewChartPaths(
    input.settings.reportFolder,
    input.session.label,
  );
  const chartAssets = buildAnnualReviewChartAssets(aggregate, {
    language: input.reportLanguage,
    chartPaths,
    reviewSession,
  });
  const markdown = renderAnnualReview(aggregate, {
    language: input.reportLanguage,
    chartPaths,
    aiEnhancements,
    aiEnabled: aiConfigured,
    reviewSession,
    themeEvidencePackage: evidencePackage,
  });

  return {
    aggregate,
    aiEnhancements,
    evidencePackage,
    reviewSession,
    chartPaths,
    chartAssets,
    markdown,
  };
}
