import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NodeFileSource } from '../../src/io/NodeFileSource';

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'antora-nfs-'));
  mkdirSync(path.join(tmpRoot, 'modules', 'ROOT', 'pages'), { recursive: true });
  writeFileSync(path.join(tmpRoot, 'antora.yml'), 'name: external\nversion: 1.0\n');
  writeFileSync(path.join(tmpRoot, 'modules', 'ROOT', 'pages', 'index.adoc'), '= Hello');
  mkdirSync(path.join(tmpRoot, 'node_modules'), { recursive: true });
  writeFileSync(path.join(tmpRoot, 'node_modules', 'should-be-ignored.txt'), 'noise');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('NodeFileSource', () => {
  it('walks the configured root recursively', () => {
    const source = new NodeFileSource({ roots: [tmpRoot] });
    const paths = source.list().map((file) => file.path);

    const expected = path.join(tmpRoot, 'modules', 'ROOT', 'pages', 'index.adoc').split(path.sep).join('/');
    expect(paths).toContain(expected);
    expect(paths.some((p) => p.includes('/node_modules/'))).toBe(false);
  });

  it('reads file contents', async () => {
    const source = new NodeFileSource({ roots: [tmpRoot] });
    const yml = source.list().find((file) => file.name === 'antora.yml')!;
    expect(await source.read(yml)).toContain('name: external');
  });

  it('reports existence via exists()', () => {
    const source = new NodeFileSource({ roots: [tmpRoot] });
    const indexPath = path.join(tmpRoot, 'modules', 'ROOT', 'pages', 'index.adoc');
    expect(source.exists(indexPath)).toBe(true);
    expect(source.exists(path.join(tmpRoot, 'missing'))).toBe(false);
  });
});
