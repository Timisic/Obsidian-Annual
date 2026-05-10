import { Modal, Notice, Setting, type App } from "obsidian";
import { UI_TEXT } from "../core/language";
import {
  buildAnnualReviewSession,
  buildCustomReviewSession,
  buildQuarterlyReviewSession,
} from "../core/reviewSession";
import { joinFolderList, splitFolderList } from "../core/settings";
import type {
  AnnualReviewLanguage,
  AnnualReviewSettings,
  GenerateReportOptions,
  ResolvedAnnualReviewLanguage,
  ReviewPreset,
} from "../core/types";

export class YearModal extends Modal {
  private selectedPreset: ReviewPreset = "annual";
  private selectedYear = new Date().getFullYear();
  private selectedQuarter = 1;
  private customLabel = "";
  private customStartDate = `${this.selectedYear}-01-01`;
  private customEndDate = `${this.selectedYear}-12-31`;
  private runSettings: AnnualReviewSettings;

  onChoose: (options: GenerateReportOptions) => void = () => undefined;

  constructor(
    app: App,
    settings: AnnualReviewSettings,
    private language: ResolvedAnnualReviewLanguage,
  ) {
    super(app);
    this.runSettings = {
      ...settings,
      includeFolders: [...settings.includeFolders],
      excludeFolders: [...settings.excludeFolders],
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    const text = UI_TEXT[this.language];
    contentEl.empty();
    contentEl.createEl("h2", { text: text.generateTitle });

    new Setting(contentEl)
      .setName(text.reviewPreset)
      .setDesc(text.reviewPresetDesc)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("annual", text.annualPreset)
          .addOption("quarterly", text.quarterlyPreset)
          .addOption("custom", text.customPreset)
          .setValue(this.selectedPreset)
          .onChange((value) => {
            this.selectedPreset = value as ReviewPreset;
          });
      });

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
      .setName(text.quarter)
      .setDesc(text.quarterDesc)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("1", "Q1")
          .addOption("2", "Q2")
          .addOption("3", "Q3")
          .addOption("4", "Q4")
          .setValue(String(this.selectedQuarter))
          .onChange((value) => {
            this.selectedQuarter = Number.parseInt(value, 10);
          });
      });

    new Setting(contentEl)
      .setName(text.customLabel)
      .setDesc(text.customLabelDesc)
      .addText((text) => {
        text
          .setPlaceholder(`${this.selectedYear} Writing Sprint Review`)
          .setValue(this.customLabel)
          .onChange((value) => {
            this.customLabel = value;
          });
      });

    new Setting(contentEl)
      .setName(text.customStartDate)
      .setDesc(text.customDateDesc)
      .addText((text) => {
        text
          .setPlaceholder(`${this.selectedYear}-01-01`)
          .setValue(this.customStartDate)
          .onChange((value) => {
            this.customStartDate = value;
          });
      });

    new Setting(contentEl)
      .setName(text.customEndDate)
      .setDesc(text.customDateDesc)
      .addText((text) => {
        text
          .setPlaceholder(`${this.selectedYear}-12-31`)
          .setValue(this.customEndDate)
          .onChange((value) => {
            this.customEndDate = value;
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
      .setName("Optional AI enrichment")
      .setDesc(
        "None keeps this MVP run local. ChatGPT is an explicit enrichment pass that can only supplement evidence explanations and report draft text.",
      )
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
            try {
              const session = this.buildSession();
              this.close();
              this.onChoose({
                year: this.selectedYear,
                session,
                settings: this.runSettings,
              });
            } catch (error) {
              new Notice(
                error instanceof Error ? error.message : "Invalid review date range.",
              );
            }
          });
      })
      .addButton((button) => {
        button.setButtonText(text.cancel).onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addMetricToggle(
    name: string,
    key: "includeLinks" | "includeFrontmatter" | "includeHeadings",
  ): void {
    new Setting(this.contentEl).setName(name).addToggle((toggle) => {
      toggle.setValue(this.runSettings[key]).onChange((value) => {
        this.runSettings[key] = value;
      });
    });
  }

  private buildSession(): GenerateReportOptions["session"] {
    if (this.selectedPreset === "quarterly") {
      return buildQuarterlyReviewSession(
        this.selectedYear,
        this.selectedQuarter,
        this.runSettings,
      );
    }
    if (this.selectedPreset === "custom") {
      return buildCustomReviewSession({
        label: this.customLabel,
        startDate: this.customStartDate,
        endDate: this.customEndDate,
        settings: this.runSettings,
      });
    }
    return buildAnnualReviewSession(this.selectedYear, this.runSettings);
  }
}
