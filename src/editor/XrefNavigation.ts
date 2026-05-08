import { EditorView, ViewPlugin } from '@codemirror/view';

export function createXrefNavigation() {
  return ViewPlugin.fromClass(
    class {
      constructor(_view: EditorView) {}
    },
  );
}
