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

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  inputPath: string;
  phase: number;
  nodeType: string;
  maxTokens: number;
} {
  const inputPath = argv[2];
  if (!inputPath) {
    console.error('用法: npx tsx w-model-dev/scripts/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]');
    process.exit(2);
  }
  let phase: number | undefined;
  let nodeType: string | undefined;
  let maxTokens = MAX_TOKENS_DEFAULT;
  for (const a of argv.slice(3)) {
    if (a.startsWith('--phase=')) {
      const phaseStr = a.split('=')[1];
      if (phaseStr !== undefined) phase = Number(phaseStr);
    } else if (a.startsWith('--node-type=')) {
      const typeStr = a.split('=')[1];
      if (typeStr !== undefined) nodeType = typeStr;
    } else if (a.startsWith('--max-tokens=')) {
      const tokStr = a.split('=')[1];
      if (tokStr !== undefined) maxTokens = Number.parseInt(tokStr, 10);
    }
  }
  if (!Number.isInteger(phase) || ![1, 2, 3, 4].includes(phase!)) {
    console.error(`✗ --phase 必须为 1-4，实际: ${phase}`);
    process.exit(2);
  }
  if (!['REQ', 'SD', 'INTF', 'DD'].includes(nodeType ?? '')) {
    console.error(`✗ --node-type 必须为 REQ|SD|INTF|DD，实际: ${nodeType}`);
    process.exit(2);
  }
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    console.error(`✗ --max-tokens 必须为正整数，实际: ${maxTokens}`);
    process.exit(2);
  }
  return { inputPath, phase: phase!, nodeType: nodeType!, maxTokens };
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
  const { inputPath, phase, nodeType, maxTokens } = parseArgs(process.argv);

  const abs = path.resolve(inputPath);
  try {
    await fs.access(abs);
  } catch {
    console.error(`✗ 路径不存在: ${abs}`);
    process.exit(2);
  }

  const stat = await fs.stat(abs);
  const chunks = await planFile(abs, maxTokens, 'chunk');

  const output: PlanOutput = {
    chunks,
    totalChunks: chunks.length,
    strategy: stat.isDirectory() ? 'dir-tree' : chunks.length > 1 ? 'file-split' : 'single',
    phase,
    nodeType,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// main 守卫：仅在直接执行时运行，被 import 时不触发（供单测导入纯函数）
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    console.error('分块规划脚本异常:', err);
    process.exit(2);
  });
}
