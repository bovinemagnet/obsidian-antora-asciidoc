import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { NavigationEntry } from '../antora/NavigationParser';

export const ANTORA_EXPLORER_VIEW_TYPE = 'antora-explorer';

export interface ExplorerPinSource {
  /** Returns the current set of pinned vault paths. */
  list(): string[];
  /** Removes a pin (used when the user clicks the unpin glyph). */
  unpin(path: string): Promise<void>;
}

export class AntoraExplorerView extends ItemView {
  private readonly resolver = new AntoraPathResolver();
  private filterText = '';
  private pinSource: ExplorerPinSource | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: AntoraComponentIndex,
  ) {
    super(leaf);
  }

  setPinSource(source: ExplorerPinSource): void {
    this.pinSource = source;
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
    contentEl.addClass('antora-explorer-pane');

    this.renderFilter(contentEl);
    this.renderPinned(contentEl);

    const root = contentEl.createDiv({ cls: 'antora-explorer-tree' });
    const filter = this.filterText.toLowerCase().trim();
    let renderedSomething = false;

    for (const component of this.index.getComponents()) {
      const componentBlock = document.createElement('div');
      const componentMatched = filter !== '' && component.name.toLowerCase().includes(filter);
      let componentHasContent = false;

      const componentEl = componentBlock.createEl('h4', { text: component.name });
      componentEl.addClass('antora-explorer-component');

      for (const version of component.versions.values()) {
        componentBlock.createEl('div', { text: `Version: ${version.version}`, cls: 'antora-explorer-version' });

        for (const module of version.modules.values()) {
          const moduleMatched = componentMatched
            || filter === ''
            || module.name.toLowerCase().includes(filter);
          const matchingPages = filter === ''
            ? module.pages
            : module.pages.filter((p) => p.path.toLowerCase().includes(filter)
              || (p.title?.toLowerCase().includes(filter) ?? false));

          if (!moduleMatched && matchingPages.length === 0) {
            continue;
          }

          const moduleEl = componentBlock.createEl('div', { cls: 'antora-explorer-module' });
          moduleEl.createEl('div', { text: `Module: ${module.name}`, cls: 'antora-explorer-module-header' });

          const componentRoot = this.deriveComponentRoot(module.pages[0]?.filePath);
          const navEntries = componentRoot
            ? this.index.getNavigation(componentRoot, module.name)
            : [];

          if (navEntries.length > 0 && filter === '') {
            this.renderNavTree(moduleEl, navEntries, component.name, module.name);
          } else if (filter !== '' && matchingPages.length > 0) {
            this.renderPageList(moduleEl, matchingPages);
          } else {
            moduleEl.createEl('div', { text: `Pages (${module.pages.length})` });
          }

          moduleEl.createEl('div', { text: `Partials (${module.partials.length})`, cls: 'antora-explorer-counts' });
          moduleEl.createEl('div', { text: `Examples (${module.examples.length})`, cls: 'antora-explorer-counts' });
          moduleEl.createEl('div', { text: `Assets (${module.images.length})`, cls: 'antora-explorer-counts' });
          componentHasContent = true;
        }
      }

      if (componentHasContent) {
        root.appendChild(componentBlock);
        renderedSomething = true;
      }
    }

    if (!renderedSomething) {
      root.createEl('p', { text: filter ? 'No matches.' : 'No Antora components indexed.', cls: 'antora-explorer-empty' });
    }
  }

  private renderPinned(parent: HTMLElement): void {
    if (!this.pinSource) {
      return;
    }
    const pinned = this.pinSource.list();
    if (pinned.length === 0) {
      return;
    }
    const section = parent.createDiv({ cls: 'antora-explorer-pinned' });
    section.createEl('div', { text: 'Pinned', cls: 'antora-explorer-pinned-header' });
    const list = section.createEl('ul', { cls: 'antora-explorer-nav' });
    for (const path of pinned) {
      const item = list.createEl('li');
      const link = item.createEl('a', {
        text: path.split('/').pop() ?? path,
        cls: 'antora-explorer-nav-link',
        attr: { title: path },
      });
      link.href = '#';
      link.onclick = async (event) => {
        event.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
          await leaf.openFile(file);
        }
      };
      const unpin = item.createEl('button', { text: '✕', cls: 'antora-explorer-pin-button' });
      unpin.onclick = async (event) => {
        event.preventDefault();
        await this.pinSource?.unpin(path);
        this.render();
      };
    }
  }

  private renderFilter(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: 'antora-explorer-filter' });
    const input = bar.createEl('input', {
      attr: { type: 'search', placeholder: 'Filter pages, modules, components…' },
      cls: 'antora-explorer-filter-input',
    });
    input.value = this.filterText;
    input.oninput = () => {
      this.filterText = input.value;
      this.render();
      // Re-focus the input after re-render so typing keeps flowing.
      const reborn = parent.querySelector<HTMLInputElement>('.antora-explorer-filter-input');
      if (reborn) {
        reborn.focus();
        reborn.setSelectionRange(input.value.length, input.value.length);
      }
    };
  }

  private renderPageList(container: HTMLElement, pages: Array<{ path: string; filePath: string; title?: string }>): void {
    const list = container.createEl('ul', { cls: 'antora-explorer-nav' });
    for (const page of pages) {
      const item = list.createEl('li');
      const link = item.createEl('a', {
        text: page.title ? `${page.title} (${page.path})` : page.path,
        cls: 'antora-explorer-nav-link',
      });
      link.href = '#';
      link.onclick = async (event) => {
        event.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(page.filePath);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
          await leaf.openFile(file);
        }
      };
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
