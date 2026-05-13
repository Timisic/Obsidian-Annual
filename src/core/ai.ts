import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { extractNoteStats } from "./extract";
import { shouldIncludePath } from "./filters";
import { reviewSessionContainsDate } from "./reviewSession";
import { DEFAULT_LOCAL_CODEX_COMMAND } from "./settings";
import { buildThemeEvidencePackage, parseThemeHypotheses } from "./themeEvidence";
import type {
  AiHighValueNoteInsight,
  AiReportEnhancements,
  AiThemeInsight,
  AnnualReviewSettings,
  NoteStats,
  SourceFile,
  ThemeEvidenceNote,
  ThemeEvidencePackage,
  ThemeHypothesis,
  YearAggregate,
} from "./types";

const MAX_AI_CONTEXT_EXCERPT_CHARS = 700;
const MAX_CODEX_CONTEXT_NOTES = 28;
const MAX_PROVIDER_CONTEXT_EXCERPT_CHARS = 700;
const MAX_LINKED_NOTE_CONTEXT = 4;
const LOCAL_CODEX_TIMEOUT_MS = 300_000;
const LOCAL_CODEX_PATH_ENTRIES = [
  join(homedir(), ".npm-global", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];
const ABSOLUTE_CODEX_COMMAND_EXAMPLE =
  "$HOME/.npm-global/bin/codex exec --color never --sandbox read-only --skip-git-repo-check -c 'features.hooks=false' --output-last-message \"$CODEX_ANNUAL_REVIEW_OUTPUT\" -";
const NARRATIVE_THEME_CONTRACT = [
  "For each strong themeHypothesis, include reportNarrative: a first-pass reader-facing section for the default Narrative Review Report.",
  "reportNarrative should be 500-800 Chinese characters for zh or 280-450 English words for en when evidence is sufficient; sparse short ranges may be shorter but must not pad weak claims.",
  "reportNarrative must connect 2-4 representative evidence notes into prose using exact-path Obsidian wikilinks with readable aliases, e.g. [[exact/path|alias without leading date]].",
  "Go beyond obvious topical grouping: identify the underlying tension, value shift, fear/desire, tradeoff, contradiction, or recurring decision pattern that the notes reveal together.",
  "Structure reportNarrative as a small argument: what changed across the evidence notes, what deeper pattern it reveals, why it mattered in this review period, and what remains unresolved.",
  "Use aliases that remove date prefixes such as 2026-02-22, folder noise, and .md while preserving exact link targets.",
  "Absorb connectionExplanation into the prose; do not emit report field labels such as AI summary, why this theme exists, local signals, review caution, merged from, or evidence notes.",
  "Avoid generic report-meta sentences such as 'this theme should be treated as an early interpretation' or 'these notes preserve the original tone, judgment, and hesitation'.",
  "Write like a thoughtful review draft, not a task list, audit export, or generic template.",
];

export interface ChatGptReportOptions {
  aggregate: YearAggregate;
  files: SourceFile[];
  settings: AnnualReviewSettings;
  fetcher?: typeof fetch;
  codexExecutor?: CodexExecutor;
}

export type CodexExecutor = (
  prompt: string,
  command: string,
) => Promise<CodexExecutorResult>;

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

export async function renderAiReportSection(
  options: ChatGptReportOptions,
): Promise<string> {
  const enhancements = await renderAiReportEnhancements(options);
  return enhancements.periodJudgment;
}

export async function renderAiReportEnhancements(
  options: ChatGptReportOptions,
): Promise<AiReportEnhancements> {
  if (options.settings.aiProvider === "none") {
    return emptyAiEnhancements();
  }

  if (options.settings.aiProvider !== "chatgpt") {
    return unavailableAiEnhancements(
      `Unsupported AI provider: ${options.settings.aiProvider}`,
    );
  }

  const apiKey = options.settings.chatGptApiKey.trim();
  if (!apiKey) {
    return renderCodexReportSection(options);
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.settings.chatGptModel.trim() || "gpt-5.5",
      instructions: [
        "You enrich an Obsidian review from a bounded ReviewSession evidence package.",
        "Return JSON only with periodJudgment, themeHypotheses, themeInsights, highValueNotes, and nextActions; nextActions must be reflection questions, not task assignments.",
        "Use the embedded Obsidian CLI/Markdown handoff as binding output guidance.",
        "Write for a Narrative Review Report: theme-first prose, readable evidence aliases, sparing lists, and no self-referential AI/process wording.",
        "Avoid formulaic contrast phrasing such as 'not X but Y' or '不是...而是...'.",
        "Write generated periodJudgment, theme titles, summaries, connection explanations, uncertainty, and prompts in the requested reportLanguage.",
        "Generate 5-15 mutually distinct theme hypotheses when enough evidence exists; merge overlapping ideas instead of repeating local signals.",
        "Theme titles must be synthesized content themes, not raw tags, frontmatter fields, folders, months, repeated entities, links, or specific document names.",
        "Evidence-note reasons must be distinct for each note and grounded in evidencePackage excerpts, backlinks, linked notes, and local signals.",
        "Preserve source note paths exactly when using evidenceNotes or highValueNotes.path; report prose may use readable wikilink aliases while keeping exact targets.",
        ...NARRATIVE_THEME_CONTRACT,
        "Do not invent private facts that are not present in the context.",
      ].join(" "),
      input: buildAiPrompt(options.aggregate, options.files, options.settings),
      max_output_tokens: 9000,
    }),
  });

  if (!response.ok) {
    const message = await safeResponseText(response);
    return unavailableAiEnhancements(
      `ChatGPT provider request failed (${response.status}): ${message}`,
    );
  }

  const data = (await response.json()) as OpenAiResponse;
  const content = extractResponseText(data).trim();
  if (!content) {
    return unavailableAiEnhancements("ChatGPT provider returned an empty response.");
  }

  const evidencePackage = buildProviderVisibleEvidencePackage(options);
  return withFallbackHighValueEnhancements(
    parseAiEnhancements(content, evidencePackage),
    options,
  );
}

async function renderCodexReportSection(
  options: ChatGptReportOptions,
): Promise<AiReportEnhancements> {
  const executor = options.codexExecutor ?? runLocalCodex;
  const command =
    options.settings.localCodexCommand.trim() || DEFAULT_LOCAL_CODEX_COMMAND;
  const result = await executor(
    buildCodexPrompt(options.aggregate, options.files, options.settings),
    command,
  );
  if (!result.ok || !result.content.trim()) {
    return unavailableAiEnhancements(
      `ChatGPT provider was selected without an OpenAI API key, and local Codex generation was unavailable: ${result.content || "No response."}`,
    );
  }

  const evidencePackage = buildProviderVisibleEvidencePackage(options);
  return withFallbackHighValueEnhancements(
    parseAiEnhancements(result.content, evidencePackage),
    options,
  );
}

export function buildAiPrompt(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
): string {
  return JSON.stringify(buildCodexContext(aggregate, files, settings), null, 2);
}

export function buildCodexPrompt(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
): string {
  return [
    "You are generating structured Obsidian annual review enrichment.",
    "Use the embedded Obsidian CLI/Markdown handoff as binding guidance.",
    "Use only the supplied JSON context; do not read or request any vault files outside this bounded evidence package.",
    "Return JSON only with periodJudgment, themeHypotheses, themeInsights, highValueNotes, and nextActions; nextActions must be reflection questions, not task assignments.",
    "Write for a Narrative Review Report: theme-first prose, readable evidence aliases, sparing lists, and no self-referential AI/process wording.",
    "Avoid formulaic contrast phrasing such as 'not X but Y' or '不是...而是...'.",
    "Write generated periodJudgment, theme titles, summaries, connection explanations, uncertainty, and prompts in the requested reportLanguage.",
    "Generate 5-15 mutually distinct theme hypotheses when enough evidence exists; merge overlapping ideas instead of repeating local signals.",
    "Theme titles must be synthesized content themes, not raw tags, frontmatter fields, folders, months, repeated entities, links, or specific document names.",
    "Evidence-note reasons must be distinct for each note and grounded in evidencePackage excerpts, backlinks, linked notes, and local signals.",
    ...NARRATIVE_THEME_CONTRACT,
    "",
    JSON.stringify(buildCodexContext(aggregate, files, settings)),
  ].join("\n");
}

function buildCodexContext(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
): unknown {
  const evidencePackage = buildProviderVisibleEvidencePackage({
    aggregate,
    files,
    settings,
  });

  return {
    task: "Generate content-synthesized review enrichment JSON from the bounded ReviewSession evidence package.",
    outputSchema: {
      periodJudgment:
        "2-4 evidence-backed review overview sentences; no heading, no bullet list",
      themeHypotheses:
        "5-15 mutually distinct semantic themes with id, title, summary, reportNarrative, connectionExplanation, evidenceNoteIds, localSignals, uncertainty, source",
      themeInsights:
        "3-5 synthesized content themes with title, synthesis, connections, evidenceNotes, nextQuestion",
      highValueNotes:
        "path-specific recommendation rationale and optional review prompts for evidence notes",
      nextActions: "3 grounded reflection questions, not action items",
    },
    obsidianSkillHandoff: obsidianSkillHandoff(),
    contextPolicy: {
      noteCoverage: `${evidencePackage.evidenceNotes.length} bounded evidence notes include short excerpts and local signals for the selected ReviewSession.`,
      evidenceSources:
        "Use only evidencePackage ids, listed note paths, short excerpts, related notes, and local signals.",
    },
    reportWritingContract: {
      narrativeThemeContract: NARRATIVE_THEME_CONTRACT,
      reportNarrative:
        "Default Review Report prose for a user-accepted theme. It should already read like a useful first draft before renderer fallback.",
      evidenceLinks:
        "Use [[exact evidenceNotes[].path without .md|readable alias without leading date prefix]] when citing evidence inside reportNarrative.",
      forbiddenReportLabels: [
        "AI summary",
        "why this theme exists",
        "connection explanation",
        "local signals",
        "review caution",
        "merged from",
        "evidence notes",
        "AI 总结",
        "为什么这个主题存在",
        "连接解释",
        "本地信号",
        "复核提示",
        "合并来源",
        "证据笔记",
      ],
    },
    evidencePackage,
    reviewSession: {
      id: aggregate.session.id,
      label: aggregate.session.label,
      preset: aggregate.session.preset,
      startDate: aggregate.session.startDate,
      endDate: aggregate.session.endDate,
    },
    reportLanguage: settings.reportLanguage,
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
      .map((month) => ({
        month: month.month,
        created: month.created,
        modified: month.modified,
        words: month.words,
      })),
    activityEvidence: {
      topTags: aggregate.topTags.slice(0, 6),
      topFolders: aggregate.topFolders.slice(0, 5),
      topLinks: aggregate.topLinks.slice(0, 6),
      representativeNotes: aggregate.representativeNotes.slice(0, 6),
    },
    outputReadyNotes: aggregate.outputReadyNotes.slice(0, 3).map((note) => note.path),
    maintenanceNotes: aggregate.maintenanceNotes.slice(0, 3).map((note) => note.path),
    isolatedPotentialNotes: aggregate.isolatedPotentialNotes
      .slice(0, 3)
      .map((note) => note.path),
  };
}

function compactThemeEvidencePackage(
  evidencePackage: ThemeEvidencePackage,
  noteLimit: number,
  excerptLimit: number,
): ThemeEvidencePackage {
  return {
    ...evidencePackage,
    evidenceNotes: evidencePackage.evidenceNotes.slice(0, noteLimit).map((note) => ({
      ...note,
      excerpt:
        note.excerpt.length <= excerptLimit
          ? note.excerpt
          : `${note.excerpt.slice(0, excerptLimit).trim()}...`,
      links: note.links.slice(0, 5),
      backlinks: note.backlinks.slice(0, 4),
      commonLinks: note.commonLinks.slice(0, 4),
      frontmatterSignals: note.frontmatterSignals.slice(0, 3),
      repeatedPhrases: note.repeatedPhrases.slice(0, 3),
      questionSentences: note.questionSentences.slice(0, 2),
      entities: note.entities.slice(0, 4),
      crossFolderLinks: note.crossFolderLinks.slice(0, 4),
      weakSignals: note.weakSignals.slice(0, 3),
    })),
  };
}

function buildProviderVisibleEvidencePackage({
  aggregate,
  files,
  settings,
}: Pick<ChatGptReportOptions, "aggregate" | "files" | "settings">): ThemeEvidencePackage {
  return compactThemeEvidencePackage(
    buildThemeEvidencePackage(aggregate, files, settings),
    MAX_CODEX_CONTEXT_NOTES,
    MAX_PROVIDER_CONTEXT_EXCERPT_CHARS,
  );
}

function activeNoteEntries(
  aggregate: YearAggregate,
  files: SourceFile[],
  settings: AnnualReviewSettings,
): Array<{ file: SourceFile; note: NoteStats }> {
  return files
    .filter((file) => shouldIncludePath(file.path, settings))
    .map((file) => ({ file, note: extractNoteStats(file, settings) }))
    .filter(
      (entry) =>
        reviewSessionContainsDate(
          aggregate.session,
          entry.note.noteDate?.timestamp ?? entry.note.ctime,
        ) ||
        reviewSessionContainsDate(
          aggregate.session,
          entry.note.noteDate?.timestamp ?? entry.note.mtime,
        ),
    )
    .sort((a, b) => a.note.path.localeCompare(b.note.path));
}

function backlinkContext(
  path: string,
  activeNotes: Array<{ file: SourceFile; note: NoteStats }>,
  limit: number,
): Array<{ path: string; count: number; excerpt: string }> {
  return activeNotes
    .flatMap(({ file, note }) => {
      if (note.path === path) {
        return [];
      }
      const count = Object.entries(note.linkCounts).reduce(
        (sum, [link, amount]) => sum + (linkTargetMatches(link, path) ? amount : 0),
        0,
      );
      return count > 0
        ? [{ path: note.path, count, excerpt: excerpt(file.content) }]
        : [];
    })
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function linkedNoteContext(
  note: NoteStats,
  noteByPath: Map<string, { file: SourceFile; note: NoteStats }>,
  limit: number,
): Array<{ path: string; count: number; excerpt: string }> {
  return Object.entries(note.linkCounts)
    .map(([link, count]) => {
      const target = noteByPath.get(resolveLinkTarget(link, noteByPath));
      return target
        ? {
            path: target.note.path,
            count,
            excerpt: excerpt(target.file.content),
          }
        : null;
    })
    .filter((entry): entry is { path: string; count: number; excerpt: string } =>
      Boolean(entry),
    )
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
      suggestionLabel: item.suggestionLabel,
      metricReason: item.reason,
      metricReasons: item.reasons,
      metricSuggestedAction: item.suggestedAction,
      inboundLinks: item.inboundLinks,
      outboundLinks: item.outboundLinks,
      topics: item.topics,
      lastUpdated: item.lastUpdated,
      periodWordCount: item.periodWordCount,
      headings: entry?.note.headings ?? [],
      excerpt: entry ? excerpt(entry.file.content) : "",
      backlinks: backlinkContext(item.path, activeNotes, MAX_LINKED_NOTE_CONTEXT),
      linkedNotes: entry
        ? linkedNoteContext(entry.note, noteByPath, MAX_LINKED_NOTE_CONTEXT)
        : [],
    };
  });
}

function withFallbackHighValueEnhancements(
  enhancements: AiReportEnhancements,
  options: ChatGptReportOptions,
): AiReportEnhancements {
  if (enhancements.themeInsights.length === 0) {
    return enhancements;
  }
  const fallbackNotes = fallbackHighValueNotes(
    options.aggregate,
    options.files,
    options.settings,
    enhancements.themeInsights,
  );
  if (enhancements.highValueNotes.length > 0) {
    const aiByPath = new Map(
      enhancements.highValueNotes.map((note) => [normalizeLinkIdentity(note.path), note]),
    );
    return {
      ...enhancements,
      highValueNotes: fallbackNotes.map((fallback) => {
        const aiNote = aiByPath.get(normalizeLinkIdentity(fallback.path));
        return aiNote && !isGenericHighValueReason(aiNote) ? aiNote : fallback;
      }),
    };
  }
  return {
    ...enhancements,
    highValueNotes: fallbackNotes,
  };
}

function isGenericHighValueReason(note: AiHighValueNoteInsight): boolean {
  return /^(入链 \d+ 次且内容完整|连接 \d+ 个主题|内容已到 \d+ 字词|补一张主题关系图|提炼成主题索引)/u.test(
    `${note.reason} ${note.suggestedAction}`,
  );
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
  return aggregate.highValueNotes.slice(0, 10).map((note, index) => {
    const entry = noteByPath.get(note.path);
    const linkedTitles = entry
      ? linkedNoteContext(entry.note, noteByPath, 3).map((linked) =>
          titleFromPath(linked.path),
        )
      : [];
    const backlinks = backlinkContext(note.path, activeNotes, 3).map((linked) =>
      titleFromPath(linked.path),
    );
    const related = [...new Set([...linkedTitles, ...backlinks])].slice(0, 3);
    const theme = relatedTheme(note, themes);
    const title = titleFromPath(note.path);
    if (language === "en") {
      return {
        path: note.path,
        reason: fallbackHighValueReasonEn(note, title, theme, related, index),
        suggestedAction: fallbackHighValueActionEn(note, title, theme),
      };
    }
    return {
      path: note.path,
      reason: fallbackHighValueReasonZh(note, title, theme, related, index),
      suggestedAction: fallbackHighValueActionZh(note, title, theme),
    };
  });
}

function fallbackHighValueReasonZh(
  note: { kind: string; inboundLinks: number; periodWordCount: number },
  title: string,
  theme: string,
  related: string[],
  index: number,
): string {
  const target = theme || title;
  const relation =
    related.length > 0
      ? `它和「${related.join("」「")}」互相照应`
      : "它目前链接较少，反而适合作为下一轮补链的起点";
  const inbound =
    note.inboundLinks > 0
      ? `${note.inboundLinks} 个入链说明它已经被多处记录反复引用`
      : "当前入链还少，说明它需要一个更明确的入口";
  const templates = [
    `这篇把「${target}」里的核心冲突写得最集中，${note.periodWordCount} 个本期字词提供了足够上下文；${relation}，适合先整理成年度入口。`,
    `这篇的价值在于把「${target}」从感受推进到可讨论的问题，${inbound}；${relation}。`,
    `这篇适合作为「${target}」的复盘样本，因为它保留了当时的判断、情绪和判断线索；${relation}，后续可以补出更清楚的结论。`,
    `这篇作为证据笔记承担的是桥接作用：它把「${target}」和周边笔记接起来，让单篇日记可以进入更长的主题链；${relation}。`,
  ];
  if (note.kind === "孤立潜力") {
    return `这篇还没有进入稳定链接网络，但 ${note.periodWordCount} 个本期字词已经显露出「${target}」的材料潜力；先补出双链和小结，才能判断它是否值得继续发展。`;
  }
  if (note.kind === "输出候选") {
    return templates[index % 3] ?? templates[0];
  }
  return templates[(index + 1) % templates.length] ?? templates[0];
}

function fallbackHighValueActionZh(
  note: { kind: string },
  title: string,
  theme: string,
): string {
  const target = theme || title;
  if (note.kind === "输出候选") {
    return `重读这篇时，哪一段最能说明「${target}」在本期发生了什么变化？`;
  }
  if (note.kind === "孤立潜力") {
    return `这篇为什么会在「${target}」之外显得孤立，它缺少的是证据、关系，还是命名？`;
  }
  return `如果把它作为「${target}」的入口，最值得保留的原始判断是什么？`;
}

function fallbackHighValueReasonEn(
  note: { kind: string; inboundLinks: number; periodWordCount: number },
  title: string,
  theme: string,
  related: string[],
  index: number,
): string {
  const target = theme || title;
  const relation =
    related.length > 0
      ? `It is reinforced by ${related.join(", ")}`
      : "Its sparse link context makes it a useful candidate for deliberate linking";
  const inbound =
    note.inboundLinks > 0
      ? `Its ${note.inboundLinks} inbound links show that other notes already depend on it`
      : "Its sparse inbound-link context shows that it needs a clearer entry point";
  const templates = [
    `${title} concentrates the main tension inside ${target}, and its ${note.periodWordCount} period words leave enough context to turn the note into a review entry. ${relation}.`,
    `${title} matters because it moves ${target} from a passing observation into a question that recurs across the vault. ${inbound}.`,
    `${title} works as a review sample for ${target}: it preserves the original judgment, mood, and evidence trace while still leaving room for a clearer conclusion. ${relation}.`,
    `${title} plays a bridging role as an evidence note by connecting ${target} with nearby notes, so it can turn a single diary entry into a longer theme chain. ${relation}.`,
  ];
  if (note.kind === "孤立潜力") {
    return `${title} has not entered the stable link network yet, but its ${note.periodWordCount} period words show material for ${target}; linking and summarizing it will clarify whether it should keep growing.`;
  }
  return templates[index % templates.length] ?? templates[0];
}

function fallbackHighValueActionEn(
  note: { kind: string },
  title: string,
  theme: string,
): string {
  const target = theme || title;
  if (note.kind === "孤立潜力") {
    return `Why does this note still feel isolated from ${target}: missing evidence, missing relationships, or unclear naming?`;
  }
  if (note.kind === "输出候选") {
    return `Which passage best explains what changed around ${target} during this range?`;
  }
  return `If this note becomes an entry point for ${target}, which original judgment is most worth preserving?`;
}

function relatedTheme(
  note: { path: string; topics: string[] },
  themes: AiThemeInsight[],
): string {
  const noteTitle = titleFromPath(note.path);
  const evidenceMatch = themes.find((theme) =>
    theme.evidenceNotes.some(
      (path) => normalizeLinkIdentity(path) === normalizeLinkIdentity(note.path),
    ),
  );
  if (evidenceMatch) {
    return evidenceMatch.title;
  }
  const topicMatch = themes.find((theme) =>
    [theme.title, theme.synthesis, theme.connections].some((text) =>
      note.topics.some((topic) =>
        text.toLocaleLowerCase().includes(topic.toLocaleLowerCase()),
      ),
    ),
  );
  return (
    topicMatch?.title ||
    themes.find(
      (theme) =>
        theme.synthesis.includes(noteTitle) || theme.connections.includes(noteTitle),
    )?.title ||
    ""
  );
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function linkTargetMatches(link: string, path: string): boolean {
  return (
    normalizeLinkIdentity(link) === normalizeLinkIdentity(path) ||
    normalizeLinkIdentity(link) === normalizeLinkIdentity(path.replace(/\.md$/iu, ""))
  );
}

function resolveLinkTarget(
  link: string,
  noteByPath: Map<string, { file: SourceFile; note: NoteStats }>,
): string {
  const normalized = normalizeLinkIdentity(link);
  for (const path of noteByPath.keys()) {
    if (
      normalizeLinkIdentity(path) === normalized ||
      normalizeLinkIdentity(path.replace(/\.md$/iu, "")) === normalized ||
      normalizeLinkIdentity(path.split("/").pop()?.replace(/\.md$/iu, "") ?? path) ===
        normalized
    ) {
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
    invokedSkills: ["obsidian-cli", "obsidian-markdown"],
    obsidianCli: [
      "Treat the supplied ReviewSession evidence package as the only readable Obsidian context.",
      "When citing evidence, use exact vault-relative note paths supplied in context.",
    ],
    obsidianMarkdown: [
      "Use Obsidian wikilinks for internal evidence; readable report prose should use [[exact/path|faithful alias]] so the target remains traceable.",
      "Avoid raw pipes inside Markdown table cells; table wikilinks should use plain [[path]] form if a table is unavoidable.",
      "Generated prose should be valid Obsidian Flavored Markdown and readable as an editable note.",
    ],
  };
}

export async function runLocalCodex(
  prompt: string,
  command = DEFAULT_LOCAL_CODEX_COMMAND,
): Promise<CodexExecutorResult> {
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
      finish({
        ok: false,
        content: `Local Codex generation timed out after ${Math.round(LOCAL_CODEX_TIMEOUT_MS / 1000)} seconds while running localCodexCommand: ${command}.`,
      });
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
      const streamMessage =
        extractCodexStreamMessage(output) || extractCodexStreamMessage(errorOutput);
      if (code === 0 && (lastMessage || streamMessage || output)) {
        finish({ ok: true, content: lastMessage || streamMessage || output });
        return;
      }
      finish({
        ok: false,
        content: formatLocalCodexFailure(
          command,
          errorOutput,
          output,
          code,
          env.PATH ?? "",
        ),
      });
    });
    child.stdin.end(prompt);
  });
}

export function buildLocalCodexEnv(
  baseEnv: NodeJS.ProcessEnv,
  outputPath: string,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    PATH: [...LOCAL_CODEX_PATH_ENTRIES, baseEnv.PATH ?? ""].filter(Boolean).join(":"),
    CODEX_ANNUAL_REVIEW_OUTPUT: outputPath,
  };
}

export function formatLocalCodexFailure(
  command: string,
  stderr: string,
  stdout: string,
  code: number | null,
  path: string,
): string {
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
    .filter(
      (line) =>
        line !== "tokens used" && !/^\d[\d,]*$/u.test(line) && !line.startsWith("hook:"),
    )
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
  const body = content
    .replace(/^---\n[\s\S]*?\n---\n?/u, "")
    .replace(/\s+/gu, " ")
    .trim();
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
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n\n");
}

function parseAiEnhancements(
  content: string,
  evidencePackage?: ThemeEvidencePackage,
): AiReportEnhancements {
  const parsed = parseJsonObject(content);
  if (!parsed) {
    return {
      ...emptyAiEnhancements(),
      periodJudgment: toOneSentenceSummary(content),
    };
  }
  const themeHypotheses = evidencePackage
    ? parseThemeHypotheses(content, evidencePackage)
    : [];
  const parsedThemeInsights = arrayValue(parsed.themeInsights)
    .map(toThemeInsight)
    .filter((theme): theme is AiThemeInsight => Boolean(theme))
    .slice(0, 5);
  const effectiveThemeHypotheses =
    themeHypotheses.length > 0
      ? themeHypotheses
      : parsedThemeInsights
          .map((theme, index) => themeInsightToHypothesis(theme, index, evidencePackage))
          .filter((theme): theme is ThemeHypothesis => Boolean(theme));

  return {
    periodJudgment: stringValue(parsed.periodJudgment) || toOneSentenceSummary(content),
    themeHypotheses: effectiveThemeHypotheses,
    themeInsights:
      parsedThemeInsights.length > 0
        ? parsedThemeInsights
        : effectiveThemeHypotheses.map((theme) =>
            themeHypothesisToInsight(theme, evidencePackage),
          ),
    highValueNotes: arrayValue(parsed.highValueNotes)
      .map(toHighValueNoteInsight)
      .filter((note): note is AiHighValueNoteInsight => Boolean(note))
      .slice(0, 10),
    nextActions: arrayValue(parsed.nextActions)
      .map(stringValue)
      .filter(Boolean)
      .slice(0, 5),
  };
}

function themeInsightToHypothesis(
  insight: AiThemeInsight,
  index: number,
  evidencePackage?: ThemeEvidencePackage,
): ThemeHypothesis | null {
  if (!evidencePackage) {
    return null;
  }
  const idByReference = buildEvidenceReferenceIndex(evidencePackage.evidenceNotes);
  const evidenceNoteIds = [
    ...new Set(
      insight.evidenceNotes
        .map((note) => idByReference.get(normalizeLinkIdentity(note)))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (evidenceNoteIds.length === 0) {
    return null;
  }
  const localSignals = evidenceNoteIds
    .flatMap(
      (id) =>
        evidencePackage.evidenceNotes.find((note) => note.id === id)?.localSignals ?? [],
    )
    .filter((signal, signalIndex, signals) => signals.indexOf(signal) === signalIndex)
    .slice(0, 8);
  return {
    id: `theme:ai:insight:${index + 1}`,
    title: insight.title,
    summary: insight.synthesis,
    reportNarrative: insight.synthesis,
    evidenceNoteIds,
    connectionExplanation: insight.connections,
    localSignals,
    uncertainty:
      evidenceNoteIds.length < 2
        ? "Low confidence: fewer than two evidence notes support this hypothesis."
        : undefined,
    source: "ai",
  };
}

function themeHypothesisToInsight(
  theme: ThemeHypothesis,
  evidencePackage?: ThemeEvidencePackage,
): AiThemeInsight {
  const pathById = new Map(
    evidencePackage?.evidenceNotes.map((note) => [note.id, note.path]) ?? [],
  );
  return {
    title: theme.title,
    synthesis: theme.reportNarrative || theme.summary,
    connections: theme.connectionExplanation,
    evidenceNotes: theme.evidenceNoteIds.map((id) => pathById.get(id) ?? id),
    nextQuestion: "",
  };
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const candidates = [
    content.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1],
    content,
    content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1),
  ].filter((candidate): candidate is string =>
    Boolean(candidate && candidate.trim().startsWith("{")),
  );

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

function buildEvidenceReferenceIndex(notes: ThemeEvidenceNote[]): Map<string, string> {
  const references = new Map<string, string>();
  const ambiguous = new Set<string>();
  const add = (reference: string, id: string) => {
    const normalized = normalizeLinkIdentity(reference);
    if (!normalized || ambiguous.has(normalized)) {
      return;
    }
    const existing = references.get(normalized);
    if (existing && existing !== id) {
      references.delete(normalized);
      ambiguous.add(normalized);
      return;
    }
    references.set(normalized, id);
  };

  for (const note of notes) {
    add(note.id, note.id);
    add(note.path, note.id);
    add(note.path.replace(/\.md$/iu, ""), note.id);
    add(note.title, note.id);
  }

  return references;
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
    evidenceNotes: arrayValue(record.evidenceNotes)
      .map(notePathValue)
      .filter(Boolean)
      .slice(0, 5),
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
    themeHypotheses: [],
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
    .replace(
      /\[\[([^\]|#\]]+?)\.md((?:#[^\]|]+)?(?:\|[^\]]+)?)?\]\]/giu,
      (_match, path: string, suffix = "") => `[[${path}${suffix}]]`,
    )
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}
