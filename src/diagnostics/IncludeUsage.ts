import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource } from '../io/FileSource';
import { Diagnostic } from './Diagnostic';

/**
 * Walks every .adoc file in the source and returns one info-severity
 * diagnostic per page whose include:: directives resolve to the supplied
 * partial path. Pure function; the caller wraps the partial discovery and
 * surfaces results in the diagnostics view.
 */
export async function findIncludeUsages(
  source: FileSource,
  index: AntoraComponentIndex,
  parser: AsciiDocParser,
  partialFilePath: string,
): Promise<Diagnostic[]> {
  const resolver = new AntoraResourceResolver(index);
  const usages: Diagnostic[] = [];

  for (const file of source.list()) {
    if (!/^(adoc|asciidoc)$/i.test(file.extension)) {
      continue;
    }
    const content = await source.read(file);
    const symbols = parser.parseSymbols(content);
    for (const include of symbols.includes) {
      const resolved = resolver.resolve(include.target, file.path);
      if (resolved === partialFilePath) {
        usages.push({
          filePath: file.path,
          line: include.line,
          column: include.column,
          severity: 'info',
          message: `include::${include.target} → ${partialFilePath}`,
        });
      }
    }
  }

  return usages;
}
