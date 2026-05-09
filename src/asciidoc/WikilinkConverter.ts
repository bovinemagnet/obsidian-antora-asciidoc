/**
 * Pure converter for `[[target]]` and `[[target|alias]]` Obsidian-style
 * wikilinks. Returns the AsciiDoc xref equivalent; `.adoc` is appended to
 * the target when not already present so the result is a syntactically
 * valid xref macro.
 */
export interface WikilinkMatch {
  /** Character offset in the source line where `[[` starts. */
  startCh: number;
  /** Character offset where `]]` ends. */
  endCh: number;
  /** Replacement xref macro text. */
  replacement: string;
}

const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

export function convertWikilink(target: string, anchor: string | undefined, alias: string | undefined): string {
  const normalised = target.endsWith('.adoc') ? target : `${target}.adoc`;
  const anchorSuffix = anchor ? `#${anchor}` : '';
  const label = alias ?? '';
  return `xref:${normalised}${anchorSuffix}[${label}]`;
}

/**
 * Detects the wikilink at the given character offset on a line. Returns the
 * match metadata (start, end, replacement) when found, otherwise null.
 */
export function detectWikilinkAt(lineText: string, cursorCh: number): WikilinkMatch | null {
  for (const match of lineText.matchAll(WIKILINK_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    if (cursorCh < start || cursorCh > end) {
      continue;
    }
    const replacement = convertWikilink(match[1], match[2], match[3]);
    return { startCh: start, endCh: end, replacement };
  }
  return null;
}
