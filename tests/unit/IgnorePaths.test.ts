import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

describe('Scanner ignorePaths', () => {
  it('skips files under an ignored prefix during scan', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/keep.adoc': '= Keep',
      'docs/modules/ROOT/pages/skip.adoc': '= Skip',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser(), {
      ignorePaths: ['docs/modules/ROOT/pages/skip.adoc'],
    });
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.resolvePage({ module: 'ROOT', page: 'keep.adoc' })).toBeDefined();
    expect(index.resolvePage({ module: 'ROOT', page: 'skip.adoc' })).toBeUndefined();
  });

  it('skips entire subtrees', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/a.adoc': '= A',
      'archive/old/antora.yml': "name: legacy\nversion: '0.9'\n",
      'archive/old/modules/ROOT/pages/x.adoc': '= X',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser(), {
      ignorePaths: ['archive'],
    });
    const index = new AntoraComponentIndex();

    await scanner.scan(index);

    expect(index.getComponents().map((c) => c.name)).toEqual(['docs']);
  });

  it('isIgnored matches exact paths and subtrees', () => {
    const scanner = new AntoraWorkspaceScanner(new InMemoryFileSource(), new AsciiDocParser(), {
      ignorePaths: ['archive', 'temp/'],
    });
    expect(scanner.isIgnored('archive')).toBe(true);
    expect(scanner.isIgnored('archive/x.adoc')).toBe(true);
    expect(scanner.isIgnored('archive2/x.adoc')).toBe(false);
    expect(scanner.isIgnored('temp/x.adoc')).toBe(true);
    expect(scanner.isIgnored('docs/x.adoc')).toBe(false);
  });

  it('setIgnorePaths re-applies the filter without recreating the scanner', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/a.adoc': '= A',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();
    await scanner.scan(index);
    expect(index.resolvePage({ module: 'ROOT', page: 'a.adoc' })).toBeDefined();

    scanner.setIgnorePaths(['docs']);
    await scanner.scan(index);
    expect(index.resolvePage({ module: 'ROOT', page: 'a.adoc' })).toBeUndefined();
  });
});
