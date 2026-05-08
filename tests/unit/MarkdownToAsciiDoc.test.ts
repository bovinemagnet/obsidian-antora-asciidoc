import { describe, expect, it } from 'vitest';

import { convertMarkdownToAsciiDoc } from '../../src/asciidoc/MarkdownToAsciiDoc';

describe('convertMarkdownToAsciiDoc', () => {
  it('converts ATX headings', () => {
    expect(convertMarkdownToAsciiDoc('# Title')).toBe('= Title');
    expect(convertMarkdownToAsciiDoc('### Sub')).toBe('=== Sub');
    expect(convertMarkdownToAsciiDoc('###### Deep')).toBe('====== Deep');
  });

  it('converts bold and italic', () => {
    expect(convertMarkdownToAsciiDoc('**bold** and *italic*')).toBe('*bold* and _italic_');
    expect(convertMarkdownToAsciiDoc('__bold__ and _italic_')).toBe('*bold* and _italic_');
  });

  it('converts inline code', () => {
    expect(convertMarkdownToAsciiDoc('use `npm test`')).toBe('use +npm test+');
  });

  it('converts links and treats .adoc targets as xrefs', () => {
    expect(convertMarkdownToAsciiDoc('[here](https://example.com)'))
      .toBe('link:https://example.com[here]');
    expect(convertMarkdownToAsciiDoc('[here](other.adoc)'))
      .toBe('xref:other.adoc[here]');
    expect(convertMarkdownToAsciiDoc('[here](other.adoc#anchor)'))
      .toBe('xref:other.adoc#anchor[here]');
  });

  it('converts fenced code blocks with language hint', () => {
    const md = '```python\nprint("hi")\n```';
    const adoc = convertMarkdownToAsciiDoc(md);
    expect(adoc).toContain('[source,python]');
    expect(adoc).toContain('----');
    expect(adoc).toContain('print("hi")');
  });

  it('converts bulleted and numbered lists', () => {
    expect(convertMarkdownToAsciiDoc('- one\n- two')).toBe('* one\n* two');
    expect(convertMarkdownToAsciiDoc('1. first\n2. second')).toBe('. first\n. second');
  });

  it('converts blockquotes', () => {
    const md = '> wisdom\n> more wisdom';
    const adoc = convertMarkdownToAsciiDoc(md);
    expect(adoc).toContain('[quote]');
    expect(adoc).toContain('____');
    expect(adoc).toContain('wisdom');
  });

  it('converts horizontal rules', () => {
    expect(convertMarkdownToAsciiDoc('---')).toBe("'''");
    expect(convertMarkdownToAsciiDoc('***')).toBe("'''");
  });

  it('preserves content inside fenced blocks', () => {
    const md = '```\n# not a heading\n**not bold**\n```';
    const adoc = convertMarkdownToAsciiDoc(md);
    expect(adoc).toContain('# not a heading');
    expect(adoc).toContain('**not bold**');
  });
});
