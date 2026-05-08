import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource } from '../io/FileSource';

/**
 * `Map<sourceVaultPath, Map<targetVaultPath, edgeCount>>` — the shape Obsidian's
 * `metadataCache.resolvedLinks` uses, converted to JS Maps so the deriver
 * stays Obsidian-agnostic. The applier translates to plain objects.
 */
export type EdgeMap = Map<string, Map<string, number>>;

export interface DeriveOptions {
  /** When true, also emit edges for include:: directives. */
  includeIncludeEdges?: boolean;
}

/**
 * Walks every indexed AsciiDoc file in the source, parses xref + include
 * targets, resolves them via the index, and returns the resulting edge map.
 *
 * The deriver is pure — it neither writes to Obsidian nor mutates the index.
 * The applier handles Obsidian-side IO so this module remains unit-testable
 * with InMemoryFileSource.
 */
export async function deriveGraphEdges(
  source: FileSource,
  index: AntoraComponentIndex,
  parser: AsciiDocParser,
  options: DeriveOptions = {},
): Promise<EdgeMap> {
  const xrefResolver = new AntoraPathResolver();
  const resourceResolver = new AntoraResourceResolver(index);
  const edges: EdgeMap = new Map();

  for (const file of source.list()) {
    if (!/^(adoc|asciidoc)$/i.test(file.extension)) {
      continue;
    }
    const content = await source.read(file);
    const symbols = parser.parseSymbols(content);
    const sourcePage = index.getPageByFilePath(file.path);
    const defaults = sourcePage
      ? { component: sourcePage.component, module: sourcePage.module, version: sourcePage.version }
      : index.getComponentContextForPath(file.path) ?? {};

    for (const xref of symbols.xrefs) {
      const resolved = xrefResolver.resolveXrefTarget(xref.target, defaults);
      const targetPage = index.resolvePage(resolved);
      if (targetPage) {
        addEdge(edges, file.path, targetPage.filePath);
      }
    }

    if (options.includeIncludeEdges) {
      for (const include of symbols.includes) {
        const resolvedPath = resourceResolver.resolve(include.target, file.path);
        if (source.exists(resolvedPath)) {
          addEdge(edges, file.path, resolvedPath);
        }
      }
    }
  }

  return edges;
}

function addEdge(edges: EdgeMap, source: string, target: string): void {
  if (source === target) {
    return;
  }
  let bucket = edges.get(source);
  if (!bucket) {
    bucket = new Map();
    edges.set(source, bucket);
  }
  bucket.set(target, (bucket.get(target) ?? 0) + 1);
}
