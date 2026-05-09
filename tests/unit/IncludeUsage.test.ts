import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { findIncludeUsages } from '../../src/diagnostics/IncludeUsage';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

async function setup(files: Record<string, string>) {
  const source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  await new AntoraWorkspaceScanner(source, parser).scan(index);
  return { source, index, parser };
}

describe('findIncludeUsages', () => {
  it('returns each include site whose target resolves to the partial', async () => {
    const { source, index, parser } = await setup({
      'docs/modules/ROOT/pages/a.adoc': 'include::partial$intro.adoc[]',
      'docs/modules/ROOT/pages/b.adoc': 'Some text\ninclude::partial$intro.adoc[lines=1..5]',
      'docs/modules/ROOT/partials/intro.adoc': 'snippet',
    });
    const out = await findIncludeUsages(source, index, parser, 'docs/modules/ROOT/partials/intro.adoc');
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.filePath)).toEqual([
      'docs/modules/ROOT/pages/a.adoc',
      'docs/modules/ROOT/pages/b.adoc',
    ]);
  });

  it('returns an empty list when no page includes the partial', async () => {
    const { source, index, parser } = await setup({
      'docs/modules/ROOT/pages/a.adoc': '= Standalone',
      'docs/modules/ROOT/partials/intro.adoc': 'snippet',
    });
    const out = await findIncludeUsages(source, index, parser, 'docs/modules/ROOT/partials/intro.adoc');
    expect(out).toEqual([]);
  });

  it('honours cross-module include references via the resource resolver', async () => {
    const { source, index, parser } = await setup({
      'docs/modules/ROOT/pages/a.adoc': 'include::api:partial$shared.adoc[]',
      'docs/modules/api/partials/shared.adoc': 'shared',
    });
    const out = await findIncludeUsages(source, index, parser, 'docs/modules/api/partials/shared.adoc');
    expect(out).toHaveLength(1);
  });
});
