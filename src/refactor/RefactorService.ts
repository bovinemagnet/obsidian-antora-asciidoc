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
  /**
   * When set, the page also moves into a different module within the same
   * component. xrefs to the page get rewritten with the new module scope so
   * they keep resolving.
   */
  newModule?: string;
}

export interface ModuleRenameOptions {
  /** Component the module lives in. */
  component: string;
  oldModuleName: string;
  newModuleName: string;
}

export interface AnchorRenameOptions {
  /** Vault path of the page that owns the anchor. */
  ownerFilePath: string;
  oldAnchor: string;
  newAnchor: string;
  /**
   * When true, also rewrite anchor declarations on every other page that
   * happens to declare the same name, plus their inbound xrefs. Default
   * false — keeps the rename owner-page-scoped.
   */
  acrossAllPages?: boolean;
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
          replacementText: rewritePageTarget(xref.target, pageEntry, defaults),
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
    const newModule = options.newModule ?? owner.module;
    const newOwner: AntoraPageEntry = {
      ...owner,
      module: newModule,
      path: options.newPagePath,
      filePath: rewriteFilePath(owner.filePath, owner.module, owner.path, newModule, options.newPagePath),
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
        const newTarget = rewritePageTarget(xref.target, newOwner, defaults);
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
    const acrossAll = options.acrossAllPages === true;

    // Rewrite anchor declarations on the owning page (and on every other page
    // when acrossAllPages is set).
    const declarationFiles = acrossAll
      ? this.adocFiles().map((f) => f.path)
      : [options.ownerFilePath];
    for (const declarationPath of declarationFiles) {
      const declarationFile = this.findSourceFile(declarationPath);
      if (!declarationFile) {
        continue;
      }
      const content = await this.source.read(declarationFile);
      const updated = rewriteAnchorDeclarations(content, options.oldAnchor, options.newAnchor);
      if (updated !== content) {
        plan.fileChanges.set(declarationPath, updated);
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
        if (!targetPage) {
          continue;
        }
        if (!acrossAll && targetPage.filePath !== owner.filePath) {
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

  /**
   * Plans a module rename: walks every file under the component's
   * `modules/<old>/` folder and produces file moves to `modules/<new>/`,
   * plus xref rewrites across the workspace where the old module name
   * appears as a target scope.
   */
  async planModuleRename(options: ModuleRenameOptions): Promise<RefactorPlan> {
    if (options.oldModuleName === options.newModuleName) {
      return { edits: [], fileChanges: new Map() };
    }
    const componentRoot = this.findComponentRoot(options.component);
    if (!componentRoot) {
      throw new Error(`Component is not indexed: ${options.component}`);
    }
    const oldPrefix = `${componentRoot}/modules/${options.oldModuleName}/`;
    const newPrefix = `${componentRoot}/modules/${options.newModuleName}/`;

    const plan: RefactorPlan = { edits: [], fileChanges: new Map() };
    const moves: Array<{ from: string; to: string }> = [];

    for (const file of this.source.list()) {
      if (file.path.startsWith(oldPrefix)) {
        moves.push({ from: file.path, to: newPrefix + file.path.slice(oldPrefix.length) });
      }
    }

    // Module renames affect xref scope strings. Walk every adoc file and
    // rewrite `module:` and `component:module:` mentions of the old name to
    // the new name when they resolve into the renamed module.
    for (const file of this.adocFiles()) {
      const content = await this.source.read(file);
      const symbols = this.parser.parseSymbols(content);
      const sourcePage = this.index.getPageByFilePath(file.path);
      const defaults = this.deriveDefaultsForFile(file.path, sourcePage);

      let updated = content;
      let touched = false;
      const xrefs = [...symbols.xrefs].reverse();

      for (const xref of xrefs) {
        const newTarget = rewriteScopeForModuleRename(
          xref.target,
          options.component,
          options.oldModuleName,
          options.newModuleName,
          defaults,
        );
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

    // The plan only carries a single `fileMove`; for module rename we expose
    // a separate `moves` array via a distinct property the caller iterates.
    (plan as RefactorPlan & { moves?: Array<{ from: string; to: string }> }).moves = moves;
    return plan;
  }

  private findComponentRoot(componentName: string): string | undefined {
    for (const component of this.index.getComponents()) {
      if (component.name !== componentName) {
        continue;
      }
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          for (const page of module.pages) {
            const idx = page.filePath.indexOf('/modules/');
            if (idx > 0) {
              return page.filePath.slice(0, idx);
            }
          }
        }
      }
    }
    return undefined;
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
  private deriveDefaultsForFile(filePath: string, sourcePage: AntoraPageEntry | undefined): { component?: string; module?: string; version?: string } {
    if (sourcePage) {
      return { component: sourcePage.component, module: sourcePage.module, version: sourcePage.version };
    }
    const context = this.index.getComponentContextForPath(filePath);
    if (context) {
      return { component: context.component, module: context.module };
    }
    return {};
  }
}

/**
 * Builds a target string for the renamed page. Tries to preserve the writer's
 * original scope (bare / module / component:module) when that scope is still
 * sufficient for the move; widens the scope when the page has moved to a
 * module the source can no longer resolve via defaults.
 */
function rewritePageTarget(
  originalTarget: string,
  newOwner: AntoraPageEntry,
  sourceDefaults: { component?: string; module?: string },
): string {
  const [pathPart, anchor] = originalTarget.split('#');
  const segments = pathPart.split(':');
  const anchorSuffix = anchor !== undefined ? `#${anchor}` : '';

  // Bare page reference works only when the new page is in the source's own module.
  if (segments.length === 1) {
    if (sourceDefaults.module === newOwner.module && sourceDefaults.component === newOwner.component) {
      return `${newOwner.path}${anchorSuffix}`;
    }
    // Source can't resolve a bare reference to the new location — widen.
    if (sourceDefaults.component === newOwner.component) {
      return `${newOwner.module}:${newOwner.path}${anchorSuffix}`;
    }
    return `${newOwner.component}:${newOwner.module}:${newOwner.path}${anchorSuffix}`;
  }

  // module:page form works only when source is in the same component.
  if (segments.length === 2) {
    if (sourceDefaults.component === newOwner.component) {
      return `${newOwner.module}:${newOwner.path}${anchorSuffix}`;
    }
    return `${newOwner.component}:${newOwner.module}:${newOwner.path}${anchorSuffix}`;
  }

  // component:module:page is always sufficient.
  return `${newOwner.component}:${newOwner.module}:${newOwner.path}${anchorSuffix}`;
}

/**
 * Rewrites the module portion of an xref target if it points into the
 * module being renamed. Same-component sources may use bare or `module:`
 * forms; cross-component sources use `component:module:` form.
 *
 * `defaults` is the source file's resolution context; we use it to know
 * whether a bare `xref:foo.adoc[]` would have resolved against the renamed
 * module (in which case it stays bare) or some other module (no change).
 */
function rewriteScopeForModuleRename(
  originalTarget: string,
  component: string,
  oldModuleName: string,
  newModuleName: string,
  defaults: { component?: string; module?: string },
): string {
  const [pathPart, anchor] = originalTarget.split('#');
  const segments = pathPart.split(':');
  const anchorSuffix = anchor !== undefined ? `#${anchor}` : '';

  if (segments.length === 1) {
    // Bare form. Source's defaults tell us which module it resolves into.
    // We don't rewrite bare forms — the source page itself is moving along
    // with the module, so its own defaults will follow it.
    return originalTarget;
  }
  if (segments.length === 2) {
    // module:page form. Rewrite when the source's component matches and the
    // module name is the renamed one.
    if (defaults.component === component && segments[0] === oldModuleName) {
      return `${newModuleName}:${segments[1]}${anchorSuffix}`;
    }
    return originalTarget;
  }
  // component:module:page
  if (segments[0] === component && segments[1] === oldModuleName) {
    return `${component}:${newModuleName}:${segments.slice(2).join(':')}${anchorSuffix}`;
  }
  return originalTarget;
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
 * Computes the new file path. Handles two changes simultaneously:
 *   - module change: swaps `/modules/<oldModule>/pages/` for the new module
 *   - page-relative path change: swaps the trailing path segment
 */
function rewriteFilePath(
  originalFilePath: string,
  oldModule: string,
  oldPagePath: string,
  newModule: string,
  newPagePath: string,
): string {
  let result = originalFilePath;

  if (oldModule !== newModule) {
    const oldSegment = `/modules/${oldModule}/`;
    const newSegment = `/modules/${newModule}/`;
    const idx = result.indexOf(oldSegment);
    if (idx !== -1) {
      result = result.slice(0, idx) + newSegment + result.slice(idx + oldSegment.length);
    }
  }

  if (result.endsWith(oldPagePath)) {
    return result.slice(0, result.length - oldPagePath.length) + newPagePath;
  }
  // Fallback: swap just the filename portion when the tail doesn't match
  // (would indicate a stale index entry).
  const lastSlash = result.lastIndexOf('/');
  return `${result.slice(0, lastSlash + 1)}${newPagePath.split('/').pop()}`;
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
