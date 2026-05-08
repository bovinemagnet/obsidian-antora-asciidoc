import yaml from 'js-yaml';

import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { FileSource, SourceFile } from '../io/FileSource';
import { AntoraComponentIndex, collectAnchors } from './AntoraComponentIndex';
import { AntoraProject, AntoraScanResult } from './AntoraProject';
import { parseNavigation } from './NavigationParser';

export interface AntoraDescriptor {
  component: string;
  version: string;
  rootPath: string;
  attributes: Record<string, string>;
  /** Workspace paths to nav files declared in antora.yml's `nav:` field. */
  navPaths: string[];
}

const ASCIIDOC_EXTENSIONS = /^(adoc|asciidoc)$/i;

export interface ScannerOptions {
  /** Vault paths whose subtrees are excluded from scanning and indexing. */
  ignorePaths?: string[];
}

export class AntoraWorkspaceScanner {
  private cachedDescriptors: AntoraDescriptor[] = [];
  private ignorePrefixes: string[] = [];

  constructor(
    private readonly source: FileSource,
    // Parser is currently unused inside the scanner but kept to preserve the
    // existing constructor shape and reserve the dependency for richer parsing.
    private readonly _parser: AsciiDocParser,
    options: ScannerOptions = {},
  ) {
    this.setIgnorePaths(options.ignorePaths ?? []);
  }

  /** Updates the ignore-path filter without reconstructing the scanner. */
  setIgnorePaths(paths: string[]): void {
    this.ignorePrefixes = paths
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.endsWith('/') ? p : `${p}/`));
  }

  /** True when the configured ignore filter excludes this file. */
  isIgnored(filePath: string): boolean {
    return this.ignorePrefixes.some((prefix) => filePath === prefix.slice(0, -1) || filePath.startsWith(prefix));
  }

  /** Snapshot of the descriptors discovered by the most recent full scan. */
  getDescriptors(): readonly AntoraDescriptor[] {
    return this.cachedDescriptors;
  }

  async scan(index: AntoraComponentIndex): Promise<AntoraScanResult> {
    index.clear();
    const files = this.source.list().filter((file) => !this.isIgnored(file.path));

    const descriptors = await this.loadDescriptors(files);
    this.cachedDescriptors = descriptors;
    const projects = this.buildProjects(descriptors, files);

    for (const descriptor of descriptors) {
      index.registerDescriptorAttributes(descriptor.rootPath, Object.entries(descriptor.attributes));
    }

    for (const file of files) {
      await this.indexFile(file, descriptors, index);
    }

    return {
      isAntoraWorkspace: projects.length > 0,
      projects,
    };
  }

  /** Index a single file (used by incremental updates). */
  async indexFile(file: SourceFile, descriptors: AntoraDescriptor[], index: AntoraComponentIndex): Promise<void> {
    if (this.isIgnored(file.path)) {
      return;
    }
    const descriptor = descriptors.find((candidate) => file.path.startsWith(`${candidate.rootPath}/`));
    if (!descriptor) {
      return;
    }

    const module = this.getModuleName(file.path, descriptor.rootPath);
    if (!module) {
      return;
    }

    if (file.name === 'nav.adoc' || descriptor.navPaths.includes(file.path)) {
      const content = await this.source.read(file);
      const entries = parseNavigation(content);
      index.registerNavigation(descriptor.rootPath, module, entries);
      // Continue: if the nav file is also under /pages/ we still want it
      // indexed as a page below.
      if (!file.path.includes('/pages/')) {
        return;
      }
    }

    if (file.path.includes('/pages/') && ASCIIDOC_EXTENSIONS.test(file.extension)) {
      const content = await this.source.read(file);
      const pagePath = file.path.split('/pages/')[1];
      index.upsertPage({
        component: descriptor.component,
        version: descriptor.version,
        module,
        path: pagePath,
        filePath: file.path,
        anchors: collectAnchors(content),
      });
      // Page-level :attr-name: declarations are scoped to the page. Only the
      // *names* are remembered globally so diagnostics can recognise them;
      // values are re-extracted at render time from the page's own content.
      index.registerAttributeNames(Object.keys(extractPageAttributes(content)));
      return;
    }

    if (file.path.includes('/partials/')) {
      index.addPartial(descriptor.component, descriptor.version, module, file.path.split('/partials/')[1]);
      if (ASCIIDOC_EXTENSIONS.test(file.extension)) {
        const content = await this.source.read(file);
        index.registerAuxiliaryAnchors(collectAnchors(content));
      }
      return;
    }
    if (file.path.includes('/examples/')) {
      index.addExample(descriptor.component, descriptor.version, module, file.path.split('/examples/')[1]);
      if (ASCIIDOC_EXTENSIONS.test(file.extension)) {
        const content = await this.source.read(file);
        index.registerAuxiliaryAnchors(collectAnchors(content));
      }
      return;
    }
    if (file.path.includes('/assets/images/')) {
      index.addImage(descriptor.component, descriptor.version, module, file.path.split('/assets/images/')[1]);
    }
  }

  async loadDescriptors(files: SourceFile[]): Promise<AntoraDescriptor[]> {
    const descriptors: AntoraDescriptor[] = [];

    for (const descriptorFile of files.filter((file) => file.name === 'antora.yml')) {
      const content = await this.source.read(descriptorFile);
      const parsed = this.safeParse(content);
      const component = stringField(parsed, 'name') ?? 'default-component';
      const version = stringField(parsed, 'version') ?? 'latest';
      const attributes = extractDescriptorAttributes(parsed);
      const rootPath = descriptorFile.path.replace(/\/antora\.yml$/, '');
      const navPaths = extractNavPaths(parsed).map((relative) => `${rootPath}/${relative}`.replace(/\/\//g, '/'));
      descriptors.push({ component, version, rootPath, attributes, navPaths });
    }

    return descriptors;
  }

  private buildProjects(descriptors: AntoraDescriptor[], files: SourceFile[]): AntoraProject[] {
    return descriptors.map((descriptor) => {
      const playbookPaths = files
        .filter((file) => file.name === 'site.yml' || file.name.endsWith('.playbook.yml'))
        .map((file) => file.path);
      return {
        rootPath: descriptor.rootPath,
        antoraYmlPath: `${descriptor.rootPath}/antora.yml`,
        playbookPaths,
      };
    });
  }

  private safeParse(content: string): unknown {
    try {
      return yaml.load(content);
    } catch {
      return null;
    }
  }

  private getModuleName(filePath: string, componentRoot: string): string | undefined {
    const relative = filePath.startsWith(`${componentRoot}/`) ? filePath.slice(componentRoot.length + 1) : filePath;
    const segments = relative.split('/');
    const modulesIndex = segments.indexOf('modules');
    if (modulesIndex === -1 || modulesIndex + 1 >= segments.length) {
      return undefined;
    }
    return segments[modulesIndex + 1];
  }
}

function stringField(parsed: unknown, field: string): string | undefined {
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  const value = (parsed as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function extractNavPaths(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }
  const nav = (parsed as Record<string, unknown>).nav;
  if (!nav) {
    return [];
  }
  if (Array.isArray(nav)) {
    return nav.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof nav === 'string') {
    return [nav];
  }
  return [];
}

function extractDescriptorAttributes(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  const asciidoc = (parsed as Record<string, unknown>).asciidoc;
  if (!asciidoc || typeof asciidoc !== 'object') {
    return {};
  }
  const attributes = (asciidoc as Record<string, unknown>).attributes;
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes as Record<string, unknown>)) {
    result[name] = stringifyAttribute(value);
  }
  return result;
}

function stringifyAttribute(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Lists and nested objects are uncommon in Antora attributes; fall back to
  // a JSON serialisation so callers at least see something deterministic.
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Extracts page-level :name: value declarations from the document header.
 * Stops at the first blank line followed by content, mirroring AsciiDoc's
 * header-vs-body split.
 */
export function extractPageAttributes(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  let inHeader = true;
  for (const line of lines) {
    if (inHeader && line.trim() === '') {
      inHeader = false;
      continue;
    }
    if (!inHeader) {
      // Page attributes can also appear later (rare); keep collecting them
      // greedily so common patterns work.
    }
    const match = line.match(/^:([A-Za-z0-9_-]+)!?:\s*(.*)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}
