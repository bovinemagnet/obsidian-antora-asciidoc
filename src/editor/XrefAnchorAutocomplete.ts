import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { AntoraComponentIndex, collectAnchors } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { EditorContext } from './EditorContext';

// Capture both `xref:foo.adoc#partial` (cross-page) and `xref:#partial`
// (same-page). The first capture group is empty for the same-page case.
const ANCHOR_PATTERN = /xref:([^#\s\]]*)#([^\s\]]*)$/;

/**
 * Suggests anchor names after `xref:…#`. Candidate sources, in order:
 *   - same-page mode (target empty): the active document's own anchors,
 *     extracted live from the buffer so newly-typed anchors appear without
 *     waiting for a reindex
 *   - cross-page mode: the resolved target page's anchors
 *   - fallback: workspace auxiliary anchors (partials/examples)
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

    let candidates: string[];
    if (targetText === '') {
      const documentText = completion.state.doc.toString();
      candidates = Array.from(collectAnchors(documentText)).sort();
    } else {
      candidates = collectCrossPageCandidates(index, resolver, targetText, context);
    }

    if (candidates.length === 0) {
      return null;
    }

    return {
      from: partialStart,
      options: candidates.map((anchor) => ({ label: anchor, type: 'property' })),
    };
  };
}

function collectCrossPageCandidates(
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
