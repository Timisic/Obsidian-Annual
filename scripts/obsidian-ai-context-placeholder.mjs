#!/usr/bin/env node

const contract = {
  status: "placeholder",
  purpose: "Reserve the future handoff point for Obsidian skill or CLI enrichment before AI report generation.",
  currentBehavior: "No vault data is read and no network request is made by this script.",
  expectedInput: {
    year: "number",
    aggregatePath: "path to a generated annual aggregate JSON export when that export exists",
    vaultRoot: "Obsidian vault root, supplied by the plugin or a trusted local CLI",
  },
  expectedOutput: {
    contextMarkdown: "optional provider-ready context with evidence links",
    redactions: "list of redaction rules applied before provider calls",
    warnings: "privacy or coverage warnings to display before user confirmation",
  },
  todos: [
    "Define whether this should call an Obsidian skill, an Obsidian CLI command, or a local adapter.",
    "Keep ChatGPT compatible with the local Codex CLI/auth path when no OpenAI API key is configured.",
    "Add a data preview and explicit confirmation step before sending context to ChatGPT or local Codex.",
    "Support folder, tag, link, and note-body redaction before any external provider receives data.",
  ],
};

console.log(JSON.stringify(contract, null, 2));
