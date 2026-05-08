# Antora AsciiDoc for Obsidian

`obsidian-antora-asciidoc` turns Obsidian into a first-class authoring environment for Antora-based AsciiDoc documentation projects.

## Highlights

- **Antora-aware indexing** — detects components from `antora.yml`, parses `nav.adoc` trees, follows `playbook.yml` content sources (including local checkouts outside the vault)
- **AsciiDoc editor** — autocomplete for xrefs, anchors, attributes, images, includes, block macros, and block attributes; hover previews for xrefs, attributes, and images; section folding; ctrl-click navigation
- **Live preview** — asciidoctor.js-backed render with Antora resource-ID resolution, descriptor-scoped attributes, in-house `[tabs]` support, and Mermaid via Obsidian's renderer
- **Diagnostics** — broken xrefs, missing anchors, unresolved includes, unresolved attributes; conditional-block-aware so `ifdef::` regions don't generate noise; auto-validates on save with click-to-jump results
- **Refactoring** — rename a page or anchor with workspace-wide xref rewrite, preview-the-impact UI, and snapshot-and-rollback safety
- **Build & lint** — streaming Antora build console with parsed diagnostics; Vale integration with JSON output parsing

## Installation

Manual install for now. Build the plugin and copy three files into your vault:

```bash
npm install
npm run build
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/obsidian-antora-asciidoc/
```

Then enable **Antora AsciiDoc** under *Settings → Community plugins*.

Requirements: Obsidian 1.5.0+, Node.js 20+ (for building), desktop platform.

## Documentation

The full docs live in `src/docs/` as an Antora component. Highlights:

- [Overview](src/docs/modules/ROOT/pages/index.adoc)
- [Installation](src/docs/modules/ROOT/pages/installation.adoc)
- [Commands](src/docs/modules/ROOT/pages/commands.adoc)
- [Settings](src/docs/modules/ROOT/pages/settings.adoc)
- [Editor features](src/docs/modules/ROOT/pages/editor-features.adoc)
- [Preview](src/docs/modules/ROOT/pages/preview.adoc)
- [Diagnostics & linting](src/docs/modules/ROOT/pages/diagnostics.adoc)
- [Refactoring](src/docs/modules/ROOT/pages/refactoring.adoc)
- [Antora integration](src/docs/modules/ROOT/pages/antora-integration.adoc)
- [Architecture](src/docs/modules/ROOT/pages/architecture.adoc)
- [Development](src/docs/modules/ROOT/pages/development.adoc)

To build the docs site:

```bash
npx antora antora-playbook.yml
# output in build/site/
```

## Commands

All available from the command palette (Ctrl/Cmd-P):

| Command | What it does |
|---|---|
| `Reindex Antora workspace` | Force a full rescan |
| `Open Antora explorer` | Component → version → module → nav tree sidebar |
| `Open AsciiDoc preview` | Live preview pane for the active `.adoc` file |
| `Validate current AsciiDoc file` | Run xref/include/attribute checks |
| `Validate Antora workspace` | Same, batched across the whole workspace |
| `Find references to current page` | List all xrefs pointing at the active page |
| `Rename current AsciiDoc page` | Workspace-wide page rename with xref rewrite |
| `Rename anchor under cursor` | Rewrite anchor declaration + all references |
| `Run Antora build` (desktop) | Spawn `antora`, stream output to a console view |
| `Lint current file with Vale` (desktop) | Vale alerts as diagnostics |
| `Lint Antora workspace with Vale` (desktop) | Same, workspace-wide |

## Development

```bash
npm run dev      # watch build with sourcemaps
npm run lint     # eslint
npm test         # vitest run
npm run build    # production build
```

See [Development](src/docs/modules/ROOT/pages/development.adoc) for the full guide.

## License

[Apache-2.0](LICENSE)
