import { foldService } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

import { EditorContext } from './EditorContext';

const HEADING_PATTERN = /^(={1,6})\s/;

/**
 * Provides section-level folding for AsciiDoc documents. A heading folds from
 * the end of its own line to the line *before* the next heading at the same
 * or shallower depth, mirroring how Markdown folding works in Obsidian.
 */
export function createSectionFolding(context: EditorContext) {
  return foldService.of((state, lineStart, lineEnd) => {
    if (!context.isAsciiDocActive()) {
      return null;
    }
    const line = state.doc.lineAt(lineStart);
    if (line.from !== lineStart || line.to !== lineEnd) {
      // foldService is invoked per-line; only the line itself defines the
      // foldable range.
      return null;
    }
    const match = line.text.match(HEADING_PATTERN);
    if (!match) {
      return null;
    }
    const depth = match[1].length;
    const end = findSectionEnd(state, line.number, depth);
    if (end <= line.to) {
      return null;
    }
    return { from: line.to, to: end };
  });
}

function findSectionEnd(state: EditorState, headingLineNumber: number, headingDepth: number): number {
  const totalLines = state.doc.lines;
  for (let lineNumber = headingLineNumber + 1; lineNumber <= totalLines; lineNumber += 1) {
    const candidate = state.doc.line(lineNumber);
    const match = candidate.text.match(HEADING_PATTERN);
    if (match && match[1].length <= headingDepth) {
      // The fold ends at the line BEFORE the next sibling/parent heading.
      return state.doc.line(lineNumber - 1).to;
    }
  }
  return state.doc.length;
}
