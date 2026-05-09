import { App, FuzzySuggestModal } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';

export interface ImagePickerEntry {
  /** The image filename relative to the module's assets/images folder. */
  filename: string;
  component: string;
  module: string;
  /** Display label including component:module scope. */
  label: string;
}

/**
 * Picker over every image tracked in the index. Caller supplies the action
 * (typically inserting an `image::` macro at cursor).
 */
export class AntoraImagePicker extends FuzzySuggestModal<ImagePickerEntry> {
  constructor(
    app: App,
    private readonly index: AntoraComponentIndex,
    private readonly onPick: (entry: ImagePickerEntry) => void,
  ) {
    super(app);
    this.setPlaceholder('Search images by name, module, or component…');
  }

  getItems(): ImagePickerEntry[] {
    const items: ImagePickerEntry[] = [];
    for (const component of this.index.getComponents()) {
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          for (const filename of module.images) {
            items.push({
              filename,
              component: component.name,
              module: module.name,
              label: `${component.name}:${module.name}:${filename}`,
            });
          }
        }
      }
    }
    items.sort((a, b) => a.label.localeCompare(b.label));
    return items;
  }

  getItemText(entry: ImagePickerEntry): string {
    return entry.label;
  }

  onChooseItem(entry: ImagePickerEntry): void {
    this.onPick(entry);
  }
}

/**
 * Builds the most-context-appropriate image macro target — bare filename
 * when the source page is in the same module, scoped resource ID otherwise.
 */
export function buildImageTargetFor(
  entry: ImagePickerEntry,
  source: { component?: string; module?: string } = {},
): string {
  if (source.component === entry.component && source.module === entry.module) {
    return entry.filename;
  }
  if (source.component === entry.component) {
    return `${entry.module}:image$${entry.filename}`;
  }
  return `${entry.component}:${entry.module}:image$${entry.filename}`;
}
