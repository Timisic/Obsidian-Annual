import { folderFromPath } from "./filters";
import { countText } from "./tokenizer";
import type {
  AnnualReviewSettings,
  LinkCounts,
  NoteDateSignal,
  NoteStats,
  SourceFile,
  TaskStats,
} from "./types";

export function extractNoteStats(
  file: SourceFile,
  settings: AnnualReviewSettings,
): NoteStats {
  const parsed = parseFrontmatter(file.content);
  const frontmatter = file.frontmatter ?? parsed.frontmatter;
  const effectiveFrontmatter = settings.includeFrontmatter ? frontmatter : {};
  const body = parsed.body;
  const counts = countText(body);
  const linkCounts = settings.includeLinks ? collectLinkCounts(file, body) : {};
  const noteDate = resolveNoteDate(frontmatter, file.path);

  return {
    path: file.path,
    ctime: file.ctime,
    mtime: file.mtime,
    ...(noteDate ? { noteDate } : {}),
    folder: folderFromPath(file.path),
    month: monthKey(file.ctime),
    frontmatter: effectiveFrontmatter,
    tags: collectTags(body, effectiveFrontmatter),
    links: Object.keys(linkCounts).sort(),
    linkCounts,
    headings: settings.includeHeadings ? collectHeadings(body) : [],
    tasks: settings.includeTasks ? collectTasks(body) : { total: 0, completed: 0 },
    wordCount: counts.words,
    charCount: counts.characters,
  };
}

const FRONTMATTER_DATE_KEYS = [
  "date",
  "create",
  "created",
  "create_time",
  "created_at",
  "createdAt",
  "created_time",
  "createdTime",
  "ctime",
  "day",
  "日期",
];

function resolveNoteDate(
  frontmatter: Record<string, unknown>,
  path: string,
): NoteDateSignal | undefined {
  for (const key of FRONTMATTER_DATE_KEYS) {
    const signal = parseNoteDateValue(frontmatter[key], "frontmatter");
    if (signal) {
      return signal;
    }
  }

  const pathDate = path.match(/(?:^|[/\s_-])(\d{4})[-_.](\d{2})[-_.](\d{2})(?=$|[^\d])/u);
  if (!pathDate) {
    return undefined;
  }

  return buildNoteDateSignal(
    Number(pathDate[1]),
    Number(pathDate[2]),
    Number(pathDate[3]),
    "path",
  );
}

function parseNoteDateValue(
  value: unknown,
  source: NoteDateSignal["source"],
): NoteDateSignal | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const signal = parseNoteDateValue(item, source);
      if (signal) {
        return signal;
      }
    }
    return undefined;
  }
  if (value instanceof Date) {
    return buildNoteDateSignal(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      source,
    );
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return buildNoteDateSignal(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        source,
      );
    }
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const date = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\b|T|\s)/u);
  if (date) {
    return buildNoteDateSignal(Number(date[1]), Number(date[2]), Number(date[3]), source);
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  const parsedDate = new Date(parsed);
  return buildNoteDateSignal(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + 1,
    parsedDate.getDate(),
    source,
  );
}

function buildNoteDateSignal(
  year: number,
  month: number,
  day: number,
  source: NoteDateSignal["source"],
): NoteDateSignal | undefined {
  if (!isValidDateParts(year, month, day)) {
    return undefined;
  }
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    timestamp: new Date(year, month - 1, day).getTime(),
    source,
    value,
  };
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/u);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  return {
    frontmatter: parseYamlSubset(match[1] ?? ""),
    body: content.slice(match[0].length),
  };
}

function parseYamlSubset(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  for (const line of yaml.split(/\r?\n/u)) {
    const listMatch = line.match(/^\s*-\s*(.+)$/u);
    if (listMatch && currentListKey) {
      const current = result[currentListKey];
      if (Array.isArray(current)) {
        current.push(parseYamlScalar(listMatch[1] ?? ""));
      }
      continue;
    }

    const match = line.match(/^([\p{L}\p{N}_-]+):\s*(.*)$/u);
    if (!match) {
      currentListKey = null;
      continue;
    }
    const [, key, rawValue] = match;
    if (key) {
      currentListKey = null;
      if ((rawValue ?? "").trim() === "") {
        result[key] = [];
        currentListKey = key;
        continue;
      }
      result[key] = parseYamlValue(rawValue ?? "");
    }
  }
  return result;
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map(parseYamlScalar).filter(Boolean);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseYamlScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function collectTags(body: string, frontmatter: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  const fmTags = frontmatter.tags;
  if (Array.isArray(fmTags)) {
    fmTags.forEach((tag) => tags.add(normalizeTag(String(tag))));
  } else if (typeof fmTags === "string") {
    fmTags.split(/[,\s]+/u).forEach((tag) => tags.add(normalizeTag(tag)));
  }

  for (const match of body.matchAll(/(^|[\s(])#([\p{L}\p{N}/_-]+)/gu)) {
    tags.add(normalizeTag(match[2] ?? ""));
  }

  return [...tags].filter(Boolean).sort();
}

function collectLinkCounts(file: SourceFile, body: string): LinkCounts {
  if (file.resolvedLinks || file.unresolvedLinks) {
    return normalizeLinkCounts(mergeLinkCounts(file.resolvedLinks, file.unresolvedLinks));
  }

  const links: LinkCounts = {};
  for (const link of parseObsidianWikilinks(body)) {
    incrementLink(links, link.target);
  }
  return normalizeLinkCounts(links);
}

export interface ObsidianWikilink {
  raw: string;
  target: string;
  heading?: string;
  alias?: string;
  embedded: boolean;
}

export function parseObsidianWikilinks(markdown: string): ObsidianWikilink[] {
  const links: ObsidianWikilink[] = [];
  for (const match of markdown.matchAll(/(!)?\[\[([^\]]+)\]\]/gu)) {
    const raw = match[0] ?? "";
    const embedded = Boolean(match[1]);
    const inner = (match[2] ?? "").trim();
    if (!inner) {
      continue;
    }

    const [targetAndHeading = "", alias] = inner.split("|", 2);
    const [target = "", heading] = targetAndHeading.split("#", 2);
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      continue;
    }

    links.push({
      raw,
      target: normalizedTarget,
      heading: heading?.trim() || undefined,
      alias: alias?.trim() || undefined,
      embedded,
    });
  }
  return links;
}

function mergeLinkCounts(...sources: Array<LinkCounts | undefined>): LinkCounts {
  const links: LinkCounts = {};
  for (const source of sources) {
    for (const [link, count] of Object.entries(source ?? {})) {
      links[link] = (links[link] ?? 0) + count;
    }
  }
  return links;
}

function normalizeLinkCounts(links: LinkCounts): LinkCounts {
  return Object.fromEntries(
    Object.entries(links)
      .filter(([link, count]) => link.trim() && Number.isFinite(count) && count > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function incrementLink(links: LinkCounts, link: string): void {
  links[link] = (links[link] ?? 0) + 1;
}

function collectHeadings(body: string): string[] {
  return body
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s{0,3}#{1,6}\s+(.+)$/u)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function collectTasks(body: string): TaskStats {
  let total = 0;
  let completed = 0;
  for (const line of body.split(/\r?\n/u)) {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+/u);
    if (!match) {
      continue;
    }
    total += 1;
    if ((match[1] ?? "").toLowerCase() === "x") {
      completed += 1;
    }
  }
  return { total, completed };
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "");
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
