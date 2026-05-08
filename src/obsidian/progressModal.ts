import { Modal, type App } from "obsidian";

export class AnnualReviewProgressModal extends Modal {
  private progressEl: HTMLProgressElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(
    app: App,
    private title: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("annual-review-progress-modal");
    this.contentEl.createEl("h2", { text: this.title });
    this.statusEl = this.contentEl.createEl("p", {
      cls: "annual-review-progress-status",
    });
    this.progressEl = this.contentEl.createEl("progress", {
      cls: "annual-review-progress-bar",
      attr: { max: "100", value: "0" },
    });
  }

  update(status: string, value: number): void {
    if (this.statusEl) {
      this.statusEl.setText(status);
    }
    if (this.progressEl) {
      this.progressEl.value = Math.max(0, Math.min(100, value));
    }
  }

  onClose(): void {
    this.contentEl.empty();
    this.progressEl = null;
    this.statusEl = null;
  }
}
