import { describe, expect, it } from 'vitest';

import { parseNavigation } from '../../src/antora/NavigationParser';

describe('parseNavigation', () => {
  it('parses a flat list of xref entries', () => {
    const entries = parseNavigation([
      '* xref:index.adoc[Home]',
      '* xref:about.adoc[About]',
    ].join('\n'));

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ label: 'Home', target: 'index.adoc' });
    expect(entries[1]).toMatchObject({ label: 'About', target: 'about.adoc' });
  });

  it('builds a hierarchy from bullet depth', () => {
    const entries = parseNavigation([
      '* xref:guides.adoc[Guides]',
      '** xref:guides/install.adoc[Install]',
      '** xref:guides/upgrade.adoc[Upgrade]',
      '*** xref:guides/upgrade/breaking.adoc[Breaking changes]',
      '* xref:reference.adoc[Reference]',
    ].join('\n'));

    expect(entries).toHaveLength(2);
    expect(entries[0].children).toHaveLength(2);
    expect(entries[0].children[1].children).toHaveLength(1);
    expect(entries[0].children[1].children[0].label).toBe('Breaking changes');
  });

  it('falls back to the target when the label is empty', () => {
    const entries = parseNavigation('* xref:no-label.adoc[]');
    expect(entries[0].label).toBe('no-label.adoc');
  });

  it('treats non-xref bullets as grouping labels', () => {
    const entries = parseNavigation([
      '* Section heading',
      '** xref:nested.adoc[Nested]',
    ].join('\n'));
    expect(entries[0].label).toBe('Section heading');
    expect(entries[0].target).toBeUndefined();
    expect(entries[0].children).toHaveLength(1);
  });

  it('ignores blank lines and non-bullet content', () => {
    const entries = parseNavigation([
      '= Navigation Title',
      '',
      '* xref:home.adoc[Home]',
      'paragraph text in the middle',
      '* xref:about.adoc[About]',
    ].join('\n'));
    expect(entries).toHaveLength(2);
  });
});
