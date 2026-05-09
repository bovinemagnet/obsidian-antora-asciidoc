import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { buildNavigationExport } from '../../src/antora/NavigationExport';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const ANTORA_YML = "name: docs\nversion: '1.0'\n";

describe('buildNavigationExport', () => {
  it('returns an empty components list when no nav.adoc files exist', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/pages/p.adoc': '= P',
    });
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
    const doc = buildNavigationExport(index);
    expect(doc.components).toEqual([]);
  });

  it('serialises every module nav tree as nested JSON', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/nav.adoc': [
        '* xref:home.adoc[Home]',
        '* xref:guide.adoc[Guide]',
        '** xref:guide/install.adoc[Install]',
      ].join('\n'),
      'docs/modules/ROOT/pages/home.adoc': '= Home',
      'docs/modules/ROOT/pages/guide.adoc': '= Guide',
      'docs/modules/ROOT/pages/guide/install.adoc': '= Install',
    });
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
    const doc = buildNavigationExport(index);

    expect(doc.components).toHaveLength(1);
    const component = doc.components[0];
    expect(component.component).toBe('docs');
    expect(component.rootPath).toBe('docs');
    expect(component.modules).toHaveLength(1);
    const root = component.modules[0];
    expect(root.module).toBe('ROOT');
    expect(root.entries).toHaveLength(2);
    expect(root.entries[1].children[0].label).toBe('Install');
  });

  it('includes a generatedAt timestamp', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': ANTORA_YML,
      'docs/modules/ROOT/nav.adoc': '* xref:home.adoc[Home]',
      'docs/modules/ROOT/pages/home.adoc': '= Home',
    });
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);
    const doc = buildNavigationExport(index);
    expect(doc.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
