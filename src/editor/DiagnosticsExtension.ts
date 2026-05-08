import { Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { EditorContext } from './EditorContext';

const XREF_PATTERN = /xref:([^[]+)\[[^\]]*]/g;

export function createDiagnosticsExtension(index: AntoraComponentIndex, context: EditorContext): Extension {
  const resolver = new AntoraPathResolver();

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, index, resolver, context);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, index, resolver, context);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function buildDecorations(
  view: EditorView,
  index: AntoraComponentIndex,
  resolver: AntoraPathResolver,
  context: EditorContext,
): DecorationSet {
  if (!context.isAsciiDocActive()) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const okMark = Decoration.mark({ class: 'antora-xref-token' });
  const brokenMark = Decoration.mark({ class: 'antora-xref-broken' });

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const match of text.matchAll(XREF_PATTERN)) {
      if (match.index === undefined) {
        continue;
      }
      const start = from + match.index;
      const end = start + match[0].length;
      const target = match[1];
      const resolved = index.resolvePage(resolver.resolveXrefTarget(target, context.getDefaults()));
      builder.add(start, end, resolved ? okMark : brokenMark);
    }
  }

  return builder.finish();
}
