/* eslint-disable security/detect-non-literal-fs-filename -- Dynamic paths are constrained by real-root, ancestor, and stable-snapshot checks before each I/O operation. */
/** Sanitized runtime evidence export and integrity verification. */
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { evidenceFs as fs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

export type EvidenceKind = 'gate-log' | 'verifier-output' | 'signature-chain' | 'codegraph-query' | 'run-log';

type EvidenceFile = { path: string; sha256: string; kind: EvidenceKind };
type EvidenceManifest = { schemaVersion: '1.0'; exportedAt: string; sourceProject: string; files: EvidenceFile[] };
type FailureReason =
  | 'INVALID_JSON_EVIDENCE'
  | 'INVALID_JSONL_EVIDENCE'
  | 'UNSAFE_OUTPUT_PATH'
  | 'UNSAFE_SOURCE_PATH'
  | 'UNSAFE_EVIDENCE_CONTENT'
  | 'NONEMPTY_OUTPUT'
  | 'INVALID_MANIFEST'
  | 'UNMANIFESTED_OUTPUT'
  | 'HASH_MISMATCH'
  | 'EVIDENCE_EXPORT_FAILED';

export interface EvidenceExportResult {
  ok: boolean;
  exitCode: 0 | 1 | 2;
  mode: 'export' | 'verify';
  outputDir?: string;
  manifestPath?: string;
  exportedFiles?: number;
  reason?: FailureReason | 'INPUT_NOT_FOUND';
}

const MANIFEST_NAME = 'evidence-manifest.json';
const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set(['token', 'secret', 'password', 'apikey']);
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.txt']);
const DIRECTORY_SOURCES: Array<{ directory: string; kind: EvidenceKind }> = [
  { directory: 'gate-logs', kind: 'gate-log' },
  { directory: 'verifier-outputs', kind: 'verifier-output' },
  { directory: 'signature-chains', kind: 'signature-chain' },
  { directory: 'codegraph-queries', kind: 'codegraph-query' },
];
const comparePaths = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

class EvidenceFailure extends Error {
  constructor(
    readonly exitCode: 1 | 2,
    readonly reason: FailureReason | 'INPUT_NOT_FOUND',
  ) {
    super(reason);
  }
}

type Snapshot = { realPath: string; ino: number; size: number; mtimeMs: number; directory: boolean };
function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath === MANIFEST_NAME)
    return false;
  const normalized = path.posix.normalize(relativePath);
  return (
    normalized === relativePath &&
    normalized !== '..' &&
    !normalized.startsWith('../') &&
    !normalized.split('/').includes('..')
  );
}
async function lstatOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function snapshot(target: string, expectedDirectory?: boolean): Promise<Snapshot> {
  const stat = await fs.lstat(target);
  if (
    stat.isSymbolicLink() ||
    (!stat.isFile() && !stat.isDirectory()) ||
    (expectedDirectory !== undefined && stat.isDirectory() !== expectedDirectory)
  ) {
    throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
  }
  return {
    realPath: await fs.realpath(target),
    ino: stat.ino,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    directory: stat.isDirectory(),
  };
}
function sameSnapshot(left: Snapshot, right: Snapshot): boolean {
  return (
    left.realPath === right.realPath &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.directory === right.directory
  );
}
async function assertStable(target: string, before: Snapshot, root: string): Promise<void> {
  const after = await snapshot(target, before.directory);
  if (!sameSnapshot(before, after) || !isPathInside(after.realPath, root))
    throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
}
async function assertRealDirectory(target: string): Promise<void> {
  const stat = await lstatOrNull(target);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new EvidenceFailure(2, 'INPUT_NOT_FOUND');
}

/** Rejects every existing output ancestor symlink and verifies the intended non-existent tail against sourceReal. */
async function assertSafeOutputPath(output: string, sourceReal: string): Promise<void> {
  const absolute = path.resolve(output);
  const existing: string[] = [];
  let cursor = absolute;
  while ((await lstatOrNull(cursor)) === null) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
    cursor = parent;
  }
  const ancestor = cursor;
  const parts = path.relative(path.parse(absolute).root, ancestor).split(path.sep).filter(Boolean);
  let walked = path.parse(absolute).root;
  for (const part of parts) {
    walked = path.join(walked, part);
    const stat = await fs.lstat(walked);
    if (stat.isSymbolicLink()) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
    existing.push(walked);
  }
  const ancestorReal = await fs.realpath(ancestor);
  if (isPathInside(path.join(ancestorReal, path.relative(ancestor, absolute)), sourceReal)) {
    throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
  }
  if (existing.some((entry) => isPathInside(entry, sourceReal))) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
}

async function collectDirectoryFiles(root: string, current: string, result: string[]): Promise<void> {
  const before = await snapshot(current, true);
  if (!isPathInside(before.realPath, root)) throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
  const entries = await fs.readdir(current, { withFileTypes: true });
  await assertStable(current, before, root);
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    const child = await snapshot(entryPath);
    if (!isPathInside(child.realPath, root)) throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
    if (child.directory) {
      await collectDirectoryFiles(root, entryPath, result);
      continue;
    }
    const relativePath = path.relative(root, entryPath).split(path.sep).join('/');
    if (!isSafeRelativePath(relativePath) || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      throw new EvidenceFailure(1, 'UNSAFE_EVIDENCE_CONTENT');
    }
    await assertStable(entryPath, child, root);
    result.push(relativePath);
  }
  await assertStable(current, before, root);
}
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(nested),
      ]),
    );
  }
  return value;
}
function sanitizeContent(sourcePath: string, content: Buffer): Buffer {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension) || content.includes(0)) throw new EvidenceFailure(1, 'UNSAFE_EVIDENCE_CONTENT');
  const text = content.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(content) !== 0) throw new EvidenceFailure(1, 'UNSAFE_EVIDENCE_CONTENT');
  if (extension === '.json') {
    try {
      return Buffer.from(JSON.stringify(redact(JSON.parse(text)), null, 2) + '\n', 'utf8');
    } catch {
      throw new EvidenceFailure(1, 'INVALID_JSON_EVIDENCE');
    }
  }
  if (extension === '.jsonl') {
    const output: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        output.push(JSON.stringify(redact(JSON.parse(line))));
      } catch {
        throw new EvidenceFailure(1, 'INVALID_JSONL_EVIDENCE');
      }
    }
    return Buffer.from(output.length > 0 ? output.join('\n') + '\n' : '', 'utf8');
  }
  return content;
}
async function atomicWrite(target: string, content: string | Buffer): Promise<void> {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, content);
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}
async function ensureEmptyOutput(output: string, sourceReal: string): Promise<void> {
  await assertSafeOutputPath(output, sourceReal);
  const existing = await lstatOrNull(output);
  if (!existing) return;
  if (!existing.isDirectory() || existing.isSymbolicLink()) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
  if ((await fs.readdir(output)).length > 0) throw new EvidenceFailure(1, 'NONEMPTY_OUTPUT');
  await fs.rmdir(output);
}
function failure(mode: 'export' | 'verify', error: unknown): EvidenceExportResult {
  if (error instanceof EvidenceFailure) return { ok: false, exitCode: error.exitCode, mode, reason: error.reason };
  return { ok: false, exitCode: 1, mode, reason: 'EVIDENCE_EXPORT_FAILED' };
}

export async function exportEvidence(projectDir: string, outputDir: string): Promise<EvidenceExportResult> {
  let staging: string | undefined;
  try {
    const project = path.resolve(projectDir);
    await assertRealDirectory(project);
    const state = path.join(project, '.w-model');
    await assertRealDirectory(state);
    const sourceReal = await fs.realpath(state);
    const output = path.resolve(outputDir);
    await ensureEmptyOutput(output, sourceReal);
    staging = `${output}.tmp-${randomUUID()}`;
    await assertSafeOutputPath(staging, sourceReal);
    await fs.mkdir(staging);
    const sources: Array<{ sourceRelative: string; kind: EvidenceKind }> = [];
    for (const { directory, kind } of DIRECTORY_SOURCES) {
      const directoryPath = path.join(state, directory);
      if (!(await lstatOrNull(directoryPath))) continue;
      const files: string[] = [];
      await collectDirectoryFiles(sourceReal, directoryPath, files);
      sources.push(...files.map((sourceRelative) => ({ sourceRelative, kind })));
    }
    const runLog = path.join(state, 'run-log.jsonl');
    if (await lstatOrNull(runLog)) sources.push({ sourceRelative: 'run-log.jsonl', kind: 'run-log' });
    const seen = new Set<string>();
    const files: EvidenceFile[] = [];
    for (const source of sources.sort((a, b) => comparePaths(a.sourceRelative, b.sourceRelative))) {
      if (!isSafeRelativePath(source.sourceRelative) || seen.has(source.sourceRelative))
        throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
      seen.add(source.sourceRelative);
      const sourcePath = path.join(state, source.sourceRelative);
      const before = await snapshot(sourcePath, false);
      if (!isPathInside(before.realPath, sourceReal)) throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
      const sanitized = sanitizeContent(sourcePath, await fs.readFile(sourcePath));
      await assertStable(sourcePath, before, sourceReal);
      const target = path.join(staging, source.sourceRelative);
      if (!isPathInside(target, staging)) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await atomicWrite(target, sanitized);
      files.push({ path: source.sourceRelative, sha256: sha256(sanitized), kind: source.kind });
    }
    const manifest: EvidenceManifest = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      sourceProject: '<redacted-project>',
      files: files.sort((a, b) => comparePaths(a.path, b.path)),
    };
    if (!validateBySchema('evidence-manifest', manifest).valid) throw new EvidenceFailure(1, 'INVALID_MANIFEST');
    await atomicWrite(path.join(staging, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n');
    await assertSafeOutputPath(output, sourceReal);
    await assertSafeOutputPath(staging, sourceReal);
    await fs.rename(staging, output);
    staging = undefined;
    return {
      ok: true,
      exitCode: 0,
      mode: 'export',
      outputDir: output,
      manifestPath: path.join(output, MANIFEST_NAME),
      exportedFiles: files.length,
    };
  } catch (error) {
    if (staging) await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    return failure('export', error);
  }
}
async function collectOutputFiles(root: string, current: string, result: string[]): Promise<void> {
  const before = await snapshot(current, true);
  const entries = await fs.readdir(current, { withFileTypes: true });
  await assertStable(current, before, root);
  for (const entry of entries) {
    const target = path.join(current, entry.name);
    const child = await snapshot(target);
    if (!isPathInside(child.realPath, root)) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
    if (child.directory) await collectOutputFiles(root, target, result);
    else result.push(path.relative(root, target).split(path.sep).join('/'));
  }
  await assertStable(current, before, root);
}
export async function verifyEvidence(manifestPath: string): Promise<EvidenceExportResult> {
  try {
    const absolute = path.resolve(manifestPath);
    const output = path.dirname(absolute);
    const outputReal = await fs.realpath(output);
    const manifestBefore = await snapshot(absolute, false);
    let manifest: unknown;
    try {
      manifest = JSON.parse(await fs.readFile(absolute, 'utf8'));
    } catch {
      throw new EvidenceFailure(1, 'INVALID_MANIFEST');
    }
    await assertStable(absolute, manifestBefore, outputReal);
    if (!validateBySchema('evidence-manifest', manifest).valid) throw new EvidenceFailure(1, 'INVALID_MANIFEST');
    const typed = manifest as EvidenceManifest;
    const expected = new Set<string>();
    for (const file of typed.files) {
      if (!isSafeRelativePath(file.path) || expected.has(file.path)) throw new EvidenceFailure(1, 'INVALID_MANIFEST');
      expected.add(file.path);
      const target = path.resolve(output, file.path);
      if (!isPathInside(target, output)) throw new EvidenceFailure(1, 'INVALID_MANIFEST');
      const targetStat = await fs.lstat(target);
      if (targetStat.isSymbolicLink()) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      const before = await snapshot(target, false);
      if (!isPathInside(before.realPath, outputReal)) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      const content = await fs.readFile(target);
      await assertStable(target, before, outputReal);
      if (sha256(content) !== file.sha256) throw new EvidenceFailure(1, 'HASH_MISMATCH');
    }
    const actual: string[] = [];
    await collectOutputFiles(outputReal, outputReal, actual);
    const allowed = new Set([...expected, MANIFEST_NAME]);
    if (actual.some((entry) => !allowed.has(entry)) || actual.length !== allowed.size)
      throw new EvidenceFailure(1, 'UNMANIFESTED_OUTPUT');
    return { ok: true, exitCode: 0, mode: 'verify', manifestPath: absolute, exportedFiles: typed.files.length };
  } catch (error) {
    return failure('verify', error);
  }
}
