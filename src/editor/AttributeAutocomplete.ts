import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { BUILTIN_ATTRIBUTE_NAMES } from '../asciidoc/BuiltinAttributes';
import { EditorContext } from './EditorContext';

const ATTRIBUTE_PATTERN = /\{[A-Za-z0-9_-]*$/;

/**
 * Suggests attribute names after the user types `{`. Combines:
 *   - descriptor attributes for the current page's component (with values
 *     shown in the detail column)
 *   - workspace-known attribute names (anything we've seen anywhere)
 *   - AsciiDoc + Antora built-in attribute names
 */
export function createAttributeAutocomplete(index: AntoraComponentIndex, context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const token = completion.matchBefore(ATTRIBUTE_PATTERN);
    if (!token) {
      return null;
    }
    // The matched range is `{partial`. Suggest replacing the partial only.
    const partialStart = token.from + 1;

    const sourcePath = context.getActiveFilePath();
    const descriptorAttrs = sourcePath ? index.getDescriptorAttributesFor(sourcePath) : new Map<string, string>();

    const seen = new Set<string>();
    const options: Array<{ label: string; detail?: string; type: string; apply: string }> = [];

    for (const [name, value] of descriptorAttrs) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      options.push({
        label: name,
        detail: value,
        type: 'variable',
        apply: `${name}}`,
      });
    }

    for (const name of index.getKnownAttributeNames()) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      options.push({ label: name, type: 'variable', apply: `${name}}` });
    }

    for (const name of BUILTIN_ATTRIBUTE_NAMES) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      options.push({ label: name, type: 'constant', detail: 'built-in', apply: `${name}}` });
    }

    if (options.length === 0) {
      return null;
    }

    options.sort((a, b) => a.label.localeCompare(b.label));

    return { from: partialStart, options };
  };
}
