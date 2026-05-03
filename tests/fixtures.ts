import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SourceFile } from "../src/core/types";

const fixtureRoot = join(import.meta.dirname, "fixtures", "vault");

export async function fixtureFile(path: string, ctime: string, mtime = ctime): Promise<SourceFile> {
  return {
    path,
    ctime: Date.parse(ctime),
    mtime: Date.parse(mtime),
    content: await readFile(join(fixtureRoot, path), "utf8"),
  };
}

export async function fixtureVault(): Promise<SourceFile[]> {
  return [
    await fixtureFile("Daily/2026-01-01.md", "2026-01-01T08:00:00.000Z", "2026-01-01T10:00:00.000Z"),
    await fixtureFile("Daily/2026-01-02.md", "2026-01-02T08:00:00.000Z", "2026-01-03T10:00:00.000Z"),
    await fixtureFile("Projects/Research.md", "2026-02-10T08:00:00.000Z", "2026-03-01T10:00:00.000Z"),
    await fixtureFile("Projects/Legacy.md", "2025-12-20T08:00:00.000Z", "2026-04-05T10:00:00.000Z"),
    await fixtureFile("Annual Reviews/2026 Annual Review.md", "2026-12-31T08:00:00.000Z"),
    await fixtureFile("Templates/Daily Template.md", "2026-01-01T08:00:00.000Z"),
    await fixtureFile("Archive/Old.md", "2026-01-01T08:00:00.000Z"),
  ];
}
