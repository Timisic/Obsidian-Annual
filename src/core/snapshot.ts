import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { normalizeFolder } from "./settings";
import type {
  AnnualReviewSettings,
  SnapshotComparison,
  SnapshotScope,
  SourceFile,
  VaultSnapshot,
  VaultSnapshotFile,
  VaultSnapshotNote,
} from "./types";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_FILE_NAME = "annual-review-snapshots.json";

export function createVaultSnapshot(
  files: SourceFile[],
  settings: AnnualReviewSettings,
  capturedAt = new Date().toISOString(),
): VaultSnapshot {
  const scope = createSnapshotScope(settings);
  const notes = files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => extractNoteStats(file, settings))
    .map<VaultSnapshotNote>((note) => ({
      path: normalizePath(note.path),
      wordCount: note.wordCount,
      modifiedTime: note.mtime,
      folder: note.folder,
      tags: [...note.tags].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    capturedAt: normalizeIsoDate(capturedAt),
    scope,
    noteCount: notes.length,
    totalWords: notes.reduce((sum, note) => sum + note.wordCount, 0),
    notes,
  };
}

export function createSnapshotScope(settings: AnnualReviewSettings): SnapshotScope {
  return {
    reportFolder: normalizeFolder(settings.reportFolder || "Annual Reviews"),
    includeFolders: normalizeFolderList(settings.includeFolders),
    excludeFolders: normalizeFolderList(settings.excludeFolders),
    excludePatterns: normalizeStringList(settings.excludePatterns),
    privacyMode: settings.privacyMode,
  };
}

export function normalizeSnapshotFile(input: unknown): VaultSnapshotFile {
  if (!isObject(input)) {
    return emptySnapshotFile();
  }

  const schemaVersion =
    input.schemaVersion === SNAPSHOT_SCHEMA_VERSION
      ? SNAPSHOT_SCHEMA_VERSION
      : SNAPSHOT_SCHEMA_VERSION;
  const snapshots = Array.isArray(input.snapshots)
    ? input.snapshots.map(normalizeSnapshot).filter(isVaultSnapshot)
    : [];

  return {
    schemaVersion,
    snapshots: snapshots.sort(sortSnapshots),
  };
}

export function appendSnapshot(
  snapshotFile: VaultSnapshotFile,
  snapshot: VaultSnapshot,
): VaultSnapshotFile {
  return normalizeSnapshotFile({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshots: [...snapshotFile.snapshots, snapshot],
  });
}

export function serializeSnapshotFile(snapshotFile: VaultSnapshotFile): string {
  return `${JSON.stringify(normalizeSnapshotFile(snapshotFile), null, 2)}\n`;
}

export function selectSnapshotComparison(
  snapshots: VaultSnapshot[],
  current: VaultSnapshot,
): SnapshotComparison {
  const earlier = snapshots
    .filter((snapshot) => snapshot.capturedAt < current.capturedAt)
    .sort(sortSnapshots);
  const comparable = [...earlier]
    .reverse()
    .find((snapshot) => scopesEqual(snapshot.scope, current.scope));

  if (comparable) {
    return compareSnapshots(comparable, current);
  }

  const latestIncompatible = earlier[earlier.length - 1];
  if (latestIncompatible) {
    return {
      source: "scope-mismatch",
      baselineCapturedAt: latestIncompatible.capturedAt,
      currentCapturedAt: current.capturedAt,
      baselineTotalWords: latestIncompatible.totalWords,
      currentTotalWords: current.totalWords,
      wordDelta: 0,
      noteCountDelta: 0,
      addedNotes: [],
      removedNotes: [],
      changedNotes: [],
      scope: current.scope,
      baselineScope: latestIncompatible.scope,
    };
  }

  return {
    source: "current-vault-inference",
    currentCapturedAt: current.capturedAt,
    baselineTotalWords: 0,
    currentTotalWords: current.totalWords,
    wordDelta: current.totalWords,
    noteCountDelta: current.noteCount,
    addedNotes: [],
    removedNotes: [],
    changedNotes: [],
    scope: current.scope,
  };
}

export function emptySnapshotFile(): VaultSnapshotFile {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshots: [],
  };
}

function compareSnapshots(
  baseline: VaultSnapshot,
  current: VaultSnapshot,
): SnapshotComparison {
  const baselineNotes = new Map(baseline.notes.map((note) => [note.path, note]));
  const currentNotes = new Map(current.notes.map((note) => [note.path, note]));
  const addedNotes: string[] = [];
  const removedNotes: string[] = [];
  const changedNotes: string[] = [];

  for (const note of current.notes) {
    const previous = baselineNotes.get(note.path);
    if (!previous) {
      addedNotes.push(note.path);
      continue;
    }
    if (previous.wordCount !== note.wordCount) {
      changedNotes.push(note.path);
    }
  }

  for (const note of baseline.notes) {
    if (!currentNotes.has(note.path)) {
      removedNotes.push(note.path);
    }
  }

  return {
    source: "historical-snapshot",
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: current.capturedAt,
    baselineTotalWords: baseline.totalWords,
    currentTotalWords: current.totalWords,
    wordDelta: current.totalWords - baseline.totalWords,
    noteCountDelta: current.noteCount - baseline.noteCount,
    addedNotes,
    removedNotes,
    changedNotes,
    scope: current.scope,
    baselineScope: baseline.scope,
  };
}

function normalizeSnapshot(input: unknown): VaultSnapshot | null {
  if (!isObject(input)) {
    return null;
  }

  const scope = normalizeScope(input.scope);
  const capturedAt =
    typeof input.capturedAt === "string" ? normalizeIsoDate(input.capturedAt) : null;
  if (!scope || !capturedAt || !Array.isArray(input.notes)) {
    return null;
  }

  const notes = input.notes
    .map(normalizeNote)
    .filter(isVaultSnapshotNote)
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    capturedAt,
    scope,
    noteCount: notes.length,
    totalWords: notes.reduce((sum, note) => sum + note.wordCount, 0),
    notes,
  };
}

function normalizeScope(input: unknown): SnapshotScope | null {
  if (!isObject(input)) {
    return null;
  }
  const privacyMode = input.privacyMode === "private" ? "private" : "standard";
  return {
    reportFolder:
      typeof input.reportFolder === "string"
        ? normalizeFolder(input.reportFolder)
        : "Annual Reviews",
    includeFolders: normalizeUnknownStringList(input.includeFolders).map(normalizeFolder),
    excludeFolders: normalizeUnknownStringList(input.excludeFolders).map(normalizeFolder),
    excludePatterns: normalizeUnknownStringList(input.excludePatterns),
    privacyMode,
  };
}

function normalizeNote(input: unknown): VaultSnapshotNote | null {
  if (!isObject(input) || typeof input.path !== "string") {
    return null;
  }
  const wordCount = toNonNegativeInteger(input.wordCount);
  const modifiedTime = toNonNegativeInteger(input.modifiedTime);
  if (wordCount === null || modifiedTime === null) {
    return null;
  }

  return {
    path: normalizePath(input.path),
    wordCount,
    modifiedTime,
    folder: typeof input.folder === "string" ? input.folder : "/",
    tags: normalizeUnknownStringList(input.tags),
  };
}

function normalizeFolderList(folders: string[]): string[] {
  return normalizeStringList(folders.map(normalizeFolder));
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeUnknownStringList(values: unknown): string[] {
  return Array.isArray(values)
    ? normalizeStringList(values.map((value) => String(value)))
    : [];
}

function normalizePath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/^\/+|\/+$/gu, "");
}

function normalizeIsoDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return new Date(0).toISOString();
  }
  return new Date(time).toISOString();
}

function scopesEqual(a: SnapshotScope, b: SnapshotScope): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sortSnapshots(a: VaultSnapshot, b: VaultSnapshot): number {
  return a.capturedAt.localeCompare(b.capturedAt);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.trunc(Number(value)));
}

function isVaultSnapshot(value: VaultSnapshot | null): value is VaultSnapshot {
  return value !== null;
}

function isVaultSnapshotNote(
  value: VaultSnapshotNote | null,
): value is VaultSnapshotNote {
  return value !== null;
}
