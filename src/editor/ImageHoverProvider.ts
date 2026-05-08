import { hoverTooltip } from '@codemirror/view';
import { Vault, TFile } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { EditorContext } from './EditorContext';

const IMAGE_MACRO = /image::?([^[\s]+)\[[^\]]*]/g;

/**
 * Hovering an `image::file.png[]` or `image:file.png[]` macro shows the
 * referenced image inline. Resolves Antora resource IDs (image$X) the same
 * way the IncludeValidator does, then falls back to a sibling-relative
 * lookup. Shows a "not found" tooltip when the image isn't tracked or the
 * file doesn't exist in the vault.
 */
export function createImageHoverProvider(index: AntoraComponentIndex, vault: Vault, context: EditorContext) {
  const resolver = new AntoraResourceResolver(index);

  return hoverTooltip((view, pos) => {
    if (!context.isAsciiDocActive()) {
      return null;
    }
    const sourcePath = context.getActiveFilePath();
    if (!sourcePath) {
      return null;
    }
    const line = view.state.doc.lineAt(pos);
    const offset = pos - line.from;

    let hit: { target: string; from: number; to: number } | null = null;
    for (const match of line.text.matchAll(IMAGE_MACRO)) {
      if (match.index === undefined) {
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) {
        hit = { target: match[1], from: line.from + start, to: line.from + end };
        break;
      }
    }
    if (!hit) {
      return null;
    }

    const resolvedPath = resolver.resolve(hit.target, sourcePath);
    const tfile = vault.getAbstractFileByPath(resolvedPath);

    return {
      pos: hit.from,
      end: hit.to,
      create() {
        const dom = document.createElement('div');
        dom.addClass('antora-image-hover');
        if (tfile instanceof TFile) {
          const img = document.createElement('img');
          img.setAttribute('src', vault.adapter.getResourcePath(tfile.path));
          img.setAttribute('alt', hit.target);
          img.addClass('antora-image-hover-img');
          dom.appendChild(img);
          dom.createEl('div', { text: resolvedPath, cls: 'antora-image-hover-path' });
        } else {
          dom.setText(`Image not found: ${hit.target}`);
        }
        return { dom };
      },
    };
  });
}
