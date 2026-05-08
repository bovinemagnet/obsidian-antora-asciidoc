import { describe, expect, it } from 'vitest';

import { detectAnchorAt } from '../../src/main';

describe('detectAnchorAt', () => {
  it('detects [[id]] form', () => {
    const line = 'Intro [[my-anchor]] follows.';
    expect(detectAnchorAt(line, 10)).toBe('my-anchor');
  });

  it('detects [#id] form', () => {
    const line = '[#another-anchor]';
    expect(detectAnchorAt(line, 5)).toBe('another-anchor');
  });

  it('detects [id="x"] form', () => {
    const line = '[id="quoted"]';
    expect(detectAnchorAt(line, 8)).toBe('quoted');
  });

  it('returns null when cursor is elsewhere', () => {
    const line = 'No anchors here at all.';
    expect(detectAnchorAt(line, 5)).toBeNull();
  });

  it('strips reftext from [[id,reftext]]', () => {
    const line = '[[my-id,Some Reference]]';
    expect(detectAnchorAt(line, 3)).toBe('my-id');
  });
});
