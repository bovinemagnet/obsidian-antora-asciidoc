import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AsciiDocSymbols } from '../asciidoc/AsciiDocSymbols';
import { Diagnostic } from './Diagnostic';

export class XrefValidator {
  constructor(
    private readonly index: AntoraComponentIndex,
    private readonly pathResolver: AntoraPathResolver,
  ) {}

  validate(filePath: string, symbols: AsciiDocSymbols): Diagnostic[] {
    const defaults = this.deriveDefaultsFor(filePath);
    return symbols.xrefs.flatMap((xref) => {
      const target = this.pathResolver.resolveXrefTarget(xref.target, defaults);
      const page = this.index.resolvePage(target);

      if (!page) {
        return [{
          message: `Broken xref target: ${xref.target}`,
          filePath,
          line: xref.line,
          column: xref.column,
          severity: 'error',
        } satisfies Diagnostic];
      }

      if (target.anchor && !page.anchors.has(target.anchor) && !this.index.hasAuxiliaryAnchor(target.anchor)) {
        return [{
          message: `Missing anchor '${target.anchor}' in ${xref.target}`,
          filePath,
          line: xref.line,
          column: xref.column,
          severity: 'error',
        } satisfies Diagnostic];
      }

      return [];
    });
  }

  private deriveDefaultsFor(filePath: string): { component?: string; module?: string } {
    const owning = this.index.getPageByFilePath(filePath);
    if (!owning) {
      return {};
    }
    return { component: owning.component, module: owning.module };
  }
}
