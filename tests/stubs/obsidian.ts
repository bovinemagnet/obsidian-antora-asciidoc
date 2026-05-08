export class TFile {
  path = '';
  name = '';
  extension = '';
  basename = '';
  parent: TFolder | null = null;

  constructor(init: Partial<TFile> = {}) {
    Object.assign(this, init);
  }
}

export class TFolder {
  path = '';
  name = '';
  children: Array<TFile | TFolder> = [];
}

export type TAbstractFile = TFile | TFolder;

export interface VaultFile {
  path: string;
  content: string;
}

export class Vault {
  private filesByPath = new Map<string, TFile>();
  private contentByPath = new Map<string, string>();

  constructor(initial: VaultFile[] = []) {
    for (const file of initial) {
      this.add(file.path, file.content);
    }
  }

  add(filePath: string, content: string): TFile {
    const segments = filePath.split('/');
    const name = segments[segments.length - 1];
    const extension = name.includes('.') ? name.split('.').pop() ?? '' : '';
    const basename = name.replace(new RegExp(`\\.${extension}$`), '');
    const file = new TFile({ path: filePath, name, extension, basename });
    this.filesByPath.set(filePath, file);
    this.contentByPath.set(filePath, content);
    return file;
  }

  remove(filePath: string): void {
    this.filesByPath.delete(filePath);
    this.contentByPath.delete(filePath);
  }

  getFiles(): TFile[] {
    return Array.from(this.filesByPath.values());
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.contentByPath.get(file.path) ?? '';
  }

  async read(file: TFile): Promise<string> {
    return this.contentByPath.get(file.path) ?? '';
  }

  getAbstractFileByPath(filePath: string): TFile | null {
    return this.filesByPath.get(filePath) ?? null;
  }
}

export class Notice {
  constructor(public readonly message: string) {}
}

export class Plugin {
  app: unknown;
}

export class ItemView {}
export class MarkdownView {}
export class WorkspaceLeaf {}
export class PluginSettingTab {}
export class Setting {}
export class App {}
export class Modal {}
export class FuzzySuggestModal<T> {
  constructor(_app?: unknown) {
    void this;
  }
  setPlaceholder(_text: string): void { /* stub */ }
  getItems(): T[] { return []; }
  getItemText(_item: T): string { return ''; }
  onChooseItem(_item: T): void { /* stub */ }
}
export class Component {}

export const MarkdownRenderer = {
  render: async (
    _app: unknown,
    _markdown: string,
    _container: HTMLElement,
    _sourcePath: string,
    _component: unknown,
  ): Promise<void> => {
    /* no-op stub */
  },
};

export const Platform = {
  isDesktop: true,
  isMobile: false,
};
