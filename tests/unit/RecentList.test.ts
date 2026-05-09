import { describe, expect, it } from 'vitest';

import { RecentList } from '../../src/util/RecentList';

describe('RecentList', () => {
  it('records visits most-recent first', () => {
    const list = new RecentList(5);
    list.visit('a');
    list.visit('b');
    list.visit('c');
    expect(list.list()).toEqual(['c', 'b', 'a']);
  });

  it('promotes a re-visit to the front without duplicating', () => {
    const list = new RecentList(5);
    list.visit('a');
    list.visit('b');
    list.visit('a');
    expect(list.list()).toEqual(['a', 'b']);
  });

  it('caps the list at the configured capacity', () => {
    const list = new RecentList(3);
    for (const item of ['a', 'b', 'c', 'd', 'e']) {
      list.visit(item);
    }
    expect(list.list()).toEqual(['e', 'd', 'c']);
  });

  it('forget removes an item without affecting order', () => {
    const list = new RecentList(5);
    ['a', 'b', 'c'].forEach((i) => list.visit(i));
    list.forget('b');
    expect(list.list()).toEqual(['c', 'a']);
  });

  it('rejects zero or negative capacity', () => {
    expect(() => new RecentList(0)).toThrow();
    expect(() => new RecentList(-1)).toThrow();
  });
});
