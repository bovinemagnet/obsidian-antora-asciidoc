import { App, Modal, Setting } from 'obsidian';

import { BulkReplaceMatch } from './BulkReplace';

export interface BulkReplacePromptOptions {
  initialPattern: string;
  initialReplacement: string;
  /**
   * Async preview hook — called when the user clicks Preview. Returns the
   * matches the modal renders.
   */
  onPreview: (input: { pattern: string; replacement: string; regex: boolean; caseSensitive: boolean }) => Promise<BulkReplaceMatch[]>;
  onSubmit: (input: { pattern: string; replacement: string; regex: boolean; caseSensitive: boolean }) => Promise<void>;
}

/**
 * Bulk find-and-replace modal. Inputs for pattern, replacement, regex and
 * case-sensitivity toggles. The preview button populates a scrollable list
 * of every match found across .adoc files. Apply commits via the supplied
 * onSubmit callback.
 */
export class BulkReplaceModal extends Modal {
  private pattern: string;
  private replacement: string;
  private regex = false;
  private caseSensitive = true;

  constructor(app: App, private readonly options: BulkReplacePromptOptions) {
    super(app);
    this.pattern = options.initialPattern;
    this.replacement = options.initialReplacement;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText('Bulk find and replace');
    contentEl.empty();

    const previewEl = contentEl.createDiv({ cls: 'antora-bulk-preview' });

    new Setting(contentEl)
      .setName('Find')
      .addText((t) => {
        t.setValue(this.pattern).onChange((v) => { this.pattern = v; previewEl.empty(); });
        t.inputEl.focus();
      });

    new Setting(contentEl)
      .setName('Replace with')
      .addText((t) => t.setValue(this.replacement).onChange((v) => { this.replacement = v; previewEl.empty(); }));

    new Setting(contentEl)
      .setName('Use regex')
      .addToggle((t) => t.setValue(this.regex).onChange((v) => { this.regex = v; previewEl.empty(); }));

    new Setting(contentEl)
      .setName('Case-sensitive')
      .addToggle((t) => t.setValue(this.caseSensitive).onChange((v) => { this.caseSensitive = v; previewEl.empty(); }));

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Preview matches').onClick(async () => {
        previewEl.empty();
        try {
          const matches = await this.options.onPreview(this.input());
          this.renderPreview(previewEl, matches);
        } catch (error) {
          previewEl.createEl('p', {
            text: `Preview failed: ${error instanceof Error ? error.message : String(error)}`,
            cls: 'antora-rename-modal-error',
          });
        }
      }))
      .addButton((b) => b.setButtonText('Apply').setCta().onClick(async () => {
        if (!this.pattern) {
          previewEl.empty();
          previewEl.createEl('p', { text: 'Find pattern is empty.', cls: 'antora-rename-modal-error' });
          return;
        }
        this.close();
        await this.options.onSubmit(this.input());
      }))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private input(): { pattern: string; replacement: string; regex: boolean; caseSensitive: boolean } {
    return { pattern: this.pattern, replacement: this.replacement, regex: this.regex, caseSensitive: this.caseSensitive };
  }

  private renderPreview(parent: HTMLElement, matches: BulkReplaceMatch[]): void {
    parent.empty();
    parent.createEl('p', { text: `${matches.length} match(es) across ${new Set(matches.map((m) => m.filePath)).size} file(s).` });
    if (matches.length === 0) {
      return;
    }
    const list = parent.createEl('ul', { cls: 'antora-bulk-preview-list' });
    const sliced = matches.slice(0, 200);
    for (const m of sliced) {
      const item = list.createEl('li');
      item.createSpan({ text: `${m.filePath}:${m.line}:${m.column}`, cls: 'antora-bulk-preview-loc' });
      item.createSpan({ text: ` — ${m.context}`, cls: 'antora-bulk-preview-ctx' });
    }
    if (matches.length > sliced.length) {
      parent.createEl('p', { text: `… and ${matches.length - sliced.length} more.` });
    }
  }
}
