import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { isAsciiDocPath } from '../util/FileUtils';

export const MODULE_DESCRIPTOR_VIEW_TYPE = 'antora-module-descriptor';

/**
 * Sidebar view that summarises the active page's component descriptor:
 * which Antora component owns it, the version, the module's resource
 * counts, and the descriptor-scope attribute map. Useful for confirming
 * the rendering context at a glance and spotting attribute mismatches
 * across components.
 */
export class ModuleDescriptorView extends ItemView {
  private currentFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly index: AntoraComponentIndex) {
    super(leaf);
  }

  getViewType(): string {
    return MODULE_DESCRIPTOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Antora module descriptor';
  }

  getIcon(): string {
    return 'box';
  }

  async onOpen(): Promise<void> {
    this.refresh();
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()));
  }

  refresh(): void {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.file
      ?? this.app.workspace.getActiveFile();
    this.currentFile = active instanceof TFile && isAsciiDocPath(active.path) ? active : null;
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-descriptor-pane');

    if (!this.currentFile) {
      contentEl.createEl('p', { text: 'Open an .adoc or .asciidoc file to see its descriptor.', cls: 'antora-descriptor-empty' });
      return;
    }

    const page = this.index.getPageByFilePath(this.currentFile.path);
    if (!page) {
      const ctx = this.index.getComponentContextForPath(this.currentFile.path);
      contentEl.createEl('p', {
        text: ctx
          ? `${this.currentFile.path} sits under ${ctx.component}:${ctx.module} but isn't indexed as a page.`
          : `${this.currentFile.path} isn't part of any indexed Antora component.`,
        cls: 'antora-descriptor-empty',
      });
      return;
    }

    const summary = contentEl.createDiv({ cls: 'antora-descriptor-section' });
    summary.createEl('h4', { text: 'Page' });
    this.appendKeyValue(summary, 'Component', page.component);
    this.appendKeyValue(summary, 'Version', page.version);
    this.appendKeyValue(summary, 'Module', page.module);
    this.appendKeyValue(summary, 'Page path', page.path);
    if (page.title) {
      this.appendKeyValue(summary, 'Title', page.title);
    }
    this.appendKeyValue(summary, 'Anchors', String(page.anchors.size));

    const moduleSection = contentEl.createDiv({ cls: 'antora-descriptor-section' });
    moduleSection.createEl('h4', { text: 'Module resources' });
    const module = this.findModule(page);
    if (module) {
      this.appendKeyValue(moduleSection, 'Pages', String(module.pages.length));
      this.appendKeyValue(moduleSection, 'Partials', String(module.partials.length));
      this.appendKeyValue(moduleSection, 'Examples', String(module.examples.length));
      this.appendKeyValue(moduleSection, 'Images', String(module.images.length));
    }

    const attributesSection = contentEl.createDiv({ cls: 'antora-descriptor-section' });
    attributesSection.createEl('h4', { text: 'Descriptor attributes' });
    const attrs = this.index.getDescriptorAttributesFor(this.currentFile.path);
    if (attrs.size === 0) {
      attributesSection.createEl('p', { text: 'No descriptor attributes defined.', cls: 'antora-descriptor-empty' });
    } else {
      const list = attributesSection.createEl('ul', { cls: 'antora-descriptor-attrs' });
      for (const [name, value] of [...attrs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const item = list.createEl('li');
        item.createEl('span', { text: name, cls: 'antora-descriptor-attr-name' });
        item.createEl('span', { text: ' = ', cls: 'antora-descriptor-attr-eq' });
        item.createEl('span', { text: value, cls: 'antora-descriptor-attr-value' });
      }
    }
  }

  private appendKeyValue(parent: HTMLElement, key: string, value: string): void {
    const row = parent.createDiv({ cls: 'antora-descriptor-row' });
    row.createSpan({ text: key, cls: 'antora-descriptor-key' });
    row.createSpan({ text: value, cls: 'antora-descriptor-value' });
  }

  private findModule(page: ReturnType<AntoraComponentIndex['getPageByFilePath']>): { pages: unknown[]; partials: string[]; examples: string[]; images: string[] } | null {
    if (!page) {
      return null;
    }
    for (const component of this.index.getComponents()) {
      if (component.name !== page.component) {
        continue;
      }
      for (const version of component.versions.values()) {
        if (version.version !== page.version) {
          continue;
        }
        const module = version.modules.get(page.module);
        if (module) {
          return module;
        }
      }
    }
    return null;
  }
}
