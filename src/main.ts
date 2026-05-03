import { Notice, Plugin, PluginSettingTab, Setting, type App } from "obsidian";
import { buildYearAggregate } from "./core/aggregate";
import { COMMAND_IDS } from "./core/commands";
import { renderAnnualReview } from "./core/render";
import { DEFAULT_SETTINGS, joinFolderList, splitFolderList } from "./core/settings";
import type { AnnualReviewSettings, GenerateReportOptions, SourceFile, YearAggregate } from "./core/types";
import { AnnualReviewDashboardView, VIEW_TYPE_ANNUAL_REVIEW } from "./obsidian/dashboardView";
import { readVaultMarkdownFiles } from "./obsidian/vaultFiles";
import { writeReport } from "./obsidian/reportWriter";
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
      name: "Generate report",
      callback: () => this.openGenerateModal(),
    });

    this.addCommand({
      id: COMMAND_IDS.openDashboard,
      name: "Open dashboard",
      callback: () => {
        void this.openDashboard();
      },
    });

    this.addCommand({
      id: COMMAND_IDS.rebuildIndex,
      name: "Rebuild index",
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
    const modal = new YearModal(this.app, this.settings);
    modal.onChoose = (options) => {
      void this.generateReport(options);
    };
    modal.open();
  }

  async rebuildIndex(): Promise<void> {
    this.indexedFiles = await readVaultMarkdownFiles(this.app, this.settings);
    this.indexedSettingsKey = settingsKey(this.settings);
    this.indexedAt = new Date().toLocaleString();
    new Notice(`Annual Review index rebuilt: ${this.indexedFiles.length} Markdown files.`);
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
      new Notice(`Generating ${year} annual review...`);
      const files = await this.getIndexedFiles(settings);
      const aggregate = buildYearAggregate(files, year, settings);
      const markdown = renderAnnualReview(aggregate);
      const report = await writeReport(this.app, settings.reportFolder, year, markdown);
      this.lastAggregate = aggregate;
      this.lastReportPath = report.path;
      await this.app.workspace.getLeaf(false).openFile(report);
      new Notice(`Annual review generated: ${report.path}`);
    } catch (error) {
      console.error("Annual Review generation failed", error);
      new Notice(`Annual Review failed: ${error instanceof Error ? error.message : String(error)}`);
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
    containerEl.empty();
    containerEl.createEl("h2", { text: "Annual Review" });

    new Setting(containerEl)
      .setName("Report folder")
      .setDesc("Generated annual review notes are written here and excluded from future scans.")
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
      .setName("Include folders")
      .setDesc("Comma-separated folder list. Leave empty to scan all Markdown files.")
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
      .setName("Exclude folders")
      .setDesc("Comma-separated folder list excluded from scans.")
      .addText((text) => {
        text
          .setPlaceholder(joinFolderList(DEFAULT_SETTINGS.excludeFolders))
          .setValue(joinFolderList(this.plugin.settings.excludeFolders))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = splitFolderList(value);
            await this.plugin.saveSettings();
          });
      });

    this.addMetricToggle("Include task metrics", "includeTasks");
    this.addMetricToggle("Include link metrics", "includeLinks");
    this.addMetricToggle("Include frontmatter metrics", "includeFrontmatter");
    this.addMetricToggle("Include heading metrics", "includeHeadings");

    new Setting(containerEl)
      .setName("Privacy mode")
      .setDesc("Private mode labels generated reports as privacy-sensitive without changing local-only behavior.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("standard", "Standard")
          .addOption("private", "Private")
          .setValue(this.plugin.settings.privacyMode)
          .onChange(async (value) => {
            this.plugin.settings.privacyMode = value as AnnualReviewSettings["privacyMode"];
            await this.plugin.saveSettings();
          });
      });
  }

  private addMetricToggle(name: string, key: "includeTasks" | "includeLinks" | "includeFrontmatter" | "includeHeadings"): void {
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
