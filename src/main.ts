import { autocompletion } from '@codemirror/autocomplete';
import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraBuildRunner } from './build/AntoraBuildRunner';
import { AntoraComponentIndex } from './antora/AntoraComponentIndex';
import { AntoraPathResolver } from './antora/AntoraPathResolver';
import { AntoraWorkspaceScanner } from './antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from './asciidoc/AsciiDocParser';
import { asciiDocLanguageSupport } from './editor/AsciiDocLanguageSupport';
import { createDiagnosticsExtension } from './editor/DiagnosticsExtension';
import { createXrefAutocomplete } from './editor/XrefAutocomplete';
import { createXrefHoverProvider } from './editor/XrefHoverProvider';
import { createXrefNavigation } from './editor/XrefNavigation';
import { DiagnosticsService } from './diagnostics/DiagnosticsService';
import { SettingsTab } from './settings/SettingsTab';
import { DEFAULT_SETTINGS, PluginSettings } from './settings/PluginSettings';
import { isAsciiDocPath } from './util/FileUtils';
import { Logger } from './util/Logger';
import { ANTORA_EXPLORER_VIEW_TYPE, AntoraExplorerView } from './views/AntoraExplorerView';
import { DiagnosticsView, DIAGNOSTICS_VIEW_TYPE } from './views/DiagnosticsView';

export default class AntoraAsciidocPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  private readonly logger = new Logger('obsidian-antora-asciidoc');
  private readonly index = new AntoraComponentIndex();
  private readonly parser = new AsciiDocParser();
  private readonly scanner = new AntoraWorkspaceScanner(this.app.vault, this.parser);
  private readonly diagnosticsService = new DiagnosticsService(this.app.vault, this.parser, this.index);
  private readonly buildRunner = new AntoraBuildRunner();
  private readonly pathResolver = new AntoraPathResolver();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerExtensions(['adoc', 'asciidoc'], 'markdown');
    this.registerView(ANTORA_EXPLORER_VIEW_TYPE, (leaf) => new AntoraExplorerView(leaf, this.index));
    this.registerView(DIAGNOSTICS_VIEW_TYPE, (leaf) => new DiagnosticsView(leaf));

    this.registerEditorExtension([
      asciiDocLanguageSupport(),
      autocompletion({
        override: this.settings.autocompleteEnabled ? [createXrefAutocomplete(this.index)] : [],
      }),
      createXrefHoverProvider(this.index),
      createXrefNavigation(async (target) => this.openXrefTarget(target)),
      ...(this.settings.diagnosticsEnabled ? [createDiagnosticsExtension()] : []),
    ]);

    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerCommands();

    await this.reindexWorkspace();
  }

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(ANTORA_EXPLORER_VIEW_TYPE);
    await this.app.workspace.detachLeavesOfType(DIAGNOSTICS_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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
      id: 'run-antora-build',
      name: 'Run Antora build',
      callback: async () => {
        const command = this.settings.buildCommandOverride.trim() || `${this.settings.antoraExecutablePath} ${this.settings.antoraPlaybookPath}`;
        try {
          const result = await this.buildRunner.run(command);
          new Notice(`Antora build completed. ${result.stderr ? 'Check console for warnings.' : ''}`);
        } catch (error) {
          this.logger.error('Antora build failed', error);
          new Notice('Antora build failed. Check developer console.');
        }
      },
    });
  }

  private async reindexWorkspace(): Promise<void> {
    const scan = await this.scanner.scan(this.index);
    if (!scan.isAntoraWorkspace) {
      new Notice('No Antora project detected in this vault.');
      return;
    }

    const view = this.getExplorerView();
    view?.render();
    new Notice(`Indexed ${scan.projects.length} Antora project(s).`);
  }

  private async openDiagnosticsView(diagnostics: Awaited<ReturnType<DiagnosticsService['validateWorkspace']>>): Promise<void> {
    const leaf = await this.activateView(DIAGNOSTICS_VIEW_TYPE);
    const view = leaf.view;
    if (view instanceof DiagnosticsView) {
      view.setDiagnostics(diagnostics);
    }
  }

  private async openXrefTarget(rawTarget: string): Promise<void> {
    const resolved = this.pathResolver.resolveXrefTarget(rawTarget);
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
