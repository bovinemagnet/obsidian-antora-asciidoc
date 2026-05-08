import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { EditorContext } from './EditorContext';

/**
 * Canonical value sets for attribute keys whose acceptable values are known.
 * Triggered when the cursor sits inside `key="…"` for one of these keys.
 */
export const VALUE_SETS: Record<string, string[]> = {
  align: ['left', 'center', 'right'],
  valign: ['top', 'middle', 'bottom'],
  format: ['psv', 'csv', 'tsv', 'dsv'],
  options: ['header', 'footer', 'autowidth', 'noheader', 'unbreakable', 'strict'],
  opts: ['header', 'footer', 'autowidth', 'noheader', 'unbreakable', 'strict'],
  subs: [
    'specialcharacters', 'quotes', 'attributes', 'macros', 'replacements',
    'post_replacements', 'normal', 'verbatim', 'none',
  ],
  separator: ['|', ',', ';', ':', '!'],
  window: ['_blank', '_self', '_parent', '_top'],
};

const KEY_VALUE_PATTERN = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*"([^"]*)$/;

export function createBlockAttributeValueAutocomplete(context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const lineStart = completion.state.doc.lineAt(completion.pos).from;
    const beforeCursor = completion.state.sliceDoc(lineStart, completion.pos);

    // Verify we're inside an open attribute bracket on this line.
    const openIdx = beforeCursor.lastIndexOf('[');
    if (openIdx === -1) {
      return null;
    }
    if (beforeCursor.indexOf(']', openIdx) !== -1) {
      return null;
    }
    const inside = beforeCursor.slice(openIdx + 1);
    const match = inside.match(KEY_VALUE_PATTERN);
    if (!match) {
      return null;
    }

    const key = match[1];
    const partial = match[2];
    const values = VALUE_SETS[key.toLowerCase()];
    if (!values) {
      return null;
    }

    const partialStart = completion.pos - partial.length;
    return {
      from: partialStart,
      options: values.map((value) => ({
        label: value,
        type: 'enum',
        apply: value,
      })),
    };
  };
}
