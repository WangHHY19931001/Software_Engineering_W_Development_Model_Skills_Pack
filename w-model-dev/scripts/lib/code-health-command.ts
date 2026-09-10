/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Command paths and raw outputs stay beneath the explicit repository root; environment keys are explicitly allowlisted. */
/**
 * Command evidence runner over explicit injected boundaries.
 *
 * Migrated `39d1671` safety facts are preserved: `shell: false`, explicit repository root and cwd
 * containment, non-symlink raw output directories, exclusive raw-output creation through the injected
 * EvidenceStore, audited environment keys, NUL/secret/token/authorization/private-key interception,
 * safe redaction, stdout+stderr byte collection, fatal UTF-8 decoding, and real exit codes.
 *
 * `observed` is only used when the close event delivered a real code; non-zero codes keep their value;
 * a command that cannot be executed is `unavailable`; a timeout is `not_run` with `exitCode: null`.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { TextDecoder } from 'node:util';
import * as path from 'node:path';

import type {
  CodeHealthCommandRunner,
  CommandEvidence,
  EvidenceBinding,
  EvidenceObservationStatus,
  EvidenceStore,
  RevisionProvider,
} from '../logic/code-health-contract.js';

import { CodeHealthError } from './code-health-error.js';
import { isPathWithin, resolveControlledRelativePath, resolveControlledRoot } from './code-health-file-verifier.js';
import { containsSensitiveCodeHealthContent, redactCodeHealthArtifact } from './code-health-redaction.js';

export interface CodeHealthCommandRunnerOptions {
  /** Explicit repository root; no implicit `process.cwd()` fallback. */
  repositoryRoot: string;
  /** Repository-relative (or absolute-inside-root) directory that owns raw outputs. */
  rawOutputDir: string;
  evidenceStore: EvidenceStore;
  revisionProvider: RevisionProvider;
  now?: () => Date;
  auditedEnvironmentKeys?: string[];
}

export interface CodeHealthCommandRunOptions {
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  binding: EvidenceBinding;
}

const DEFAULT_AUDITED_ENVIRONMENT_KEYS = ['CI', 'FORCE_COLOR', 'LANG', 'LC_ALL', 'NODE_ENV', 'NO_COLOR', 'TZ'] as const;

function validateInvocation(command: string, args: string[]): void {
  if (typeof command !== 'string' || command.length === 0) {
    throw new CodeHealthError('ARG_INVALID', 'command must be a non-empty executable name');
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new CodeHealthError('ARG_INVALID', 'argv must be a string array');
  }
  if (/\s|["'`;&|<>\r\n]/.test(command)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'argv must carry arguments separately; command must not be a shell string',
    );
  }
  if (containsSensitiveCodeHealthContent({ command, args })) {
    throw new CodeHealthError('SECURITY_BLOCKED', 'redaction blocked: sensitive command argv must not be executed');
  }
}

function observationFor(error: unknown): EvidenceObservationStatus {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'EACCES' ? 'unavailable' : 'not_run';
}

function toRepositoryRelative(repositoryRoot: string, target: string, field: string): string {
  const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(repositoryRoot, target);
  if (!isPathWithin(repositoryRoot, resolved)) {
    throw new CodeHealthError('ARG_INVALID', `${field} must stay beneath the explicit repository root`);
  }
  const relative = path.relative(repositoryRoot, resolved).replace(/\\/g, '/');
  if (relative === '') return '.';
  if (relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new CodeHealthError('ARG_INVALID', `${field} must stay beneath the explicit repository root`);
  }
  return relative;
}

/**
 * Pre-flight check before any child process starts: the repository root itself must be a real
 * non-symlink directory, and every existing raw-output component must be a non-symlink directory.
 * Canonicalizing the root keeps symlinked ancestors (for example macOS `/var`) working.
 */
async function assertControlledDirectoryChain(repositoryRoot: string, components: string[]): Promise<void> {
  const rootResolution = await resolveControlledRoot(repositoryRoot);
  if (!rootResolution.ok || !rootResolution.canonicalRoot) {
    throw new CodeHealthError(
      rootResolution.code ?? 'STRUCTURE_INVALID',
      rootResolution.reason ?? 'repository root is not a controlled directory',
    );
  }
  let current = rootResolution.canonicalRoot;
  for (const component of components) {
    current = path.join(current, component);
    let entry: Awaited<ReturnType<typeof fs.lstat>>;
    try {
      entry = await fs.lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new CodeHealthError('SECURITY_BLOCKED', 'raw output directory could not be inspected safely');
    }
    if (entry.isSymbolicLink()) {
      throw new CodeHealthError('SECURITY_BLOCKED', 'raw output directory must not contain symlinks');
    }
    if (!entry.isDirectory()) {
      throw new CodeHealthError('EVIDENCE_INVALID', 'raw output directory must contain directories only');
    }
  }
}

function auditedEnvironment(requested: Record<string, string>, keys: readonly string[]): Record<string, string> {
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
    throw new CodeHealthError('ARG_INVALID', 'env must be a string map');
  }
  const allowed = new Set(keys);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(requested)) {
    if (!allowed.has(key)) {
      throw new CodeHealthError(
        'SECURITY_BLOCKED',
        `redaction blocked: environment key is not explicitly audited: ${key}`,
      );
    }
    if (typeof value !== 'string' || value.includes('\u0000')) {
      throw new CodeHealthError('SECURITY_BLOCKED', `redaction blocked: environment value is unsafe: ${key}`);
    }
    const sanitized = redactCodeHealthArtifact({ [key]: value });
    if (sanitized.status === 'blocked') {
      throw new CodeHealthError('SECURITY_BLOCKED', `redaction blocked: ${sanitized.reasons.join('; ')}`);
    }
    const output = sanitized.value as Record<string, string>;
    if (output[key] !== value) {
      throw new CodeHealthError('SECURITY_BLOCKED', `redaction blocked: environment value requires redaction: ${key}`);
    }
    result[key] = value;
  }
  return result;
}

function redactedText(value: unknown): string {
  const result = redactCodeHealthArtifact(value);
  if (result.status === 'blocked') {
    throw new CodeHealthError('SECURITY_BLOCKED', `redaction blocked: ${result.reasons.join('; ')}`);
  }
  return JSON.stringify(result.value);
}

function decodeOutput(stdout: Buffer, stderr: Buffer): string {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return `${decoder.decode(stdout)}${decoder.decode(stderr)}`;
  } catch {
    throw new CodeHealthError('SECURITY_BLOCKED', 'redaction blocked: command output is not valid UTF-8');
  }
}

export function createCodeHealthCommandRunner(options: CodeHealthCommandRunnerOptions): CodeHealthCommandRunner {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const now = options.now ?? (() => new Date());
  const rawOutputDir = toRepositoryRelative(repositoryRoot, options.rawOutputDir, 'rawOutputDir');
  if (rawOutputDir !== '.') {
    const rawOutputResolution = resolveControlledRelativePath(repositoryRoot, rawOutputDir);
    if (!rawOutputResolution.ok) {
      throw new CodeHealthError(
        rawOutputResolution.code ?? 'STRUCTURE_INVALID',
        rawOutputResolution.reason ?? 'rawOutputDir must be a controlled repository-relative directory',
      );
    }
  }
  const auditedKeys = options.auditedEnvironmentKeys ?? DEFAULT_AUDITED_ENVIRONMENT_KEYS;

  return {
    async run(command, args, runOptions): Promise<CommandEvidence> {
      validateInvocation(command, args);
      if (!Number.isFinite(runOptions.timeoutMs) || runOptions.timeoutMs < 0) {
        throw new CodeHealthError('ARG_INVALID', 'timeoutMs must be non-negative');
      }
      const relativeCwd = toRepositoryRelative(repositoryRoot, runOptions.cwd, 'cwd');
      const absoluteCwd = path.resolve(repositoryRoot, relativeCwd);
      const environment = auditedEnvironment(runOptions.env, auditedKeys);

      const binding = runOptions.binding;
      if (!binding || typeof binding !== 'object' || !binding.candidate || !binding.revision) {
        throw new CodeHealthError('ARG_INVALID', 'command evidence binding must carry candidate and revision');
      }
      const revisionResult = await options.revisionProvider.verify(repositoryRoot, binding.revision);
      if (!revisionResult.ok) {
        throw new CodeHealthError('REVISION_MISMATCH', revisionResult.reason ?? 'command evidence revision is stale', {
          expectedRevision: binding.revision,
          actualRevision: revisionResult.actual ?? undefined,
          candidateId: binding.candidate.candidateId,
          scopeHash: binding.candidate.scopeHash,
        });
      }

      await assertControlledDirectoryChain(repositoryRoot, rawOutputDir.split('/'));

      const started = now();
      const outputName = `${started.toISOString().replace(/[^0-9]/g, '')}-${randomUUID()}.log`;
      const relativePath = rawOutputDir === '.' ? outputName : path.posix.join(rawOutputDir, outputName);
      let output = '';
      let exitCode: number | null = null;
      let observation: EvidenceObservationStatus = 'not_run';
      try {
        const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
          const child = spawn(command, args, {
            cwd: absoluteCwd,
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
        if (error instanceof CodeHealthError) throw error;
        output = redactedText({ output: error instanceof Error ? error.message : String(error) });
        observation = observationFor(error);
      }
      const stored = await options.evidenceStore.putRawOutput({
        candidateId: binding.candidate.candidateId,
        scopeHash: binding.candidate.scopeHash,
        relativePath,
        bytes: Buffer.from(output, 'utf8'),
      });
      const ended = now();
      const safeCommand = redactedText({ command, args });
      return {
        command: safeCommand,
        cwd: relativeCwd,
        environment,
        platform: process.platform,
        toolVersions: { node: process.version },
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        exitCode,
        observation,
        rawOutputPath: stored.relativePath,
        rawOutputSha256: stored.sha256,
      };
    },
  };
}
