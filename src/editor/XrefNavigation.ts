import { EditorView } from '@codemirror/view';

export function createXrefNavigation(onNavigate: (target: string) => Promise<void> | void) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!event.metaKey && !event.ctrlKey) {
        return false;
      }

      const mouseEvent = event as MouseEvent;
      const position = view.posAtCoords({ x: mouseEvent.clientX, y: mouseEvent.clientY });
      if (position === null) {
        return false;
      }

      const line = view.state.doc.lineAt(position);
      const lineOffset = position - line.from;
      for (const match of line.text.matchAll(/xref:([^[]+)\[[^\]]*]/g)) {
        if (match.index === undefined) {
          continue;
        }

        const start = match.index;
        const end = start + match[0].length;
        if (lineOffset < start || lineOffset > end) {
          continue;
        }

        event.preventDefault();
        void onNavigate(match[1]);
        return true;
      }

      return false;
    },
  });
}
