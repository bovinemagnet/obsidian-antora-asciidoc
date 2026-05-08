import { TFile, Vault } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { Diagnostic } from './Diagnostic';
import { IncludeValidator } from './IncludeValidator';
import { XrefValidator } from './XrefValidator';

const BUILTIN_ATTRIBUTES = new Set(['docname', 'docfile', 'imagesdir', 'partialsdir']);

export class DiagnosticsService {
  private readonly xrefValidator: XrefValidator;
  private readonly includeValidator: IncludeValidator;

  constructor(
    private readonly vault: Vault,
    private readonly parser: AsciiDocParser,
    index: AntoraComponentIndex,
  ) {
    this.xrefValidator = new XrefValidator(index, new AntoraPathResolver());
    this.includeValidator = new IncludeValidator(vault);
  }

  async validateFile(file: TFile): Promise<Diagnostic[]> {
    const content = await this.vault.cachedRead(file);
    const symbols = this.parser.parseSymbols(content);

    const diagnostics = [
      ...this.xrefValidator.validate(file.path, symbols),
      ...this.includeValidator.validate(file.path, symbols),
      ...symbols.attributes
        .filter((attribute) => !BUILTIN_ATTRIBUTES.has(attribute.name))
        .map((attribute) => ({
          message: `Unresolved attribute: {${attribute.name}}`,
          filePath: file.path,
          line: attribute.line,
          column: attribute.column,
          severity: 'warning',
        }) satisfies Diagnostic),
    ];

    return diagnostics;
  }

  async validateWorkspace(includeExtensions: string[]): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const files = this.vault.getFiles().filter((file) => includeExtensions.includes(`.${file.extension}`));
    for (const file of files) {
      diagnostics.push(...(await this.validateFile(file)));
    }
    return diagnostics;
  }
}
