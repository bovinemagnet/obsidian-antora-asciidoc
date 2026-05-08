/**
 * Pure extractor for the page outline view. Walks an AsciiDoc document and
 * returns a flat list of headings + explicit anchors with their 1-based line
 * numbers, in document order. The view turns this into a clickable tree.
 *
 * Anchors that immediately precede a heading are not duplicated — the
 * heading carries its own auto-ID, and the explicit anchor would just clash
 * visually. Standalone anchors (those with no following heading on the next
 * line) are listed as their own entries.
 */
export interface OutlineEntry {
  kind: 'heading' | 'anchor';
  /** Heading depth 1–6 for headings; 0 for anchors. */
  level: number;
  /** Display text. */
  text: string;
  /** 1-based line number. */
  line: number;
}

const HEADING_PATTERN = /^(={1,6})\s+(.+?)\s*$/;
const BLOCK_ANCHOR = /^\[\[([^\],]+)(?:,[^\]]*)?\]\]\s*$/;
const INLINE_ANCHOR = /^\[#([^\],]+)(?:,[^\]]*)?\]\s*$/;

export function extractOutline(content: string): OutlineEntry[] {
  const lines = content.split('\n');
  const entries: OutlineEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      entries.push({ kind: 'heading', level: heading[1].length, text: heading[2], line: i + 1 });
      continue;
    }
    const anchorBlock = line.match(BLOCK_ANCHOR) ?? line.match(INLINE_ANCHOR);
    if (anchorBlock) {
      // Skip when the next non-blank line is a heading — the heading entry
      // already represents the anchor.
      if (nextNonBlankIsHeading(lines, i + 1)) {
        continue;
      }
      entries.push({ kind: 'anchor', level: 0, text: anchorBlock[1], line: i + 1 });
    }
  }

  return entries;
}

function nextNonBlankIsHeading(lines: string[], from: number): boolean {
  for (let i = from; i < lines.length; i += 1) {
    if (lines[i].trim() === '') {
      continue;
    }
    return HEADING_PATTERN.test(lines[i]);
  }
  return false;
}
