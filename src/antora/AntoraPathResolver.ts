export interface ResolvedXrefTarget {
  component?: string;
  module?: string;
  page: string;
  anchor?: string;
}

export class AntoraPathResolver {
  resolveXrefTarget(rawTarget: string): ResolvedXrefTarget {
    const [pathPart, anchor] = rawTarget.split('#');
    const segments = pathPart.split(':');

    if (segments.length === 1) {
      return { page: segments[0], anchor };
    }

    if (segments.length === 2) {
      return { module: segments[0], page: segments[1], anchor };
    }

    return {
      component: segments[0],
      module: segments[1],
      page: segments.slice(2).join(':'),
      anchor,
    };
  }
}
