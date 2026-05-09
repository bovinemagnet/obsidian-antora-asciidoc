import { App, FuzzySuggestModal, Notice, TFile } from 'obsidian';

import { AntoraComponentIndex, AntoraPageEntry } from '../antora/AntoraComponentIndex';

interface PickerEntry {
  page: AntoraPageEntry;
  /** Display label shown in the picker. */
  label: string;
}

export type PickerAction = 'open' | { kind: 'callback'; onPick: (page: AntoraPageEntry) => void };

/**
 * Fuzzy-search modal over every indexed Antora page. Faster than the file
 * switcher for navigating an Antora site because it shows page IDs
 * (`component:version:module:path`) rather than vault filenames, and limits
 * the candidate set to actual pages (not partials, examples, or other
 * adjacent files).
 *
 * Default action is 'open' (open the file in the most recent leaf). Pass a
 * callback action to reuse the picker for "insert xref…" or similar commands.
 */
export class AntoraPagePicker extends FuzzySuggestModal<PickerEntry> {
  constructor(
    app: App,
    private readonly index: AntoraComponentIndex,
    private readonly action: PickerAction = 'open',
  ) {
    super(app);
    this.setPlaceholder('Search Antora pages by component, module, or path…');
  }

  getItems(): PickerEntry[] {
    const entries: PickerEntry[] = [];
    for (const component of this.index.getComponents()) {
      const versionCount = component.versions.size;
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          for (const page of module.pages) {
            const label = versionCount > 1
              ? `${component.name}@${version.version}:${module.name}:${page.path}`
              : `${component.name}:${module.name}:${page.path}`;
            entries.push({ page, label });
          }
        }
      }
    }
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return entries;
  }

  getItemText(entry: PickerEntry): string {
    return entry.label;
  }

  async onChooseItem(entry: PickerEntry): Promise<void> {
    if (this.action !== 'open') {
      this.action.onPick(entry.page);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(entry.page.filePath);
    if (!(file instanceof TFile)) {
      new Notice(`File not found in vault: ${entry.page.filePath}`);
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }
}

/**
 * Builds the most-context-appropriate xref target for the picked page given
 * the current source page's component/module. Bare when same module, scoped
 * when same component, fully-qualified when cross-component.
 */
export function buildXrefTargetFor(
  picked: AntoraPageEntry,
  source: { component?: string; module?: string } = {},
): string {
  if (source.component === picked.component && source.module === picked.module) {
    return picked.path;
  }
  if (source.component === picked.component) {
    return `${picked.module}:${picked.path}`;
  }
  return `${picked.component}:${picked.module}:${picked.path}`;
}
