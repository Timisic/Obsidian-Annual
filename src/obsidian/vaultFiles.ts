import type { App, TFile } from "obsidian";
import { shouldIncludePath } from "../core/filters";
import type { AnnualReviewSettings, SourceFile } from "../core/types";

export async function readVaultMarkdownFiles(app: App, settings: AnnualReviewSettings): Promise<SourceFile[]> {
  const files = app.vault.getMarkdownFiles().filter((file) => shouldIncludePath(file.path, settings));
  return Promise.all(files.map((file) => readSourceFile(app, file)));
}

async function readSourceFile(app: App, file: TFile): Promise<SourceFile> {
  const cache = app.metadataCache.getFileCache(file);
  return {
    path: file.path,
    ctime: file.stat.ctime,
    mtime: file.stat.mtime,
    frontmatter: cache?.frontmatter,
    resolvedLinks: app.metadataCache.resolvedLinks[file.path],
    unresolvedLinks: app.metadataCache.unresolvedLinks[file.path],
    content: await app.vault.cachedRead(file),
  };
}
