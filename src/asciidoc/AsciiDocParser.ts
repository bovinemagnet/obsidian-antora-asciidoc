import { AsciiDocSymbols } from './AsciiDocSymbols';

const XREF_RE = /xref:([^[]+)\[[^\]]*]/g;
const INCLUDE_RE = /include::([^[]+)\[[^\]]*]/g;
const ATTRIBUTE_RE = /\{([a-zA-Z0-9_-]+)}/g;
const IMAGE_RE = /image::?([^[\s]+)\[[^\]]*]/g;

function locateLineAndColumn(source: string, index: number): { line: number; column: number } {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export class AsciiDocParser {
  parseSymbols(content: string): AsciiDocSymbols {
    const xrefs = Array.from(content.matchAll(XREF_RE)).map((match) => {
      const position = locateLineAndColumn(content, match.index ?? 0);
      return {
        target: match[1].trim(),
        line: position.line,
        column: position.column,
      };
    });

    const includes = Array.from(content.matchAll(INCLUDE_RE)).map((match) => {
      const position = locateLineAndColumn(content, match.index ?? 0);
      return {
        target: match[1].trim(),
        line: position.line,
        column: position.column,
      };
    });

    const attributes = Array.from(content.matchAll(ATTRIBUTE_RE)).map((match) => {
      const position = locateLineAndColumn(content, match.index ?? 0);
      return {
        name: match[1],
        line: position.line,
        column: position.column,
      };
    });

    const images = Array.from(content.matchAll(IMAGE_RE)).map((match) => {
      const position = locateLineAndColumn(content, match.index ?? 0);
      return {
        target: match[1].trim(),
        line: position.line,
        column: position.column,
      };
    });

    return { xrefs, includes, attributes, images };
  }
}
