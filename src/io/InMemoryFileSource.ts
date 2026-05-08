import { FileSource, SourceFile } from './FileSource';

/**
 * Test-friendly FileSource. Not exported through the plugin entry point; used
 * by the unit suite to exercise scanner/validator behaviour without spinning
 * up an Obsidian app.
 */
export class InMemoryFileSource implements FileSource {
  private contents = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.add(path, content);
    }
  }

  add(path: string, content: string): void {
    this.contents.set(path, content);
  }

  remove(path: string): void {
    this.contents.delete(path);
  }

  list(): SourceFile[] {
    return Array.from(this.contents.keys()).map((path) => {
      const name = path.split('/').pop() ?? path;
      const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
      return { path, name, extension };
    });
  }

  async read(file: SourceFile): Promise<string> {
    return this.contents.get(file.path) ?? '';
  }

  exists(path: string): boolean {
    return this.contents.has(path);
  }
}
