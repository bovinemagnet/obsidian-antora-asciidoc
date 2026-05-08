import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex, extractPageTitle } from '../../src/antora/AntoraComponentIndex';
import { AntoraWorkspaceScanner } from '../../src/antora/AntoraWorkspaceScanner';
import { AsciiDocParser } from '../../src/asciidoc/AsciiDocParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

describe('extractPageTitle', () => {
  it('returns the first level-0 heading text', () => {
    expect(extractPageTitle('= My Title\n\nBody')).toBe('My Title');
  });

  it('ignores deeper headings when they appear before the title', () => {
    expect(extractPageTitle('== Section\n= Title')).toBe('Title');
  });

  it('returns undefined when no = title is present', () => {
    expect(extractPageTitle('No title here.')).toBeUndefined();
  });

  it('trims trailing whitespace', () => {
    expect(extractPageTitle('=   Spaced   Title   \n')).toBe('Spaced   Title');
  });
});

describe('Index page title persistence', () => {
  it('records the page title on scan', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': "name: docs\nversion: '1.0'\n",
      'docs/modules/ROOT/pages/index.adoc': '= Welcome to Acme\n\nBody',
    });
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);

    const page = index.getPageByFilePath('docs/modules/ROOT/pages/index.adoc');
    expect(page?.title).toBe('Welcome to Acme');
  });

  it('resolveByListedTarget returns the entry with its title', async () => {
    const source = new InMemoryFileSource({
      'docs/antora.yml': "name: docs\nversion: '1.0'\n",
      'docs/modules/ROOT/pages/index.adoc': '= Home\n',
    });
    const index = new AntoraComponentIndex();
    await new AntoraWorkspaceScanner(source, new AsciiDocParser()).scan(index);

    expect(index.resolveByListedTarget('docs:ROOT:index.adoc')?.title).toBe('Home');
    expect(index.resolveByListedTarget('ROOT:index.adoc')?.title).toBe('Home');
    expect(index.resolveByListedTarget('index.adoc')?.title).toBe('Home');
  });
});
