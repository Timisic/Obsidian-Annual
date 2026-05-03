import { getLanguage, Notice, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { renderAiReportSection } from "./core/ai";
import { buildYearAggregate } from "./core/aggregate";
import { COMMAND_IDS, COMMAND_NAMES } from "./core/commands";
import { resolveAnnualReviewLanguage, UI_TEXT } from "./core/language";
import { buildAnnualReviewChartAssets, buildAnnualReviewChartPaths, renderAnnualReview } from "./core/render";
import { DEFAULT_SETTINGS, joinFolderList, splitFolderList } from "./core/settings";
import type { AnnualReviewLanguage, AnnualReviewSettings, GenerateReportOptions, ResolvedAnnualReviewLanguage, SourceFile, YearAggregate } from "./core/types";
import { AnnualReviewDashboardView, VIEW_TYPE_ANNUAL_REVIEW } from "./obsidian/dashboardView";
import { readVaultMarkdownFiles } from "./obsidian/vaultFiles";
import { writeAnnualReviewOutput } from "./obsidian/reportWriter";
import { YearModal } from "./obsidian/yearModal";

export default class AnnualReviewPlugin extends Plugin {
  settings: AnnualReviewSettings = DEFAULT_SETTINGS;
  private indexedFiles: SourceFile[] | null = null;
  private indexedSettingsKey: string | null = null;
  private indexedAt: string | null = null;
  private lastAggregate: YearAggregate | null = null;
  private lastReportPath: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_ANNUAL_REVIEW, (leaf) => new AnnualReviewDashboardView(leaf, this));

    this.addCommand({
      id: COMMAND_IDS.generate,
      name: COMMAND_NAMES.generate,
      callback: () => this.openGenerateModal(),
    });

    this.addCommand({
      id: COMMAND_IDS.generate2026Smoke,
      name: COMMAND_NAMES.generate2026Smoke,
      callback: () => {
        void this.generateReport({ year: 2026, settings: this.settings });
      },
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
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<AnnualReviewSettings> | null),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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
    this.indexedSettingsKey = settingsKey(this.settings);
    this.indexedAt = new Date().toLocaleString();
    new Notice(this.text().rebuilt(this.indexedFiles.length));
  }

  async previewYear(year: number): Promise<void> {
    const files = await this.getIndexedFiles(this.settings);
    this.lastAggregate = buildYearAggregate(files, year, this.settings);
  }

  getLastAggregate(): YearAggregate | null {
    return this.lastAggregate;
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

  private async generateReport(options: GenerateReportOptions): Promise<void> {
    try {
      const { year, settings } = options;
      const text = this.text(settings.generatorLanguage);
      new Notice(text.generating(year));
      const files = await this.getIndexedFiles(settings);
      const aggregate = buildYearAggregate(files, year, settings);
      const aiSummary = await renderAiReportSection({ aggregate, files, settings });
      const reportLanguage = resolveAnnualReviewLanguage(settings.reportLanguage, getLanguage());
      const chartPaths = buildAnnualReviewChartPaths(settings.reportFolder, year);
      const chartAssets = buildAnnualReviewChartAssets(aggregate, { language: reportLanguage, chartPaths });
      const markdown = renderAnnualReview(aggregate, { language: reportLanguage, chartPaths, periodJudgment: aiSummary });
      const report = await writeAnnualReviewOutput(this.app, settings.reportFolder, year, markdown, chartAssets);
      this.lastAggregate = aggregate;
      this.lastReportPath = report.path;
      await this.app.workspace.getLeaf(false).openFile(report);
      new Notice(text.generated(report.path));
    } catch (error) {
      console.error("Annual Review generation failed", error);
      new Notice(this.text().failed(error instanceof Error ? error.message : String(error)));
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

  private async openDashboard(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_ANNUAL_REVIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private generatorLanguage(language = this.settings.generatorLanguage): ResolvedAnnualReviewLanguage {
    return resolveAnnualReviewLanguage(language, getLanguage());
  }

  private text(language = this.settings.generatorLanguage): (typeof UI_TEXT)[ResolvedAnnualReviewLanguage] {
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

class AnnualReviewSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AnnualReviewPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const language = resolveAnnualReviewLanguage(this.plugin.settings.generatorLanguage, getLanguage());
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
            this.plugin.settings.reportFolder = value.trim() || DEFAULT_SETTINGS.reportFolder;
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

    this.addLanguageDropdown(text.reportLanguage, text.reportLanguageDesc, "reportLanguage");
    this.addLanguageDropdown(text.generatorLanguage, text.generatorLanguageDesc, "generatorLanguage");
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
            this.plugin.settings.privacyMode = value as AnnualReviewSettings["privacyMode"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("AI provider")
      .setDesc("Default report generation provider. None keeps generation local; ChatGPT uses an OpenAI API key when present, otherwise it tries the local Codex CLI/auth environment.")
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
            this.plugin.settings.chatGptModel = value.trim() || DEFAULT_SETTINGS.chatGptModel;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Optional. When empty and ChatGPT is selected, Annual Review tries local Codex CLI auth instead of sending a direct OpenAI API request.")
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
  }

  private addLanguageDropdown(name: string, description: string, key: "reportLanguage" | "generatorLanguage"): void {
    const text = UI_TEXT[resolveAnnualReviewLanguage(this.plugin.settings.generatorLanguage, getLanguage())];
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

  private addMetricToggle(name: string, key: "includeLinks" | "includeFrontmatter" | "includeHeadings"): void {
    new Setting(this.containerEl)
      .setName(name)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
