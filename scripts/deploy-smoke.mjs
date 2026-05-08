#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_SMOKE_VAULT_PATH = join(repoRoot, "tests/fixtures/obsidian-smoke-vault");
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
