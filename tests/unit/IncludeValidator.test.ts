import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../../src/antora/AntoraResourceResolver';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { IncludeValidator } from '../../src/diagnostics/IncludeValidator';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

function makeValidator(source: InMemoryFileSource, index = new AntoraComponentIndex()): IncludeValidator {
  return new IncludeValidator(source, new AntoraResourceResolver(index));
}

describe('IncludeValidator', () => {
  const parser = new AsciiDocParser();

  it('flags missing relative includes', () => {
    const validator = makeValidator(new InMemoryFileSource());
    const symbols = parser.parseSymbols('include::missing.adoc[]');

    const diagnostics = validator.validate('docs/page.adoc', symbols);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
  });

  it('passes when target exists relative to source', () => {
    const source = new InMemoryFileSource({ 'docs/snippets/intro.adoc': '' });
    const validator = makeValidator(source);
    const symbols = parser.parseSymbols('include::snippets/intro.adoc[tags=foo]');

    expect(validator.validate('docs/page.adoc', symbols)).toHaveLength(0);
  });

  it('handles absolute include paths', () => {
    const source = new InMemoryFileSource({ 'shared/common.adoc': '' });
    const validator = makeValidator(source);
    const symbols = parser.parseSymbols('include::/shared/common.adoc[]');

    expect(validator.validate('docs/page.adoc', symbols)).toHaveLength(0);
  });

  it('resolves partial$ resource IDs against the source page module', () => {
    const source = new InMemoryFileSource({
      'docs/modules/ROOT/pages/page.adoc': '= Page',
      'docs/modules/ROOT/partials/intro.adoc': 'snippet',
    });
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'page.adoc',
      filePath: 'docs/modules/ROOT/pages/page.adoc',
      anchors: new Set(),
    });
    const validator = makeValidator(source, index);
    const symbols = parser.parseSymbols('include::partial$intro.adoc[]');

    expect(validator.validate('docs/modules/ROOT/pages/page.adoc', symbols)).toHaveLength(0);
  });

  it('flags partial$ resource IDs that point at a missing partial', () => {
    const source = new InMemoryFileSource({
      'docs/modules/ROOT/pages/page.adoc': '= Page',
    });
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'page.adoc',
      filePath: 'docs/modules/ROOT/pages/page.adoc',
      anchors: new Set(),
    });
    const validator = makeValidator(source, index);
    const symbols = parser.parseSymbols('include::partial$missing.adoc[]');

    expect(validator.validate('docs/modules/ROOT/pages/page.adoc', symbols)).toHaveLength(1);
  });

  it('resolves cross-module example$ references', () => {
    const source = new InMemoryFileSource({
      'docs/modules/ROOT/pages/page.adoc': '= Page',
      'docs/modules/api/examples/sample.adoc': 'sample',
    });
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'page.adoc',
      filePath: 'docs/modules/ROOT/pages/page.adoc',
      anchors: new Set(),
    });
    const validator = makeValidator(source, index);
    const symbols = parser.parseSymbols('include::api:example$sample.adoc[]');

    expect(validator.validate('docs/modules/ROOT/pages/page.adoc', symbols)).toHaveLength(0);
  });
});
