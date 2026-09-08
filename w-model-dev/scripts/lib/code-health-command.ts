import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  CodeHealthCommandRunner,
  CommandEvidence,
  EvidenceObservationStatus,
} from '../logic/code-health-ledger-logic.js';

import { containsSensitiveCodeHealthContent, redactCodeHealthArtifact } from './code-health-redaction.js';

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
  if (containsSensitiveCodeHealthContent({ command, args })) {
    throw new Error('redaction blocked: sensitive command argv must not be executed or persisted');
  }
}

function relativeOutputPath(file: string): string {
  const relative = path.relative(process.cwd(), file).replace(/\\/g, '/');
  if (relative === '') return '.';
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('redaction blocked: raw output path must remain repository-relative');
  }
  return relative;
}

function observationFor(error: unknown): EvidenceObservationStatus {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'EACCES' ? 'unavailable' : 'not_run';
}

function boundedExitCode(code: number | null): 0 | 1 | 2 | null {
  if (code === null) return null;
  if (code === 0) return 0;
  if (code === 1) return 1;
  if (code === 2) return 2;
  return 1;
}

function redactedText(value: unknown): string {
  const result = redactCodeHealthArtifact(value);
  if (result.status === 'blocked') throw new Error(`redaction blocked: ${result.reasons.join('; ')}`);
  return JSON.stringify(result.value);
}

export function createCodeHealthCommandRunner(options: CodeHealthCommandRunnerOptions): CodeHealthCommandRunner {
  const now = options.now ?? (() => new Date());
  const rawOutputDir = path.resolve(options.rawOutputDir);
  const rawOutputRelative = path.relative(process.cwd(), rawOutputDir);
  if (
    rawOutputRelative === '..' ||
    rawOutputRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rawOutputRelative)
  ) {
    throw new TypeError('rawOutputDir must be beneath the current repository root');
  }

  return {
    async run(command, args, runOptions): Promise<CommandEvidence> {
      validateInvocation(command, args);
      if (!Number.isFinite(runOptions.timeoutMs) || runOptions.timeoutMs < 0)
        throw new TypeError('timeoutMs must be non-negative');
      if (containsSensitiveCodeHealthContent(runOptions.env)) {
        throw new Error('redaction blocked: sensitive environment must not be passed to a child process');
      }
      const sanitizedEnvironment = redactCodeHealthArtifact(runOptions.env);
      if (sanitizedEnvironment.status === 'blocked') {
        throw new Error(`redaction blocked: ${sanitizedEnvironment.reasons.join('; ')}`);
      }
      const environment = (sanitizedEnvironment.value ?? {}) as Record<string, string>;
      const started = now();
      const outputName = `${started.toISOString().replace(/[^0-9]/g, '')}-${randomUUID()}.log`;
      const outputFile = path.join(rawOutputDir, outputName);
      await fs.mkdir(rawOutputDir, { recursive: true });
      let output = '';
      let exitCode: 0 | 1 | 2 | null = null;
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
        output = redactedText({ output: result.output });
        exitCode = boundedExitCode(result.code);
        observation = result.code === null ? 'not_run' : 'observed';
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('redaction blocked:')) throw error;
        output = redactedText({ output: error instanceof Error ? error.message : String(error) });
        observation = observationFor(error);
      }
      await fs.writeFile(outputFile, output, 'utf8');
      const ended = now();
      const safeCommand = redactedText({ command, args });
      return {
        command: safeCommand,
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
