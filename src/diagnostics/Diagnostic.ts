export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  message: string;
  filePath: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
}
