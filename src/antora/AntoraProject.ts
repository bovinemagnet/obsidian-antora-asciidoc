export interface AntoraProject {
  rootPath: string;
  antoraYmlPath: string;
  playbookPaths: string[];
}

export interface AntoraScanResult {
  isAntoraWorkspace: boolean;
  projects: AntoraProject[];
}
