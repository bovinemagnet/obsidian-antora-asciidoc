import { ItemView, WorkspaceLeaf } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';

export const ANTORA_EXPLORER_VIEW_TYPE = 'antora-explorer';

export class AntoraExplorerView extends ItemView {
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
        const versionEl = root.createEl('div', { text: `Version: ${version.version}` });
        versionEl.addClass('antora-explorer-version');

        for (const module of version.modules.values()) {
          const moduleEl = root.createEl('div', { text: `Module: ${module.name}` });
          moduleEl.addClass('antora-explorer-module');

          moduleEl.createEl('div', { text: `Pages (${module.pages.length})` });
          moduleEl.createEl('div', { text: `Partials (${module.partials.length})` });
          moduleEl.createEl('div', { text: `Examples (${module.examples.length})` });
          moduleEl.createEl('div', { text: `Assets (${module.images.length})` });
        }
      }
    }
  }
}
