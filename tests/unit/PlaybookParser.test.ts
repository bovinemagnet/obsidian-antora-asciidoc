import { describe, expect, it } from 'vitest';

import { parsePlaybooks } from '../../src/antora/PlaybookParser';
import { InMemoryFileSource } from '../../src/io/InMemoryFileSource';

const PLAYBOOK = `site:
  title: Docs
content:
  sources:
    - url: ./local
      branches: HEAD
    - url: /absolute/path/to/repo
      start_path: docs
    - url: https://github.com/acme/docs.git
      branches: main
    - url: git@github.com:acme/other.git
`;

describe('parsePlaybooks', () => {
  it('returns an empty list when no playbook paths are provided', async () => {
    const source = new InMemoryFileSource();
    const result = await parsePlaybooks(source, []);
    expect(result).toEqual([]);
  });

  it('extracts content sources from a playbook', async () => {
    const source = new InMemoryFileSource({ 'site.yml': PLAYBOOK });
    const [parsed] = await parsePlaybooks(source, ['site.yml']);
    expect(parsed.sources).toHaveLength(4);
  });

  it('flags local vs remote URLs', async () => {
    const source = new InMemoryFileSource({ 'site.yml': PLAYBOOK });
    const [parsed] = await parsePlaybooks(source, ['site.yml']);
    expect(parsed.sources.map((s) => s.isLocal)).toEqual([true, true, false, false]);
  });

  it('captures start_path when present', async () => {
    const source = new InMemoryFileSource({ 'site.yml': PLAYBOOK });
    const [parsed] = await parsePlaybooks(source, ['site.yml']);
    expect(parsed.sources[1].startPath).toBe('docs');
    expect(parsed.sources[0].startPath).toBeUndefined();
  });

  it('returns an empty source list when content.sources is missing', async () => {
    const source = new InMemoryFileSource({ 'site.yml': 'site:\n  title: Docs\n' });
    const [parsed] = await parsePlaybooks(source, ['site.yml']);
    expect(parsed.sources).toEqual([]);
  });

  it('skips playbooks that do not exist in the source', async () => {
    const source = new InMemoryFileSource();
    const result = await parsePlaybooks(source, ['missing.yml']);
    expect(result).toEqual([]);
  });
});
