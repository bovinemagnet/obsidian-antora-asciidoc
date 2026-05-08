import { autocompletion } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { MarkdownView, Notice, Platform, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraBuildRunner } from './build/AntoraBuildRunner';
import { ValeRunner } from './build/ValeRunner';
import { AntoraComponentIndex } from './antora/AntoraComponentIndex';
import { AntoraPathResolver } from './antora/AntoraPathResolver';
import { AntoraProject } from './antora/AntoraProject';
import { AntoraWorkspaceScanner } from './antora/AntoraWorkspaceScanner';
import { parsePlaybooks } from './antora/PlaybookParser';
import { AsciiDocParser } from './asciidoc/AsciiDocParser';
import { AsciiDocPreviewRenderer } from './asciidoc/AsciiDocPreviewRenderer';
import { buildPageTemplate, buildPartialTemplate } from './asciidoc/Templates';
import { asciiDocLanguageSupport } from './editor/AsciiDocLanguageSupport';
import { createAttributeAutocomplete } from './editor/AttributeAutocomplete';
import { createAttributeHoverProvider } from './editor/AttributeHoverProvider';
import { createBlockAttributeAutocomplete } from './editor/BlockAttributeAutocomplete';
import { createBlockAttributeValueAutocomplete } from './editor/BlockAttributeValueAutocomplete';
import { createBlockMacroAutocomplete } from './editor/BlockMacroAutocomplete';
import { createDiagnosticsExtension } from './editor/DiagnosticsExtension';
import { MutableEditorContext } from './editor/EditorContext';
import { createImageAutocomplete } from './editor/ImageAutocomplete';
import { createImageHoverProvider } from './editor/ImageHoverProvider';
import { createIncludeAutocomplete } from './editor/IncludeAutocomplete';
import { createSectionFolding } from './editor/SectionFolding';
import { createXrefAnchorAutocomplete } from './editor/XrefAnchorAutocomplete';
import { createXrefAutocomplete } from './editor/XrefAutocomplete';
import { createXrefHoverProvider } from './editor/XrefHoverProvider';
import { createXrefNavigation } from './editor/XrefNavigation';
import { DiagnosticsService } from './diagnostics/DiagnosticsService';
import { defaultFilenameFor, ExportFormat, serialiseDiagnostics } from './diagnostics/DiagnosticsExporter';
import { Diagnostic } from './diagnostics/Diagnostic';
import { deriveGraphEdges } from './graph/GraphEdgeDeriver';
import { GraphSyncApplier } from './graph/GraphSyncApplier';
import { CompositeFileSource } from './io/CompositeFileSource';
import { FileSource } from './io/FileSource';
import { NodeFileSource } from './io/NodeFileSource';
import { VaultFileSource } from './io/VaultFileSource';
import { RefactorService } from './refactor/RefactorService';
import { RenameModal } from './refactor/RenameModal';
import { SettingsTab } from './settings/SettingsTab';
import { DEFAULT_SETTINGS, PluginSettings } from './settings/PluginSettings';
import { debounce } from './util/Debounce';
import { isAsciiDocPath } from './util/FileUtils';
import { Logger } from './util/Logger';
import { ANTORA_EXPLORER_VIEW_TYPE, AntoraExplorerView } from './views/AntoraExplorerView';
import { ASCIIDOC_PREVIEW_VIEW_TYPE, AsciiDocPreviewView } from './views/AsciiDocPreviewView';
import { BUILD_CONSOLE_VIEW_TYPE, BuildConsoleView } from './views/BuildConsoleView';
import { DiagnosticsView, DIAGNOSTICS_VIEW_TYPE } from './views/DiagnosticsView';

export default class AntoraAsciidocPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  private readonly logger = new Logger('obsidian-antora-asciidoc');
  private readonly index = new AntoraComponentIndex();
  private readonly parser = new AsciiDocParser();
  private readonly buildRunner = new AntoraBuildRunner();
  private readonly valeRunner = new ValeRunner();
  private readonly pathResolver = new AntoraPathResolver();
  private readonly editorContext = new MutableEditorContext();

  private vaultSource!: VaultFileSource;
  private fileSource!: FileSource;
  private scanner!: AntoraWorkspaceScanner;
  private diagnosticsService!: DiagnosticsService;
  private previewRenderer!: AsciiDocPreviewRenderer;
  private refactorService!: RefactorService;
  private graphSyncApplier!: GraphSyncApplier;
  private editorExtensions: Extension[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();

    this.vaultSource = new VaultFileSource(this.app.vault);
    this.fileSource = this.buildFileSource();
    this.scanner = new AntoraWorkspaceScanner(this.fileSource, this.parser, {
      ignorePaths: this.settings.ignorePaths,
    });
    this.diagnosticsService = new DiagnosticsService(this.app.vault, this.parser, this.index, this.fileSource);
    this.previewRenderer = new AsciiDocPreviewRenderer(this.index, this.fileSource);
    this.refactorService = new RefactorService(this.fileSource, this.index, this.parser);
    this.graphSyncApplier = new GraphSyncApplier(this.app);

    this.registerExtensions(['adoc', 'asciidoc'], 'markdown');
    this.registerView(ANTORA_EXPLORER_VIEW_TYPE, (leaf) => new AntoraExplorerView(leaf, this.index));
    this.registerView(DIAGNOSTICS_VIEW_TYPE, (leaf) => new DiagnosticsView(leaf));
    this.registerView(ASCIIDOC_PREVIEW_VIEW_TYPE, (leaf) => {
      const view = new AsciiDocPreviewView(leaf, this.previewRenderer, this.index);
      view.onRenderDiagnostics = (filePath, diagnostics) => {
        if (diagnostics.length === 0) {
          return;
        }
        const diagnosticsView = this.getDiagnosticsView();
        diagnosticsView?.replaceDiagnosticsForFile(filePath, diagnostics);
      };
      return view;
    });
    if (Platform.isDesktop) {
      this.registerView(BUILD_CONSOLE_VIEW_TYPE, (leaf) => new BuildConsoleView(leaf));
    }

    this.rebuildEditorExtensions();
    this.registerEditorExtension(this.editorExtensions);

    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerCommands();
    this.registerVaultEvents();
    this.registerWorkspaceEvents();

    await this.reindexWorkspace();
  }

  onunload(): void {
    // Obsidian guidance: do not detach leaves here — preserves the user's layout across reloads.
    // Clear graph-sync entries so a disabled plugin doesn't leave phantom edges.
    this.graphSyncApplier?.clear();
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.rebuildEditorExtensions();
    this.app.workspace.updateOptions();
    this.scanner?.setIgnorePaths(this.settings.ignorePaths);
    if (!this.settings.syncToObsidianGraph) {
      this.graphSyncApplier?.clear();
    } else {
      void this.maybeSyncGraph();
    }
  }

  private buildFileSource(): FileSource {
    if (!Platform.isDesktop || this.settings.externalContentRoots.length === 0) {
      return this.vaultSource;
    }
    const externalSource = new NodeFileSource({ roots: this.settings.externalContentRoots });
    return new CompositeFileSource([this.vaultSource, externalSource]);
  }

  private rebuildEditorExtensions(): void {
    this.editorExtensions.length = 0;
    this.editorExtensions.push(asciiDocLanguageSupport());
    this.editorExtensions.push(autocompletion({
      override: this.settings.autocompleteEnabled
        ? [
            createXrefAutocomplete(this.index, this.editorContext),
            createXrefAnchorAutocomplete(this.index, this.editorContext),
            createAttributeAutocomplete(this.index, this.editorContext),
            createImageAutocomplete(this.index, this.editorContext),
            createIncludeAutocomplete(this.index, this.editorContext),
            createBlockMacroAutocomplete(this.editorContext),
            createBlockAttributeAutocomplete(this.editorContext),
            createBlockAttributeValueAutocomplete(this.editorContext),
          ]
        : [],
    }));
    this.editorExtensions.push(createXrefHoverProvider(this.index, this.editorContext));
    this.editorExtensions.push(createAttributeHoverProvider(this.index, this.editorContext));
    this.editorExtensions.push(createImageHoverProvider(this.index, this.app.vault, this.editorContext));
    this.editorExtensions.push(createXrefNavigation(this.editorContext, async (target) => this.openXrefTarget(target)));
    this.editorExtensions.push(createSectionFolding(this.editorContext));
    if (this.settings.diagnosticsEnabled) {
      this.editorExtensions.push(createDiagnosticsExtension(this.index, this.editorContext));
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'reindex-antora-workspace',
      name: 'Reindex Antora workspace',
      callback: async () => this.reindexWorkspace(),
    });

    this.addCommand({
      id: 'validate-current-asciidoc-file',
      name: 'Validate current AsciiDoc file',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || !isAsciiDocPath(file.path)) {
          new Notice('Open an .adoc or .asciidoc file first.');
          return;
        }

        const diagnostics = await this.diagnosticsService.validateFile(file);
        await this.openDiagnosticsView(diagnostics);
        new Notice(`Validation finished with ${diagnostics.length} diagnostics.`);
      },
    });

    this.addCommand({
      id: 'validate-antora-workspace',
      name: 'Validate Antora workspace',
      callback: async () => {
        const diagnostics = await this.diagnosticsService.validateWorkspace(this.settings.includeFileExtensions);
        await this.openDiagnosticsView(diagnostics);
        new Notice(`Workspace validation finished with ${diagnostics.length} diagnostics.`);
      },
    });

    this.addCommand({
      id: 'open-antora-explorer',
      name: 'Open Antora explorer',
      callback: async () => {
        await this.activateView(ANTORA_EXPLORER_VIEW_TYPE);
      },
    });

    this.addCommand({
      id: 'open-asciidoc-preview',
      name: 'Open AsciiDoc preview',
      callback: async () => {
        const leaf = await this.activateView(ASCIIDOC_PREVIEW_VIEW_TYPE);
        const view = leaf.view;
        if (view instanceof AsciiDocPreviewView) {
          await view.refreshFromActiveFile();
        }
      },
    });

    this.addCommand({
      id: 'rename-current-page',
      name: 'Rename current AsciiDoc page',
      callback: async () => this.openRenamePagePrompt(),
    });

    this.addCommand({
      id: 'find-references-to-current-page',
      name: 'Find references to current page',
      callback: async () => this.findReferencesToCurrentPage(),
    });

    this.addCommand({
      id: 'export-diagnostics-json',
      name: 'Export diagnostics report (JSON)',
      callback: async () => this.exportDiagnostics('json'),
    });

    this.addCommand({
      id: 'export-diagnostics-csv',
      name: 'Export diagnostics report (CSV)',
      callback: async () => this.exportDiagnostics('csv'),
    });

    this.addCommand({
      id: 'sync-xrefs-to-graph',
      name: 'Sync xrefs to Obsidian graph',
      callback: async () => {
        const edges = await deriveGraphEdges(this.fileSource, this.index, this.parser, {
          includeIncludeEdges: this.settings.syncIncludeEdgesToGraph,
        });
        const outcome = this.graphSyncApplier.apply(edges);
        if (outcome.failed) {
          new Notice('Graph sync failed — Obsidian metadata API may have changed.');
        } else {
          new Notice(`Synced ${outcome.written.length} source(s) to the graph.`);
        }
      },
    });

    this.addCommand({
      id: 'insert-page-template',
      name: 'Insert page template at cursor',
      callback: () => this.insertTemplate(buildPageTemplate()),
    });

    this.addCommand({
      id: 'insert-partial-template',
      name: 'Insert partial template at cursor',
      callback: () => this.insertTemplate(buildPartialTemplate()),
    });

    this.addCommand({
      id: 'rename-anchor-under-cursor',
      name: 'Rename anchor under cursor',
      callback: async () => this.openRenameAnchorPrompt(),
    });

    if (!Platform.isDesktop) {
      return;
    }

    this.addCommand({
      id: 'run-vale-on-current-file',
      name: 'Lint current file with Vale',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!(file instanceof TFile) || !isAsciiDocPath(file.path)) {
          new Notice('Open an .adoc or .asciidoc file first.');
          return;
        }
        await this.runVale([file.path]);
      },
    });

    this.addCommand({
      id: 'run-vale-on-workspace',
      name: 'Lint Antora workspace with Vale',
      callback: async () => this.runVale(['.']),
    });

    this.addCommand({
      id: 'run-antora-build',
      name: 'Run Antora build',
      callback: async () => {
        const command = this.settings.buildCommandOverride.trim()
          || `${this.settings.antoraExecutablePath} ${this.settings.antoraPlaybookPath}`;

        const consoleLeaf = await this.activateView(BUILD_CONSOLE_VIEW_TYPE);
        const consoleView = consoleLeaf.view instanceof BuildConsoleView ? consoleLeaf.view : null;
        consoleView?.startRun(command);

        try {
          const result = await this.buildRunner.run(command, {
            playbookPath: this.settings.antoraPlaybookPath,
            onLine: (stream, line) => consoleView?.appendLine(stream, line),
          });
          consoleView?.finish(result.exitCode, result.diagnostics);
          new Notice(`Antora build finished (exit ${result.exitCode}, ${result.diagnostics.length} diagnostics).`);
          if (result.diagnostics.length > 0) {
            await this.openDiagnosticsView(result.diagnostics);
          }
        } catch (error) {
          this.logger.error('Antora build failed', error);
          consoleView?.finish(-1, []);
          new Notice('Antora build failed. Check developer console.');
        }
      },
    });
  }

  private registerVaultEvents(): void {
    const fullReindex = debounce(() => void this.reindexWorkspace(), 500);
    const refreshExplorer = debounce(() => this.getExplorerView()?.render(), 200);
    const autoValidate = debounce(
      (file: TFile) => void this.runAutoValidate(file),
      Math.max(100, this.settings.autoValidateDebounceMs),
    );

    this.registerEvent(this.app.vault.on('create', (file) => {
      this.handleFileChange(file, fullReindex, refreshExplorer, 'upsert');
    }));
    this.registerEvent(this.app.vault.on('modify', (file) => {
      this.handleFileChange(file, fullReindex, refreshExplorer, 'upsert');
      if (this.settings.autoValidateOnSave && file instanceof TFile && isAsciiDocPath(file.path)) {
        autoValidate(file);
      }
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      this.handleFileChange(file, fullReindex, refreshExplorer, 'remove');
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      // Drop entries under the old path, then upsert at the new path.
      this.index.removePagesUnder(oldPath);
      this.handleFileChange(file, fullReindex, refreshExplorer, 'upsert');
    }));
  }

  private async runAutoValidate(file: TFile): Promise<void> {
    try {
      const diagnostics = await this.diagnosticsService.validateFile(file);
      const view = this.getDiagnosticsView();
      if (view) {
        view.replaceDiagnosticsForFile(file.path, diagnostics);
      }
    } catch (error) {
      this.logger.error('Auto-validate failed', error);
    }
  }

  private getDiagnosticsView(): DiagnosticsView | null {
    const leaf = this.app.workspace.getLeavesOfType(DIAGNOSTICS_VIEW_TYPE)[0];
    return leaf?.view instanceof DiagnosticsView ? leaf.view : null;
  }

  private handleFileChange(
    file: TAbstractFile,
    fullReindex: () => void,
    refreshExplorer: () => void,
    op: 'upsert' | 'remove',
  ): void {
    if (!(file instanceof TFile)) {
      return;
    }
    // antora.yml / playbook changes affect descriptors → fall back to full rescan.
    if (file.name === 'antora.yml' || file.name === 'site.yml' || file.name.endsWith('.playbook.yml')) {
      fullReindex();
      return;
    }
    const isContent = isAsciiDocPath(file.path)
      || file.path.includes('/partials/')
      || file.path.includes('/examples/')
      || file.path.includes('/assets/images/');
    if (!isContent) {
      return;
    }

    if (op === 'remove') {
      this.index.removePagesUnder(file.path);
      refreshExplorer();
      return;
    }

    void this.scanner
      .indexFile(this.vaultSource.toSourceFile(file), [...this.scanner.getDescriptors()], this.index)
      .then(refreshExplorer)
      .catch((error) => this.logger.error('Per-file index update failed', error));
  }

  private registerWorkspaceEvents(): void {
    const update = () => {
      const file = this.app.workspace.getActiveFile();
      const isAsciiDoc = file !== null && isAsciiDocPath(file.path);
      const owning = file ? this.index.getPageByFilePath(file.path) : undefined;
      this.editorContext.set(
        isAsciiDoc,
        owning ? { component: owning.component, module: owning.module, version: owning.version } : {},
        file?.path,
      );
    };
    update();
    this.registerEvent(this.app.workspace.on('active-leaf-change', update));
    this.registerEvent(this.app.workspace.on('file-open', update));
  }

  private async reindexWorkspace(): Promise<void> {
    const scan = await this.scanner.scan(this.index);
    if (!scan.isAntoraWorkspace) {
      this.logger.info('No Antora project detected in this vault.');
      return;
    }

    await this.refreshFileSourceFromPlaybooks(scan.projects);
    await this.maybeSyncGraph();

    const view = this.getExplorerView();
    view?.render();
  }

  private async maybeSyncGraph(): Promise<void> {
    if (!this.settings.syncToObsidianGraph) {
      return;
    }
    try {
      const edges = await deriveGraphEdges(this.fileSource, this.index, this.parser, {
        includeIncludeEdges: this.settings.syncIncludeEdgesToGraph,
      });
      this.graphSyncApplier.apply(edges);
    } catch (error) {
      this.logger.error('Graph sync failed', error);
    }
  }

  /**
   * After a successful scan, parse any discovered playbooks and rebuild the
   * FileSource so playbook-referenced *local* content roots become visible to
   * the index. Remote git URLs are skipped — we don't fetch them.
   */
  private async refreshFileSourceFromPlaybooks(projects: AntoraProject[]): Promise<void> {
    if (!Platform.isDesktop) {
      return;
    }
    const playbookPaths = new Set<string>();
    for (const project of projects) {
      for (const path of project.playbookPaths) {
        playbookPaths.add(path);
      }
    }
    if (playbookPaths.size === 0) {
      return;
    }

    const parsed = await parsePlaybooks(this.fileSource, playbookPaths);
    const localRoots = new Set<string>(this.settings.externalContentRoots);
    for (const playbook of parsed) {
      const baseFolder = playbook.playbookPath.split('/').slice(0, -1).join('/');
      for (const sourceEntry of playbook.sources) {
        if (!sourceEntry.isLocal || !sourceEntry.localPath) {
          continue;
        }
        const absolute = sourceEntry.localPath.startsWith('/')
          ? sourceEntry.localPath
          : `${baseFolder}/${sourceEntry.localPath}`;
        localRoots.add(absolute);
      }
    }

    const updatedRoots = Array.from(localRoots);
    const currentRoots = this.fileSource === this.vaultSource ? [] : this.settings.externalContentRoots;
    if (sameSet(currentRoots, updatedRoots)) {
      return;
    }

    if (updatedRoots.length === 0) {
      this.fileSource = this.vaultSource;
      return;
    }
    const externalSource = new NodeFileSource({ roots: updatedRoots });
    this.fileSource = new CompositeFileSource([this.vaultSource, externalSource]);
    // Subsequent scans will pick up the new file source via the scanner's
    // dependency on `this.fileSource`.
  }

  private insertTemplate(template: string): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor;
    if (!editor) {
      new Notice('No active editor.');
      return;
    }
    editor.replaceSelection(template);
  }

  private async exportDiagnostics(format: ExportFormat): Promise<void> {
    const view = this.getDiagnosticsView();
    const diagnostics = view ? view.getAllDiagnostics() : [];
    if (diagnostics.length === 0) {
      new Notice('No diagnostics to export. Run a validation first.');
      return;
    }
    const filename = defaultFilenameFor(format);
    try {
      await this.app.vault.create(filename, serialiseDiagnostics(diagnostics, format));
      new Notice(`Exported ${diagnostics.length} diagnostics to ${filename}.`);
    } catch (error) {
      this.logger.error('Diagnostics export failed', error);
      new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async findReferencesToCurrentPage(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || !isAsciiDocPath(file.path)) {
      new Notice('Open an .adoc or .asciidoc file first.');
      return;
    }
    const pageEntry = this.index.getPageByFilePath(file.path);
    if (!pageEntry) {
      new Notice('Active file is not part of any indexed Antora component.');
      return;
    }
    const refs = await this.refactorService.findPageReferences(pageEntry);
    const diagnostics: Diagnostic[] = refs.map((ref) => ({
      filePath: ref.filePath,
      line: ref.line,
      column: ref.column,
      severity: 'info',
      message: `xref:${ref.originalText}[…] → ${pageEntry.path}`,
    }));
    await this.openDiagnosticsView(diagnostics);
    new Notice(`Found ${refs.length} reference(s) to ${pageEntry.path}.`);
  }

  private async openRenamePagePrompt(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || !isAsciiDocPath(file.path)) {
      new Notice('Open an .adoc or .asciidoc file first.');
      return;
    }
    const pageEntry = this.index.getPageByFilePath(file.path);
    if (!pageEntry) {
      new Notice('Active file is not part of any indexed Antora component.');
      return;
    }

    new RenameModal(this.app, {
      title: `Rename ${pageEntry.path}`,
      description: `Component: ${pageEntry.component} • Module: ${pageEntry.module}`,
      initialValue: pageEntry.path,
      onPreview: async (value) => {
        if (!value || value === pageEntry.path) {
          return 0;
        }
        const plan = await this.refactorService.planPageRename({
          oldFilePath: pageEntry.filePath,
          newPagePath: value,
        });
        return plan.edits.length;
      },
      onSubmit: async (value) => {
        if (!value || value === pageEntry.path) {
          new Notice('Rename cancelled (name unchanged).');
          return;
        }
        try {
          const plan = await this.refactorService.planPageRename({
            oldFilePath: pageEntry.filePath,
            newPagePath: value,
          });
          await this.applyRefactorPlan(plan);
          new Notice(`Renamed ${pageEntry.path} → ${value}. Updated ${plan.edits.length} reference(s).`);
        } catch (error) {
          this.logger.error('Page rename failed', error);
          new Notice(`Rename failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    }).open();
  }

  private async openRenameAnchorPrompt(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || !isAsciiDocPath(file.path)) {
      new Notice('Open an .adoc or .asciidoc file first.');
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor;
    if (!editor) {
      new Notice('No active editor.');
      return;
    }
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const anchor = detectAnchorAt(lineText, cursor.ch);
    if (!anchor) {
      new Notice('Place the cursor on an anchor declaration ([[id]], [#id], or [id="id"]).');
      return;
    }

    new RenameModal(this.app, {
      title: `Rename anchor ${anchor}`,
      initialValue: anchor,
      toggle: {
        label: 'Rename across all pages',
        description: 'Also rewrite declarations on every other page that uses this name.',
      },
      onPreview: async (value, acrossAll) => {
        if (!value || value === anchor) {
          return 0;
        }
        const plan = await this.refactorService.planAnchorRename({
          ownerFilePath: file.path,
          oldAnchor: anchor,
          newAnchor: value,
          acrossAllPages: acrossAll,
        });
        return plan.edits.length;
      },
      onSubmit: async (value, acrossAll) => {
        if (!value || value === anchor) {
          new Notice('Rename cancelled (name unchanged).');
          return;
        }
        try {
          const plan = await this.refactorService.planAnchorRename({
            ownerFilePath: file.path,
            oldAnchor: anchor,
            newAnchor: value,
            acrossAllPages: acrossAll,
          });
          await this.applyRefactorPlan(plan);
          new Notice(`Renamed anchor ${anchor} → ${value}. Updated ${plan.edits.length} reference(s).`);
        } catch (error) {
          this.logger.error('Anchor rename failed', error);
          new Notice(`Rename failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    }).open();
  }

  private async applyRefactorPlan(plan: { fileChanges: Map<string, string>; fileMove?: { from: string; to: string } }): Promise<void> {
    /**
     * Snapshot every file we are about to touch before mutating anything. If
     * any modify or rename throws, walk the snapshot in reverse and restore
     * the originals so the workspace is never left half-renamed.
     */
    const snapshots: Array<{ path: string; original: string; modified: boolean }> = [];
    let renameDone = false;

    try {
      for (const path of plan.fileChanges.keys()) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          const original = await this.app.vault.read(file);
          snapshots.push({ path, original, modified: false });
        }
      }

      for (const snapshot of snapshots) {
        const target = this.app.vault.getAbstractFileByPath(snapshot.path);
        if (target instanceof TFile) {
          const newContent = plan.fileChanges.get(snapshot.path);
          if (newContent === undefined) {
            continue;
          }
          await this.app.vault.modify(target, newContent);
          snapshot.modified = true;
        }
      }

      if (plan.fileMove) {
        const file = this.app.vault.getAbstractFileByPath(plan.fileMove.from);
        if (file instanceof TFile) {
          await this.app.vault.rename(file, plan.fileMove.to);
          renameDone = true;
        }
      }
    } catch (error) {
      // Best-effort rollback: restore each modified file's original content,
      // then undo the rename if it had completed.
      for (const snapshot of snapshots.slice().reverse()) {
        if (!snapshot.modified) {
          continue;
        }
        try {
          const file = this.app.vault.getAbstractFileByPath(snapshot.path);
          if (file instanceof TFile) {
            await this.app.vault.modify(file, snapshot.original);
          }
        } catch (restoreError) {
          this.logger.error('Refactor rollback failed for ' + snapshot.path, restoreError);
        }
      }
      if (renameDone && plan.fileMove) {
        try {
          const moved = this.app.vault.getAbstractFileByPath(plan.fileMove.to);
          if (moved instanceof TFile) {
            await this.app.vault.rename(moved, plan.fileMove.from);
          }
        } catch (restoreError) {
          this.logger.error('Refactor rollback failed for file move', restoreError);
        }
      }
      throw error;
    }
  }

  private async runVale(targets: string[]): Promise<void> {
    const executable = this.settings.valeExecutablePath.trim();
    if (!executable) {
      new Notice('Vale executable is not configured. Set it in plugin settings.');
      return;
    }
    const cwd = this.settings.valeWorkingDirectory.trim()
      || (this.settings.antoraPlaybookPath ? this.settings.antoraPlaybookPath.split('/').slice(0, -1).join('/') || '.' : '.');
    try {
      const result = await this.valeRunner.run(executable, { targets, cwd });
      new Notice(`Vale finished with ${result.diagnostics.length} alerts (exit ${result.exitCode}).`);
      if (result.diagnostics.length > 0) {
        await this.openDiagnosticsView(result.diagnostics);
      }
      if (result.stderr) {
        this.logger.info('Vale stderr', result.stderr);
      }
    } catch (error) {
      this.logger.error('Vale execution failed', error);
      new Notice('Vale failed. Check developer console.');
    }
  }

  private async openDiagnosticsView(diagnostics: Diagnostic[]): Promise<void> {
    const leaf = await this.activateView(DIAGNOSTICS_VIEW_TYPE);
    const view = leaf.view;
    if (view instanceof DiagnosticsView) {
      view.setDiagnostics(diagnostics);
    }
  }

  private async openXrefTarget(rawTarget: string): Promise<void> {
    const resolved = this.pathResolver.resolveXrefTarget(rawTarget, this.editorContext.getDefaults());
    const page = this.index.resolvePage(resolved);

    if (!page) {
      new Notice(`Unresolved xref target: ${rawTarget}`);
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(page.filePath);
    if (!(file instanceof TFile)) {
      new Notice(`Target page not found in vault: ${page.filePath}`);
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  private getExplorerView(): AntoraExplorerView | null {
    const leaf = this.app.workspace.getLeavesOfType(ANTORA_EXPLORER_VIEW_TYPE)[0];
    return leaf?.view instanceof AntoraExplorerView ? leaf.view : null;
  }

  private async activateView(type: string): Promise<WorkspaceLeaf> {
    let leaf = this.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      const createdLeaf = this.app.workspace.getRightLeaf(false);
      if (!createdLeaf) {
        throw new Error(`Unable to create workspace leaf for view type '${type}'.`);
      }
      leaf = createdLeaf;
      await leaf.setViewState({ type, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  return b.every((entry) => set.has(entry));
}

/**
 * Detects an anchor name when the cursor is positioned inside one of the
 * supported declaration forms on the given line. Returns null when the
 * cursor is somewhere else.
 */
export function detectAnchorAt(lineText: string, cursorCh: number): string | null {
  const patterns: RegExp[] = [
    /\[\[([^\],]+)(?:,[^\]]*)?\]\]/g,
    /\[#([^\],]+)(?:,[^\]]*)?\]/g,
    /\[id=["']([^"']+)["'][^\]]*\]/g,
  ];
  for (const pattern of patterns) {
    for (const match of lineText.matchAll(pattern)) {
      if (match.index === undefined) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (cursorCh >= start && cursorCh <= end) {
        return match[1];
      }
    }
  }
  return null;
}
