import { normalizePath, type App, type TFile } from "obsidian";

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
