import type { EvidenceSource, ReviewCandidate } from "./reviewState";

const INLINE_LINK_LIMIT = 3;
const SUMMARY_LIMIT = 220;

export interface ReviewLinkedNotes {
  paths: string[];
  layout: "inline" | "list";
}

export interface ReviewDetailModel {
  summary: string;
  connection: string;
  caution: string;
  localSignals: string[];
  uncertainty: string;
  metadata: string[];
  evidence: EvidenceSource[];
  linkedNotes: ReviewLinkedNotes;
}

export function buildReviewDetailModel(
  candidate: ReviewCandidate,
  language: "en" | "zh" = "en",
): ReviewDetailModel {
  const linkedPaths = uniqueNonEmpty([
    ...candidate.sourcePaths,
    ...candidate.evidence.flatMap((item) => [
      item.sourcePath,
      markdownTarget(item.target),
    ]),
    ...candidate.reasons.flatMap((reason) => [
      reason.sourcePath,
      ...(reason.relatedPaths ?? []),
    ]),
  ]);

  return {
    summary: summarizeCandidate(candidate),
    connection: connectionExplanation(candidate),
    caution: reviewCaution(candidate, language),
    localSignals: (candidate.localSignals ?? []).map((signal) =>
      localizeSignal(signal, language),
    ),
    uncertainty: candidate.uncertainty ?? "",
    metadata: candidateMetadata(candidate),
    evidence: candidate.evidence,
    linkedNotes: {
      paths: linkedPaths,
      layout: linkedPaths.length > INLINE_LINK_LIMIT ? "list" : "inline",
    },
  };
}

function localizeSignal(value: string, language: "en" | "zh"): string {
  if (language !== "zh") {
    return value;
  }
  return value
    .replace(/^tags present as weak signals$/u, "标签仅作为弱信号")
    .replace(/^frontmatter context present$/u, "存在 frontmatter 上下文")
    .replace(/^contains reviewable questions$/u, "包含可复核问题")
    .replace(/^created in review range: /u, "创建于回顾范围：")
    .replace(/^modified in review range: /u, "修改于回顾范围：")
    .replace(/^shared links: /u, "共享链接：")
    .replace(/^repeated phrases: /u, "重复短语：")
    .replace(/^entities: /u, "实体：")
    .replace(/^cross-folder links: /u, "跨文件夹链接：")
    .replace(
      /^\d+ backlinks$/u,
      (match) => `${match.replace(" backlinks", "")} 条反向链接`,
    )
    .replace(
      /^\d+ outbound links$/u,
      (match) => `${match.replace(" outbound links", "")} 条出链`,
    );
}

function summarizeCandidate(candidate: ReviewCandidate): string {
  const excerpt =
    candidate.aiSummary ??
    candidate.reason ??
    candidate.evidence.find((item) => item.excerpt?.trim())?.excerpt ??
    candidate.rankReason ??
    candidate.title;
  return conciseText(excerpt);
}

function candidateMetadata(candidate: ReviewCandidate): string[] {
  return [
    candidate.rank ? `Rank #${candidate.rank}` : "",
    candidate.rankReason ? conciseText(candidate.rankReason, 140) : "",
  ].filter(Boolean);
}

function connectionExplanation(candidate: ReviewCandidate): string {
  const reasons = uniqueNonEmpty(
    [
      candidate.connectionExplanation,
      ...candidate.reasons.map((reason) => reason.label),
    ].filter(Boolean),
  );
  if (reasons.length > 0) {
    return conciseText(reasons.join(" "), 320);
  }
  const evidenceReasons = uniqueNonEmpty(
    candidate.evidence.map((evidence) => evidence.reason).filter(Boolean),
  );
  if (evidenceReasons.length > 0) {
    return conciseText(evidenceReasons.join(" "), 320);
  }
  return "Review the evidence notes together before deciding whether this is a real theme.";
}

function reviewCaution(candidate: ReviewCandidate, language: "en" | "zh"): string {
  if (candidate.evidence.every((evidence) => evidence.missing)) {
    return language === "zh"
      ? "所有已保存证据在重新扫描后都缺失；采纳前需要重新打开源笔记确认。"
      : "All saved evidence is missing after the latest rescan; reopen source notes before relying on this theme.";
  }
  if (candidate.evidence.some((evidence) => evidence.missing)) {
    return language === "zh"
      ? "部分证据在重新扫描后缺失；请确认剩余源笔记仍能支撑这个主题。"
      : "Some saved evidence is missing after the latest rescan; confirm the remaining source notes still support this theme.";
  }
  if (candidate.sourcePaths.length <= 1) {
    return language === "zh"
      ? "当前只有一条证据笔记支撑这个假设，适合作为弱信号复核。"
      : "Only one evidence note currently supports this hypothesis, so treat it as a weak local signal until reviewed.";
  }
  return language === "zh"
    ? "这是本地证据支持的主题假设，不是最终结论；请查看证据后确认、改名、合并或忽略。"
    : "This is a local hypothesis, not a conclusion; confirm, rename, merge, or ignore it after checking the evidence.";
}

function markdownTarget(target: string): string {
  return target.endsWith(".md") ? target : "";
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function conciseText(value: string, limit = SUMMARY_LIMIT): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}...`;
}
