import { AntoraComponentIndex } from './AntoraComponentIndex';

/**
 * Antora "resource ID" families that prefix targets in include::, image::,
 * and similar macros. Maps to the conventional module subdirectory.
 */
const FAMILY_FOLDERS: Record<string, string> = {
  partial: 'partials',
  example: 'examples',
  attachment: 'attachments',
  image: 'assets/images',
  page: 'pages',
};

const FAMILY_PATTERN = /^([a-z]+)\$/;

/**
 * Resolves an Antora resource ID (e.g. `partial$intro.adoc`,
 * `mymodule:image$logo.png`, `othercomp:mymodule:example$snippet.adoc`) to a
 * concrete vault path. Falls back to a sibling-relative resolution when the
 * target has no resource family prefix.
 */
export class AntoraResourceResolver {
  constructor(private readonly index: AntoraComponentIndex) {}

  resolve(target: string, sourcePath: string): string {
    const trimmed = target.trim();
    const cleaned = trimmed.split('[')[0];

    const sourcePage = this.index.getPageByFilePath(sourcePath);
    const defaultContext = sourcePage
      ? { component: sourcePage.component, module: sourcePage.module }
      : undefined;

    const segments = cleaned.split(':');
    const last = segments[segments.length - 1];
    const familyMatch = last.match(FAMILY_PATTERN);

    if (!familyMatch) {
      return this.resolveSiblingRelative(cleaned, sourcePath);
    }

    const family = familyMatch[1];
    const folder = FAMILY_FOLDERS[family];
    if (!folder) {
      return this.resolveSiblingRelative(cleaned, sourcePath);
    }

    const filename = last.slice(family.length + 1);
    let component = defaultContext?.component;
    let module = defaultContext?.module;

    if (segments.length === 2) {
      module = segments[0];
    } else if (segments.length === 3) {
      component = segments[0];
      module = segments[1];
    }

    if (!component || !module) {
      return this.resolveSiblingRelative(cleaned, sourcePath);
    }

    const componentRoot = this.findComponentRoot(component, sourcePath);
    if (!componentRoot) {
      return this.resolveSiblingRelative(cleaned, sourcePath);
    }

    return `${componentRoot}/modules/${module}/${folder}/${filename}`;
  }

  private resolveSiblingRelative(target: string, sourcePath: string): string {
    if (target.startsWith('/')) {
      return target.replace(/^\//, '');
    }
    const baseFolder = sourcePath.split('/').slice(0, -1).join('/');
    return `${baseFolder}/${target}`.replace(/\/\//g, '/');
  }

  private findComponentRoot(component: string, sourcePath: string): string | undefined {
    // If the source is itself in the requested component, derive the root
    // from its file path so we don't depend on the source page being indexed.
    const sourcePage = this.index.getPageByFilePath(sourcePath);
    if (sourcePage && sourcePage.component === component) {
      const modulesIdx = sourcePath.indexOf('/modules/');
      if (modulesIdx > 0) {
        return sourcePath.slice(0, modulesIdx);
      }
    }
    // Otherwise, find any indexed page in the requested component and
    // back-derive its component root.
    for (const candidate of this.index.getComponents()) {
      if (candidate.name !== component) {
        continue;
      }
      for (const version of candidate.versions.values()) {
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
}

