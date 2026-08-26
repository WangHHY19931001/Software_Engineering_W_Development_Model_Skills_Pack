/* eslint-disable security/detect-non-literal-fs-filename -- Dynamic paths are constrained by real-root, ancestor, and stable-snapshot checks before each I/O operation. */
/** Sanitized runtime evidence export and integrity verification. */
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { evidenceFs as fs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

import { verifySourceProvenance } from './evidence-provenance-logic.js';

export type EvidenceKind = 'gate-log' | 'verifier-output' | 'signature-chain' | 'codegraph-query' | 'run-log';

type EvidenceFile = { path: string; sha256: string; kind: EvidenceKind };
type EvidenceMeasurement = { count: number; contentHash: string };
type EvidenceMeasurements = {
  gateLogs: EvidenceMeasurement;
  verifierOutputs: EvidenceMeasurement;
  runLog: EvidenceMeasurement;
  signatureChain: EvidenceMeasurement;
  codegraphQueries: EvidenceMeasurement;
};
type SourceVerificationProvenance = {
  format: 'w-model-evidence-verification' | 'w-model-evidence-source-provenance';
  version: 1;
  runId: string;
  commitSha: string;
  artifactId: string;
  verificationStatus: 'passed';
  measurements: EvidenceMeasurements;
  sourceBundleSha256?: string;
  producerVersion?: string;
  verifiedAt?: string;
  provenanceSha256?: string;
};
type EvidenceProvenance = {
  format: 'w-model-evidence-provenance';
  version: 1;
  runId: string;
  commitSha: string;
  artifactId: string;
  verificationStatus: 'passed';
  measurements: EvidenceMeasurements;
  contentHash: string;
  sourceBundleSha256?: string;
  producerVersion?: string;
  verifiedAt?: string;
  provenanceSha256?: string;
};
type EvidenceManifest = {
  schemaVersion: '1.0';
  exportedAt: string;
  sourceProject: string;
  provenance: EvidenceProvenance;
  files: EvidenceFile[];
  manifestSha256: string;
};
type FailureReason =
  | 'INVALID_JSON_EVIDENCE'
  | 'INVALID_JSONL_EVIDENCE'
  | 'UNSAFE_OUTPUT_PATH'
  | 'UNSAFE_SOURCE_PATH'
  | 'UNSAFE_EVIDENCE_CONTENT'
  | 'NONEMPTY_OUTPUT'
  | 'INVALID_MANIFEST'
  | 'INVALID_PROVENANCE'
  | 'UNSANITIZED_EVIDENCE'
  | 'UNMANIFESTED_OUTPUT'
  | 'HASH_MISMATCH'
  | 'EVIDENCE_EXPORT_FAILED';

export interface EvidenceExportResult {
  ok: boolean;
  exitCode: 0 | 1 | 2;
  mode: 'export' | 'verify';
  verificationLevel?: 'source-bound' | 'package-only';
  verificationStatus?: 'passed';
  outputDir?: string;
  manifestPath?: string;
  exportedFiles?: number;
  reason?: FailureReason | 'INPUT_NOT_FOUND';
}

const MANIFEST_NAME = 'evidence-manifest.json';
const REDACTED = '[REDACTED]';
const REDACTED_ABSOLUTE_PATH = '<redacted-absolute-path>';
const SENSITIVE_KEYS = new Set([
  'token',
  'secret',
  'password',
  'apikey',
  'authorization',
  'credential',
  'accesstoken',
  'privatekey',
]);
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.txt', '.md']);
const SOURCE_PROVENANCE_NAME = 'evidence-provenance.json';
const MEASURED_KINDS: Array<[EvidenceKind, keyof EvidenceMeasurements]> = [
  ['gate-log', 'gateLogs'],
  ['verifier-output', 'verifierOutputs'],
  ['run-log', 'runLog'],
  ['signature-chain', 'signatureChain'],
  ['codegraph-query', 'codegraphQueries'],
];
const ABSOLUTE_PATH_PATTERN =
  /(?:(?<![A-Za-z])[A-Za-z]:[\\/][^\r\n"'`<>]*|\\\\[^\r\n"'`<>]+|(?<![\w./:-])\/+[^\r\n"'`<>]*)/g;
const ABSOLUTE_PATH_DETECTION_PATTERN =
  /(?:(?<![A-Za-z])[A-Za-z]:[\\/][^\r\n"'`<>]*|\\\\[^\r\n"'`<>]+|(?<![\w./:-])\/+[^\r\n"'`<>]*)/;
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

type Snapshot = {
  realPath: string;
  ino: number;
  size: number;
  mtimeMs: number;
  directory: boolean;
};
function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
function hashFileList(files: Array<Pick<EvidenceFile, 'path' | 'sha256'>>): string {
  return sha256(JSON.stringify([...files].sort((left, right) => comparePaths(left.path, right.path))));
}
function hashManifest(manifest: Omit<EvidenceManifest, 'manifestSha256'>): string {
  return sha256(
    JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      exportedAt: manifest.exportedAt,
      sourceProject: manifest.sourceProject,
      provenance: manifest.provenance,
      files: manifest.files,
    }),
  );
}
function normalizeSensitiveKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}
function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
const SENSITIVE_METADATA_PATTERN =
  /(?:^|[^a-z0-9])(?:token|secret|password|authorization|credential|api[\s_-]*key|access[\s_-]*token|private[\s_-]*key)\s*(?:[:=])\s*[^\s]*/i;
function hasUnsafeMetadata(value: string): boolean {
  return ABSOLUTE_PATH_DETECTION_PATTERN.test(value) || SENSITIVE_METADATA_PATTERN.test(value);
}
function isSafeManifestMetadata(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !hasUnsafeMetadata(value);
}
function isSafeManifestProvenance(value: { runId: unknown; artifactId: unknown }): value is {
  runId: string;
  artifactId: string;
} {
  return isSafeManifestMetadata(value.runId) && isSafeManifestMetadata(value.artifactId);
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
function isSafeManifestPath(relativePath: string): boolean {
  return isSafeRelativePath(relativePath) && !hasUnsafeMetadata(relativePath);
}
function expectedEvidenceKind(relativePath: string): EvidenceKind | undefined {
  if (relativePath === 'run-log.jsonl') return 'run-log';
  return DIRECTORY_SOURCES.find(({ directory }) => relativePath.startsWith(`${directory}/`))?.kind;
}
function isAllowlistedEvidenceFile(file: EvidenceFile): boolean {
  return expectedEvidenceKind(file.path) === file.kind;
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

async function collectExportSources(
  state: string,
  sourceReal: string,
): Promise<Array<{ sourceRelative: string; kind: EvidenceKind }>> {
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
  return sources.sort((left, right) => comparePaths(left.sourceRelative, right.sourceRelative));
}

type ExportEntry = { file: EvidenceFile; content: Buffer };
type ExportBuild = {
  entries: ExportEntry[];
  files: EvidenceFile[];
  sourceMeasurements: Map<keyof EvidenceMeasurements, Array<{ path: string; sha256: string }>>;
};

async function buildExportFiles(state: string, sourceReal: string): Promise<ExportBuild> {
  const sources = await collectExportSources(state, sourceReal);
  const seen = new Set<string>();
  const entries: ExportEntry[] = [];
  const sourceMeasurements = new Map<keyof EvidenceMeasurements, Array<{ path: string; sha256: string }>>(
    MEASURED_KINDS.map(([, key]) => [key, []]),
  );
  for (const source of sources) {
    if (!isSafeRelativePath(source.sourceRelative) || seen.has(source.sourceRelative))
      throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
    seen.add(source.sourceRelative);
    const sourcePath = path.join(state, source.sourceRelative);
    const before = await snapshot(sourcePath, false);
    if (!isPathInside(before.realPath, sourceReal)) throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
    const sourceContent = await fs.readFile(sourcePath);
    const sanitized = sanitizeContent(sourcePath, sourceContent);
    if (hasUnsafeMetadata(source.sourceRelative)) throw new EvidenceFailure(1, 'UNSAFE_SOURCE_PATH');
    await assertStable(sourcePath, before, sourceReal);
    const measurementKey = MEASURED_KINDS.find(([kind]) => kind === source.kind)?.[1];
    if (measurementKey)
      sourceMeasurements.get(measurementKey)!.push({ path: source.sourceRelative, sha256: sha256(sourceContent) });
    entries.push({
      file: { path: source.sourceRelative, sha256: sha256(sanitized), kind: source.kind },
      content: sanitized,
    });
  }
  entries.sort((left, right) => comparePaths(left.file.path, right.file.path));
  return { entries, files: entries.map(({ file }) => file), sourceMeasurements };
}
function sanitizeSensitiveAssignment(line: string): string {
  const prefix = line.match(/^\s*(?:[-*>+]\s+|\[[A-Z]+\]\s+|`+\s*)/i)?.[0] ?? '';
  const pipe = line.lastIndexOf('|');
  const assignmentStart = pipe >= 0 ? pipe + 1 : prefix.length;
  const assignment = line.slice(assignmentStart);
  const match = /^(\s*)([^:=|]{1,80}?)(\s*[:=]\s*)(.*)$/.exec(assignment);
  if (!match) return line;
  const leading = match[1];
  const key = match[2];
  const separator = match[3];
  if (leading === undefined || key === undefined || separator === undefined) return line;
  if (!SENSITIVE_KEYS.has(normalizeSensitiveKey(key.trim()))) return line;
  return `${line.slice(0, assignmentStart)}${leading}${key}${separator}${REDACTED}`;
}
function sanitizeString(value: string): string {
  return value
    .replace(ABSOLUTE_PATH_PATTERN, REDACTED_ABSOLUTE_PATH)
    .split(/(\r?\n)/)
    .map((line, index) => (index % 2 === 1 ? line : sanitizeSensitiveAssignment(line)))
    .join('');
}

type MarkdownCell = { start: number; end: number; value: string };
type MarkdownRow = { cells: MarkdownCell[] };

function splitMarkdownRow(line: string): MarkdownRow | null {
  const pipes: number[] = [];
  const pipePattern = /\|/g;
  let match: RegExpExecArray | null;
  while ((match = pipePattern.exec(line)) !== null) {
    const index = match.index;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line.slice(cursor, cursor + 1) === '\\'; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) pipes.push(index);
  }
  const firstPipe = pipes.at(0);
  const lastPipe = pipes.at(-1);
  if (firstPipe === undefined || lastPipe === undefined) return null;
  const startsWithPipe = line.slice(0, firstPipe).trim() === '';
  const endsWithPipe = line.slice(lastPipe + 1).trim() === '';
  const cells: MarkdownCell[] = [];
  let start = startsWithPipe ? firstPipe + 1 : 0;
  for (const [pipeIndex, pipe] of pipes.entries()) {
    if (pipeIndex > 0 || !startsWithPipe) {
      cells.push({ start, end: pipe, value: line.slice(start, pipe) });
    }
    start = pipe + 1;
  }
  if (!endsWithPipe && start < line.length) cells.push({ start, end: line.length, value: line.slice(start) });
  return cells.length > 0 ? { cells } : null;
}

function isSensitiveCell(cell: MarkdownCell): boolean {
  return SENSITIVE_KEYS.has(normalizeSensitiveKey(cell.value.trim()));
}
function isMarkdownSeparator(row: MarkdownRow): boolean {
  return row.cells.length > 0 && row.cells.every(({ value }) => value.trim() === '' || /^\s*:?-{3,}:?\s*$/.test(value));
}
function sanitizeMarkdownRow(line: string, row: MarkdownRow, sensitiveColumns: Set<number>): string {
  const replacements = Array.from(row.cells.entries()).map(([cellIndex, cell]) => {
    if (sensitiveColumns.has(cellIndex)) {
      const leading = cell.value.match(/^\s*/)?.[0] ?? '';
      const trailing = cell.value.match(/\s*$/)?.[0] ?? '';
      return {
        start: cell.start,
        end: cell.end,
        value: `${leading}${REDACTED}${trailing}`,
      };
    }
    return {
      start: cell.start,
      end: cell.end,
      value: sanitizeString(cell.value),
    };
  });
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (output, replacement) =>
        `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`,
      line,
    );
}
function sanitizeMarkdown(text: string): string {
  const lines = text.split(/(\r?\n)/);
  let sensitiveColumns = new Set<number>();
  const sanitizedLines = lines.map((line, index) => {
    if (index % 2 === 1) return line;
    const row = splitMarkdownRow(line);
    if (!row) {
      sensitiveColumns = new Set<number>();
      return sanitizeString(line);
    }
    const nextRow = splitMarkdownRow(lines.slice(index + 2, index + 3).at(0) ?? '');
    if (nextRow && isMarkdownSeparator(nextRow) && row.cells.some(isSensitiveCell)) {
      sensitiveColumns = new Set(
        Array.from(row.cells.entries())
          .filter(([, cell]) => isSensitiveCell(cell))
          .map(([cellIndex]) => cellIndex),
      );
      return line;
    }
    if (isMarkdownSeparator(row)) return line;
    const firstCell = row.cells.at(0);
    const noHeaderKeyValue = row.cells.length > 1 && firstCell !== undefined && isSensitiveCell(firstCell);
    const indices = noHeaderKeyValue ? new Set<number>(Array.from(row.cells.keys()).slice(1)) : sensitiveColumns;
    return sanitizeMarkdownRow(line, row, indices);
  });
  return sanitizedLines.join('');
}
function redact(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEYS.has(normalizeSensitiveKey(key)) ? REDACTED : redact(nested),
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
  return Buffer.from(extension === '.md' ? sanitizeMarkdown(text) : sanitizeString(text), 'utf8');
}
function isEvidenceMeasurement(value: unknown): value is EvidenceMeasurement {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.count) &&
    typeof record.count === 'number' &&
    record.count >= 0 &&
    typeof record.contentHash === 'string' &&
    /^[0-9a-f]{64}$/.test(record.contentHash)
  );
}
function isEvidenceMeasurements(value: unknown): value is EvidenceMeasurements {
  if (value === null || typeof value !== 'object') return false;
  const measurements = value as Record<string, unknown>;
  return (
    Object.keys(measurements).length === 5 &&
    isEvidenceMeasurement(measurements.gateLogs) &&
    isEvidenceMeasurement(measurements.verifierOutputs) &&
    isEvidenceMeasurement(measurements.runLog) &&
    isEvidenceMeasurement(measurements.signatureChain) &&
    isEvidenceMeasurement(measurements.codegraphQueries)
  );
}
function parseSourceProvenance(value: unknown): SourceVerificationProvenance {
  if (value === null || typeof value !== 'object') throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
  const source = value as Record<string, unknown>;
  if (
    source.format !== 'w-model-evidence-source-provenance' ||
    source.version !== 1 ||
    typeof source.runId !== 'string' ||
    source.runId.length === 0 ||
    typeof source.commitSha !== 'string' ||
    !/^[0-9a-f]{40}$/.test(source.commitSha) ||
    typeof source.artifactId !== 'string' ||
    !isSafeManifestMetadata(source.runId) ||
    !isSafeManifestMetadata(source.artifactId) ||
    source.verificationStatus !== 'passed' ||
    !isEvidenceMeasurements(source.measurements) ||
    typeof source.sourceBundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(source.sourceBundleSha256) ||
    typeof source.producerVersion !== 'string' ||
    source.producerVersion.length === 0 ||
    typeof source.verifiedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(source.verifiedAt) ||
    typeof source.provenanceSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(source.provenanceSha256)
  ) {
    throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
  }
  return source as SourceVerificationProvenance;
}
function toExportProvenance(source: SourceVerificationProvenance, files: EvidenceFile[]): EvidenceProvenance {
  return {
    format: 'w-model-evidence-provenance',
    version: 1,
    runId: source.runId,
    commitSha: source.commitSha,
    artifactId: source.artifactId,
    verificationStatus: 'passed',
    measurements: source.measurements,
    contentHash: hashFileList(files),
    ...('sourceBundleSha256' in source
      ? {
          sourceBundleSha256: source.sourceBundleSha256,
          producerVersion: source.producerVersion,
          verifiedAt: source.verifiedAt,
          provenanceSha256: source.provenanceSha256,
        }
      : {}),
  };
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
    const sourceProvenancePath = path.join(state, SOURCE_PROVENANCE_NAME);
    const sourceProvenanceBefore = await snapshot(sourceProvenancePath, false).catch(() => {
      throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
    });
    const sourceProvenance = parseSourceProvenance(JSON.parse(await fs.readFile(sourceProvenancePath, 'utf8')));
    await assertStable(sourceProvenancePath, sourceProvenanceBefore, sourceReal);
    const output = path.resolve(outputDir);
    await ensureEmptyOutput(output, sourceReal);
    const { entries, files: sortedFiles, sourceMeasurements } = await buildExportFiles(state, sourceReal);
    const expectedMeasurements: Array<[Array<{ path: string; sha256: string }>, EvidenceMeasurement]> = [
      [sourceMeasurements.get('gateLogs')!, sourceProvenance.measurements.gateLogs],
      [sourceMeasurements.get('verifierOutputs')!, sourceProvenance.measurements.verifierOutputs],
      [sourceMeasurements.get('runLog')!, sourceProvenance.measurements.runLog],
      [sourceMeasurements.get('signatureChain')!, sourceProvenance.measurements.signatureChain],
      [sourceMeasurements.get('codegraphQueries')!, sourceProvenance.measurements.codegraphQueries],
    ];
    for (const [filesForKind, expected] of expectedMeasurements) {
      if (filesForKind.length !== expected.count || hashFileList(filesForKind) !== expected.contentHash)
        throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
    }
    const sourceVerification = await verifySourceProvenance(project);
    if (!sourceVerification.ok || !sourceVerification.provenance) throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
    staging = `${output}.tmp-${randomUUID()}`;
    await assertSafeOutputPath(staging, sourceReal);
    await fs.mkdir(staging);
    for (const { file, content } of entries) {
      const target = path.join(staging, file.path);
      if (!isPathInside(target, staging)) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await atomicWrite(target, content);
    }
    const manifestBase: Omit<EvidenceManifest, 'manifestSha256'> = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      sourceProject: '<redacted-project>',
      provenance: toExportProvenance(sourceProvenance, sortedFiles),
      files: sortedFiles,
    };
    const manifest: EvidenceManifest = { ...manifestBase, manifestSha256: hashManifest(manifestBase) };
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
      exportedFiles: sortedFiles.length,
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
export async function verifyEvidence(manifestPath: string, sourceProject?: string): Promise<EvidenceExportResult> {
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
    const sortedPaths = typed.files.map(({ path: filePath }) => filePath).sort(comparePaths);
    for (const [index, file] of typed.files.entries()) {
      if (
        !isSafeManifestPath(file.path) ||
        expected.has(file.path) ||
        !isAllowlistedEvidenceFile(file) ||
        file.path !== sortedPaths[index]
      )
        throw new EvidenceFailure(1, 'INVALID_MANIFEST');
      expected.add(file.path);
    }
    if (
      !isSafeManifestProvenance(typed.provenance) ||
      typed.provenance.verificationStatus !== 'passed' ||
      !/^[0-9a-f]{40}$/.test(typed.provenance.commitSha) ||
      !/^[0-9a-f]{64}$/.test(typed.provenance.sourceBundleSha256 ?? '') ||
      !typed.provenance.producerVersion ||
      typeof typed.provenance.verifiedAt !== 'string' ||
      !/^[0-9a-f]{64}$/.test(typed.provenance.provenanceSha256 ?? '') ||
      typed.provenance.contentHash !== hashFileList(typed.files) ||
      typed.manifestSha256 !==
        hashManifest({
          schemaVersion: typed.schemaVersion,
          exportedAt: typed.exportedAt,
          sourceProject: typed.sourceProject,
          provenance: typed.provenance,
          files: typed.files,
        })
    ) {
      throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
    }
    for (const file of typed.files) {
      const target = path.resolve(output, file.path);
      if (!isPathInside(target, output)) throw new EvidenceFailure(1, 'INVALID_MANIFEST');
      const targetStat = await fs.lstat(target);
      if (targetStat.isSymbolicLink()) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      const before = await snapshot(target, false);
      if (!isPathInside(before.realPath, outputReal)) throw new EvidenceFailure(1, 'UNSAFE_OUTPUT_PATH');
      const content = await fs.readFile(target);
      await assertStable(target, before, outputReal);
      if (sha256(content) !== file.sha256) throw new EvidenceFailure(1, 'HASH_MISMATCH');
      let sanitized: Buffer;
      try {
        sanitized = sanitizeContent(target, content);
      } catch {
        throw new EvidenceFailure(1, 'UNSANITIZED_EVIDENCE');
      }
      if (Buffer.compare(content, sanitized) !== 0) throw new EvidenceFailure(1, 'UNSANITIZED_EVIDENCE');
    }
    const actual: string[] = [];
    await collectOutputFiles(outputReal, outputReal, actual);
    const allowed = new Set([...expected, MANIFEST_NAME]);
    if (actual.some((entry) => !allowed.has(entry)) || actual.length !== allowed.size)
      throw new EvidenceFailure(1, 'UNMANIFESTED_OUTPUT');
    if (sourceProject) {
      const source = await verifySourceProvenance(sourceProject);
      if (
        !source.ok ||
        !source.provenance ||
        source.provenance.format !== 'w-model-evidence-source-provenance' ||
        source.provenance.version !== 1 ||
        source.provenance.runId !== typed.provenance.runId ||
        source.provenance.artifactId !== typed.provenance.artifactId ||
        source.provenance.commitSha !== typed.provenance.commitSha ||
        source.provenance.verificationStatus !== 'passed' ||
        source.provenance.sourceBundleSha256 !== typed.provenance.sourceBundleSha256 ||
        source.provenance.producerVersion !== typed.provenance.producerVersion ||
        source.provenance.verifiedAt !== typed.provenance.verifiedAt ||
        source.provenance.provenanceSha256 !== typed.provenance.provenanceSha256 ||
        JSON.stringify(source.provenance.measurements) !== JSON.stringify(typed.provenance.measurements)
      ) {
        throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
      }
      const sourceRoot = path.resolve(sourceProject);
      await assertRealDirectory(sourceRoot);
      const sourceState = path.join(sourceRoot, '.w-model');
      await assertRealDirectory(sourceState);
      const sourceReal = await fs.realpath(sourceState);
      const rebuilt = await buildExportFiles(sourceState, sourceReal);
      if (JSON.stringify(rebuilt.files) !== JSON.stringify(typed.files)) {
        throw new EvidenceFailure(1, 'INVALID_PROVENANCE');
      }
      return {
        ok: true,
        exitCode: 0,
        mode: 'verify',
        verificationLevel: 'source-bound',
        verificationStatus: 'passed',
        manifestPath: absolute,
        exportedFiles: typed.files.length,
      };
    }
    return {
      ok: true,
      exitCode: 0,
      mode: 'verify',
      verificationLevel: 'package-only',
      manifestPath: absolute,
      exportedFiles: typed.files.length,
    };
  } catch (error) {
    return failure('verify', error);
  }
}
