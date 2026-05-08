import { beforeEach, describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';
import { RefactorService } from '../../src/refactor/RefactorService';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

let source: InMemoryFileSource;
let index: AntoraComponentIndex;
let service: RefactorService;

async function setupWorkspace(files: Record<string, string>): Promise<void> {
  source = new InMemoryFileSource({ 'docs/antora.yml': ANTORA_YML, ...files });
  index = new AntoraComponentIndex();
  const scanner = new AntoraWorkspaceScanner(source, new AsciiDocParser());
  await scanner.scan(index);
  service = new RefactorService(source, index, new AsciiDocParser());
}

describe('RefactorService - findPageReferences', () => {
  beforeEach(async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/index.adoc': '= Index\n\nSee xref:about.adoc[].',
      'docs/modules/ROOT/pages/about.adoc': '= About',
      'docs/modules/ROOT/pages/contact.adoc': 'See xref:about.adoc[].\nAlso xref:ROOT:about.adoc[].\nAnd xref:docs:ROOT:about.adoc[].',
    });
  });

  it('finds references in all three xref scoping forms', async () => {
    const aboutPage = index.getPageByFilePath('docs/modules/ROOT/pages/about.adoc')!;
    const refs = await service.findPageReferences(aboutPage);
    expect(refs).toHaveLength(4);
  });
});

describe('RefactorService - planPageRename', () => {
  beforeEach(async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/about.adoc': '= About',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:about.adoc[About].',
      'docs/modules/ROOT/pages/contact.adoc': 'Read xref:ROOT:about.adoc[the about page] for more.',
    });
  });

  it('moves the file and rewrites every xref to the new path', async () => {
    const plan = await service.planPageRename({
      oldFilePath: 'docs/modules/ROOT/pages/about.adoc',
      newPagePath: 'company.adoc',
    });

    expect(plan.fileMove).toEqual({
      from: 'docs/modules/ROOT/pages/about.adoc',
      to: 'docs/modules/ROOT/pages/company.adoc',
    });

    const indexContent = plan.fileChanges.get('docs/modules/ROOT/pages/index.adoc');
    expect(indexContent).toContain('xref:company.adoc[About]');
    expect(indexContent).not.toContain('xref:about.adoc');

    const contactContent = plan.fileChanges.get('docs/modules/ROOT/pages/contact.adoc');
    expect(contactContent).toContain('xref:ROOT:company.adoc[the about page]');
  });

  it('preserves the existing xref scope when rewriting', async () => {
    const plan = await service.planPageRename({
      oldFilePath: 'docs/modules/ROOT/pages/about.adoc',
      newPagePath: 'company.adoc',
    });

    const contact = plan.fileChanges.get('docs/modules/ROOT/pages/contact.adoc')!;
    // The original used the module:page form, the new should too.
    expect(contact).toMatch(/xref:ROOT:company\.adoc/);
  });

  it('preserves anchors on referenced xrefs', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/about.adoc': '[[mission]]\n= About',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:about.adoc#mission[Our mission].',
    });

    const plan = await service.planPageRename({
      oldFilePath: 'docs/modules/ROOT/pages/about.adoc',
      newPagePath: 'company.adoc',
    });

    expect(plan.fileChanges.get('docs/modules/ROOT/pages/index.adoc'))
      .toContain('xref:company.adoc#mission[Our mission]');
  });

  it('does not modify files that contain no references', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/about.adoc': '= About',
      'docs/modules/ROOT/pages/standalone.adoc': '= Standalone\n\nNo links here.',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:about.adoc[].',
    });

    const plan = await service.planPageRename({
      oldFilePath: 'docs/modules/ROOT/pages/about.adoc',
      newPagePath: 'company.adoc',
    });

    expect(plan.fileChanges.has('docs/modules/ROOT/pages/standalone.adoc')).toBe(false);
    expect(plan.fileChanges.has('docs/modules/ROOT/pages/index.adoc')).toBe(true);
  });
});

describe('RefactorService - planAnchorRename', () => {
  it('rewrites all three anchor declaration forms on the owning page', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/page.adoc':
        '= Page\n\n[[my-anchor]]\nIntro text.\n\n[#my-anchor]\n== Heading\n\n[id="my-anchor"]\nMore.\n',
    });

    const plan = await service.planAnchorRename({
      ownerFilePath: 'docs/modules/ROOT/pages/page.adoc',
      oldAnchor: 'my-anchor',
      newAnchor: 'renamed',
    });

    const updated = plan.fileChanges.get('docs/modules/ROOT/pages/page.adoc')!;
    expect(updated).toContain('[[renamed]]');
    expect(updated).toContain('[#renamed]');
    expect(updated).toContain('[id="renamed"]');
    expect(updated).not.toContain('my-anchor');
  });

  it('rewrites #anchor references that resolve to the owning page', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/about.adoc': '[[mission]]\n= About',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:about.adoc#mission[Mission].\nAnd xref:ROOT:about.adoc#mission[].',
    });

    const plan = await service.planAnchorRename({
      ownerFilePath: 'docs/modules/ROOT/pages/about.adoc',
      oldAnchor: 'mission',
      newAnchor: 'purpose',
    });

    const indexContent = plan.fileChanges.get('docs/modules/ROOT/pages/index.adoc')!;
    expect(indexContent).toContain('xref:about.adoc#purpose[Mission]');
    expect(indexContent).toContain('xref:ROOT:about.adoc#purpose[]');
  });

  it('does not touch references whose anchor name happens to match on a different page', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/about.adoc': '[[shared]]\n= About',
      'docs/modules/ROOT/pages/contact.adoc': '[[shared]]\n= Contact',
      'docs/modules/ROOT/pages/index.adoc': 'See xref:contact.adoc#shared[].',
    });

    const plan = await service.planAnchorRename({
      ownerFilePath: 'docs/modules/ROOT/pages/about.adoc',
      oldAnchor: 'shared',
      newAnchor: 'renamed',
    });

    expect(plan.fileChanges.has('docs/modules/ROOT/pages/index.adoc')).toBe(false);
    expect(plan.edits).toHaveLength(0);
  });

  it('returns an empty plan when old equals new', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/pages/page.adoc': '[[anchor]]\n= Page',
    });
    const plan = await service.planAnchorRename({
      ownerFilePath: 'docs/modules/ROOT/pages/page.adoc',
      oldAnchor: 'anchor',
      newAnchor: 'anchor',
    });
    expect(plan.fileChanges.size).toBe(0);
    expect(plan.edits).toHaveLength(0);
  });
});

describe('RefactorService - nav.adoc references', () => {
  it('rewrites xrefs inside nav.adoc when the referenced page is renamed', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/nav.adoc': '* xref:about.adoc[About]\n* xref:contact.adoc[Contact]\n',
      'docs/modules/ROOT/pages/about.adoc': '= About',
      'docs/modules/ROOT/pages/contact.adoc': '= Contact',
    });

    const plan = await service.planPageRename({
      oldFilePath: 'docs/modules/ROOT/pages/about.adoc',
      newPagePath: 'company.adoc',
    });

    const nav = plan.fileChanges.get('docs/modules/ROOT/nav.adoc');
    expect(nav).toBeDefined();
    expect(nav).toContain('xref:company.adoc[About]');
    expect(nav).toContain('xref:contact.adoc[Contact]');
  });

  it('finds page references in nav.adoc files', async () => {
    await setupWorkspace({
      'docs/modules/ROOT/nav.adoc': '* xref:about.adoc[About]\n',
      'docs/modules/ROOT/pages/about.adoc': '= About',
    });
    const aboutPage = index.getPageByFilePath('docs/modules/ROOT/pages/about.adoc')!;
    const refs = await service.findPageReferences(aboutPage);
    expect(refs.some((ref) => ref.filePath === 'docs/modules/ROOT/nav.adoc')).toBe(true);
  });
});
