import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource } from '../io/FileSource';
import { Diagnostic } from './Diagnostic';

/**
 * Returns one info-severity diagnostic per `{name}` reference across the
 * workspace. Use this to answer "which pages would break if I rename or
 * remove this attribute?".
 */
export async function findAttributeUsages(
  source: FileSource,
  parser: AsciiDocParser,
  attributeName: string,
): Promise<Diagnostic[]> {
  const usages: Diagnostic[] = [];

  for (const file of source.list()) {
    if (!/^(adoc|asciidoc)$/i.test(file.extension)) {
      continue;
    }
    const content = await source.read(file);
    const symbols = parser.parseSymbols(content);
    for (const attr of symbols.attributes) {
      if (attr.name !== attributeName) {
        continue;
      }
      usages.push({
        filePath: file.path,
        line: attr.line,
        column: attr.column,
        severity: 'info',
        message: `{${attributeName}}`,
      });
    }
  }

  return usages;
}

/**
 * Detects an `{attr}` reference at the given line/character offset. Returns
 * the attribute name when the cursor is between the braces, otherwise null.
 */
export function detectAttributeReferenceAt(lineText: string, cursorCh: number): string | null {
  for (const match of lineText.matchAll(/\{([A-Za-z0-9_-]+)}/g)) {
    if (match.index === undefined) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    if (cursorCh >= start && cursorCh <= end) {
      return match[1];
    }
  }
  return null;
}
