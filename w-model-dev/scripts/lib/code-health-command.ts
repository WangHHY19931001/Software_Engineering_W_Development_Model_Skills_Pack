/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Paths are constrained beneath the repository-owned output root; environment keys are explicitly allowlisted. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { TextDecoder } from 'node:util';
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
  auditedEnvironmentKeys?: string[];
}

const DEFAULT_AUDITED_ENVIRONMENT_KEYS = ['CI', 'FORCE_COLOR', 'LANG', 'LC_ALL', 'NODE_ENV', 'NO_COLOR', 'TZ'] as const;

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

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateCwd(cwd: string): string {
  const resolved = path.resolve(cwd);
  if (!isWithin(process.cwd(), resolved)) throw new TypeError('cwd must be beneath the current repository root');
  return relativeOutputPath(resolved);
}

function validateRawOutputDir(dir: string): string {
  const resolved = path.resolve(dir);
  if (!isWithin(process.cwd(), resolved))
    throw new TypeError('rawOutputDir must be beneath the current repository root');
  return resolved;
}

async function ensureSecureRawOutputDir(dir: string): Promise<string> {
  const repositoryRoot = path.resolve(process.cwd());
  const relative = path.relative(repositoryRoot, dir);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('redaction blocked: raw output path must remain repository-relative');
  }

  let current = repositoryRoot;
  const components = relative === '' ? [] : relative.split(path.sep);
  for (const component of components) {
    current = path.join(current, component);
    try {
      const entry = await fs.lstat(current);
      if (entry.isSymbolicLink()) throw new Error('redaction blocked: raw output directory must not contain symlinks');
      if (!entry.isDirectory()) throw new Error('rawOutputDir must contain directories only');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        await fs.mkdir(current);
      } catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
      }
      const created = await fs.lstat(current);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new Error('redaction blocked: raw output directory was replaced by a symlink or non-directory');
      }
    }
  }

  const realRepositoryRoot = await fs.realpath(repositoryRoot);
  const realOutputDir = await fs.realpath(dir);
  if (!isWithin(realRepositoryRoot, realOutputDir)) {
    throw new Error('redaction blocked: raw output directory resolves outside the repository');
  }
  return realOutputDir;
}

function auditedEnvironment(requested: Record<string, string>, keys: readonly string[]): Record<string, string> {
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
    throw new TypeError('env must be a string map');
  }
  const allowed = new Set(keys);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(requested)) {
    if (!allowed.has(key)) throw new Error(`redaction blocked: environment key is not explicitly audited: ${key}`);
    if (typeof value !== 'string' || value.includes('\u0000')) {
      throw new Error(`redaction blocked: environment value is unsafe: ${key}`);
    }
    const sanitized = redactCodeHealthArtifact({ [key]: value });
    if (sanitized.status === 'blocked') throw new Error(`redaction blocked: ${sanitized.reasons.join('; ')}`);
    const output = sanitized.value as Record<string, string>;
    if (output[key] !== value) throw new Error(`redaction blocked: environment value requires redaction: ${key}`);
    result[key] = value;
  }
  return result;
}

function redactedText(value: unknown): string {
  const result = redactCodeHealthArtifact(value);
  if (result.status === 'blocked') throw new Error(`redaction blocked: ${result.reasons.join('; ')}`);
  return JSON.stringify(result.value);
}

function decodeOutput(stdout: Buffer, stderr: Buffer): string {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return `${decoder.decode(stdout)}${decoder.decode(stderr)}`;
  } catch {
    throw new Error('redaction blocked: command output is not valid UTF-8');
  }
}

export function createCodeHealthCommandRunner(options: CodeHealthCommandRunnerOptions): CodeHealthCommandRunner {
  const now = options.now ?? (() => new Date());
  const rawOutputDir = validateRawOutputDir(options.rawOutputDir);
  const auditedKeys = options.auditedEnvironmentKeys ?? DEFAULT_AUDITED_ENVIRONMENT_KEYS;

  return {
    async run(command, args, runOptions): Promise<CommandEvidence> {
      validateInvocation(command, args);
      if (!Number.isFinite(runOptions.timeoutMs) || runOptions.timeoutMs < 0)
        throw new TypeError('timeoutMs must be non-negative');
      const cwd = validateCwd(runOptions.cwd);
      const environment = auditedEnvironment(runOptions.env, auditedKeys);
      const started = now();
      const outputName = `${started.toISOString().replace(/[^0-9]/g, '')}-${randomUUID()}.log`;
      const secureOutputDir = await ensureSecureRawOutputDir(rawOutputDir);
      const outputFile = path.join(secureOutputDir, outputName);
      let output = '';
      let exitCode: number | null = null;
      let observation: EvidenceObservationStatus = 'not_run';
      try {
        const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
          const child = spawn(command, args, {
            cwd: runOptions.cwd,
            env: environment,
            shell: false,
            windowsHide: true,
          });
          const stdout: Buffer[] = [];
          const stderr: Buffer[] = [];
          let settled = false;
          const finish = (callback: () => void): void => {
            if (settled) return;
            settled = true;
            callback();
          };
          const timer = setTimeout(() => {
            child.kill();
            finish(() => {
              try {
                resolve({
                  code: null,
                  output: `${decodeOutput(Buffer.concat(stdout), Buffer.concat(stderr))}\n[timeout]`,
                });
              } catch (error) {
                reject(error);
              }
            });
          }, runOptions.timeoutMs);
          child.stdout.on('data', (chunk: Buffer | string) => {
            stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          child.stderr.on('data', (chunk: Buffer | string) => {
            stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          child.once('error', (error) => {
            clearTimeout(timer);
            finish(() => reject(error));
          });
          child.once('close', (code) => {
            clearTimeout(timer);
            finish(() => {
              try {
                resolve({ code, output: decodeOutput(Buffer.concat(stdout), Buffer.concat(stderr)) });
              } catch (error) {
                reject(error);
              }
            });
          });
        });
        output = redactedText({ output: result.output });
        exitCode = result.code;
        observation = result.code === null ? 'not_run' : 'observed';
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('redaction blocked:')) throw error;
        output = redactedText({ output: error instanceof Error ? error.message : String(error) });
        observation = observationFor(error);
      }
      const handle = await fs.open(outputFile, 'wx');
      try {
        await handle.writeFile(output, 'utf8');
        const written = await handle.stat();
        if (!written.isFile()) throw new Error('redaction blocked: raw output target must be a regular file');
      } finally {
        await handle.close();
      }
      const outputEntry = await fs.lstat(outputFile);
      const outputRealPath = await fs.realpath(outputFile);
      if (
        outputEntry.isSymbolicLink() ||
        !outputEntry.isFile() ||
        !isWithin(secureOutputDir, outputRealPath) ||
        path.resolve(outputRealPath) !== path.resolve(outputFile)
      ) {
        throw new Error('redaction blocked: raw output target must be a regular file beneath the controlled directory');
      }
      const ended = now();
      const safeCommand = redactedText({ command, args });
      return {
        command: safeCommand,
        cwd,
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
