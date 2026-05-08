export const COMMAND_IDS = {
  generate: "generate-annual-review",
  generateSmoke2026: "generate-annual-review-2026",
  openDashboard: "open-annual-review-dashboard",
  rebuildIndex: "rebuild-annual-review-index",
} as const;

export const COMMAND_NAMES = {
  generate: "Generate report",
  generateSmoke2026: "Smoke: Generate 2026 report",
  openDashboard: "Open Review Board",
  rebuildIndex: "Rebuild index",
} as const;

export const COMMAND_SURFACE = [
  { id: COMMAND_IDS.generate, name: COMMAND_NAMES.generate },
  { id: COMMAND_IDS.openDashboard, name: COMMAND_NAMES.openDashboard },
  { id: COMMAND_IDS.rebuildIndex, name: COMMAND_NAMES.rebuildIndex },
] as const;
