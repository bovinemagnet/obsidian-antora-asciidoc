import { Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { EditorContext } from './EditorContext';

const HEADER_PATTERN = /^\[source(?:,\s*[\w+-]+)?\s*]$/;
const FENCE_PATTERN = /^----+\s*$/;

/**
 * Highlights `[source,X]` headers and `----` source-block fences in the
 * editor. Pure visual decoration — no syntax highlighting inside the block,
 * since the source language is arbitrary and live-highlighting would
 * conflict with Markdown mode that hosts the editor.
 *
 * Gated to AsciiDoc files via EditorContext.
 */
export function createSourceBlockDecoration(context: EditorContext): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view, context);
      }

      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = build(u.view, context);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function build(view: EditorView, context: EditorContext): DecorationSet {
  if (!context.isAsciiDocActive()) {
    return Decoration.none;
  }
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (HEADER_PATTERN.test(line.text)) {
        builder.add(line.from, line.to, Decoration.line({ class: 'antora-source-header' }));
      } else if (FENCE_PATTERN.test(line.text)) {
        builder.add(line.from, line.to, Decoration.line({ class: 'antora-source-fence' }));
      }
      pos = line.to + 1;
      if (line.to === view.state.doc.length) {
        break;
      }
    }
  }

  return builder.finish();
}
