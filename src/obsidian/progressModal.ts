import type { App } from "obsidian";

export class AnnualReviewProgressIndicator {
  private containerEl: HTMLElement | null = null;
  private progressEl: HTMLProgressElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(
    _app: App,
    private title: string,
    private rootEl: HTMLElement = document.body,
  ) {}

  open(): void {
    if (this.containerEl) {
      return;
    }

    const container = document.createElement("div");
    container.className = "annual-review-progress-indicator";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");

    const titleEl = document.createElement("h2");
    titleEl.textContent = this.title;
    container.appendChild(titleEl);

    this.statusEl = document.createElement("p");
    this.statusEl.className = "annual-review-progress-status";
    container.appendChild(this.statusEl);

    this.progressEl = document.createElement("progress");
    this.progressEl.className = "annual-review-progress-bar";
    this.progressEl.max = 100;
    this.progressEl.value = 0;
    container.appendChild(this.progressEl);

    this.rootEl.appendChild(container);
    this.containerEl = container;
  }

  update(status: string, value: number): void {
    if (!this.containerEl) {
      this.open();
    }

    if (this.statusEl) {
      this.statusEl.textContent = status;
    }
    if (this.progressEl) {
      this.progressEl.value = clampProgress(value);
    }
  }

  close(): void {
    this.containerEl?.remove();
    this.containerEl = null;
    this.progressEl = null;
    this.statusEl = null;
  }
}

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}
