import { describe, expect, it } from 'vitest';

import { isAsciiDocPath } from '../../src/util/FileUtils';

describe('isAsciiDocPath', () => {
  it.each([
    ['notes/page.adoc', true],
    ['notes/page.asciidoc', true],
    ['notes/page.md', false],
    ['notes/page.txt', false],
    ['', false],
  ])('isAsciiDocPath(%j) === %j', (input, expected) => {
    expect(isAsciiDocPath(input)).toBe(expected);
  });
});
