import { describe, expect, it } from 'vitest';

import {
  AntoraComponentIndex,
  collectAnchors,
} from '../../src/antora/AntoraComponentIndex';

describe('AntoraComponentIndex', () => {
  it('resolves pages by all three key shapes', () => {
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs/modules/ROOT/pages/index.adoc',
      anchors: new Set(),
    });

    expect(index.resolvePage({ page: 'index.adoc' })).toBeDefined();
    expect(index.resolvePage({ module: 'ROOT', page: 'index.adoc' })).toBeDefined();
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })).toBeDefined();
    expect(index.resolvePage({ page: 'missing.adoc' })).toBeUndefined();
  });

  it('lists targets with all three encodings', () => {
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs/modules/ROOT/pages/index.adoc',
      anchors: new Set(),
    });

    const targets = index.listPageTargets();
    expect(targets).toContain('index.adoc');
    expect(targets).toContain('ROOT:index.adoc');
    expect(targets).toContain('docs:ROOT:index.adoc');
  });

  it('clears cleanly', () => {
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'a',
      version: '1.0',
      module: 'ROOT',
      path: 'p.adoc',
      filePath: 'x',
      anchors: new Set(),
    });
    index.clear();
    expect(index.getComponents()).toHaveLength(0);
    expect(index.listPageTargets()).toHaveLength(0);
  });
});

describe('collectAnchors', () => {
  it('finds [[id]] block anchors', () => {
    expect(collectAnchors('[[my-anchor]]\nText')).toContain('my-anchor');
  });

  it('finds [#id] inline anchors', () => {
    expect(collectAnchors('[#another-anchor]\n== Heading')).toContain('another-anchor');
  });

  it('finds [id="foo"] anchors', () => {
    expect(collectAnchors('[id="quoted"]\n== Heading')).toContain('quoted');
  });

  it('strips reftext from [[id,reftext]]', () => {
    expect(collectAnchors('[[my-anchor,Some Reference]]')).toContain('my-anchor');
  });

  it('generates section auto-IDs from headings', () => {
    const anchors = collectAnchors('= Doc Title\n\n== My Section\n\n=== Another Section\n');
    expect(anchors).toContain('_my_section');
    expect(anchors).toContain('_another_section');
  });

  it('handles headings with leading numbers and punctuation', () => {
    const anchors = collectAnchors('== 1. My Heading!');
    expect(anchors).toContain('_1_my_heading');
  });

  it('preserves embedded digits', () => {
    const anchors = collectAnchors('== API v2.0');
    expect(anchors).toContain('_api_v2_0');
  });

  it('honours :idprefix: and :idseparator: document attributes', () => {
    const anchors = collectAnchors(':idprefix:\n:idseparator: -\n\n== My Section');
    expect(anchors).toContain('my-section');
  });

  it('skips headings that contain only punctuation', () => {
    const anchors = collectAnchors('== !!!\n');
    expect(Array.from(anchors).filter((a) => a.startsWith('_'))).toEqual([]);
  });

  it('strips inline formatting before slugging', () => {
    const anchors = collectAnchors('== *Bold* `Code`');
    expect(anchors).toContain('_bold_code');
  });
});
