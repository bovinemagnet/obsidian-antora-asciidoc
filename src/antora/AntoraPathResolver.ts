export interface ResolvedXrefTarget {
  component?: string;
  module?: string;
  page: string;
  anchor?: string;
}

export interface XrefDefaultContext {
  component?: string;
  module?: string;
}

export class AntoraPathResolver {
  /**
   * Parses an Antora xref target. When `defaults` is provided, missing
   * component/module segments are filled in from the current page's context
   * so a bare `xref:foo.adoc[]` resolves against the page's own component and
   * module instead of bouncing through the global page-target index.
   */
  resolveXrefTarget(rawTarget: string, defaults: XrefDefaultContext = {}): ResolvedXrefTarget {
    const [pathPart, anchor] = rawTarget.split('#');
    const segments = pathPart.split(':');

    if (segments.length === 1) {
      return {
        component: defaults.component,
        module: defaults.module,
        page: segments[0],
        anchor,
      };
    }

    if (segments.length === 2) {
      return {
        component: defaults.component,
        module: segments[0],
        page: segments[1],
        anchor,
      };
    }

    return {
      component: segments[0],
      module: segments[1],
      page: segments.slice(2).join(':'),
      anchor,
    };
  }
}
