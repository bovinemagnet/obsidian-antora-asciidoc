import { AntoraComponentIndex } from './AntoraComponentIndex';
import { NavigationEntry } from './NavigationParser';

export interface NavExportEntry {
  label: string;
  target?: string;
  children: NavExportEntry[];
}

export interface NavExportModule {
  module: string;
  entries: NavExportEntry[];
}

export interface NavExportComponent {
  component: string;
  rootPath: string;
  modules: NavExportModule[];
}

export interface NavExportDocument {
  generatedAt: string;
  components: NavExportComponent[];
}

/**
 * Builds a JSON-serialisable snapshot of every parsed navigation tree in the
 * index. Each module's nav entries are deep-cloned so the result is
 * independent of the index's internal mutable storage.
 */
export function buildNavigationExport(index: AntoraComponentIndex): NavExportDocument {
  const components: NavExportComponent[] = [];
  for (const component of index.getComponents()) {
    const sample = sampleFilePath(component);
    const rootPath = sample ? deriveRoot(sample) : component.name;
    const modules: NavExportModule[] = [];
    for (const version of component.versions.values()) {
      for (const moduleName of version.modules.keys()) {
        const tree = index.getNavigation(rootPath, moduleName);
        if (tree.length === 0) {
          continue;
        }
        modules.push({ module: moduleName, entries: clone(tree) });
      }
    }
    if (modules.length > 0) {
      components.push({ component: component.name, rootPath, modules });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    components,
  };
}

function clone(entries: NavigationEntry[]): NavExportEntry[] {
  return entries.map((entry) => ({
    label: entry.label,
    target: entry.target,
    children: clone(entry.children),
  }));
}

function sampleFilePath(component: ReturnType<AntoraComponentIndex['getComponents']>[number]): string | undefined {
  for (const version of component.versions.values()) {
    for (const module of version.modules.values()) {
      for (const page of module.pages) {
        return page.filePath;
      }
    }
  }
  return undefined;
}

function deriveRoot(samplePath: string): string {
  const idx = samplePath.indexOf('/modules/');
  return idx > 0 ? samplePath.slice(0, idx) : samplePath;
}
