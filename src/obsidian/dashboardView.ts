import { ItemView, Setting, type WorkspaceLeaf } from "obsidian";
import { joinFolderList } from "../core/settings";
import type { AnnualReviewSettings, YearAggregate } from "../core/types";

export const VIEW_TYPE_ANNUAL_REVIEW = "annual-review-dashboard";

export interface AnnualReviewDashboardController {
  getLastAggregate(): YearAggregate | null;
  getLastReportPath(): string | null;
  getSettings(): AnnualReviewSettings;
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
    return "Annual Review";
  }

  async onOpen(): Promise<void> {
    this.renderLoading("Building preview...");
    await this.controller.previewYear(this.selectedYear);
    this.render();
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.createEl("h2", { text: "Annual Review" });

    const aggregate = this.controller.getLastAggregate();
    const settings = this.controller.getSettings();
    const index = this.controller.getIndexStatus();
    this.selectedYear = aggregate?.year ?? this.selectedYear;
    let year = this.selectedYear;

    new Setting(container)
      .setName("Year")
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
          .setButtonText("Preview")
          .setCta()
          .onClick(async () => {
            this.selectedYear = year;
            this.renderLoading("Refreshing preview...");
            await this.controller.previewYear(year);
            this.render();
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Generate report")
          .onClick(() => {
            this.controller.openGenerateModal();
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Rebuild")
          .onClick(async () => {
            this.renderLoading("Rebuilding index...");
            await this.controller.rebuildIndex();
            await this.controller.previewYear(year);
            this.render();
          });
      });

    container.createEl("h3", { text: "Scope" });
    renderList(container, [
      `Include: ${settings.includeFolders.length > 0 ? joinFolderList(settings.includeFolders) : "All Markdown files"}`,
      `Exclude: ${settings.excludeFolders.length > 0 ? joinFolderList(settings.excludeFolders) : "None"}`,
      `Privacy: ${settings.privacyMode}`,
      `Index: ${index.builtAt ? `${index.fileCount} files, rebuilt ${index.builtAt}` : "Not built yet"}`,
    ]);

    const reportPath = this.controller.getLastReportPath();
    new Setting(container)
      .setName(reportPath ? `Report: ${reportPath}` : "No report generated yet")
      .addButton((button) => {
        button
          .setButtonText("Open report")
          .setDisabled(!reportPath)
          .onClick(async () => {
            await this.controller.openLastReport();
          });
      });

    if (!aggregate) {
      container.createEl("p", { text: "No preview data found for this year." });
      return;
    }

    const summary = container.createDiv({ cls: "annual-review-dashboard-summary" });
    renderMetric(summary, "Created", String(aggregate.createdCount));
    renderMetric(summary, "Modified", String(aggregate.modifiedCount));
    renderMetric(summary, "Active days", String(aggregate.activeDays));
    renderMetric(summary, "Words", String(aggregate.totalWords));

    container.createEl("h3", { text: "Monthly Trend" });
    renderTrend(container, aggregate);

    container.createEl("h3", { text: "Top Tags" });
    renderList(container, aggregate.topTags.map((item) => `${item.name}: ${item.count}`));
    container.createEl("h3", { text: "Top Folders" });
    renderList(container, aggregate.topFolders.map((item) => `${item.name}: ${item.count}`));
    container.createEl("h3", { text: "Top Links" });
    renderList(container, aggregate.topLinks.map((item) => `${item.name}: ${item.count}`));
    container.createEl("h3", { text: "Representative Notes" });
    renderList(container, aggregate.representativeNotes.map((note) => `${note.path} (${note.words} words)`));
  }

  private renderLoading(message: string): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.createEl("h2", { text: "Annual Review" });
    container.createEl("p", { text: message });
  }
}

function renderMetric(parent: HTMLElement, label: string, value: string): void {
  const item = parent.createDiv({ cls: "annual-review-dashboard-metric" });
  item.createEl("div", { text: label });
  item.createEl("strong", { text: value });
}

function renderTrend(parent: Element, aggregate: YearAggregate): void {
  const maxWords = Math.max(1, ...aggregate.monthBuckets.map((bucket) => bucket.words));
  const chart = parent.createEl("div", { cls: "annual-review-dashboard-bars" });
  for (const bucket of aggregate.monthBuckets) {
    const row = chart.createDiv({ cls: "annual-review-dashboard-bar-row" });
    row.createEl("span", { text: bucket.month.slice(5) });
    const bar = row.createDiv({ cls: "annual-review-dashboard-bar" });
    bar.style.width = `${Math.max(4, Math.round((bucket.words / maxWords) * 100))}%`;
    row.createEl("span", { text: String(bucket.words) });
  }
}

function renderList(parent: Element, items: string[]): void {
  const list = parent.createEl("ul");
  for (const item of items.length > 0 ? items : ["No data found."]) {
    list.createEl("li", { text: item });
  }
}
