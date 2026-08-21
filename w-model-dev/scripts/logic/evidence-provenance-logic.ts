import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { evidenceFs as fs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

import { buildGateLogKeys, checkRunLog, extractExitCode, type RunLogEntry } from './run-log-logic.js';
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
    } else if (!gitStat.isDirectory() || gitStat.isSymbolicLink()) {
      throw new Error('invalid git metadata directory');
    }
    const head = (await fs.readFile(path.join(gitDir, 'HEAD'), 'utf8')).trim();
    const value = head.startsWith('ref: ')
      ? (await fs.readFile(path.join(gitDir, head.slice('ref: '.length)), 'utf8')).trim()
      : head;
    if (!/^[0-9a-f]{40}$/.test(value)) throw new Error('invalid HEAD');
    return value;
  } catch {
    throw new ProvenanceFailure(1, 'MISSING_GIT_HEAD');
  }
}
async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    throw new ProvenanceFailure(1, 'INVALID_SOURCE_EVIDENCE');
  }
}
async function readJsonl(file: string, missingReason: string): Promise<unknown[]> {
  let content: string;
  try {
    content = await fs.readFile(file, 'utf8');
  } catch {
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
  directory: string,
  kind: Kind,
  required: boolean,
): Promise<SourceFile[]> {
  const absolute = path.join(state, directory);
  try {
    await fs.access(absolute);
  } catch {
    if (required) throw new ProvenanceFailure(1, `MISSING_${directory.toUpperCase().replace('-', '_')}`);
    return [];
  }
  const files: SourceFile[] = [];
  async function walk(current: string, relativeDirectory: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = (await fs.readdir(current, { withFileTypes: true })) as import('node:fs').Dirent[];
    } catch {
      throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const entryPath = path.join(current, entry.name);
      const relative = `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      if (entry.isDirectory()) {
        await walk(entryPath, relative);
        continue;
      }
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      const content = await fs.readFile(entryPath);
      if (content.includes(0) || Buffer.from(content.toString('utf8'), 'utf8').compare(content) !== 0)
        throw new ProvenanceFailure(1, 'UNSAFE_SOURCE_EVIDENCE');
      files.push({
        path: relative,
        kind,
        sha256: sha256(content),
      });
    }
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
async function buildSourceProvenance(projectDir: string): Promise<SourceProvenance> {
  const project = path.resolve(projectDir);
  const state = path.join(project, '.w-model');
  const commitSha = await gitHead(project);
  const gateFiles = await collectDirectory(state, 'gate-logs', 'gate-log', true);
  const verifierFiles = await collectDirectory(state, 'verifier-outputs', 'verifier-output', false);
  const signatureFiles = await collectDirectory(state, 'signature-chains', 'signature-chain', false);
  const codegraphFiles = await collectDirectory(state, 'codegraph-queries', 'codegraph-query', false);
  const runLogPath = path.join(state, 'run-log.jsonl');
  const runLogEntries = await readJsonl(runLogPath, 'MISSING_RUN_LOG');
  const runFile: SourceFile = {
    path: 'run-log.jsonl',
    kind: 'run-log',
    sha256: sha256(await fs.readFile(runLogPath)),
  };
  const gateLogs = new Map<string, { exitCode?: number; content: string }>();
  for (const file of gateFiles) {
    const absolute = path.join(state, file.path);
    const content = await fs.readFile(absolute, 'utf8');
    const value = await readJson(absolute);
    if (
      !validateBySchema('gate-log', value).valid ||
      (value as { passed?: unknown }).passed !== true ||
      (value as { exitCode?: unknown }).exitCode !== 0
    )
      throw new ProvenanceFailure(1, 'GATE_NOT_PASSED');
    for (const key of buildGateLogKeys(absolute, project))
      gateLogs.set(key, { exitCode: extractExitCode(content), content });
  }
  const runCheck = checkRunLog(runLogEntries as RunLogEntry[], { gateLogs });
  if (!runCheck.passed) throw new ProvenanceFailure(1, 'RUN_LOG_NOT_PASSED');
  if (signatureFiles.length === 0) throw new ProvenanceFailure(1, 'MISSING_SIGNATURE_CHAIN');
  const signatureEntries = (
    await Promise.all(signatureFiles.map((file) => readJsonl(path.join(state, file.path), 'MISSING_SIGNATURE_CHAIN')))
  ).flat();
  if (!checkSignatureChain(signatureEntries as SignatureChainEntry[]).passed)
    throw new ProvenanceFailure(1, 'SIGNATURE_CHAIN_NOT_PASSED');
  const files = [...gateFiles, ...verifierFiles, ...signatureFiles, ...codegraphFiles, runFile].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const runId = String((runLogEntries.at(-1) as { runId?: string } | undefined)?.runId ?? '');
  if (!runId) throw new ProvenanceFailure(1, 'MISSING_RUN_ID');
  return {
    format: 'w-model-evidence-source-provenance',
    version: 1,
    runId,
    artifactId: `evidence-${runId}`,
    commitSha,
    verifiedAt: new Date().toISOString(),
    verificationStatus: 'passed',
    measurements: measurements(files),
    sourceFiles: files,
    sourceBundleSha256: hashList(files),
    producerVersion: PRODUCER_VERSION,
  };
}
async function atomicWrite(target: string, content: string): Promise<void> {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, content);
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}
export async function produceSourceProvenance(projectDir: string): Promise<ProvenanceResult> {
  try {
    const provenance = await buildSourceProvenance(projectDir);
    if (!validateBySchema('evidence-provenance', provenance).valid)
      throw new ProvenanceFailure(1, 'INVALID_SOURCE_PROVENANCE');
    await atomicWrite(
      path.join(path.resolve(projectDir), '.w-model', PROVENANCE_NAME),
      JSON.stringify(provenance, null, 2) + '\n',
    );
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
export async function verifySourceProvenance(projectDir: string): Promise<ProvenanceResult> {
  try {
    const existing = await readJson(path.join(path.resolve(projectDir), '.w-model', PROVENANCE_NAME));
    if (!validateBySchema('evidence-provenance', existing).valid)
      throw new ProvenanceFailure(1, 'INVALID_SOURCE_PROVENANCE');
    const expected = await buildSourceProvenance(projectDir);
    const actual = existing as SourceProvenance;
    if (
      actual.commitSha !== expected.commitSha ||
      actual.runId !== expected.runId ||
      actual.artifactId !== expected.artifactId ||
      actual.sourceBundleSha256 !== expected.sourceBundleSha256 ||
      actual.producerVersion !== expected.producerVersion ||
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
