import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { BuildOutputParser } from './BuildOutputParser';

const execAsync = promisify(exec);

export class AntoraBuildRunner {
  private readonly outputParser = new BuildOutputParser();

  async run(command: string): Promise<{ stdout: string; stderr: string }> {
    const result = await execAsync(command, { maxBuffer: 1024 * 1024 * 5 });
    this.outputParser.parse(`${result.stdout}\n${result.stderr}`);
    return result;
  }
}
