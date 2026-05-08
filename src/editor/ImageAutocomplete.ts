import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { EditorContext } from './EditorContext';

// Both block (`image::`) and inline (`image:`) macros up to the opening `[`.
const IMAGE_PATTERN = /image::?([^[\s\]]*)$/;

/**
 * Suggests image targets after `image:` or `image::`. Sources, in order:
 *   1. images in the current page's own module (bare filename)
 *   2. images in other modules of the same component (`module:image$file`)
 *   3. images in other components (`component:module:image$file`)
 */
export function createImageAutocomplete(index: AntoraComponentIndex, context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const token = completion.matchBefore(IMAGE_PATTERN);
    if (!token) {
      return null;
    }
    const matches = token.text.match(IMAGE_PATTERN);
    if (!matches) {
      return null;
    }
    const partial = matches[1];
    const partialStart = token.to - partial.length;

    const defaults = context.getDefaults();
    const candidates = collectImageCandidates(index, defaults);
    if (candidates.length === 0) {
      return null;
    }

    return {
      from: partialStart,
      options: candidates.map((candidate) => ({
        label: candidate.label,
        detail: candidate.scope,
        type: 'file',
        apply: `${candidate.label}[]`,
      })),
    };
  };
}

interface ImageCandidate {
  label: string;
  scope: string;
}

function collectImageCandidates(
  index: AntoraComponentIndex,
  defaults: { component?: string; module?: string },
): ImageCandidate[] {
  const result: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const component of index.getComponents()) {
    for (const version of component.versions.values()) {
      for (const module of version.modules.values()) {
        for (const image of module.images) {
          const sameModule = component.name === defaults.component && module.name === defaults.module;
          const sameComponent = component.name === defaults.component;
          let label: string;
          if (sameModule) {
            label = image;
          } else if (sameComponent) {
            label = `${module.name}:image$${image}`;
          } else {
            label = `${component.name}:${module.name}:image$${image}`;
          }
          if (seen.has(label)) {
            continue;
          }
          seen.add(label);
          result.push({ label, scope: `${component.name}/${module.name}` });
        }
      }
    }
  }
  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
}
