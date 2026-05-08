import { describe, expect, it } from 'vitest';

import { lintHeadingHierarchy } from '../../src/diagnostics/HeadingHierarchyLint';

describe('lintHeadingHierarchy', () => {
  it('returns no warnings for monotonic heading depth', () => {
    expect(lintHeadingHierarchy('= A\n\n== B\n\n=== C', 'p.adoc')).toEqual([]);
  });

  it('flags single-level skip', () => {
    const out = lintHeadingHierarchy('= A\n\n=== C', 'p.adoc');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ line: 3, severity: 'warning' });
    expect(out[0].message).toContain('skipped 1 level');
  });

  it('flags multi-level skip with correct count', () => {
    const out = lintHeadingHierarchy('= A\n\n==== D', 'p.adoc');
    expect(out[0].message).toContain('skipped 2 levels');
  });

  it('does not flag the first heading regardless of level', () => {
    expect(lintHeadingHierarchy('=== Starts deep', 'p.adoc')).toEqual([]);
  });

  it('allows promoting back up by any amount', () => {
    expect(lintHeadingHierarchy('= A\n\n== B\n\n=== C\n\n= D', 'p.adoc')).toEqual([]);
  });

  it('ignores non-heading lines', () => {
    expect(lintHeadingHierarchy('paragraph\n\n= Title', 'p.adoc')).toEqual([]);
  });
});
