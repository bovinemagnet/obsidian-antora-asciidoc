import { AntoraComponentIndex, AntoraPageEntry } from '../antora/AntoraComponentIndex';
import { NavigationEntry } from '../antora/NavigationParser';
import { EdgeMap } from '../graph/GraphEdgeDeriver';
import { Diagnostic } from './Diagnostic';

/**
 * Reports pages that nothing in the workspace links to. A page is considered
 * "reachable" when:
 *   - it appears as an xref target in any other page (via the supplied edge
 *     map produced by deriveGraphEdges), OR
 *   - it appears in any module's nav.adoc tree
 *
 * The reverse-edge map is computed once per call so callers can pipe in the
 * existing graph-edge derivation result and avoid a second walk.
 */
export function findOrphanPages(index: AntoraComponentIndex, edges: EdgeMap): Diagnostic[] {
  const reachable = collectReachableFilePaths(index, edges);
  const diagnostics: Diagnostic[] = [];

  for (const component of index.getComponents()) {
    for (const version of component.versions.values()) {
      for (const module of version.modules.values()) {
        for (const page of module.pages) {
          if (reachable.has(page.filePath)) {
            continue;
          }
          if (isLikelyEntryPoint(page, module.pages)) {
            continue;
          }
          diagnostics.push({
            filePath: page.filePath,
            line: 1,
            column: 1,
            severity: 'info',
            message: `Orphan page: not linked from any nav.adoc or other page (${page.component}:${page.module}:${page.path}).`,
          });
        }
      }
    }
  }

  return diagnostics;
}

function collectReachableFilePaths(index: AntoraComponentIndex, edges: EdgeMap): Set<string> {
  const reachable = new Set<string>();

  // Every file referenced as an edge *target* counts as reachable.
  for (const targets of edges.values()) {
    for (const target of targets.keys()) {
      reachable.add(target);
    }
  }

  // Walk every module's nav tree and mark the resolved pages too.
  for (const component of index.getComponents()) {
    for (const version of component.versions.values()) {
      for (const moduleName of version.modules.keys()) {
        const componentRoot = deriveComponentRoot(index, component.name);
        if (!componentRoot) {
          continue;
        }
        const tree = index.getNavigation(componentRoot, moduleName);
        for (const node of walkNavigation(tree)) {
          if (!node.target) {
            continue;
          }
          const targetPage = index.resolveByListedTarget(node.target)
            ?? index.resolveByListedTarget(`${moduleName}:${node.target}`)
            ?? index.resolveByListedTarget(`${component.name}:${moduleName}:${node.target}`);
          if (targetPage) {
            reachable.add(targetPage.filePath);
          }
        }
      }
    }
  }

  return reachable;
}

function deriveComponentRoot(index: AntoraComponentIndex, componentName: string): string | undefined {
  for (const component of index.getComponents()) {
    if (component.name !== componentName) {
      continue;
    }
    for (const version of component.versions.values()) {
      for (const module of version.modules.values()) {
        for (const page of module.pages) {
          const idx = page.filePath.indexOf('/modules/');
          if (idx > 0) {
            return page.filePath.slice(0, idx);
          }
        }
      }
    }
  }
  return undefined;
}

function* walkNavigation(entries: NavigationEntry[]): Generator<NavigationEntry> {
  for (const entry of entries) {
    yield entry;
    if (entry.children.length > 0) {
      yield* walkNavigation(entry.children);
    }
  }
}

/**
 * `index.adoc` (or `ROOT/index.adoc`) is conventionally the module's entry
 * point and is reachable through the site itself even when no other page
 * links to it. Skip it from orphan reporting to avoid noise.
 */
function isLikelyEntryPoint(page: AntoraPageEntry, _siblings: AntoraPageEntry[]): boolean {
  return page.path === 'index.adoc' || page.path.endsWith('/index.adoc');
}
