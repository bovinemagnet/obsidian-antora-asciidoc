import { Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

export function createDiagnosticsExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const marker = Decoration.mark({ class: 'antora-xref-token' });

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const lineStart = from;
    for (const match of text.matchAll(/xref:[^[]+\[[^\]]*]/g)) {
      if (match.index === undefined) {
        continue;
      }
      const start = lineStart + match.index;
      const end = start + match[0].length;
      builder.add(start, end, marker);
    }
  }

  return builder.finish();
}
