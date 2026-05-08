# obsidian-antora-asciidoc

`obsidian-antora-asciidoc` is an Obsidian plugin that adds first-class authoring support for Antora-based AsciiDoc projects.

## Purpose

This plugin focuses on fast editor UX for Antora docs in Obsidian:

- Detect Antora components in your vault
- Build a lightweight in-memory Antora index
- Provide xref autocomplete and xref validation
- Show project structure in a dedicated **Antora Explorer** view
- Surface diagnostics in a clickable diagnostics pane

## Supported Antora structure

The scanner currently detects workspace/project structure from:

- `antora.yml` component descriptor files
- Antora playbooks such as `site.yml` and `*.playbook.yml`
- Module content folders under `modules/*/`:
  - `pages`
  - `partials`
  - `examples`
  - `assets/images`

## MVP status

Implemented MVP features:

- Antora workspace detection and reindex command
- In-memory index with components, versions, modules, pages, anchors, partials, examples, images
- `.adoc` and `.asciidoc` editor support via markdown mode registration
- Basic AsciiDoc syntax tokenization for headings/comments/xrefs
- Xref autocomplete for known page targets
- Xref diagnostics for broken pages and missing anchors
- Include diagnostics for unresolved include paths
- Attribute diagnostics for unresolved attributes (best effort)
- Commands:
  - Reindex Antora workspace
  - Validate current AsciiDoc file
  - Validate Antora workspace
  - Open Antora explorer
  - Run Antora build
- Views:
  - Antora Explorer
  - Diagnostics View (click to navigate to file location)

## Development setup

### Prerequisites

- Node.js 20+
- npm 10+
- Obsidian installed locally

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Manual installation in Obsidian

1. Build the plugin (`npm run build`).
2. Copy these files into your vault plugin directory:
   - `main.js`
   - `manifest.json`
3. Place them in:
   - `<vault>/.obsidian/plugins/obsidian-antora-asciidoc/`
4. In Obsidian: **Settings → Community plugins**
   - Enable community plugins
   - Enable **Antora AsciiDoc**

## Roadmap

- Rich AsciiDoc language support beyond basic tokenization
- Include and attribute autocomplete
- Ctrl/Cmd-click xref navigation to target files
- Stronger Antora xref resolution with context-aware component/version defaults
- Incremental indexing and file-watch based updates
- Better unresolved attribute resolution using AsciiDoc attribute scopes
- Antora build output parsing wired directly into diagnostics view

## Known limitations

- Scanner assumes conventional Antora module folder layout
- Xref resolution is intentionally lightweight and not a full Antora resolver
- Include resolution currently checks plain vault paths only
- Build command execution is desktop-oriented (`isDesktopOnly: true`)
- Syntax highlighting is minimal and intended as a foundation for richer CM6 integration

## License

Apache-2.0. See [LICENSE](./LICENSE).
