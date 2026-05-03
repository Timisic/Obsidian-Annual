import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import type { AnnualReviewSettings, SourceFile, YearAggregate } from "./types";

const MAX_AI_CONTEXT_NOTES = 80;
const MAX_AI_CONTEXT_EXCERPT_CHARS = 700;
const DEFAULT_CODEX_COMMAND = 'codex exec --color never --sandbox read-only --skip-git-repo-check --output-last-message "$CODEX_ANNUAL_REVIEW_OUTPUT" -';

export interface ChatGptReportOptions {
  aggregate: YearAggregate;
  files: SourceFile[];
  settings: AnnualReviewSettings;
  fetcher?: typeof fetch;
  codexExecutor?: CodexExecutor;
}

export type CodexExecutor = (prompt: string) => Promise<CodexExecutorResult>;

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
    return aiUnavailableSection(`Unsupported AI provider: ${options.settings.aiProvider}`);
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
        "You draft concise, evidence-backed annual review material for an Obsidian user.",
        "Use only the supplied vault statistics, note excerpts, tags, folders, and links.",
        "Write in Markdown. Preserve source note paths when making claims.",
        "Do not invent private facts that are not present in the context.",
      ].join(" "),
      input: buildAiPrompt(options.aggregate, options.files, options.settings),
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const message = await safeResponseText(response);
    return aiUnavailableSection(`ChatGPT provider request failed (${response.status}): ${message}`);
  }

  const data = (await response.json()) as OpenAiResponse;
  const content = extractResponseText(data).trim();
  if (!content) {
    return aiUnavailableSection("ChatGPT provider returned an empty response.");
  }

  return [
    "## AI Personalization",
    "",
    `Provider: ChatGPT (${options.settings.chatGptModel.trim() || "gpt-4.1"}).`,
    "",
    "> Privacy note: this section was generated only because the ChatGPT provider was selected. The provider received the annual aggregate, selected note excerpts, tags, folders, and links for this run.",
    "",
    content,
    "",
    "### AI Integration TODO",
    "",
    "- Add an Obsidian-native data preview/confirmation step before sending vault context.",
    "- Decide whether future Obsidian skill or CLI adapters should enrich the context before the provider call.",
    "- Add redaction controls for note bodies, folders, tags, and links before enabling broader AI workflows.",
    "",
  ].join("\n");
}

async function renderCodexReportSection(options: ChatGptReportOptions): Promise<string> {
  const executor = options.codexExecutor ?? runLocalCodex;
  const result = await executor(buildCodexPrompt(options.aggregate, options.files, options.settings));
  if (!result.ok || !result.content.trim()) {
    return aiUnavailableSection(`ChatGPT provider was selected without an OpenAI API key, and local Codex generation was unavailable: ${result.content || "No response."}`);
  }

  return [
    "## AI Personalization",
    "",
    "Provider: ChatGPT via local Codex auth.",
    "",
    "> Privacy note: this section was generated only because the ChatGPT provider was selected. The provider received the annual aggregate, selected note excerpts, tags, folders, and links for this run through the local Codex CLI/auth environment.",
    "",
    result.content.trim(),
    "",
    "### AI Integration TODO",
    "",
    "- Add an Obsidian-native data preview/confirmation step before sending vault context.",
    "- Decide whether future Obsidian skill or CLI adapters should enrich the context before the provider call.",
    "- Add redaction controls for note bodies, folders, tags, and links before enabling broader AI workflows.",
    "",
  ].join("\n");
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
      task: "Generate a personalized but concise annual review draft section. Focus on themes, writing rhythm, and concrete evidence links.",
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
    "You are generating one concise Markdown section for an Obsidian annual review.",
    "Use only the supplied JSON context. Preserve source note paths when making claims.",
    "Do not run tools, inspect files, or infer private facts that are absent from the context.",
    "Return only the Markdown section body; do not include a top-level heading.",
    "",
    buildAiPrompt(aggregate, files, settings),
  ].join("\n");
}

async function runLocalCodex(prompt: string): Promise<CodexExecutorResult> {
  const outputDir = await mkdtemp(join(tmpdir(), "annual-review-codex-"));
  const outputPath = join(outputDir, "last-message.md");
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", DEFAULT_CODEX_COMMAND], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        CODEX_ANNUAL_REVIEW_OUTPUT: outputPath,
      },
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
      finish({ ok: false, content: "Local Codex generation timed out." });
    }, 120_000);

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
      if (code === 0 && (lastMessage || output)) {
        finish({ ok: true, content: lastMessage || output });
        return;
      }
      finish({ ok: false, content: errorOutput || output || `Codex exited with status ${code}.` });
    });
    child.stdin.end(prompt);
  });
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

function aiUnavailableSection(reason: string): string {
  return [
    "## AI Personalization",
    "",
    `Provider status: ${reason}`,
    "",
    "### AI Integration TODO",
    "",
    "- Keep ChatGPT opt-in and avoid hardcoded secrets.",
    "- Add an Obsidian-native data preview/confirmation step before sending vault context.",
    "- Decide whether future Obsidian skill or CLI adapters should enrich the context before the provider call.",
    "",
  ].join("\n");
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
