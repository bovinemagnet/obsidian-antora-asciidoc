import { describe, expect, it } from 'vitest';

import { VALUE_SETS } from '../../src/editor/BlockAttributeValueAutocomplete';

describe('Block attribute value sets', () => {
  it('exposes canonical alignment values', () => {
    expect(VALUE_SETS.align).toEqual(['left', 'center', 'right']);
    expect(VALUE_SETS.valign).toEqual(['top', 'middle', 'bottom']);
  });

  it('subs covers the standard substitution names', () => {
    expect(VALUE_SETS.subs).toContain('specialcharacters');
    expect(VALUE_SETS.subs).toContain('attributes');
    expect(VALUE_SETS.subs).toContain('macros');
  });

  it('opts and options share the same value set', () => {
    expect(VALUE_SETS.opts).toEqual(VALUE_SETS.options);
  });

  it('window targets cover anchor target keywords', () => {
    expect(VALUE_SETS.window).toContain('_blank');
    expect(VALUE_SETS.window).toContain('_self');
  });
});
