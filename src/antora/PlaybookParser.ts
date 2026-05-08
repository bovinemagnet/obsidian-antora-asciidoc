import yaml from 'js-yaml';

import { FileSource } from '../io/FileSource';

export interface PlaybookContentSource {
  /** Original `url` value as it appears in the playbook. */
  rawUrl: string;
  /** True when the URL points at a local filesystem path (relative or absolute). */
  isLocal: boolean;
  /** Absolute or relative-to-playbook path when isLocal; undefined otherwise. */
  localPath?: string;
  /** Optional `start_path` value that further scopes the source. */
  startPath?: string;
}

export interface ParsedPlaybook {
  playbookPath: string;
  sources: PlaybookContentSource[];
}

const REMOTE_URL = /^(https?:|git@|ssh:|git:|file:)/i;

/**
 * Parses every detected playbook file and extracts content.sources entries.
 * Sources whose `url` looks like a remote git/HTTP URL are flagged as remote
 * (we can't fetch them from inside Obsidian); local relative/absolute paths
 * are normalised into vault- or filesystem-resolvable paths.
 */
export async function parsePlaybooks(source: FileSource, playbookPaths: Iterable<string>): Promise<ParsedPlaybook[]> {
  const result: ParsedPlaybook[] = [];

  for (const path of playbookPaths) {
    const file = source.list().find((f) => f.path === path);
    if (!file) {
      continue;
    }
    const content = await source.read(file);
    const parsed = safeLoad(content);
    const sources = extractContentSources(parsed);
    result.push({ playbookPath: path, sources });
  }

  return result;
}

function safeLoad(content: string): unknown {
  try {
    return yaml.load(content);
  } catch {
    return null;
  }
}

function extractContentSources(parsed: unknown): PlaybookContentSource[] {
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }
  const content = (parsed as Record<string, unknown>).content;
  if (!content || typeof content !== 'object') {
    return [];
  }
  const sources = (content as Record<string, unknown>).sources;
  if (!Array.isArray(sources)) {
    return [];
  }

  const result: PlaybookContentSource[] = [];
  for (const entry of sources) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const rawUrl = (entry as Record<string, unknown>).url;
    if (typeof rawUrl !== 'string') {
      continue;
    }
    const startPathRaw = (entry as Record<string, unknown>).start_path;
    const startPath = typeof startPathRaw === 'string' ? startPathRaw : undefined;
    const isLocal = !REMOTE_URL.test(rawUrl);
    result.push({
      rawUrl,
      isLocal,
      localPath: isLocal ? rawUrl : undefined,
      startPath,
    });
  }
  return result;
}
