/**
 * Pure scaffold-builder for "new Antora component" command. Returns a map of
 * vault path → file content for the four files that make up a minimal,
 * working Antora component (descriptor, nav, index page, README-style
 * placeholder partial).
 */
export interface ComponentScaffoldOptions {
  /** Root folder name in the vault (typically the same as the component name). */
  vaultRoot: string;
  /** Antora component name. */
  name: string;
  /** Antora component version (e.g. `1.0`, `master`). */
  version: string;
  /** Optional title shown in the docs site. Defaults to a Title-Case of name. */
  title?: string;
}

export function buildComponentScaffold(options: ComponentScaffoldOptions): Map<string, string> {
  const title = options.title ?? defaultTitle(options.name);
  const out = new Map<string, string>();

  out.set(`${options.vaultRoot}/antora.yml`, [
    `name: ${options.name}`,
    `title: ${title}`,
    `version: '${options.version}'`,
    'nav:',
    '  - modules/ROOT/nav.adoc',
    '',
  ].join('\n'));

  out.set(`${options.vaultRoot}/modules/ROOT/nav.adoc`,
    '* xref:index.adoc[Overview]\n');

  out.set(`${options.vaultRoot}/modules/ROOT/pages/index.adoc`, [
    `= ${title}`,
    `:description: Overview of the ${title} component.`,
    '',
    'Welcome to the documentation.',
    '',
    '== Section title',
    '',
    'Section body.',
    '',
  ].join('\n'));

  out.set(`${options.vaultRoot}/modules/ROOT/partials/.gitkeep`, '');
  out.set(`${options.vaultRoot}/modules/ROOT/examples/.gitkeep`, '');
  out.set(`${options.vaultRoot}/modules/ROOT/assets/images/.gitkeep`, '');

  return out;
}

function defaultTitle(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || name;
}
