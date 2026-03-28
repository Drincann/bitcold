import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const HOOK_PATH = path.resolve(__dirname, 'tty-hook.cjs');
const TSX_CLI = path.resolve(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs');
const ENTRY = path.resolve(REPO_ROOT, 'src/index.mts');

export interface CliResult {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number;
}

export class CliSandbox {
  public sandboxDir!: string;
  private _process: ChildProcessWithoutNullStreams | null = null;
  private _stdout = '';
  private _stderr = '';
  private _output = '';
  private _exitPromise: Promise<CliResult> | null = null;

  async init(): Promise<void> {
    this.sandboxDir = path.join(os.tmpdir(), `bitcold-test-${crypto.randomUUID()}`);
    await fs.mkdir(this.sandboxDir, { recursive: true });
  }

  async cleanup(): Promise<void> {
    if (this._process && !this._process.killed) {
      this._process.kill('SIGKILL');
    }
    if (this.sandboxDir) {
      await fs.rm(this.sandboxDir, { recursive: true, force: true });
    }
  }

  run(args: string[], env: Record<string, string> = {}): void {
    if (!this.sandboxDir) throw new Error('Call init() first');
    if (this._process) throw new Error('Process already running');

    this._stdout = '';
    this._stderr = '';
    this._output = '';

    this._process = spawn(process.execPath, [
      '--require', HOOK_PATH,
      TSX_CLI,
      ENTRY,
      ...args,
    ], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        HOME: this.sandboxDir,
        USERPROFILE: this.sandboxDir,
        BITCOLD_BITCOIN_NETWORK: env.BITCOLD_BITCOIN_NETWORK || 'regtest',
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        ...env,
      },
    });

    this._process.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this._stdout += text;
      this._output += text;
    });

    this._process.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this._stderr += text;
      this._output += text;
    });

    this._exitPromise = new Promise<CliResult>((resolve) => {
      this._process!.on('close', (code) => {
        resolve({ stdout: this._stdout, stderr: this._stderr, output: this._output, exitCode: code ?? -1 });
      });
    });
  }

  async waitFor(pattern: string | RegExp, timeoutMs = 10000): Promise<void> {
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : pattern;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (regex.test(this._output)) return;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error(`Timeout (${timeoutMs}ms) waiting for "${pattern}".\n--- output ---\n${this._output}\n--- end ---`);
  }

  async type(text: string): Promise<void> {
    if (!this._process) throw new Error('No process');
    this._process.stdin.write(text);
    await new Promise(r => setTimeout(r, 150));
  }

  /** Close stdin so the child process can exit naturally after all interactions. */
  closeStdin(): void {
    if (this._process) this._process.stdin.end();
  }

  async finish(timeoutMs = 15000): Promise<CliResult> {
    if (!this._exitPromise) throw new Error('No process');
    this.closeStdin(); // Automatically close stdin to allow process exit
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => { this._process?.kill('SIGKILL'); reject(new Error(`Process timeout.\nOutput: ${this._output}`)); }, timeoutMs)
    );
    const result = await Promise.race([this._exitPromise, timeout]);
    this._process = null;
    this._exitPromise = null;
    return result;
  }

  get output(): string { return this._output; }
}
