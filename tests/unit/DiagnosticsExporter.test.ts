import { describe, expect, it } from 'vitest';

import { Diagnostic } from '../../src/diagnostics/Diagnostic';
import { defaultFilenameFor, serialiseDiagnostics } from '../../src/diagnostics/DiagnosticsExporter';

const FIXTURES: Diagnostic[] = [
  { severity: 'error', filePath: 'docs/page.adoc', line: 12, column: 5, message: 'Broken xref' },
  { severity: 'warning', filePath: 'docs/other.adoc', line: 1, column: 1, message: 'Unresolved attribute: {x}' },
  { severity: 'info', filePath: 'docs/page.adoc', line: 3, column: 4, message: 'has, comma' },
];

describe('serialiseDiagnostics', () => {
  it('produces parseable JSON', () => {
    const out = serialiseDiagnostics(FIXTURES, 'json');
    expect(JSON.parse(out)).toEqual(FIXTURES);
  });

  it('produces a CSV header followed by one row per diagnostic', () => {
    const out = serialiseDiagnostics(FIXTURES, 'csv');
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('severity,filePath,line,column,message');
    expect(lines).toHaveLength(4);
  });

  it('quotes CSV fields containing commas', () => {
    const out = serialiseDiagnostics(FIXTURES, 'csv');
    expect(out).toContain('"has, comma"');
  });

  it('escapes embedded double quotes in CSV', () => {
    const out = serialiseDiagnostics([{ ...FIXTURES[0], message: 'a "quoted" thing' }], 'csv');
    expect(out).toContain('"a ""quoted"" thing"');
  });

  it('returns just the header for empty input', () => {
    const out = serialiseDiagnostics([], 'csv');
    expect(out.trim()).toBe('severity,filePath,line,column,message');
  });
});

describe('defaultFilenameFor', () => {
  it('uses the requested extension and includes a timestamp', () => {
    const json = defaultFilenameFor('json');
    const csv = defaultFilenameFor('csv');
    expect(json.endsWith('.json')).toBe(true);
    expect(csv.endsWith('.csv')).toBe(true);
    expect(json).toMatch(/antora-diagnostics-/);
  });
});
