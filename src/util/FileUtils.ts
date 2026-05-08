export function isAsciiDocPath(path: string): boolean {
  return path.endsWith('.adoc') || path.endsWith('.asciidoc');
}
