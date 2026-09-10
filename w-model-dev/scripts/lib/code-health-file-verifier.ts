/* eslint-disable security/detect-non-literal-fs-filename -- Every path is resolved beneath an explicit caller-owned root and validated component by component before any read. */
/**
 * Injected FileVerifier: repository-relative, regular, non-symlink file hashing over an explicit root.
 *
 * Safety invariants (from the approved 1B design):
 *   - only repository-relative POSIX paths are accepted; absolute paths, backslashes, NUL, empty
 *     components, `.` / `..`, and paths resolving outside the root are rejected before any fs access;
 *   - the root and every parent directory must exist as non-symlink directories;
 *   - the target must be a regular non-symlink file whose realpath stays inside the controlled root;
 *   - content is hashed as bytes and must match the declared SHA-256 exactly;
 *   - no partial success is returned and reasons never leak absolute paths.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { ErrorCode, FileVerificationResult, FileVerifier } from '../logic/code-health-contract.js';

const HEX64_PATTERN = /^[0-9a-f]{64}$/;

export interface ControlledPathResolution {
  ok: boolean;
  code: ErrorCode | null;
  absolutePath?: string;
  reason?: string;
}

/** True when `child` is `parent` itself or a descendant of it. */
export function isPathWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Resolve a repository-relative POSIX path beneath an explicit root without touching the filesystem.
 * Rejects empty paths, absolute POSIX/Windows paths, backslashes, NUL, empty components, `.` / `..`,
 * and any resolution that escapes the root.
 */
export function resolveControlledRelativePath(root: string, relativePath: unknown): ControlledPathResolution {
  if (typeof root !== 'string' || root.length === 0) {
    return { ok: false, code: 'STRUCTURE_INVALID', reason: 'root must be an explicit non-empty directory path' };
  }
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    return {
      ok: false,
      code: 'STRUCTURE_INVALID',
      reason: 'relativePath must be a non-empty repository-relative path',
    };
  }
  if (relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath) || relativePath.includes('\\')) {
    return {
      ok: false,
      code: 'STRUCTURE_INVALID',
      reason: 'relativePath must be a repository-relative POSIX path',
    };
  }
  if (relativePath.includes('\u0000')) {
    return { ok: false, code: 'STRUCTURE_INVALID', reason: 'relativePath must not contain NUL' };
  }
  const components = relativePath.split('/');
  if (components.some((component) => component === '' || component === '.' || component === '..')) {
    return {
      ok: false,
      code: 'STRUCTURE_INVALID',
      reason: 'relativePath must not contain empty, current, or parent components',
    };
  }
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, ...components);
  if (!isPathWithin(resolvedRoot, absolutePath)) {
    return { ok: false, code: 'STRUCTURE_INVALID', reason: 'relativePath resolves outside the controlled root' };
  }
  return { ok: true, code: null, absolutePath };
}

async function lstatOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function createCodeHealthFileVerifier(): FileVerifier {
  return {
    async verifyRegularNonSymlinkFile(input): Promise<FileVerificationResult> {
      const relativePath = typeof input?.relativePath === 'string' ? input.relativePath : '';
      const expectedSha256 = typeof input?.expectedSha256 === 'string' ? input.expectedSha256 : '';
      const failed = (code: ErrorCode, reason: string, actualSha256?: string): FileVerificationResult => ({
        ok: false,
        code,
        relativePath,
        expectedSha256,
        ...(actualSha256 === undefined ? {} : { actualSha256 }),
        reason,
      });

      const resolution = resolveControlledRelativePath(input?.root, relativePath);
      if (!resolution.ok || !resolution.absolutePath) {
        return failed(resolution.code ?? 'STRUCTURE_INVALID', resolution.reason ?? 'path is not controlled');
      }
      if (!HEX64_PATTERN.test(expectedSha256)) {
        return failed('STRUCTURE_INVALID', 'expectedSha256 must be a lowercase SHA-256 digest');
      }

      const resolvedRoot = path.resolve(input.root);
      const rootEntry = await lstatOrNull(resolvedRoot);
      if (!rootEntry || rootEntry.isSymbolicLink() || !rootEntry.isDirectory()) {
        return failed('STRUCTURE_INVALID', 'root must be an existing non-symlink directory');
      }

      const parentComponents = relativePath.split('/').slice(0, -1);
      let current = resolvedRoot;
      for (const component of parentComponents) {
        current = path.join(current, component);
        const entry = await lstatOrNull(current);
        if (!entry) return failed('EVIDENCE_INVALID', 'parent directory is missing beneath the controlled root');
        if (entry.isSymbolicLink()) return failed('SECURITY_BLOCKED', 'path must not traverse a symlinked directory');
        if (!entry.isDirectory()) return failed('EVIDENCE_INVALID', 'parent path must be a directory');
      }

      const targetEntry = await lstatOrNull(resolution.absolutePath);
      if (!targetEntry) return failed('EVIDENCE_INVALID', 'file is missing beneath the controlled root');
      if (targetEntry.isSymbolicLink()) return failed('SECURITY_BLOCKED', 'target must not be a symlink');
      if (!targetEntry.isFile()) return failed('EVIDENCE_INVALID', 'target must be a regular file');

      let bytes: Buffer;
      try {
        bytes = await fs.readFile(resolution.absolutePath);
      } catch {
        return failed('EVIDENCE_INVALID', 'file could not be read safely');
      }
      const actualSha256 = createHash('sha256').update(bytes).digest('hex');

      const afterEntry = await lstatOrNull(resolution.absolutePath);
      const realPath = await fs.realpath(resolution.absolutePath).catch(() => null);
      if (
        !afterEntry ||
        afterEntry.isSymbolicLink() ||
        !afterEntry.isFile() ||
        realPath === null ||
        path.resolve(realPath) !== path.resolve(resolution.absolutePath) ||
        !isPathWithin(resolvedRoot, realPath)
      ) {
        return failed('SECURITY_BLOCKED', 'target changed or escaped the controlled root during verification');
      }
      if (actualSha256 !== expectedSha256) {
        return failed('EVIDENCE_INVALID', 'file SHA-256 does not match the declared hash', actualSha256);
      }
      return { ok: true, code: null, relativePath, expectedSha256, actualSha256 };
    },
  };
}
