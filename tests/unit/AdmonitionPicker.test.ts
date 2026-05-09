import { describe, expect, it } from 'vitest';

import { buildAdmonitionBlock } from '../../src/views/AdmonitionPicker';

describe('buildAdmonitionBlock', () => {
  it('wraps content in the requested admonition type', () => {
    expect(buildAdmonitionBlock('NOTE', 'Hello.')).toBe('[NOTE]\n====\nHello.\n====');
  });

  it('preserves multi-line content', () => {
    const out = buildAdmonitionBlock('TIP', 'Line one\nLine two');
    expect(out).toContain('[TIP]');
    expect(out).toContain('Line one\nLine two');
  });

  it('emits each admonition type', () => {
    for (const type of ['NOTE', 'TIP', 'WARNING', 'CAUTION', 'IMPORTANT'] as const) {
      expect(buildAdmonitionBlock(type, 'x')).toContain(`[${type}]`);
    }
  });
});
