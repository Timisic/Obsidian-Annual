import {
  getLanguage,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  type App,
} from "obsidian";
import { renderAiReportEnhancements } from "./core/ai";
import { buildYearAggregate } from "./core/aggregate";
import { COMMAND_IDS, COMMAND_NAMES } from "./core/commands";
import { resolveAnnualReviewLanguage, UI_TEXT } from "./core/language";
import {
  buildAnnualReviewChartAssets,
  buildAnnualReviewChartPaths,
  renderAnnualReview,
} from "./core/render";
import { buildReviewSession, reviewScopeHash } from "./core/reviewCandidates";
import {
  applyReviewAction,
  type ReviewAction,
  type ReviewSessionState,
} from "./core/reviewState";
import { DEFAULT_SETTINGS, joinFolderList, splitFolderList } from "./core/settings";
import {
  appendSnapshot,
  createVaultSnapshot,
  emptySnapshotFile,
  normalizeSnapshotFile,
  selectSnapshotComparison,
  serializeSnapshotFile,
  SNAPSHOT_FILE_NAME,
} from "./core/snapshot";
import type {
  AnnualReviewLanguage,
  AnnualReviewSettings,
  GenerateReportOptions,
  ResolvedAnnualReviewLanguage,
  SourceFile,
  VaultSnapshot,
  VaultSnapshotFile,
  YearAggregate,
} from "./core/types";
import {
  AnnualReviewDashboardView,
  VIEW_TYPE_ANNUAL_REVIEW,
} from "./obsidian/dashboardView";
import { readVaultMarkdownFiles } from "./obsidian/vaultFiles";
import { AnnualReviewProgressModal } from "./obsidian/progressModal";
import { writeAnnualReviewOutput } from "./obsidian/reportWriter";
import { YearModal } from "./obsidian/yearModal";

interface AnnualReviewPluginData extends Partial<AnnualReviewSettings> {
  reviewSessions?: Record<string, ReviewSessionState>;
}

export default class AnnualReviewPlugin extends Plugin {
  settings: AnnualReviewSettings = DEFAULT_SETTINGS;
  private reviewSessions: Record<string, ReviewSessionState> = {};
  private indexedFiles: SourceFile[] | null = null;
  private indexedSettingsKey: string | null = null;
  private indexedAt: string | null = null;
  private lastAggregate: YearAggregate | null = null;
  private lastReportPath: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_ANNUAL_REVIEW,
      (leaf) => new AnnualReviewDashboardView(leaf, this),
    );

    this.addCommand({
      id: COMMAND_IDS.generate,
      name: COMMAND_NAMES.generate,
      callback: () => this.openGenerateModal(),
    });

    this.addCommand({
      id: COMMAND_IDS.openDashboard,
      name: COMMAND_NAMES.openDashboard,
      callback: () => {
        void this.openDashboard();
      },
    });

    this.addCommand({
      id: COMMAND_IDS.rebuildIndex,
      name: COMMAND_NAMES.rebuildIndex,
      callback: async () => {
        await this.rebuildIndex();
      },
    });

    this.addSettingTab(new AnnualReviewSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as AnnualReviewPluginData;
    const { reviewSessions, ...settings } = data;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.reviewSessions = reviewSessions ?? {};
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
  }

  openGenerateModal(): void {
    const modal = new YearModal(this.app, this.settings, this.generatorLanguage());
    modal.onChoose = (options) => {
      void this.generateReport(options);
    };
    modal.open();
  }

  async rebuildIndex(): Promise<void> {
    this.indexedFiles = await readVaultMarkdownFiles(this.app, this.settings);
    await this.recordVaultSnapshot(this.indexedFiles, this.settings);
    this.indexedSettingsKey = settingsKey(this.settings);
    this.indexedAt = new Date().toLocaleString();
    new Notice(this.text().rebuilt(this.indexedFiles.length));
  }

  async previewYear(year: number): Promise<void> {
    const files = await this.getIndexedFiles(this.settings);
    this.lastAggregate = buildYearAggregate(files, year, this.settings);
    await this.refreshReviewSession(this.lastAggregate);
  }

  getLastAggregate(): YearAggregate | null {
    return this.lastAggregate;
  }

  getReviewSession(): ReviewSessionState | null {
    if (!this.lastAggregate) {
      return null;
    }
    return this.reviewSessions[this.reviewSessionKey(this.lastAggregate)] ?? null;
  }

  getSettings(): AnnualReviewSettings {
    return this.settings;
  }

  getGeneratorLanguage(): ResolvedAnnualReviewLanguage {
    return this.generatorLanguage();
  }

  getIndexStatus(): { fileCount: number; builtAt: string | null } {
    return {
      fileCount: this.indexedFiles?.length ?? 0,
      builtAt: this.indexedAt,
    };
  }

  getLastReportPath(): string | null {
    return this.lastReportPath;
  }

  async openLastReport(): Promise<void> {
    if (!this.lastReportPath) {
      return;
    }
    const file = this.app.vault.getFileByPath(this.lastReportPath);
    if (file) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  async applyReviewAction(action: ReviewAction): Promise<void> {
    if (action.type === "open-source-note") {
      await this.openSourceNote(action.candidateId, action.evidenceId);
      return;
    }
    const session = this.getReviewSession();
    if (!session) {
      return;
    }
    const next = applyReviewAction(session, action);
    this.reviewSessions[this.reviewSessionKey(next)] = next;
    await this.savePluginData();
  }

  async openSourceNote(candidateId: string, evidenceId?: string): Promise<void> {
    const session = this.getReviewSession();
    const candidate = session?.candidates.find((item) => item.id === candidateId);
    const evidence = evidenceId
      ? candidate?.evidence.find((item) => item.id === evidenceId)
      : candidate?.evidence.find((item) => item.sourcePath);
    const path = evidence?.sourcePath ?? candidate?.sourcePaths[0];
    if (!path) {
      return;
    }
    const file = this.app.vault.getFileByPath(path);
    if (file) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }

  private async generateReport(options: GenerateReportOptions): Promise<void> {
    let progress: AnnualReviewProgressModal | null = null;
    try {
      const { year, settings } = options;
      const text = this.text(settings.generatorLanguage);
      new Notice(text.generating(year));
      if (settings.aiProvider !== "none") {
        progress = new AnnualReviewProgressModal(this.app, text.aiProgressTitle(year));
        progress.open();
        progress.update(text.progressReadingVault, 8);
      }
      const files = await this.getIndexedFiles(settings);
      const currentSnapshot = createVaultSnapshot(files, settings);
      const snapshotFile = await this.readVaultSnapshotFile();
      const snapshotComparison = selectSnapshotComparison(
        snapshotFile.snapshots,
        currentSnapshot,
      );
      await this.writeVaultSnapshotFile(appendSnapshot(snapshotFile, currentSnapshot));
      progress?.update(text.progressAiSummary, 35);
      const aggregate = buildYearAggregate(files, year, settings, {
        snapshotComparison,
      });
      const reviewSession = await this.refreshReviewSession(aggregate);
      const aiEnhancements = await renderAiReportEnhancements({
        aggregate,
        files,
        settings,
      });
      const reportLanguage = resolveAnnualReviewLanguage(
        settings.reportLanguage,
        getLanguage(),
      );
      const chartPaths = buildAnnualReviewChartPaths(settings.reportFolder, year);
      progress?.update(text.progressRendering, 78);
      const chartAssets = buildAnnualReviewChartAssets(aggregate, {
        language: reportLanguage,
        chartPaths,
      });
      const markdown = renderAnnualReview(aggregate, {
        language: reportLanguage,
        chartPaths,
        aiEnhancements,
        aiEnabled: settings.aiProvider !== "none",
        reviewSession,
      });
      progress?.update(text.progressWriting, 92);
      const report = await writeAnnualReviewOutput(
        this.app,
        settings.reportFolder,
        year,
        markdown,
        chartAssets,
      );
      this.lastAggregate = aggregate;
      this.lastReportPath = report.path;
      await this.app.workspace.getLeaf(false).openFile(report);
      progress?.update(text.generated(report.path), 100);
      progress?.close();
      new Notice(text.generated(report.path));
    } catch (error) {
      console.error("Annual Review generation failed", error);
      new Notice(
        this.text().failed(error instanceof Error ? error.message : String(error)),
      );
      progress?.close();
    }
  }

  private async getIndexedFiles(settings: AnnualReviewSettings): Promise<SourceFile[]> {
    const key = settingsKey(settings);
    if (this.indexedSettingsKey === key && this.indexedFiles) {
      return this.indexedFiles;
    }
    this.indexedFiles = await readVaultMarkdownFiles(this.app, settings);
    this.indexedSettingsKey = key;
    this.indexedAt = new Date().toLocaleString();
    return this.indexedFiles;
  }

  private async recordVaultSnapshot(
    files: SourceFile[],
    settings: AnnualReviewSettings,
  ): Promise<VaultSnapshot> {
    const snapshot = createVaultSnapshot(files, settings);
    const snapshotFile = await this.readVaultSnapshotFile();
    await this.writeVaultSnapshotFile(appendSnapshot(snapshotFile, snapshot));
    return snapshot;
  }

  private async refreshReviewSession(
    aggregate: YearAggregate,
  ): Promise<ReviewSessionState> {
    const key = this.reviewSessionKey(aggregate);
    const next = buildReviewSession(aggregate, this.reviewSessions[key]);
    this.reviewSessions[key] = next;
    await this.savePluginData();
    return next;
  }

  private reviewSessionKey(input: YearAggregate | ReviewSessionState): string {
    if ("scopeHash" in input) {
      return `${input.year}:${input.scopeHash}`;
    }
    return `${input.year}:${reviewScopeHash(input)}`;
  }

  private async savePluginData(): Promise<void> {
    await this.saveData({
      ...this.settings,
      reviewSessions: this.reviewSessions,
    } satisfies AnnualReviewPluginData);
  }

  private async readVaultSnapshotFile(): Promise<VaultSnapshotFile> {
    const path = this.snapshotDataPath();
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      return emptySnapshotFile();
    }

    try {
      return normalizeSnapshotFile(
        JSON.parse(await this.app.vault.adapter.read(path)) as unknown,
      );
    } catch (error) {
      console.warn("Annual Review snapshot file could not be read", error);
      return emptySnapshotFile();
    }
  }

  private async writeVaultSnapshotFile(snapshotFile: VaultSnapshotFile): Promise<void> {
    const path = this.snapshotDataPath();
    await ensureAdapterFolder(this.app, path.split("/").slice(0, -1).join("/"));
    await this.app.vault.adapter.write(path, serializeSnapshotFile(snapshotFile));
  }

  private snapshotDataPath(): string {
    const folder =
      this.manifest.dir ||
      `${this.app.vault.configDir}/plugins/${this.manifest.id || "annual-review"}`;
    return normalizeDataPath(`${folder}/${SNAPSHOT_FILE_NAME}`);
  }

  private async openDashboard(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_ANNUAL_REVIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private generatorLanguage(
    language = this.settings.generatorLanguage,
  ): ResolvedAnnualReviewLanguage {
    return resolveAnnualReviewLanguage(language, getLanguage());
  }

  private text(
    language = this.settings.generatorLanguage,
  ): (typeof UI_TEXT)[ResolvedAnnualReviewLanguage] {
    return UI_TEXT[this.generatorLanguage(language)];
  }
}

function settingsKey(settings: AnnualReviewSettings): string {
  return JSON.stringify({
    reportFolder: settings.reportFolder,
    includeFolders: settings.includeFolders,
    excludeFolders: settings.excludeFolders,
    excludePatterns: settings.excludePatterns,
  });
}

async function ensureAdapterFolder(app: App, folder: string): Promise<void> {
  if (!folder || (await app.vault.adapter.exists(folder))) {
    return;
  }

  const parts = folder.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.adapter.mkdir(current);
    }
  }
}

function normalizeDataPath(path: string): string {
  return path
    .replace(/\\/gu, "/")
    .replace(/\/{2,}/gu, "/")
    .replace(/^\/+|\/+$/gu, "");
}

class AnnualReviewSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: AnnualReviewPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const language = resolveAnnualReviewLanguage(
      this.plugin.settings.generatorLanguage,
      getLanguage(),
    );
    const text = UI_TEXT[language];
    containerEl.empty();
    containerEl.createEl("h2", { text: text.annualReview });

    new Setting(containerEl)
      .setName(text.reportFolder)
      .setDesc(text.reportFolderDesc)
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.reportFolder)
          .setValue(this.plugin.settings.reportFolder)
          .onChange(async (value) => {
            this.plugin.settings.reportFolder =
              value.trim() || DEFAULT_SETTINGS.reportFolder;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(text.includeFolders)
      .setDesc(text.includeFoldersDesc)
      .addText((text) => {
        text
          .setPlaceholder("Daily, Projects")
          .setValue(joinFolderList(this.plugin.settings.includeFolders))
          .onChange(async (value) => {
            this.plugin.settings.includeFolders = splitFolderList(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(text.excludeFolders)
      .setDesc(text.excludeFoldersDesc)
      .addText((text) => {
        text
          .setPlaceholder(joinFolderList(DEFAULT_SETTINGS.excludeFolders))
          .setValue(joinFolderList(this.plugin.settings.excludeFolders))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = splitFolderList(value);
            await this.plugin.saveSettings();
          });
      });

    this.addLanguageDropdown(
      text.reportLanguage,
      text.reportLanguageDesc,
      "reportLanguage",
    );
    this.addLanguageDropdown(
      text.generatorLanguage,
      text.generatorLanguageDesc,
      "generatorLanguage",
    );
    this.addMetricToggle(text.includeLinkMetrics, "includeLinks");
    this.addMetricToggle(text.includeFrontmatterMetrics, "includeFrontmatter");
    this.addMetricToggle(text.includeHeadingMetrics, "includeHeadings");

    new Setting(containerEl)
      .setName(text.privacyMode)
      .setDesc(text.privacyModeDesc)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("standard", text.standard)
          .addOption("private", text.private)
          .setValue(this.plugin.settings.privacyMode)
          .onChange(async (value) => {
            this.plugin.settings.privacyMode =
              value as AnnualReviewSettings["privacyMode"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("AI provider")
      .setDesc(
        "Default report generation provider. None keeps generation local; ChatGPT uses an OpenAI API key when present, otherwise it tries the local Codex CLI/auth environment.",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("none", "None")
          .addOption("chatgpt", "ChatGPT")
          .setValue(this.plugin.settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider = value as AnnualReviewSettings["aiProvider"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("ChatGPT model")
      .setDesc("OpenAI Responses API model used when ChatGPT is selected.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.chatGptModel)
          .setValue(this.plugin.settings.chatGptModel)
          .onChange(async (value) => {
            this.plugin.settings.chatGptModel =
              value.trim() || DEFAULT_SETTINGS.chatGptModel;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc(
        "Optional. When empty and ChatGPT is selected, Annual Review tries local Codex CLI auth instead of sending a direct OpenAI API request.",
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.chatGptApiKey)
          .onChange(async (value) => {
            this.plugin.settings.chatGptApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Local Codex command")
      .setDesc(
        "One-shot Codex fallback command used when ChatGPT has no API key. Use an absolute Codex path if Obsidian's macOS GUI PATH cannot find codex; long-session app-server support is intentionally out of scope for this fallback.",
      )
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.localCodexCommand)
          .setValue(this.plugin.settings.localCodexCommand)
          .onChange(async (value) => {
            this.plugin.settings.localCodexCommand =
              value.trim() || DEFAULT_SETTINGS.localCodexCommand;
            await this.plugin.saveSettings();
          });
      });
  }

  private addLanguageDropdown(
    name: string,
    description: string,
    key: "reportLanguage" | "generatorLanguage",
  ): void {
    const text =
      UI_TEXT[
        resolveAnnualReviewLanguage(this.plugin.settings.generatorLanguage, getLanguage())
      ];
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("system", text.followObsidian)
          .addOption("zh", text.chinese)
          .addOption("en", text.english)
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            this.plugin.settings[key] = value as AnnualReviewLanguage;
            await this.plugin.saveSettings();
            if (key === "generatorLanguage") {
              this.display();
            }
          });
      });
  }

  private addMetricToggle(
    name: string,
    key: "includeLinks" | "includeFrontmatter" | "includeHeadings",
  ): void {
    new Setting(this.containerEl).setName(name).addToggle((toggle) => {
      toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      });
    });
  }
}
