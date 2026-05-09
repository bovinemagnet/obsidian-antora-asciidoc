import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { AsciiDocSymbols } from '../asciidoc/AsciiDocSymbols';
import { FileSource } from '../io/FileSource';
import { Diagnostic } from './Diagnostic';

/**
 * Validates that every `image::` and `image:` macro target resolves to a
 * file that exists in the supplied source. Skips targets that look like
 * absolute URLs (http://, data:, etc.) since those are externally hosted.
 */
export class ImageValidator {
  constructor(
    private readonly source: FileSource,
    private readonly resolver: AntoraResourceResolver,
  ) {}

  validate(filePath: string, symbols: AsciiDocSymbols): Diagnostic[] {
    return symbols.images.flatMap((image) => {
      const target = image.target;
      if (/^[a-z]+:/i.test(target)) {
        // External URL — out of scope for this lint.
        return [];
      }
      const resolved = this.resolver.resolve(target, filePath);
      if (this.source.exists(resolved)) {
        return [];
      }
      return [{
        message: `Unresolved image target: ${target}`,
        filePath,
        line: image.line,
        column: image.column,
        severity: 'error',
      } satisfies Diagnostic];
    });
  }
}
