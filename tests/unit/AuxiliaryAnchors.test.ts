import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../../src/antora/AntoraPathResolver';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { XrefValidator } from '../../src/diagnostics/XrefValidator';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

describe('Auxiliary anchors from partials and examples', () => {
  it('collects anchors from partial .adoc files into the index', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/partials/intro.adoc': '[[intro-anchor]]\nIntro text.',
      'docs/modules/ROOT/examples/sample.adoc': '[[example-anchor]]\nSample.',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.hasAuxiliaryAnchor('intro-anchor')).toBe(true);
    expect(index.hasAuxiliaryAnchor('example-anchor')).toBe(true);
  });

  it('XrefValidator accepts an anchor that lives in an included partial', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/page.adoc': 'See xref:page.adoc#partial-anchor[].',
      'docs/modules/ROOT/partials/intro.adoc': '[[partial-anchor]]\nIntro.',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();
    await scanner.scan(index);

    const parser = new AsciiDocParser();
    const validator = new XrefValidator(index, new AntoraPathResolver());
    const symbols = parser.parseSymbols('See xref:page.adoc#partial-anchor[].');

    const diagnostics = validator.validate('docs/modules/ROOT/pages/page.adoc', symbols);
    expect(diagnostics).toHaveLength(0);
  });

  it('still flags anchors that are unknown anywhere', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/page.adoc': '= P',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();
    await scanner.scan(index);

    const parser = new AsciiDocParser();
    const validator = new XrefValidator(index, new AntoraPathResolver());
    const symbols = parser.parseSymbols('See xref:page.adoc#nope[].');

    const diagnostics = validator.validate('docs/modules/ROOT/pages/page.adoc', symbols);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('nope');
  });
});
