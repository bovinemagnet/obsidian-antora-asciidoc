import { describe, expect, it } from 'vitest';

import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { detectAttributeReferenceAt, findAttributeUsages } from '../../src/diagnostics/AttributeUsage';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

describe('detectAttributeReferenceAt', () => {
  it('returns the name when the cursor is inside the braces', () => {
    expect(detectAttributeReferenceAt('Welcome to {product-name} today.', 14)).toBe('product-name');
  });

  it('returns null when the cursor is elsewhere', () => {
    expect(detectAttributeReferenceAt('No reference here.', 4)).toBeNull();
  });

  it('finds the first matching reference when several are present', () => {
    const line = '{a} and {b}';
    expect(detectAttributeReferenceAt(line, 1)).toBe('a');
    expect(detectAttributeReferenceAt(line, 9)).toBe('b');
  });
});

describe('findAttributeUsages', () => {
  it('emits one diagnostic per reference, including repeats on the same line', async () => {
    const source = new InMemoryFileSource({
      'docs/a.adoc': 'Hello {x} world {x} again.',
      'docs/b.adoc': 'No matches.',
    });
    const out = await findAttributeUsages(source, new AsciiDocParser(), 'x');
    expect(out).toHaveLength(2);
    for (const diag of out) {
      expect(diag.filePath).toBe('docs/a.adoc');
      expect(diag.severity).toBe('info');
    }
  });

  it('returns an empty list when no page references the attribute', async () => {
    const source = new InMemoryFileSource({ 'docs/a.adoc': '= No attrs' });
    const out = await findAttributeUsages(source, new AsciiDocParser(), 'whatever');
    expect(out).toEqual([]);
  });
});
