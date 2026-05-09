import { FileSource } from '../io/FileSource';

export interface BulkReplaceOptions {
  pattern: string;
  replacement: string;
  /** When true, treat `pattern` as a JS regular expression. */
  regex?: boolean;
  /** When true, match case. Defaults to true. */
  caseSensitive?: boolean;
}

export interface BulkReplaceMatch {
  filePath: string;
  /** 1-based line number containing the match. */
  line: number;
  /** 1-based character column where the match starts. */
  column: number;
  /** The text that matched. */
  matchedText: string;
  /** The text that would replace `matchedText`. */
  replacementText: string;
  /** Snippet of the line for context (line content trimmed). */
  context: string;
}

export interface BulkReplacePlan {
  matches: BulkReplaceMatch[];
  /** Map of file path → new full content for every modified file. */
  fileChanges: Map<string, string>;
}

/**
 * Walks every .adoc file in the source and produces a plan of matches and
 * file rewrites for the supplied search options. The plan is independent of
 * Obsidian — the caller (the plugin) applies the file changes via vault.modify
 * with the existing snapshot/rollback flow.
 *
 * Throws when `regex: true` is set with an invalid pattern so the modal can
 * surface the parse error to the user.
 */
export async function planBulkReplace(source: FileSource, options: BulkReplaceOptions): Promise<BulkReplacePlan> {
  if (options.pattern === '') {
    return { matches: [], fileChanges: new Map() };
  }

  const regex = compilePattern(options);
  const matches: BulkReplaceMatch[] = [];
  const fileChanges = new Map<string, string>();

  for (const file of source.list()) {
    if (!/^(adoc|asciidoc)$/i.test(file.extension)) {
      continue;
    }
    const content = await source.read(file);
    const lines = content.split('\n');
    let touched = false;
    const updatedLines = lines.map((line, lineIdx) => {
      if (!regex.test(line)) {
        return line;
      }
      // Reset for replace — `test` advanced lastIndex on global flag.
      regex.lastIndex = 0;
      const replaced = line.replace(regex, (match, ...args) => {
        // Capture the match position from the args tail.
        const offset = typeof args[args.length - 2] === 'number'
          ? args[args.length - 2] as number
          : 0;
        const replacement = options.replacement;
        matches.push({
          filePath: file.path,
          line: lineIdx + 1,
          column: offset + 1,
          matchedText: match,
          replacementText: replacement,
          context: line.trim(),
        });
        return replacement;
      });
      regex.lastIndex = 0;
      if (replaced !== line) {
        touched = true;
      }
      return replaced;
    });
    if (touched) {
      fileChanges.set(file.path, updatedLines.join('\n'));
    }
  }

  return { matches, fileChanges };
}

function compilePattern(options: BulkReplaceOptions): RegExp {
  const flags = options.caseSensitive === false ? 'gi' : 'g';
  if (options.regex) {
    return new RegExp(options.pattern, flags);
  }
  return new RegExp(escapeRegExp(options.pattern), flags);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
