import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraPagePicker, buildXrefTargetFor } from '../../src/views/AntoraPagePicker';

function makeIndex(): AntoraComponentIndex {
  const index = new AntoraComponentIndex();
  index.upsertPage({
    component: 'docs',
    version: '1.0',
    module: 'ROOT',
    path: 'index.adoc',
    filePath: 'docs/modules/ROOT/pages/index.adoc',
    anchors: new Set(),
  });
  index.upsertPage({
    component: 'docs',
    version: '1.0',
    module: 'ROOT',
    path: 'about.adoc',
    filePath: 'docs/modules/ROOT/pages/about.adoc',
    anchors: new Set(),
  });
  return index;
}

describe('AntoraPagePicker', () => {
  it('lists every indexed page sorted alphabetically', () => {
    const picker = new AntoraPagePicker({} as never, makeIndex());
    const items = picker.getItems();
    expect(items.map((i) => i.label)).toEqual([
      'docs:ROOT:about.adoc',
      'docs:ROOT:index.adoc',
    ]);
  });

  it('omits the version segment when only one version exists', () => {
    const picker = new AntoraPagePicker({} as never, makeIndex());
    const items = picker.getItems();
    expect(items[0].label.includes('@')).toBe(false);
  });

  it('includes the version segment when multiple versions are indexed', () => {
    const index = makeIndex();
    index.upsertPage({
      component: 'docs',
      version: '2.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs-2.0/modules/ROOT/pages/index.adoc',
      anchors: new Set(),
    });
    const picker = new AntoraPagePicker({} as never, index);
    const items = picker.getItems();
    expect(items.every((i) => i.label.includes('@'))).toBe(true);
  });

  it('returns an empty list when nothing is indexed', () => {
    const picker = new AntoraPagePicker({} as never, new AntoraComponentIndex());
    expect(picker.getItems()).toEqual([]);
  });
});

describe('buildXrefTargetFor', () => {
  const target = {
    component: 'docs', version: '1.0', module: 'api', path: 'overview.adoc',
    filePath: 'docs/modules/api/pages/overview.adoc', anchors: new Set<string>(),
  };

  it('emits the bare path when source is in the same module', () => {
    expect(buildXrefTargetFor(target, { component: 'docs', module: 'api' })).toBe('overview.adoc');
  });

  it('emits module:page when source is in the same component but different module', () => {
    expect(buildXrefTargetFor(target, { component: 'docs', module: 'ROOT' })).toBe('api:overview.adoc');
  });

  it('emits component:module:page when source is in a different component', () => {
    expect(buildXrefTargetFor(target, { component: 'other', module: 'ROOT' })).toBe('docs:api:overview.adoc');
  });

  it('emits component:module:page when no source context is provided', () => {
    expect(buildXrefTargetFor(target)).toBe('docs:api:overview.adoc');
  });
});
