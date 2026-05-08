import { describe, expect, it } from 'vitest';

import { convertAsciiDocToMarkdown } from '../../src/asciidoc/AsciiDocToMarkdown';

describe('convertAsciiDocToMarkdown', () => {
  it('converts headings', () => {
    expect(convertAsciiDocToMarkdown('= Title')).toBe('# Title');
    expect(convertAsciiDocToMarkdown('=== Sub')).toBe('### Sub');
  });

  it('converts bold and italic', () => {
    expect(convertAsciiDocToMarkdown('*bold* and _italic_')).toBe('**bold** and *italic*');
  });

  it('converts inline code', () => {
    expect(convertAsciiDocToMarkdown('use +npm test+')).toBe('use `npm test`');
  });

  it('converts xref to a link with the .adoc target preserved', () => {
    expect(convertAsciiDocToMarkdown('xref:other.adoc[See here]')).toBe('[See here](other.adoc)');
    expect(convertAsciiDocToMarkdown('xref:other.adoc[]')).toBe('[other.adoc](other.adoc)');
  });

  it('converts link macros', () => {
    expect(convertAsciiDocToMarkdown('link:https://example.com[Example]'))
      .toBe('[Example](https://example.com)');
  });

  it('converts image macros', () => {
    expect(convertAsciiDocToMarkdown('image::logo.png[Acme logo]')).toBe('![Acme logo](logo.png)');
  });

  it('converts source blocks with language hint', () => {
    const adoc = '[source,python]\n----\nprint("hi")\n----';
    const md = convertAsciiDocToMarkdown(adoc);
    expect(md).toContain('```python');
    expect(md).toContain('print("hi")');
    expect(md).toContain('```');
  });

  it('converts bulleted and numbered lists', () => {
    expect(convertAsciiDocToMarkdown('* one\n* two')).toBe('- one\n- two');
    expect(convertAsciiDocToMarkdown('. first\n. second')).toBe('1. first\n1. second');
  });

  it('converts quote blocks to blockquotes', () => {
    const adoc = '[quote]\n____\nwisdom\n____';
    const md = convertAsciiDocToMarkdown(adoc);
    expect(md).toContain('> wisdom');
  });

  it('converts horizontal rule', () => {
    expect(convertAsciiDocToMarkdown("'''")).toBe('---');
  });

  it('preserves source-block content verbatim', () => {
    const adoc = '[source]\n----\n= not a heading\n*not bold*\n----';
    const md = convertAsciiDocToMarkdown(adoc);
    expect(md).toContain('= not a heading');
    expect(md).toContain('*not bold*');
  });
});
