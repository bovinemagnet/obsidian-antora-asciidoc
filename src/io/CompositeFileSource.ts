import { FileSource, SourceFile } from './FileSource';

/**
 * Combines multiple FileSources behind a single interface. The first source to
 * own a given path wins for `read` and `exists`, matched by path equality.
 *
 * Sources are queried in declaration order so that a vault-local override of
 * an external file takes precedence over the disk copy.
 */
export class CompositeFileSource implements FileSource {
  constructor(private readonly sources: FileSource[]) {}

  list(): SourceFile[] {
    const seen = new Set<string>();
    const out: SourceFile[] = [];
    for (const source of this.sources) {
      for (const file of source.list()) {
        if (seen.has(file.path)) {
          continue;
        }
        seen.add(file.path);
        out.push(file);
      }
    }
    return out;
  }

  async read(file: SourceFile): Promise<string> {
    for (const source of this.sources) {
      if (source.exists(file.path)) {
        return source.read(file);
      }
    }
    throw new Error(`File not found in any source: ${file.path}`);
  }

  exists(path: string): boolean {
    return this.sources.some((source) => source.exists(path));
  }
}
