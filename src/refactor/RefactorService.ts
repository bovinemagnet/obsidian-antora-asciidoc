import { AntoraComponentIndex, AntoraPageEntry } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource, SourceFile } from '../io/FileSource';

export interface ReferenceEdit {
  /** Vault path of the file that owns the reference. */
  filePath: string;
  /** 1-based line where the original text appears. */
  line: number;
  /** 1-based column where the original text starts. */
  column: number;
  originalText: string;
  replacementText: string;
}

export interface RefactorPlan {
  edits: ReferenceEdit[];
  /** Files that need new content. Map keys are vault paths, values are full new content. */
  fileChanges: Map<string, string>;
  /** Optional file move: { from, to } applied after content rewrites. */
  fileMove?: { from: string; to: string };
}

export interface PageRenameOptions {
  /** Current vault path of the page being renamed. */
  oldFilePath: string;
  /** New `<path>.adoc` portion under the same module's pages/ folder. */
  newPagePath: string;
}

export interface AnchorRenameOptions {
  /** Vault path of the page that owns the anchor. */
  ownerFilePath: string;
  oldAnchor: string;
  newAnchor: string;
}

/**
 * Pure refactor logic. Reads source content via the FileSource and produces a
 * RefactorPlan that the caller (the plugin) applies via vault.modify and
 * vault.rename. Keeping IO at the edges makes the service easy to unit-test
 * with InMemoryFileSource.
 */
export class RefactorService {
  private readonly resolver = new AntoraPathResolver();

  constructor(
    private readonly source: FileSource,
    private readonly index: AntoraComponentIndex,
    private readonly parser: AsciiDocParser,
  ) {}

  /**
   * Walks every AsciiDoc file in the source and returns the xref references
   * that resolve to the given page entry.
   */
  async findPageReferences(pageEntry: AntoraPageEntry): Promise<ReferenceEdit[]> {
    const edits: ReferenceEdit[] = [];

    for (const file of this.adocFiles()) {
      const content = await this.source.read(file);
      const symbols = this.parser.parseSymbols(content);
      const sourcePage = this.index.getPageByFilePath(file.path);
      const defaults = this.deriveDefaultsForFile(file.path, sourcePage);

      for (const xref of symbols.xrefs) {
        const resolved = this.resolver.resolveXrefTarget(xref.target, defaults);
        const targetPage = this.index.resolvePage(resolved);
        if (!targetPage || targetPage.filePath !== pageEntry.filePath) {
          continue;
        }
        edits.push({
          filePath: file.path,
          line: xref.line,
          column: xref.column,
          originalText: xref.target,
          replacementText: rewritePageTarget(xref.target, pageEntry, sourcePage),
        });
      }
    }

    return edits;
  }

  /**
   * Walks every AsciiDoc file in the source and returns xref references that
   * point at the given anchor on the owning page.
   */
  async findAnchorReferences(ownerFilePath: string, anchor: string): Promise<ReferenceEdit[]> {
    const owner = this.index.getPageByFilePath(ownerFilePath);
    if (!owner) {
      return [];
    }
    const edits: ReferenceEdit[] = [];

    for (const file of this.adocFiles()) {
      const content = await this.source.read(file);
      const symbols = this.parser.parseSymbols(content);
      const sourcePage = this.index.getPageByFilePath(file.path);
      const defaults = this.deriveDefaultsForFile(file.path, sourcePage);

      for (const xref of symbols.xrefs) {
        const resolved = this.resolver.resolveXrefTarget(xref.target, defaults);
        if (resolved.anchor !== anchor) {
          continue;
        }
        const targetPage = this.index.resolvePage(resolved);
        if (!targetPage || targetPage.filePath !== owner.filePath) {
          continue;
        }
        edits.push({
          filePath: file.path,
          line: xref.line,
          column: xref.column,
          originalText: xref.target,
          replacementText: replaceAnchorInTarget(xref.target, anchor, anchor),
        });
      }
    }

    return edits;
  }

  /**
   * Builds a plan that renames a page. The plan rewrites every xref pointing
   * at the page, and includes a fileMove the caller should perform last.
   */
  async planPageRename(options: PageRenameOptions): Promise<RefactorPlan> {
    const owner = this.index.getPageByFilePath(options.oldFilePath);
    if (!owner) {
      throw new Error(`Page is not indexed: ${options.oldFilePath}`);
    }
    const newOwner: AntoraPageEntry = {
      ...owner,
      path: options.newPagePath,
      filePath: rewriteFilePath(owner.filePath, owner.path, options.newPagePath),
    };

    const plan: RefactorPlan = {
      edits: [],
      fileChanges: new Map(),
      fileMove: { from: owner.filePath, to: newOwner.filePath },
    };

    for (const file of this.adocFiles()) {
      const content = await this.source.read(file);
      const symbols = this.parser.parseSymbols(content);
      const sourcePage = this.index.getPageByFilePath(file.path);
      const defaults = this.deriveDefaultsForFile(file.path, sourcePage);

      let updated = content;
      let touched = false;
      // Apply edits from the back of the file forward to keep offsets stable.
      const xrefs = [...symbols.xrefs].reverse();

      for (const xref of xrefs) {
        const resolved = this.resolver.resolveXrefTarget(xref.target, defaults);
        const targetPage = this.index.resolvePage(resolved);
        if (!targetPage || targetPage.filePath !== owner.filePath) {
          continue;
        }
        const newTarget = rewritePageTarget(xref.target, newOwner, sourcePage);
        if (newTarget === xref.target) {
          continue;
        }
        updated = replaceAtPosition(updated, xref.line, xref.column, `xref:${xref.target}[`, `xref:${newTarget}[`);
        plan.edits.push({
          filePath: file.path,
          line: xref.line,
          column: xref.column,
          originalText: xref.target,
          replacementText: newTarget,
        });
        touched = true;
      }

      if (touched) {
        plan.fileChanges.set(file.path, updated);
      }
    }

    return plan;
  }

  /**
   * Builds a plan that renames an anchor. Rewrites:
   *   1. anchor declarations inside the owning page (`[[old]]`, `[#old]`, `[id="old"]`)
   *   2. all `xref:...#old[]` references that resolve to the owning page
   */
  async planAnchorRename(options: AnchorRenameOptions): Promise<RefactorPlan> {
    const owner = this.index.getPageByFilePath(options.ownerFilePath);
    if (!owner) {
      throw new Error(`Page is not indexed: ${options.ownerFilePath}`);
    }
    if (options.oldAnchor === options.newAnchor) {
      return { edits: [], fileChanges: new Map() };
    }

    const plan: RefactorPlan = { edits: [], fileChanges: new Map() };

    // Rewrite the declaration inside the owning page.
    const ownerFile = this.findSourceFile(options.ownerFilePath);
    if (ownerFile) {
      const content = await this.source.read(ownerFile);
      const updated = rewriteAnchorDeclarations(content, options.oldAnchor, options.newAnchor);
      if (updated !== content) {
        plan.fileChanges.set(options.ownerFilePath, updated);
      }
    }

    // Rewrite `xref:...#old[]` references across the workspace.
    for (const file of this.adocFiles()) {
      const content = await this.source.read(file);
      const symbols = this.parser.parseSymbols(content);
      const sourcePage = this.index.getPageByFilePath(file.path);
      const defaults = this.deriveDefaultsForFile(file.path, sourcePage);

      let updated = plan.fileChanges.get(file.path) ?? content;
      let touched = updated !== content;
      const xrefs = [...symbols.xrefs].reverse();

      for (const xref of xrefs) {
        const resolved = this.resolver.resolveXrefTarget(xref.target, defaults);
        if (resolved.anchor !== options.oldAnchor) {
          continue;
        }
        const targetPage = this.index.resolvePage(resolved);
        if (!targetPage || targetPage.filePath !== owner.filePath) {
          continue;
        }
        const newTarget = replaceAnchorInTarget(xref.target, options.oldAnchor, options.newAnchor);
        if (newTarget === xref.target) {
          continue;
        }
        updated = replaceAtPosition(updated, xref.line, xref.column, `xref:${xref.target}[`, `xref:${newTarget}[`);
        plan.edits.push({
          filePath: file.path,
          line: xref.line,
          column: xref.column,
          originalText: xref.target,
          replacementText: newTarget,
        });
        touched = true;
      }

      if (touched) {
        plan.fileChanges.set(file.path, updated);
      }
    }

    return plan;
  }

  private adocFiles(): SourceFile[] {
    return this.source.list().filter((file) => /^(adoc|asciidoc)$/i.test(file.extension));
  }

  private findSourceFile(filePath: string): SourceFile | undefined {
    return this.source.list().find((file) => file.path === filePath);
  }

  /**
   * Derives the xref-resolution defaults for a source file. Pages get their
   * indexed component/module directly; non-page files (nav.adoc, partials,
   * examples) fall back to a path-based lookup against the index's
   * descriptor registry.
   */
  private deriveDefaultsForFile(filePath: string, sourcePage: AntoraPageEntry | undefined): { component?: string; module?: string } {
    if (sourcePage) {
      return { component: sourcePage.component, module: sourcePage.module };
    }
    const context = this.index.getComponentContextForPath(filePath);
    if (context) {
      return { component: context.component, module: context.module };
    }
    return {};
  }
}

/**
 * Builds a target string for the renamed page that preserves the original
 * scoping (bare / module / component:module) the writer chose.
 */
function rewritePageTarget(
  originalTarget: string,
  newOwner: AntoraPageEntry,
  sourcePage: AntoraPageEntry | undefined,
): string {
  const [pathPart, anchor] = originalTarget.split('#');
  const segments = pathPart.split(':');
  const anchorSuffix = anchor !== undefined ? `#${anchor}` : '';

  if (segments.length === 1) {
    // Bare page reference. Keep bare; resolution defaults will cover it.
    return `${newOwner.path}${anchorSuffix}`;
  }
  if (segments.length === 2) {
    // module:page form. Preserve module from the new owner so cross-module
    // links keep pointing at the right place even if the writer used the
    // module qualifier deliberately.
    const moduleName = sourcePage && sourcePage.module === newOwner.module
      ? newOwner.module
      : newOwner.module;
    return `${moduleName}:${newOwner.path}${anchorSuffix}`;
  }
  // component:module:page
  return `${newOwner.component}:${newOwner.module}:${newOwner.path}${anchorSuffix}`;
}

function replaceAnchorInTarget(originalTarget: string, oldAnchor: string, newAnchor: string): string {
  const [pathPart, currentAnchor] = originalTarget.split('#');
  if (currentAnchor === undefined) {
    return originalTarget;
  }
  if (currentAnchor !== oldAnchor) {
    return originalTarget;
  }
  return `${pathPart}#${newAnchor}`;
}

function rewriteAnchorDeclarations(content: string, oldAnchor: string, newAnchor: string): string {
  const escaped = oldAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: Array<{ pattern: RegExp; replace: string }> = [
    { pattern: new RegExp(`\\[\\[${escaped}(,[^\\]]*)?\\]\\]`, 'g'), replace: `[[${newAnchor}$1]]` },
    { pattern: new RegExp(`\\[#${escaped}(,[^\\]]*)?\\]`, 'g'), replace: `[#${newAnchor}$1]` },
    { pattern: new RegExp(`\\[id=(["'])${escaped}\\1([^\\]]*)\\]`, 'g'), replace: `[id=$1${newAnchor}$1$2]` },
  ];
  let updated = content;
  for (const { pattern, replace } of patterns) {
    updated = updated.replace(pattern, replace);
  }
  return updated;
}

/**
 * Computes the new file path when only the page-relative portion changes.
 * Works whether the original page is at the root of `pages/` or inside
 * subdirectories.
 */
function rewriteFilePath(originalFilePath: string, oldPagePath: string, newPagePath: string): string {
  if (!originalFilePath.endsWith(oldPagePath)) {
    // Defensive: if the old path doesn't actually appear at the tail (which
    // would mean the index entry is stale), fall back to swapping the
    // filename only.
    const lastSlash = originalFilePath.lastIndexOf('/');
    return `${originalFilePath.slice(0, lastSlash + 1)}${newPagePath.split('/').pop()}`;
  }
  return `${originalFilePath.slice(0, originalFilePath.length - oldPagePath.length)}${newPagePath}`;
}

/**
 * Replaces text at a 1-based (line, column) position. Used to apply
 * line/column-keyed edits derived from AsciiDocParser output.
 */
function replaceAtPosition(content: string, line: number, column: number, original: string, replacement: string): string {
  const lines = content.split('\n');
  const target = lines[line - 1];
  if (target === undefined) {
    return content;
  }
  const startIdx = column - 1;
  if (target.slice(startIdx, startIdx + original.length) !== original) {
    return content;
  }
  lines[line - 1] = `${target.slice(0, startIdx)}${replacement}${target.slice(startIdx + original.length)}`;
  return lines.join('\n');
}
