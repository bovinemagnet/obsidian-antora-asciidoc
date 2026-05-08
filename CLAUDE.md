# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Obsidian community plugin (`obsidian-antora-asciidoc`, displayed as **Antora AsciiDoc**) that turns Obsidian into a first-class authoring environment for Antora-based AsciiDoc documentation projects. Desktop only (`isDesktopOnly: true` in `manifest.json`).

## Common commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Build (esbuild → `main.js`) | `npm run build` |
| Watch / dev build | `npm run dev` |
| Lint | `npm run lint` |
| Lint a single file | `npx eslint src/path/to/File.ts` |

There is no test runner configured yet (no `npm test` script, no test files). When adding tests, propose the framework choice rather than assuming one is in place.

Node 20+ / npm 10+ are required (see `engines` in `package.json`).

## Build pipeline

`esbuild.config.mjs` bundles `main.ts` (which just re-exports `src/main.ts`) into a single CommonJS `main.js` at the repo root. Externals: `obsidian`, `electron`, `@codemirror/*`, `child_process`, `util` and their `node:` variants — these come from the Obsidian runtime and must not be bundled. Production builds (`--production`) drop sourcemaps and minify; dev builds emit inline sourcemaps.

For manual install in a vault, copy `main.js` + `manifest.json` into `<vault>/.obsidian/plugins/obsidian-antora-asciidoc/`.

## Architecture

The plugin's entry point (`src/main.ts`, class `AntoraAsciidocPlugin`) wires together six layered subsystems. Understanding the data flow between them is the key to navigating the codebase:

```
Vault files ──► AntoraWorkspaceScanner ──► AntoraComponentIndex
                                                  │
                                                  ▼
                       ┌──── XrefValidator ◄──┤
AsciiDocParser ──► symbols ──► IncludeValidator ──► Diagnostic[]
                       └────► attribute checks ◄┘                    │
                                                                     ▼
                                                            DiagnosticsService
                                                                     │
                                       ┌─────────────────────────────┤
                                       ▼                             ▼
                              DiagnosticsView (UI)          CodeMirror DiagnosticsExtension
```

### Index layer (`src/antora/`)
- `AntoraWorkspaceScanner` walks `vault.getFiles()`, locates each `antora.yml`, parses `name`/`version` with a single-line regex (no full YAML parser), then classifies sibling files under `modules/<module>/{pages,partials,examples,assets/images}/`.
- `AntoraComponentIndex` is the in-memory model: `component → version → module → {pages, partials, examples, images}`. Pages are also keyed three ways (`page`, `module:page`, `component:module:page`) for fast xref resolution via `resolvePage()`.
- `AntoraPathResolver` parses raw xref targets (`component:module:page#anchor`) into structured form. The 1/2/3-segment branching here is load-bearing — keep it in sync with how `AntoraComponentIndex` keys its `pagesByPath` map.

### Parsing layer (`src/asciidoc/`)
- `AsciiDocParser.parseSymbols()` extracts xrefs, includes, and attributes via three regexes. It is intentionally **not** a full AsciiDoc parser; it returns `{target, line, column}` tuples consumed by validators and editor extensions.

### Diagnostics layer (`src/diagnostics/`)
- `DiagnosticsService` is the orchestrator. `validateFile()` runs xref + include + attribute checks; `validateWorkspace()` filters by `settings.includeFileExtensions` and aggregates.
- `BUILTIN_ATTRIBUTES` is a tiny allowlist (`docname`, `docfile`, `imagesdir`, `partialsdir`). Extending attribute resolution properly is on the roadmap — additions here are best-effort.
- `XrefValidator` and `IncludeValidator` produce `Diagnostic` records (`{message, filePath, line, column, severity}`) consumed by both the `DiagnosticsView` panel and the CodeMirror `DiagnosticsExtension`.

### Editor layer (`src/editor/`)
CodeMirror 6 extensions registered through `registerEditorExtension`:
- `AsciiDocLanguageSupport` — minimal tokenization (headings/comments/xrefs)
- `XrefAutocomplete` — pulls candidates from `AntoraComponentIndex.listPageTargets()`
- `XrefHoverProvider`, `XrefNavigation` — go-to-definition style behaviour for xrefs
- `DiagnosticsExtension` — surfaces validator output inline

Editor extensions read **live** from the shared `index` instance. After mutating the index, callers must trigger a redraw or reindex; there is no pub/sub yet.

### Build integration (`src/build/`)
- `AntoraBuildRunner` shells out to the configured Antora binary via Node's child-process API (5 MB stdout buffer). Default command is `${antoraExecutablePath} ${antoraPlaybookPath}` from settings, overridable via `buildCommandOverride`. This Node dependency is why the plugin is desktop-only.
- `BuildOutputParser` is a stub for future diagnostics-from-build-output wiring.

### Views (`src/views/`)
Two `ItemView` panels registered against `ANTORA_EXPLORER_VIEW_TYPE` and `DIAGNOSTICS_VIEW_TYPE`. Both are detached in `onunload`.

### Settings (`src/settings/`)
`PluginSettings` (with `DEFAULT_SETTINGS`) covers diagnostics/autocomplete toggles, antora binary + playbook paths, build command override, file-extension allowlist, and ignore paths. Loaded via `loadData()` / `saveData()` in the standard Obsidian plugin pattern.

## Editing conventions

- `.adoc` and `.asciidoc` are registered as `markdown` extensions in Obsidian (`registerExtensions(['adoc','asciidoc'], 'markdown')`) so the editor opens them at all. The CM6 extensions then layer AsciiDoc-aware behaviour on top.
- TypeScript is `strict` (see `tsconfig.json`). ESLint enforces `@typescript-eslint/no-unused-vars` with `^_` exceptions.
- Use British spelling in docs and user-visible strings.

## Documentation site

The PRD lives in `docs/prd/initial-prd.md`. There is no Antora documentation site **for this plugin** yet — the `src/docs/` Antora structure referenced in global instructions does not currently exist in this repo. Treat the plugin itself as the subject; documentation work targets `README.md` and `docs/`.
