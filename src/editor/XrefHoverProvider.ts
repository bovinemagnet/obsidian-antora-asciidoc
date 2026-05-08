import { hoverTooltip } from '@codemirror/view';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { EditorContext } from './EditorContext';

export function createXrefHoverProvider(index: AntoraComponentIndex, context: EditorContext) {
  const resolver = new AntoraPathResolver();

  return hoverTooltip((view, pos) => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const line = view.state.doc.lineAt(pos);
    const match = line.text.match(/xref:([^[]+)\[[^\]]*]/);
    if (!match) {
      return null;
    }

    const target = match[1];
    const resolved = index.resolvePage(resolver.resolveXrefTarget(target, context.getDefaults()));
    return {
      pos: line.from,
      end: line.to,
      create() {
        const dom = document.createElement('div');
        dom.textContent = resolved
          ? `Resolves: ${resolved.component}:${resolved.module}:${resolved.path}`
          : `Unresolved xref: ${target}`;
        return { dom };
      },
    };
  });
}
