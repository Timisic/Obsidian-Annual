import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import type { AnnualReviewSettings, SourceFile, YearAggregate } from "./types";

const MAX_AI_CONTEXT_NOTES = 80;
const MAX_AI_CONTEXT_EXCERPT_CHARS = 700;

export interface ChatGptReportOptions {
  aggregate: YearAggregate;
  files: SourceFile[];
  settings: AnnualReviewSettings;
  fetcher?: typeof fetch;
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
    return aiUnavailableSection("ChatGPT provider was selected, but no OpenAI API key is configured. No network request was made.");
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
