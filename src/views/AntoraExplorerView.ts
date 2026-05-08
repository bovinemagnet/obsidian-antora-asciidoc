import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { NavigationEntry } from '../antora/NavigationParser';

export const ANTORA_EXPLORER_VIEW_TYPE = 'antora-explorer';

export class AntoraExplorerView extends ItemView {
  private readonly resolver = new AntoraPathResolver();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: AntoraComponentIndex,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ANTORA_EXPLORER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Antora Explorer';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const root = contentEl.createDiv({ cls: 'antora-explorer-tree' });
    for (const component of this.index.getComponents()) {
      const componentEl = root.createEl('h4', { text: component.name });
      componentEl.addClass('antora-explorer-component');

      for (const version of component.versions.values()) {
        root.createEl('div', { text: `Version: ${version.version}`, cls: 'antora-explorer-version' });

        for (const module of version.modules.values()) {
          const moduleEl = root.createEl('div', { cls: 'antora-explorer-module' });
          moduleEl.createEl('div', { text: `Module: ${module.name}`, cls: 'antora-explorer-module-header' });

          const componentRoot = this.deriveComponentRoot(module.pages[0]?.filePath);
          const navEntries = componentRoot
            ? this.index.getNavigation(componentRoot, module.name)
            : [];

          if (navEntries.length > 0) {
            this.renderNavTree(moduleEl, navEntries, component.name, module.name);
          } else {
            moduleEl.createEl('div', { text: `Pages (${module.pages.length})` });
          }

          moduleEl.createEl('div', { text: `Partials (${module.partials.length})`, cls: 'antora-explorer-counts' });
          moduleEl.createEl('div', { text: `Examples (${module.examples.length})`, cls: 'antora-explorer-counts' });
          moduleEl.createEl('div', { text: `Assets (${module.images.length})`, cls: 'antora-explorer-counts' });
        }
      }
    }
  }

  private renderNavTree(
    container: HTMLElement,
    entries: NavigationEntry[],
    defaultComponent: string,
    defaultModule: string,
  ): void {
    const list = container.createEl('ul', { cls: 'antora-explorer-nav' });
    for (const entry of entries) {
      const item = list.createEl('li');
      if (entry.target) {
        const link = item.createEl('a', { text: entry.label, cls: 'antora-explorer-nav-link' });
        link.href = '#';
        link.onclick = (event) => {
          event.preventDefault();
          void this.openTarget(entry.target!, defaultComponent, defaultModule);
        };
      } else {
        item.createSpan({ text: entry.label, cls: 'antora-explorer-nav-label' });
      }
      if (entry.children.length > 0) {
        this.renderNavTree(item, entry.children, defaultComponent, defaultModule);
      }
    }
  }

  private async openTarget(rawTarget: string, defaultComponent: string, defaultModule: string): Promise<void> {
    const resolved = this.resolver.resolveXrefTarget(rawTarget, {
      component: defaultComponent,
      module: defaultModule,
    });
    const page = this.index.resolvePage(resolved);
    if (!page) {
      new Notice(`Unresolved nav target: ${rawTarget}`);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(page.filePath);
    if (!(file instanceof TFile)) {
      new Notice(`Page file not found in vault: ${page.filePath}`);
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  private deriveComponentRoot(samplePath: string | undefined): string | undefined {
    if (!samplePath) {
      return undefined;
    }
    const idx = samplePath.indexOf('/modules/');
    return idx > 0 ? samplePath.slice(0, idx) : undefined;
  }
}
