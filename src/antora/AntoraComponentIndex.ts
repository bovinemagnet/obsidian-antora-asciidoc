import { TFile } from 'obsidian';

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
  private pagesByPath = new Map<string, AntoraPageEntry>();

  clear(): void {
    this.components.clear();
    this.pagesByPath.clear();
  }

  upsertPage(entry: AntoraPageEntry): void {
    const component = this.getOrCreateComponent(entry.component);
    const version = this.getOrCreateVersion(component, entry.version);
    const module = this.getOrCreateModule(version, entry.module);

    module.pages.push(entry);
    this.pagesByPath.set(this.normalizedPageTarget(entry.module, entry.path), entry);
    this.pagesByPath.set(this.normalizedPageTarget(undefined, entry.path), entry);
  }

  addPartial(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    module.partials.push(path);
  }

  addExample(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    module.examples.push(path);
  }

  addImage(component: string, version: string, moduleName: string, path: string): void {
    const module = this.getOrCreateModule(this.getOrCreateVersion(this.getOrCreateComponent(component), version), moduleName);
    module.images.push(path);
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

  resolvePage(target: { component?: string; module?: string; page: string }): AntoraPageEntry | undefined {
    if (target.component && target.module) {
      const key = `${target.component}:${target.module}:${target.page}`;
      for (const page of this.pagesByPath.values()) {
        if (`${page.component}:${page.module}:${page.path}` === key) {
          return page;
        }
      }
      return undefined;
    }

    return this.pagesByPath.get(this.normalizedPageTarget(target.module, target.page));
  }

  private normalizedPageTarget(moduleName: string | undefined, path: string): string {
    return moduleName ? `${moduleName}:${path}` : path;
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

  const anchors = new Set<string>();
  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    anchors.add(match[1]);
  }
  for (const match of content.matchAll(/\[#([^\]]+)\]/g)) {
    anchors.add(match[1]);
  }
  return anchors;
}
