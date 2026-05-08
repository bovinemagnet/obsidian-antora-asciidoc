import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AsciiDocPreviewRenderer } from '../../src/asciidoc/AsciiDocPreviewRenderer';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

describe('AsciiDocPreviewRenderer', () => {
  it('renders headings to HTML', async () => {
    const index = new AntoraComponentIndex();
    const source = new InMemoryFileSource();
    const renderer = new AsciiDocPreviewRenderer(index, source);

    const html = await renderer.render('= Title\n\n== Section\n\nHello world.', { sourcePath: 'docs/page.adoc' });

    expect(html).toContain('Hello world');
    expect(html).toMatch(/<h[1-3]/);
  });

  it('substitutes descriptor attribute values for pages inside that descriptor', async () => {
    const index = new AntoraComponentIndex();
    index.registerDescriptorAttributes('docs', [['product-name', 'Acme']]);
    const renderer = new AsciiDocPreviewRenderer(index, new InMemoryFileSource());

    const html = await renderer.render('Welcome to {product-name}.', { sourcePath: 'docs/page.adoc' });

    expect(html).toContain('Acme');
  });

  it('page-level attributes override descriptor values at render time', async () => {
    const index = new AntoraComponentIndex();
    index.registerDescriptorAttributes('docs', [['product-name', 'Acme']]);
    const renderer = new AsciiDocPreviewRenderer(index, new InMemoryFileSource());

    const html = await renderer.render(
      '= Title\n:product-name: Override\n\nWelcome to {product-name}.',
      { sourcePath: 'docs/modules/ROOT/pages/page.adoc' },
    );

    expect(html).toContain('Override');
    expect(html).not.toContain('Acme');
  });

  it('descriptor attributes are not visible to pages in a different component', async () => {
    const index = new AntoraComponentIndex();
    index.registerDescriptorAttributes('docs', [['product-name', 'Acme']]);
    const renderer = new AsciiDocPreviewRenderer(index, new InMemoryFileSource());

    const html = await renderer.render('Welcome to {product-name}.', { sourcePath: 'other/page.adoc' });
    // Asciidoctor with a missing attribute renders the placeholder verbatim.
    expect(html).toContain('{product-name}');
  });

  it('inlines content from include:: directives', async () => {
    const source = new InMemoryFileSource({ 'docs/snippets/intro.adoc': 'Included paragraph.' });
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), source);

    const html = await renderer.render('include::snippets/intro.adoc[]', { sourcePath: 'docs/page.adoc' });

    expect(html).toContain('Included paragraph');
  });

  it('emits a placeholder for unresolved includes instead of throwing', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());

    const html = await renderer.render('include::missing.adoc[]', { sourcePath: 'docs/page.adoc' });

    expect(html.toLowerCase()).toContain('unresolved');
  });

  it('rewrites [mermaid] blocks into a language-mermaid code block', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());

    const source = [
      '[mermaid]',
      '----',
      'graph LR',
      'A --> B',
      '----',
      '',
    ].join('\n');
    const html = await renderer.render(source, { sourcePath: 'docs/page.adoc' });

    expect(html).toMatch(/class="language-mermaid"/);
    expect(html).toContain('graph LR');
  });

  it('rewrites [plantuml] blocks too', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());

    const source = [
      '[plantuml]',
      '----',
      '@startuml',
      'A -> B',
      '@enduml',
      '----',
      '',
    ].join('\n');
    const html = await renderer.render(source, { sourcePath: 'docs/page.adoc' });

    expect(html).toMatch(/class="language-plantuml"/);
  });

  it('marks [tabs%sync] blocks with is-sync class', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());

    const source = [
      '[tabs%sync]',
      '======',
      'Tab A::',
      '+',
      'Content for tab A.',
      '======',
      '',
    ].join('\n');
    const html = await renderer.render(source, { sourcePath: 'docs/page.adoc' });

    expect(html).toMatch(/class="tabs is-sync"/);
  });

  it('returns diagnostics from renderWithDiagnostics on a clean render', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());
    const result = await renderer.renderWithDiagnostics('= Title\n\n== Section\n\nHello.', { sourcePath: 'p.adoc' });
    expect(result.html).toContain('Hello');
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('renders [tabs] blocks into a tabbed container', async () => {
    const renderer = new AsciiDocPreviewRenderer(new AntoraComponentIndex(), new InMemoryFileSource());

    const source = [
      '[tabs]',
      '======',
      'Tab A::',
      '+',
      'Content for tab A.',
      '',
      'Tab B::',
      '+',
      'Content for tab B.',
      '======',
      '',
    ].join('\n');
    const html = await renderer.render(source, { sourcePath: 'docs/page.adoc' });

    expect(html).toMatch(/class="tabs"/);
    expect(html).toMatch(/class="tablist"/);
    expect(html).toMatch(/class="tabpanel"/);
    expect(html).toContain('Tab A');
    expect(html).toContain('Tab B');
    expect(html).toContain('Content for tab A');
    expect(html).toContain('Content for tab B');
  });
});
