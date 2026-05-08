import { ItemView, Setting, type WorkspaceLeaf } from "obsidian";
import { UI_TEXT } from "../core/language";
import type {
  ReviewAction,
  ReviewCandidate,
  ReviewSessionState,
} from "../core/reviewState";
import { joinFolderList } from "../core/settings";
import type {
  AnnualReviewSettings,
  ResolvedAnnualReviewLanguage,
  YearAggregate,
} from "../core/types";
import { getActionCandidateId, getNextReviewSelection } from "./reviewSelection";

export const VIEW_TYPE_ANNUAL_REVIEW = "annual-review-dashboard";

export interface AnnualReviewDashboardController {
  getLastAggregate(): YearAggregate | null;
  getLastReportPath(): string | null;
  getSettings(): AnnualReviewSettings;
  getGeneratorLanguage(): ResolvedAnnualReviewLanguage;
  getIndexStatus(): { fileCount: number; builtAt: string | null };
  getReviewSession(): ReviewSessionState | null;
  previewYear(year: number): Promise<void>;
  openGenerateModal(): void;
  rebuildIndex(): Promise<void>;
  openLastReport(): Promise<void>;
  applyReviewAction(action: ReviewAction): Promise<void>;
  openSourceNote(candidateId: string, evidenceId?: string): Promise<void>;
}

export class AnnualReviewDashboardView extends ItemView {
  private selectedYear = new Date().getFullYear();
  private selectedCandidateId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private controller: AnnualReviewDashboardController,
  ) {
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
    container.addClass("annual-review-dashboard-view");
    renderHeader(container, text.annualReview);

    const aggregate = this.controller.getLastAggregate();
    const settings = this.controller.getSettings();
    const index = this.controller.getIndexStatus();
    const reviewSession = this.controller.getReviewSession();
    const reportPath = this.controller.getLastReportPath();
    this.selectedYear = aggregate?.year ?? this.selectedYear;
    let year = this.selectedYear;

    const renderControls = () => {
      const controls = container.createDiv({ cls: "annual-review-dashboard-toolbar" });
      new Setting(controls)
        .setName(text.year)
        .addText((text) => {
          text.setValue(String(this.selectedYear)).onChange((value) => {
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
          button.setButtonText(text.generateReport).onClick(() => {
            this.controller.openGenerateModal();
          });
        })
        .addButton((button) => {
          button.setButtonText(text.rebuild).onClick(async () => {
            this.renderLoading(text.refreshingPreview);
            await this.controller.rebuildIndex();
            await this.controller.previewYear(year);
            this.render();
          });
        })
        .addButton((button) => {
          button
            .setButtonText(text.openReport)
            .setDisabled(!reportPath)
            .onClick(async () => {
              await this.controller.openLastReport();
            });
        });

      const status = controls.createDiv({
        cls: "annual-review-dashboard-toolbar-status",
      });
      status.createSpan({
        text: index.builtAt
          ? text.rebuiltAt(index.fileCount, index.builtAt)
          : text.notBuiltYet,
      });
      status.createSpan({
        text: reportPath ? text.report(reportPath) : text.noReportGenerated,
      });
    };

    if (!aggregate) {
      renderControls();
      container.createEl("p", {
        cls: "annual-review-dashboard-empty",
        text: text.noPreviewData,
      });
      return;
    }

    this.renderReviewBoard(container, reviewSession);
    renderControls();

    const secondary = container.createEl("details", {
      cls: "annual-review-dashboard-secondary",
    });
    secondary.createEl("summary", { text: `${text.scope} / ${text.index}` });
    const scopeGrid = secondary.createDiv({ cls: "annual-review-dashboard-info-grid" });
    renderInfoCard(
      scopeGrid,
      text.include,
      settings.includeFolders.length > 0
        ? joinFolderList(settings.includeFolders)
        : text.allMarkdownFiles,
    );
    renderInfoCard(
      scopeGrid,
      text.exclude,
      settings.excludeFolders.length > 0
        ? joinFolderList(settings.excludeFolders)
        : text.none,
    );
    renderInfoCard(scopeGrid, text.privacy, settings.privacyMode);
  }

  private renderLoading(message: string): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("annual-review-dashboard-view");
    renderHeader(container, this.text().annualReview);
    container.createEl("p", { cls: "annual-review-dashboard-empty", text: message });
  }

  private text(): (typeof UI_TEXT)[ResolvedAnnualReviewLanguage] {
    return UI_TEXT[this.controller.getGeneratorLanguage()];
  }

  private renderReviewBoard(
    container: HTMLElement,
    session: ReviewSessionState | null,
  ): void {
    const text = this.text();
    if (!session || session.candidates.length === 0) {
      container.createEl("p", {
        cls: "annual-review-dashboard-empty",
        text: text.noReviewCandidates,
      });
      return;
    }

    const current =
      session.candidates.find((candidate) => candidate.id === this.selectedCandidateId) ??
      firstReviewableCandidate(session.candidates) ??
      session.candidates[0];
    this.selectedCandidateId = current?.id ?? null;

    const board = container.createDiv({ cls: "annual-review-board" });
    renderProgress(board, session, text);

    const queue = board.createDiv({ cls: "annual-review-board-queue" });
    queue.createEl("h3", {
      cls: "annual-review-dashboard-section-title",
      text: text.reviewQueue,
    });

    const groups = [
      {
        label: text.toReview,
        candidates: session.candidates.filter(
          (candidate) => candidate.status === "candidate",
        ),
      },
      {
        label: text.accepted,
        candidates: session.candidates.filter((candidate) =>
          ["accepted", "renamed"].includes(candidate.status),
        ),
      },
      {
        label: text.actions,
        candidates: session.candidates.filter(
          (candidate) => candidate.status === "next-action",
        ),
      },
      {
        label: text.closed,
        candidates: session.candidates.filter((candidate) =>
          ["ignored", "archived", "merged"].includes(candidate.status),
        ),
      },
    ];

    for (const group of groups) {
      const section = queue.createDiv({ cls: "annual-review-board-queue-group" });
      section.createEl("h4", { text: `${group.label} (${group.candidates.length})` });
      for (const candidate of group.candidates) {
        const row = section.createEl("button", {
          cls: candidate.id === current?.id ? "is-active" : "",
        });
        row.type = "button";
        row.createSpan({
          cls: "annual-review-board-queue-title",
          text: `[${candidate.type}] ${displayCandidateTitle(candidate)}`,
        });
        row.createSpan({
          cls: "annual-review-board-queue-status",
          text: candidate.status,
        });
        row.onClickEvent(() => {
          this.selectedCandidateId = candidate.id;
          this.render();
        });
      }
    }

    const detail = board.createDiv({ cls: "annual-review-board-detail" });
    if (!current) {
      detail.createEl("p", {
        cls: "annual-review-dashboard-empty",
        text: text.noReviewCandidates,
      });
      return;
    }
    const detailHeader = detail.createDiv({ cls: "annual-review-board-detail-header" });
    detailHeader.createEl("h4", { text: displayCandidateTitle(current) });
    detailHeader.createSpan({ text: `${current.type} / ${current.status}` });
    detail.createEl("p", { cls: "annual-review-board-reason", text: current.reason });
    if (current.rankReason) {
      detail.createEl("p", { cls: "annual-review-board-rank", text: current.rankReason });
    }

    const evidenceList = detail.createEl("ul", { cls: "annual-review-board-evidence" });
    for (const evidence of current.evidence) {
      const item = evidenceList.createEl("li");
      const button = item.createEl("button", {
        text: evidence.missing
          ? `${evidence.label} (${text.missingEvidence})`
          : evidence.label,
      });
      button.type = "button";
      button.onClickEvent(async () => {
        await this.controller.openSourceNote(current.id, evidence.id);
      });
      if (evidence.reason) {
        item.createSpan({
          cls: "annual-review-board-evidence-reason",
          text: evidence.reason,
        });
      }
    }

    this.renderDecisionControls(detail, session, current);
  }

  private renderDecisionControls(
    parent: HTMLElement,
    session: ReviewSessionState,
    candidate: ReviewCandidate,
  ): void {
    const text = this.text();
    const actions = parent.createDiv({ cls: "annual-review-board-actions" });
    const runAction = async (action: ReviewAction) => {
      await this.controller.applyReviewAction(action);
      const actedCandidateId = getActionCandidateId(action);
      const nextSession = this.controller.getReviewSession();
      if (actedCandidateId && nextSession) {
        this.selectedCandidateId = getNextReviewSelection(
          nextSession.candidates,
          actedCandidateId,
        );
      }
      this.render();
    };
    const at = () => new Date().toISOString();

    new Setting(actions)
      .setName(text.decisionActions)
      .addButton((button) => {
        button
          .setButtonText(text.accept)
          .setCta()
          .onClick(async () => {
            await runAction({ type: "accept", candidateId: candidate.id, at: at() });
          });
      })
      .addButton((button) => {
        button.setButtonText(text.addHighlight).onClick(async () => {
          await runAction({
            type: "add-to-annual-highlights",
            candidateId: candidate.id,
            at: at(),
          });
        });
      })
      .addButton((button) => {
        button.setButtonText(text.addAction).onClick(async () => {
          const label = window.prompt(
            text.actionPrompt,
            displayCandidateTitle(candidate),
          );
          if (!label?.trim()) {
            return;
          }
          await runAction({
            type: "add-to-actions",
            candidateId: candidate.id,
            at: at(),
            decision: {
              id: `${candidate.id}:decision:${Date.now()}`,
              action: "continue",
              label: label.trim(),
              includeInReport: true,
            },
          });
        });
      })
      .addButton((button) => {
        button.setButtonText(text.ignore).onClick(async () => {
          await runAction({ type: "ignore", candidateId: candidate.id, at: at() });
        });
      })
      .addButton((button) => {
        button.setButtonText(text.openSourceNote).onClick(async () => {
          await this.controller.openSourceNote(candidate.id);
        });
      });

    if (candidate.type === "topic") {
      new Setting(actions).setName(text.topicActions).addButton((button) => {
        button.setButtonText(text.renameTopic).onClick(async () => {
          const title = window.prompt(
            text.renamePrompt,
            displayCandidateTitle(candidate),
          );
          if (!title?.trim()) {
            return;
          }
          await runAction({
            type: "rename-topic",
            candidateId: candidate.id,
            title: title.trim(),
            at: at(),
          });
        });
      });

      const targets = session.candidates.filter(
        (item) =>
          item.type === "topic" && item.id !== candidate.id && item.status !== "merged",
      );
      if (targets.length > 0) {
        const merge = actions.createDiv({ cls: "annual-review-board-merge" });
        const select = merge.createEl("select");
        for (const target of targets) {
          select.createEl("option", {
            attr: { value: target.id },
            text: displayCandidateTitle(target),
          });
        }
        const button = merge.createEl("button", { text: text.mergeTopic });
        button.type = "button";
        button.onClickEvent(async () => {
          await runAction({
            type: "merge-topic",
            sourceCandidateId: candidate.id,
            targetCandidateId: select.value,
            at: at(),
          });
        });
      }
    }
  }
}

function firstReviewableCandidate(
  candidates: ReviewCandidate[],
): ReviewCandidate | undefined {
  return candidates.find((candidate) => candidate.status === "candidate");
}

function displayCandidateTitle(candidate: ReviewCandidate): string {
  return candidate.userTitle || candidate.title;
}

function renderProgress(
  parent: HTMLElement,
  session: ReviewSessionState,
  text: (typeof UI_TEXT)[ResolvedAnnualReviewLanguage],
): void {
  const progress = session.progress;
  const bar = parent.createDiv({ cls: "annual-review-board-progress" });
  renderReviewMetric(bar, text.reviewed, `${progress.reviewed} / ${progress.total}`);
  renderReviewMetric(bar, text.accepted, String(progress.accepted + progress.renamed));
  renderReviewMetric(bar, text.highlights, String(progress.annualHighlights));
  renderReviewMetric(bar, text.nextActions, String(progress.nextAction));
  renderReviewMetric(bar, text.ignored, String(progress.ignored));
}

function renderHeader(parent: HTMLElement, title: string): void {
  parent.createEl("h2", { cls: "annual-review-dashboard-title", text: title });
}

function renderInfoCard(parent: Element, label: string, value: string): void {
  const item = parent.createDiv({ cls: "annual-review-dashboard-info-card" });
  item.createEl("span", { text: label });
  item.createEl("strong", { text: value });
}

function renderReviewMetric(parent: HTMLElement, label: string, value: string): void {
  const item = parent.createDiv({ cls: "annual-review-dashboard-metric" });
  item.createEl("div", { text: label });
  item.createEl("strong", { text: value });
}
