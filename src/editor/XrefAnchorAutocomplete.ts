import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { EditorContext } from './EditorContext';

const ANCHOR_PATTERN = /xref:([^#\s\]]+)#([^\s\]]*)$/;

/**
 * Suggests anchor names after the user types `xref:foo.adoc#`. The candidate
 * set is the union of:
 *   - the resolved page's own anchors (preferred)
 *   - workspace auxiliary anchors (partials/examples) when the page can't be
 *     resolved or has no anchors of its own
 */
export function createXrefAnchorAutocomplete(index: AntoraComponentIndex, context: EditorContext) {
  const resolver = new AntoraPathResolver();

  return (completion: CompletionContext): CompletionResult | null => {
    if (!context.isAsciiDocActive()) {
      return null;
    }

    const token = completion.matchBefore(ANCHOR_PATTERN);
    if (!token) {
      return null;
    }

    const matches = token.text.match(ANCHOR_PATTERN);
    if (!matches) {
      return null;
    }

    const targetText = matches[1];
    const partial = matches[2];
    const partialStart = token.to - partial.length;

    const candidates = collectCandidates(index, resolver, targetText, context);
    if (candidates.length === 0) {
      return null;
    }

    return {
      from: partialStart,
      options: candidates.map((anchor) => ({ label: anchor, type: 'property' })),
    };
  };
}

function collectCandidates(
  index: AntoraComponentIndex,
  resolver: AntoraPathResolver,
  targetText: string,
  context: EditorContext,
): string[] {
  const resolved = index.resolvePage(resolver.resolveXrefTarget(targetText, context.getDefaults()));
  if (resolved) {
    const anchors = Array.from(resolved.anchors);
    if (anchors.length > 0) {
      return anchors.sort();
    }
  }
  return Array.from(index.getAuxiliaryAnchors()).sort();
}
