import { describe, expect, it } from 'vitest';

import { CompositeFileSource } from '../../src/io/CompositeFileSource';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

describe('CompositeFileSource', () => {
  it('lists files from all sources without duplicates', () => {
    const a = new InMemoryFileSource({ 'docs/a.adoc': 'A' });
    const b = new InMemoryFileSource({ 'docs/b.adoc': 'B', 'docs/a.adoc': 'duplicate' });

    const composite = new CompositeFileSource([a, b]);
    const paths = composite.list().map((file) => file.path);

    expect(paths).toEqual(expect.arrayContaining(['docs/a.adoc', 'docs/b.adoc']));
    expect(paths.filter((p) => p === 'docs/a.adoc')).toHaveLength(1);
  });

  it('reads from the first source that owns the path', async () => {
    const overlay = new InMemoryFileSource({ 'shared.adoc': 'overlay' });
    const base = new InMemoryFileSource({ 'shared.adoc': 'base' });

    const composite = new CompositeFileSource([overlay, base]);
    const file = composite.list().find((f) => f.path === 'shared.adoc')!;
    expect(await composite.read(file)).toBe('overlay');
  });

  it('exists is true if any source has the path', () => {
    const a = new InMemoryFileSource({ 'a.txt': '' });
    const b = new InMemoryFileSource({ 'b.txt': '' });
    const composite = new CompositeFileSource([a, b]);

    expect(composite.exists('a.txt')).toBe(true);
    expect(composite.exists('b.txt')).toBe(true);
    expect(composite.exists('c.txt')).toBe(false);
  });
});
