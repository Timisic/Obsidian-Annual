# Filled Benchmark Prompt

```text
You are a rigorous research assistant helping me review an Obsidian vault.

Read all provided Markdown notes and analyze the period:
- Start date: 2026-01-01
- End date: 2026-05-10
- Vault scope: All source Markdown files under tests/fixtures/obsidian-smoke-vault excluding .obsidian, Templates, Archive, Attachments, and Annual Reviews
- Excluded folders: .obsidian, Templates, Archive, Attachments, Annual Reviews

Goal:
Find recurring, connected, or easily missed themes in this period. Do not only count tags. Prefer cross-note, cross-folder, and cross-time relationships. Treat filenames, folder paths, frontmatter, wikilinks, backlinks visible in the text, source URLs, and repeated concepts as evidence.

Required discipline:
- Every theme must cite source notes.
- Separate observed facts from inference.
- Mark low-confidence themes when evidence is thin.
- List evidence that contradicts or weakens a theme.
- Identify key old notes that became newly relevant during the period.
- Identify notes or relationships that need manual review in Obsidian.
- Do not invent unavailable Obsidian state, backlinks, or user decisions.

Output:
1. 3-7 theme hypotheses.
2. One-sentence explanation for each theme.
3. Representative evidence notes for each theme.
4. How the evidence notes connect to each other.
5. Recovered old or hidden notes that matter again.
6. Uncertainties, possible omissions, and manual review targets.
7. A concise review report draft.
8. A machine-readable evidence table with columns:
   theme_id, theme_title, note_path, evidence_quote_or_summary, evidence_type, confidence, needs_manual_review.
```
