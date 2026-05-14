import type { App, TFile } from "obsidian";
import {
  formatReportDocument,
  hasMachineSection,
  mergeReportContent,
} from "../core/reportBoundary";
import { backupReportPath, normalizeVaultPath, reportPath } from "../core/reportPaths";
import type { AnnualReviewChartAsset } from "../core/render";

export {
  ANNUAL_REVIEW_END_MARKER,
  ANNUAL_REVIEW_START_MARKER,
  REVIEW_USER_REFLECTION_END_MARKER,
  REVIEW_USER_REFLECTION_START_MARKER,
} from "../core/reportBoundary";

export async function writeReport(
  app: App,
  reportFolder: string,
  labelOrYear: string | number,
  content: string,
): Promise<TFile> {
  const folder = normalizeVaultPath(reportFolder || "Annual Reviews");
  await ensureFolder(app, folder);

  const path = reportPath(folder, labelOrYear);
  const existing = app.vault.getFileByPath(path);
  if (existing) {
    const previousContent = await app.vault.read(existing);
    if (!hasMachineSection(previousContent)) {
      await createLegacyBackup(app, path, previousContent);
    }
    await app.vault.process(existing, (currentContent) =>
      mergeReportContent(currentContent, content),
    );
    return existing;
  }
  return app.vault.create(path, formatReportDocument(content));
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
  const normalizedPath = normalizeVaultPath(path);
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

async function createLegacyBackup(
  app: App,
  path: string,
  content: string,
): Promise<TFile> {
  const backupPath = nextBackupPath(app, path);
  return app.vault.create(backupPath, content);
}

function nextBackupPath(app: App, path: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const basePath = backupReportPath(path, timestamp);

  if (!app.vault.getFileByPath(basePath)) {
    return basePath;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = backupReportPath(path, timestamp, suffix);
    if (!app.vault.getFileByPath(candidate)) {
      return candidate;
    }
  }
}
