import { Diagnostic } from './Diagnostic';

const HEADING_PATTERN = /^(={1,6})\s+(.+)$/;

/**
 * Walks an AsciiDoc document and emits one warning per heading that jumps
 * more than one level deeper than its predecessor. The first heading is
 * always allowed regardless of level — it's the document baseline.
 *
 * Pure function; the caller wraps results with the source filePath.
 */
export function lintHeadingHierarchy(content: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split('\n');
  let previousLevel: number | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(HEADING_PATTERN);
    if (!match) {
      continue;
    }
    const level = match[1].length;
    if (previousLevel !== null && level > previousLevel + 1) {
      diagnostics.push({
        filePath,
        line: i + 1,
        column: 1,
        severity: 'warning',
        message: `Heading jumps from level ${previousLevel} to ${level} (skipped ${level - previousLevel - 1} level${level - previousLevel - 1 === 1 ? '' : 's'}).`,
      });
    }
    previousLevel = level;
  }

  return diagnostics;
}
