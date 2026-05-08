import { hoverTooltip } from '@codemirror/view';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { BUILTIN_ATTRIBUTE_NAMES } from '../asciidoc/BuiltinAttributes';
import { EditorContext } from './EditorContext';

const ATTRIBUTE_REFERENCE = /\{([A-Za-z0-9_-]+)}/g;

/**
 * Hover tooltip for `{attr}` references. Shows the descriptor-scope value
 * when known, falls back to "(known)" or "(built-in)" labels, otherwise
 * "Unresolved attribute".
 */
export function createAttributeHoverProvider(index: AntoraComponentIndex, context: EditorContext) {
  return hoverTooltip((view, pos) => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const line = view.state.doc.lineAt(pos);
    const offset = pos - line.from;

    let hit: { name: string; from: number; to: number } | null = null;
    for (const match of line.text.matchAll(ATTRIBUTE_REFERENCE)) {
      if (match.index === undefined) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) {
        hit = { name: match[1], from: line.from + start, to: line.from + end };
        break;
      }
    }
    if (!hit) {
      return null;
    }

    const sourcePath = context.getActiveFilePath();
    const descriptorAttrs = sourcePath
      ? index.getDescriptorAttributesFor(sourcePath)
      : new Map<string, string>();
    const value = descriptorAttrs.get(hit.name);

    return {
      pos: hit.from,
      end: hit.to,
      create() {
        const dom = document.createElement('div');
        dom.addClass('antora-attribute-tooltip');
        if (value !== undefined) {
          dom.setText(`{${hit.name}} = ${value}`);
        } else if (BUILTIN_ATTRIBUTE_NAMES.has(hit.name)) {
          dom.setText(`{${hit.name}} (built-in attribute)`);
        } else if (index.hasAttribute(hit.name)) {
          dom.setText(`{${hit.name}} (declared elsewhere — value not in scope)`);
        } else {
          dom.setText(`Unresolved attribute: {${hit.name}}`);
        }
        return { dom };
      },
    };
  });
}
