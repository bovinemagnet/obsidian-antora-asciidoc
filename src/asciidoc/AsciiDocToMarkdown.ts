/**
 * Best-effort AsciiDoc → Markdown converter for the inverse subset of
 * MarkdownToAsciiDoc. Lossy by nature — Antora-specific constructs (xref to
 * `partial$`, includes, tabs blocks, etc.) get a passthrough or comment
 * fallback rather than dropped silently.
 *
 * Pure function, no Obsidian dependencies.
 */
export function convertAsciiDocToMarkdown(asciidoc: string): string {
  const lines = asciidoc.split('\n');
  const out: string[] = [];
  let inSourceBlock = false;
  let sourceFence: string | null = null;
  let sourceLang = '';
  let inQuote = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // [source,X] header — peek ahead for the `----` fence.
    const sourceMatch = line.match(/^\[source(?:,\s*([\w+-]+))?\s*]\s*$/);
    if (sourceMatch && i + 1 < lines.length && /^----+\s*$/.test(lines[i + 1])) {
      sourceLang = sourceMatch[1] ?? '';
      sourceFence = lines[i + 1].trim();
      out.push(sourceLang ? `\`\`\`${sourceLang}` : '```');
      inSourceBlock = true;
      i += 1; // skip the fence opener
      continue;
    }
    if (inSourceBlock) {
      if (line.trim() === sourceFence) {
        out.push('```');
        inSourceBlock = false;
        sourceFence = null;
        sourceLang = '';
        continue;
      }
      out.push(line);
      continue;
    }

    // Quote block opener: `[quote]` followed by `____` fence.
    if (line.trim() === '[quote]' && i + 1 < lines.length && lines[i + 1].trim() === '____') {
      inQuote = true;
      i += 1; // skip the fence
      continue;
    }
    if (inQuote) {
      if (line.trim() === '____') {
        inQuote = false;
        out.push('');
        continue;
      }
      out.push(`> ${line}`);
      continue;
    }

    out.push(transformLine(line));
  }

  // Close any unterminated state defensively.
  if (inSourceBlock) {
    out.push('```');
  }
  return out.join('\n');
}

function transformLine(line: string): string {
  // Horizontal rule
  if (line.trim() === "'''") {
    return '---';
  }

  // Heading
  const heading = line.match(/^(={1,6})\s+(.+?)\s*$/);
  if (heading) {
    return `${'#'.repeat(heading[1].length)} ${heading[2]}`;
  }

  // Numbered list
  const ordered = line.match(/^(\s*)\.\s+(.+)$/);
  if (ordered) {
    return `${ordered[1]}1. ${transformInline(ordered[2])}`;
  }

  // Bulleted list
  const bullet = line.match(/^(\s*)\*\s+(.+)$/);
  if (bullet) {
    return `${bullet[1]}- ${transformInline(bullet[2])}`;
  }

  return transformInline(line);
}

const ITAL_OPEN = '\u0001';
const ITAL_CLOSE = '\u0002';

function transformInline(text: string): string {
  let out = text;

  // Italic _x_ first, into a placeholder, so the bold pass doesn't see it.
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, `$1${ITAL_OPEN}$2${ITAL_CLOSE}`);

  // Bold *x* → **x**
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1**$2**');

  // Inline code +x+
  out = out.replace(/\+([^+\n]+)\+/g, '`$1`');

  // xref: → markdown link to .adoc target (Obsidian renders these as plain
  // links; alternative would be a wikilink but that loses the label).
  out = out.replace(/xref:([^[\s]+)\[([^\]]*)]/g, (_match, target, label) => {
    const text = label.length ? label : target;
    return `[${text}](${target})`;
  });

  // link: macro → [text](url)
  out = out.replace(/link:([^[\s]+)\[([^\]]*)]/g, (_match, target, label) => {
    const text = label.length ? label : target;
    return `[${text}](${target})`;
  });

  // image:: blocks become inline ![]() — block markers are dropped.
  out = out.replace(/image::?([^[\s]+)\[([^\]]*)]/g, (_match, target, alt) => `![${alt}](${target})`);

  // Restore italic from placeholder.
  out = out.split(ITAL_OPEN).join('*').split(ITAL_CLOSE).join('*');
  return out;
}
