# Data Methodology

Annual Review reports combine two kinds of local evidence:

- **Current vault inference**: statistics inferred from the Markdown files that
  exist in the vault at generation time, using file `ctime` and `mtime`.
- **Historical snapshot statistics**: word-count changes computed by comparing
  saved vault snapshots captured by previous Annual Review rebuild/run actions.

The report labels which source was used so growth language does not overstate
what the vault can prove.

## Snapshot File

The plugin writes `annual-review-snapshots.json` in the plugin-owned Obsidian
data directory, normally:

```text
.obsidian/plugins/<plugin-id>/annual-review-snapshots.json
```

The file is not a source note. It is JSON data owned by the plugin and is
excluded from Markdown scanning by file type and by the default `.obsidian`
exclude folder.

The file has a top-level schema version and a list of snapshots:

```json
{
  "schemaVersion": 1,
  "snapshots": [
    {
      "schemaVersion": 1,
      "capturedAt": "2026-05-08T00:00:00.000Z",
      "scope": {
        "reportFolder": "Annual Reviews",
        "includeFolders": [],
        "excludeFolders": [".obsidian", "Archive", "Attachments", "Templates"],
        "excludePatterns": [],
        "privacyMode": "standard"
      },
      "noteCount": 42,
      "totalWords": 12345,
      "notes": [
        {
          "path": "Projects/Research.md",
          "wordCount": 1200,
          "modifiedTime": 1770000000000,
          "folder": "Projects",
          "tags": ["project", "research"]
        }
      ]
    }
  ]
}
```

Each note entry records only report inputs needed for aggregate growth:
path, word count, modified time, folder, and tags.

## Capture Timing

Snapshots are captured when Annual Review reads the vault for the main workflow:

- `Annual Review: Rebuild index` records a snapshot after scanning the allowed
  Markdown files.
- `Annual Review: Generate report` records a snapshot for the run and compares
  it with earlier comparable snapshots before rendering the report.

No source note frontmatter is modified.

## Scope Rules

Snapshot capture uses the same scan rules as the annual report:

- The report folder is excluded so generated reports and chart assets do not
  become source input.
- `includeFolders` restricts the scan when set.
- `excludeFolders` removes folders such as `.obsidian`, `Templates`, `Archive`,
  and `Attachments` by default.
- `excludePatterns` removes paths containing user-defined patterns.
- Non-Markdown files are not scanned.

Every snapshot stores this scope. Historical comparison is available only when
the current snapshot and baseline snapshot have the same normalized scope. If
the scope differs, the report disables historical delta output and labels the
result as current-vault inference with a scope-mismatch note.

## Growth Semantics

When comparable snapshots exist, Annual Review computes real vault word-count
delta as:

```text
current snapshot totalWords - baseline snapshot totalWords
```

It also records added, removed, and changed note paths. A note is considered
changed only when its word count changes. A batch `mtime` update without word
count changes does not create word growth.

When no comparable snapshot exists, the report still shows current annual
activity inferred from `ctime` and `mtime`, but labels it as current vault
inference. That fallback is useful for first-run reports, but it is not a
precise historical word-count delta.

## Imported Old Notes

Imported old notes can look new or newly modified when only current vault file
timestamps are available. With snapshots, imported notes count as vault growth
only when they appear after the baseline snapshot, regardless of whether their
original content was written before the report year.

## Batch Modifications

Sync tools, formatter passes, or metadata tools can touch many files and move
their `mtime` into the same period. Current-vault inference may still show those
files as modified activity. Historical snapshot statistics do not count them as
word growth unless the saved word counts changed.

## Excluded Directories

Excluded folders and excluded patterns are removed before snapshot capture and
before report aggregation. Excluded notes therefore do not contribute to:

- snapshot `noteCount`;
- snapshot `totalWords`;
- historical word delta;
- report candidate, topic, tag, link, or activity statistics.

Changing include/exclude settings changes the scope. Annual Review will not
compare snapshots across incompatible scopes because that would make deltas look
more precise than they are.
