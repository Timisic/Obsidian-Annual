import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { DEFAULT_LOCAL_CODEX_COMMAND } from "./settings";
import type { AnnualReviewSettings, SourceFile, YearAggregate } from "./types";

const MAX_AI_CONTEXT_NOTES = 80;
const MAX_AI_CONTEXT_EXCERPT_CHARS = 700;
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
  if (options.settings.aiProvider === "none") {
    return "";
  }

  if (options.settings.aiProvider !== "chatgpt") {
    return aiUnavailableSummary(`Unsupported AI provider: ${options.settings.aiProvider}`);
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
        "You draft one concise, evidence-backed annual review judgment sentence for an Obsidian user.",
        "Use only the supplied vault statistics, note excerpts, tags, folders, and links.",
        "Return one sentence only. Preserve source note paths when making claims.",
        "Do not invent private facts that are not present in the context.",
      ].join(" "),
      input: buildAiPrompt(options.aggregate, options.files, options.settings),
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const message = await safeResponseText(response);
    return aiUnavailableSummary(`ChatGPT provider request failed (${response.status}): ${message}`);
  }

  const data = (await response.json()) as OpenAiResponse;
  const content = extractResponseText(data).trim();
  if (!content) {
    return aiUnavailableSummary("ChatGPT provider returned an empty response.");
  }

  return toOneSentenceSummary(content);
}

async function renderCodexReportSection(options: ChatGptReportOptions): Promise<string> {
  const executor = options.codexExecutor ?? runLocalCodex;
  const command = options.settings.localCodexCommand.trim() || DEFAULT_LOCAL_CODEX_COMMAND;
  const result = await executor(buildCodexPrompt(options.aggregate, options.files, options.settings), command);
  if (!result.ok || !result.content.trim()) {
    return aiUnavailableSummary(`ChatGPT provider was selected without an OpenAI API key, and local Codex generation was unavailable: ${result.content || "No response."}`);
  }

  return toOneSentenceSummary(result.content);
}

export function buildAiPrompt(aggregate: YearAggregate, files: SourceFile[], settings: AnnualReviewSettings): string {
  const activeNotes = files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => ({ file, note: extractNoteStats(file, settings) }))
    .filter((entry) => new Date(entry.note.ctime).getFullYear() === aggregate.year || new Date(entry.note.mtime).getFullYear() === aggregate.year)
    .sort((a, b) => a.note.path.localeCompare(b.note.path));

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
    excerpt: excerpt(file.content),
  }));

  const linkGraph = activeNotes.map(({ note }) => ({
    path: note.path,
    links: note.links,
  }));

  const omittedNoteCount = Math.max(0, activeNotes.length - contextNotes.length);

  return JSON.stringify(
    {
      task: "Generate one personalized but concise annual review judgment sentence. Focus on themes, writing rhythm, and concrete evidence links.",
      contextPolicy: {
        noteCoverage: omittedNoteCount === 0 ? "All active notes are included with excerpts." : `${contextNotes.length} active notes include excerpts; ${omittedNoteCount} additional active notes are represented in the link graph only.`,
        excerptLimit: `${MAX_AI_CONTEXT_EXCERPT_CHARS} characters per included note`,
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
    "You are generating one concise judgment sentence for an Obsidian annual review.",
    "Use only the supplied compact JSON context. Preserve source note paths when making claims.",
    "Do not run tools, inspect files, or infer private facts that are absent from the context.",
    "Return one sentence only; do not include a heading, list, provider note, or TODO.",
    "",
    JSON.stringify(buildCodexContext(aggregate, files, settings)),
  ].join("\n");
}

function buildCodexContext(aggregate: YearAggregate, _files: SourceFile[], _settings: AnnualReviewSettings): unknown {
  return {
    task: "Generate one personalized but concise annual review judgment sentence from this aggregate evidence.",
    contextPolicy: {
      noteCoverage: "Compact aggregate-only context for local Codex CLI fallback.",
      evidenceSources: "Use listed note paths, topic metrics, link metrics, and high-value note reasons only.",
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
    outputReadyNotes: aggregate.outputReadyNotes.slice(0, 3).map((note) => note.path),
    maintenanceNotes: aggregate.maintenanceNotes.slice(0, 3).map((note) => note.path),
    isolatedPotentialNotes: aggregate.isolatedPotentialNotes.slice(0, 3).map((note) => note.path),
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

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500) || "No response body.";
  } catch {
    return "Could not read response body.";
  }
}
