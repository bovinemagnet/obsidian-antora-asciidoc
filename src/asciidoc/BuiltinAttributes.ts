/**
 * Attribute names that are always considered known. Combines AsciiDoc core
 * built-ins with the Antora-specific page-* and site-* attributes that show
 * up in nearly every documentation site.
 */
export const BUILTIN_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set([
  // AsciiDoc built-ins
  'docname', 'docfile', 'docdir', 'docfilesuffix', 'doctitle',
  'imagesdir', 'partialsdir', 'examplesdir', 'attachmentsdir',
  // Antora built-ins
  'page-component-name', 'page-component-version', 'page-component-display-version',
  'page-version', 'page-module', 'page-relative', 'page-relative-src-path',
  'page-component-title', 'site-url', 'site-title',
]);
