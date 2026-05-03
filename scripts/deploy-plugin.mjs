#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join, resolve } from "node:path";

const DEFAULT_TARGET = "/Users/hong/code/obsidian-annual-workspaces/install-smoke-vault/.obsidian";
const DEFAULT_ARTIFACT_DIR = "dist/annual-review";
const OPTIONAL_FILES = ["styles.css", "versions.json"];

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const manifestPath = join(repoRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pluginId = String(args.pluginId ?? manifest.id);
  const artifactDir = resolve(repoRoot, String(args.artifactDir ?? DEFAULT_ARTIFACT_DIR));

  if (!args.skipBuild) {
    run("npm", ["run", "build"], repoRoot);
  }

  writeArtifact(repoRoot, artifactDir);
  console.log(`Artifact ready: ${artifactDir}`);

  if (args.noDeploy) return;

  const obsidianDir = resolveObsidianDir(String(args.target ?? DEFAULT_TARGET));
  const pluginsDir = join(obsidianDir, "plugins");
  const pluginDir = join(pluginsDir, pluginId);
  mkdirSync(pluginDir, { recursive: true });

  deployArtifact(artifactDir, pluginDir);

  if (!args.noEnable) {
    enableCommunityPlugin(obsidianDir, pluginId);
  }

  console.log(`Deployed ${pluginId} to: ${pluginDir}`);
  console.log("Settings/data.json was preserved if it already existed.");
}

function run(command, argv, cwd) {
  console.log(`$ ${command} ${argv.join(" ")}`);
  execFileSync(command, argv, { cwd, stdio: "inherit" });
}

function writeArtifact(repoRoot, artifactDir) {
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });

  copyRequired(join(repoRoot, "main.js"), join(artifactDir, "main.js"));
  copyRequired(join(repoRoot, "manifest.json"), join(artifactDir, "manifest.json"));

  for (const file of OPTIONAL_FILES) {
    const source = join(repoRoot, file);
    if (existsSync(source)) {
      copyFileSync(source, join(artifactDir, file));
    }
  }
}

function copyRequired(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`Required build output is missing: ${source}`);
  }
  copyFileSync(source, destination);
}

function deployArtifact(artifactDir, pluginDir) {
  for (const entry of readdirSync(artifactDir)) {
    const source = join(artifactDir, entry);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(pluginDir, entry));
  }
}

function enableCommunityPlugin(obsidianDir, pluginId) {
  const path = join(obsidianDir, "community-plugins.json");
  const plugins = readJsonArray(path);
  if (!plugins.includes(pluginId)) {
    plugins.push(pluginId);
    writeFileSync(path, `${JSON.stringify(plugins, null, 2)}\n`, "utf8");
  }
}

function readJsonArray(path) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON array`);
  }
  return parsed;
}

function resolveObsidianDir(input) {
  const target = resolve(input);
  if (basename(target) === ".obsidian") return target;
  const nested = join(target, ".obsidian");
  if (existsSync(nested)) return nested;
  return target;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/deploy-plugin.mjs [options]

Builds the current repository, writes a copyable plugin artifact, and deploys it
into an Obsidian vault's .obsidian/plugins/<plugin-id> directory.

Options:
  --target <path>         Vault root or .obsidian path.
                          Default: ${DEFAULT_TARGET}
  --artifact-dir <path>   Directory to generate for manual copy/paste.
                          Default: ${DEFAULT_ARTIFACT_DIR}
  --plugin-id <id>        Override manifest.json id.
  --skip-build            Reuse the existing main.js instead of running npm run build.
  --no-deploy             Only generate the artifact directory; do not copy to a vault.
  --no-enable             Do not update community-plugins.json.
  -h, --help              Show this help.

Examples:
  npm run deploy:smoke
  npm run deploy:plugin -- --target /path/to/Vault/.obsidian
  npm run deploy:plugin -- --no-deploy
`);
}
