import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { EditorContext } from './EditorContext';

interface BlockMacroSuggestion {
  /** What the user sees in the completion list. */
  label: string;
  /** Detail text shown on the right of the list. */
  detail: string;
  /** Snippet inserted on selection. `$cursor` marks where the caret lands. */
  snippet: string;
}

const SUGGESTIONS: BlockMacroSuggestion[] = [
  { label: '[NOTE]', detail: 'Admonition: note', snippet: '[NOTE]\n====\n$cursor\n====' },
  { label: '[TIP]', detail: 'Admonition: tip', snippet: '[TIP]\n====\n$cursor\n====' },
  { label: '[WARNING]', detail: 'Admonition: warning', snippet: '[WARNING]\n====\n$cursor\n====' },
  { label: '[CAUTION]', detail: 'Admonition: caution', snippet: '[CAUTION]\n====\n$cursor\n====' },
  { label: '[IMPORTANT]', detail: 'Admonition: important', snippet: '[IMPORTANT]\n====\n$cursor\n====' },
  { label: '[source]', detail: 'Source code block', snippet: '[source,$cursor]\n----\n----' },
  { label: '[example]', detail: 'Example block', snippet: '[example]\n====\n$cursor\n====' },
  { label: '[quote]', detail: 'Quote block', snippet: '[quote, $cursor]\n____\n____' },
  { label: '[verse]', detail: 'Verse block', snippet: '[verse, $cursor]\n____\n____' },
  { label: '[listing]', detail: 'Literal listing block', snippet: '[listing]\n----\n$cursor\n----' },
  { label: '[literal]', detail: 'Literal paragraph', snippet: '[literal]\n....\n$cursor\n....' },
  { label: '[sidebar]', detail: 'Sidebar block', snippet: '[sidebar]\n****\n$cursor\n****' },
  { label: '[discrete]', detail: 'Discrete heading attribute', snippet: '[discrete]\n== $cursor' },
];

export function createBlockMacroAutocomplete(context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const token = completion.matchBefore(/^\[[A-Za-z]*$/);
    if (!token) {
      return null;
    }
    // Only fire when the `[` is the first non-whitespace character on the line.
    const lineStart = completion.state.doc.lineAt(token.from).from;
    const beforeBracket = completion.state.sliceDoc(lineStart, token.from);
    if (beforeBracket.trim().length > 0) {
      return null;
    }

    return {
      from: token.from,
      options: SUGGESTIONS.map((suggestion) => ({
        label: suggestion.label,
        detail: suggestion.detail,
        type: 'class',
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
