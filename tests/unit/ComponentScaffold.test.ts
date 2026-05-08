import { describe, expect, it } from 'vitest';

import { buildComponentScaffold } from '../../src/asciidoc/ComponentScaffold';

describe('buildComponentScaffold', () => {
  it('creates antora.yml with the given fields', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'docs', version: '1.0' });
    const yml = out.get('docs/antora.yml');
    expect(yml).toContain('name: docs');
    expect(yml).toContain("version: '1.0'");
    expect(yml).toContain('nav:');
  });

  it('uses a Title-Cased default title when none provided', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'my-product-docs', version: '1.0' });
    expect(out.get('docs/antora.yml')).toContain('title: My Product Docs');
  });

  it('honours an explicit title override', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'docs', version: '1.0', title: 'Acme Documentation' });
    expect(out.get('docs/antora.yml')).toContain('title: Acme Documentation');
  });

  it('produces a nav.adoc with an Overview entry pointing at index.adoc', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'docs', version: '1.0' });
    expect(out.get('docs/modules/ROOT/nav.adoc')).toContain('xref:index.adoc[Overview]');
  });

  it('produces an index.adoc skeleton', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'docs', version: '1.0' });
    const index = out.get('docs/modules/ROOT/pages/index.adoc');
    expect(index).toMatch(/^= /);
    expect(index).toContain(':description:');
  });

  it('includes .gitkeep placeholders for partials/examples/assets folders', () => {
    const out = buildComponentScaffold({ vaultRoot: 'docs', name: 'docs', version: '1.0' });
    expect(out.has('docs/modules/ROOT/partials/.gitkeep')).toBe(true);
    expect(out.has('docs/modules/ROOT/examples/.gitkeep')).toBe(true);
    expect(out.has('docs/modules/ROOT/assets/images/.gitkeep')).toBe(true);
  });

  it('honours a vaultRoot different from the component name', () => {
    const out = buildComponentScaffold({ vaultRoot: 'sites/api', name: 'api', version: '1.0' });
    expect(out.has('sites/api/antora.yml')).toBe(true);
  });
});
