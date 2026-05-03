import { folderFromPath } from "./filters";
import { countText } from "./tokenizer";
import type { AnnualReviewSettings, NoteStats, SourceFile, TaskStats } from "./types";

export function extractNoteStats(file: SourceFile, settings: AnnualReviewSettings): NoteStats {
  const parsed = parseFrontmatter(file.content);
  const frontmatter = file.frontmatter ?? parsed.frontmatter;
  const effectiveFrontmatter = settings.includeFrontmatter ? frontmatter : {};
  const body = parsed.body;
  const counts = countText(body);

  return {
    path: file.path,
    ctime: file.ctime,
    mtime: file.mtime,
    folder: folderFromPath(file.path),
    month: monthKey(file.ctime),
    frontmatter: effectiveFrontmatter,
    tags: collectTags(body, effectiveFrontmatter),
    links: settings.includeLinks ? collectWikiLinks(body) : [],
    headings: settings.includeHeadings ? collectHeadings(body) : [],
    tasks: settings.includeTasks ? collectTasks(body) : { total: 0, completed: 0 },
    wordCount: counts.words,
    charCount: counts.characters,
  };
}

export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
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

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
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
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(parseYamlScalar)
      .filter(Boolean);
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

function collectWikiLinks(body: string): string[] {
  const links = new Set<string>();
  for (const match of body.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu)) {
    const link = match[1]?.trim();
    if (link) {
      links.add(link);
    }
  }
  return [...links].sort();
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
