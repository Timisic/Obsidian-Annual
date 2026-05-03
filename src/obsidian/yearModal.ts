import { Modal, Setting, type App } from "obsidian";
import { UI_TEXT } from "../core/language";
import { joinFolderList, splitFolderList } from "../core/settings";
import type { AnnualReviewLanguage, AnnualReviewSettings, GenerateReportOptions, ResolvedAnnualReviewLanguage } from "../core/types";

export class YearModal extends Modal {
  private selectedYear = new Date().getFullYear();
  private runSettings: AnnualReviewSettings;

  onChoose: (options: GenerateReportOptions) => void = () => undefined;

  constructor(app: App, settings: AnnualReviewSettings, private language: ResolvedAnnualReviewLanguage) {
    super(app);
    this.runSettings = { ...settings, includeFolders: [...settings.includeFolders], excludeFolders: [...settings.excludeFolders] };
  }

  onOpen(): void {
    const { contentEl } = this;
    const text = UI_TEXT[this.language];
    contentEl.empty();
    contentEl.createEl("h2", { text: text.generateTitle });

    new Setting(contentEl)
      .setName(text.year)
      .setDesc(text.yearDesc)
      .addText((text) => {
        text
          .setPlaceholder(String(this.selectedYear))
          .setValue(String(this.selectedYear))
          .onChange((value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) {
              this.selectedYear = parsed;
            }
          });
      });

    new Setting(contentEl)
      .setName(text.includeFolders)
      .setDesc(text.runIncludeFoldersDesc)
      .addText((text) => {
        text
          .setPlaceholder("Daily, Projects")
          .setValue(joinFolderList(this.runSettings.includeFolders))
          .onChange((value) => {
            this.runSettings.includeFolders = splitFolderList(value);
          });
      });

    new Setting(contentEl)
      .setName(text.excludeFolders)
      .setDesc(text.runExcludeFoldersDesc)
      .addText((text) => {
        text
          .setValue(joinFolderList(this.runSettings.excludeFolders))
          .onChange((value) => {
            this.runSettings.excludeFolders = splitFolderList(value);
          });
      });

    new Setting(contentEl)
      .setName(text.reportLanguage)
      .setDesc(text.reportLanguageDesc)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("system", text.followObsidian)
          .addOption("zh", text.chinese)
          .addOption("en", text.english)
          .setValue(this.runSettings.reportLanguage)
          .onChange((value) => {
            this.runSettings.reportLanguage = value as AnnualReviewLanguage;
          });
      });

    new Setting(contentEl)
      .setName(text.privacyMode)
      .setDesc(text.privacyModeDesc)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("standard", text.standard)
          .addOption("private", text.private)
          .setValue(this.runSettings.privacyMode)
          .onChange((value) => {
            this.runSettings.privacyMode = value as AnnualReviewSettings["privacyMode"];
          });
      });

    this.addMetricToggle(text.includeLinkMetrics, "includeLinks");
    this.addMetricToggle(text.includeFrontmatterMetrics, "includeFrontmatter");
    this.addMetricToggle(text.includeHeadingMetrics, "includeHeadings");

    new Setting(contentEl)
      .setName("AI provider")
      .setDesc("None keeps this run local. ChatGPT uses the configured OpenAI API key or falls back to local Codex CLI auth.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("none", "None")
          .addOption("chatgpt", "ChatGPT")
          .setValue(this.runSettings.aiProvider)
          .onChange((value) => {
            this.runSettings.aiProvider = value as AnnualReviewSettings["aiProvider"];
          });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText(text.generate)
          .setCta()
          .onClick(() => {
            this.close();
            this.onChoose({ year: this.selectedYear, settings: this.runSettings });
          });
      })
      .addButton((button) => {
        button
          .setButtonText(text.cancel)
          .onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addMetricToggle(name: string, key: "includeLinks" | "includeFrontmatter" | "includeHeadings"): void {
    new Setting(this.contentEl)
      .setName(name)
      .addToggle((toggle) => {
        toggle.setValue(this.runSettings[key]).onChange((value) => {
          this.runSettings[key] = value;
        });
      });
  }
}
