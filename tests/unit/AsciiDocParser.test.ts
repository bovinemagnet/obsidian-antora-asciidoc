import { describe, expect, it } from 'vitest';

import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';

describe('AsciiDocParser', () => {
  const parser = new AsciiDocParser();

  it('extracts xref targets with line/column', () => {
    const input = 'Line one\n\nSee xref:other.adoc[Other] for details.\n';
    const symbols = parser.parseSymbols(input);
    expect(symbols.xrefs).toHaveLength(1);
    expect(symbols.xrefs[0]).toMatchObject({ target: 'other.adoc', line: 3 });
  });

  it('extracts include targets', () => {
    const input = 'include::partial$intro.adoc[]\n';
    const symbols = parser.parseSymbols(input);
    expect(symbols.includes[0].target).toBe('partial$intro.adoc');
  });

  it('extracts attribute references and ignores braces in code', () => {
    const symbols = parser.parseSymbols('Hello {product-name}!');
    expect(symbols.attributes.map((a) => a.name)).toContain('product-name');
  });

  it('handles content with no symbols', () => {
    const symbols = parser.parseSymbols('Just plain text.');
    expect(symbols.xrefs).toEqual([]);
    expect(symbols.includes).toEqual([]);
    expect(symbols.attributes).toEqual([]);
  });
});
