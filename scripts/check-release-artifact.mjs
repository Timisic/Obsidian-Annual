#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const artifactDir = resolve(process.argv[2] ?? "dist/annual-review");
const requiredAssets = ["manifest.json", "main.js", "styles.css"];

const missing = requiredAssets.filter((asset) => {
  return !existsSync(join(artifactDir, asset));
});

if (missing.length > 0) {
  throw new Error(`Release artifact is missing required asset(s): ${missing.join(", ")}`);
}

const manifest = JSON.parse(readFileSync(join(artifactDir, "manifest.json"), "utf8"));

if (manifest.isDesktopOnly !== true) {
  throw new Error("Release manifest must set isDesktopOnly to true.");
}

if (!manifest.author || !manifest.description || !manifest.minAppVersion) {
  throw new Error(
    "Release manifest must include author, description, and minAppVersion.",
  );
}

console.log(`Release artifact ready: ${artifactDir} (${requiredAssets.join(", ")})`);
