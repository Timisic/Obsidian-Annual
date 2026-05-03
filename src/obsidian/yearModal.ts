import { Modal, Setting, type App } from "obsidian";
import { joinFolderList, splitFolderList } from "../core/settings";
import type { AnnualReviewSettings, GenerateReportOptions } from "../core/types";

export class YearModal extends Modal {
  private selectedYear = new Date().getFullYear();
  private runSettings: AnnualReviewSettings;

  onChoose: (options: GenerateReportOptions) => void = () => undefined;

  constructor(app: App, settings: AnnualReviewSettings) {
    super(app);
    this.runSettings = { ...settings, includeFolders: [...settings.includeFolders], excludeFolders: [...settings.excludeFolders] };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Generate Annual Review" });

    new Setting(contentEl)
      .setName("Year")
      .setDesc("The calendar year to scan by note created/modified timestamps.")
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
      .setName("Include folders")
      .setDesc("Comma-separated folders for this run. Empty scans all Markdown files.")
      .addText((text) => {
        text
          .setPlaceholder("Daily, Projects")
          .setValue(joinFolderList(this.runSettings.includeFolders))
          .onChange((value) => {
            this.runSettings.includeFolders = splitFolderList(value);
          });
      });

    new Setting(contentEl)
      .setName("Exclude folders")
      .setDesc("Comma-separated folders skipped for this run.")
      .addText((text) => {
        text
          .setValue(joinFolderList(this.runSettings.excludeFolders))
          .onChange((value) => {
            this.runSettings.excludeFolders = splitFolderList(value);
          });
      });

    new Setting(contentEl)
      .setName("Privacy mode")
      .setDesc("Reports stay local; private mode marks the generated note as privacy-sensitive.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("standard", "Standard")
          .addOption("private", "Private")
          .setValue(this.runSettings.privacyMode)
          .onChange((value) => {
            this.runSettings.privacyMode = value as AnnualReviewSettings["privacyMode"];
          });
      });

    this.addMetricToggle("Include task metrics", "includeTasks");
    this.addMetricToggle("Include link metrics", "includeLinks");
    this.addMetricToggle("Include frontmatter metrics", "includeFrontmatter");
    this.addMetricToggle("Include heading metrics", "includeHeadings");

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText("Generate")
          .setCta()
          .onClick(() => {
            this.close();
            this.onChoose({ year: this.selectedYear, settings: this.runSettings });
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Cancel")
          .onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addMetricToggle(name: string, key: "includeTasks" | "includeLinks" | "includeFrontmatter" | "includeHeadings"): void {
    new Setting(this.contentEl)
      .setName(name)
      .addToggle((toggle) => {
        toggle.setValue(this.runSettings[key]).onChange((value) => {
          this.runSettings[key] = value;
        });
      });
  }
}
