import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { findOrphanPages } from '../../src/diagnostics/OrphanPageLint';
import { deriveGraphEdges } from '../../src/graph/GraphEdgeDeriver';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

async function setup(files: Record<string, string>) {
  const source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  await new AntoraWorkspaceScanner(source, parser).scan(index);
  const edges = await deriveGraphEdges(source, index, parser);
  return findOrphanPages(index, edges);
}

describe('findOrphanPages', () => {
  it('flags a page that nothing links to', async () => {
    const orphans = await setup({
      'docs/modules/ROOT/pages/index.adoc': '= Index',
      'docs/modules/ROOT/pages/orphan.adoc': '= Lonely',
    });
    expect(orphans).toHaveLength(1);
    expect(orphans[0].filePath).toBe('docs/modules/ROOT/pages/orphan.adoc');
  });

  it('does not flag a page reached via xref', async () => {
    const orphans = await setup({
      'docs/modules/ROOT/pages/index.adoc': '= Index\n\nxref:about.adoc[].',
      'docs/modules/ROOT/pages/about.adoc': '= About',
    });
    expect(orphans.find((o) => o.filePath === 'docs/modules/ROOT/pages/about.adoc')).toBeUndefined();
  });

  it('does not flag a page referenced from nav.adoc', async () => {
    const orphans = await setup({
      'docs/modules/ROOT/nav.adoc': '* xref:home.adoc[Home]\n',
      'docs/modules/ROOT/pages/home.adoc': '= Home',
    });
    expect(orphans.find((o) => o.filePath === 'docs/modules/ROOT/pages/home.adoc')).toBeUndefined();
  });

  it('treats index.adoc as an entry point and does not flag it', async () => {
    const orphans = await setup({
      'docs/modules/ROOT/pages/index.adoc': '= Index',
    });
    expect(orphans).toEqual([]);
  });
});
