import { Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

import { EditorContext } from './EditorContext';

const HEADING_PATTERN = /^(={1,6})\s+(.+)$/;

/**
 * CM6 view plugin that decorates `=`-prefixed AsciiDoc heading lines so they
 * read as headings in source mode. Each level gets its own class so themes
 * can style them independently. The leading `=` characters get a separate
 * mark class so a stylesheet can dim them while keeping the title text
 * full-strength.
 *
 * Gated to AsciiDoc files via EditorContext so plain Markdown notes are
 * untouched.
 */
export function createSourceHeadingDecoration(context: EditorContext): Extension {
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
      const match = line.text.match(HEADING_PATTERN);
      if (match) {
        const level = match[1].length;
        builder.add(line.from, line.to, Decoration.line({ class: `antora-heading antora-heading-${level}` }));
        builder.add(line.from, line.from + match[1].length, Decoration.mark({ class: 'antora-heading-marker' }));
      }
      pos = line.to + 1;
      if (line.to === view.state.doc.length) {
        break;
      }
    }
  }

  return builder.finish();
}
