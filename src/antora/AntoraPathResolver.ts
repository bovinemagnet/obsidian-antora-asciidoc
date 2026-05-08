export interface ResolvedXrefTarget {
  component?: string;
  module?: string;
  version?: string;
  page: string;
  anchor?: string;
}

export interface XrefDefaultContext {
  component?: string;
  module?: string;
  version?: string;
}

export class AntoraPathResolver {
  /**
   * Parses an Antora xref target. Recognises the optional `version@` prefix
   * (Antora page-ID convention: `version@component:module:page`). Missing
   * component/module/version segments fall back to the supplied defaults so
   * bare `xref:foo.adoc[]` resolves against the source page's context.
   */
  resolveXrefTarget(rawTarget: string, defaults: XrefDefaultContext = {}): ResolvedXrefTarget {
    const [pathPart, anchor] = rawTarget.split('#');
    let workingPath = pathPart;
    let explicitVersion: string | undefined;

    const versionAt = workingPath.indexOf('@');
    if (versionAt !== -1) {
      explicitVersion = workingPath.slice(0, versionAt);
      workingPath = workingPath.slice(versionAt + 1);
    }

    const version = explicitVersion ?? defaults.version;
    const segments = workingPath.split(':');

    if (segments.length === 1) {
      return {
        component: defaults.component,
        module: defaults.module,
        version,
        page: segments[0],
        anchor,
      };
    }

    if (segments.length === 2) {
      return {
        component: defaults.component,
        module: segments[0],
        version,
        page: segments[1],
        anchor,
      };
    }

    return {
      component: segments[0],
      module: segments[1],
      version,
      page: segments.slice(2).join(':'),
      anchor,
    };
  }
}
