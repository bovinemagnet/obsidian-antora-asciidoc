export interface PluginSettings {
  diagnosticsEnabled: boolean;
  autocompleteEnabled: boolean;
  antoraExecutablePath: string;
  antoraPlaybookPath: string;
  buildCommandOverride: string;
  includeFileExtensions: string[];
  ignorePaths: string[];
  /**
   * Absolute filesystem roots scanned in addition to the Obsidian vault.
   * Used for Antora content sources that live outside the vault (e.g. a
   * sibling git checkout referenced from playbook.yml). Desktop only.
   */
  externalContentRoots: string[];
  /** Path or name of the Vale executable. Empty disables the integration. */
  valeExecutablePath: string;
  /** Optional working directory for Vale. Falls back to the playbook directory. */
  valeWorkingDirectory: string;
  /** When true, modify-debounced revalidation runs on the active file. */
  autoValidateOnSave: boolean;
  /** Debounce in milliseconds for auto-validation (defaults to 750ms). */
  autoValidateDebounceMs: number;
  /**
   * When true, after each scan the plugin writes its xref edges into
   * Obsidian's `metadataCache.resolvedLinks` so the graph view shows them.
   * Uses an undocumented Obsidian API — disable if a future Obsidian release
   * misbehaves.
   */
  syncToObsidianGraph: boolean;
  /** When true, also include `include::` edges in the graph sync. */
  syncIncludeEdgesToGraph: boolean;
  /** When true, opening an .adoc file automatically opens the AsciiDoc preview pane. */
  autoOpenPreview: boolean;
  /** Enabled in-house lint rules. Each toggle flips one validator on/off. */
  lintRules: {
    xref: boolean;
    include: boolean;
    attribute: boolean;
    headingHierarchy: boolean;
  };
  /** Vault paths the user has pinned for quick access in the Antora Explorer. */
  pinnedPages: string[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  diagnosticsEnabled: true,
  autocompleteEnabled: true,
  antoraExecutablePath: 'antora',
  antoraPlaybookPath: 'site.yml',
  buildCommandOverride: '',
  includeFileExtensions: ['.adoc', '.asciidoc'],
  ignorePaths: [],
  externalContentRoots: [],
  valeExecutablePath: 'vale',
  valeWorkingDirectory: '',
  autoValidateOnSave: true,
  autoValidateDebounceMs: 750,
  syncToObsidianGraph: false,
  syncIncludeEdgesToGraph: false,
  autoOpenPreview: false,
  lintRules: {
    xref: true,
    include: true,
    attribute: true,
    headingHierarchy: true,
  },
  pinnedPages: [],
};
