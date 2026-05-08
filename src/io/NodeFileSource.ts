import { existsSync, promises as fs, readdirSync } from 'node:fs';
import path from 'node:path';

import { FileSource, SourceFile } from './FileSource';

export interface NodeFileSourceOptions {
  /** Absolute root paths to scan. Files are listed recursively under each. */
  roots: string[];
  /** Optional ignore predicate evaluated against absolute paths during walking. */
  ignore?: (absolutePath: string) => boolean;
}

const DEFAULT_IGNORE = /(?:^|\/)(\.git|\.cache|node_modules|dist|build)(?:\/|$)/;

/**
 * Filesystem-backed FileSource. Used to index Antora content roots that live
 * outside the Obsidian vault (referenced from a playbook's `content.sources`,
 * symlinked content, or sibling repositories).
 *
 * Unlike VaultFileSource, paths returned by this source are *absolute* on disk.
 * Callers must therefore not mix files from a NodeFileSource with files from a
 * VaultFileSource in the same scan — wrap with CompositeFileSource if needed.
 *
 * Desktop-only: relies on node:fs.
 */
export class NodeFileSource implements FileSource {
  private cache: SourceFile[] | null = null;
  private existsCache = new Map<string, boolean>();

  constructor(private readonly options: NodeFileSourceOptions) {}

  list(): SourceFile[] {
    if (this.cache !== null) {
      return this.cache;
    }
    const ignore = this.options.ignore ?? ((p) => DEFAULT_IGNORE.test(p));
    const collected: SourceFile[] = [];
    for (const root of this.options.roots) {
      walkSync(root, ignore, collected);
    }
    this.cache = collected;
    return collected;
  }

  async refresh(): Promise<void> {
    this.cache = null;
    this.existsCache.clear();
  }

  async read(file: SourceFile): Promise<string> {
    return fs.readFile(file.path, 'utf8');
  }

  exists(checkPath: string): boolean {
    const cached = this.existsCache.get(checkPath);
    if (cached !== undefined) {
      return cached;
    }
    const result = existsSync(checkPath);
    this.existsCache.set(checkPath, result);
    return result;
  }
}

function walkSync(rootPath: string, ignore: (absolutePath: string) => boolean, out: SourceFile[]): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = path.join(rootPath, entry.name);
    if (ignore(absolute)) {
      continue;
    }
    if (entry.isDirectory()) {
      walkSync(absolute, ignore, out);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : '';
    out.push({ path: absolute.split(path.sep).join('/'), name: entry.name, extension });
  }
}
