import { describe, expect, it } from 'vitest';

import { findDisabledRanges, isLineWithinDisabledRange } from '../../src/asciidoc/ConditionalBlocks';

describe('findDisabledRanges', () => {
  it('marks an ifdef block as disabled when the guard is unknown', () => {
    const content = [
      'before',          // line 1
      'ifdef::feature[]', // line 2
      'inside',          // line 3
      'still inside',    // line 4
      'endif::[]',       // line 5
      'after',           // line 6
    ].join('\n');
    const ranges = findDisabledRanges(content, new Set());
    expect(ranges).toEqual([{ startLine: 3, endLine: 4 }]);
  });

  it('marks an ifdef block as enabled when the guard is known', () => {
    const content = 'ifdef::feature[]\ninside\nendif::[]\n';
    const ranges = findDisabledRanges(content, new Set(['feature']));
    expect(ranges).toEqual([]);
  });

  it('inverts behaviour for ifndef', () => {
    const known = new Set(['feature']);
    const inSet = findDisabledRanges('ifndef::feature[]\ninside\nendif::[]\n', known);
    expect(inSet).toHaveLength(1);
    const notInSet = findDisabledRanges('ifndef::other[]\ninside\nendif::[]\n', known);
    expect(notInSet).toEqual([]);
  });

  it('handles a, b (any) and a+b (all) operators', () => {
    const known = new Set(['a']);
    expect(findDisabledRanges('ifdef::a,b[]\nx\nendif::[]\n', known)).toEqual([]);
    expect(findDisabledRanges('ifdef::a+b[]\nx\nendif::[]\n', known)).toHaveLength(1);
    expect(findDisabledRanges('ifdef::a+b[]\nx\nendif::[]\n', new Set(['a', 'b']))).toEqual([]);
  });

  it('always treats ifeval as disabled', () => {
    const content = 'ifeval::["{x}" == "y"]\ninside\nendif::[]\n';
    expect(findDisabledRanges(content, new Set(['x']))).toHaveLength(1);
  });

  it('handles nested conditionals', () => {
    const content = [
      'ifdef::outer[]',  // 1
      'outer enabled',   // 2
      'ifdef::inner[]',  // 3
      'inner content',   // 4
      'endif::[]',       // 5
      'endif::[]',       // 6
    ].join('\n');
    const ranges = findDisabledRanges(content, new Set(['outer']));
    // outer is enabled, inner is disabled → only the inner range is reported.
    expect(ranges).toEqual([{ startLine: 4, endLine: 4 }]);
  });

  it('isLineWithinDisabledRange returns true for lines inside any range', () => {
    const ranges = [{ startLine: 3, endLine: 5 }, { startLine: 10, endLine: 12 }];
    expect(isLineWithinDisabledRange(4, ranges)).toBe(true);
    expect(isLineWithinDisabledRange(11, ranges)).toBe(true);
    expect(isLineWithinDisabledRange(2, ranges)).toBe(false);
    expect(isLineWithinDisabledRange(8, ranges)).toBe(false);
  });
});
