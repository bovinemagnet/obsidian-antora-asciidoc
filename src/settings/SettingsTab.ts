import { App, Platform, PluginSettingTab, Setting } from 'obsidian';

import AntoraAsciidocPlugin from '../main';

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AntoraAsciidocPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Enable diagnostics')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.diagnosticsEnabled).onChange(async (value) => {
          this.plugin.settings.diagnosticsEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Auto-validate on save')
      .setDesc('Re-run xref/include/attribute checks shortly after a file changes.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoValidateOnSave).onChange(async (value) => {
          this.plugin.settings.autoValidateOnSave = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Sync xrefs to Obsidian graph')
      .setDesc('Inject xref edges into Obsidian’s graph view. Uses an undocumented API; disable if the graph misbehaves.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncToObsidianGraph).onChange(async (value) => {
          this.plugin.settings.syncToObsidianGraph = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Include `include::` edges in graph sync')
      .setDesc('Also emit edges for include directives. Produces denser graphs.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncIncludeEdgesToGraph).onChange(async (value) => {
          this.plugin.settings.syncIncludeEdgesToGraph = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Enable autocomplete')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autocompleteEnabled).onChange(async (value) => {
          this.plugin.settings.autocompleteEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Antora executable path')
      .addText((text) =>
        text.setValue(this.plugin.settings.antoraExecutablePath).onChange(async (value) => {
          this.plugin.settings.antoraExecutablePath = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Antora playbook path')
      .addText((text) =>
        text.setValue(this.plugin.settings.antoraPlaybookPath).onChange(async (value) => {
          this.plugin.settings.antoraPlaybookPath = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Build command override')
      .addText((text) =>
        text.setValue(this.plugin.settings.buildCommandOverride).onChange(async (value) => {
          this.plugin.settings.buildCommandOverride = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Include file extensions')
      .setDesc('Comma separated list like .adoc,.asciidoc')
      .addText((text) =>
        text.setValue(this.plugin.settings.includeFileExtensions.join(',')).onChange(async (value) => {
          this.plugin.settings.includeFileExtensions = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Ignore paths')
      .setDesc('Comma separated vault paths to ignore')
      .addText((text) =>
        text.setValue(this.plugin.settings.ignorePaths.join(',')).onChange(async (value) => {
          this.plugin.settings.ignorePaths = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
          await this.plugin.saveSettings();
        }),
      );

    if (Platform.isDesktop) {
      new Setting(containerEl)
        .setName('External content roots')
        .setDesc('Comma separated absolute paths scanned in addition to the vault. Reload the plugin after changing.')
        .addText((text) =>
          text.setValue(this.plugin.settings.externalContentRoots.join(',')).onChange(async (value) => {
            this.plugin.settings.externalContentRoots = value
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName('Vale executable')
        .setDesc('Command used to run Vale. Leave empty to disable.')
        .addText((text) =>
          text.setValue(this.plugin.settings.valeExecutablePath).onChange(async (value) => {
            this.plugin.settings.valeExecutablePath = value.trim();
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName('Vale working directory')
        .setDesc('Directory containing .vale.ini. Defaults to the playbook directory when empty.')
        .addText((text) =>
          text.setValue(this.plugin.settings.valeWorkingDirectory).onChange(async (value) => {
            this.plugin.settings.valeWorkingDirectory = value.trim();
            await this.plugin.saveSettings();
          }),
        );
    }
  }
}
