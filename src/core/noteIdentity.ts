import type { ThemeEvidenceNote } from "./types";

export function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

export function normalizeEvidenceReference(value: string): string {
  const wikilinkTarget = value.match(
    /^\[\[([^\]|#\]]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/u,
  )?.[1];
  return normalizeLinkIdentity(wikilinkTarget || value);
}

export function normalizeLinkIdentity(value: string): string {
  return value.trim().replace(/\.md$/iu, "").replace(/\\/gu, "/").toLocaleLowerCase();
}

export function linkTargetMatches(link: string, path: string): boolean {
  const normalizedLink = normalizeEvidenceReference(link);
  return notePathIdentities(path).some((identity) => identity === normalizedLink);
}

export function resolveLinkTarget<T>(link: string, noteByPath: Map<string, T>): string {
  const normalizedLink = normalizeEvidenceReference(link);
  for (const path of noteByPath.keys()) {
    if (notePathIdentities(path).some((identity) => identity === normalizedLink)) {
      return path;
    }
  }
  return link;
}

export function buildEvidenceReferenceIndex(
  notes: ThemeEvidenceNote[],
): Map<string, string> {
  const idsByReference = new Map<string, Set<string>>();
  const addReference = (reference: string, id: string) => {
    const normalized = normalizeEvidenceReference(reference);
    if (!normalized) {
      return;
    }
    const ids = idsByReference.get(normalized) ?? new Set<string>();
    ids.add(id);
    idsByReference.set(normalized, ids);
  };

  for (const note of notes) {
    addReference(note.id, note.id);
    addReference(note.path, note.id);
    addReference(note.path.replace(/\.md$/iu, ""), note.id);
    addReference(note.title, note.id);
  }

  return new Map(
    [...idsByReference.entries()]
      .filter(([, ids]) => ids.size === 1)
      .map(([reference, ids]) => [reference, [...ids][0] as string]),
  );
}

function notePathIdentities(path: string): string[] {
  return [
    normalizeLinkIdentity(path),
    normalizeLinkIdentity(path.replace(/\.md$/iu, "")),
    normalizeLinkIdentity(titleFromPath(path)),
  ];
}
