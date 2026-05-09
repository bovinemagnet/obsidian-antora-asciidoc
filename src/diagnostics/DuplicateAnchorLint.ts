import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { Diagnostic } from './Diagnostic';

/**
 * Reports anchor names declared on multiple pages within the same component.
 * Duplicate anchors across components are NOT flagged — Antora's xref scope
 * keeps them disambiguated.
 *
 * Each duplicate site emits one warning with the list of conflicting pages
 * in the message so the writer can pick which one to rename.
 */
export function findDuplicateAnchors(index: AntoraComponentIndex): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const component of index.getComponents()) {
    // Collect anchor → list of pages declaring it (within this component only).
    const byAnchor = new Map<string, Array<{ filePath: string; module: string; path: string }>>();
    for (const version of component.versions.values()) {
      for (const module of version.modules.values()) {
        for (const page of module.pages) {
          for (const anchor of page.anchors) {
            const bucket = byAnchor.get(anchor) ?? [];
            bucket.push({ filePath: page.filePath, module: module.name, path: page.path });
            byAnchor.set(anchor, bucket);
          }
        }
      }
    }

    for (const [anchor, sites] of byAnchor) {
      if (sites.length < 2) {
        continue;
      }
      const partners = sites.map((s) => `${s.module}:${s.path}`).join(', ');
      for (const site of sites) {
        diagnostics.push({
          filePath: site.filePath,
          line: 1,
          column: 1,
          severity: 'warning',
          message: `Duplicate anchor '${anchor}' declared in ${component.name} on multiple pages: ${partners}.`,
        });
      }
    }
  }

  return diagnostics;
}
