import { Diagnostic } from './Diagnostic';

const DESCRIPTION_PATTERN = /^:description:\s*\S/m;
const HEADING_PATTERN = /^=\s+\S/m;

/**
 * Emits one info-severity diagnostic per page that has a level-0 heading but
 * no `:description:` attribute. The description attribute drives both
 * Antora's nav rendering and the meta tags asciidoctor produces — missing it
 * is a quality issue without being technically broken.
 *
 * Pure function; only flags `.adoc` content with a level-0 heading so it
 * doesn't fire on partials, examples, or stub pages with no real content.
 */
export function lintMissingDescription(content: string, filePath: string): Diagnostic[] {
  if (!HEADING_PATTERN.test(content)) {
    return [];
  }
  if (DESCRIPTION_PATTERN.test(content)) {
    return [];
  }
  return [{
    filePath,
    line: 1,
    column: 1,
    severity: 'info',
    message: 'Page has no `:description:` attribute. Consider adding one for nav rendering and SEO.',
  }];
}
