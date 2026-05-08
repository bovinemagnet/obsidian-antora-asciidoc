/**
 * Page and partial templates inserted by the snippet commands. Kept as pure
 * functions so they're trivially testable and don't depend on the active
 * editor or vault state.
 */

export interface PageTemplateContext {
  title?: string;
  description?: string;
  author?: string;
}

export function buildPageTemplate(ctx: PageTemplateContext = {}): string {
  const title = ctx.title ?? 'Page Title';
  const description = ctx.description ?? 'Short summary of what this page covers.';
  const author = ctx.author ?? 'Paul Snow';
  return [
    `= ${title}`,
    `:description: ${description}`,
    `:author: ${author}`,
    ':page-aliases:',
    '',
    'Intro paragraph.',
    '',
    '== Section title',
    '',
    'Section body.',
    '',
  ].join('\n');
}

export function buildPartialTemplate(ctx: { name?: string } = {}): string {
  const name = ctx.name ?? 'partial-name';
  return [
    `// Partial: ${name}`,
    '// Reuse this snippet via include::partial$' + name + '.adoc[].',
    '',
    'Reusable content goes here.',
    '',
  ].join('\n');
}
