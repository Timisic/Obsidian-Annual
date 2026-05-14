# Iteration 01 Failure Analysis

Independent review failed the baseline plugin arm.

Top failures:

1. Evidence Package recall gap: 42 notes in plugin Evidence Package vs 47 source-scope notes.
2. Missing important in-scope notes included same-day Chinese filenames and `Projects/Research.md`.
3. Theme/report compression loss: plugin did not surface industry internship, lab limitations, and expression/standards as strongly as the direct prompt.
4. State mismatch: plugin report reused persisted annual Review Board state for a Jan-May custom benchmark.

Root cause found locally for failure 1: `evidenceNoteId(path)` used `slug(path)` that stripped non-ASCII characters. Multiple Chinese notes on the same date collapsed to the same id, so `selectDiverseEvidenceNotes` treated distinct notes as duplicates and omitted them.
