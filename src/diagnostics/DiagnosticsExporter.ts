import { Diagnostic } from './Diagnostic';

export type ExportFormat = 'json' | 'csv';

/**
 * Pure serialiser for Diagnostic[]. Caller decides where to write the result
 * — typically vault.create or vault.adapter.write.
 */
export function serialiseDiagnostics(diagnostics: Diagnostic[], format: ExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(diagnostics, null, 2) + '\n';
  }
  return toCsv(diagnostics);
}

function toCsv(diagnostics: Diagnostic[]): string {
  const header = 'severity,filePath,line,column,message';
  const rows = diagnostics.map((d) =>
    [d.severity, csvField(d.filePath), d.line, d.column, csvField(d.message)].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function defaultFilenameFor(format: ExportFormat): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `antora-diagnostics-${stamp}.${format}`;
}
