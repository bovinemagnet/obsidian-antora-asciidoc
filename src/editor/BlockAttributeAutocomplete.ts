import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { EditorContext } from './EditorContext';

interface AttributeSuggestion {
  label: string;
  detail: string;
  /** What gets inserted; `$cursor` marks where the caret should land. */
  snippet: string;
}

/**
 * Common keys recognised by AsciiDoc/Antora across block, table, source, and
 * image macros. Not exhaustive — focuses on the keys writers reach for most
 * often. The completion is positional: it fires after a `,` inside a
 * bracketed attribute list, OR after the macro name when the user is typing
 * the second positional value (e.g. `[source,|`).
 */
const SUGGESTIONS: AttributeSuggestion[] = [
  { label: 'title', detail: 'Block title', snippet: 'title="$cursor"' },
  { label: 'role', detail: 'CSS role / class', snippet: 'role="$cursor"' },
  { label: 'id', detail: 'Block ID', snippet: 'id="$cursor"' },
  { label: 'cols', detail: 'Table column spec', snippet: 'cols="$cursor"' },
  { label: 'options', detail: 'Block options (opts)', snippet: 'options="$cursor"' },
  { label: 'opts', detail: 'Short form of options', snippet: 'opts="$cursor"' },
  { label: 'format', detail: 'Table data format', snippet: 'format="$cursor"' },
  { label: 'separator', detail: 'Table cell separator', snippet: 'separator="$cursor"' },
  { label: 'caption', detail: 'Block caption', snippet: 'caption="$cursor"' },
  { label: 'width', detail: 'Block / image width', snippet: 'width="$cursor"' },
  { label: 'align', detail: 'Horizontal alignment', snippet: 'align="$cursor"' },
  { label: 'valign', detail: 'Vertical alignment', snippet: 'valign="$cursor"' },
  { label: 'alt', detail: 'Image alt text', snippet: 'alt="$cursor"' },
  { label: 'link', detail: 'Hyperlink target', snippet: 'link="$cursor"' },
  { label: 'window', detail: 'Anchor target window', snippet: 'window="$cursor"' },
  { label: 'subs', detail: 'Substitution mode', snippet: 'subs="$cursor"' },
  { label: 'tags', detail: 'Tagged include selector', snippet: 'tags="$cursor"' },
  { label: 'lines', detail: 'Line range selector', snippet: 'lines="$cursor"' },
  { label: 'leveloffset', detail: 'Heading level offset', snippet: 'leveloffset="$cursor"' },
  { label: 'reftext', detail: 'Cross-reference text', snippet: 'reftext="$cursor"' },
];

/**
 * Triggers when the cursor sits inside an attribute list — that is, after the
 * opening `[` and before the closing `]` on the same line, with no preceding
 * `=` or quote character in the immediate token. We match the partial word
 * being typed so users get filtered results as they go.
 */
export function createBlockAttributeAutocomplete(context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const lineStart = completion.state.doc.lineAt(completion.pos).from;
    const beforeCursor = completion.state.sliceDoc(lineStart, completion.pos);

    // Locate the most recent `[` on the line and verify it's still open.
    const openIdx = beforeCursor.lastIndexOf('[');
    if (openIdx === -1) {
      return null;
    }
    if (beforeCursor.indexOf(']', openIdx) !== -1) {
      return null;
    }
    const inside = beforeCursor.slice(openIdx + 1);

    // Don't fire if the user is inside a quoted value.
    if (countUnescaped(inside, '"') % 2 === 1 || countUnescaped(inside, "'") % 2 === 1) {
      return null;
    }
    // Match the partial key being typed — letters, digits, dashes only.
    const tokenMatch = inside.match(/(?:^|,)\s*([A-Za-z][A-Za-z0-9_-]*)?$/);
    if (!tokenMatch) {
      return null;
    }
    const partial = tokenMatch[1] ?? '';
    const partialStart = completion.pos - partial.length;

    // Suppress completion when the user is typing the *first* positional
    // value (block macro name) — e.g. inside `[source` or `[NOTE`.
    const consumed = inside.slice(0, inside.length - partial.length).trim();
    if (consumed.length === 0) {
      return null;
    }

    return {
      from: partialStart,
      options: SUGGESTIONS.map((suggestion) => ({
        label: suggestion.label,
        detail: suggestion.detail,
        type: 'property',
        apply: (view, _completion, from, to) => {
          const insertion = suggestion.snippet.replace('$cursor', '');
          const cursorOffset = suggestion.snippet.indexOf('$cursor');
          view.dispatch({
            changes: { from, to, insert: insertion },
            selection: cursorOffset >= 0 ? { anchor: from + cursorOffset } : undefined,
          });
        },
      })),
    };
  };
}

function countUnescaped(text: string, char: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === char && text[i - 1] !== '\\') {
      count += 1;
    }
  }
  return count;
}
