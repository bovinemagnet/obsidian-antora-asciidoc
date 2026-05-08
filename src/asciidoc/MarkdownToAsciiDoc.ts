/**
 * Best-effort Markdown → AsciiDoc converter for the common subset:
 *
 *   - ATX headings (# … ######) → `=` … `======`
 *   - Bold `**x**` / `__x__`     → `*x*`
 *   - Italic `*x*` / `_x_`        → `_x_`
 *   - Inline code `` `x` ``        → `+x+`
 *   - Fenced code blocks ```lang  → [source,lang]\n----\n…\n----
 *   - Inline links `[t](u)`       → `link:u[t]` (or `xref:u[t]` for .adoc)
 *   - Blockquotes `> x`           → `[quote]\n____\nx\n____` (consecutive)
 *   - Bulleted lists `- x`        → `* x`
 *   - Numbered lists `1. x`       → `. x`
 *   - Horizontal rules `---`/`***` → `'''`
 *
 * Pure function, no Obsidian dependencies; suitable for unit testing.
 * Handles a fenced-code-block region as a unit so heading/bold/italic
 * patterns inside code don't get mangled.
 */
export function convertMarkdownToAsciiDoc(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceLang = '';
  let inQuote = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // Fenced code blocks — preserve content verbatim.
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceLang = fenceMatch[1] || '';
        out.push(fenceLang ? `[source,${fenceLang}]` : '[source]');
        out.push('----');
      } else {
        inFence = false;
        out.push('----');
      }
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // Blockquotes — group consecutive lines into a single quote block.
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      if (!inQuote) {
        out.push('[quote]');
        out.push('____');
        inQuote = true;
      }
      out.push(quoteMatch[1]);
      continue;
    }
    if (inQuote) {
      out.push('____');
      inQuote = false;
    }

    out.push(transformLine(line));
  }

  if (inFence) {
    out.push('----');
  }
  if (inQuote) {
    out.push('____');
  }

  return out.join('\n');
}

function transformLine(line: string): string {
  // Horizontal rules
  if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line) || /^\s*-{3,}\s*$/.test(line)
      || /^\s*\*{3,}\s*$/.test(line) || /^\s*_{3,}\s*$/.test(line)) {
    return "'''";
  }

  // ATX heading
  const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return `${'='.repeat(level)} ${headingMatch[2]}`;
  }

  // Numbered list
  const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
  if (orderedMatch) {
    return `${orderedMatch[1]}. ${transformInline(orderedMatch[2])}`;
  }

  // Bullet list
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
  if (bulletMatch) {
    return `${bulletMatch[1]}* ${transformInline(bulletMatch[2])}`;
  }

  return transformInline(line);
}

// Placeholders chosen from the unicode private-use area so they never appear
// in real text. They isolate bold conversions so the italic pass doesn't
// re-process the freshly-emitted single asterisks.
const BOLD_OPEN = '';
const BOLD_CLOSE = '';

function transformInline(text: string): string {
  let out = text;

  // Bold first — replace with placeholders so the italic regex skips them.
  out = out.replace(/\*\*([^*]+)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  out = out.replace(/__([^_]+)__/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);

  // Italic. Map both * and _ to AsciiDoc's `_…_` form. The asterisk italic
  // form would clash with AsciiDoc bold, so we always normalise to `_`.
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1_$2_');
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1_$2_');

  // Inline code
  out = out.replace(/`([^`]+)`/g, '+$1+');

  // Links — `.adoc` targets become xrefs, others remain link macros.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    if (/\.adoc(?:#[^)]*)?$/.test(url)) {
      return `xref:${url}[${label}]`;
    }
    return `link:${url}[${label}]`;
  });

  // Restore bold from placeholders.
  out = out.split(BOLD_OPEN).join('*').split(BOLD_CLOSE).join('*');
  return out;
}
