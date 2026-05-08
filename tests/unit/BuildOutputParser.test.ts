import { describe, expect, it } from 'vitest';

import { BuildOutputParser } from '../../src/build/BuildOutputParser';

describe('BuildOutputParser', () => {
  const parser = new BuildOutputParser();

  it('parses error and warning lines into diagnostics', () => {
    const output = [
      'docs/modules/ROOT/pages/intro.adoc:42:5: error: target not found',
      'docs/modules/ROOT/pages/about.adoc:7:1: warning: deprecated macro',
      'unrelated noise',
    ].join('\n');

    const diagnostics = parser.parse(output);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      filePath: 'docs/modules/ROOT/pages/intro.adoc',
      line: 42,
      column: 5,
      severity: 'error',
    });
    expect(diagnostics[1]).toMatchObject({ severity: 'warning' });
  });

  it('returns empty for output with no matches', () => {
    expect(parser.parse('all good\n')).toEqual([]);
  });
});
