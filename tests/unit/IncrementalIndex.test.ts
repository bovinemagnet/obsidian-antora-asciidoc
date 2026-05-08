import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = `name: docs
version: '1.0'
`;

describe('Incremental indexing', () => {
  it('upsertPage replaces an existing entry with the same filePath', () => {
    const index = new AntoraComponentIndex();
    const base = {
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs/modules/ROOT/pages/index.adoc',
    };
    index.upsertPage({ ...base, anchors: new Set(['old-anchor']) });
    index.upsertPage({ ...base, anchors: new Set(['new-anchor']) });

    const resolved = index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' });
    expect(resolved?.anchors.has('new-anchor')).toBe(true);
    expect(resolved?.anchors.has('old-anchor')).toBe(false);

    // Page should appear once per encoding, not three times.
    const targets = index.listPageTargets();
    expect(targets.filter((t) => t === 'index.adoc')).toHaveLength(1);
  });

  it('addPartial / addExample / addImage de-duplicate', () => {
    const index = new AntoraComponentIndex();
    index.addPartial('docs', '1.0', 'ROOT', 'snippet.adoc');
    index.addPartial('docs', '1.0', 'ROOT', 'snippet.adoc');
    index.addExample('docs', '1.0', 'ROOT', 'sample.txt');
    index.addExample('docs', '1.0', 'ROOT', 'sample.txt');
    index.addImage('docs', '1.0', 'ROOT', 'logo.png');
    index.addImage('docs', '1.0', 'ROOT', 'logo.png');

    const module = index.getComponents()[0].versions.get('1.0')!.modules.get('ROOT')!;
    expect(module.partials).toEqual(['snippet.adoc']);
    expect(module.examples).toEqual(['sample.txt']);
    expect(module.images).toEqual(['logo.png']);
  });

  it('removePagesUnder removes the page from every key encoding', () => {
    const index = new AntoraComponentIndex();
    index.upsertPage({
      component: 'docs',
      version: '1.0',
      module: 'ROOT',
      path: 'index.adoc',
      filePath: 'docs/modules/ROOT/pages/index.adoc',
      anchors: new Set(),
    });

    index.removePagesUnder('docs/modules/ROOT/pages/index.adoc');

    expect(index.resolvePage({ page: 'index.adoc' })).toBeUndefined();
    expect(index.resolvePage({ module: 'ROOT', page: 'index.adoc' })).toBeUndefined();
    expect(index.resolvePage({ component: 'docs', module: 'ROOT', page: 'index.adoc' })).toBeUndefined();
  });

  it('scanner.getDescriptors returns the cached descriptor set', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/index.adoc': '= Index',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();

    expect(scanner.getDescriptors()).toEqual([]);
    await scanner.scan(index);
    expect(scanner.getDescriptors()).toHaveLength(1);
    expect(scanner.getDescriptors()[0].component).toBe('docs');
  });

  it('indexFile adds a new page without re-scanning everything', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/index.adoc': '= Index',
    });
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
    const index = new AntoraComponentIndex();
    await scanner.scan(index);

    const newPath = 'docs/modules/ROOT/pages/new.adoc';
    source.add(newPath, '= New page');

    await scanner.indexFile(
      { path: newPath, name: 'new.adoc', extension: 'adoc' },
      [...scanner.getDescriptors()],
      index,
    );

    expect(index.resolvePage({ module: 'ROOT', page: 'new.adoc' })).toBeDefined();
  });
});
