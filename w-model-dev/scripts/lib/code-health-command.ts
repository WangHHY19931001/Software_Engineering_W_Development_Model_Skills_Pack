import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  CodeHealthCommandRunner,
  CommandEvidence,
  EvidenceObservationStatus,
} from '../logic/code-health-ledger-logic.js';

import { redactCodeHealthArtifact } from './code-health-redaction.js';

export interface CodeHealthCommandRunnerOptions {
  rawOutputDir: string;
  now?: () => Date;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateInvocation(command: string, args: string[]): void {
  if (typeof command !== 'string' || command.length === 0)
    throw new TypeError('command must be a non-empty executable name');
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string'))
    throw new TypeError('argv must be a string array');
  if (/\s|["'`;&|<>\r\n]/.test(command)) {
    throw new TypeError('argv must carry arguments separately; command must not be a shell string');
  }
}

function relativeOutputPath(file: string): string {
  const relative = path.relative(process.cwd(), file).replace(/\\/g, '/');
  return relative && !relative.startsWith('../') && relative !== '..' ? relative : path.basename(file);
}

function observationFor(error: unknown): EvidenceObservationStatus {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'EACCES' ? 'unavailable' : 'not_run';
}

export function createCodeHealthCommandRunner(options: CodeHealthCommandRunnerOptions): CodeHealthCommandRunner {
  const now = options.now ?? (() => new Date());
  return {
    async run(command, args, runOptions): Promise<CommandEvidence> {
      validateInvocation(command, args);
      if (!Number.isFinite(runOptions.timeoutMs) || runOptions.timeoutMs < 0)
        throw new TypeError('timeoutMs must be non-negative');
      const started = now();
      const sanitizedEnvironment = redactCodeHealthArtifact(runOptions.env).value;
      const environment = (
        sanitizedEnvironment && typeof sanitizedEnvironment === 'object' ? sanitizedEnvironment : {}
      ) as Record<string, string>;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- rawOutputDir is caller-owned controlled evidence storage.
      await fs.mkdir(options.rawOutputDir, { recursive: true });
      const outputName = `${started.toISOString().replace(/[^0-9]/g, '')}-${sha256(`${command}\u0000${args.join('\u0000')}`).slice(0, 16)}.log`;
      const outputFile = path.join(options.rawOutputDir, outputName);
      let output = '';
      let exitCode: number | null = null;
      let observation: EvidenceObservationStatus = 'not_run';
      try {
        const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
          const child = spawn(command, args, {
            cwd: runOptions.cwd,
            env: { ...process.env, ...runOptions.env },
            shell: false,
            windowsHide: true,
          });
          let stdout = '';
          let stderr = '';
          let settled = false;
          const finish = (callback: () => void): void => {
            if (settled) return;
            settled = true;
            callback();
          };
          const timer = setTimeout(() => {
            child.kill();
            finish(() => resolve({ code: null, output: `${stdout}${stderr}\n[timeout]` }));
          }, runOptions.timeoutMs);
          child.stdout.setEncoding('utf8');
          child.stderr.setEncoding('utf8');
          child.stdout.on('data', (chunk: string) => {
            stdout += chunk;
          });
          child.stderr.on('data', (chunk: string) => {
            stderr += chunk;
          });
          child.once('error', (error) => {
            clearTimeout(timer);
            finish(() => reject(error));
          });
          child.once('close', (code) => {
            clearTimeout(timer);
            finish(() => resolve({ code, output: `${stdout}${stderr}` }));
          });
        });
        output = result.output;
        exitCode = result.code;
        observation = result.code === null ? 'not_run' : 'observed';
      } catch (error) {
        output = error instanceof Error ? error.message : String(error);
        observation = observationFor(error);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- outputFile is derived from caller-owned rawOutputDir and a generated filename.
      await fs.writeFile(outputFile, output, 'utf8');
      const ended = now();
      return {
        command: [command, ...args].join(' '),
        cwd: relativeOutputPath(path.resolve(runOptions.cwd)),
        environment,
        platform: process.platform,
        toolVersions: { node: process.version },
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        exitCode,
        observation,
        rawOutputPath: relativeOutputPath(outputFile),
        rawOutputSha256: sha256(output),
      };
    },
  };
}
