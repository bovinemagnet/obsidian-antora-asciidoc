import { describe, expect, it } from 'vitest';

import { AntoraPathResolver } from '../../src/antora/AntoraPathResolver';

describe('AntoraPathResolver', () => {
  const resolver = new AntoraPathResolver();

  it('parses bare page targets', () => {
    expect(resolver.resolveXrefTarget('page.adoc')).toEqual({ page: 'page.adoc', anchor: undefined });
  });

  it('parses module:page targets', () => {
    expect(resolver.resolveXrefTarget('module:page.adoc')).toEqual({
      module: 'module',
      page: 'page.adoc',
      anchor: undefined,
    });
  });

  it('parses component:module:page targets', () => {
    expect(resolver.resolveXrefTarget('comp:module:page.adoc')).toEqual({
      component: 'comp',
      module: 'module',
      page: 'page.adoc',
      anchor: undefined,
    });
  });

  it('extracts an anchor when present', () => {
    expect(resolver.resolveXrefTarget('comp:module:page.adoc#section-id')).toMatchObject({
      anchor: 'section-id',
    });
  });

  it('fills in component and module from defaults for a bare page target', () => {
    expect(resolver.resolveXrefTarget('foo.adoc', { component: 'docs', module: 'ROOT' })).toEqual({
      component: 'docs',
      module: 'ROOT',
      page: 'foo.adoc',
      anchor: undefined,
    });
  });

  it('fills in component from defaults for a module:page target', () => {
    expect(resolver.resolveXrefTarget('mod:foo.adoc', { component: 'docs', module: 'ROOT' })).toEqual({
      component: 'docs',
      module: 'mod',
      page: 'foo.adoc',
      anchor: undefined,
    });
  });

  it('explicit component:module:page wins over defaults', () => {
    expect(resolver.resolveXrefTarget('other:mod:foo.adoc', { component: 'docs', module: 'ROOT' })).toEqual({
      component: 'other',
      module: 'mod',
      page: 'foo.adoc',
      anchor: undefined,
    });
  });
});
