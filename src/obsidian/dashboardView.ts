import { ItemView, Setting, type WorkspaceLeaf } from "obsidian";
import { UI_TEXT } from "../core/language";
import { buildAnnualReviewSession } from "../core/reviewSession";
import type {
  ReviewAction,
  ReviewCandidate,
  ReviewSessionState,
} from "../core/reviewState";
import { buildReviewDetailModel } from "../core/reviewDetail";
import { reviewCandidateDisplayTitle } from "../core/reviewTitle";
import { joinFolderList } from "../core/settings";
import type {
  AnnualReviewSettings,
  ResolvedAnnualReviewLanguage,
  ReviewSession,
  YearAggregate,
} from "../core/types";
import { getReviewBoardActionState } from "./reviewActions";
import {
  getActionCandidateId,
  getNextReviewSelection,
  isPendingReviewQueueCandidate,
  isMergeTargetCandidate,
  isReviewBoardQueueCandidate,
} from "./reviewSelection";

export const VIEW_TYPE_ANNUAL_REVIEW = "annual-review-dashboard";

export interface AnnualReviewDashboardController {
  getLastAggregate(): YearAggregate | null;
  getLastReportPath(): string | null;
  getSettings(): AnnualReviewSettings;
  getGeneratorLanguage(): ResolvedAnnualReviewLanguage;
  getIndexStatus(): { fileCount: number; builtAt: string | null };
  getReviewSession(): ReviewSessionState | null;
  previewSession(
    session: ReviewSession,
    options?: { skipAiGeneration?: boolean },
  ): Promise<void>;
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
    void this.controller
      .previewSession(this.defaultPreviewSession(), { skipAiGeneration: true })
      .finally(() => {
        this.render();
      });
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
              await this.controller.previewSession(this.defaultPreviewSession(year));
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
            await this.controller.previewSession(this.defaultPreviewSession(year));
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
    const loading = container.createDiv({ cls: "annual-review-dashboard-loading" });
    loading.createEl("p", { cls: "annual-review-dashboard-empty", text: message });
    const progress = loading.createEl("progress", {
      cls: "annual-review-dashboard-loading-bar",
    });
    progress.removeAttribute("value");
  }

  private text(): (typeof UI_TEXT)[ResolvedAnnualReviewLanguage] {
    return UI_TEXT[this.controller.getGeneratorLanguage()];
  }

  private defaultPreviewSession(year = this.selectedYear): ReviewSession {
    return buildAnnualReviewSession(year, this.controller.getSettings());
  }

  private renderReviewBoard(
    container: HTMLElement,
    session: ReviewSessionState | null,
  ): void {
    const text = this.text();
    if (
      !session ||
      (session.candidates.length === 0 &&
        (session.localFallbackCandidates?.length ?? 0) === 0)
    ) {
      container.createEl("p", {
        cls: "annual-review-dashboard-empty",
        text: text.noReviewCandidates,
      });
      return;
    }

    const primaryCandidates = session.candidates;
    const degradedCandidates = session.localFallbackCandidates ?? [];
    const current =
      [...primaryCandidates, ...degradedCandidates].find(
        (candidate) =>
          candidate.id === this.selectedCandidateId &&
          (isReviewBoardQueueCandidate(candidate) ||
            degradedCandidates.some((item) => item.id === candidate.id)),
      ) ??
      firstReviewableCandidate(session.candidates) ??
      firstVisibleQueueCandidate(session.candidates) ??
      degradedCandidates[0];
    this.selectedCandidateId = current?.id ?? null;
    const currentIsPrimary = session.candidates.some(
      (candidate) => candidate.id === current?.id,
    );

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
        candidates: session.candidates.filter(isPendingReviewQueueCandidate),
      },
      {
        label: text.accepted,
        candidates: session.candidates.filter((candidate) =>
          ["accepted", "renamed"].includes(candidate.status),
        ),
      },
      {
        label: text.closed,
        candidates: session.candidates.filter((candidate) =>
          ["ignored", "merged"].includes(candidate.status),
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
          text: displayCandidateTitle(candidate),
        });
        row.createSpan({
          cls: "annual-review-board-queue-status",
          text: `${candidateStatusLabel(candidate, text)} · ${candidate.evidence.length}`,
        });
        row.onClickEvent(() => {
          this.selectedCandidateId = candidate.id;
          this.render();
        });
      }
    }

    if (degradedCandidates.length > 0) {
      const degraded = queue.createDiv({
        cls: "annual-review-board-queue-group annual-review-board-queue-group--degraded",
      });
      degraded.createEl("h4", {
        text: `${text.degradedReviewQueue} (${degradedCandidates.length})`,
      });
      degraded.createEl("p", {
        cls: "annual-review-board-degraded-note",
        text: text.degradedReviewQueueDescription,
      });
      for (const candidate of degradedCandidates) {
        const row = degraded.createEl("button");
        row.type = "button";
        row.createSpan({
          cls: "annual-review-board-queue-title",
          text: displayCandidateTitle(candidate),
        });
        row.createSpan({
          cls: "annual-review-board-queue-status",
          text: `${text.localSignals} · ${candidate.evidence.length}`,
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
    const detailModel = buildReviewDetailModel(
      current,
      this.controller.getGeneratorLanguage(),
    );
    const detailHeader = detail.createDiv({ cls: "annual-review-board-detail-header" });
    detailHeader.createEl("h4", { text: displayCandidateTitle(current) });
    detailHeader.createSpan({ text: candidateStatusLabel(current, text) });
    if (currentIsPrimary) {
      this.renderDecisionControls(detail, session, current);
    }

    renderDetailSection(detail, text.currentNoteSummary, (section) => {
      section.createEl("p", {
        cls: "annual-review-board-summary",
        text: detailModel.summary,
      });
    });

    renderDetailSection(detail, text.connectionExplanation, (section) => {
      section.createEl("p", {
        cls: "annual-review-board-summary",
        text: detailModel.connection,
      });
    });

    if (detailModel.localSignals.length > 0) {
      renderDetailSection(detail, text.localSignals, (section) => {
        const list = section.createEl("ul");
        for (const signal of detailModel.localSignals.slice(0, 6)) {
          list.createEl("li", { text: signal });
        }
      });
    }

    if (detailModel.uncertainty) {
      renderDetailSection(detail, text.uncertainty, (section) => {
        section.createEl("p", {
          cls: "annual-review-board-summary",
          text: detailModel.uncertainty,
        });
      });
    }

    renderDetailSection(detail, text.reviewCaution, (section) => {
      section.createEl("p", {
        cls: "annual-review-board-summary",
        text: detailModel.caution,
      });
    });

    if (detailModel.metadata.length > 0) {
      renderDetailSection(detail, text.essentialMetadata, (section) => {
        section.createEl("p", {
          cls: "annual-review-board-metadata",
          text: detailModel.metadata.join(" / "),
        });
      });
    }

    renderDetailSection(detail, text.selectedEvidence, (section) => {
      const evidenceList = section.createEl("ul", {
        cls: "annual-review-board-evidence",
      });
      for (const evidence of detailModel.evidence) {
        const item = evidenceList.createEl("li");
        const evidenceMain = item.createDiv({ cls: "annual-review-board-evidence-main" });
        const button = evidenceMain.createEl("button", {
          text: evidence.missing
            ? `${evidence.label} (${text.missingEvidence})`
            : evidence.label,
        });
        button.type = "button";
        button.onClickEvent(async () => {
          await this.controller.openSourceNote(current.id, evidence.id);
        });
        const note = evidence.excerpt ?? evidence.reason;
        if (note) {
          evidenceMain.createSpan({
            cls: "annual-review-board-evidence-reason",
            text: note,
          });
        }
        if (currentIsPrimary) {
          const comment = item.createDiv({
            cls: "annual-review-board-evidence-comment",
          });
          const textarea = comment.createEl("textarea");
          textarea.placeholder = text.evidenceComment;
          textarea.value = evidence.userComment ?? "";
          const save = comment.createEl("button", { text: text.saveComment });
          save.type = "button";
          save.onClickEvent(async () => {
            await this.controller.applyReviewAction({
              type: "comment-evidence",
              candidateId: current.id,
              evidenceId: evidence.id,
              comment: textarea.value,
              at: new Date().toISOString(),
            });
            this.selectedCandidateId = current.id;
            this.render();
          });
        }
      }
    });

    if (detailModel.linkedNotes.paths.length > 0) {
      renderDetailSection(detail, text.linkedNotes, (section) => {
        this.renderLinkedNotes(section, current, detailModel.linkedNotes.paths);
      });
    }
  }

  private renderLinkedNotes(
    parent: HTMLElement,
    candidate: ReviewCandidate,
    paths: string[],
  ): void {
    const cls =
      paths.length > 3
        ? "annual-review-board-linked-notes"
        : "annual-review-board-linked-notes is-inline";
    const container =
      paths.length > 3 ? parent.createEl("ul", { cls }) : parent.createEl("p", { cls });

    paths.forEach((path, index) => {
      const item = paths.length > 3 ? container.createEl("li") : container.createSpan();
      const evidence = candidate.evidence.find(
        (entry) => entry.sourcePath === path || entry.target === path,
      );
      if (evidence) {
        const button = item.createEl("button", { text: path });
        button.type = "button";
        button.onClickEvent(async () => {
          await this.controller.openSourceNote(candidate.id, evidence.id);
        });
      } else {
        item.createSpan({ text: path });
      }
      if (paths.length <= 3 && index < paths.length - 1) {
        item.createSpan({ text: ", " });
      }
    });
  }

  private renderDecisionControls(
    parent: HTMLElement,
    session: ReviewSessionState,
    candidate: ReviewCandidate,
  ): void {
    const text = this.text();
    const actionState = getReviewBoardActionState(candidate);
    const actionIds = new Set(actionState.actions);
    const actions = parent.createDiv({
      cls: `annual-review-board-actions annual-review-board-actions--${actionState.kind}`,
    });
    const runAction = async (action: ReviewAction) => {
      await this.controller.applyReviewAction(action);
      const actedCandidateId = getActionCandidateId(action);
      const nextSession = this.controller.getReviewSession();
      if (actedCandidateId && nextSession) {
        this.selectedCandidateId =
          action.type === "rename-topic"
            ? actedCandidateId
            : getNextReviewSelection(nextSession.candidates, actedCandidateId);
      }
      this.render();
    };
    const at = () => new Date().toISOString();

    const decision = new Setting(actions).setName(
      actionPanelName(actionState.kind, text),
    );

    if (actionIds.has("accept")) {
      decision.addButton((button) => {
        button
          .setButtonText(text.accept)
          .setCta()
          .onClick(async () => {
            await runAction({ type: "accept", candidateId: candidate.id, at: at() });
          });
      });
    }

    if (actionIds.has("ignore")) {
      decision.addButton((button) => {
        button.setButtonText(text.ignore).onClick(async () => {
          await runAction({ type: "ignore", candidateId: candidate.id, at: at() });
        });
      });
    }

    if (actionIds.has("openSourceNote")) {
      decision.addButton((button) => {
        button.setButtonText(text.openSourceNote).onClick(async () => {
          await this.controller.openSourceNote(candidate.id);
        });
      });
    }

    if (actionIds.has("renameTopic")) {
      let nextTitle = displayCandidateTitle(candidate);
      new Setting(actions)
        .setName(text.renameTitle)
        .setClass("annual-review-board-rename")
        .addText((input) => {
          input
            .setPlaceholder(text.renamePrompt)
            .setValue(nextTitle)
            .onChange((value) => {
              nextTitle = value;
            });
        })
        .addButton((button) => {
          button.setButtonText(text.saveRename).onClick(async () => {
            if (!nextTitle.trim()) {
              return;
            }
            await runAction({
              type: "rename-topic",
              candidateId: candidate.id,
              title: nextTitle.trim(),
              at: at(),
            });
          });
        });
    }

    if (actionIds.has("mergeTopic")) {
      const targets = session.candidates.filter(
        (item) => item.id !== candidate.id && isMergeTargetCandidate(item),
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

function actionPanelName(
  kind: ReturnType<typeof getReviewBoardActionState>["kind"],
  text: (typeof UI_TEXT)[ResolvedAnnualReviewLanguage],
): string {
  switch (kind) {
    case "pending":
      return text.pendingDecisionActions;
    case "accepted":
      return text.acceptedDecisionActions;
    case "closed":
      return text.closedDecisionActions;
  }
}

function firstReviewableCandidate(
  candidates: ReviewCandidate[],
): ReviewCandidate | undefined {
  return candidates.find(isPendingReviewQueueCandidate);
}

function firstVisibleQueueCandidate(
  candidates: ReviewCandidate[],
): ReviewCandidate | undefined {
  return candidates.find(isReviewBoardQueueCandidate);
}

function displayCandidateTitle(candidate: ReviewCandidate): string {
  return reviewCandidateDisplayTitle(candidate.title, candidate.userTitle);
}

function candidateStatusLabel(
  candidate: ReviewCandidate,
  text: (typeof UI_TEXT)[ResolvedAnnualReviewLanguage],
): string {
  switch (candidate.status) {
    case "candidate":
      return text.toReview;
    case "accepted":
    case "renamed":
      return text.accepted;
    case "ignored":
      return text.ignored;
    case "merged":
      return text.mergeTopic;
  }
}

function renderDetailSection(
  parent: HTMLElement,
  title: string,
  render: (section: HTMLElement) => void,
): void {
  const section = parent.createDiv({ cls: "annual-review-board-detail-section" });
  section.createEl("h5", { text: title });
  render(section);
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
  renderReviewMetric(bar, text.mergeTopic, String(progress.merged));
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
