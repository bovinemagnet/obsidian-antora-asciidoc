/**
 * Pure transforms for the heading promote/demote commands. Operate on a
 * single line of source text. Returning the original line means "no change"
 * (clamped at the level boundary or not a heading at all).
 */

const HEADING_PATTERN = /^(={1,6})(\s+)(.+)$/;

export function promoteHeading(lineText: string): string {
  const match = lineText.match(HEADING_PATTERN);
  if (!match) {
    return lineText;
  }
  const level = match[1].length;
  if (level <= 1) {
    return lineText;
  }
  return `${'='.repeat(level - 1)}${match[2]}${match[3]}`;
}

export function demoteHeading(lineText: string): string {
  const match = lineText.match(HEADING_PATTERN);
  if (!match) {
    return lineText;
  }
  const level = match[1].length;
  if (level >= 6) {
    return lineText;
  }
  return `${'='.repeat(level + 1)}${match[2]}${match[3]}`;
}

/**
 * Generates a kebab-case anchor ID from arbitrary text. Differs from the
 * section auto-ID in that there's no leading `_` and the separator is `-`
 * (kebab-case, the convention writers use for hand-authored anchors).
 */
export function generateAnchorId(text: string): string {
  const cleaned = text
    .replace(/[`*_~]/g, '')
    .replace(/\{[^}]+}/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }
  return cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Generates a kebab-case page filename ending in `.adoc`. Strips a passed-in
 * extension first so callers can convert "Getting Started.adoc" → "getting-started.adoc"
 * without doubling the suffix.
 */
export function generatePageSlug(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const withoutExt = trimmed.replace(/\.(adoc|asciidoc)$/i, '');
  const slug = generateAnchorId(withoutExt);
  return slug ? `${slug}.adoc` : '';
}
