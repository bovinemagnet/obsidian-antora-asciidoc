import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { EditorContext } from './EditorContext';

const INCLUDE_PATTERN = /include::([^[\s\]]*)$/;

/**
 * Suggests partial$ and example$ targets after `include::`. Sources, in
 * order:
 *   1. partials/examples in the current page's own module (bare resource ID)
 *   2. partials/examples in other modules of the same component
 *   3. partials/examples in other components
 */
export function createIncludeAutocomplete(index: AntoraComponentIndex, context: EditorContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const token = completion.matchBefore(INCLUDE_PATTERN);
    if (!token) {
      return null;
    }
    const matches = token.text.match(INCLUDE_PATTERN);
    if (!matches) {
      return null;
    }
    const partial = matches[1];
    const partialStart = token.to - partial.length;

    const defaults = context.getDefaults();
    const candidates = collectIncludeCandidates(index, defaults);
    if (candidates.length === 0) {
      return null;
    }

    return {
      from: partialStart,
      options: candidates.map((candidate) => ({
        label: candidate.label,
        detail: candidate.scope,
        type: candidate.kind === 'partial' ? 'function' : 'method',
        apply: `${candidate.label}[]`,
      })),
    };
  };
}

interface IncludeCandidate {
  label: string;
  scope: string;
  kind: 'partial' | 'example';
}

function collectIncludeCandidates(
  index: AntoraComponentIndex,
  defaults: { component?: string; module?: string },
): IncludeCandidate[] {
  const result: IncludeCandidate[] = [];
  const seen = new Set<string>();

  for (const component of index.getComponents()) {
    for (const version of component.versions.values()) {
      for (const module of version.modules.values()) {
        const sameModule = component.name === defaults.component && module.name === defaults.module;
        const sameComponent = component.name === defaults.component;

        for (const partialPath of module.partials) {
          result.push(
            buildCandidate('partial', partialPath, component.name, module.name, sameModule, sameComponent),
          );
        }
        for (const examplePath of module.examples) {
          result.push(
            buildCandidate('example', examplePath, component.name, module.name, sameModule, sameComponent),
          );
        }
      }
    }
  }

  return dedupe(result, seen).sort((a, b) => a.label.localeCompare(b.label));
}

function buildCandidate(
  kind: 'partial' | 'example',
  path: string,
  componentName: string,
  moduleName: string,
  sameModule: boolean,
  sameComponent: boolean,
): IncludeCandidate {
  const family = `${kind}$`;
  let label: string;
  if (sameModule) {
    label = `${family}${path}`;
  } else if (sameComponent) {
    label = `${moduleName}:${family}${path}`;
  } else {
    label = `${componentName}:${moduleName}:${family}${path}`;
  }
  return { label, scope: `${componentName}/${moduleName}`, kind };
}

function dedupe(candidates: IncludeCandidate[], seen: Set<string>): IncludeCandidate[] {
  const out: IncludeCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.label)) {
      continue;
    }
    seen.add(candidate.label);
    out.push(candidate);
  }
  return out;
}
