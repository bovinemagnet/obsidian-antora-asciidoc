import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource } from '../io/FileSource';

export interface AuditCounts {
  components: number;
  versions: number;
  modules: number;
  pages: number;
  partials: number;
  examples: number;
  images: number;
}

export interface AuditXrefStats {
  totalXrefs: number;
  brokenXrefs: number;
  averagePerPage: number;
}

export interface AuditAttributeUsage {
  /** Attribute name. */
  name: string;
  /** Times referenced as `{name}` across all pages. */
  references: number;
}

export interface AuditReport {
  generatedAt: string;
  counts: AuditCounts;
  xrefs: AuditXrefStats;
  topAttributes: AuditAttributeUsage[];
  orphanCount: number;
  duplicateAnchorCount: number;
}

/**
 * Pure aggregator: walks the index and source to compute high-level workspace
 * stats. The caller is responsible for serialising and writing the report.
 */
export async function auditWorkspace(options: {
  source: FileSource;
  index: AntoraComponentIndex;
  parser: AsciiDocParser;
  orphanCount: number;
  duplicateAnchorCount: number;
}): Promise<AuditReport> {
  const counts = countWorkspace(options.index);
  const { totalXrefs, brokenXrefs, attributeUsage } = await aggregateContent(options);

  const sortedAttributes = [...attributeUsage.entries()]
    .map(([name, references]) => ({ name, references }))
    .sort((a, b) => b.references - a.references)
    .slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    counts,
    xrefs: {
      totalXrefs,
      brokenXrefs,
      averagePerPage: counts.pages === 0 ? 0 : Math.round((totalXrefs / counts.pages) * 100) / 100,
    },
    topAttributes: sortedAttributes,
    orphanCount: options.orphanCount,
    duplicateAnchorCount: options.duplicateAnchorCount,
  };
}

function countWorkspace(index: AntoraComponentIndex): AuditCounts {
  const counts: AuditCounts = { components: 0, versions: 0, modules: 0, pages: 0, partials: 0, examples: 0, images: 0 };
  for (const component of index.getComponents()) {
    counts.components += 1;
    for (const version of component.versions.values()) {
      counts.versions += 1;
      for (const module of version.modules.values()) {
        counts.modules += 1;
        counts.pages += module.pages.length;
        counts.partials += module.partials.length;
        counts.examples += module.examples.length;
        counts.images += module.images.length;
      }
    }
  }
  return counts;
}

async function aggregateContent(options: {
  source: FileSource;
  index: AntoraComponentIndex;
  parser: AsciiDocParser;
}): Promise<{ totalXrefs: number; brokenXrefs: number; attributeUsage: Map<string, number> }> {
  const resolver = new AntoraPathResolver();
  let totalXrefs = 0;
  let brokenXrefs = 0;
  const attributeUsage = new Map<string, number>();

  for (const file of options.source.list()) {
    if (!/^(adoc|asciidoc)$/i.test(file.extension)) {
      continue;
    }
    const content = await options.source.read(file);
    const symbols = options.parser.parseSymbols(content);
    const sourcePage = options.index.getPageByFilePath(file.path);
    const defaults = sourcePage
      ? { component: sourcePage.component, module: sourcePage.module, version: sourcePage.version }
      : (options.index.getComponentContextForPath(file.path) ?? {});

    for (const xref of symbols.xrefs) {
      totalXrefs += 1;
      const resolved = resolver.resolveXrefTarget(xref.target, defaults);
      if (!options.index.resolvePage(resolved)) {
        brokenXrefs += 1;
      }
    }

    for (const attribute of symbols.attributes) {
      attributeUsage.set(attribute.name, (attributeUsage.get(attribute.name) ?? 0) + 1);
    }
  }

  return { totalXrefs, brokenXrefs, attributeUsage };
}

/**
 * Renders the audit report as Markdown for export.
 */
export function renderAuditMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('# Antora workspace audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|---|---:|');
  lines.push(`| Components | ${report.counts.components} |`);
  lines.push(`| Versions | ${report.counts.versions} |`);
  lines.push(`| Modules | ${report.counts.modules} |`);
  lines.push(`| Pages | ${report.counts.pages} |`);
  lines.push(`| Partials | ${report.counts.partials} |`);
  lines.push(`| Examples | ${report.counts.examples} |`);
  lines.push(`| Images | ${report.counts.images} |`);
  lines.push('');

  lines.push('## Cross-references');
  lines.push('');
  lines.push(`- Total xrefs: **${report.xrefs.totalXrefs}**`);
  lines.push(`- Broken xrefs: **${report.xrefs.brokenXrefs}**`);
  lines.push(`- Average xrefs per page: **${report.xrefs.averagePerPage}**`);
  lines.push('');

  lines.push('## Quality');
  lines.push('');
  lines.push(`- Orphan pages (not linked from nav or other pages): **${report.orphanCount}**`);
  lines.push(`- Anchor names with multiple declarations within a component: **${report.duplicateAnchorCount}**`);
  lines.push('');

  if (report.topAttributes.length > 0) {
    lines.push('## Top attributes by usage');
    lines.push('');
    lines.push('| Attribute | References |');
    lines.push('|---|---:|');
    for (const attr of report.topAttributes) {
      lines.push(`| \`${attr.name}\` | ${attr.references} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
