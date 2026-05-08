import { App, PluginSettingTab, Setting } from 'obsidian';

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
  }
}
