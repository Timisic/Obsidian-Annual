import type {
  AnnualReviewSettings,
  GenerateReportOptions,
  ReviewPreset,
  ReviewSession,
} from "./types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function buildAnnualReviewSession(
  year: number,
  settings: AnnualReviewSettings,
  timestamp = new Date().toISOString(),
): ReviewSession {
  return buildSession({
    preset: "annual",
    label: `${year} Annual Review`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    settings,
    timestamp,
  });
}

export function buildQuarterlyReviewSession(
  year: number,
  quarter: number,
  settings: AnnualReviewSettings,
  timestamp = new Date().toISOString(),
): ReviewSession {
  const normalizedQuarter = clampInteger(quarter, 1, 4);
  const startMonth = (normalizedQuarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return buildSession({
    preset: "quarterly",
    label: `${year} Q${normalizedQuarter} Review`,
    startDate: `${year}-${pad(startMonth)}-01`,
    endDate: endOfMonth(year, endMonth),
    settings,
    timestamp,
  });
}

export function buildMonthlyReviewSession(
  year: number,
  month: number,
  settings: AnnualReviewSettings,
  timestamp = new Date().toISOString(),
): ReviewSession {
  const normalizedMonth = clampInteger(month, 1, 12);
  const monthKey = `${year}-${pad(normalizedMonth)}`;
  return buildSession({
    preset: "monthly",
    label: `${monthKey} Review`,
    startDate: `${monthKey}-01`,
    endDate: endOfMonth(year, normalizedMonth),
    settings,
    timestamp,
  });
}

export interface ReviewPresetFieldVisibility {
  year: boolean;
  quarter: boolean;
  month: boolean;
  customRange: boolean;
}

export function reviewPresetFieldVisibility(
  preset: ReviewPreset,
): ReviewPresetFieldVisibility {
  return {
    year: preset === "annual" || preset === "quarterly" || preset === "monthly",
    quarter: preset === "quarterly",
    month: preset === "monthly",
    customRange: preset === "custom",
  };
}

export function buildCustomReviewSession(input: {
  label?: string;
  startDate: string;
  endDate: string;
  settings: AnnualReviewSettings;
  timestamp?: string;
}): ReviewSession {
  const startDate = normalizeDateKey(input.startDate);
  const endDate = normalizeDateKey(input.endDate);
  if (startDate > endDate) {
    throw new Error("Custom review start date must be before or equal to end date.");
  }
  const label = input.label?.trim() || `${startDate} to ${endDate} Review`;
  return buildSession({
    preset: "custom",
    label,
    startDate,
    endDate,
    settings: input.settings,
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export function resolveGenerateReviewSession(
  options: GenerateReportOptions,
): ReviewSession {
  if (options.session) {
    return normalizeReviewSession(options.session, options.settings);
  }
  return buildAnnualReviewSession(
    options.year ?? new Date().getFullYear(),
    options.settings,
  );
}

export function normalizeReviewSession(
  session: ReviewSession,
  settings: AnnualReviewSettings,
): ReviewSession {
  return buildSession({
    preset: session.preset,
    label: session.label,
    startDate: session.startDate,
    endDate: session.endDate,
    settings: {
      ...settings,
      includeFolders: session.includeFolders,
      excludeFolders: session.excludeFolders,
      excludePatterns: session.excludePatterns,
      aiProvider: session.aiEnabled ? settings.aiProvider : "none",
    },
    timestamp: session.updatedAt || session.createdAt || new Date().toISOString(),
    createdAt: session.createdAt,
  });
}

export function reviewSessionYear(session: Pick<ReviewSession, "startDate">): number {
  return Number(session.startDate.slice(0, 4));
}

export function reviewSessionContainsDate(
  session: Pick<ReviewSession, "startDate" | "endDate">,
  timestamp: number,
): boolean {
  const key = dateKey(timestamp);
  return key >= session.startDate && key <= session.endDate;
}

export function reviewSessionMonthKeys(
  session: Pick<ReviewSession, "startDate" | "endDate">,
): string[] {
  const [startYear, startMonth] = parseDateParts(session.startDate);
  const [endYear, endMonth] = parseDateParts(session.endDate);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function reviewSessionDayKeys(
  session: Pick<ReviewSession, "startDate" | "endDate">,
): string[] {
  const days: string[] = [];
  for (
    let current = localDateTime(session.startDate);
    current <= localDateTime(session.endDate);
    current += 86_400_000
  ) {
    days.push(dateKey(current));
  }
  return days;
}

export function reviewSessionPathLabel(label: string): string {
  return (
    label
      .trim()
      .replace(/[\\/:*?"<>|#^[\]]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 120) || "Review"
  );
}

function buildSession(input: {
  preset: ReviewSession["preset"];
  label: string;
  startDate: string;
  endDate: string;
  settings: AnnualReviewSettings;
  timestamp: string;
  createdAt?: string;
}): ReviewSession {
  const startDate = normalizeDateKey(input.startDate);
  const endDate = normalizeDateKey(input.endDate);
  if (startDate > endDate) {
    throw new Error("Review session start date must be before or equal to end date.");
  }
  const updatedAt = normalizeTimestamp(input.timestamp);
  const label = reviewSessionPathLabel(input.label);
  return {
    id: `${input.preset}:${startDate}:${endDate}:${slug(label)}`,
    preset: input.preset,
    label,
    startDate,
    endDate,
    includeFolders: [...input.settings.includeFolders],
    excludeFolders: [...input.settings.excludeFolders],
    excludePatterns: [...input.settings.excludePatterns],
    aiEnabled: input.settings.aiProvider !== "none",
    createdAt: normalizeTimestamp(input.createdAt ?? updatedAt),
    updatedAt,
  };
}

function normalizeDateKey(value: string): string {
  const trimmed = value.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) {
    throw new Error(`Invalid review date: ${value}`);
  }
  const normalized = dateKey(localDateTime(trimmed));
  if (normalized !== trimmed) {
    throw new Error(`Invalid review date: ${value}`);
  }
  return normalized;
}

function normalizeTimestamp(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
}

function endOfMonth(year: number, month: number): string {
  return dateKey(new Date(year, month, 0).getTime());
}

function parseDateParts(value: string): [number, number, number] {
  const [year = "0", month = "1", day = "1"] = value.split("-");
  return [Number(year), Number(month), Number(day)];
}

function localDateTime(date: string): number {
  const [year, month, day] = parseDateParts(date);
  return new Date(year, month - 1, day).getTime();
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 80) || stableHash(value)
  );
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
