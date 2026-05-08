import { ItemView, MarkdownView, TFile } from 'obsidian';

import { extractOutline, OutlineEntry } from '../asciidoc/PageOutlineExtractor';
import { isAsciiDocPath } from '../util/FileUtils';

export const PAGE_OUTLINE_VIEW_TYPE = 'antora-page-outline';

/**
 * Sidebar view that lists every heading and explicit anchor in the active
 * AsciiDoc file. Each entry jumps the editor cursor to the corresponding
 * line. Refreshes on active-leaf-change and on file modify.
 */
export class PageOutlineView extends ItemView {
  private currentFile: TFile | null = null;
  private currentEntries: OutlineEntry[] = [];

  getViewType(): string {
    return PAGE_OUTLINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'AsciiDoc outline';
  }

  getIcon(): string {
    return 'list';
  }

  async onOpen(): Promise<void> {
    await this.refreshFromActiveFile();
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshFromActiveFile()));
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && file === this.currentFile) {
        void this.refreshFromActiveFile();
      }
    }));
  }

  async refreshFromActiveFile(): Promise<void> {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.file
      ?? this.app.workspace.getActiveFile();
    if (active instanceof TFile && isAsciiDocPath(active.path)) {
      this.currentFile = active;
      const content = await this.app.vault.cachedRead(active);
      this.currentEntries = extractOutline(content);
    } else {
      this.currentFile = null;
      this.currentEntries = [];
    }
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-outline-pane');

    if (!this.currentFile) {
      contentEl.createEl('p', { text: 'Open an .adoc or .asciidoc file to see its outline.', cls: 'antora-outline-empty' });
      return;
    }
    if (this.currentEntries.length === 0) {
      contentEl.createEl('p', { text: 'No headings or anchors in this file.', cls: 'antora-outline-empty' });
      return;
    }

    const list = contentEl.createEl('ul', { cls: 'antora-outline-list' });
    for (const entry of this.currentEntries) {
      const indent = entry.kind === 'heading' ? Math.max(0, entry.level - 1) : 6;
      const item = list.createEl('li', {
        cls: `antora-outline-entry antora-outline-entry-${entry.kind} antora-outline-indent-${indent}`,
      });
      const link = item.createEl('a', { text: entry.kind === 'anchor' ? `[[${entry.text}]]` : entry.text });
      link.href = '#';
      link.onclick = (event) => {
        event.preventDefault();
        void this.jumpTo(entry);
      };
    }
  }

  private async jumpTo(entry: OutlineEntry): Promise<void> {
    if (!this.currentFile) {
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(this.currentFile);
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    view?.editor?.setCursor({ line: entry.line - 1, ch: 0 });
  }
}
