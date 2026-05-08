import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = `name: docs
version: '1.0'
title: Documentation
asciidoc:
  attributes:
    product-name: Acme Widgets
    api-version: '2'
`;

describe('AntoraWorkspaceScanner', () => {
  it('detects an Antora component and indexes its pages', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/index.adoc': '= Index\n\nHello.',
      'docs/modules/ROOT/pages/about.adoc': '= About',
      'docs/modules/ROOT/partials/snippet.adoc': 'Reusable',
      'docs/modules/ROOT/examples/example.txt': 'sample',
      'docs/modules/ROOT/assets/images/logo.png': 'binary',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    const result = await scanner.scan(index);

    expect(result.isAntoraWorkspace).toBe(true);
    expect(result.projects).toHaveLength(1);
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })).toBeDefined();
    expect(index.resolvePage({ module: 'ROOT', page: 'about.adoc' })).toBeDefined();
  });

  it('registers asciidoc.attributes with their values', async () => {
    const source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.hasAttribute('product-name')).toBe(true);
    const attrs = index.getDescriptorAttributesFor('docs/modules/ROOT/pages/page.adoc');
    expect(attrs.get('product-name')).toBe('Acme Widgets');
    expect(attrs.get('api-version')).toBe('2');
    expect(index.hasAttribute('not-defined')).toBe(false);
  });

  it('records page-level attribute names so diagnostics recognise them', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/page.adoc': '= Title\n:page-attr: page-value\n:other: 42\n\nBody.\n',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.hasAttribute('page-attr')).toBe(true);
    expect(index.hasAttribute('other')).toBe(true);
    // Page values are *not* stored on the index — they are page-scoped and
    // resolved at render time. Only descriptor values appear here.
    expect(index.getDescriptorAttributesFor('docs/modules/ROOT/pages/page.adoc').has('page-attr')).toBe(false);
  });

  it('keeps descriptor attributes scoped to the owning component', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'other/antora.yml': 'name: other\nversion: \'1.0\'\nasciidoc:\n  attributes:\n    product-name: Different\n',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.getDescriptorAttributesFor('docs/modules/ROOT/pages/p.adoc').get('product-name')).toBe('Acme Widgets');
    expect(index.getDescriptorAttributesFor('other/modules/ROOT/pages/p.adoc').get('product-name')).toBe('Different');
  });

  it('reports no workspace when no antora.yml is present', async () => {
    const source = new InMemoryFileSource({ 'docs/page.adoc': '= Just a page' });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    const result = await scanner.scan(index);

    expect(result.isAntoraWorkspace).toBe(false);
  });

  it('handles malformed antora.yml without throwing', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': 'name: docs\n  bad indent: yes\n',
      'docs/modules/ROOT/pages/p.adoc': '= P',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await expect(scanner.scan(index)).resolves.toBeDefined();
  });
});
