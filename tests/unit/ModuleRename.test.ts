import { beforeEach, describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';
import { RefactorService, RefactorPlan } from '../../src/refactor/RefactorService';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

let source: InMemoryFileSource;
let service: RefactorService;

async function setupWorkspace(files: Record<string, string>): Promise<void> {
  source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  const index = new AntoraComponentIndex();
  await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
  service = new RefactorService(source, index, new AsciiDocParser());
}

describe('RefactorService - module rename', () => {
  beforeEach(async () => {
    await setupWorkspace({
      'docs/modules/api/pages/intro.adoc': '= Intro',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:api:intro.adoc[].',
      'docs/modules/ROOT/pages/index2.adoc': 'See xref:docs:api:intro.adoc[].',
    });
  });

  it('emits a move per file in the renamed module', async () => {
    const plan = await service.planModuleRename({
      component: 'docs', oldModuleName: 'api', newModuleName: 'reference',
    });
    const moves = (plan as RefactorPlan & { moves?: Array<{ from: string; to: string }> }).moves ?? [];
    expect(moves).toEqual([
      { from: 'docs/modules/api/pages/intro.adoc', to: 'docs/modules/reference/pages/intro.adoc' },
    ]);
  });

  it('rewrites module:page xrefs in same-component sources', async () => {
    const plan = await service.planModuleRename({
      component: 'docs', oldModuleName: 'api', newModuleName: 'reference',
    });
    expect(plan.fileChanges.get('docs/modules/ROOT/pages/index.adoc'))
      .toContain('xref:reference:intro.adoc[]');
  });

  it('rewrites component:module:page xrefs from cross-component sources', async () => {
    const plan = await service.planModuleRename({
      component: 'docs', oldModuleName: 'api', newModuleName: 'reference',
    });
    expect(plan.fileChanges.get('docs/modules/ROOT/pages/index2.adoc'))
      .toContain('xref:docs:reference:intro.adoc[]');
  });

  it('returns an empty plan when old equals new', async () => {
    const plan = await service.planModuleRename({
      component: 'docs', oldModuleName: 'api', newModuleName: 'api',
    });
    expect(plan.fileChanges.size).toBe(0);
    expect(plan.edits).toEqual([]);
  });

  it('throws when the component is not indexed', async () => {
    await expect(service.planModuleRename({
      component: 'nonexistent', oldModuleName: 'a', newModuleName: 'b',
    })).rejects.toThrow();
  });
});
