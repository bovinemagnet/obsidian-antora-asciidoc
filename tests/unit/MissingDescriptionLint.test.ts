import { describe, expect, it } from 'vitest';

import { lintMissingDescription } from '../../src/diagnostics/MissingDescriptionLint';

describe('lintMissingDescription', () => {
  it('returns no warnings when :description: is present', () => {
    expect(lintMissingDescription('= Title\n:description: A page.\n', 'p.adoc')).toEqual([]);
  });

  it('flags pages with a level-0 heading and no description', () => {
    const out = lintMissingDescription('= Title\n\nBody.', 'p.adoc');
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('info');
  });

  it('skips files with no level-0 heading (partials, non-pages)', () => {
    expect(lintMissingDescription('Just some content.', 'p.adoc')).toEqual([]);
  });

  it('treats `:description:` with empty value as missing', () => {
    const out = lintMissingDescription('= Title\n:description:\n', 'p.adoc');
    expect(out).toHaveLength(1);
  });
});
