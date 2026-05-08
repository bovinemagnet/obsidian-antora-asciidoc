import { describe, expect, it } from 'vitest';

import { buildPageTemplate, buildPartialTemplate } from '../../src/asciidoc/Templates';

describe('buildPageTemplate', () => {
  it('emits a level-0 heading with the given title', () => {
    const out = buildPageTemplate({ title: 'Custom Title' });
    expect(out.split('\n')[0]).toBe('= Custom Title');
  });

  it('falls back to defaults when no context is supplied', () => {
    const out = buildPageTemplate();
    expect(out).toContain('= Page Title');
    expect(out).toContain(':author: Paul Snow');
    expect(out).toContain('== Section title');
  });

  it('includes the description attribute', () => {
    const out = buildPageTemplate({ description: 'My page.' });
    expect(out).toContain(':description: My page.');
  });
});

describe('buildPartialTemplate', () => {
  it('references the partial$ inclusion form', () => {
    const out = buildPartialTemplate({ name: 'intro' });
    expect(out).toContain('include::partial$intro.adoc');
  });

  it('uses a sensible default name', () => {
    const out = buildPartialTemplate();
    expect(out).toContain('partial-name');
  });
});
