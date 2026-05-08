import type { App, TFile } from "obsidian";
import type { AnnualReviewChartAsset } from "../core/render";

export const ANNUAL_REVIEW_START_MARKER = "<!-- annual-review:start -->";
export const ANNUAL_REVIEW_END_MARKER = "<!-- annual-review:end -->";

export async function writeReport(app: App, reportFolder: string, year: number, content: string): Promise<TFile> {
  const folder = normalizePath(reportFolder || "Annual Reviews");
  await ensureFolder(app, folder);

  const path = normalizePath(`${folder}/${year} Annual Review.md`);
  const existing = app.vault.getFileByPath(path);
  if (existing) {
    const previousContent = await app.vault.read(existing);
    if (!hasMachineSection(previousContent)) {
      await createLegacyBackup(app, path, previousContent);
    }
    await app.vault.process(existing, (currentContent) => mergeAnnualReviewContent(currentContent, content));
    return existing;
  }
  return app.vault.create(path, formatMachineSection(content));
}

export async function writeAnnualReviewOutput(app: App, reportFolder: string, year: number, content: string, chartAssets: AnnualReviewChartAsset[]): Promise<TFile> {
  for (const asset of chartAssets) {
    await writeTextFile(app, asset.path, asset.content);
  }
  return writeReport(app, reportFolder, year, content);
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
  return path.replace(/\\/gu, "/").replace(/\/{2,}/gu, "/").replace(/^\/+|\/+$/gu, "");
}

function mergeAnnualReviewContent(existingContent: string, nextMachineContent: string): string {
  const section = findMachineSection(existingContent);
  if (!section) {
    return formatMachineSection(nextMachineContent);
  }

  return [
    existingContent.slice(0, section.startIndex),
    formatMachineSection(nextMachineContent),
    existingContent.slice(section.endIndex),
  ].join("");
}

function formatMachineSection(content: string): string {
  const machineContent = content.endsWith("\n") ? content : `${content}\n`;
  return `${ANNUAL_REVIEW_START_MARKER}\n${machineContent}${ANNUAL_REVIEW_END_MARKER}`;
}

function hasMachineSection(content: string): boolean {
  return Boolean(findMachineSection(content));
}

function findMachineSection(content: string): { startIndex: number; endIndex: number } | null {
  const startIndex = content.indexOf(ANNUAL_REVIEW_START_MARKER);
  if (startIndex === -1) {
    return null;
  }

  const endMarkerIndex = content.indexOf(ANNUAL_REVIEW_END_MARKER, startIndex + ANNUAL_REVIEW_START_MARKER.length);
  if (endMarkerIndex === -1) {
    return null;
  }

  return {
    startIndex,
    endIndex: endMarkerIndex + ANNUAL_REVIEW_END_MARKER.length,
  };
}

async function createLegacyBackup(app: App, reportPath: string, content: string): Promise<TFile> {
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
    const candidate = normalizePath(`${folder}/${basename} Backup ${timestamp}-${suffix}.md`);
    if (!app.vault.getFileByPath(candidate)) {
      return candidate;
    }
  }
}
