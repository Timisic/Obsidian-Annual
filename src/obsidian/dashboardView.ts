import { ItemView, Setting, type WorkspaceLeaf } from "obsidian";
import { UI_TEXT } from "../core/language";
import { joinFolderList } from "../core/settings";
import type { AnnualReviewSettings, ResolvedAnnualReviewLanguage, YearAggregate } from "../core/types";

export const VIEW_TYPE_ANNUAL_REVIEW = "annual-review-dashboard";

export interface AnnualReviewDashboardController {
  getLastAggregate(): YearAggregate | null;
  getLastReportPath(): string | null;
  getSettings(): AnnualReviewSettings;
  getGeneratorLanguage(): ResolvedAnnualReviewLanguage;
  getIndexStatus(): { fileCount: number; builtAt: string | null };
  previewYear(year: number): Promise<void>;
  openGenerateModal(): void;
  rebuildIndex(): Promise<void>;
  openLastReport(): Promise<void>;
}

export class AnnualReviewDashboardView extends ItemView {
  private selectedYear = new Date().getFullYear();

  constructor(leaf: WorkspaceLeaf, private controller: AnnualReviewDashboardController) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_ANNUAL_REVIEW;
  }

  getDisplayText(): string {
    return this.text().annualReview;
  }

  async onOpen(): Promise<void> {
    this.renderLoading(this.text().buildingPreview);
    await this.controller.previewYear(this.selectedYear);
    this.render();
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    const text = this.text();
    container.empty();
    container.createEl("h2", { text: text.annualReview });

    const aggregate = this.controller.getLastAggregate();
    const settings = this.controller.getSettings();
    const index = this.controller.getIndexStatus();
    this.selectedYear = aggregate?.year ?? this.selectedYear;
    let year = this.selectedYear;

    new Setting(container)
      .setName(text.year)
      .addText((text) => {
        text
          .setValue(String(this.selectedYear))
          .onChange((value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) {
              year = parsed;
            }
          });
      })
      .addButton((button) => {
        button
          .setButtonText(text.preview)
          .setCta()
          .onClick(async () => {
            this.selectedYear = year;
            this.renderLoading(text.refreshingPreview);
            await this.controller.previewYear(year);
            this.render();
          });
      })
      .addButton((button) => {
        button
          .setButtonText(text.generateReport)
          .onClick(() => {
            this.controller.openGenerateModal();
          });
      })
      .addButton((button) => {
        button
          .setButtonText(text.rebuild)
          .onClick(async () => {
            this.renderLoading(text.refreshingPreview);
            await this.controller.rebuildIndex();
            await this.controller.previewYear(year);
            this.render();
          });
      });

    container.createEl("h3", { text: text.scope });
    renderList(container, [
      `${text.include}: ${settings.includeFolders.length > 0 ? joinFolderList(settings.includeFolders) : text.allMarkdownFiles}`,
      `${text.exclude}: ${settings.excludeFolders.length > 0 ? joinFolderList(settings.excludeFolders) : text.none}`,
      `${text.privacy}: ${settings.privacyMode}`,
      `${text.index}: ${index.builtAt ? text.rebuiltAt(index.fileCount, index.builtAt) : text.notBuiltYet}`,
    ], this.controller.getGeneratorLanguage());

    const reportPath = this.controller.getLastReportPath();
    new Setting(container)
      .setName(reportPath ? text.report(reportPath) : text.noReportGenerated)
      .addButton((button) => {
        button
          .setButtonText(text.openReport)
          .setDisabled(!reportPath)
          .onClick(async () => {
            await this.controller.openLastReport();
          });
      });

    if (!aggregate) {
      container.createEl("p", { text: text.noPreviewData });
      return;
    }

    const summary = container.createDiv({ cls: "annual-review-dashboard-summary" });
    renderMetric(summary, text.created, String(aggregate.createdCount));
    renderMetric(summary, text.modified, String(aggregate.modifiedCount));
    renderMetric(summary, text.activeDays, String(aggregate.activeDays));
    renderMetric(summary, text.words, String(aggregate.totalWords));

    container.createEl("h3", { text: text.monthlyTrend });
    renderTrend(container, aggregate);

    container.createEl("h3", { text: text.topTags });
    renderList(container, aggregate.topTags.map((item) => `${item.name}: ${item.count}`), this.controller.getGeneratorLanguage());
    container.createEl("h3", { text: text.topFolders });
    renderList(container, aggregate.topFolders.map((item) => `${item.name}: ${item.count}`), this.controller.getGeneratorLanguage());
    container.createEl("h3", { text: text.topLinks });
    renderList(container, aggregate.topLinks.map((item) => `${item.name}: ${item.count}`), this.controller.getGeneratorLanguage());
    container.createEl("h3", { text: text.representativeNotes });
    renderList(container, aggregate.representativeNotes.map((note) => `${note.path} (${text.noteWords(note.words)})`), this.controller.getGeneratorLanguage());
  }

  private renderLoading(message: string): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.createEl("h2", { text: this.text().annualReview });
    container.createEl("p", { text: message });
  }

  private text(): (typeof UI_TEXT)[ResolvedAnnualReviewLanguage] {
    return UI_TEXT[this.controller.getGeneratorLanguage()];
  }
}

function renderMetric(parent: HTMLElement, label: string, value: string): void {
  const item = parent.createDiv({ cls: "annual-review-dashboard-metric" });
  item.createEl("div", { text: label });
  item.createEl("strong", { text: value });
}

function renderTrend(parent: Element, aggregate: YearAggregate): void {
  const months = aggregate.monthBuckets.filter((bucket) => bucket.created > 0 || bucket.modified > 0 || bucket.words > 0 || bucket.characters > 0);
  const maxWords = Math.max(1, ...months.map((bucket) => bucket.words));
  const chart = parent.createEl("div", { cls: "annual-review-dashboard-bars" });
  for (const bucket of months) {
    const row = chart.createDiv({ cls: "annual-review-dashboard-bar-row" });
    row.createEl("span", { text: bucket.month.slice(5) });
    const bar = row.createDiv({ cls: "annual-review-dashboard-bar" });
    bar.style.width = `${Math.max(4, Math.round((bucket.words / maxWords) * 100))}%`;
    row.createEl("span", { text: String(bucket.words) });
  }
}

function renderList(parent: Element, items: string[], language: ResolvedAnnualReviewLanguage): void {
  const list = parent.createEl("ul");
  for (const item of items.length > 0 ? items : [UI_TEXT[language].noDataFound]) {
    list.createEl("li", { text: item });
  }
}
