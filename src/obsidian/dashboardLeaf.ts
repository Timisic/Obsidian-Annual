export interface AnnualReviewDashboardWorkspace<TLeaf> {
  getLeavesOfType(viewType: string): TLeaf[];
  getLeaf(newLeaf?: boolean): TLeaf | null;
}

export interface AnnualReviewDashboardLeafSelection<TLeaf> {
  leaf: TLeaf;
  isExistingView: boolean;
}

export function getAnnualReviewDashboardLeaf<TLeaf>(
  workspace: AnnualReviewDashboardWorkspace<TLeaf>,
  viewType: string,
): AnnualReviewDashboardLeafSelection<TLeaf> | null {
  const [existingLeaf] = workspace.getLeavesOfType(viewType);
  if (existingLeaf) {
    return { leaf: existingLeaf, isExistingView: true };
  }

  const leaf = workspace.getLeaf(false);
  return leaf ? { leaf, isExistingView: false } : null;
}
