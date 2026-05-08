import { Vault } from 'obsidian';

import { AsciiDocSymbols } from '../asciidoc/AsciiDocSymbols';
import { Diagnostic } from './Diagnostic';

export class IncludeValidator {
  constructor(private readonly vault: Vault) {}

  validate(filePath: string, symbols: AsciiDocSymbols): Diagnostic[] {
    const baseFolder = filePath.split('/').slice(0, -1).join('/');

    return symbols.includes.flatMap((includeRef) => {
      const targetPath = includeRef.target.startsWith('/')
        ? includeRef.target.replace(/^\//, '')
        : `${baseFolder}/${includeRef.target}`.replace(/\/\//g, '/');
      const file = this.vault.getAbstractFileByPath(targetPath);
      if (!file) {
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
