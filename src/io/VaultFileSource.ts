import { TFile, Vault } from 'obsidian';

import { FileSource, SourceFile } from './FileSource';

/**
 * FileSource backed by the Obsidian vault. Wraps TFile metadata so callers do
 * not need to import Obsidian types.
 */
export class VaultFileSource implements FileSource {
  constructor(private readonly vault: Vault) {}

  list(): SourceFile[] {
    return this.vault.getFiles().map((file) => this.toSourceFile(file));
  }

  async read(file: SourceFile): Promise<string> {
    const tfile = this.vault.getAbstractFileByPath(file.path);
    if (!(tfile instanceof TFile)) {
      throw new Error(`File not found in vault: ${file.path}`);
    }
    return this.vault.cachedRead(tfile);
  }

  exists(path: string): boolean {
    return this.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  toSourceFile(file: TFile): SourceFile {
    return { path: file.path, extension: file.extension.toLowerCase(), name: file.name };
  }
}
