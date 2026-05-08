import { TFile, Vault } from 'obsidian';

import { AsciiDocParser } from '../asciidoc/AsciiDocParser';
import { AntoraComponentIndex, extractAnchors } from './AntoraComponentIndex';
import { AntoraProject, AntoraScanResult } from './AntoraProject';

interface AntoraDescriptor {
  component: string;
  version: string;
  rootPath: string;
}

export class AntoraWorkspaceScanner {
  constructor(
    private readonly vault: Vault,
    private readonly parser: AsciiDocParser,
  ) {}

  async scan(index: AntoraComponentIndex): Promise<AntoraScanResult> {
    index.clear();
    const files = this.vault.getFiles();

    const descriptors = await this.loadDescriptors(files);
    const projects = this.buildProjects(descriptors, files);

    for (const file of files) {
      const descriptor = descriptors.find((candidate) => file.path.startsWith(candidate.rootPath));
      if (!descriptor) {
        continue;
      }

      const module = this.getModuleName(file.path, descriptor.rootPath);
      if (!module) {
        continue;
      }

      const content = await this.vault.cachedRead(file);

      if (file.path.includes('/pages/') && file.extension.match(/adoc|asciidoc/)) {
        const pagePath = file.path.split('/pages/')[1];
        index.upsertPage({
          component: descriptor.component,
          version: descriptor.version,
          module,
          path: pagePath,
          filePath: file.path,
          anchors: extractAnchors(file, content),
        });
      }

      if (file.path.includes('/partials/')) {
        index.addPartial(descriptor.component, descriptor.version, module, file.path.split('/partials/')[1]);
      }
      if (file.path.includes('/examples/')) {
        index.addExample(descriptor.component, descriptor.version, module, file.path.split('/examples/')[1]);
      }
      if (file.path.includes('/assets/images/')) {
        index.addImage(descriptor.component, descriptor.version, module, file.path.split('/assets/images/')[1]);
      }
    }

    return {
      isAntoraWorkspace: projects.length > 0,
      projects,
    };
  }

  private async loadDescriptors(files: TFile[]): Promise<AntoraDescriptor[]> {
    const descriptors: AntoraDescriptor[] = [];

    for (const descriptorFile of files.filter((file) => file.name === 'antora.yml')) {
      const content = await this.vault.cachedRead(descriptorFile);
      const component = this.readYamlField(content, 'name') ?? 'default-component';
      const version = this.readYamlField(content, 'version') ?? 'latest';
      const rootPath = descriptorFile.path.replace(/\/antora\.yml$/, '');
      descriptors.push({ component, version, rootPath });
    }

    return descriptors;
  }

  private buildProjects(descriptors: AntoraDescriptor[], files: TFile[]): AntoraProject[] {
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

  private readYamlField(content: string, field: string): string | undefined {
    const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
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
