import { App, Modal, Setting } from 'obsidian';

export interface RenamePromptOptions {
  title: string;
  initialValue: string;
  description?: string;
  /** Optional checkbox shown above the text input. */
  toggle?: { label: string; description?: string; initialValue?: boolean };
  /** Async preview hook called whenever the user clicks Preview; returns a count. */
  onPreview?: (value: string, toggleValue: boolean) => Promise<number>;
  onSubmit: (value: string, toggleValue: boolean) => Promise<void> | void;
}

/**
 * Lightweight rename prompt. Shows a single text input prefilled with the
 * current name and a "Preview references" button that surfaces the impact
 * count before the user commits.
 */
export class RenameModal extends Modal {
  private value: string;
  private toggleValue: boolean;

  constructor(app: App, private readonly options: RenamePromptOptions) {
    super(app);
    this.value = options.initialValue;
    this.toggleValue = options.toggle?.initialValue === true;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.options.title);
    contentEl.empty();

    if (this.options.description) {
      contentEl.createEl('p', { text: this.options.description, cls: 'antora-rename-modal-description' });
    }

    const previewEl = contentEl.createDiv({ cls: 'antora-rename-modal-preview' });

    if (this.options.toggle) {
      const toggleConfig = this.options.toggle;
      new Setting(contentEl)
        .setName(toggleConfig.label)
        .setDesc(toggleConfig.description ?? '')
        .addToggle((t) => t.setValue(this.toggleValue).onChange((v) => {
          this.toggleValue = v;
          previewEl.empty();
        }));
    }

    new Setting(contentEl)
      .setName('New name')
      .addText((text) => {
        text.setValue(this.value).onChange((value) => {
          this.value = value.trim();
          previewEl.empty();
        });
        text.inputEl.focus();
        text.inputEl.select();
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText('Preview references');
        if (!this.options.onPreview) {
          button.setDisabled(true);
        } else {
          button.onClick(async () => {
            const onPreview = this.options.onPreview;
            if (!onPreview) {
              return;
            }
            previewEl.empty();
            try {
              const count = await onPreview(this.value, this.toggleValue);
              previewEl.createEl('p', { text: `${count} reference(s) will be updated.` });
            } catch (error) {
              previewEl.createEl('p', {
                text: `Preview failed: ${error instanceof Error ? error.message : String(error)}`,
                cls: 'antora-rename-modal-error',
              });
            }
          });
        }
      })
      .addButton((button) => {
        button.setButtonText('Apply').setCta().onClick(async () => {
          this.close();
          await this.options.onSubmit(this.value, this.toggleValue);
        });
      })
      .addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
