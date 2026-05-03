import type { AnnualReviewSettings } from "./types";

export const DEFAULT_SETTINGS: AnnualReviewSettings = {
  reportFolder: "Annual Reviews",
  includeFolders: [],
  excludeFolders: [".obsidian", "Templates", "Archive", "Attachments"],
  excludePatterns: [],
  includeTasks: true,
  includeLinks: true,
  includeFrontmatter: true,
  includeHeadings: true,
  privacyMode: "standard",
};

export function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "");
}

export function splitFolderList(value: string): string[] {
  return value
    .split(",")
    .map(normalizeFolder)
    .filter(Boolean);
}

export function joinFolderList(value: string[]): string {
  return value.join(", ");
}
