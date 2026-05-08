import { normalizeFolder } from "./settings";
import type { AnnualReviewSettings } from "./types";

export function shouldIncludePath(path: string, settings: AnnualReviewSettings): boolean {
  if (!path.endsWith(".md")) {
    return false;
  }

  const normalizedPath = path.replace(/^\/+/, "");
  const reportFolder = normalizeFolder(settings.reportFolder);
  if (reportFolder && isInFolder(normalizedPath, reportFolder)) {
    return false;
  }

  if (
    settings.includeFolders.length > 0 &&
    !settings.includeFolders.some((folder) => isInFolder(normalizedPath, folder))
  ) {
    return false;
  }

  if (settings.excludeFolders.some((folder) => isInFolder(normalizedPath, folder))) {
    return false;
  }

  return !settings.excludePatterns.some(
    (pattern) => pattern && normalizedPath.includes(pattern),
  );
}

export function folderFromPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

function isInFolder(path: string, folder: string): boolean {
  const normalizedFolder = normalizeFolder(folder);
  return normalizedFolder === ""
    ? true
    : path === normalizedFolder || path.startsWith(`${normalizedFolder}/`);
}
