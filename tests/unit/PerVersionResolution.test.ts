import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex, compareVersionsDescending } from '../../src/antora/AntoraComponentIndex';

function addPage(index: AntoraComponentIndex, version: string, suffix: string = ''): void {
  index.upsertPage({
    component: 'docs',
    version,
    module: 'ROOT',
    path: 'index.adoc',
    filePath: `docs-${version}${suffix}/modules/ROOT/pages/index.adoc`,
    anchors: new Set(),
  });
}

describe('Per-version xref resolution', () => {
  it('returns the only version when only one exists', () => {
    const index = new AntoraComponentIndex();
    addPage(index, '1.0');
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })?.version).toBe('1.0');
  });

  it('prefers the explicit version when one is requested', () => {
    const index = new AntoraComponentIndex();
    addPage(index, '1.0');
    addPage(index, '2.0');
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', version: '1.0', page: 'index.adoc' })?.version)
      .toBe('1.0');
  });

  it('returns undefined when the explicit version does not exist', () => {
    const index = new AntoraComponentIndex();
    addPage(index, '1.0');
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', version: '99.0', page: 'index.adoc' }))
      .toBeUndefined();
  });

  it('picks the highest version when no version is requested', () => {
    const index = new AntoraComponentIndex();
    addPage(index, '1.0');
    addPage(index, '10.0');
    addPage(index, '2.0');
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })?.version)
      .toBe('10.0');
  });

  it('treats master/main as higher than any tagged version', () => {
    const index = new AntoraComponentIndex();
    addPage(index, '1.0');
    addPage(index, 'master');
    addPage(index, '2.0');
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })?.version)
      .toBe('master');
  });
});

describe('compareVersionsDescending', () => {
  it('numeric segments sort numerically', () => {
    const entries = ['1.0', '10.0', '2.0', '1.1'].map((v) => ({
      version: v, component: 'docs', module: 'ROOT', path: 'p.adoc', filePath: '', anchors: new Set<string>(),
    }));
    entries.sort(compareVersionsDescending);
    expect(entries.map((e) => e.version)).toEqual(['10.0', '2.0', '1.1', '1.0']);
  });
});
