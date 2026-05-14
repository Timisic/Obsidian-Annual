import { reviewSessionPathLabel } from "./reviewSession";

export type AnnualReviewChartKind =
  | "daily-cumulative-words"
  | "daily-word-heatmap"
  | "word-growth-trend"
  | "topic-evolution"
  | "topic-evolution-data";

export function normalizeVaultPath(path: string): string {
  return path
    .replace(/\\/gu, "/")
    .replace(/\/{2,}/gu, "/")
    .replace(/^\/+|\/+$/gu, "");
}

export function normalizeReportFolder(folder: string): string {
  return normalizeVaultPath(folder.trim()) || "Annual Reviews";
}

export function reportPath(reportFolder: string, labelOrYear: string | number): string {
  return normalizeVaultPath(
    `${normalizeReportFolder(reportFolder || "Annual Reviews")}/${reportLabel(labelOrYear)}.md`,
  );
}

export function reportLabel(labelOrYear: string | number): string {
  return typeof labelOrYear === "number"
    ? `${labelOrYear} Annual Review`
    : reviewSessionPathLabel(labelOrYear);
}

export function buildAnnualReviewChartPaths(
  reportFolder: string,
  labelOrYear: string | number,
): Record<AnnualReviewChartKind, string> {
  const assetFolder = `${normalizeReportFolder(reportFolder || "Annual Reviews")}/${reportLabel(labelOrYear)} Assets`;
  return {
    "daily-cumulative-words": `${assetFolder}/daily-cumulative-words.svg`,
    "daily-word-heatmap": `${assetFolder}/daily-word-heatmap.svg`,
    "word-growth-trend": `${assetFolder}/word-growth-trend.svg`,
    "topic-evolution": `${assetFolder}/topic-evolution.svg`,
    "topic-evolution-data": `${assetFolder}/topic-evolution.json`,
  };
}

export function backupReportPath(
  reportPathValue: string,
  timestamp: string,
  suffix?: number,
): string {
  const pathParts = reportPathValue.split("/");
  const filename = pathParts.pop() ?? reportPathValue;
  const folder = pathParts.join("/");
  const basename = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  const suffixText = suffix ? `-${suffix}` : "";
  return normalizeVaultPath(`${folder}/${basename} Backup ${timestamp}${suffixText}.md`);
}
