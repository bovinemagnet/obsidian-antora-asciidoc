import { spawn } from 'node:child_process';
import path from 'node:path';

import { Diagnostic } from '../diagnostics/Diagnostic';
import { BuildOutputParser } from './BuildOutputParser';

export interface AntoraBuildResult {
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
  exitCode: number;
}

export interface AntoraBuildOptions {
  cwd?: string;
  playbookPath?: string;
  onLine?: (stream: 'stdout' | 'stderr', line: string) => void;
}

export class AntoraBuildRunner {
  private readonly outputParser = new BuildOutputParser();

  async run(command: string, options: AntoraBuildOptions = {}): Promise<AntoraBuildResult> {
    const cwd = options.cwd
      ?? (options.playbookPath ? path.dirname(options.playbookPath) : process.cwd());
    return new Promise<AntoraBuildResult>((resolve, reject) => {
      const child = spawn(command, { cwd, shell: true });

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      attachLineEmitter(child.stdout, 'stdout', stdoutChunks, options.onLine);
      attachLineEmitter(child.stderr, 'stderr', stderrChunks, options.onLine);

      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');
        const diagnostics = this.outputParser.parse(`${stdout}\n${stderr}`);
        resolve({ stdout, stderr, diagnostics, exitCode: code ?? 0 });
      });
    });
  }
}

function attachLineEmitter(
  stream: NodeJS.ReadableStream | null,
  kind: 'stdout' | 'stderr',
  chunks: string[],
  onLine?: (stream: 'stdout' | 'stderr', line: string) => void,
): void {
  if (stream === null) {
    return;
  }
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => {
    chunks.push(chunk);
    if (!onLine) {
      return;
    }
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      onLine(kind, line);
      newlineIndex = buffer.indexOf('\n');
    }
  });
  stream.on('end', () => {
    if (onLine && buffer.length > 0) {
      onLine(kind, buffer);
      buffer = '';
    }
  });
}
