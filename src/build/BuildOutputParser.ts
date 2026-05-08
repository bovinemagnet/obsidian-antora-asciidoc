import { Diagnostic } from '../diagnostics/Diagnostic';

export class BuildOutputParser {
  parse(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const line of output.split('\n')) {
      const match = line.match(/(.+):(\d+):(\d+):\s+(error|warning):\s+(.+)/i);
      if (!match) {
        continue;
      }

      diagnostics.push({
        filePath: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4].toLowerCase() === 'error' ? 'error' : 'warning',
        message: match[5],
      });
    }

    return diagnostics;
  }
}
