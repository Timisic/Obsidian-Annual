import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { DEFAULT_LOCAL_CODEX_COMMAND } from "./settings";
import type { AiHighValueNoteInsight, AiReportEnhancements, AiThemeInsight, AnnualReviewSettings, NoteStats, SourceFile, YearAggregate } from "./types";

const MAX_AI_CONTEXT_NOTES = 80;
const MAX_AI_CONTEXT_EXCERPT_CHARS = 700;
const MAX_CODEX_CONTEXT_NOTES = 28;
const MAX_LINKED_NOTE_CONTEXT = 4;
const LOCAL_CODEX_TIMEOUT_MS = 300_000;
const LOCAL_CODEX_PATH_ENTRIES = ["/Users/hong/.npm-global/bin", "/opt/homebrew/bin", "/usr/local/bin"];
const ABSOLUTE_CODEX_COMMAND_EXAMPLE = '/Users/hong/.npm-global/bin/codex exec --color never --sandbox read-only --skip-git-repo-check -c \'features.codex_hooks=false\' --output-last-message "$CODEX_ANNUAL_REVIEW_OUTPUT" -';

export interface ChatGptReportOptions {
  aggregate: YearAggregate;
  files: SourceFile[];
  settings: AnnualReviewSettings;
  fetcher?: typeof fetch;
  codexExecutor?: CodexExecutor;
}

export type CodexExecutor = (prompt: string, command: string) => Promise<CodexExecutorResult>;

interface CodexExecutorResult {
  ok: boolean;
  content: string;
}

interface OpenAiResponse {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      text?: unknown;
      type?: unknown;
    }>;
  }>;
}

export async function renderAiReportSection(options: ChatGptReportOptions): Promise<string> {
  const enhancements = await renderAiReportEnhancements(options);
  return enhancements.periodJudgment;
}

export async function renderAiReportEnhancements(options: ChatGptReportOptions): Promise<AiReportEnhancements> {
  if (options.settings.aiProvider === "none") {
    return emptyAiEnhancements();
  }

  if (options.settings.aiProvider !== "chatgpt") {
    return unavailableAiEnhancements(`Unsupported AI provider: ${options.settings.aiProvider}`);
  }

  const apiKey = options.settings.chatGptApiKey.trim();
  if (!apiKey) {
    return renderCodexReportSection(options);
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.settings.chatGptModel.trim() || "gpt-4.1",
      instructions: [
        "You enrich an Obsidian annual review from supplied vault statistics, note excerpts, backlinks, and linked-note context.",
        "Return JSON only with periodJudgment, themeInsights, highValueNotes, and nextActions.",
        "Use the embedded Obsidian CLI/Markdown/Bases skill handoff as binding output guidance.",
        "Theme titles must be synthesized content themes, not raw tags, folders, months, or specific document names.",
        "Preserve source note paths exactly when using evidenceNotes or highValueNotes.path.",
        "Do not invent private facts that are not present in the context.",
      ].join(" "),
      input: buildAiPrompt(options.aggregate, options.files, options.settings),
      max_output_tokens: 2600,
    }),
  });

  if (!response.ok) {
    const message = await safeResponseText(response);
    return unavailableAiEnhancements(`ChatGPT provider request failed (${response.status}): ${message}`);
  }

  const data = (await response.json()) as OpenAiResponse;
  const content = extractResponseText(data).trim();
  if (!content) {
    return unavailableAiEnhancements("ChatGPT provider returned an empty response.");
  }

  return withFallbackHighValueEnhancements(parseAiEnhancements(content), options);
}

async function renderCodexReportSection(options: ChatGptReportOptions): Promise<AiReportEnhancements> {
  const executor = options.codexExecutor ?? runLocalCodex;
  const command = options.settings.localCodexCommand.trim() || DEFAULT_LOCAL_CODEX_COMMAND;
  const result = await executor(buildCodexPrompt(options.aggregate, options.files, options.settings), command);
  if (!result.ok || !result.content.trim()) {
    return unavailableAiEnhancements(`ChatGPT provider was selected without an OpenAI API key, and local Codex generation was unavailable: ${result.content || "No response."}`);
  }

  return withFallbackHighValueEnhancements(parseAiEnhancements(result.content), options);
}

export function buildAiPrompt(aggregate: YearAggregate, files: SourceFile[], settings: AnnualReviewSettings): string {
  const activeNotes = activeNoteEntries(aggregate, files, settings);
  const noteByPath = new Map(activeNotes.map((entry) => [entry.note.path, entry]));

  const contextNotes = activeNotes.slice(0, MAX_AI_CONTEXT_NOTES).map(({ file, note }) => ({
    path: note.path,
    folder: note.folder,
    created: new Date(note.ctime).toISOString(),
    modified: new Date(note.mtime).toISOString(),
    words: note.wordCount,
    characters: note.charCount,
    tags: note.tags,
    links: note.links,
    headings: note.headings,
    backlinks: backlinkContext(note.path, activeNotes, MAX_LINKED_NOTE_CONTEXT),
    linkedNotes: linkedNoteContext(note, noteByPath, MAX_LINKED_NOTE_CONTEXT),
    excerpt: excerpt(file.content),
  }));

  const linkGraph = activeNotes.map(({ note }) => ({
    path: note.path,
    links: note.links,
  }));

  const omittedNoteCount = Math.max(0, activeNotes.length - contextNotes.length);

  return JSON.stringify(
    {
      task: "Generate an Obsidian annual review enrichment JSON object with content-synthesized themes, richer high-value-note reasons, and concrete next actions.",
      outputSchema: {
        periodJudgment: "one evidence-backed sentence for the whole year",
        themeInsights: [
          {
            title: "synthesized content theme; do not use raw tags/folders/months/document titles",
            synthesis: "2-3 sentence annual summary grounded in note excerpts and backlinks",
            connections: "how this theme connects to other themes or notes",
            evidenceNotes: ["exact source note paths from contextNotes"],
            nextQuestion: "one concrete review question",
          },
        ],
        highValueNotes: [
          {
            path: "exact source note path from highValueEvidence",
            reason: "content-specific value reason, not only link/word metrics",
            suggestedAction: "Obsidian-native next action",
          },
        ],
        nextActions: ["3 concise actions grounded in the supplied notes"],
      },
      obsidianSkillHandoff: obsidianSkillHandoff(),
      contextPolicy: {
        noteCoverage: omittedNoteCount === 0 ? "All active notes are included with excerpts." : `${contextNotes.length} active notes include excerpts; ${omittedNoteCount} additional active notes are represented in the link graph only.`,
        excerptLimit: `${MAX_AI_CONTEXT_EXCERPT_CHARS} characters per included note`,
        evidenceRules: "Use supplied excerpts, backlinks, linkedNotes, and exact Obsidian note paths. Preserve wikilink compatibility.",
      },
      year: aggregate.year,
      privacyMode: aggregate.scope.privacyMode,
      totals: {
        createdNotes: aggregate.createdCount,
        modifiedNotes: aggregate.modifiedCount,
        activeDays: aggregate.activeDays,
        longestStreak: aggregate.longestStreak,
        totalWords: aggregate.totalWords,
        totalCharacters: aggregate.totalCharacters,
      },
      monthlyWords: aggregate.monthBuckets.map((month) => ({
        month: month.month,
        created: month.created,
        modified: month.modified,
        words: month.words,
        cumulativeWords: aggregate.wordGrowthBuckets.find((growth) => growth.month === month.month)?.cumulativeWords ?? 0,
      })),
      topTags: aggregate.topTags,
      topFolders: aggregate.topFolders,
      topLinks: aggregate.topLinks,
      representativeNotes: aggregate.representativeNotes,
      statisticalTopicSeeds: aggregate.topicEvolution.topTopics,
      highValueEvidence: highValueEvidence(aggregate, activeNotes, noteByPath),
      linkGraph,
      contextNotes,
      omittedNoteCount,
    },
    null,
    2,
  );
}

export function buildCodexPrompt(aggregate: YearAggregate, files: SourceFile[], settings: AnnualReviewSettings): string {
  return [
    "You are generating structured Obsidian annual review enrichment.",
    "Use the embedded Obsidian CLI/Markdown/Bases skill handoff as binding guidance.",
    "Use only the supplied JSON context unless your runtime exposes the vault read-only; preserve source note paths exactly.",
    "Return JSON only with periodJudgment, themeInsights, highValueNotes, and nextActions.",
    "Theme titles must be synthesized content themes, not raw tags, folders, months, or specific document names.",
    "",
    JSON.stringify(buildCodexContext(aggregate, files, settings)),
  ].join("\n");
}

function buildCodexContext(aggregate: YearAggregate, files: SourceFile[], settings: AnnualReviewSettings): unknown {
  const activeNotes = activeNoteEntries(aggregate, files, settings);
  const noteByPath = new Map(activeNotes.map((entry) => [entry.note.path, entry]));
  const contextNotes = activeNotes
    .slice(0, MAX_CODEX_CONTEXT_NOTES)
    .map(({ file, note }) => ({
      path: note.path,
      headings: note.headings,
      tags: note.tags,
      links: note.links,
      backlinks: backlinkContext(note.path, activeNotes, 3),
      excerpt: excerpt(file.content),
    }));

  return {
    task: "Generate content-synthesized annual review enrichment JSON from aggregate evidence plus note excerpts/backlinks.",
    outputSchema: {
      periodJudgment: "one evidence-backed sentence",
      themeInsights: "3-5 synthesized content themes with title, synthesis, connections, evidenceNotes, nextQuestion",
      highValueNotes: "path-specific value reasons and suggested actions for important notes",
      nextActions: "3 grounded next actions",
    },
    obsidianSkillHandoff: obsidianSkillHandoff(),
    contextPolicy: {
      noteCoverage: `${contextNotes.length} active notes include excerpts and backlink summaries for local Codex fallback.`,
      evidenceSources: "Use listed note paths, excerpts, topic metrics, link metrics, high-value note signals, and backlink context only.",
    },
    year: aggregate.year,
    privacyMode: aggregate.scope.privacyMode,
    totals: {
      createdNotes: aggregate.createdCount,
      modifiedNotes: aggregate.modifiedCount,
      activeDays: aggregate.activeDays,
      longestStreak: aggregate.longestStreak,
      totalWords: aggregate.totalWords,
      totalCharacters: aggregate.totalCharacters,
    },
    monthlyWords: aggregate.monthBuckets
      .filter((month) => month.words > 0 || month.created > 0 || month.modified > 0)
      .map((month) => ({ month: month.month, created: month.created, modified: month.modified, words: month.words })),
    topTags: aggregate.topTags.slice(0, 6),
    topFolders: aggregate.topFolders.slice(0, 5),
    topLinks: aggregate.topLinks.slice(0, 6),
    representativeNotes: aggregate.representativeNotes.slice(0, 6),
    topTopics: aggregate.topicEvolution.topTopics.slice(0, 5).map((topic) => ({
      name: topic.name,
      addedWords: topic.addedWords,
      newNotes: topic.newNotes,
      updatedNotes: topic.updatedNotes,
      representativeNotes: topic.representativeNotes.slice(0, 2),
    })),
    emergingTopics: aggregate.topicEvolution.emergingTopics.slice(0, 5),
    decliningTopics: aggregate.topicEvolution.decliningTopics.slice(0, 5),
    highValueNotes: aggregate.highValueNotes.slice(0, 5).map((note) => ({
      path: note.path,
      kind: note.kind,
      reason: note.reason,
      suggestedAction: note.suggestedAction,
      periodWordCount: note.periodWordCount,
    })),
    highValueEvidence: highValueEvidence(aggregate, activeNotes, noteByPath),
    contextNotes,
    outputReadyNotes: aggregate.outputReadyNotes.slice(0, 3).map((note) => note.path),
    maintenanceNotes: aggregate.maintenanceNotes.slice(0, 3).map((note) => note.path),
    isolatedPotentialNotes: aggregate.isolatedPotentialNotes.slice(0, 3).map((note) => note.path),
  };
}

function activeNoteEntries(aggregate: YearAggregate, files: SourceFile[], settings: AnnualReviewSettings): Array<{ file: SourceFile; note: NoteStats }> {
  return files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => ({ file, note: extractNoteStats(file, settings) }))
    .filter((entry) => new Date(entry.note.ctime).getFullYear() === aggregate.year || new Date(entry.note.mtime).getFullYear() === aggregate.year)
    .sort((a, b) => a.note.path.localeCompare(b.note.path));
}

function backlinkContext(path: string, activeNotes: Array<{ file: SourceFile; note: NoteStats }>, limit: number): Array<{ path: string; count: number; excerpt: string }> {
  return activeNotes
    .flatMap(({ file, note }) => {
      if (note.path === path) {
        return [];
      }
      const count = Object.entries(note.linkCounts).reduce((sum, [link, amount]) => sum + (linkTargetMatches(link, path) ? amount : 0), 0);
      return count > 0 ? [{ path: note.path, count, excerpt: excerpt(file.content) }] : [];
    })
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function linkedNoteContext(note: NoteStats, noteByPath: Map<string, { file: SourceFile; note: NoteStats }>, limit: number): Array<{ path: string; count: number; excerpt: string }> {
  return Object.entries(note.linkCounts)
    .map(([link, count]) => {
      const target = noteByPath.get(resolveLinkTarget(link, noteByPath));
      return target ? { path: target.note.path, count, excerpt: excerpt(target.file.content) } : null;
    })
    .filter((entry): entry is { path: string; count: number; excerpt: string } => Boolean(entry))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function highValueEvidence(
  aggregate: YearAggregate,
  activeNotes: Array<{ file: SourceFile; note: NoteStats }>,
  noteByPath: Map<string, { file: SourceFile; note: NoteStats }>,
): Array<Record<string, unknown>> {
  return aggregate.highValueNotes.slice(0, 10).map((item) => {
    const entry = noteByPath.get(item.path);
    return {
      path: item.path,
      kind: item.kind,
      metricReason: item.reason,
      metricSuggestedAction: item.suggestedAction,
      inboundLinks: item.inboundLinks,
      outboundLinks: item.outboundLinks,
      topics: item.topics,
      lastUpdated: item.lastUpdated,
      periodWordCount: item.periodWordCount,
      headings: entry?.note.headings ?? [],
      excerpt: entry ? excerpt(entry.file.content) : "",
      backlinks: backlinkContext(item.path, activeNotes, MAX_LINKED_NOTE_CONTEXT),
      linkedNotes: entry ? linkedNoteContext(entry.note, noteByPath, MAX_LINKED_NOTE_CONTEXT) : [],
    };
  });
}

function withFallbackHighValueEnhancements(enhancements: AiReportEnhancements, options: ChatGptReportOptions): AiReportEnhancements {
  if (enhancements.highValueNotes.length > 0 || enhancements.themeInsights.length === 0) {
    return enhancements;
  }
  return {
    ...enhancements,
    highValueNotes: fallbackHighValueNotes(options.aggregate, options.files, options.settings, enhancements.themeInsights),
  };
}

function fallbackHighValueNotes(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
  themes: AiThemeInsight[],
): AiHighValueNoteInsight[] {
  const activeNotes = activeNoteEntries(aggregate, files, settings);
  const noteByPath = new Map(activeNotes.map((entry) => [entry.note.path, entry]));
  const language = settings.reportLanguage === "en" ? "en" : "zh";
  return aggregate.highValueNotes.slice(0, 10).map((note) => {
    const entry = noteByPath.get(note.path);
    const linkedTitles = entry ? linkedNoteContext(entry.note, noteByPath, 3).map((linked) => titleFromPath(linked.path)) : [];
    const backlinks = backlinkContext(note.path, activeNotes, 3).map((linked) => titleFromPath(linked.path));
    const related = [...new Set([...linkedTitles, ...backlinks])].slice(0, 3);
    const theme = relatedTheme(note, themes);
    const title = titleFromPath(note.path);
    if (language === "en") {
      return {
        path: note.path,
        reason: `${title} is valuable because its content can anchor ${theme || "a synthesized annual theme"} and is supported by ${related.length > 0 ? related.join(", ") : "its current link context"}, not just by raw word/link counts.`,
        suggestedAction: `Add a short current-judgment section, list evidence notes, and turn the note into an Obsidian index for ${theme || title}.`,
      };
    }
    return {
      path: note.path,
      reason: `这篇的价值不只是 ${note.inboundLinks} 个入链或 ${note.periodWordCount} 字词，而是能承载「${theme || title}」这条主线，并和${related.length > 0 ? `「${related.join("」「")}」等笔记` : "现有双链上下文"}形成证据链。`,
      suggestedAction: `补一段“当前判断 / 证据笔记 / 下一步问题”，把它整理成「${theme || title}」的 Obsidian 主题入口。`,
    };
  });
}

function relatedTheme(note: { path: string; topics: string[] }, themes: AiThemeInsight[]): string {
  const noteTitle = titleFromPath(note.path);
  const evidenceMatch = themes.find((theme) => theme.evidenceNotes.some((path) => normalizeLinkIdentity(path) === normalizeLinkIdentity(note.path)));
  if (evidenceMatch) {
    return evidenceMatch.title;
  }
  const topicMatch = themes.find((theme) => [theme.title, theme.synthesis, theme.connections].some((text) => note.topics.some((topic) => text.toLocaleLowerCase().includes(topic.toLocaleLowerCase()))));
  return topicMatch?.title || themes.find((theme) => theme.synthesis.includes(noteTitle) || theme.connections.includes(noteTitle))?.title || "";
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function linkTargetMatches(link: string, path: string): boolean {
  return normalizeLinkIdentity(link) === normalizeLinkIdentity(path) || normalizeLinkIdentity(link) === normalizeLinkIdentity(path.replace(/\.md$/iu, ""));
}

function resolveLinkTarget(link: string, noteByPath: Map<string, { file: SourceFile; note: NoteStats }>): string {
  const normalized = normalizeLinkIdentity(link);
  for (const path of noteByPath.keys()) {
    if (normalizeLinkIdentity(path) === normalized || normalizeLinkIdentity(path.replace(/\.md$/iu, "")) === normalized || normalizeLinkIdentity(path.split("/").pop()?.replace(/\.md$/iu, "") ?? path) === normalized) {
      return path;
    }
  }
  return link;
}

function normalizeLinkIdentity(value: string): string {
  return value.trim().replace(/\.md$/iu, "").replace(/\\/gu, "/").toLocaleLowerCase();
}

function obsidianSkillHandoff(): Record<string, unknown> {
  return {
    invokedSkills: ["obsidian-cli", "obsidian-markdown", "obsidian-bases"],
    obsidianCli: [
      "Treat active-year notes, backlinks, and linked-note excerpts as if read through Obsidian vault APIs/CLI.",
      "When citing evidence, use exact vault-relative note paths supplied in context.",
    ],
    obsidianMarkdown: [
      "Use Obsidian wikilinks for internal evidence and preserve paths without inventing aliases.",
      "Avoid raw pipes inside Markdown table cells; table wikilinks should use plain [[path]] form.",
      "Generated prose should be valid Obsidian Flavored Markdown and readable as an editable note.",
    ],
    obsidianBases: [
      "Think of theme/high-value-note outputs as database-like rows: stable title, evidence notes, synthesis, and action fields.",
      "Prefer structured, reusable fields over vague paragraphs.",
    ],
  };
}

export async function runLocalCodex(prompt: string, command = DEFAULT_LOCAL_CODEX_COMMAND): Promise<CodexExecutorResult> {
  const outputDir = await mkdtemp(join(tmpdir(), "annual-review-codex-"));
  const outputPath = join(outputDir, "last-message.md");
  return new Promise((resolve) => {
    const env = buildLocalCodexEnv(process.env, outputPath);
    const child = spawn("bash", ["-lc", command], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (result: CodexExecutorResult) => {
      if (settled) {
        return;
      }
      settled = true;
      void rm(outputDir, { recursive: true, force: true });
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ ok: false, content: `Local Codex generation timed out after ${Math.round(LOCAL_CODEX_TIMEOUT_MS / 1000)} seconds while running localCodexCommand: ${command}.` });
    }, LOCAL_CODEX_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      finish({ ok: false, content: error.message });
    });
    child.on("close", async (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      const lastMessage = await readCodexLastMessage(outputPath);
      const streamMessage = extractCodexStreamMessage(output) || extractCodexStreamMessage(errorOutput);
      if (code === 0 && (lastMessage || streamMessage || output)) {
        finish({ ok: true, content: lastMessage || streamMessage || output });
        return;
      }
      finish({ ok: false, content: formatLocalCodexFailure(command, errorOutput, output, code, env.PATH ?? "") });
    });
    child.stdin.end(prompt);
  });
}

export function buildLocalCodexEnv(baseEnv: NodeJS.ProcessEnv, outputPath: string): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    PATH: [...LOCAL_CODEX_PATH_ENTRIES, baseEnv.PATH ?? ""].filter(Boolean).join(":"),
    CODEX_ANNUAL_REVIEW_OUTPUT: outputPath,
  };
}

export function formatLocalCodexFailure(command: string, stderr: string, stdout: string, code: number | null, path: string): string {
  const commandNotFound = extractCommandNotFound(stderr || stdout);
  if (commandNotFound) {
    return `Local Codex was not found from Obsidian's runtime PATH while running localCodexCommand: ${command}; PATH used for fallback: ${path || "(empty)"}; try setting localCodexCommand to: ${ABSOLUTE_CODEX_COMMAND_EXAMPLE}; underlying error: ${commandNotFound}.`;
  }

  return `Local Codex command failed with status ${code ?? "unknown"} while running localCodexCommand: ${command}; check that the Codex CLI is installed, authenticated, and reachable from Obsidian.`;
}

function extractCommandNotFound(output: string): string {
  return output.match(/(?:bash: (?:line \d+: )?)?codex: command not found/u)?.[0] ?? "";
}

function extractCodexStreamMessage(output: string): string {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const markerIndex = lines.lastIndexOf("codex");
  if (markerIndex === -1) {
    return "";
  }
  return lines
    .slice(markerIndex + 1)
    .filter((line) => line !== "tokens used" && !/^\d[\d,]*$/u.test(line) && !line.startsWith("hook:"))
    .join(" ")
    .trim();
}

async function readCodexLastMessage(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

function excerpt(content: string): string {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/u, "").replace(/\s+/gu, " ").trim();
  if (body.length <= MAX_AI_CONTEXT_EXCERPT_CHARS) {
    return body;
  }
  return `${body.slice(0, MAX_AI_CONTEXT_EXCERPT_CHARS).trim()}...`;
}

function aiUnavailableSummary(reason: string): string {
  return toOneSentenceSummary(`AI summary unavailable: ${reason}`, 700);
}

function toOneSentenceSummary(markdown: string, maxLength = 240): string {
  const body = markdown
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/u.test(line) && !/^>/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").replace(/^\d+\.\s+/u, ""))
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  const sentence = body.match(/^(.+?[.!?。！？])(?:\s|$)/u)?.[1] ?? body;
  return sentence.slice(0, maxLength).trim();
}

function extractResponseText(data: OpenAiResponse): string {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const chunks: string[] = [];
  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n\n");
}

function parseAiEnhancements(content: string): AiReportEnhancements {
  const parsed = parseJsonObject(content);
  if (!parsed) {
    return {
      ...emptyAiEnhancements(),
      periodJudgment: toOneSentenceSummary(content),
    };
  }

  return {
    periodJudgment: stringValue(parsed.periodJudgment) || toOneSentenceSummary(content),
    themeInsights: arrayValue(parsed.themeInsights)
      .map(toThemeInsight)
      .filter((theme): theme is AiThemeInsight => Boolean(theme))
      .slice(0, 5),
    highValueNotes: arrayValue(parsed.highValueNotes)
      .map(toHighValueNoteInsight)
      .filter((note): note is AiHighValueNoteInsight => Boolean(note))
      .slice(0, 10),
    nextActions: arrayValue(parsed.nextActions).map(stringValue).filter(Boolean).slice(0, 5),
  };
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const candidates = [
    content.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1],
    content,
    content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().startsWith("{")));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function toThemeInsight(value: unknown): AiThemeInsight | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const title = stringValue(record.title);
  const synthesis = stringValue(record.synthesis);
  if (!title || !synthesis) {
    return null;
  }
  return {
    title,
    synthesis,
    connections: stringValue(record.connections),
    evidenceNotes: arrayValue(record.evidenceNotes).map(notePathValue).filter(Boolean).slice(0, 5),
    nextQuestion: stringValue(record.nextQuestion),
  };
}

function toHighValueNoteInsight(value: unknown): AiHighValueNoteInsight | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const path = notePathValue(record.path);
  const reason = stringValue(record.reason);
  if (!path || !reason) {
    return null;
  }
  return {
    path,
    reason,
    suggestedAction: stringValue(record.suggestedAction),
  };
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? sanitizeInlineMarkdown(value, 700) : "";
}

function notePathValue(value: unknown): string {
  const text = stringValue(value);
  const wikilink = text.match(/^\[\[([^\]|#\]]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/u)?.[1];
  return (wikilink || text).replace(/\.md$/iu, "").trim();
}

function emptyAiEnhancements(): AiReportEnhancements {
  return {
    periodJudgment: "",
    themeInsights: [],
    highValueNotes: [],
    nextActions: [],
  };
}

function unavailableAiEnhancements(reason: string): AiReportEnhancements {
  return {
    ...emptyAiEnhancements(),
    periodJudgment: aiUnavailableSummary(reason),
  };
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500) || "No response body.";
  } catch {
    return "Could not read response body.";
  }
}

function sanitizeInlineMarkdown(value: string, maxLength: number): string {
  return value
    .replace(/\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu, (_match, path: string, suffix = "") => `[[${path}${suffix}]]`)
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}
