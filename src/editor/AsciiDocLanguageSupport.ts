import { StreamLanguage } from '@codemirror/language';

export function asciiDocLanguageSupport() {
  return StreamLanguage.define({
    startState: () => ({}),
    token: (stream) => {
      if (stream.match(/^={1,6}\s/)) {
        stream.skipToEnd();
        return 'heading';
      }
      if (stream.match(/^\/\/.*$/)) {
        stream.skipToEnd();
        return 'comment';
      }
      if (stream.match(/xref:[^[]+/)) {
        return 'link';
      }
      stream.next();
      return null;
    },
  });
}
