import { CompletionContext } from '@codemirror/autocomplete';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { EditorContext } from './EditorContext';

export function createXrefAutocomplete(index: AntoraComponentIndex, context: EditorContext) {
  return (completion: CompletionContext) => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    // Page-target mode: only fire while the user has not yet typed an anchor
    // delimiter (`#`). Once `#` is present, XrefAnchorAutocomplete takes over.
    const token = completion.matchBefore(/xref:[^#\s\]]*/);
    if (!token) {
      return null;
    }

    return {
      from: token.from,
      options: index.listPageTargets().map((target) => {
        const page = index.resolveByListedTarget(target);
        return {
          label: `xref:${target}[]`,
          detail: page?.title,
          type: 'keyword',
        };
      }),
    };
  };
}
