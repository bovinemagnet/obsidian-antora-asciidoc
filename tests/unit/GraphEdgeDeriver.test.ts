import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { deriveGraphEdges } from '../../src/graph/GraphEdgeDeriver';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

async function scan(files: Record<string, string>) {
  const source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  const scanner = new AntoraWorkspaceScanner(source, parser);
  await scanner.scan(index);
  return { source, index, parser };
}

describe('deriveGraphEdges', () => {
  it('emits one edge per resolved xref', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/index.adoc': '= Index\n\nSee xref:about.adoc[About].',
      'docs/modules/ROOT/pages/about.adoc': '= About',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    const fromIndex = edges.get('docs/modules/ROOT/pages/index.adoc');
    expect(fromIndex?.get('docs/modules/ROOT/pages/about.adoc')).toBe(1);
  });

  it('counts repeated xrefs', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/a.adoc': 'xref:b.adoc[].\nxref:b.adoc[].\nxref:b.adoc[].',
      'docs/modules/ROOT/pages/b.adoc': '= B',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    expect(edges.get('docs/modules/ROOT/pages/a.adoc')?.get('docs/modules/ROOT/pages/b.adoc'))
      .toBe(3);
  });

  it('skips broken xrefs', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/a.adoc': 'xref:nope.adoc[].',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    expect(edges.get('docs/modules/ROOT/pages/a.adoc')).toBeUndefined();
  });

  it('skips self-references', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/a.adoc': 'xref:a.adoc[Same page].',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    expect(edges.get('docs/modules/ROOT/pages/a.adoc')).toBeUndefined();
  });

  it('emits include edges when includeIncludeEdges is true', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/a.adoc': 'include::partial$intro.adoc[]',
      'docs/modules/ROOT/partials/intro.adoc': 'snippet',
    });
    const edges = await deriveGraphEdges(source, index, parser, { includeIncludeEdges: true });
    expect(edges.get('docs/modules/ROOT/pages/a.adoc')?.get('docs/modules/ROOT/partials/intro.adoc'))
      .toBe(1);
  });

  it('omits include edges by default', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/pages/a.adoc': 'include::partial$intro.adoc[]',
      'docs/modules/ROOT/partials/intro.adoc': 'snippet',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    expect(edges.get('docs/modules/ROOT/pages/a.adoc')).toBeUndefined();
  });

  it('walks nav.adoc files too', async () => {
    const { source, index, parser } = await scan({
      'docs/modules/ROOT/nav.adoc': '* xref:home.adoc[Home]\n* xref:guide.adoc[Guide]\n',
      'docs/modules/ROOT/pages/home.adoc': '= Home',
      'docs/modules/ROOT/pages/guide.adoc': '= Guide',
    });
    const edges = await deriveGraphEdges(source, index, parser);
    const navEdges = edges.get('docs/modules/ROOT/nav.adoc');
    expect(navEdges?.size).toBe(2);
    expect(navEdges?.get('docs/modules/ROOT/pages/home.adoc')).toBe(1);
    expect(navEdges?.get('docs/modules/ROOT/pages/guide.adoc')).toBe(1);
  });
});
