import { describe, expect, it } from 'vitest';

import { convertWikilink, detectWikilinkAt } from '../../src/asciidoc/WikilinkConverter';

describe('convertWikilink', () => {
  it('converts a bare wikilink', () => {
    expect(convertWikilink('about', undefined, undefined)).toBe('xref:about.adoc[]');
  });

  it('preserves an existing .adoc extension', () => {
    expect(convertWikilink('about.adoc', undefined, undefined)).toBe('xref:about.adoc[]');
  });

  it('keeps the alias as the link text', () => {
    expect(convertWikilink('about', undefined, 'About us')).toBe('xref:about.adoc[About us]');
  });

  it('passes the anchor through', () => {
    expect(convertWikilink('about', 'mission', 'Mission')).toBe('xref:about.adoc#mission[Mission]');
  });
});

describe('detectWikilinkAt', () => {
  it('returns the match metadata when the cursor is inside a wikilink', () => {
    const line = 'See [[about|About]] for details.';
    const match = detectWikilinkAt(line, 8);
    expect(match).toEqual({
      startCh: 4,
      endCh: 19,
      replacement: 'xref:about.adoc[About]',
    });
  });

  it('returns null when the cursor is outside any wikilink', () => {
    expect(detectWikilinkAt('No wikilinks here.', 5)).toBeNull();
  });

  it('handles wikilinks with anchors', () => {
    const line = '[[about#mission|Mission]]';
    const match = detectWikilinkAt(line, 5);
    expect(match?.replacement).toBe('xref:about.adoc#mission[Mission]');
  });
});
