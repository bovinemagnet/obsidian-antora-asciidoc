import { describe, expect, it } from 'vitest';

import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';
import { planBulkReplace } from '../../src/refactor/BulkReplace';

describe('planBulkReplace', () => {
  it('returns empty plan when pattern is empty', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'hello' });
    const plan = await planBulkReplace(source, { pattern: '', replacement: 'world' });
    expect(plan.matches).toEqual([]);
    expect(plan.fileChanges.size).toBe(0);
  });

  it('replaces all literal occurrences across files', async () => {
    const source = new InMemoryFileSource({
      'a.adoc': 'hello hello world',
      'b.adoc': 'hello again',
      'c.txt': 'hello (skipped)',
    });
    const plan = await planBulkReplace(source, { pattern: 'hello', replacement: 'hi' });
    expect(plan.matches).toHaveLength(3);
    expect(plan.fileChanges.get('a.adoc')).toBe('hi hi world');
    expect(plan.fileChanges.get('b.adoc')).toBe('hi again');
    expect(plan.fileChanges.has('c.txt')).toBe(false);
  });

  it('honours case-insensitive option', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'Hello HELLO heLLo' });
    const plan = await planBulkReplace(source, { pattern: 'hello', replacement: 'hi', caseSensitive: false });
    expect(plan.matches).toHaveLength(3);
    expect(plan.fileChanges.get('a.adoc')).toBe('hi hi hi');
  });

  it('treats pattern as regex when regex=true', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'foo123 bar45 baz' });
    const plan = await planBulkReplace(source, { pattern: '\\d+', replacement: '#', regex: true });
    expect(plan.matches.map((m) => m.matchedText)).toEqual(['123', '45']);
    expect(plan.fileChanges.get('a.adoc')).toBe('foo# bar# baz');
  });

  it('does not modify files with no matches', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'no match here' });
    const plan = await planBulkReplace(source, { pattern: 'xyz', replacement: 'q' });
    expect(plan.fileChanges.size).toBe(0);
  });

  it('records the line and column of each match', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'one\ntwo three\ntwo' });
    const plan = await planBulkReplace(source, { pattern: 'two', replacement: 'TWO' });
    expect(plan.matches).toEqual([
      { filePath: 'a.adoc', line: 2, column: 1, matchedText: 'two', replacementText: 'TWO', context: 'two three' },
      { filePath: 'a.adoc', line: 3, column: 1, matchedText: 'two', replacementText: 'TWO', context: 'two' },
    ]);
  });

  it('throws on invalid regex when regex=true', async () => {
    const source = new InMemoryFileSource({ 'a.adoc': 'x' });
    await expect(planBulkReplace(source, { pattern: '(unbalanced', replacement: '', regex: true }))
      .rejects.toThrow();
  });
});
