import { describe, expect, it } from 'vitest';

import { parseValeOutput } from '../../src/build/ValeOutputParser';

describe('parseValeOutput', () => {
  it('returns empty for empty input', () => {
    expect(parseValeOutput('')).toEqual([]);
    expect(parseValeOutput('   ')).toEqual([]);
  });

  it('returns empty for unparseable output', () => {
    expect(parseValeOutput('not json')).toEqual([]);
  });

  it('parses Vale JSON into Diagnostic records', () => {
    const output = JSON.stringify({
      'docs/page.adoc': [
        {
          Line: 12,
          Span: [3, 8],
          Severity: 'error',
          Message: 'Use the active voice.',
          Check: 'Style.Voice',
        },
        {
          Line: 1,
          Severity: 'suggestion',
          Message: 'Consider rephrasing.',
          Check: 'Style.Concise',
        },
      ],
    });
    const diagnostics = parseValeOutput(output);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      filePath: 'docs/page.adoc',
      line: 12,
      column: 3,
      severity: 'error',
    });
    expect(diagnostics[0].message).toContain('Style.Voice');
    expect(diagnostics[1].severity).toBe('info');
  });

  it('uses sane defaults for missing fields', () => {
    const output = JSON.stringify({
      'docs/p.adoc': [
        { Message: 'No span', Check: 'X' },
      ],
    });
    const diagnostics = parseValeOutput(output);
    expect(diagnostics[0]).toMatchObject({ line: 1, column: 1, severity: 'warning' });
  });

  it('skips entries that are not arrays', () => {
    const output = JSON.stringify({ 'docs/p.adoc': 'not an array' });
    expect(parseValeOutput(output)).toEqual([]);
  });
});
