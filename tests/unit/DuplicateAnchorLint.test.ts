import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { findDuplicateAnchors } from '../../src/diagnostics/DuplicateAnchorLint';

function addPage(index: AntoraComponentIndex, component: string, module: string, path: string, anchors: string[]): void {
  index.upsertPage({
    component, version: '1.0', module, path,
    filePath: `${component}/modules/${module}/pages/${path}`,
    anchors: new Set(anchors),
  });
}

describe('findDuplicateAnchors', () => {
  it('reports no duplicates when each anchor lives on a single page', () => {
    const index = new AntoraComponentIndex();
    addPage(index, 'docs', 'ROOT', 'a.adoc', ['x']);
    addPage(index, 'docs', 'ROOT', 'b.adoc', ['y']);
    expect(findDuplicateAnchors(index)).toEqual([]);
  });

  it('flags an anchor used on two pages within the same component', () => {
    const index = new AntoraComponentIndex();
    addPage(index, 'docs', 'ROOT', 'a.adoc', ['shared']);
    addPage(index, 'docs', 'ROOT', 'b.adoc', ['shared']);

    const out = findDuplicateAnchors(index);
    expect(out).toHaveLength(2);
    for (const diag of out) {
      expect(diag.message).toContain('shared');
      expect(diag.severity).toBe('warning');
    }
  });

  it('does NOT flag anchors that share a name across components', () => {
    const index = new AntoraComponentIndex();
    addPage(index, 'docs', 'ROOT', 'a.adoc', ['shared']);
    addPage(index, 'other', 'ROOT', 'b.adoc', ['shared']);
    expect(findDuplicateAnchors(index)).toEqual([]);
  });

  it('lists every conflicting page in the diagnostic message', () => {
    const index = new AntoraComponentIndex();
    addPage(index, 'docs', 'ROOT', 'a.adoc', ['shared']);
    addPage(index, 'docs', 'mod', 'b.adoc', ['shared']);
    addPage(index, 'docs', 'ROOT', 'c.adoc', ['shared']);

    const out = findDuplicateAnchors(index);
    expect(out).toHaveLength(3);
    for (const diag of out) {
      expect(diag.message).toContain('ROOT:a.adoc');
      expect(diag.message).toContain('mod:b.adoc');
      expect(diag.message).toContain('ROOT:c.adoc');
    }
  });
});
