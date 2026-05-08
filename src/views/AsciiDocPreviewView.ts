import { Component, ItemView, MarkdownRenderer, MarkdownView, Notice, TFile, WorkspaceLeaf } from 'obsidian';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraPathResolver } from '../antora/AntoraPathResolver';
import { AsciiDocPreviewRenderer } from '../asciidoc/AsciiDocPreviewRenderer';
import { Diagnostic } from '../diagnostics/Diagnostic';
import { isAsciiDocPath } from '../util/FileUtils';

export const ASCIIDOC_PREVIEW_VIEW_TYPE = 'antora-asciidoc-preview';

const ANTORA_TARGET_PATTERN = /^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_./-]+)*\.adoc(?:#[^\s]+)?$/;

export class AsciiDocPreviewView extends ItemView {
  private currentFile: TFile | null = null;
  private readonly resolver = new AntoraPathResolver();

  /**
   * Optional callback invoked after each render with the diagnostics
   * asciidoctor.js produced. Lets the plugin pipe them into DiagnosticsView.
   */
  onRenderDiagnostics?: (filePath: string, diagnostics: Diagnostic[]) => void;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly renderer: AsciiDocPreviewRenderer,
    private readonly index: AntoraComponentIndex,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ASCIIDOC_PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.currentFile ? `Preview: ${this.currentFile.basename}` : 'AsciiDoc Preview';
  }

  getIcon(): string {
    return 'file-text';
  }

  async onOpen(): Promise<void> {
    await this.refreshFromActiveFile();
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshFromActiveFile()));
    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && file === this.currentFile) {
        void this.renderFile(file);
      }
    }));
  }

  async refreshFromActiveFile(): Promise<void> {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.file
      ?? this.app.workspace.getActiveFile();
    if (active instanceof TFile && isAsciiDocPath(active.path)) {
      await this.renderFile(active);
    } else {
      this.renderEmpty();
    }
  }

  private async renderFile(file: TFile): Promise<void> {
    this.currentFile = file;
    const content = await this.app.vault.cachedRead(file);
    const { html, diagnostics } = await this.renderer.renderWithDiagnostics(content, { sourcePath: file.path });
    this.onRenderDiagnostics?.(file.path, diagnostics);

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-preview-pane');

    // asciidoctor.js with safe='safe' sanitises script/style. Parse the
    // output and adopt nodes individually rather than assigning innerHTML.
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const node of Array.from(parsed.body.childNodes)) {
      contentEl.appendChild(document.importNode(node, true));
    }

    this.rewriteXrefLinks(contentEl);
    this.rewriteImageSources(contentEl);
    this.activateTabBlocks(contentEl);
    await this.highlightCodeBlocks(contentEl, file.path);
  }

  /**
   * Hands each rendered `<pre><code class="language-X">…</code></pre>` to
   * Obsidian's MarkdownRenderer so the preview pane gets the same
   * syntax-highlighting pipeline as ordinary Markdown notes. Falls back to a
   * plain monospace block when the renderer isn't available (e.g. the API
   * surface changes in a future Obsidian release).
   */
  private async highlightCodeBlocks(root: HTMLElement, sourcePath: string): Promise<void> {
    const codes = Array.from(root.querySelectorAll<HTMLElement>('pre > code'));
    if (codes.length === 0) {
      return;
    }
    if (typeof MarkdownRenderer?.render !== 'function') {
      return;
    }

    for (const code of codes) {
      const language = pickLanguage(code);
      const text = code.textContent ?? '';
      const fenced = '```' + language + '\n' + text + '\n```';
      const container = document.createElement('div');
      container.addClass('antora-preview-code');
      try {
        await MarkdownRenderer.render(this.app, fenced, container, sourcePath, new Component());
      } catch {
        continue;
      }
      const pre = code.parentElement;
      if (pre && pre.parentElement) {
        pre.parentElement.replaceChild(container, pre);
      }
    }
  }

  /**
   * Wires click-to-switch behaviour on `.tabs` blocks emitted by our in-house
   * preprocessor. Blocks marked `.is-sync` synchronise selection across every
   * other `.is-sync` block in the document by tab-label text — clicking
   * "Java" in any one such block selects "Java" in all of them.
   */
  private activateTabBlocks(root: HTMLElement): void {
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('.tabs'));
    interface ActivatedBlock {
      element: HTMLElement;
      tabs: HTMLElement[];
      panels: HTMLElement[];
      sync: boolean;
      select(index: number, source?: 'click' | 'sync'): void;
    }
    const activated: ActivatedBlock[] = [];

    for (const block of blocks) {
      const tabs = Array.from(block.querySelectorAll<HTMLElement>('.tablist li'));
      const panels = Array.from(block.querySelectorAll<HTMLElement>('.tabpanel'));
      if (tabs.length === 0 || panels.length === 0) {
        continue;
      }
      const sync = block.hasClass('is-sync');
      const entry: ActivatedBlock = {
        element: block,
        tabs,
        panels,
        sync,
        select: (index, source) => {
          tabs.forEach((tab, i) => tab.toggleClass('is-selected', i === index));
          panels.forEach((panel, i) => {
            if (i === index) {
              panel.removeAttribute('hidden');
            } else {
              panel.setAttribute('hidden', '');
            }
          });
          if (sync && source === 'click') {
            const label = tabs[index].textContent?.trim() ?? '';
            for (const other of activated) {
              if (other === entry || !other.sync) {
                continue;
              }
              const matchIdx = other.tabs.findIndex((tab) => tab.textContent?.trim() === label);
              if (matchIdx >= 0) {
                other.select(matchIdx, 'sync');
              }
            }
          }
        },
      };
      tabs.forEach((tab, index) => {
        tab.addClass('tab');
        tab.onclick = () => entry.select(index, 'click');
      });
      entry.select(0);
      activated.push(entry);
    }
  }

  private rewriteXrefLinks(root: HTMLElement): void {
    for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const href = anchor.getAttribute('href') ?? '';
      if (!ANTORA_TARGET_PATTERN.test(href)) {
        continue;
      }
      anchor.setAttribute('data-antora-xref', href);
      anchor.setAttribute('href', '#');
      anchor.addClass('antora-xref-link');
      anchor.onclick = (event) => {
        event.preventDefault();
        void this.openXref(href);
      };
    }
  }

  private rewriteImageSources(root: HTMLElement): void {
    for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img[src]'))) {
      const src = img.getAttribute('src') ?? '';
      // Skip already-resolved sources (data:, http:, etc.)
      if (/^[a-z]+:/i.test(src)) {
        continue;
      }
      const resolved = this.resolveImageSrc(src);
      if (resolved) {
        img.setAttribute('src', resolved);
      } else {
        const placeholder = document.createElement('div');
        placeholder.addClass('antora-image-missing');
        placeholder.setText(`Image not found: ${src}`);
        img.parentNode?.replaceChild(placeholder, img);
      }
    }
  }

  private resolveImageSrc(src: string): string | null {
    // Try the index-tracked images first.
    for (const component of this.index.getComponents()) {
      for (const version of component.versions.values()) {
        for (const module of version.modules.values()) {
          if (module.images.includes(src)) {
            const vaultPath = `${component.name}/modules/${module.name}/assets/images/${src}`;
            const tfile = this.app.vault.getAbstractFileByPath(vaultPath);
            if (tfile instanceof TFile) {
              return this.app.vault.adapter.getResourcePath(tfile.path);
            }
          }
        }
      }
    }
    // Fall back to a sibling-relative lookup against the current file.
    if (this.currentFile) {
      const baseFolder = this.currentFile.path.split('/').slice(0, -1).join('/');
      const candidate = `${baseFolder}/${src}`.replace(/\/\//g, '/');
      const tfile = this.app.vault.getAbstractFileByPath(candidate);
      if (tfile instanceof TFile) {
        return this.app.vault.adapter.getResourcePath(tfile.path);
      }
    }
    return null;
  }

  private async openXref(rawTarget: string): Promise<void> {
    const owning = this.currentFile ? this.index.getPageByFilePath(this.currentFile.path) : undefined;
    const defaults = owning ? { component: owning.component, module: owning.module } : {};
    const resolved = this.resolver.resolveXrefTarget(rawTarget, defaults);
    const page = this.index.resolvePage(resolved);
    if (!page) {
      new Notice(`Unresolved xref target: ${rawTarget}`);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(page.filePath);
    if (!(file instanceof TFile)) {
      new Notice(`Target page not found in vault: ${page.filePath}`);
      return;
    }
    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  private renderEmpty(): void {
    this.currentFile = null;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('antora-preview-pane');
    contentEl.createEl('p', { text: 'Open an .adoc or .asciidoc file to see a rendered preview.' });
  }
}

/**
 * Reads the language hint from a `<code>` element. asciidoctor.js emits
 * `language-X` classes for `[source,X]` blocks; some authors use the older
 * `data-lang` attribute instead.
 */
function pickLanguage(code: HTMLElement): string {
  for (const cls of Array.from(code.classList)) {
    if (cls.startsWith('language-')) {
      return cls.slice('language-'.length);
    }
  }
  const dataLang = code.getAttribute('data-lang');
  return dataLang ?? '';
}
