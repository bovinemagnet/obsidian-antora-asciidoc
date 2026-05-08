/**
 * Abstraction over a file backing store. The scanner and validators depend on
 * this rather than on Obsidian's Vault directly, so non-vault sources (e.g.
 * external git checkouts referenced from a playbook) can be plugged in later.
 */
export interface SourceFile {
  /** Forward-slash path used as the canonical identifier inside the source. */
  path: string;
  /** Lowercase extension without the leading dot. */
  extension: string;
  /** Final path segment. */
  name: string;
}

export interface FileSource {
  list(): SourceFile[];
  read(file: SourceFile): Promise<string>;
  exists(path: string): boolean;
}
