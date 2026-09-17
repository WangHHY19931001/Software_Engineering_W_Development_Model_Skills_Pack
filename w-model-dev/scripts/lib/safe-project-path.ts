import { lstatSync, realpathSync, type Stats } from 'node:fs';
import * as path from 'node:path';

export type SafeProjectPathReason = 'absolute' | 'invalid-segment' | 'outside-root' | 'link' | 'not-file' | 'missing';

/** A project-relative path failed the filesystem boundary checks. */
export class SafeProjectPathError extends Error {
  readonly reason: SafeProjectPathReason;

  constructor(reason: SafeProjectPathReason) {
    super(`unsafe project-relative path (${reason})`);
    this.name = 'SafeProjectPathError';
    this.reason = reason;
  }
}

function reject(reason: SafeProjectPathReason): never {
  throw new SafeProjectPathError(reason);
}

function lstatOrReject(candidate: string): Stats {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 本 helper 的职责就是检查调用方给出的任意候选路径（先 lstat 再判 containment），该路径本身即被审查对象
    return lstatSync(candidate);
  } catch {
    return reject('missing');
  }
}

function realpathOrReject(candidate: string): string {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上：realpath 是本 helper 的 containment 判据，候选路径即被审查对象
    return realpathSync(candidate);
  } catch {
    return reject('missing');
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Resolves a project-local regular file without following symlink or junction
 * entries. Both the input and every existing path component are checked before
 * the canonical target is returned.
 */
export function resolveProjectRelativeRegularFile(projectRoot: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || relativePath.includes('\u0000')) {
    return reject('invalid-segment');
  }
  if (
    relativePath.startsWith('/') ||
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return reject('absolute');
  }
  if (relativePath.includes('\\')) return reject('invalid-segment');

  const segments = relativePath.split('/');
  if (segments.some((segment) => segment === '' || segment === '..')) return reject('invalid-segment');

  const lexicalRoot = path.resolve(projectRoot);
  const rootStat = lstatOrReject(lexicalRoot);
  if (rootStat.isSymbolicLink()) return reject('link');
  if (!rootStat.isDirectory()) return reject('not-file');
  const canonicalRoot = realpathOrReject(lexicalRoot);

  let current = lexicalRoot;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const stat = lstatOrReject(current);
    if (stat.isSymbolicLink()) return reject('link');
    if (index < segments.length - 1 && !stat.isDirectory()) return reject('not-file');
  }

  const finalStat = lstatOrReject(current);
  if (!finalStat.isFile()) return reject('not-file');
  const canonicalFile = realpathOrReject(current);
  if (!isWithinRoot(canonicalRoot, canonicalFile)) return reject('outside-root');
  return canonicalFile;
}
