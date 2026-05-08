import { hoverTooltip } from '@codemirror/view';
import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';

export function createXrefHoverProvider(index: AntoraComponentIndex) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const match = line.text.match(/xref:([^[]+)\[[^\]]*]/);
    if (!match) {
      return null;
    }

    const target = match[1];
    const resolved = index.listPageTargets().includes(target);
    return {
      pos: line.from,
      end: line.to,
      create() {
        const dom = document.createElement('div');
        dom.textContent = resolved ? `Resolves: ${target}` : `Unresolved xref: ${target}`;
        return { dom };
      },
    };
  });
}
