import { App, FuzzySuggestModal } from 'obsidian';

export type AdmonitionType = 'NOTE' | 'TIP' | 'WARNING' | 'CAUTION' | 'IMPORTANT';

const TYPES: AdmonitionType[] = ['NOTE', 'TIP', 'WARNING', 'CAUTION', 'IMPORTANT'];

/**
 * Tiny picker for choosing an admonition type. Used by the "wrap selection
 * as admonition" command.
 */
export class AdmonitionPicker extends FuzzySuggestModal<AdmonitionType> {
  constructor(app: App, private readonly onPick: (type: AdmonitionType) => void) {
    super(app);
    this.setPlaceholder('Pick admonition type…');
  }

  getItems(): AdmonitionType[] {
    return TYPES;
  }

  getItemText(item: AdmonitionType): string {
    return item;
  }

  onChooseItem(item: AdmonitionType): void {
    this.onPick(item);
  }
}

/** Returns the AsciiDoc admonition block wrapping the supplied content. */
export function buildAdmonitionBlock(type: AdmonitionType, content: string): string {
  return `[${type}]\n====\n${content}\n====`;
}
