import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { evidenceFs as fs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

import { buildGateLogKeys, checkRunLog, type RunLogEntry } from './run-log-logic.js';
import { checkSignatureChain, type SignatureChainEntry } from './signature-chain-logic.js';

const PROVENANCE_NAME = 'evidence-provenance.json';
const PRODUCER_VERSION = 'D7B-1';
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.txt', '.md']);
type Kind = 'gate-log' | 'verifier-output' | 'signature-chain' | 'codegraph-query' | 'run-log';
type Measurement = { count: number; contentHash: string };
export type SourceFile = { path: string; kind: Kind; sha256: string };
type MeasurementKey = 'gateLogs' | 'verifierOutputs' | 'runLog' | 'signatureChain' | 'codegraphQueries';
export type SourceProvenance = {
  format: 'w-model-evidence-source-provenance';
  version: 1;
  runId: string;
  artifactId: string;
  commitSha: string;
  verifiedAt: string;
  verificationStatus: 'passed';
  measurements: Record<MeasurementKey, Measurement>;
  sourceFiles: SourceFile[];
  sourceBundleSha256: string;
  producerVersion: string;
  provenanceSha256: string;
};
export type ProvenanceResult = {
  ok: boolean;
  exitCode: 0 | 1 | 2;
  reason?: string;
  provenance?: SourceProvenance;
  verificationLevel?: 'source-bound';
  verificationStatus?: 'passed';
};

class ProvenanceFailure extends Error {
  constructor(
    readonly exitCode: 1 | 2,
    readonly reason: string,
  ) {
    super(reason);
  }
}
function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
function hashList(files: Array<{ path: string; sha256: string }>): string {
  return sha256(
    JSON.stringify(
      [...files]
        .map(({ path: filePath, sha256: fileHash }) => ({
          path: filePath,
          sha256: fileHash,
        }))
        .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
    ),
  );
}
function canonicalProvenanceDigest(provenance: Omit<SourceProvenance, 'provenanceSha256'> | SourceProvenance): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit digest field before hashing canonical provenance
  const { provenanceSha256: _ignored, ...canonical } = provenance as SourceProvenance;
  return sha256(JSON.stringify(canonical));
}
function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Walks the lexical path one component at a time. lstat prevents following a
 * symlink/junction, while the realpath comparison catches other reparse-point
 * redirections without rejecting ordinary case-normalized paths on Windows.
 */
async function assertLexicalPath(target: string, missingTailAllowed = false): Promise<void> {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  const relative = path.relative(parsed.root, absolute);
  let lexical = parsed.root;
  let canonical = await fs.realpath(parsed.root);
  const parts = relative ? relative.split(path.sep).filter(Boolean) : [];
  for (const [index, part] of parts.entries()) {
    lexical = path.join(lexical, part);
    let stat: import('node:fs').Stats;
    try {
      stat = await fs.lstat(lexical);
    } catch (error) {
      if (missingTailAllowed && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    }
    if (stat.isSymbolicLink()) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    const nextCanonical = await fs.realpath(lexical);
    const canonicalRelative = path.relative(canonical, nextCanonical);
    const canonicalParts = canonicalRelative.split(path.sep).filter(Boolean);
    if (canonicalRelative.startsWith('..') || path.isAbsolute(canonicalRelative) || canonicalParts.length > 1)
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    canonical = nextCanonical;
    if (index === parts.length - 1 && !stat.isDirectory() && !stat.isFile())
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  }
}

async function assertCanonicalPath(target: string, root: string, missingAllowed = false): Promise<string> {
  await assertLexicalPath(target, missingAllowed);
  let stat: import('node:fs').Stats;
  try {
    stat = await fs.lstat(target);
  } catch (error) {
    if (missingAllowed && (error as NodeJS.ErrnoException).code === 'ENOENT') return path.resolve(target);
    throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  }
  if (stat.isSymbolicLink()) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  const real = await fs.realpath(target);
  if (!isPathInside(real, root)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  return real;
}

async function assertProjectRoot(project: string): Promise<string> {
  try {
    await assertLexicalPath(project);
    const stat = await fs.lstat(project);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe project');
    return await fs.realpath(project);
  } catch {
    throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  }
}

async function failIfSymlinkedAncestor(target: string, _stopAt: string): Promise<void> {
  await assertLexicalPath(target);
}
function fail(error: unknown): ProvenanceResult {
  return error instanceof ProvenanceFailure
    ? { ok: false, exitCode: error.exitCode, reason: error.reason }
    : { ok: false, exitCode: 1, reason: 'INVALID_SOURCE_PROVENANCE' };
}
async function gitHead(project: string): Promise<string> {
  try {
    const gitEntry = path.join(project, '.git');
    const gitStat = await fs.lstat(gitEntry);
    let gitDir = gitEntry;
    if (gitStat.isFile()) {
      const pointer = (await fs.readFile(gitEntry, 'utf8')).trim();
      const match = /^gitdir:\s*(.+)$/.exec(pointer);
      if (!match?.[1]) throw new Error('invalid gitdir pointer');
      gitDir = path.resolve(project, match[1].trim());
      await failIfSymlinkedAncestor(gitDir, path.parse(gitDir).root);
      const gitDirStat = await fs.lstat(gitDir);
      if (!gitDirStat.isDirectory() || gitDirStat.isSymbolicLink()) throw new Error('invalid git metadata directory');
    } else if (!gitStat.isDirectory() || gitStat.isSymbolicLink()) {
      throw new Error('invalid git metadata directory');
    }
    const gitDirReal = await fs.realpath(gitDir);
    const headPath = path.join(gitDir, 'HEAD');
    await assertCanonicalPath(headPath, gitDirReal);
    const head = (await readStableFile(headPath, gitDirReal)).toString('utf8').trim();
    let value = head;
    if (head.startsWith('ref: ')) {
      const refPath = path.join(gitDir, head.slice('ref: '.length));
      await assertCanonicalPath(refPath, gitDirReal);
      value = (await readStableFile(refPath, gitDirReal)).toString('utf8').trim();
    }
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error('invalid HEAD');
    return value;
  } catch (error) {
    if (error instanceof ProvenanceFailure) throw error;
    throw new ProvenanceFailure(1, 'MISSING_GIT_HEAD');
  }
}
type FileSnapshot = {
  realPath: string;
  dev: number;
  ino: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
};
function sameFileSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.realPath === right.realPath &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}
function sameFileStat(snapshot: FileSnapshot, stat: import('node:fs').Stats): boolean {
  return (
    snapshot.dev === stat.dev &&
    snapshot.ino === stat.ino &&
    snapshot.size === stat.size &&
    snapshot.mtimeMs === stat.mtimeMs &&
    snapshot.ctimeMs === stat.ctimeMs
  );
}
async function snapshotFile(file: string, root: string): Promise<FileSnapshot> {
  await assertLexicalPath(file);
  const stat = await fs.lstat(file).catch(() => {
    throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  });
  if (!stat.isFile() || stat.isSymbolicLink()) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  const realPath = await fs.realpath(file);
  if (!isPathInside(realPath, root)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  return {
    realPath,
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
  };
}
async function readStableFile(file: string, root: string, missingReason?: string): Promise<Buffer> {
  let before: FileSnapshot;
  try {
    before = await snapshotFile(file, root);
  } catch (error) {
    if (missingReason && (error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new ProvenanceFailure(1, missingReason);
    throw error;
  }
  const handle = await fs.open(file, 'r');
  try {
    const opened = await handle.stat();
    if (!sameFileStat(before, opened)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    const content = await handle.readFile();
    const read = await handle.stat();
    const after = await snapshotFile(file, root);
    if (!sameFileStat(before, read) || !sameFileSnapshot(before, after))
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    if (content.includes(0) || Buffer.from(content.toString('utf8'), 'utf8').compare(content) !== 0)
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    return content;
  } finally {
    await handle.close();
  }
}
async function readJson(file: string, root: string): Promise<unknown> {
  try {
    return JSON.parse((await readStableFile(file, root)).toString('utf8'));
  } catch (error) {
    if (error instanceof ProvenanceFailure) throw error;
    throw new ProvenanceFailure(1, 'INVALID_SOURCE_EVIDENCE');
  }
}
async function readJsonl(file: string, root: string, missingReason: string): Promise<unknown[]> {
  let content: string;
  try {
    content = (await readStableFile(file, root, missingReason)).toString('utf8');
  } catch (error) {
    if (error instanceof ProvenanceFailure) throw error;
    throw new ProvenanceFailure(1, missingReason);
  }
  try {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch {
    throw new ProvenanceFailure(1, 'INVALID_SOURCE_EVIDENCE');
  }
}
async function collectDirectory(
  state: string,
  stateReal: string,
  directory: string,
  kind: Kind,
  required: boolean,
): Promise<SourceFile[]> {
  const absolute = path.join(state, directory);
  const directoryReal = await assertCanonicalPath(absolute, stateReal, !required);
  if (directoryReal === path.resolve(absolute) && !(await fs.lstat(absolute).catch(() => null))) {
    if (required) throw new ProvenanceFailure(1, `MISSING_${directory.toUpperCase().replace('-', '_')}`);
    return [];
  }
  const files: SourceFile[] = [];
  async function walk(current: string, relativeDirectory: string): Promise<void> {
    const currentReal = await assertCanonicalPath(current, stateReal);
    const before = await snapshotPath(current, stateReal, true);
    const entries = (await fs.readdir(current, { withFileTypes: true })) as import('node:fs').Dirent[];
    const after = await snapshotPath(current, stateReal, true);
    if (!before || !after || !samePathSnapshot(before, after)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryPath = path.join(current, entry.name);
      const relative = `${relativeDirectory}/${entry.name}`;
      const entryStat = await fs.lstat(entryPath).catch(() => null);
      if (!entryStat || entryStat.isSymbolicLink()) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      const entryReal = await fs.realpath(entryPath);
      if (!isPathInside(entryReal, stateReal) || !isPathInside(entryReal, currentReal))
        throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      if (entryStat.isDirectory()) {
        await walk(entryPath, relative);
        continue;
      }
      if (!entryStat.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      const content = await readStableFile(entryPath, stateReal);
      files.push({ path: relative, kind, sha256: sha256(content) });
    }
    const final = await snapshotPath(current, stateReal, true);
    if (!final || !samePathSnapshot(before, final)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  }
  await walk(absolute, directory);
  return files;
}
function measurements(files: SourceFile[]): SourceProvenance['measurements'] {
  const of = (kind: Kind): Measurement => {
    const selected = files.filter((file) => file.kind === kind);
    return { count: selected.length, contentHash: hashList(selected) };
  };
  return {
    gateLogs: of('gate-log'),
    verifierOutputs: of('verifier-output'),
    runLog: of('run-log'),
    signatureChain: of('signature-chain'),
    codegraphQueries: of('codegraph-query'),
  };
}
async function buildSourceProvenance(projectDir: string, verifiedAt?: string): Promise<SourceProvenance> {
  const project = path.resolve(projectDir);
  const projectReal = await assertProjectRoot(project);
  const state = path.join(project, '.w-model');
  const stateReal = await assertCanonicalPath(state, projectReal);
  if (!isPathInside(stateReal, projectReal)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  const commitSha = await gitHead(project);
  const gateFiles = await collectDirectory(state, stateReal, 'gate-logs', 'gate-log', true);
  const verifierFiles = await collectDirectory(state, stateReal, 'verifier-outputs', 'verifier-output', false);
  const signatureFiles = await collectDirectory(state, stateReal, 'signature-chains', 'signature-chain', false);
  const codegraphFiles = await collectDirectory(state, stateReal, 'codegraph-queries', 'codegraph-query', false);
  const runLogPath = path.join(state, 'run-log.jsonl');
  const runLogContent = await readStableFile(runLogPath, stateReal, 'MISSING_RUN_LOG');
  const runLogEntries = await readJsonl(runLogPath, stateReal, 'MISSING_RUN_LOG');
  const runFile: SourceFile = { path: 'run-log.jsonl', kind: 'run-log', sha256: sha256(runLogContent) };
  const gateLogs = new Map<string, { exitCode?: number; content: string }>();
  const gateBasenames = new Set<string>();
  for (const file of gateFiles) {
    const absolute = path.join(state, file.path);
    const contentBuffer = await readStableFile(absolute, stateReal);
    const content = contentBuffer.toString('utf8');
    const value = JSON.parse(content) as Record<string, unknown>;
    if (!validateBySchema('gate-log', value).valid) throw new ProvenanceFailure(1, 'GATE_NOT_PASSED');
    const stdoutSummary = value.stdoutSummary as { exitCode?: unknown; passed?: unknown } | undefined;
    if (
      value.passed !== true ||
      value.exitCode !== 0 ||
      value.reportSummary === null ||
      (value.reportSummary as Record<string, unknown>).exitCode !== value.exitCode ||
      (value.reportSummary as Record<string, unknown>).passed !== value.passed ||
      stdoutSummary?.exitCode !== value.exitCode ||
      stdoutSummary?.passed !== value.passed
    )
      throw new ProvenanceFailure(1, 'GATE_NOT_PASSED');
    const keys = buildGateLogKeys(absolute, project);
    for (const key of keys) gateLogs.set(key, { exitCode: value.exitCode as number, content });
    gateBasenames.add(path.basename(absolute));
  }
  const typedRunLog = runLogEntries as RunLogEntry[];
  const gatePaths = new Set(gateFiles.map((file) => file.path));
  const referencedGateLogs = new Set<string>();
  for (const entry of typedRunLog) {
    if (
      (entry.action === 'gate' || entry.action === 'tla-gate' || entry.action === 'graph-gate') &&
      entry.gateLogPath
    ) {
      const normalized = entry.gateLogPath.replace(/\\/g, '/');
      const matchingPath = [...gatePaths].find(
        (candidate) => candidate === normalized || path.basename(candidate) === path.basename(normalized),
      );
      if (!matchingPath || referencedGateLogs.has(matchingPath)) throw new ProvenanceFailure(1, 'RUN_LOG_NOT_PASSED');
      referencedGateLogs.add(matchingPath);
    }
  }
  if (referencedGateLogs.size !== gatePaths.size) throw new ProvenanceFailure(1, 'RUN_LOG_NOT_PASSED');
  const runCheck = checkRunLog(typedRunLog, { gateLogs });
  if (!runCheck.passed) throw new ProvenanceFailure(1, `RUN_LOG_NOT_PASSED:${runCheck.violations.join('|')}`);
  if (signatureFiles.length === 0) throw new ProvenanceFailure(1, 'MISSING_SIGNATURE_CHAIN');
  const signatureEntries = (
    await Promise.all(
      signatureFiles.map((file) => readJsonl(path.join(state, file.path), stateReal, 'MISSING_SIGNATURE_CHAIN')),
    )
  ).flat();
  if (!checkSignatureChain(signatureEntries as SignatureChainEntry[]).passed)
    throw new ProvenanceFailure(1, 'SIGNATURE_CHAIN_NOT_PASSED');
  const files = [...gateFiles, ...verifierFiles, ...signatureFiles, ...codegraphFiles, runFile].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const runId = String((runLogEntries.at(-1) as { runId?: string } | undefined)?.runId ?? '');
  if (!runId) throw new ProvenanceFailure(1, 'MISSING_RUN_ID');
  const base: Omit<SourceProvenance, 'provenanceSha256'> = {
    format: 'w-model-evidence-source-provenance',
    version: 1,
    runId,
    artifactId: `evidence-${runId}`,
    commitSha,
    verifiedAt: verifiedAt ?? new Date().toISOString(),
    verificationStatus: 'passed',
    measurements: measurements(files),
    sourceFiles: files,
    sourceBundleSha256: hashList(files),
    producerVersion: PRODUCER_VERSION,
  };
  return { ...base, provenanceSha256: canonicalProvenanceDigest(base) };
}
type PathSnapshot = FileSnapshot & { directory: boolean };

function samePathIdentity(left: PathSnapshot, right: PathSnapshot): boolean {
  return (
    left.directory === right.directory &&
    left.realPath === right.realPath &&
    left.dev === right.dev &&
    left.ino === right.ino
  );
}
function samePathSnapshot(left: PathSnapshot, right: PathSnapshot): boolean {
  return (
    samePathIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}
function samePathData(left: PathSnapshot, right: PathSnapshot): boolean {
  return samePathIdentity(left, right) && left.size === right.size && left.mtimeMs === right.mtimeMs;
}
function sameMovedFile(left: PathSnapshot, right: PathSnapshot): boolean {
  return (
    left.directory === right.directory &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

async function snapshotPath(
  target: string,
  root: string,
  expectedDirectory?: boolean,
  missingAllowed = false,
): Promise<PathSnapshot | null> {
  await assertLexicalPath(target, missingAllowed);
  const stat = await fs.lstat(target).catch((error: unknown) => {
    if (missingAllowed && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  });
  if (!stat) return null;
  if (
    stat.isSymbolicLink() ||
    (!stat.isFile() && !stat.isDirectory()) ||
    (expectedDirectory !== undefined && stat.isDirectory() !== expectedDirectory)
  )
    throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  const realPath = await fs.realpath(target);
  if (!isPathInside(realPath, root)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  return {
    realPath,
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
    directory: stat.isDirectory(),
  };
}

async function atomicWrite(
  target: string,
  content: string,
  parentBefore: PathSnapshot,
  targetBefore: PathSnapshot | null,
  parentReal: string,
): Promise<void> {
  const canonicalTarget = path.join(parentReal, path.basename(target));
  const temp = path.join(parentReal, `.${path.basename(target)}.${randomUUID()}.tmp`);
  const backup = path.join(parentReal, `.${path.basename(target)}.${randomUUID()}.bak`);
  const guard = path.join(parentReal, `.${path.basename(target)}.${randomUUID()}.guard`);
  let movedTarget = false;
  let guardCreated = false;
  let backupCreated = false;
  try {
    const currentParent = await snapshotPath(path.dirname(target), parentReal, true);
    if (!currentParent || !samePathIdentity(parentBefore, currentParent))
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    const currentTarget = await snapshotPath(target, parentReal, undefined, true);
    if (
      (targetBefore === null && currentTarget !== null) ||
      (targetBefore !== null && (currentTarget === null || !samePathData(targetBefore, currentTarget)))
    )
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');

    await fs.writeFile(temp, content, { encoding: 'utf8', flag: 'wx' });
    const tempSnapshot = await snapshotPath(temp, parentReal, false);
    if (!tempSnapshot) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');

    // Recheck both names after creating the temp file, immediately before publication.
    const parentBeforePublish = await snapshotPath(path.dirname(target), parentReal, true);
    const targetBeforePublish = await snapshotPath(target, parentReal, undefined, true);
    if (!parentBeforePublish || !samePathIdentity(parentBefore, parentBeforePublish))
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    if (
      (targetBefore === null && targetBeforePublish !== null) ||
      (targetBefore !== null && (targetBeforePublish === null || !samePathSnapshot(targetBefore, targetBeforePublish)))
    )
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');

    // Keep an inode guard while moving an existing destination away. The final
    // hard link is exclusive, so a raced destination is never overwritten.
    if (targetBefore !== null) {
      await fs.link(canonicalTarget, guard);
      guardCreated = true;
      await fs.rename(canonicalTarget, backup);
      backupCreated = true;
      movedTarget = true;
      const moved = await snapshotPath(backup, parentReal, false);
      if (!moved || !sameMovedFile(targetBefore, moved)) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    }

    try {
      await fs.link(temp, canonicalTarget);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      throw error;
    }
    await fs.rm(temp, { force: true });

    const published = await snapshotPath(target, parentReal, false);
    const publishedBytes = await readStableFile(target, parentReal);
    if (
      !published ||
      !isPathInside(published.realPath, parentReal) ||
      publishedBytes.compare(Buffer.from(content, 'utf8')) !== 0
    )
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    const parentAfter = await snapshotPath(path.dirname(target), parentReal, true);
    if (!parentAfter || !samePathIdentity(parentBefore, parentAfter))
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');

    if (backupCreated) await fs.rm(backup, { force: true });
    if (guardCreated) await fs.rm(guard, { force: true });
    movedTarget = false;
    backupCreated = false;
    guardCreated = false;
  } catch (error) {
    if (movedTarget && guardCreated) {
      const current = await snapshotPath(canonicalTarget, parentReal, undefined, true).catch(() => null);
      if (!current) await fs.link(guard, canonicalTarget).catch(() => undefined);
    }
    throw error instanceof ProvenanceFailure ? error : new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    if (backupCreated) await fs.rm(backup, { force: true }).catch(() => undefined);
    if (guardCreated) await fs.rm(guard, { force: true }).catch(() => undefined);
  }
}
export async function produceSourceProvenance(projectDir: string): Promise<ProvenanceResult> {
  try {
    const project = path.resolve(projectDir);
    const projectReal = await assertProjectRoot(project);
    const state = path.join(project, '.w-model');
    const stateReal = await assertCanonicalPath(state, projectReal);
    const provenance = await buildSourceProvenance(project);
    if (!validateBySchema('evidence-provenance', provenance).valid)
      throw new ProvenanceFailure(1, 'INVALID_SOURCE_PROVENANCE');
    const target = path.join(state, PROVENANCE_NAME);
    const parentBefore = await snapshotPath(state, projectReal, true);
    if (!parentBefore) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    const targetBefore = await snapshotPath(target, stateReal, false, true);
    const content = JSON.stringify(provenance, null, 2) + '\n';
    await atomicWrite(target, content, parentBefore, targetBefore, stateReal);
    const parentAfter = await snapshotPath(state, projectReal, true);
    const published = await snapshotPath(target, stateReal, false);
    if (
      !parentAfter ||
      !samePathIdentity(parentBefore, parentAfter) ||
      !published ||
      !isPathInside(published.realPath, stateReal) ||
      (await readStableFile(target, stateReal)).compare(Buffer.from(content, 'utf8')) !== 0
    )
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    return {
      ok: true,
      exitCode: 0,
      provenance,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    };
  } catch (error) {
    return fail(error);
  }
}
export async function verifySourceProvenance(projectDir: string, reviewedHead?: string): Promise<ProvenanceResult> {
  try {
    const project = path.resolve(projectDir);
    const projectReal = await assertProjectRoot(project);
    const state = path.join(project, '.w-model');
    const stateReal = await assertCanonicalPath(state, projectReal);
    const provenancePath = path.join(state, PROVENANCE_NAME);
    const existing = await readJson(provenancePath, stateReal);
    if (!validateBySchema('evidence-provenance', existing).valid)
      throw new ProvenanceFailure(1, 'INVALID_SOURCE_PROVENANCE');
    const actual = existing as SourceProvenance;
    if (reviewedHead !== undefined && actual.commitSha !== reviewedHead)
      throw new ProvenanceFailure(1, 'FINAL_HEAD_MISMATCH');
    const expected = await buildSourceProvenance(project, actual.verifiedAt);
    if (
      actual.commitSha !== expected.commitSha ||
      actual.runId !== expected.runId ||
      actual.artifactId !== expected.artifactId ||
      actual.verifiedAt !== expected.verifiedAt ||
      actual.sourceBundleSha256 !== expected.sourceBundleSha256 ||
      actual.producerVersion !== expected.producerVersion ||
      actual.provenanceSha256 !== canonicalProvenanceDigest(expected) ||
      JSON.stringify(actual.measurements) !== JSON.stringify(expected.measurements) ||
      JSON.stringify(actual.sourceFiles) !== JSON.stringify(expected.sourceFiles)
    )
      throw new ProvenanceFailure(1, 'SOURCE_PROVENANCE_MISMATCH');
    return {
      ok: true,
      exitCode: 0,
      provenance: actual,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    };
  } catch (error) {
    return fail(error);
  }
}
