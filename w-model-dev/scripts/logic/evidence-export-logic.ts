/* eslint-disable security/detect-non-literal-fs-filename -- All dynamic paths are constrained to real project/output roots, allowlisted source names, and safe relative paths before I/O. */
/**
 * Runtime evidence export and verification logic.
 *
 * Exports only selected `.w-model` runtime records, recursively redacts
 * sensitive JSON/JSONL fields, and writes a SHA-256 manifest atomically.
 */
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { evidenceFs as fs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

export type EvidenceKind = 'gate-log' | 'verifier-output' | 'signature-chain' | 'codegraph-query' | 'run-log';

interface EvidenceFile {
  path: string;
  sha256: string;
  kind: EvidenceKind;
}

interface EvidenceManifest {
  schemaVersion: '1.0';
  exportedAt: string;
  sourceProject: string;
  files: EvidenceFile[];
}

export interface EvidenceExportResult {
  ok: boolean;
  exitCode: 0 | 1 | 2;
  mode: 'export' | 'verify';
  outputDir?: string;
  manifestPath?: string;
  exportedFiles?: number;
  reason?: string;
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

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function isPathInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\')) return false;
  const normalized = path.posix.normalize(relativePath);
  return (
    normalized === relativePath && !normalized.startsWith('../') && normalized !== '..' && normalized !== MANIFEST_NAME
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

async function assertRealDirectory(target: string, label: string): Promise<void> {
  const stat = await lstatOrNull(target);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new EvidenceFailure(2, `${label}不存在或不是常规目录`);
  }
}

async function collectDirectoryFiles(root: string, current: string, result: string[]): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new EvidenceFailure(1, '检测到符号链接，已拒绝导出');
    if (entry.isDirectory()) {
      await collectDirectoryFiles(root, entryPath, result);
      continue;
    }
    if (!entry.isFile()) throw new EvidenceFailure(1, '检测到非普通文件，已拒绝导出');
    const realPath = await fs.realpath(entryPath);
    if (!isPathInside(realPath, root)) throw new EvidenceFailure(1, '源文件路径逃逸，已拒绝导出');
    const relativePath = path.relative(root, entryPath).split(path.sep).join('/');
    if (!isSafeRelativePath(relativePath)) throw new EvidenceFailure(1, '源文件相对路径非法，已拒绝导出');
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      throw new EvidenceFailure(1, '发现非白名单文本扩展名，已拒绝导出');
    }
    result.push(relativePath);
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(nestedValue),
      ]),
    );
  }
  return value;
}

function redactJson(content: string, sourceName: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new EvidenceFailure(1, `JSON 证据无法解析：${sourceName}`);
  }
  return JSON.stringify(redact(parsed), null, 2) + '\n';
}

function redactJsonl(content: string, sourceName: string): string {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new EvidenceFailure(1, `JSONL 证据第 ${index + 1} 行无法解析：${sourceName}`);
    }
    output.push(JSON.stringify(redact(parsed)));
  }
  return output.length > 0 ? output.join('\n') + '\n' : '';
}

function sanitizeContent(sourcePath: string, content: Buffer): Buffer {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) throw new EvidenceFailure(1, '发现非白名单文本扩展名，已拒绝导出');
  if (content.includes(0)) throw new EvidenceFailure(1, '发现二进制内容，已拒绝导出');
  const text = content.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(content) !== 0)
    throw new EvidenceFailure(1, '发现非 UTF-8 文本内容，已拒绝导出');
  if (extension === '.json') return Buffer.from(redactJson(text, sourcePath), 'utf8');
  if (extension === '.jsonl') return Buffer.from(redactJsonl(text, sourcePath), 'utf8');
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

async function ensureEmptyOutput(outputDir: string, sourceStateDir: string): Promise<void> {
  const outputResolved = path.resolve(outputDir);
  if (isPathInside(outputResolved, sourceStateDir)) throw new EvidenceFailure(1, '输出目录不得位于源 .w-model 目录内');
  const existing = await lstatOrNull(outputResolved);
  if (!existing) return;
  if (!existing.isDirectory() || existing.isSymbolicLink()) throw new EvidenceFailure(1, '输出路径不是常规目录');
  if ((await fs.readdir(outputResolved)).length > 0) throw new EvidenceFailure(1, '输出目录非空，拒绝混合证据');
  await fs.rmdir(outputResolved);
}

class EvidenceFailure extends Error {
  constructor(
    readonly exitCode: 1 | 2,
    message: string,
  ) {
    super(message);
  }
}

function failure(mode: 'export' | 'verify', error: unknown): EvidenceExportResult {
  if (error instanceof EvidenceFailure) return { ok: false, exitCode: error.exitCode, mode, reason: error.message };
  return { ok: false, exitCode: 2, mode, reason: '无法读取或写入证据文件' };
}

export async function exportEvidence(projectDir: string, outputDir: string): Promise<EvidenceExportResult> {
  let stagingOutput: string | undefined;
  try {
    const project = path.resolve(projectDir);
    await assertRealDirectory(project, '项目目录');
    const stateDir = path.join(project, '.w-model');
    await assertRealDirectory(stateDir, '.w-model 目录');
    const sourceReal = await fs.realpath(stateDir);
    const output = path.resolve(outputDir);
    await ensureEmptyOutput(output, sourceReal);
    stagingOutput = `${output}.tmp-${randomUUID()}`;
    await fs.mkdir(stagingOutput, { recursive: false });

    const sources: Array<{ sourceRelative: string; kind: EvidenceKind }> = [];
    for (const { directory, kind } of DIRECTORY_SOURCES) {
      const directoryPath = path.join(stateDir, directory);
      const stat = await lstatOrNull(directoryPath);
      if (!stat) continue;
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new EvidenceFailure(1, '白名单源目录不是常规目录');
      const files: string[] = [];
      await collectDirectoryFiles(stateDir, directoryPath, files);
      sources.push(...files.map((sourceRelative) => ({ sourceRelative, kind })));
    }
    const runLog = path.join(stateDir, 'run-log.jsonl');
    const runLogStat = await lstatOrNull(runLog);
    if (runLogStat) {
      if (!runLogStat.isFile() || runLogStat.isSymbolicLink()) throw new EvidenceFailure(1, 'run-log 不是常规文件');
      sources.push({ sourceRelative: 'run-log.jsonl', kind: 'run-log' });
    }

    const sourcePaths = new Set<string>();
    const files: EvidenceFile[] = [];
    for (const source of sources.sort((a, b) => a.sourceRelative.localeCompare(b.sourceRelative))) {
      if (!isSafeRelativePath(source.sourceRelative) || sourcePaths.has(source.sourceRelative)) {
        throw new EvidenceFailure(1, '发现重复或非法导出相对路径');
      }
      sourcePaths.add(source.sourceRelative);
      const sourcePath = path.join(stateDir, source.sourceRelative);
      const sourceStat = await fs.lstat(sourcePath);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new EvidenceFailure(1, '源文件不是常规文件');
      const sourceRealPath = await fs.realpath(sourcePath);
      if (!isPathInside(sourceRealPath, sourceReal)) throw new EvidenceFailure(1, '源文件路径逃逸，已拒绝导出');
      const sanitized = sanitizeContent(sourcePath, await fs.readFile(sourcePath));
      const target = path.join(stagingOutput, source.sourceRelative);
      if (!isPathInside(target, stagingOutput)) throw new EvidenceFailure(1, '输出路径逃逸，已拒绝导出');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await atomicWrite(target, sanitized);
      files.push({ path: source.sourceRelative, sha256: sha256(sanitized), kind: source.kind });
    }

    const manifest: EvidenceManifest = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      sourceProject: '<redacted-project>',
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    };
    const schemaResult = validateBySchema('evidence-manifest', manifest);
    if (!schemaResult.valid) throw new EvidenceFailure(1, '生成的 manifest 不符合 schema');
    await atomicWrite(path.join(stagingOutput, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n');
    await fs.rename(stagingOutput, output);
    return {
      ok: true,
      exitCode: 0,
      mode: 'export',
      outputDir: output,
      manifestPath: path.join(output, MANIFEST_NAME),
      exportedFiles: files.length,
    };
  } catch (error) {
    if (stagingOutput) await fs.rm(stagingOutput, { recursive: true, force: true }).catch(() => undefined);
    return failure('export', error);
  }
}

export async function verifyEvidence(manifestPath: string): Promise<EvidenceExportResult> {
  try {
    const manifestAbsolute = path.resolve(manifestPath);
    const manifestStat = await lstatOrNull(manifestAbsolute);
    if (!manifestStat) throw new EvidenceFailure(2, 'manifest 文件不存在');
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new EvidenceFailure(1, 'manifest 不是常规文件');
    const outputDir = path.dirname(manifestAbsolute);
    const raw = await fs.readFile(manifestAbsolute, 'utf8');
    let manifest: unknown;
    try {
      manifest = JSON.parse(raw);
    } catch {
      throw new EvidenceFailure(1, 'manifest 不是合法 JSON');
    }
    const schemaResult = validateBySchema('evidence-manifest', manifest);
    if (!schemaResult.valid) throw new EvidenceFailure(1, 'manifest schema 校验失败');
    const typed = manifest as EvidenceManifest;
    const seen = new Set<string>();
    for (const file of typed.files) {
      if (!isSafeRelativePath(file.path) || seen.has(file.path))
        throw new EvidenceFailure(1, 'manifest 含重复或逃逸路径');
      seen.add(file.path);
      const target = path.resolve(outputDir, file.path);
      if (!isPathInside(target, outputDir)) throw new EvidenceFailure(1, 'manifest 路径逃逸');
      const stat = await lstatOrNull(target);
      if (!stat || !stat.isFile() || stat.isSymbolicLink())
        throw new EvidenceFailure(1, 'manifest 声明的证据文件不存在或不安全');
      const realTarget = await fs.realpath(target);
      const realOutput = await fs.realpath(outputDir);
      if (!isPathInside(realTarget, realOutput)) throw new EvidenceFailure(1, '证据文件符号链接逃逸');
      if (sha256(await fs.readFile(target)) !== file.sha256)
        throw new EvidenceFailure(1, '证据文件 SHA-256 校验不一致');
    }
    return { ok: true, exitCode: 0, mode: 'verify', manifestPath: manifestAbsolute, exportedFiles: typed.files.length };
  } catch (error) {
    return failure('verify', error);
  }
}
