import { TFile } from 'obsidian';

import { NavigationEntry } from './NavigationParser';

export interface AntoraPageEntry {
  component: string;
  version: string;
  module: string;
  path: string;
  filePath: string;
  anchors: Set<string>;
}

export interface AntoraAssetGroup {
  pages: AntoraPageEntry[];
  partials: string[];
  examples: string[];
  images: string[];
}

export interface AntoraModuleEntry extends AntoraAssetGroup {
  name: string;
}

export interface AntoraVersionEntry {
  version: string;
  modules: Map<string, AntoraModuleEntry>;
}

export interface AntoraComponentEntry {
  name: string;
  versions: Map<string, AntoraVersionEntry>;
}

export class AntoraComponentIndex {
  private components = new Map<string, AntoraComponentEntry>();
  private pagesByPath = new Map<string, AntoraPageEntry[]>();
  private pagesByFilePath = new Map<string, AntoraPageEntry>();
  /**
   * Per-component attribute maps keyed by descriptor root path. Used at render
   * time to build the merged attribute scope for a given page.
   */
  private descriptorAttributes = new Map<string, Map<string, string>>();
  /**
   * Anchors discovered in non-page sources (partials, examples). Pages can
   * legitimately reference these via include directives; without this set the
   * xref validator would emit false-positive "missing anchor" errors.
   */
  private auxiliaryAnchors = new Set<string>();
  /**
   * Parsed navigation trees keyed by `<componentRoot>::<moduleName>`. A module
   * may have multiple nav files (rare); they are concatenated in the order
   * they were registered.
   */
  private navigation = new Map<string, NavigationEntry[]>();
  /**
   * Names of every attribute defined anywhere in the workspace (descriptors
   * AND page-level declarations). Used by diagnostics' "is this attribute
   * known" check; values are not tracked here because page-level values are
   * intentionally page-scoped.
   */
  private knownAttributeNames = new Set<string>();

  clear(): void {
    this.components.clear();
    this.pagesByPath.clear();
    this.pagesByFilePath.clear();
    this.descriptorAttributes.clear();
    this.knownAttributeNames.clear();
    this.auxiliaryAnchors.clear();
    this.navigation.clear();
  }

  /** Stores the parsed nav tree for a given component/module. */
  registerNavigation(componentRoot: string, moduleName: string, entries: NavigationEntry[]): void {
    const key = `${componentRoot}::${moduleName}`;
    const existing = this.navigation.get(key) ?? [];
    this.navigation.set(key, [...existing, ...entries]);
  }

  /** Returns the nav tree for a module, or an empty array when none exists. */
  getNavigation(componentRoot: string, moduleName: string): NavigationEntry[] {
    return this.navigation.get(`${componentRoot}::${moduleName}`) ?? [];
  }

  /**
   * Records anchors discovered outside of page files (typically inside
   * partials or examples). Used as a fallback for xref anchor validation so
   * pages that include these auxiliary files don't trigger false negatives.
   */
  registerAuxiliaryAnchors(anchors: Iterable<string>): void {
    for (const anchor of anchors) {
      this.auxiliaryAnchors.add(anchor);
    }
  }

  hasAuxiliaryAnchor(anchor: string): boolean {
    return this.auxiliaryAnchors.has(anchor);
  }

  getAuxiliaryAnchors(): ReadonlySet<string> {
    return this.auxiliaryAnchors;
  }

  /**
   * Register descriptor-level (component) attributes. Stored against a root
   * path so a page in a different component does not see them.
   */
  registerDescriptorAttributes(rootPath: string, values: Iterable<readonly [string, string]>): void {
    let bucket = this.descriptorAttributes.get(rootPath);
    if (!bucket) {
      bucket = new Map();
      this.descriptorAttributes.set(rootPath, bucket);
    }
    for (const [name, value] of values) {
      bucket.set(name, value);
      this.knownAttributeNames.add(name);
    }
  }

  /** Mark attribute names as known (e.g. discovered at the page level). */
  registerAttributeNames(names: Iterable<string>): void {
    for (const name of names) {
      this.knownAttributeNames.add(name);
    }
  }

  hasAttribute(name: string): boolean {
    return this.knownAttributeNames.has(name);
  }

  getKnownAttributeNames(): ReadonlySet<string> {
    return this.knownAttributeNames;
  }

  /**
   * Returns the merged descriptor attributes for the descriptor that owns the
   * given file path. Returns an empty map when the path is outside every
   * registered descriptor — we deliberately do not union all descriptors
   * because that would leak attribute values across components.
   */
  getDescriptorAttributesFor(filePath: string): Map<string, string> {
    const owner = this.findOwningRootPath(filePath);
    if (owner) {
      return new Map(this.descriptorAttributes.get(owner));
    }
    return new Map();
  }

  private findOwningRootPath(filePath: string): string | undefined {
    let best: string | undefined;
    for (const root of this.descriptorAttributes.keys()) {
      if (filePath.startsWith(`${root}/`) && (!best || root.length > best.length)) {
        best = root;
      }
    }
    return best;
  }

  removePagesUnder(filePath: string): void {
    for (const component of this.components.values()) {
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          module.pages = module.pages.filter((page) => page.filePath !== filePath);
          module.partials = module.partials.filter((path) => !filePath.endsWith(`/partials/${path}`));
          module.examples = module.examples.filter((path) => !filePath.endsWith(`/examples/${path}`));
          module.images = module.images.filter((path) => !filePath.endsWith(`/assets/images/${path}`));
        }
      }
    }
    for (const [key, entries] of this.pagesByPath) {
      const filtered = entries.filter((entry) => entry.filePath !== filePath);
      if (filtered.length === 0) {
        this.pagesByPath.delete(key);
      } else {
        this.pagesByPath.set(key, filtered);
      }
    }
    this.pagesByFilePath.delete(filePath);
  }

  upsertPage(entry: AntoraPageEntry): void {
    this.removePagesUnder(entry.filePath);
    const component = this.getOrCreateComponent(entry.component);
    const version = this.getOrCreateVersion(component, entry.version);
    const module = this.getOrCreateModule(version, entry.module);

    module.pages.push(entry);
    this.pushPage(this.normalizedPageTarget(entry.component, entry.module, entry.path), entry);
    this.pushPage(this.normalizedPageTarget(undefined, entry.module, entry.path), entry);
    this.pushPage(this.normalizedPageTarget(undefined, undefined, entry.path), entry);
    this.pagesByFilePath.set(entry.filePath, entry);
  }

  /** Reverse lookup: find the page entry (component/module/path) by file path. */
  getPageByFilePath(filePath: string): AntoraPageEntry | undefined {
    return this.pagesByFilePath.get(filePath);
  }

  /**
   * Derives the Antora component + module context for an arbitrary file path
   * (page, partial, example, nav.adoc, etc.) by walking registered descriptor
   * roots and parsing the `modules/<module>/` segment from the path. Returns
   * undefined when the path doesn't sit under any indexed descriptor.
   *
   * Used by the refactor service so xrefs in nav.adoc files (which aren't
   * indexed as pages) still get rewritten with the right module context.
   */
  getComponentContextForPath(filePath: string): { component: string; module: string; rootPath: string } | undefined {
    const owner = this.findOwningRootPath(filePath);
    if (!owner) {
      return undefined;
    }
    const componentName = this.findComponentForRoot(owner);
    if (!componentName) {
      return undefined;
    }
    const tail = filePath.startsWith(`${owner}/`) ? filePath.slice(owner.length + 1) : filePath;
    const segments = tail.split('/');
    const modulesIdx = segments.indexOf('modules');
    if (modulesIdx === -1 || modulesIdx + 1 >= segments.length) {
      return undefined;
    }
    return { component: componentName, module: segments[modulesIdx + 1], rootPath: owner };
  }

  private findComponentForRoot(rootPath: string): string | undefined {
    for (const component of this.components.values()) {
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          for (const page of module.pages) {
            if (page.filePath.startsWith(`${rootPath}/`)) {
              return component.name;
            }
          }
        }
      }
    }
    return undefined;
  }

  addPartial(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    if (!module.partials.includes(path)) {
      module.partials.push(path);
    }
  }

  addExample(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    if (!module.examples.includes(path)) {
      module.examples.push(path);
    }
  }

  addImage(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    if (!module.images.includes(path)) {
      module.images.push(path);
    }
  }

  listPageTargets(): string[] {
    const targets = new Set<string>();
    for (const component of this.components.values()) {
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          for (const page of module.pages) {
            targets.add(page.path);
            targets.add(`${module.name}:${page.path}`);
            targets.add(`${component.name}:${module.name}:${page.path}`);
          }
        }
      }
    }

    return [...targets].sort();
  }

  getComponents(): AntoraComponentEntry[] {
    return [...this.components.values()];
  }

  resolvePage(target: { component?: string; module?: string; version?: string; page: string }): AntoraPageEntry | undefined {
    const candidates = this.pagesByPath.get(this.normalizedPageTarget(target.component, target.module, target.page));
    if (!candidates || candidates.length === 0) {
      return undefined;
    }
    // Explicit version → exact match required.
    if (target.version) {
      return candidates.find((entry) => entry.version === target.version);
    }
    // Single candidate → no choice to make.
    if (candidates.length === 1) {
      return candidates[0];
    }
    // Multiple versions exist for the same target. Pick the highest version
    // by the conventional Antora ordering (numeric where possible, lexicographic otherwise).
    return [...candidates].sort(compareVersionsDescending)[0];
  }

  private normalizedPageTarget(componentName: string | undefined, moduleName: string | undefined, path: string): string {
    if (componentName && moduleName) {
      return `${componentName}:${moduleName}:${path}`;
    }
    if (moduleName) {
      return `${moduleName}:${path}`;
    }
    return path;
  }

  private pushPage(key: string, entry: AntoraPageEntry): void {
    const entries = this.pagesByPath.get(key) ?? [];
    entries.push(entry);
    this.pagesByPath.set(key, entries);
  }

  private getOrCreateComponent(name: string): AntoraComponentEntry {
    let component = this.components.get(name);
    if (!component) {
      component = { name, versions: new Map() };
      this.components.set(name, component);
    }
    return component;
  }

  private getOrCreateVersion(component: AntoraComponentEntry, versionName: string): AntoraVersionEntry {
    let version = component.versions.get(versionName);
    if (!version) {
      version = { version: versionName, modules: new Map() };
      component.versions.set(versionName, version);
    }
    return version;
  }

  private getOrCreateModule(version: AntoraVersionEntry, moduleName: string): AntoraModuleEntry {
    let module = version.modules.get(moduleName);
    if (!module) {
      module = { name: moduleName, pages: [], partials: [], examples: [], images: [] };
      version.modules.set(moduleName, module);
    }
    return module;
  }
}

export function extractAnchors(file: TFile, content: string): AntoraPageEntry['anchors'] {
  if (!file.extension.match(/adoc|asciidoc/)) {
    return new Set();
  }
  return collectAnchors(content);
}

export interface AnchorOptions {
  /** Override for the AsciiDoc :idprefix: attribute. Default `_`. */
  idprefix?: string;
  /** Override for the AsciiDoc :idseparator: attribute. Default `_`. */
  idseparator?: string;
}

export function collectAnchors(content: string, options: AnchorOptions = {}): Set<string> {
  const docOverrides = readDocumentIdAttributes(content);
  const idprefix = options.idprefix ?? docOverrides.idprefix ?? '_';
  const idseparator = options.idseparator ?? docOverrides.idseparator ?? '_';

  const anchors = new Set<string>();
  for (const match of content.matchAll(/\[\[([^\],]+)(?:,[^\]]*)?\]\]/g)) {
    anchors.add(match[1].trim());
  }
  for (const match of content.matchAll(/\[#([^\],]+)(?:,[^\]]*)?\]/g)) {
    anchors.add(match[1].trim());
  }
  for (const match of content.matchAll(/\[id=["']([^"']+)["'][^\]]*\]/g)) {
    anchors.add(match[1]);
  }
  for (const match of content.matchAll(/^={1,6}\s+(.+?)\s*$/gm)) {
    const generated = generateSectionId(match[1], idprefix, idseparator);
    if (generated) {
      anchors.add(generated);
    }
  }
  return anchors;
}

/**
 * Mirrors Asciidoctor's default section ID generation:
 *   1. Lowercase
 *   2. Strip inline formatting markers and attribute references
 *   3. Replace runs of non-word characters with the separator
 *   4. Collapse repeated separators and trim them from the ends
 *   5. Prepend the configured idprefix
 *
 * Returns an empty string when nothing usable remains (e.g. a heading made of
 * only punctuation), in which case the caller should skip the anchor entirely.
 */
export function generateSectionId(heading: string, idprefix: string, idseparator: string): string {
  const cleaned = heading
    .replace(/[`*_~]/g, '')
    .replace(/\{[^}]+}/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  const sepEscaped = escapeForRegex(idseparator);
  const segmentChar = idseparator || '_';

  let slug = cleaned.replace(/[^a-z0-9]+/g, segmentChar);
  if (idseparator) {
    slug = slug.replace(new RegExp(`${sepEscaped}+`, 'g'), idseparator);
    slug = slug.replace(new RegExp(`^${sepEscaped}+|${sepEscaped}+$`, 'g'), '');
  } else {
    slug = slug.replace(/_+/g, '');
  }

  if (!slug) {
    return '';
  }

  return `${idprefix}${slug}`;
}

function readDocumentIdAttributes(content: string): { idprefix?: string; idseparator?: string } {
  const result: { idprefix?: string; idseparator?: string } = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^:(idprefix|idseparator)!?:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, name, value] = match;
    if (name === 'idprefix') {
      result.idprefix = value;
    } else if (name === 'idseparator') {
      result.idseparator = value;
    }
  }
  return result;
}

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compares two version strings for "highest first" sorting. Numeric segments
 * sort numerically (so 10.0 > 2.0); strings sort lexicographically.
 * `master`/`HEAD` (snapshot conventions) are treated as the highest possible
 * version so they win against any tagged version.
 */
export function compareVersionsDescending(a: AntoraPageEntry, b: AntoraPageEntry): number {
  return compareVersionStrings(b.version, a.version);
}

const SNAPSHOT_VERSIONS = new Set(['master', 'main', 'head', 'snapshot']);

function compareVersionStrings(a: string, b: string): number {
  if (a === b) return 0;
  const aSnap = SNAPSHOT_VERSIONS.has(a.toLowerCase());
  const bSnap = SNAPSHOT_VERSIONS.has(b.toLowerCase());
  if (aSnap && !bSnap) return 1;
  if (!aSnap && bSnap) return -1;

  const aParts = a.split(/[.\-_]/);
  const bParts = b.split(/[.\-_]/);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else if (aPart !== bPart) {
      return aPart < bPart ? -1 : 1;
    }
  }
  return 0;
}
