import type { App, TFile } from "obsidian";
import type { AnnualReviewChartAsset } from "../core/render";
import { reviewSessionPathLabel } from "../core/reviewSession";

export const ANNUAL_REVIEW_START_MARKER = "<!-- annual-review:start -->";
export const ANNUAL_REVIEW_END_MARKER = "<!-- annual-review:end -->";

export async function writeReport(
  app: App,
  reportFolder: string,
  labelOrYear: string | number,
  content: string,
): Promise<TFile> {
  const folder = normalizePath(reportFolder || "Annual Reviews");
  await ensureFolder(app, folder);

  const label =
    typeof labelOrYear === "number"
      ? `${labelOrYear} Annual Review`
      : reviewSessionPathLabel(labelOrYear);
  const path = normalizePath(`${folder}/${label}.md`);
  const existing = app.vault.getFileByPath(path);
  if (existing) {
    const previousContent = await app.vault.read(existing);
    if (!hasMachineSection(previousContent)) {
      await createLegacyBackup(app, path, previousContent);
    }
    await app.vault.process(existing, (currentContent) =>
      mergeAnnualReviewContent(currentContent, content),
    );
    return existing;
  }
  return app.vault.create(path, formatMachineSection(content));
}

export async function writeAnnualReviewOutput(
  app: App,
  reportFolder: string,
  labelOrYear: string | number,
  content: string,
  chartAssets: AnnualReviewChartAsset[],
): Promise<TFile> {
  for (const asset of chartAssets) {
    await writeTextFile(app, asset.path, asset.content);
  }
  return writeReport(app, reportFolder, labelOrYear, content);
}

async function writeTextFile(app: App, path: string, content: string): Promise<TFile> {
  const normalizedPath = normalizePath(path);
  const folder = normalizedPath.split("/").slice(0, -1).join("/");
  await ensureFolder(app, folder);

  const existing = app.vault.getFileByPath(normalizedPath);
  if (existing) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(normalizedPath, content);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
  if (!folder || app.vault.getFolderByPath(folder)) {
    return;
  }

  const parts = folder.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getFolderByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/gu, "/")
    .replace(/\/{2,}/gu, "/")
    .replace(/^\/+|\/+$/gu, "");
}

function mergeAnnualReviewContent(
  existingContent: string,
  nextMachineContent: string,
): string {
  const section = findMachineSection(existingContent);
  if (!section) {
    return formatMachineSection(nextMachineContent);
  }

  const managedStartIndex = machineSectionStartIndex(existingContent, section.startIndex);
  return appendUserContent(
    formatMachineSection(nextMachineContent),
    existingContent.slice(0, managedStartIndex),
    existingContent.slice(section.endIndex),
  );
}

function formatMachineSection(content: string): string {
  const frontmatter = extractLeadingFrontmatter(content);
  const machineContent = frontmatter ? frontmatter.body : content;
  const normalizedContent = machineContent.endsWith("\n")
    ? machineContent
    : `${machineContent}\n`;
  const machineSection = `${ANNUAL_REVIEW_START_MARKER}\n${normalizedContent}${ANNUAL_REVIEW_END_MARKER}`;
  return frontmatter ? `${frontmatter.block}\n\n${machineSection}` : machineSection;
}

function hasMachineSection(content: string): boolean {
  return Boolean(findMachineSection(content));
}

function findMachineSection(
  content: string,
): { startIndex: number; endIndex: number } | null {
  const startIndex = content.indexOf(ANNUAL_REVIEW_START_MARKER);
  if (startIndex === -1) {
    return null;
  }

  const endMarkerIndex = content.indexOf(
    ANNUAL_REVIEW_END_MARKER,
    startIndex + ANNUAL_REVIEW_START_MARKER.length,
  );
  if (endMarkerIndex === -1) {
    return null;
  }

  return {
    startIndex,
    endIndex: endMarkerIndex + ANNUAL_REVIEW_END_MARKER.length,
  };
}

function machineSectionStartIndex(content: string, markerStartIndex: number): number {
  const frontmatter = extractLeadingFrontmatter(content);
  if (!frontmatter) {
    return markerStartIndex;
  }

  const betweenFrontmatterAndMarker = content.slice(
    frontmatter.endIndex,
    markerStartIndex,
  );
  return betweenFrontmatterAndMarker.trim().length === 0 ? 0 : markerStartIndex;
}

function extractLeadingFrontmatter(
  content: string,
): { block: string; body: string; endIndex: number } | null {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/u);
  if (!match) {
    return null;
  }

  const block = match[0] ?? "";
  const endIndex = block.length;
  return {
    block,
    body: content.slice(endIndex).replace(/^\r?\n/u, ""),
    endIndex,
  };
}

function appendUserContent(
  machineSection: string,
  userBeforeSection: string,
  userAfterSection: string,
): string {
  const userContent = [userBeforeSection, userAfterSection]
    .map((content) => content.trim())
    .filter(Boolean)
    .join("\n\n");

  return userContent ? `${machineSection}\n\n${userContent}\n` : machineSection;
}

async function createLegacyBackup(
  app: App,
  reportPath: string,
  content: string,
): Promise<TFile> {
  const backupPath = nextBackupPath(app, reportPath);
  return app.vault.create(backupPath, content);
}

function nextBackupPath(app: App, reportPath: string): string {
  const pathParts = reportPath.split("/");
  const filename = pathParts.pop() ?? reportPath;
  const folder = pathParts.join("/");
  const basename = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const basePath = normalizePath(`${folder}/${basename} Backup ${timestamp}.md`);

  if (!app.vault.getFileByPath(basePath)) {
    return basePath;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = normalizePath(
      `${folder}/${basename} Backup ${timestamp}-${suffix}.md`,
    );
    if (!app.vault.getFileByPath(candidate)) {
      return candidate;
    }
  }
}
