import { App, TFile } from 'obsidian';

import { EdgeMap } from './GraphEdgeDeriver';

/**
 * Obsidian's graph view reads from `app.metadataCache.resolvedLinks`. The
 * shape is `{ [sourceVaultPath]: { [targetVaultPath]: count } }` and isn't
 * part of the documented plugin API, but it's been a stable
 * community-plugin convention for years (Dataview, Templater, etc. all
 * write to it).
 *
 * This applier writes the supplied edges into that cache and fires the
 * `'resolve'` event so the graph view rebuilds. Every interaction with the
 * undocumented surface is wrapped in try/catch so a future Obsidian release
 * that changes the shape degrades gracefully (the graph just stops
 * updating).
 */
export interface SyncOutcome {
  /** Vault paths whose entry in resolvedLinks we wrote. */
  written: string[];
  /** True when an exception forced an early bail-out. */
  failed: boolean;
}

interface ResolvedLinkBag {
  resolvedLinks?: Record<string, Record<string, number>>;
  trigger?(event: string, ...args: unknown[]): void;
}

/**
 * Replaces our previously-written entries with the supplied edges. To avoid
 * leaking stale links when files are renamed/deleted, the applier removes
 * any entry it previously owned that's missing from the new edge map.
 */
export class GraphSyncApplier {
  private previouslyWritten = new Set<string>();

  constructor(private readonly app: App) {}

  apply(edges: EdgeMap): SyncOutcome {
    const cache = this.getCache();
    if (!cache?.resolvedLinks) {
      return { written: [], failed: true };
    }

    const written: string[] = [];
    const newWritten = new Set<string>();

    try {
      // Drop entries we previously wrote that have no edges this round.
      for (const oldPath of this.previouslyWritten) {
        if (!edges.has(oldPath)) {
          delete cache.resolvedLinks[oldPath];
          this.fireResolve(oldPath);
        }
      }

      for (const [sourcePath, targets] of edges) {
        const bucket: Record<string, number> = { ...(cache.resolvedLinks[sourcePath] ?? {}) };
        for (const [targetPath, count] of targets) {
          bucket[targetPath] = count;
        }
        cache.resolvedLinks[sourcePath] = bucket;
        written.push(sourcePath);
        newWritten.add(sourcePath);
        this.fireResolve(sourcePath);
      }

      this.previouslyWritten = newWritten;
      return { written, failed: false };
    } catch {
      return { written, failed: true };
    }
  }

  /**
   * Removes every entry we wrote, useful on plugin unload so a disabled
   * plugin doesn't leave phantom edges in the graph.
   */
  clear(): void {
    const cache = this.getCache();
    if (!cache?.resolvedLinks) {
      return;
    }
    try {
      for (const path of this.previouslyWritten) {
        delete cache.resolvedLinks[path];
        this.fireResolve(path);
      }
      this.previouslyWritten.clear();
    } catch {
      /* nothing useful to do */
    }
  }

  private getCache(): ResolvedLinkBag | null {
    const candidate = (this.app as unknown as { metadataCache?: ResolvedLinkBag }).metadataCache;
    return candidate ?? null;
  }

  private fireResolve(path: string): void {
    try {
      const cache = this.getCache();
      if (!cache?.trigger) {
        return;
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        cache.trigger('resolve', file);
      }
    } catch {
      /* swallow — best effort */
    }
  }
}
