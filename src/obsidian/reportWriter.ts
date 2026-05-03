import type { App, TFile } from "obsidian";
import type { AnnualReviewChartAsset } from "../core/render";

export async function writeReport(app: App, reportFolder: string, year: number, content: string): Promise<TFile> {
  const folder = normalizePath(reportFolder || "Annual Reviews");
  await ensureFolder(app, folder);

  const path = normalizePath(`${folder}/${year} Annual Review.md`);
  const existing = app.vault.getFileByPath(path);
  if (existing) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(path, content);
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
