export interface PluginSettings {
  diagnosticsEnabled: boolean;
  autocompleteEnabled: boolean;
  antoraExecutablePath: string;
  antoraPlaybookPath: string;
  buildCommandOverride: string;
  includeFileExtensions: string[];
  ignorePaths: string[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  diagnosticsEnabled: true,
  autocompleteEnabled: true,
  antoraExecutablePath: 'antora',
  antoraPlaybookPath: 'site.yml',
  buildCommandOverride: '',
  includeFileExtensions: ['.adoc', '.asciidoc'],
  ignorePaths: [],
};
