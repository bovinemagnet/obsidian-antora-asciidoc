import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

describe('Scanner navigation registration', () => {
  it('registers a discovered nav.adoc against its module', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': "name: docs\nversion: '1.0'\n",
      'docs/modules/ROOT/nav.adoc': '* xref:index.adoc[Home]\n** xref:install.adoc[Install]\n',
      'docs/modules/ROOT/pages/index.adoc': '= Home',
      'docs/modules/ROOT/pages/install.adoc': '= Install',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    const nav = index.getNavigation('docs', 'ROOT');
    expect(nav).toHaveLength(1);
    expect(nav[0].label).toBe('Home');
    expect(nav[0].children[0].label).toBe('Install');
  });

  it('honours nav: paths declared in antora.yml', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': "name: docs\nversion: '1.0'\nnav:\n  - modules/ROOT/custom-nav.adoc\n",
      'docs/modules/ROOT/custom-nav.adoc': '* xref:index.adoc[Home]\n',
      'docs/modules/ROOT/pages/index.adoc': '= Home',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    const nav = index.getNavigation('docs', 'ROOT');
    expect(nav).toHaveLength(1);
    expect(nav[0].label).toBe('Home');
  });
});
