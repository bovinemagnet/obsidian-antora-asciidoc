import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { AsciiDocSymbols } from '../asciidoc/AsciiDocSymbols';
import { FileSource } from '../io/FileSource';
import { Diagnostic } from './Diagnostic';

export class IncludeValidator {
  constructor(
    private readonly source: FileSource,
    private readonly resolver: AntoraResourceResolver,
  ) {}

  validate(filePath: string, symbols: AsciiDocSymbols): Diagnostic[] {
    return symbols.includes.flatMap((includeRef) => {
      const targetPath = this.resolver.resolve(includeRef.target, filePath);
      if (!this.source.exists(targetPath)) {
        return [{
          message: `Unresolved include: ${includeRef.target}`,
          filePath,
          line: includeRef.line,
          column: includeRef.column,
          severity: 'error',
        } satisfies Diagnostic];
      }
      return [];
    });
  }
}
