import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { buildSyntheticWorkspace } from './SyntheticWorkspace';

/**
 * Wall-clock thresholds tied to the PRD performance requirements. CI hardware
 * varies, so each budget is set 3-5× above the typical measured time on a
 * developer machine to keep these tests stable. The intent is to catch
 * accidental O(N²) regressions, not to enforce micro-budgets.
 *
 *   Local (dev) numbers as baseline (May 2026):
 *     scan 5K pages         ≈ 1.1 s   → CI budget 5 s   (PR-1)
 *     listPageTargets 5K    ≈ 2 ms    → CI budget 100 ms (PR-2)
 *     indexFile single      ≈ 4 ms    → CI budget 50 ms  (PR-3)
 *     planPageRename 1K     ≈ 12 ms   → CI budget 200 ms
 */

const SCAN_5K_BUDGET_MS = 5000;
const LIST_TARGETS_BUDGET_MS = 100;
const INDEX_FILE_BUDGET_MS = 50;
const RENAME_BUDGET_MS = 200;

const FIVE_K_SHAPE = { components: 5, modulesPerComponent: 5, pagesPerModule: 200, xrefsPerPage: 10, anchorsPerPage: 4 };
const ONE_K_SHAPE = { components: 2, modulesPerComponent: 4, pagesPerModule: 125, xrefsPerPage: 10, anchorsPerPage: 3 };

describe('Performance thresholds (PRD targets)', () => {
  it('PR-1 — scans a 5K-page workspace within 5 seconds', { timeout: 30_000 }, async () => {
    const source = buildSyntheticWorkspace(FIVE_K_SHAPE);
    const index = new AntoraComponentIndex();
    const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());

    const start = performance.now();
    await scanner.scan(index);
    const elapsed = performance.now() - start;

    expect(elapsed, `scan took ${elapsed.toFixed(0)} ms`).toBeLessThan(SCAN_5K_BUDGET_MS);
  });

  it('PR-2 — listPageTargets responds within 100 ms after a 5K-page scan', async () => {
    const source = buildSyntheticWorkspace(FIVE_K_SHAPE);
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);

    const start = performance.now();
    index.listPageTargets();
    const elapsed = performance.now() - start;

    expect(elapsed, `listPageTargets took ${elapsed.toFixed(2)} ms`).toBeLessThan(LIST_TARGETS_BUDGET_MS);
  });

  it('PR-3 — single-file index update completes within 50 ms against a 5K-page index', async () => {
    const source = buildSyntheticWorkspace(FIVE_K_SHAPE);
    const index = new AntoraComponentIndex();
    const parser = new AsciiDocParser();
    const scanner = new AntoraWorkspaceScanner(source, parser);
    await scanner.scan(index);

    const file = source.list().find((f) => f.path === 'comp0/modules/ROOT/pages/page0.adoc')!;
    const start = performance.now();
    await scanner.indexFile(file, [...scanner.getDescriptors()], index);
    const elapsed = performance.now() - start;

    expect(elapsed, `indexFile took ${elapsed.toFixed(2)} ms`).toBeLessThan(INDEX_FILE_BUDGET_MS);
  });

  it('planPageRename completes within 200 ms on a 1K-page workspace', async () => {
    const source = buildSyntheticWorkspace(ONE_K_SHAPE);
    const index = new AntoraComponentIndex();
    const parser = new AsciiDocParser();
    const scanner = new AntoraWorkspaceScanner(source, parser);
    await scanner.scan(index);
    const { RefactorService } = await import('../../src/refactor/RefactorService');
    const service = new RefactorService(source, index, parser);

    const start = performance.now();
    await service.planPageRename({
      oldFilePath: 'comp0/modules/ROOT/pages/page0.adoc',
      newPagePath: 'page0-renamed.adoc',
    });
    const elapsed = performance.now() - start;

    expect(elapsed, `planPageRename took ${elapsed.toFixed(2)} ms`).toBeLessThan(RENAME_BUDGET_MS);
  });
});
