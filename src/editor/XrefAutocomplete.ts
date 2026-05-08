import { CompletionContext } from '@codemirror/autocomplete';
import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';

export function createXrefAutocomplete(index: AntoraComponentIndex) {
  return (context: CompletionContext) => {
    const token = context.matchBefore(/xref:[^\s\]]*/);
    if (!token) {
      return null;
    }

    return {
      from: token.from,
      options: index.listPageTargets().map((target) => ({
        label: `xref:${target}[]`,
        type: 'keyword',
      })),
    };
  };
}
