import { describe, expect, it } from 'vitest';

import { extractOutline } from '../../src/asciidoc/PageOutlineExtractor';

describe('extractOutline', () => {
  it('captures every heading with its level and 1-based line', () => {
    const out = extractOutline('= Title\n\n== Section\n\n=== Sub\n');
    expect(out).toEqual([
      { kind: 'heading', level: 1, text: 'Title', line: 1 },
      { kind: 'heading', level: 2, text: 'Section', line: 3 },
      { kind: 'heading', level: 3, text: 'Sub', line: 5 },
    ]);
  });

  it('captures standalone block anchors', () => {
    const out = extractOutline('[[my-anchor]]\nText follows.\n');
    expect(out).toEqual([{ kind: 'anchor', level: 0, text: 'my-anchor', line: 1 }]);
  });

  it('skips anchors that immediately precede a heading', () => {
    const out = extractOutline('[[my-anchor]]\n== Section');
    expect(out).toEqual([{ kind: 'heading', level: 2, text: 'Section', line: 2 }]);
  });

  it('captures inline anchors when standalone', () => {
    const out = extractOutline('[#inline]\nText\n');
    expect(out).toEqual([{ kind: 'anchor', level: 0, text: 'inline', line: 1 }]);
  });

  it('returns empty for documents with no headings or anchors', () => {
    expect(extractOutline('Just text.\n')).toEqual([]);
  });

  it('preserves document order', () => {
    const out = extractOutline('= A\n\n[[mid]]\nstuff\n\n== B\n');
    expect(out.map((e) => `${e.line}:${e.text}`)).toEqual(['1:A', '3:mid', '6:B']);
  });
});
