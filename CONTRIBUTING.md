# Contributing

Thanks for considering a contribution. The full development guide lives in [`src/docs/modules/ROOT/pages/development.adoc`](src/docs/modules/ROOT/pages/development.adoc) — this file is the short version.

## Getting started

```bash
git clone https://github.com/bovinemagnet/obsidian-antora-asciidoc.git
cd obsidian-antora-asciidoc
npm install
```

Node.js 20+ and npm 10+ required.

## Workflow

1. Branch off `main`
2. Make your changes
3. Run the full check locally:

    ```bash
    npm run lint
    npx tsc --noEmit
    npm test
    npm run build
    ```

4. Open a PR. The CI workflow re-runs the same checks.

## Code organisation

| Layer | Lives in | Depends on |
|---|---|---|
| Plugin entry | `src/main.ts` | everything below |
| Editor extensions | `src/editor/` | index, resolvers |
| Views | `src/views/` | services |
| Refactor | `src/refactor/` | index, parser, FileSource |
| Diagnostics | `src/diagnostics/` | index, parser, FileSource |
| Build runners | `src/build/` | output parsers |
| Antora model | `src/antora/` | FileSource |
| IO | `src/io/` | (interface) |

The rule of thumb: only `src/main.ts` and `src/views/` import from `obsidian`. Everything else stays testable with the `InMemoryFileSource`.

## Tests

* Use `vitest`. Stubs for Obsidian types live in `tests/stubs/obsidian.ts`.
* Pure modules should have direct tests. CodeMirror-bound editor extensions are not unit-tested.
* Aim to keep the suite under 1 second total — current run is around 700 ms for 120+ tests.

## Style

* TypeScript `strict`
* British spelling in user-visible strings
* No comments explaining *what* the code does — let names + types do that. Comments are only for non-obvious *why*.
* No emoji unless explicitly requested

## Documentation

* User-facing changes get a corresponding update in `src/docs/`
* Settings additions get an entry in `src/docs/modules/ROOT/pages/settings.adoc`
* New commands get an entry in `src/docs/modules/ROOT/pages/commands.adoc`

## Releasing

Maintainers only:

1. `npm version <new>` — propagates the version into `manifest.json` and `versions.json`
2. `git push --follow-tags`
3. The `Release` workflow builds and publishes to GitHub Releases automatically

## Questions

Open an issue. PRs without prior discussion are welcome for small fixes; for larger changes please open an issue first to align on direction.
