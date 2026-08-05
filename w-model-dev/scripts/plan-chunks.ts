#!/usr/bin/env tsx
/**
 * 分块规划脚本（Chunk Planner）—— 为 ingestion 子流程产出分块计划
 *
 * 对应 w-model-dev/references/ingestion-chunk.md。
 * 编排者（O）以只读方式调用，脚本不写任何文件，仅 stdout 输出 JSON 分块计划。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]
 *
 * 参数：
 *   path           文件或目录路径
 *   --phase        阶段 1-4
 *   --node-type    REQ | SD | INTF | DD
 *   --max-tokens   单块 token 上限，默认 8000
 *
 * 退出码：
 *   0  正常输出分块计划
 *   2  输入错误（路径不存在 / 参数非法）
 *
 * 输出：stdout JSON（供编排者读取用于 CHECKPOINT 展示与 A-chunk 分派）
 */

import { promises as fs, type Stats } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitWithError } from './lib/cli-error.js';

interface Chunk {
  id: string;
  path: string;
  kind: 'file' | 'dir' | 'section';
  tokens: number;
}

interface PlanOutput {
  chunks: Chunk[];
  totalChunks: number;
  strategy: 'file-split' | 'dir-tree' | 'single';
  phase: number;
  nodeType: string;
}

const MAX_TOKENS_DEFAULT = 8000;

function parseArgs(argv: string[]): {
  inputPath: string | undefined;
  phaseStr: string | undefined;
  nodeTypeStr: string | undefined;
  maxTokensStr: string | undefined;
} {
  const inputPath = argv[2];
  let phaseStr: string | undefined;
  let nodeTypeStr: string | undefined;
  let maxTokensStr: string | undefined;
  for (const a of argv.slice(3)) {
    if (a.startsWith('--phase=')) {
      phaseStr = a.split('=')[1];
    } else if (a.startsWith('--node-type=')) {
      nodeTypeStr = a.split('=')[1];
    } else if (a.startsWith('--max-tokens=')) {
      maxTokensStr = a.split('=')[1];
    }
  }
  return { inputPath, phaseStr, nodeTypeStr, maxTokensStr };
}

export function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
}

export function splitMarkdownSections(content: string): string[] {
  const lines = content.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) inFence = !inFence;
    if (!inFence && /^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join('\n'));
  return sections;
}

export function splitByLines(text: string, maxTokens: number, filePath: string, chunkIdPrefix: string): Chunk[] {
  const lines = text.split('\n');
  const chunks: Chunk[] = [];
  const OVERLAP = 5;
  let buf: string[] = [];
  let bufBytes = 0;
  let idx = 1;
  const flush = () => {
    if (buf.length === 0) return;
    const slice = buf.join('\n');
    chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(slice) });
    idx++;
    const keep = buf.slice(-OVERLAP);
    buf = [...keep];
    bufBytes = keep.reduce((a, l) => a + Buffer.byteLength(l, 'utf8') + 1, 0);
  };
  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
    if (bufBytes + lineBytes > maxTokens * 4 && buf.length > 0) flush();
    buf.push(line);
    bufBytes += lineBytes;
  }
  if (buf.length > 0) flush();
  return chunks;
}

export async function splitMarkdownByHeaders(
  content: string,
  maxTokens: number,
  filePath: string,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  const sections = splitMarkdownSections(content);
  const chunks: Chunk[] = [];
  let current = '';
  let idx = 1;
  for (const sec of sections) {
    if (estimateTokens(current + sec) > maxTokens && current.length > 0) {
      chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(current) });
      idx++;
      current = '';
    }
    if (estimateTokens(sec) > maxTokens) {
      const sub = splitByLines(sec, maxTokens, filePath, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
      chunks.push(...sub);
      idx += sub.length;
      current = '';
    } else {
      current += sec;
    }
  }
  if (current.length > 0) {
    chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(current) });
  }
  return chunks;
}

export async function planFile(
  filePath: string,
  maxTokens: number,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(filePath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const chunks: Chunk[] = [];
    let idx = 1;
    for (const e of entries) {
      const childPath = path.join(filePath, e.name);
      if (e.isFile() || e.isDirectory()) {
        const sub = await planFile(childPath, maxTokens, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
        chunks.push(...sub);
        idx++;
      }
    }
    return chunks;
  }
  // 文件
  const content = await fs.readFile(filePath, 'utf-8');
  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) {
    return [{
      id: `${chunkIdPrefix}-001`,
      path: filePath,
      kind: 'file',
      tokens,
    }];
  }
  // 超限：Markdown 按标题切，非 Markdown 按行切
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
    return splitMarkdownByHeaders(content, maxTokens, filePath, chunkIdPrefix);
  }
  return splitByLines(content, maxTokens, filePath, chunkIdPrefix);
}

async function main(): Promise<void> {
  const { inputPath, phaseStr, nodeTypeStr, maxTokensStr } = parseArgs(process.argv);

  if (!inputPath) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <path>',
      detail: '用法: npx tsx w-model-dev/scripts/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]',
      exitCode: 2,
    });
    return;
  }
  const phase = Number(phaseStr);
  if (phaseStr === undefined || !Number.isInteger(phase) || phase < 1 || phase > 4) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '--phase 必须为 1-4 整数',
      detail: `收到 ${phaseStr ?? '(未提供)'}`,
      exitCode: 2,
    });
    return;
  }
  if (nodeTypeStr === undefined || !['REQ', 'SD', 'INTF', 'DD'].includes(nodeTypeStr)) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '--node-type 必须为 REQ|SD|INTF|DD',
      detail: `收到 ${nodeTypeStr ?? '(未提供)'}`,
      exitCode: 2,
    });
    return;
  }
  const maxTokens = maxTokensStr === undefined ? MAX_TOKENS_DEFAULT : Number.parseInt(maxTokensStr, 10);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '--max-tokens 必须为正整数',
      detail: `收到 ${maxTokensStr ?? '(未提供)'}`,
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(inputPath);

  let stat: Stats;
  try {
    stat = await fs.stat(abs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
      message: e.code === 'ENOENT' ? '路径不存在' : '路径读取失败',
      file: abs,
      detail: e.code ?? '未知错误',
      exitCode: 2,
    });
    return;
  }

  let chunks: Chunk[];
  try {
    chunks = await planFile(abs, maxTokens, 'chunk');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : err instanceof SyntaxError ? 'FILE_PARSE' : 'FILE_READ',
      message: e.code === 'ENOENT' ? '路径不存在' : err instanceof SyntaxError ? '文件解析失败' : '文件读取失败',
      file: abs,
      detail: e.code ?? '未知错误',
      exitCode: 2,
    });
    return;
  }

  const output: PlanOutput = {
    chunks,
    totalChunks: chunks.length,
    strategy: stat.isDirectory() ? 'dir-tree' : chunks.length > 1 ? 'file-split' : 'single',
    phase,
    nodeType: nodeTypeStr,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// main 守卫：仅在直接执行时运行，被 import 时不触发（供单测导入纯函数）
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
