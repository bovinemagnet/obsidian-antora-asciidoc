import { TFile, Vault } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { BUILTIN_ATTRIBUTE_NAMES } from '../asciidoc/BuiltinAttributes';
import { findDisabledRanges, isLineWithinDisabledRange } from '../asciidoc/ConditionalBlocks';
import { FileSource } from '../io/FileSource';
import { Diagnostic } from './Diagnostic';
import { lintHeadingHierarchy } from './HeadingHierarchyLint';
import { IncludeValidator } from './IncludeValidator';
import { XrefValidator } from './XrefValidator';

export interface LintRuleToggles {
  xref?: boolean;
  include?: boolean;
  attribute?: boolean;
  headingHierarchy?: boolean;
}

export class DiagnosticsService {
  private readonly xrefValidator: XrefValidator;
  private readonly includeValidator: IncludeValidator;
  private rules: Required<LintRuleToggles> = {
    xref: true, include: true, attribute: true, headingHierarchy: true,
  };

  constructor(
    private readonly vault: Vault,
    private readonly parser: AsciiDocParser,
    private readonly index: AntoraComponentIndex,
    fileSource: FileSource,
  ) {
    this.xrefValidator = new XrefValidator(index, new AntoraPathResolver());
    this.includeValidator = new IncludeValidator(fileSource, new AntoraResourceResolver(index));
  }

  /** Updates which lint rules are active. Missing keys keep their current value. */
  setLintRules(rules: LintRuleToggles): void {
    this.rules = { ...this.rules, ...rules } as Required<LintRuleToggles>;
  }

  async validateFile(file: TFile): Promise<Diagnostic[]> {
    const content = await this.vault.cachedRead(file);
    const symbols = this.parser.parseSymbols(content);
    const knownNames = this.collectKnownAttributeNames();
    const disabledRanges = findDisabledRanges(content, knownNames);

    const out: Diagnostic[] = [];
    if (this.rules.xref) {
      out.push(...this.xrefValidator.validate(file.path, symbols));
    }
    if (this.rules.include) {
      out.push(...this.includeValidator.validate(file.path, symbols));
    }
    if (this.rules.headingHierarchy) {
      out.push(...lintHeadingHierarchy(content, file.path));
    }
    if (this.rules.attribute) {
      out.push(...symbols.attributes
        .filter((attribute) => !this.isAttributeKnown(attribute.name))
        .filter((attribute) => !isLineWithinDisabledRange(attribute.line, disabledRanges))
        .map((attribute) => ({
          message: `Unresolved attribute: {${attribute.name}}`,
          filePath: file.path,
          line: attribute.line,
          column: attribute.column,
          severity: 'warning',
        }) satisfies Diagnostic));
    }
    return out;
  }

  private collectKnownAttributeNames(): Set<string> {
    const names = new Set<string>(BUILTIN_ATTRIBUTE_NAMES);
    for (const name of this.index.getKnownAttributeNames()) {
      names.add(name);
    }
    return names;
  }

  /**
   * Validates every AsciiDoc file in the workspace, yielding to the event loop
   * between batches so the renderer thread stays responsive on large
   * workspaces. The optional progress callback fires after each batch.
   */
  async validateWorkspace(
    includeExtensions: string[],
    options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<Diagnostic[]> {
    const batchSize = Math.max(1, options.batchSize ?? 50);
    const diagnostics: Diagnostic[] = [];
    const files = this.vault.getFiles().filter((file) => includeExtensions.includes(`.${file.extension}`));

    for (let offset = 0; offset < files.length; offset += batchSize) {
      const batch = files.slice(offset, offset + batchSize);
      for (const file of batch) {
        diagnostics.push(...(await this.validateFile(file)));
      }
      options.onProgress?.(Math.min(offset + batch.length, files.length), files.length);
      if (offset + batchSize < files.length) {
        await yieldToEventLoop();
      }
    }
    return diagnostics;
  }

  private isAttributeKnown(name: string): boolean {
    return BUILTIN_ATTRIBUTE_NAMES.has(name) || this.index.hasAttribute(name);
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
