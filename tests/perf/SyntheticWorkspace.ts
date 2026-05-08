import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

export interface WorkspaceShape {
  /** Number of components. Each gets its own antora.yml at `comp{N}/antora.yml`. */
  components?: number;
  /** Modules per component (always named `m0`, `m1`, …; first is always `ROOT`). */
  modulesPerComponent?: number;
  /** Pages per module. */
  pagesPerModule?: number;
  /** Outbound xrefs each page emits. Targets are picked deterministically. */
  xrefsPerPage?: number;
  /** Anchor declarations each page contains. */
  anchorsPerPage?: number;
  /** Partial files added per module. */
  partialsPerModule?: number;
}

/**
 * Builds a deterministic, in-memory Antora workspace at the requested
 * dimensions. Used by perf benches and threshold tests so timings stay
 * comparable across runs and machines.
 *
 * Total page count = components * modulesPerComponent * pagesPerModule.
 *
 * The xref targeting is deterministic: page `i` in module `m` references
 * page `(i + offset) % pagesPerModule` of the same module for half its
 * targets and a sibling module's page for the rest. This produces realistic
 * mixed-scope references without random noise.
 */
export function buildSyntheticWorkspace(shape: WorkspaceShape = {}): InMemoryFileSource {
  const components = shape.components ?? 1;
  const modules = shape.modulesPerComponent ?? 1;
  const pages = shape.pagesPerModule ?? 100;
  const xrefs = shape.xrefsPerPage ?? 0;
  const anchors = shape.anchorsPerPage ?? 0;
  const partials = shape.partialsPerModule ?? 0;

  const files: Record<string, string> = {};

  for (let c = 0; c < components; c += 1) {
    const componentName = `comp${c}`;
    const componentRoot = componentName;
    files[`${componentRoot}/antora.yml`] = [
      `name: ${componentName}`,
      `version: '1.0'`,
      'asciidoc:',
      '  attributes:',
      `    component-tag: ${componentName}-tag`,
      '',
    ].join('\n');

    for (let m = 0; m < modules; m += 1) {
      const moduleName = m === 0 ? 'ROOT' : `m${m}`;
      const moduleRoot = `${componentRoot}/modules/${moduleName}`;

      // nav.adoc with one entry per page.
      const navLines = ['* xref:index.adoc[Index]'];
      for (let p = 0; p < pages; p += 1) {
        navLines.push(`* xref:page${p}.adoc[Page ${p}]`);
      }
      files[`${moduleRoot}/nav.adoc`] = navLines.join('\n');

      // Pages.
      for (let p = 0; p < pages; p += 1) {
        const lines: string[] = [`= Page ${p}`];
        for (let a = 0; a < anchors; a += 1) {
          lines.push(`[[anchor-${p}-${a}]]`);
          lines.push(`Anchor ${a} content for page ${p}.`);
        }
        for (let x = 0; x < xrefs; x += 1) {
          if (x % 2 === 0) {
            const targetIdx = (p + x + 1) % pages;
            lines.push(`See xref:page${targetIdx}.adoc[Page ${targetIdx}].`);
          } else {
            const targetModule = m === 0 ? `m${(m + 1) % Math.max(1, modules)}` : 'ROOT';
            const targetIdx = (p + x) % pages;
            lines.push(`Cross-module: xref:${targetModule}:page${targetIdx}.adoc[].`);
          }
        }
        lines.push('');
        files[`${moduleRoot}/pages/page${p}.adoc`] = lines.join('\n');
      }
      files[`${moduleRoot}/pages/index.adoc`] = `= Index\n\nLandings page for ${moduleName}.\n`;

      // Partials.
      for (let q = 0; q < partials; q += 1) {
        files[`${moduleRoot}/partials/partial${q}.adoc`] = `[[partial-anchor-${q}]]\nReusable partial ${q}.\n`;
      }
    }
  }

  return new InMemoryFileSource(files);
}

/** Approximate page count for a given shape. */
export function pageCount(shape: WorkspaceShape): number {
  const components = shape.components ?? 1;
  const modules = shape.modulesPerComponent ?? 1;
  const pages = shape.pagesPerModule ?? 100;
  return components * modules * (pages + 1); // +1 for the per-module index.adoc
}
