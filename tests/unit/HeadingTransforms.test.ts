import { describe, expect, it } from 'vitest';

import { demoteHeading, generateAnchorId, generatePageSlug, promoteHeading } from '../../src/asciidoc/HeadingTransforms';

describe('promoteHeading', () => {
  it('removes one = from a heading line', () => {
    expect(promoteHeading('== Section')).toBe('= Section');
    expect(promoteHeading('==== Deep')).toBe('=== Deep');
  });

  it('clamps at level 1', () => {
    expect(promoteHeading('= Title')).toBe('= Title');
  });

  it('preserves whitespace and trailing content', () => {
    expect(promoteHeading('==   Spaced   ')).toBe('=   Spaced   ');
  });

  it('returns input unchanged when not a heading', () => {
    expect(promoteHeading('Just a paragraph.')).toBe('Just a paragraph.');
    expect(promoteHeading('= no space breaks the regex')).toBe('= no space breaks the regex');
  });
});

describe('demoteHeading', () => {
  it('adds one = to a heading line', () => {
    expect(demoteHeading('= Title')).toBe('== Title');
    expect(demoteHeading('=== Section')).toBe('==== Section');
  });

  it('clamps at level 6', () => {
    expect(demoteHeading('====== Deepest')).toBe('====== Deepest');
  });

  it('returns input unchanged when not a heading', () => {
    expect(demoteHeading('Plain text.')).toBe('Plain text.');
  });
});

describe('generateAnchorId', () => {
  it('lowercases and kebab-cases', () => {
    expect(generateAnchorId('Getting Started')).toBe('getting-started');
  });

  it('strips punctuation and collapses runs', () => {
    expect(generateAnchorId('!!Hello, World!!')).toBe('hello-world');
  });

  it('strips inline formatting markers', () => {
    expect(generateAnchorId('*Bold* `code`')).toBe('bold-code');
  });

  it('returns empty string for unusable input', () => {
    expect(generateAnchorId('!!!')).toBe('');
    expect(generateAnchorId('   ')).toBe('');
  });

  it('handles digits inline', () => {
    expect(generateAnchorId('API v2.0')).toBe('api-v2-0');
  });
});

describe('generatePageSlug', () => {
  it('produces a kebab-case .adoc filename', () => {
    expect(generatePageSlug('Getting Started')).toBe('getting-started.adoc');
  });

  it('strips an existing .adoc suffix before slugifying', () => {
    expect(generatePageSlug('Getting Started.adoc')).toBe('getting-started.adoc');
  });

  it('handles .asciidoc suffix too', () => {
    expect(generatePageSlug('My Page.asciidoc')).toBe('my-page.adoc');
  });

  it('returns empty for unusable input', () => {
    expect(generatePageSlug('')).toBe('');
    expect(generatePageSlug('!!!')).toBe('');
  });
});
