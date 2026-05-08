/**
 * Shared lookup used by every CodeMirror extension to decide whether it should
 * activate for the current editor. The plugin updates the underlying flag on
 * active-leaf-change so the extensions can early-out for non-AsciiDoc notes.
 *
 * Also exposes the active file's Antora context so xref autocomplete /
 * navigation / hover can default missing component/module segments, plus the
 * active vault path for attribute resolution.
 */
export interface EditorContext {
  isAsciiDocActive(): boolean;
  getDefaults(): { component?: string; module?: string; version?: string };
  getActiveFilePath(): string | undefined;
}

export class MutableEditorContext implements EditorContext {
  private active = false;
  private defaults: { component?: string; module?: string; version?: string } = {};
  private activeFilePath: string | undefined;

  set(
    active: boolean,
    defaults: { component?: string; module?: string; version?: string } = {},
    activeFilePath?: string,
  ): void {
    this.active = active;
    this.defaults = defaults;
    this.activeFilePath = activeFilePath;
  }

  isAsciiDocActive(): boolean {
    return this.active;
  }

  getDefaults(): { component?: string; module?: string; version?: string } {
    return this.defaults;
  }

  getActiveFilePath(): string | undefined {
    return this.activeFilePath;
  }
}
