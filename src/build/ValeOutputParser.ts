import { Diagnostic, DiagnosticSeverity } from '../diagnostics/Diagnostic';

interface ValeAlert {
  Line?: number;
  Span?: [number, number];
  Severity?: 'error' | 'warning' | 'suggestion';
  Message?: string;
  Check?: string;
  Match?: string;
}

/**
 * Parses Vale's JSON output (one entry per file with an array of alerts)
 * into Diagnostic records. Vale's "suggestion" maps to "info" so it slots
 * into the same UI as the existing diagnostics.
 */
export function parseValeOutput(output: string): Diagnostic[] {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  for (const [filePath, alerts] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(alerts)) {
      continue;
    }
    for (const raw of alerts) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const alert = raw as ValeAlert;
      diagnostics.push({
        filePath,
        line: typeof alert.Line === 'number' ? alert.Line : 1,
        column: Array.isArray(alert.Span) && typeof alert.Span[0] === 'number' ? alert.Span[0] : 1,
        severity: mapSeverity(alert.Severity),
        message: composeMessage(alert),
      });
    }
  }
  return diagnostics;
}

function mapSeverity(severity: ValeAlert['Severity']): DiagnosticSeverity {
  switch (severity) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'suggestion': return 'info';
    default: return 'warning';
  }
}

function composeMessage(alert: ValeAlert): string {
  const message = alert.Message?.trim() ?? '(no message)';
  return alert.Check ? `[${alert.Check}] ${message}` : message;
}
