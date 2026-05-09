# Changelog

Generated from git tags by `scripts/generate-changelog.mjs`.

## 0.2.0 — 2026-05-09

*0.2.0 — pinned pages, descriptor view, page slug, bulk find-and-replace*

- Pin pages: new pinnedPages setting (string[]). 'Pin current page in
  Antora explorer' / 'Unpin current page' commands. Antora Explorer
  renders a Pinned section at the top with an unpin glyph next to each
  entry. Survives reloads via the saved settings.
- Module descriptor view: new sidebar pane shows the active page's
  component@version:module, the module's resource counts, and the full
  descriptor-scope attribute map. Refreshes on active-leaf-change /
  file-open. Useful for confirming rendering context and spotting
  attribute mismatches across components.
- Page slug generator: new generatePageSlug() helper turns a working
  title into a kebab-case .adoc filename. Strips an existing
  .adoc/.asciidoc suffix first so 'Getting Started.adoc' →
  'getting-started.adoc'. New 'Insert page slug from selected title'
  editor command.
- Bulk find-and-replace: new planBulkReplace() service walks every
  .adoc file and produces a plan of matches + file rewrites. Supports
  literal or regex patterns, case-sensitive toggle, and reports each
  match with line/column/context. New BulkReplaceModal with preview
  (capped at 200 entries displayed) and Apply via the existing
  snapshot/rollback flow. New 'Bulk find and replace across .adoc
  files…' command.
- 11 new tests across page slug, bulk replace edge cases (empty
  pattern, regex mode, case-insensitive, file extension filter,
  per-match position, invalid regex).

## 0.1.10 — 2026-05-09

*0.1.10 — insert/convert tools and nav export*

- Insert xref via picker: 'Insert xref via page picker…' command opens
  AntoraPagePicker in callback mode and inserts an xref macro at the
  cursor instead of opening the file. New buildXrefTargetFor helper
  emits the most-context-appropriate scope (bare for same module,
  module:page for same component, full triple for cross-component).
- Insert image via picker: new AntoraImagePicker over every indexed
  image, plus buildImageTargetFor that picks the right resource-ID
  scope for the source page's context.
- Convert wikilink under cursor to xref: new WikilinkConverter handles
  [[target]], [[target|alias]], and [[target#anchor|alias]] forms,
  appending .adoc when missing. Editor command detects the wikilink at
  the cursor and replaces in-place. Useful for content ported from
  Obsidian-style notes.
- Antora navigation export to JSON: new buildNavigationExport produces
  a deep-cloned JSON snapshot of every parsed nav.adoc tree across
  components and modules. New 'Export navigation tree (JSON)' command
  writes it to a timestamped file in the vault root.
- Picker action callback: AntoraPagePicker constructor now accepts a
  PickerAction so a single class serves both 'open the file' (default)
  and 'pass the chosen page to a callback' use cases.
- 16 new tests across the picker helpers, wikilink converter, and nav
  export.

## 0.1.9 — 2026-05-09

*0.1.9 — workflow tools: include usage, attribute usage, recents, admonitions*

- Reverse-includes lookup: 'Find pages that include this file' command
  walks all .adoc files, resolves include:: directives via
  AntoraResourceResolver, and surfaces every page whose include
  resolves to the active partial in the diagnostics view.
- Attribute usage cross-reference: 'Find usages of attribute under
  cursor' command detects the {name} reference at the cursor via
  detectAttributeReferenceAt, then walks the workspace for matching
  references. Useful before renaming/removing a project attribute.
- Recent AsciiDoc pages picker: bounded MRU list (capacity 20) records
  every .adoc file the user opens. New 'Open recent AsciiDoc page…'
  fuzzy picker. Vault delete/rename events keep the list clean.
- Wrap selection as admonition: 'Wrap selection as admonition…' command
  presents a fuzzy picker for the admonition type (NOTE / TIP /
  WARNING / CAUTION / IMPORTANT) then wraps the selected text in the
  appropriate `[TYPE]\n====\n…\n====` block.
- 16 new tests across IncludeUsage, AttributeUsage,
  detectAttributeReferenceAt, RecentList, and buildAdmonitionBlock.

## 0.1.8 — 2026-05-09

*0.1.8 — quality lints, audit report, rule toggles, preview banner*

- Duplicate anchor lint: workspace-level check that flags anchor names
  declared on multiple pages within the same component (Antora's xref
  scope already disambiguates across components, so cross-component
  duplicates are intentionally not flagged). New 'Find duplicate
  anchors' command.
- Workspace audit report: 'Workspace audit report' command writes a
  Markdown summary (component/version/module/page/partial counts,
  total + broken xrefs, average xrefs per page, top 10 attributes by
  usage, orphan and duplicate-anchor totals) to a timestamped file
  in the vault root. Pure auditWorkspace() + renderAuditMarkdown()
  pair so the math is testable independently of IO.
- Per-rule lint toggles: settings now expose individual toggles for
  the four built-in lint families (xref, include, attribute,
  headingHierarchy). DiagnosticsService.setLintRules() applies them
  on settings change. Lets users silence a noisy rule without
  disabling diagnostics entirely.
- Preview metadata banner: small header at the top of the preview
  pane shows the active page's component@version:module:path triple
  plus title. Pages outside any indexed component get a clear
  '(unindexed)' label so the user knows the rendering context.
- 9 new tests covering the duplicate-anchor lint and audit
  aggregation.

## 0.1.7 — 2026-05-09

*0.1.7 — performance benches and PRD threshold tests*

- SyntheticWorkspace fixture: deterministic InMemoryFileSource builder
  parameterised by component / module / page / xref / anchor counts.
  Used by both bench and threshold suites so timings stay comparable.
- 8 vitest benches in tests/perf/Workspace.bench.ts: scan at
  100/1k/5k pages, listPageTargets and resolvePage on a 5k index,
  indexFile incremental on a 5k index, planPageRename on 1k,
  deriveGraphEdges (xrefs only and xrefs + includes). New `npm run
  bench` script.
- 4 threshold tests in tests/perf/Threshold.test.ts that fail CI on
  PRD-budget regressions:
    PR-1 scan 5k pages within 5 s     (measured ~1.1 s)
    PR-2 listPageTargets within 100 ms (measured ~2 ms)
    PR-3 indexFile within 50 ms        (measured ~4 ms)
    planPageRename within 200 ms       (measured ~12 ms)
  Budgets are 3-5× the local-machine measurement to absorb CI variance.
- New Bench GitHub Actions workflow runs npm run bench on main pushes
  and on demand, uploading the output as a 90-day artefact for trend
  watching. Doesn't block the build on numbers.

## 0.1.6 — 2026-05-09

*0.1.6 — content quality lints + structural commands*

- Heading hierarchy lint: warns when a heading skips levels (e.g. `=`
  directly to `===`). Runs as part of validateFile so it shows up in
  Validate current AsciiDoc file and Validate Antora workspace results.
  First heading is always allowed regardless of level.
- Orphan pages lint: workspace-level check that flags pages reachable
  neither from any nav.adoc nor from any other page's xref. Reuses
  deriveGraphEdges for the reverse-edge map. index.adoc-style entry
  points are excluded automatically. New 'Find orphan pages' command.
- Module rename refactor: planModuleRename moves every file under
  modules/<old>/ to modules/<new>/ and rewrites xrefs whose scope
  references the old module name. Same-component sources rewrite to
  the module:page form; cross-component sources keep the
  component:module:page form. New 'Rename current page's module'
  command and a `moves` array on RefactorPlan handled by the applier.
- New Antora component scaffold: 'New Antora component…' command opens
  a modal that prompts for name + version + vault folder + optional
  title, then writes antora.yml, modules/ROOT/nav.adoc,
  modules/ROOT/pages/index.adoc, and .gitkeep placeholders for
  partials/examples/assets/images. Triggers a reindex on success.
- 22 new tests: heading hierarchy lint (6), orphan pages lint (4),
  module rename (5), component scaffold (7).

## 0.1.5 — 2026-05-09

*0.1.5 — outline view, references-from, AsciiDoc → Markdown, callout styling*

- Page outline view: new sidebar pane lists every heading and explicit
  anchor in the active .adoc file with click-to-jump. Refreshes on
  active-leaf-change and on file modify. Anchors that immediately precede
  a heading are de-duped against the heading entry. New 'Open page
  outline' command.
- AsciiDoc → Markdown converter: inverse of the existing MD → AsciiDoc
  converter. Handles `=` headings, *bold* / _italic_ via placeholder
  swap, +inline code+, [source,X] blocks (preserves content verbatim),
  xref/link/image macros, lists, [quote] blocks, '''. Command:
  'Convert AsciiDoc selection to Markdown'.
- 'List references from current page' command: lists every xref and
  include emitted by the active page. Resolved xrefs surface as info,
  unresolved as warning, includes always as info — all click-to-jump
  via DiagnosticsView.
- Callout styling: CSS for asciidoctor's .conum + .colist so the
  <1>/<2> markers and the trailing colist render as a circular badge
  next to the source line plus a coloured legend block beneath.
- Fixed a placeholder-literal bug: the converter placeholders were
  being silently dropped during file writes, breaking bold/italic
  conversion. Switched to explicit \\u0001/\\u0002 escape literals.
- 16 new tests across PageOutlineExtractor and AsciiDocToMarkdown.

## 0.1.4 — 2026-05-09

*0.1.4 — writer workflow: page move, heading transforms, anchor wrap, MD converter*

- Page move: planPageRename now accepts an optional newModule, moves the
  file into <componentRoot>/modules/<newModule>/pages/, and chooses xref
  scope (bare / module:page / component:module:page) per source file
  based on whether the source can still resolve via defaults. Modal
  exposes a target-module dropdown populated from index.getModulesFor.
- Promote/demote heading: two editor commands that adjust the leading
  `=` count on the cursor's heading line, clamped to 1–6.
- Wrap selection as anchor: editor command that wraps the active
  selection (or current line trimmed) in `[[id]]` using a kebab-case
  generateAnchorId derived from the selected text.
- Markdown → AsciiDoc converter: command that converts the active
  selection. Handles ATX headings, bold/italic with placeholder-based
  conflict avoidance, inline code, links (with .adoc → xref detection),
  fenced code blocks (preserves content verbatim), bulleted/numbered
  lists, blockquotes, horizontal rules.
- Refactor scope decisions now use the source file's resolved defaults
  (component+module from page entry OR path-based context) instead of
  the page entry alone, so rewrites stay tight even when the source
  isn't an indexed page (e.g. nav.adoc).
- 25 new tests covering the page-move semantics, heading transforms,
  anchor ID generation, and Markdown conversion.

## 0.1.3 — 2026-05-09

*0.1.3 — editor UX polish*

- Source-view heading styling: `=`/`==`/etc. lines render at heading
  weights and sizes in the source editor instead of as raw equals signs.
  Per-level CSS classes (.antora-heading-1 through -6); the leading
  marker characters get their own class so themes can dim them.
- Page title in xref autocomplete details: each `xref:…[]` suggestion
  now shows the resolved page's H1 title in the detail column. The
  scanner extracts and stores the title on each page entry; new
  index.resolveByListedTarget() returns the entry for a flat target
  string.
- Same-page anchor autocomplete: `xref:#` (no page target) now
  suggests anchors found in the active document, extracted live from
  the buffer so newly-typed anchors appear without waiting for an
  index refresh.
- Antora Explorer filter bar: text input at the top of the explorer
  filters components, modules, and pages as you type. When the filter
  matches pages, the page list is shown directly instead of the nav
  tree (so partials/examples/assets counts stay visible). Empty state
  message when no matches.
- 6 new tests: extractPageTitle, page-title scan persistence, target
  encoding round-trip via resolveByListedTarget.

## 0.1.2 — 2026-05-09

*0.1.2 — preview discoverability and Antora page navigation*

- Ribbon icon (file-text) opens the AsciiDoc preview pane in one click.
  Addresses the common confusion where Obsidian's built-in reading mode
  shows raw `=` characters because it doesn't understand AsciiDoc.
- Setting: 'Auto-open preview' opens the preview in a side leaf the
  first time an .adoc file is focused in a session. Subsequent file
  switches retarget the existing pane.
- New command: 'Open Antora page…' is a fuzzy-search modal over every
  indexed page. Shows page IDs (component[@version]:module:path) so
  navigation works from page identity, not vault filename. The version
  segment is included only when multiple versions of a component are
  indexed.
- Status bar shows the active page's component@version:module triple
  (or component:module for non-page files inside a known component).
  Confirms which Antora context the editor is operating in.
- 4 new tests for the picker's getItems including version-segment
  presence rules.
- Docs updated: settings page documents Auto-open preview; commands
  page documents 'Open Antora page…' and the new ribbon icon.

## 0.1.1 — 2026-05-09

*0.1.1 — sync xref edges to Obsidian's graph view*

## 0.1.0 — 2026-05-09

*Round out v0.1.0 features before tagging*

- Per-version xref resolution: resolver parses leading version@ prefix and
  index.resolvePage prefers the source page's version, then the highest
  declared version (snapshot/master beats tagged versions)
- Render-time errors as diagnostics: AsciiDocPreviewRenderer exposes
  renderWithDiagnostics returning {html, diagnostics}; preview view pipes
  them into DiagnosticsView via an onRenderDiagnostics callback
- Cross-page anchor rename: optional acrossAllPages flag rewrites
  declarations on every page and all inbound xrefs; modal exposes a
  toggle for the option
- Block attribute value completion: triggers inside key="..." for known
  keys (align, valign, format, opts, options, subs, separator, window)
- Snippet templates: insert-page-template / insert-partial-template
  commands write a sensible default header at cursor position
- Validation report export: export-diagnostics-json /
  export-diagnostics-csv commands serialise the active diagnostics view
  to a timestamped file in the vault root
- DiagnosticsView UX: severity-filter chips with counts, copy-to-
  clipboard button, per-severity colour styling
- Image not-found placeholder: preview replaces unresolved <img> with a
  visible "Image not found" block instead of a broken-image icon
- Manifest: fundingUrl added for the community plugin directory

Test count: 134 -> 151 (added per-version, exporter, templates,
attribute value sets, render diagnostics, cross-page anchor)
