import { ItemView } from 'obsidian';

import { Diagnostic } from '../diagnostics/Diagnostic';

export const BUILD_CONSOLE_VIEW_TYPE = 'antora-build-console';

/**
 * Append-only stream of build output lines, capped to keep the DOM small for
 * long builds. A footer summarises exit code and parsed diagnostics once the
 * build completes.
 */
export class BuildConsoleView extends ItemView {
  private static readonly MAX_LINES = 5000;

  private logEl!: HTMLElement;
  private summaryEl!: HTMLElement;
  private lineCount = 0;

  getViewType(): string {
    return BUILD_CONSOLE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Antora Build Console';
  }

  getIcon(): string {
    return 'terminal';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-build-console');

    this.summaryEl = contentEl.createDiv({ cls: 'antora-build-console-summary' });
    this.logEl = contentEl.createDiv({ cls: 'antora-build-console-log' });
  }

  startRun(command: string): void {
    this.lineCount = 0;
    if (!this.logEl) {
      // onOpen hasn't fired yet (view created without being shown). Defer.
      return;
    }
    this.logEl.empty();
    this.summaryEl.empty();
    this.summaryEl.createEl('p', { text: `Running: ${command}` });
  }

  appendLine(stream: 'stdout' | 'stderr', line: string): void {
    if (!this.logEl) {
      return;
    }
    const lineEl = this.logEl.createDiv({
      cls: stream === 'stderr' ? 'antora-build-line antora-build-line-stderr' : 'antora-build-line',
      text: line,
    });
    this.lineCount += 1;
    if (this.lineCount > BuildConsoleView.MAX_LINES) {
      this.logEl.firstElementChild?.remove();
    }
    lineEl.scrollIntoView({ block: 'end' });
  }

  finish(exitCode: number, diagnostics: Diagnostic[]): void {
    if (!this.summaryEl) {
      return;
    }
    this.summaryEl.empty();
    const status = this.summaryEl.createEl('p', {
      text: `Exit code: ${exitCode} • diagnostics: ${diagnostics.length}`,
    });
    if (exitCode !== 0) {
      status.addClass('antora-build-failed');
    }
  }
}
