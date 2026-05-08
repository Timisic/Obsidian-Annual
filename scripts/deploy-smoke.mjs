#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const DEFAULT_SMOKE_VAULT_PATH =
  "/Users/hong/code/obsidian-annual-workspaces/install-smoke-vault";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const smokeVaultPath = process.env.SMOKE_VAULT_PATH ?? DEFAULT_SMOKE_VAULT_PATH;

execFileSync(
  "node",
  [
    join(repoRoot, "scripts/deploy-plugin.mjs"),
    "--target",
    smokeVaultPath,
    "--smoke",
    ...process.argv.slice(2),
  ],
  { cwd: repoRoot, stdio: "inherit" },
);
