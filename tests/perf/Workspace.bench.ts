import { bench, describe } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { deriveGraphEdges } from '../../src/graph/GraphEdgeDeriver';
import { RefactorService } from '../../src/refactor/RefactorService';
import { buildSyntheticWorkspace } from './SyntheticWorkspace';

const SMALL = { components: 1, modulesPerComponent: 1, pagesPerModule: 100, xrefsPerPage: 5, anchorsPerPage: 2 };
const MEDIUM = { components: 2, modulesPerComponent: 4, pagesPerModule: 125, xrefsPerPage: 10, anchorsPerPage: 3 };
const LARGE = { components: 5, modulesPerComponent: 5, pagesPerModule: 200, xrefsPerPage: 10, anchorsPerPage: 4 };

describe('AntoraWorkspaceScanner.scan', () => {
  bench('100-page workspace', async () => {
    const source = buildSyntheticWorkspace(SMALL);
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
  });

  bench('1k-page workspace', async () => {
    const source = buildSyntheticWorkspace(MEDIUM);
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
  });

  bench('5k-page workspace (PR-1 target)', async () => {
    const source = buildSyntheticWorkspace(LARGE);
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
  });
});

describe('AntoraComponentIndex lookups', () => {
  const source = buildSyntheticWorkspace(LARGE);
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  const ready = new AntoraWorkspaceScanner(source, parser).scan(index);

  bench('listPageTargets after a 5k-page scan', async () => {
    await ready;
    index.listPageTargets();
  });

  bench('resolvePage 1k random lookups after a 5k-page scan', async () => {
    await ready;
    for (let i = 0; i < 1000; i += 1) {
      index.resolvePage({ component: `comp${i % 5}`, module: i % 2 ? 'ROOT' : 'm1', page: `page${i % 200}.adoc` });
    }
  });
});

describe('AntoraWorkspaceScanner.indexFile (incremental)', () => {
  const source = buildSyntheticWorkspace(LARGE);
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  const scanner = new AntoraWorkspaceScanner(source, parser);
  const ready = scanner.scan(index);

  bench('one page upsert against a 5k-page index', async () => {
    await ready;
    const file = source.list().find((f) => f.path === 'comp0/modules/ROOT/pages/page0.adoc');
    if (!file) {
      return;
    }
    await scanner.indexFile(file, [...scanner.getDescriptors()], index);
  });
});

describe('RefactorService.planPageRename', () => {
  const source = buildSyntheticWorkspace(MEDIUM);
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  const service = new RefactorService(source, index, parser);
  const ready = new AntoraWorkspaceScanner(source, parser).scan(index);

  bench('rename a page with many inbound references', async () => {
    await ready;
    await service.planPageRename({
      oldFilePath: 'comp0/modules/ROOT/pages/page0.adoc',
      newPagePath: 'page0-renamed.adoc',
    });
  });
});

describe('deriveGraphEdges', () => {
  const source = buildSyntheticWorkspace(MEDIUM);
  const index = new AntoraComponentIndex();
  const parser = new AsciiDocParser();
  const ready = new AntoraWorkspaceScanner(source, parser).scan(index);

  bench('1k-page workspace, xrefs only', async () => {
    await ready;
    await deriveGraphEdges(source, index, parser);
  });

  bench('1k-page workspace, xrefs + includes', async () => {
    await ready;
    await deriveGraphEdges(source, index, parser, { includeIncludeEdges: true });
  });
});
