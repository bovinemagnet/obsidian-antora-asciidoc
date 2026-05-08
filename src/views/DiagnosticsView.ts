import { ItemView, MarkdownView, TFile } from 'obsidian';

import { Diagnostic } from '../diagnostics/Diagnostic';

export const DIAGNOSTICS_VIEW_TYPE = 'antora-diagnostics';

export class DiagnosticsView extends ItemView {
  private diagnostics: Diagnostic[] = [];

  getViewType(): string {
    return DIAGNOSTICS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Antora Diagnostics';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  setDiagnostics(diagnostics: Diagnostic[]): void {
    this.diagnostics = diagnostics;
    this.render();
  }

  /**
   * Replaces only the diagnostics for the given file path while keeping any
   * other entries in place. Used by auto-validation so a single-file refresh
   * does not blow away results from a prior workspace validation.
   */
  replaceDiagnosticsForFile(filePath: string, fileDiagnostics: Diagnostic[]): void {
    this.diagnostics = [
      ...this.diagnostics.filter((diagnostic) => diagnostic.filePath !== filePath),
      ...fileDiagnostics,
    ];
    this.render();
  }

  getDiagnosticsForFile(filePath: string): Diagnostic[] {
    return this.diagnostics.filter((diagnostic) => diagnostic.filePath === filePath);
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    if (this.diagnostics.length === 0) {
      contentEl.createEl('p', { text: 'No diagnostics.' });
      return;
    }

    const list = contentEl.createEl('ul');
    for (const diagnostic of this.diagnostics) {
      const item = list.createEl('li');
      const link = item.createEl('a', {
        text: `${diagnostic.severity.toUpperCase()} ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} — ${diagnostic.message}`,
      });
      link.href = '#';
      link.onclick = async (event) => {
        event.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(diagnostic.filePath);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
          await leaf.openFile(file);
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          view?.editor?.setCursor({ line: diagnostic.line - 1, ch: diagnostic.column - 1 });
        }
      };
    }
  }
}
