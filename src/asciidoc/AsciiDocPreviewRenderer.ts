import asciidoctor from 'asciidoctor';

import { AntoraComponentIndex } from '../antora/AntoraComponentIndex';
import { AntoraResourceResolver } from '../antora/AntoraResourceResolver';
import { extractPageAttributes } from '../antora/AntoraWorkspaceScanner';
import { Diagnostic } from '../diagnostics/Diagnostic';
import { FileSource } from '../io/FileSource';

const INCLUDE_PATTERN = /^include::([^[]+)\[[^\]]*]/gm;

type AsciidoctorProcessor = ReturnType<typeof asciidoctor>;

export interface RenderOptions {
  /** Path of the file being rendered, used to resolve relative includes. */
  sourcePath: string;
}

export interface RenderResult {
  html: string;
  diagnostics: Diagnostic[];
}

/**
 * Renders AsciiDoc source to HTML using asciidoctor.js. The asciidoctor
 * processor itself is constructed lazily on first render — initialising the
 * Opal runtime is the heavy part of importing asciidoctor.js, and many users
 * will never open the preview view. Includes are pre-loaded asynchronously
 * via the FileSource and exposed to the renderer through a synchronous
 * include-processor cache.
 */
export class AsciiDocPreviewRenderer {
  private processor: AsciidoctorProcessor | null = null;
  private readonly resourceResolver: AntoraResourceResolver;

  constructor(
    private readonly index: AntoraComponentIndex,
    private readonly fileSource: FileSource,
  ) {
    this.resourceResolver = new AntoraResourceResolver(index);
  }

  /**
   * Renders content to HTML. Existing callers using `render()` get just the
   * HTML string for backwards compatibility; new callers can use
   * `renderWithDiagnostics()` to also collect any errors that asciidoctor
   * raises (or that the catch block produces) as Diagnostic records.
   */
  async render(content: string, options: RenderOptions): Promise<string> {
    const result = await this.renderWithDiagnostics(content, options);
    return result.html;
  }

  async renderWithDiagnostics(content: string, options: RenderOptions): Promise<RenderResult> {
    const preprocessed = preprocessDiagramBlocks(preprocessTabsBlocks(content));
    const includeCache = await this.preloadIncludes(preprocessed, options.sourcePath);
    const collected: Diagnostic[] = [];

    try {
      const processor = this.getProcessor();
      const registry = processor.Extensions.create();
      registerIncludeProcessor(registry as unknown as IncludeProcessorRegistry, includeCache);

      const memoryLogger = installMemoryLogger(processor, options.sourcePath, collected);
      const result = processor.convert(preprocessed, {
        safe: 'safe',
        attributes: this.buildAttributes(preprocessed, options.sourcePath),
        standalone: false,
        extension_registry: registry,
      });
      memoryLogger?.restore();
      const html = typeof result === 'string' ? result : '';
      return { html, diagnostics: collected };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      collected.push({
        filePath: options.sourcePath,
        line: 1,
        column: 1,
        severity: 'error',
        message: `Render error: ${message}`,
      });
      return {
        html: `<pre class="antora-preview-error">Render error: ${escapeHtml(message)}</pre>`,
        diagnostics: collected,
      };
    }
  }

  private getProcessor(): AsciidoctorProcessor {
    if (this.processor === null) {
      this.processor = asciidoctor();
    }
    return this.processor;
  }

  /**
   * Builds the attribute scope for a single render: descriptor attributes for
   * the page's owning component, then page-level :name: declarations on top.
   * Pages outside any indexed descriptor get the union of every descriptor.
   */
  private buildAttributes(content: string, sourcePath: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const [name, value] of this.index.getDescriptorAttributesFor(sourcePath)) {
      attrs[name] = value;
    }
    for (const [name, value] of Object.entries(extractPageAttributes(content))) {
      attrs[name] = value;
    }
    return attrs;
  }

  private async preloadIncludes(content: string, sourcePath: string): Promise<Map<string, string>> {
    const cache = new Map<string, string>();

    for (const match of content.matchAll(INCLUDE_PATTERN)) {
      const target = match[1].trim();
      if (cache.has(target)) {
        continue;
      }
      const resolved = this.resourceResolver.resolve(target, sourcePath);
      if (!this.fileSource.exists(resolved)) {
        cache.set(target, `[unresolved-include]\n----\nUnresolved include: ${target}\n----`);
        continue;
      }
      try {
        const file = this.fileSource.list().find((f) => f.path === resolved);
        if (!file) {
          cache.set(target, `[unresolved-include]\n----\nUnresolved include: ${target}\n----`);
          continue;
        }
        cache.set(target, await this.fileSource.read(file));
      } catch {
        cache.set(target, `[unresolved-include]\n----\nFailed to load include: ${target}\n----`);
      }
    }

    return cache;
  }
}

// asciidoctor.js extension typings expose loose `this` and reader shapes —
// model them explicitly here rather than reaching for `any` so eslint stays
// happy.
interface IncludeProcessorRegistry {
  includeProcessor(setup: (this: IncludeProcessorThis) => void): unknown;
}

interface IncludeProcessorThis {
  handles(predicate: (target: string) => boolean): void;
  process(handler: (doc: unknown, reader: IncludeReader, target: string, attrs: Record<string, unknown>) => unknown): void;
}

interface IncludeReader {
  pushInclude(data: string, file: string, path: string, lineno: number, attrs: Record<string, unknown>): unknown;
}


function registerIncludeProcessor(registry: IncludeProcessorRegistry, cache: Map<string, string>): void {
  registry.includeProcessor(function () {
    this.handles((target) => cache.has(target));
    this.process((_doc, reader, target, attrs) => {
      const content = cache.get(target) ?? `[unresolved-include]\n----\nMissing include: ${target}\n----`;
      return reader.pushInclude(content, target, target, 1, attrs);
    });
  });
}

/**
 * Recognised diagram block names. When asciidoctor.js sees `[mermaid]` it has
 * no extension to handle the block, so it would be rendered as a literal
 * paragraph. Rewriting the block name to `[source,X]` makes asciidoctor emit
 * `<pre><code class="language-X">…</code></pre>`, which the preview view's
 * `highlightCodeBlocks` step then routes through Obsidian's MarkdownRenderer.
 *
 * For `mermaid` Obsidian renders the diagram natively. For others (plantuml,
 * graphviz, ditaa, …) the user gets a clean code block they can install a
 * dedicated Obsidian plugin to handle.
 */
const DIAGRAM_BLOCK_NAMES = new Set(['mermaid', 'plantuml', 'graphviz', 'ditaa', 'dot', 'asciimath', 'latexmath']);

export function preprocessDiagramBlocks(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^\[([A-Za-z]+)\]\s*$/);
    if (!match || !DIAGRAM_BLOCK_NAMES.has(match[1].toLowerCase())) {
      out.push(line);
      continue;
    }
    out.push(`[source,${match[1].toLowerCase()}]`);
  }

  return out.join('\n');
}

/**
 * Lightweight in-house substitute for @asciidoctor/tabs. Detects Asciidoctor
 * Tabs blocks (delimited by ====== with `[tabs]` attribute) and rewrites
 * them to passthrough HTML that the preview view's `activateTabBlocks`
 * helper turns into an interactive tab strip.
 *
 * Recognised input:
 *
 *   [tabs]
 *   ======
 *   Tab A::
 *   +
 *   Content for A.
 *
 *   Tab B::
 *   +
 *   Content for B.
 *   ======
 *
 * Each tab item starts with `Label::` followed (optionally) by `+` and the
 * tab body. Blocks that don't match the expected shape are passed through
 * unchanged so existing notation degrades gracefully.
 */
export function preprocessTabsBlocks(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const headerMatch = line.trim().match(/^\[tabs(%sync)?\]$/);
    if (!headerMatch) {
      out.push(line);
      continue;
    }
    const sync = headerMatch[1] === '%sync';
    if (i + 1 >= lines.length || !/^={6,}$/.test(lines[i + 1].trim())) {
      out.push(line);
      continue;
    }
    const fence = lines[i + 1].trim();
    let end = -1;
    for (let j = i + 2; j < lines.length; j += 1) {
      if (lines[j].trim() === fence) {
        end = j;
        break;
      }
    }
    if (end === -1) {
      out.push(line);
      continue;
    }

    const body = lines.slice(i + 2, end);
    const html = buildTabsHtml(body, sync);
    if (!html) {
      // Couldn't parse — leave the original block alone.
      out.push(...lines.slice(i, end + 1));
    } else {
      out.push('++++', html, '++++');
    }
    i = end;
  }

  return out.join('\n');
}

function buildTabsHtml(body: string[], sync: boolean): string | null {
  interface Tab { label: string; content: string[] }
  const tabs: Tab[] = [];
  let current: Tab | null = null;
  let inBody = false;

  for (const line of body) {
    const labelMatch = line.match(/^([^:][^:]*?)::\s*$/);
    if (labelMatch && !inBody) {
      current = { label: labelMatch[1].trim(), content: [] };
      tabs.push(current);
      continue;
    }
    if (line.trim() === '+' && current) {
      inBody = true;
      continue;
    }
    if (current && inBody) {
      if (line.trim() === '' && current.content.length > 0) {
        // Blank line terminates the tab body; a new label may follow.
        inBody = false;
        continue;
      }
      current.content.push(line);
    }
  }

  if (tabs.length === 0) {
    return null;
  }

  const idBase = `antora-tabs-${Math.random().toString(36).slice(2, 9)}`;
  const tablistItems = tabs.map((tab, index) => {
    const id = `${idBase}-tab-${index}`;
    return `<li id="${id}">${escapeHtml(tab.label)}</li>`;
  }).join('');
  const panels = tabs.map((tab, index) => {
    const id = `${idBase}-tab-${index}`;
    const panelId = `${idBase}-panel-${index}`;
    const inner = escapeHtml(tab.content.join('\n').trim());
    return `<div class="tabpanel" id="${panelId}" aria-labelledby="${id}"><pre class="tabpanel-content">${inner}</pre></div>`;
  }).join('');

  const tabsClass = sync ? 'tabs is-sync' : 'tabs';
  return `<div class="${tabsClass}"><div class="tablist"><ul>${tablistItems}</ul></div>${panels}</div>`;
}

/**
 * Installs a temporary in-memory logger on the asciidoctor processor that
 * captures every emitted message. After the convert call, each message is
 * mapped to a Diagnostic. Restores the previous logger on `restore()`.
 *
 * Returns null if the processor doesn't expose the LoggerManager API (this
 * keeps the call site safe across asciidoctor.js minor versions).
 */
function installMemoryLogger(
  processor: AsciidoctorProcessor,
  sourcePath: string,
  collected: Diagnostic[],
): { restore(): void } | null {
  // The asciidoctor.js typings don't model LoggerManager fully.
  const lm = (processor as unknown as { LoggerManager?: unknown }).LoggerManager;
  if (!lm || typeof (lm as Record<string, unknown>).getLogger !== 'function') {
    return null;
  }
  const manager = lm as {
    getLogger(): unknown;
    setLogger(logger: unknown): void;
    newLogger?(name: string, init?: () => unknown): unknown;
  };
  const memoryLogger = (processor as unknown as { MemoryLogger?: { create?(): unknown } }).MemoryLogger;
  if (!memoryLogger?.create) {
    return null;
  }
  const previous = manager.getLogger();
  const fresh = memoryLogger.create() as { getMessages(): Array<{ severity?: string; getText?(): string; text?: string; source_location?: { lineno?: number } }> };
  manager.setLogger(fresh);

  return {
    restore() {
      try {
        for (const message of fresh.getMessages()) {
          const text = typeof message.getText === 'function' ? message.getText() : message.text ?? '';
          const severity = mapAsciidoctorSeverity(message.severity);
          collected.push({
            filePath: sourcePath,
            line: message.source_location?.lineno ?? 1,
            column: 1,
            severity,
            message: text,
          });
        }
      } catch {
        /* swallow — diagnostics are best-effort */
      }
      try {
        manager.setLogger(previous);
      } catch {
        /* nothing else to do */
      }
    },
  };
}

function mapAsciidoctorSeverity(severity: string | undefined): Diagnostic['severity'] {
  switch (severity?.toUpperCase()) {
    case 'ERROR':
    case 'FATAL': return 'error';
    case 'WARN':
    case 'WARNING': return 'warning';
    default: return 'info';
  }
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
