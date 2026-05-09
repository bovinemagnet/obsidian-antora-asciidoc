import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../../src/antora/AntoraResourceResolver';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { ImageValidator } from '../../src/diagnostics/ImageValidator';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

function makeValidator(source: InMemoryFileSource, index = new AntoraComponentIndex()): ImageValidator {
  return new ImageValidator(source, new AntoraResourceResolver(index));
}

describe('ImageValidator', () => {
  const parser = new AsciiDocParser();

  it('passes when the image target exists', () => {
    const source = new InMemoryFileSource({ 'docs/snippets/logo.png': 'binary' });
    const validator = makeValidator(source);
    const symbols = parser.parseSymbols('image::snippets/logo.png[Logo]');
    expect(validator.validate('docs/page.adoc', symbols)).toEqual([]);
  });

  it('flags missing image targets as errors', () => {
    const validator = makeValidator(new InMemoryFileSource());
    const symbols = parser.parseSymbols('image::missing.png[]');
    const out = validator.validate('docs/page.adoc', symbols);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('error');
  });

  it('skips external URLs', () => {
    const validator = makeValidator(new InMemoryFileSource());
    const symbols = parser.parseSymbols('image::https://example.com/x.png[Pic]');
    expect(validator.validate('docs/page.adoc', symbols)).toEqual([]);
  });

  it('resolves image$ resource IDs against the source page module', () => {
    const source = new InMemoryFileSource({
      'docs/modules/ROOT/pages/page.adoc': '= P',
      'docs/modules/ROOT/assets/images/logo.png': 'binary',
    });
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs', version: '1.0', module: 'ROOT', path: 'page.adoc',
      filePath: 'docs/modules/ROOT/pages/page.adoc', anchors: new Set(),
    });
    const validator = makeValidator(source, index);
    const symbols = parser.parseSymbols('image::image$logo.png[]');
    expect(validator.validate('docs/modules/ROOT/pages/page.adoc', symbols)).toEqual([]);
  });
});
