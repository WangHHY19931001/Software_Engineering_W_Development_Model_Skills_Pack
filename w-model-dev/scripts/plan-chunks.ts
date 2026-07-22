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
    if (a.startsWith('--phase=')) phase = Number.parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--node-type=')) nodeType = a.split('=')[1];
    else if (a.startsWith('--max-tokens=')) maxTokens = Number.parseInt(a.split('=')[1], 10);
  }
  if (![1, 2, 3, 4].includes(phase ?? 0)) {
    console.error(`✗ --phase 必须为 1-4，实际: ${phase}`);
    process.exit(2);
  }
  if (!['REQ', 'SD', 'INTF', 'DD'].includes(nodeType ?? '')) {
    console.error(`✗ --node-type 必须为 REQ|SD|INTF|DD，实际: ${nodeType}`);
    process.exit(2);
  }
  return { inputPath, phase: phase!, nodeType: nodeType!, maxTokens };
}

function estimateTokens(text: string): number {
  // 字符数 / 4 近似（实现阶段可调，见设计文档 §6 开放问题1）
  return Math.ceil(text.length / 4);
}

async function splitMarkdownByHeaders(
  content: string,
  maxTokens: number,
  filePath: string,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  // 按 # 标题切分；若单节仍超限，按行数二次切分
  const sections = content.split(/^(#{1,6}\s)/m);
  const chunks: Chunk[] = [];
  let current = '';
  let idx = 1;
  for (let i = 0; i < sections.length; i++) {
    const piece = i === 0 ? sections[i] : sections[i] + (sections[i + 1] ?? '');
    if (i !== 0) i++; // 跳过已消费的标题部分
    const candidate = current + piece;
    if (estimateTokens(candidate) > maxTokens && current.length > 0) {
      chunks.push({
        id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
        path: filePath,
        kind: 'section',
        tokens: estimateTokens(current),
      });
      idx++;
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(current),
    });
  }
  return chunks;
}

async function planFile(
  filePath: string,
  maxTokens: number,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    // 目录：按叶子文件分块
    const entries = await fs.readdir(filePath, { withFileTypes: true });
    const chunks: Chunk[] = [];
    let idx = 1;
    for (const e of entries) {
      const childPath = path.join(filePath, e.name);
      if (e.isFile()) {
        const sub = await planFile(childPath, maxTokens, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
        chunks.push(...sub);
        idx++;
      }
      // 子目录递归（叶子子目录=一候选块由递归自然处理）
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
  // 按行切（overlap 50 行）
  const lines = content.split('\n');
  const linesPerChunk = Math.ceil((maxTokens * 4) / 1); // 近似：maxTokens*4 字符 ≈ 行数
  const chunks: Chunk[] = [];
  let idx = 1;
  for (let i = 0; i < lines.length; i += linesPerChunk - 50) {
    const slice = lines.slice(i, i + linesPerChunk).join('\n');
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(slice),
    });
    idx++;
    if (i + linesPerChunk >= lines.length) break;
  }
  return chunks;
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

main().catch((err) => {
  console.error('分块规划脚本异常:', err);
  process.exit(2);
});
