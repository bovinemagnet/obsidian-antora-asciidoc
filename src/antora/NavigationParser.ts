/**
 * Antora navigation file parser. Consumes the bulleted-xref format used in
 * `modules/<module>/nav.adoc` and similar files referenced from antora.yml.
 *
 * Recognised line shapes:
 *   * xref:page.adoc[Label]              ← top-level entry
 *   ** xref:guides/install.adoc[Install]  ← child entry
 *   * Heading text                        ← non-link grouping label
 *   *** xref:other:mod:page.adoc[]        ← cross-component xref
 *
 * Indentation is determined entirely by the bullet depth (count of leading
 * `*`), matching how Asciidoctor renders nav lists.
 */
export interface NavigationEntry {
  label: string;
  /** Raw xref target as written in the source, e.g. `mod:page.adoc#anchor`. */
  target?: string;
  children: NavigationEntry[];
}

const BULLET_PATTERN = /^(\*+)\s+(.*)$/;
const XREF_PATTERN = /^xref:([^[]+)\[([^\]]*)]\s*$/;

export function parseNavigation(content: string): NavigationEntry[] {
  const root: NavigationEntry[] = [];
  /** Stack of `(depth, parent-children-array)` pairs to maintain hierarchy. */
  const stack: Array<{ depth: number; children: NavigationEntry[] }> = [
    { depth: 0, children: root },
  ];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const match = line.match(BULLET_PATTERN);
    if (!match) {
      continue;
    }
    const depth = match[1].length;
    const remainder = match[2];

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const entry = parseEntry(remainder);
    stack[stack.length - 1].children.push(entry);
    stack.push({ depth, children: entry.children });
  }

  return root;
}

function parseEntry(remainder: string): NavigationEntry {
  const xref = remainder.match(XREF_PATTERN);
  if (!xref) {
    return { label: remainder, children: [] };
  }
  const target = xref[1].trim();
  const explicitLabel = xref[2].trim();
  return {
    label: explicitLabel || target,
    target,
    children: [],
  };
}
