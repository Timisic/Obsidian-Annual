import { buildEvidenceReferenceIndex, normalizeEvidenceReference } from "./noteIdentity";
import type {
  ThemeEvidenceNote,
  ThemeEvidencePackage,
  ThemeHypothesis,
  ThemeHypothesisSource,
} from "./types";

const MAX_THEME_HYPOTHESES = 15;

export interface ThemeHypothesisContractResult {
  hypotheses: ThemeHypothesis[];
  violations: string[];
}

export function parseThemeHypothesisContract(
  content: string,
  evidencePackage: ThemeEvidencePackage,
): ThemeHypothesisContractResult {
  const parsed = parseJsonValue(content);
  const violations: string[] = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      hypotheses: [],
      violations: ["Provider response must be a JSON object."],
    };
  }

  const record = parsed as Record<string, unknown>;
  const rawThemes = arrayValue(record.themeHypotheses);
  if (!Array.isArray(record.themeHypotheses)) {
    violations.push("Provider response must include themeHypotheses[].");
  }

  const validIds = new Set(evidencePackage.evidenceNotes.map((note) => note.id));
  const idByReference = buildEvidenceReferenceIndex(evidencePackage.evidenceNotes);
  const noteById = new Map(evidencePackage.evidenceNotes.map((note) => [note.id, note]));
  const hypotheses = rawThemes
    .map((value, index) =>
      toThemeHypothesis(value, index, validIds, idByReference, noteById, violations),
    )
    .filter((theme): theme is ThemeHypothesis => Boolean(theme))
    .slice(0, MAX_THEME_HYPOTHESES);

  return { hypotheses, violations };
}

function toThemeHypothesis(
  value: unknown,
  index: number,
  validIds: Set<string>,
  idByReference: Map<string, string>,
  noteById: Map<string, ThemeEvidenceNote>,
  violations: string[],
): ThemeHypothesis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`themeHypotheses[${index}] must be an object.`);
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = stringValue(record.title);
  const summary = stringValue(record.summary);
  const reportNarrative = stringValue(record.reportNarrative);
  const connectionExplanation = stringValue(record.connectionExplanation);
  if (!title) {
    violations.push(`themeHypotheses[${index}].title is required.`);
  }
  if (!summary) {
    violations.push(`themeHypotheses[${index}].summary is required.`);
  }
  if (!connectionExplanation) {
    violations.push(`themeHypotheses[${index}].connectionExplanation is required.`);
  }
  if (!Array.isArray(record.evidenceNoteIds)) {
    violations.push(`themeHypotheses[${index}].evidenceNoteIds[] is required.`);
  }
  if (!title || !summary || !connectionExplanation) {
    return null;
  }

  const evidenceNoteIds = [
    ...new Set(
      arrayValue(record.evidenceNoteIds)
        .map((item) => normalizeEvidenceId(item, validIds, idByReference))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (evidenceNoteIds.length === 0) {
    violations.push(
      `themeHypotheses[${index}].evidenceNoteIds did not match supplied evidence notes.`,
    );
    return null;
  }

  const uncertainty = stringValue(record.uncertainty);
  const localSignals = normalizedSignalList(record.localSignals);
  return {
    id: stringValue(record.id) || `theme:ai:${index + 1}`,
    title,
    summary,
    reportNarrative: reportNarrative || undefined,
    evidenceNoteIds,
    connectionExplanation,
    localSignals:
      localSignals.length > 0
        ? localSignals
        : evidenceNoteIds
            .flatMap((id) => noteById.get(id)?.localSignals ?? [])
            .filter(
              (signal, signalIndex, signals) => signals.indexOf(signal) === signalIndex,
            )
            .slice(0, 8),
    uncertainty:
      evidenceNoteIds.length < 2 && !uncertainty
        ? "Low confidence: fewer than two evidence notes support this hypothesis."
        : uncertainty || undefined,
    source: sourceValue(record.source),
  };
}

function normalizeEvidenceId(
  value: unknown,
  validIds: Set<string>,
  idByReference: Map<string, string>,
): string | null {
  const text = stringValue(value);
  if (!text) {
    return null;
  }
  if (validIds.has(text)) {
    return text;
  }
  return idByReference.get(normalizeEvidenceReference(text)) ?? null;
}

function parseJsonValue(content: string): unknown {
  const candidates = [
    content.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1],
    content,
    content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string =>
    Boolean(candidate && candidate.trim().startsWith("{")),
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizedSignalList(value: unknown): string[] {
  return arrayValue(value).map(stringValue).filter(Boolean).slice(0, 8);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? sanitizeInlineText(value, 700) : "";
}

function sourceValue(value: unknown): ThemeHypothesisSource {
  return value === "local" || value === "ai" || value === "mixed" ? value : "ai";
}

function sanitizeInlineText(value: string, maxLength: number): string {
  return value
    .replace(
      /\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu,
      (_match, path: string, suffix = "") => `[[${path}${suffix}]]`,
    )
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}
