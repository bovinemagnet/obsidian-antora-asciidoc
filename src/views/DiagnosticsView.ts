import { ItemView, MarkdownView, Notice, TFile } from 'obsidian';

import { Diagnostic, DiagnosticSeverity } from '../diagnostics/Diagnostic';

export const DIAGNOSTICS_VIEW_TYPE = 'antora-diagnostics';

const ALL_SEVERITIES: DiagnosticSeverity[] = ['error', 'warning', 'info'];

export class DiagnosticsView extends ItemView {
  private diagnostics: Diagnostic[] = [];
  private enabledSeverities: Set<DiagnosticSeverity> = new Set(ALL_SEVERITIES);

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

  getAllDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  private filtered(): Diagnostic[] {
    return this.diagnostics.filter((d) => this.enabledSeverities.has(d.severity));
  }

  private toggleSeverity(severity: DiagnosticSeverity): void {
    if (this.enabledSeverities.has(severity)) {
      this.enabledSeverities.delete(severity);
    } else {
      this.enabledSeverities.add(severity);
    }
    this.render();
  }

  private async copyToClipboard(): Promise<void> {
    const text = this.filtered()
      .map((d) => `${d.severity.toUpperCase()} ${d.filePath}:${d.line}:${d.column} — ${d.message}`)
      .join('\n');
    if (!text) {
      new Notice('Nothing to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      new Notice('Diagnostics copied to clipboard.');
    } catch {
      new Notice('Clipboard write failed.');
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-diagnostics-pane');

    this.renderToolbar(contentEl);

    const visible = this.filtered();
    if (visible.length === 0) {
      contentEl.createEl('p', { text: this.diagnostics.length === 0 ? 'No diagnostics.' : 'No diagnostics match the active filter.' });
      return;
    }

    const list = contentEl.createEl('ul', { cls: 'antora-diagnostics-list' });
    for (const diagnostic of visible) {
      const item = list.createEl('li', { cls: `antora-diagnostic antora-diagnostic-${diagnostic.severity}` });
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

  private renderToolbar(parent: HTMLElement): void {
    const bar = parent.createDiv({ cls: 'antora-diagnostics-toolbar' });
    for (const severity of ALL_SEVERITIES) {
      const count = this.diagnostics.filter((d) => d.severity === severity).length;
      const enabled = this.enabledSeverities.has(severity);
      const chip = bar.createEl('button', {
        text: `${severity} (${count})`,
        cls: `antora-diagnostics-chip antora-diagnostics-chip-${severity}${enabled ? ' is-active' : ''}`,
      });
      chip.onclick = () => this.toggleSeverity(severity);
    }
    const copy = bar.createEl('button', { text: 'Copy', cls: 'antora-diagnostics-copy' });
    copy.onclick = () => void this.copyToClipboard();
  }
}
