import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { auditWorkspace, renderAuditMarkdown } from '../../src/diagnostics/WorkspaceAudit';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

async function audit(files: Record<string, string>) {
  const source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  await new AntoraWorkspaceScanner(source, parser).scan(index);
  return auditWorkspace({ source, index, parser, orphanCount: 0, duplicateAnchorCount: 0 });
}

describe('auditWorkspace', () => {
  it('counts pages, partials, examples, images', async () => {
    const report = await audit({
      'docs/modules/ROOT/pages/a.adoc': '= A',
      'docs/modules/ROOT/pages/b.adoc': '= B',
      'docs/modules/ROOT/partials/p.adoc': 'snippet',
      'docs/modules/ROOT/examples/e.txt': 'sample',
      'docs/modules/ROOT/assets/images/logo.png': 'binary',
    });
    expect(report.counts).toMatchObject({
      components: 1, versions: 1, modules: 1, pages: 2, partials: 1, examples: 1, images: 1,
    });
  });

  it('counts xrefs and broken xrefs', async () => {
    const report = await audit({
      'docs/modules/ROOT/pages/a.adoc': 'See xref:b.adoc[].\nAlso xref:nope.adoc[].',
      'docs/modules/ROOT/pages/b.adoc': '= B',
    });
    expect(report.xrefs.totalXrefs).toBe(2);
    expect(report.xrefs.brokenXrefs).toBe(1);
    expect(report.xrefs.averagePerPage).toBe(1);
  });

  it('builds a top-attributes histogram', async () => {
    const report = await audit({
      'docs/modules/ROOT/pages/a.adoc': '{x} {x} {y} {z}',
      'docs/modules/ROOT/pages/b.adoc': '{x} {z}',
    });
    const x = report.topAttributes.find((a) => a.name === 'x');
    expect(x?.references).toBe(3);
  });
});

describe('renderAuditMarkdown', () => {
  it('emits a Counts table and a Cross-references section', async () => {
    const report = await audit({ 'docs/modules/ROOT/pages/a.adoc': '= A' });
    const md = renderAuditMarkdown(report);
    expect(md).toContain('# Antora workspace audit');
    expect(md).toContain('## Counts');
    expect(md).toContain('| Pages | 1 |');
    expect(md).toContain('## Cross-references');
  });
});
