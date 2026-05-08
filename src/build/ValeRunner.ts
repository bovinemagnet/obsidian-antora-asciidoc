import { spawn } from 'node:child_process';

import { Diagnostic } from '../diagnostics/Diagnostic';
import { parseValeOutput } from './ValeOutputParser';

export interface ValeRunOptions {
  /** Working directory for the spawned process. Should contain .vale.ini. */
  cwd?: string;
  /** Files or directories to lint. */
  targets: string[];
}

export interface ValeRunResult {
  diagnostics: Diagnostic[];
  exitCode: number;
  stderr: string;
}

/**
 * Spawns Vale with `--output=JSON` and turns the structured output into
 * Diagnostic records that flow through the same pipeline as the in-house
 * validators.
 */
export class ValeRunner {
  async run(executable: string, options: ValeRunOptions): Promise<ValeRunResult> {
    const args = ['--output=JSON', ...options.targets];
    return new Promise<ValeRunResult>((resolve, reject) => {
      const child = spawn(executable, args, { cwd: options.cwd ?? process.cwd() });

      let stdout = '';
      let stderr = '';
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr?.on('data', (chunk: string) => { stderr += chunk; });

      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        const diagnostics = parseValeOutput(stdout);
        resolve({ diagnostics, exitCode: code ?? 0, stderr });
      });
    });
  }
}
