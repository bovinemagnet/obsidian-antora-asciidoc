import { describe, expect, it } from 'vitest';

import { AntoraComponentIndex } from '../../src/antora/AntoraComponentIndex';
import { AntoraImagePicker, buildImageTargetFor, ImagePickerEntry } from '../../src/views/AntoraImagePicker';

function makeIndex(): AntoraComponentIndex {
  const index = new AntoraComponentIndex();
  index.addImage('docs', '1.0', 'ROOT', 'logo.png');
  index.addImage('docs', '1.0', 'ROOT', 'banner.svg');
  index.addImage('docs', '1.0', 'api', 'diagram.png');
  return index;
}

describe('AntoraImagePicker', () => {
  it('lists every indexed image with a deterministic order', () => {
    const items = new AntoraImagePicker({} as never, makeIndex(), () => {}).getItems();
    const labels = items.map((i) => i.label);
    expect(labels).toHaveLength(3);
    expect(labels).toContain('docs:ROOT:banner.svg');
    expect(labels).toContain('docs:ROOT:logo.png');
    expect(labels).toContain('docs:api:diagram.png');
    // Sort should be stable across runs (locale-aware compare).
    const second = new AntoraImagePicker({} as never, makeIndex(), () => {}).getItems().map((i) => i.label);
    expect(second).toEqual(labels);
  });
});

describe('buildImageTargetFor', () => {
  const entry: ImagePickerEntry = { filename: 'logo.png', component: 'docs', module: 'ROOT', label: 'docs:ROOT:logo.png' };

  it('emits the bare filename when source matches both component and module', () => {
    expect(buildImageTargetFor(entry, { component: 'docs', module: 'ROOT' })).toBe('logo.png');
  });

  it('emits module:image$filename when same component, different module', () => {
    expect(buildImageTargetFor(entry, { component: 'docs', module: 'api' })).toBe('ROOT:image$logo.png');
  });

  it('emits component:module:image$filename across components', () => {
    expect(buildImageTargetFor(entry, { component: 'other', module: 'ROOT' })).toBe('docs:ROOT:image$logo.png');
  });
});
