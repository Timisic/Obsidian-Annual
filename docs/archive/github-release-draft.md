# Annual Review 0.1.0

## Summary

First public beta of Annual Review, a desktop-only Obsidian plugin for creating
editable annual review notes from local vault activity, review decisions, and
source-note evidence.

## Highlights

- Scans local Markdown notes and Obsidian metadata inside the active vault.
- Builds Review Board Theme Hypotheses from evidence notes and local weak
  signals.
- Provides Review Board commands for accepting, renaming, merging, ignoring, and
  opening source notes for Theme Hypotheses.
- Generates protected Markdown annual reports under `Annual Reviews/`.
- Keeps AI optional; default settings do not make network requests or send
  telemetry.

## Install Manually

Download the release assets and copy them into:

```text
<Vault>/.obsidian/plugins/annual-review/
```

Required assets:

- `manifest.json`
- `main.js`
- `styles.css`

Restart Obsidian or reload community plugins, then enable **Annual Review** from
`Settings -> Community plugins`.

## Validation

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm run release:check`
