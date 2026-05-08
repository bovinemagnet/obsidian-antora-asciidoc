import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../../src/antora/AntoraPathResolver';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { XrefValidator } from '../../src/diagnostics/XrefValidator';

describe('XrefValidator', () => {
  const parser = new AsciiDocParser();

  function buildIndex(): AntoraComponentIndex {
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs/modules/ROOT/pages/index.adoc',
      anchors: new Set(['my-anchor']),
    });
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'sibling.adoc',
      filePath: 'docs/modules/ROOT/pages/sibling.adoc',
      anchors: new Set(),
    });
    return index;
  }

  it('resolves a bare xref against the current page context', () => {
    const index = buildIndex();
    const validator = new XrefValidator(index, new AntoraPathResolver());
    const symbols = parser.parseSymbols('See xref:sibling.adoc[].');

    const diagnostics = validator.validate('docs/modules/ROOT/pages/index.adoc', symbols);
    expect(diagnostics).toEqual([]);
  });

  it('flags broken xref targets', () => {
    const index = buildIndex();
    const validator = new XrefValidator(index, new AntoraPathResolver());
    const symbols = parser.parseSymbols('See xref:nope.adoc[].');

    const diagnostics = validator.validate('docs/modules/ROOT/pages/index.adoc', symbols);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
  });

  it('flags missing anchors', () => {
    const index = buildIndex();
    const validator = new XrefValidator(index, new AntoraPathResolver());
    const symbols = parser.parseSymbols('See xref:index.adoc#missing[].');

    const diagnostics = validator.validate('docs/modules/ROOT/pages/sibling.adoc', symbols);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('Missing anchor');
  });
});
