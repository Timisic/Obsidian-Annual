# Prompt-vs-Plugin Benchmark

This benchmark tests whether Obsidian Time Range Review adds product value beyond a strong prompt plus a large model reading the allowed vault content.

It intentionally gives the prompt baseline a fair, strong setup. Karpathy's LLM Wiki direction shows that a model can maintain a persistent, interlinked Markdown knowledge base from large source sets. The plugin must accept that raw summarization, theme extraction, and wiki-style linking are no longer enough on their own.

## Question

Can the plugin produce a more trustworthy review workflow than this baseline?

```text
large model + complete prompt + all allowed Markdown notes + generated report references
```

The plugin passes only if it adds value in missed-note recovery, evidence accuracy, theme stability, user reviewability, Obsidian navigation, reproducibility, and privacy/context control. If it only competes on generated prose quality, the product direction has failed.

## Fixed Inputs

Use the repo-local validation vault:

```text
tests/fixtures/obsidian-smoke-vault
```

Primary fixture artifacts:

- Source notes: all Markdown files under `tests/fixtures/obsidian-smoke-vault`, excluding `.obsidian`, `Templates`, `Archive`, `Attachments`, and the report folder when the test case requires source-only input.
- Existing generated report: `tests/fixtures/obsidian-smoke-vault/Annual Reviews/2026 Annual Review.md`.
- Assets and structured outputs: `Annual Reviews/2026 Annual Review Assets/*.json` and `*.svg` may be used only when the tested method explicitly supports non-note generated artifacts.
- Time range: `2026-01-01` to `2026-05-10`, matching the current fixture report period.
- Review target: recover the important themes, representative evidence notes, hidden cross-note relationships, uncertain areas, and a report draft.

Keep the same vault snapshot for both arms of the benchmark. Do not change notes between runs.

## What The Model Can Ingest

The prompt baseline is allowed to consume more than a naive chat summary:

| Input category                      | Prompt baseline can use it?     | Notes                                                                                                                 |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Markdown note bodies                | Yes                             | This includes daily notes, clippings, work notes, research notes, and existing review notes within the allowed scope. |
| Frontmatter and inline metadata     | Yes                             | Dates, tags, topics, status fields, source URLs, and aliases can all be read as text.                                 |
| Wikilinks and Markdown links        | Yes                             | The model can infer link neighborhoods and repeated references when the whole file set is provided.                   |
| Folder paths and filenames          | Yes                             | Date and topic signals in paths are part of the textual corpus.                                                       |
| Existing generated annual report    | Yes, in a separate run variant  | Useful for testing whether the prompt can improve an already compiled report.                                         |
| Generated JSON assets               | Yes, if explicitly attached     | Treat as structured hints, not as plugin-only advantage.                                                              |
| SVG chart text                      | Partial                         | Text labels may be readable, but visual interpretation should not be assumed unless the model/tooling supports it.    |
| Binary attachments and PDFs         | No by default                   | Include only if the test runner extracts them to text first and records that extraction.                              |
| Obsidian app state                  | No                              | Chat input does not preserve Review Board state, candidate decisions, or UI interactions.                             |
| Plugin snapshots and decision state | No for baseline, yes for plugin | This is part of the product differentiation being tested.                                                             |

This framing prevents the plugin from claiming victory merely because the prompt baseline was underfed.

## Benchmark prompt

```text
You are a rigorous research assistant helping me review an Obsidian vault.

Read all provided Markdown notes and analyze the period:
- Start date: {startDate}
- End date: {endDate}
- Vault scope: {includedScope}
- Excluded folders: {excludedFolders}

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

Use this prompt unchanged for the direct-prompt arm. Only fill the placeholders and attach the fixed input set.

## Procedure

1. Freeze the test vault.
2. Run the direct-prompt arm with the benchmark prompt and the fixed input set.
3. Run the plugin arm on the same vault and date range.
4. In the plugin arm, use the expected product loop:
   - rebuild or scan the allowed vault scope,
   - compile evidence candidates,
   - generate theme hypotheses from the evidence package when AI is enabled,
   - review at least the top 5 hypotheses in the Review Board,
   - accept, rename, merge, or ignore candidates as needed,
   - open source notes from the UI for spot checks,
   - generate the final Markdown report.
5. Save both outputs as benchmark artifacts in a dated run folder outside the fixture vault, for example:

```text
benchmark-runs/2026-05-10-prompt-vs-plugin/
```

6. Fill the comparison table and record the final verdict.

## Comparison metrics

| Metric                       | Direct prompt evidence                                                          | Plugin evidence                                                                                                | Passing expectation                                                             |
| ---------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Missed important notes       | Count important fixture notes not surfaced by the prompt.                       | Count rediscovered evidence notes surfaced before report writing.                                              | Plugin should miss fewer important older or hidden notes.                       |
| Evidence accuracy            | Sample cited notes and check whether each citation actually supports the claim. | Sample candidate evidence cards and generated report links.                                                    | Plugin should have fewer unsupported citations.                                 |
| Evidence compilation         | Prompt lists citations from its own context.                                    | Plugin builds an explicit evidence package before generation.                                                  | Plugin must expose source note paths, snippets or summaries, and reason fields. |
| Theme stability              | Rerun the same prompt and compare whether theme identities drift.               | Rebuild or regenerate from the same scope and compare candidate/decision stability.                            | Plugin should make theme drift visible and bounded by recorded evidence/state.  |
| User reviewability           | Reviewer must search, ask follow-ups, or edit the prompt manually.              | Review Board shows candidates, evidence, uncertainty, and direct decisions.                                    | Plugin should make common review decisions visible without prompt editing.      |
| Obsidian navigation          | Requires manual path lookup.                                                    | Uses Obsidian links or commands to open source notes.                                                          | Plugin must support direct source-note jumps.                                   |
| Privacy and context control  | Depends on what the user attaches to the model.                                 | Include/exclude folders, report folder exclusion, snippets, and provider or local CLI boundaries are explicit. | Plugin must make the sent or scanned scope inspectable.                         |
| Regeneration consistency     | Rerun may drift unless all context and prompt are archived.                     | Snapshot, scope, evidence package, decisions, and generated report sections can be recorded.                   | Plugin should make the run auditable and repeatable.                            |
| User-authored content safety | Prompt can rewrite the whole report unless instructed.                          | Report generation preserves user-authored blocks.                                                              | Plugin must not overwrite manual content during regeneration.                   |
| Long-term Obsidian artifact  | Chat output must be copied back manually.                                       | Markdown report and review state live in the vault/plugin data.                                                | Plugin should leave durable local artifacts.                                    |
| Prose quality                | Strong models may be excellent.                                                 | AI-assisted report may be excellent.                                                                           | Prose quality alone is not a winning metric.                                    |

## Success criteria

The benchmark is successful for the product direction if the plugin demonstrates all of the following:

- Missed-note recovery: important older or hidden notes are surfaced as reviewable evidence before final prose is generated.
- Evidence accuracy: each accepted theme can be traced to concrete source notes and evidence summaries before final prose is generated.
- State: user decisions survive rebuild and regenerate operations.
- Theme stability: reruns over the same range expose candidate drift and preserve user decisions.
- User reviewability: a reviewer can accept, rename, merge, ignore, and inspect candidates without rewriting the prompt.
- Obsidian jumps: source notes can be opened directly from review artifacts.
- Regeneration consistency: the benchmark records vault scope, date range, snapshot or run metadata, prompt version, plugin version, and generated artifacts.
- Privacy-scope control: the plugin clearly shows what folders and snippets are scanned or sent to an AI provider.
- Report safety: regenerating the report preserves user-authored Markdown outside managed blocks.
- Comparable or better review usefulness: the plugin matches the direct prompt on important theme discovery while making verification and decision tracking easier.

## Product-direction failure

Mark the direction as failed if the plugin's only advantage is that its final generated report reads as well as, or slightly better than, the direct prompt output.

Specific failure signals:

- The prompt baseline finds the same themes and evidence with similar effort.
- The plugin cannot show why a theme was recommended before report generation.
- Review decisions disappear after rebuild or regeneration.
- Source-note verification still requires manual search.
- The plugin cannot clearly state or enforce the privacy scope sent to AI.
- Regeneration overwrites user-authored content.
- The benchmark conclusion depends on subjective prose taste instead of workflow evidence.

If these occur, the product should pivot away from competing as a report generator and back toward a narrower evidence-review workflow or another differentiated problem.

## Result Template

```markdown
# Prompt-vs-Plugin Benchmark Result

- Date:
- Repo commit:
- Plugin version:
- Vault snapshot:
- Date range:
- Prompt model:
- Plugin AI provider/model:
- Included folders:
- Excluded folders:

## Verdict

- Pass / Fail / Inconclusive:
- Reason:

## Metric Table

| Metric | Direct prompt | Plugin | Winner | Notes |
| ------ | ------------- | ------ | ------ | ----- |

## Evidence Samples

| Claim | Direct prompt evidence | Plugin evidence | Reviewer judgment |
| ----- | ---------------------- | --------------- | ----------------- |

## Failure Signals Checked

- [ ] Only prose quality difference
- [ ] Unsupported citations
- [ ] Lost review state
- [ ] Manual-only source-note verification
- [ ] Unclear AI privacy scope
- [ ] User-authored report content overwritten
```
