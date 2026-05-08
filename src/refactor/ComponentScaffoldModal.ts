import { App, Modal, Setting } from 'obsidian';

export interface ComponentScaffoldPromptOptions {
  /** Initial component name (defaults to vaultRoot's last segment). */
  initialName: string;
  /** Initial version. */
  initialVersion: string;
  /** Initial vault folder. */
  initialRoot: string;
  onSubmit: (input: { name: string; version: string; root: string; title: string }) => Promise<void>;
}

/**
 * Three-input modal for the "New Antora component" command. Validates
 * non-empty inputs before allowing submission.
 */
export class ComponentScaffoldModal extends Modal {
  private name: string;
  private version: string;
  private root: string;
  private title: string;

  constructor(app: App, private readonly options: ComponentScaffoldPromptOptions) {
    super(app);
    this.name = options.initialName;
    this.version = options.initialVersion;
    this.root = options.initialRoot;
    this.title = '';
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText('New Antora component');
    contentEl.empty();

    new Setting(contentEl)
      .setName('Component name')
      .setDesc('Used as the value of `name:` in antora.yml. Lowercase, hyphenated.')
      .addText((t) => t.setValue(this.name).onChange((v) => { this.name = v.trim(); }));

    new Setting(contentEl)
      .setName('Version')
      .setDesc("e.g. 1.0, 2.0, or 'master'.")
      .addText((t) => t.setValue(this.version).onChange((v) => { this.version = v.trim(); }));

    new Setting(contentEl)
      .setName('Vault folder')
      .setDesc('Folder created in the vault root. Defaults to the component name.')
      .addText((t) => t.setValue(this.root).onChange((v) => { this.root = v.trim(); }));

    new Setting(contentEl)
      .setName('Display title')
      .setDesc('Optional. Defaults to a Title Case of the component name.')
      .addText((t) => t.setValue(this.title).onChange((v) => { this.title = v.trim(); }));

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Create').setCta().onClick(async () => {
        if (!this.name || !this.version || !this.root) {
          // Don't submit invalid input; surface a small message.
          contentEl.createEl('p', { text: 'Name, version, and vault folder are required.', cls: 'antora-rename-modal-error' });
          return;
        }
        this.close();
        await this.options.onSubmit({ name: this.name, version: this.version, root: this.root, title: this.title });
      }))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
