import { beforeEach, describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../../src/antora/AntoraResourceResolver';

let index: AntoraComponentIndex;
let resolver: AntoraResourceResolver;

beforeEach(() => {
  index = new AntoraComponentIndex();
  index.upsertPage({
    component: 'docs',
    version: '1.0',
    module: 'ROOT',
    path: 'page.adoc',
    filePath: 'docs/modules/ROOT/pages/page.adoc',
    anchors: new Set(),
  });
  index.upsertPage({
    component: 'other',
    version: '1.0',
    module: 'ROOT',
    path: 'p.adoc',
    filePath: 'other/modules/ROOT/pages/p.adoc',
    anchors: new Set(),
  });
  resolver = new AntoraResourceResolver(index);
});

describe('AntoraResourceResolver', () => {
  it('resolves bare partial$ to the source page module', () => {
    expect(resolver.resolve('partial$intro.adoc', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/partials/intro.adoc');
  });

  it('resolves bare example$ to the source module examples', () => {
    expect(resolver.resolve('example$sample.txt', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/examples/sample.txt');
  });

  it('resolves bare image$ to assets/images', () => {
    expect(resolver.resolve('image$logo.png', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/assets/images/logo.png');
  });

  it('resolves attachment$', () => {
    expect(resolver.resolve('attachment$file.pdf', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/attachments/file.pdf');
  });

  it('resolves module-qualified partial$', () => {
    expect(resolver.resolve('api:partial$intro.adoc', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/api/partials/intro.adoc');
  });

  it('resolves component:module:partial$', () => {
    expect(resolver.resolve('other:api:partial$intro.adoc', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('other/modules/api/partials/intro.adoc');
  });

  it('falls back to sibling-relative for non-resource targets', () => {
    expect(resolver.resolve('snippets/intro.adoc', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/pages/snippets/intro.adoc');
  });

  it('strips trailing [attrs] before resolving', () => {
    expect(resolver.resolve('partial$intro.adoc[tags=foo]', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/partials/intro.adoc');
  });

  it('handles unknown families by falling through to relative resolution', () => {
    expect(resolver.resolve('unknown$x.adoc', 'docs/modules/ROOT/pages/page.adoc'))
      .toBe('docs/modules/ROOT/pages/unknown$x.adoc');
  });
});
