import { App, FuzzySuggestModal, Notice, TFile } from 'obsidian';

import { RecentList } from '../util/RecentList';

interface PickerEntry {
  filePath: string;
  label: string;
}

/**
 * Fuzzy picker over the in-memory list of recently opened .adoc files.
 * Most-recent-first order is preserved by the underlying RecentList.
 */
export class RecentPagePicker extends FuzzySuggestModal<PickerEntry> {
  constructor(app: App, private readonly recents: RecentList) {
    super(app);
    this.setPlaceholder('Recent AsciiDoc pages…');
  }

  getItems(): PickerEntry[] {
    return this.recents.list().map((path) => ({
      filePath: path,
      label: path,
    }));
  }

  getItemText(entry: PickerEntry): string {
    return entry.label;
  }

  async onChooseItem(entry: PickerEntry): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(entry.filePath);
    if (!(file instanceof TFile)) {
      new Notice(`Recent file no longer in vault: ${entry.filePath}`);
      this.recents.forget(entry.filePath);
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }
}
