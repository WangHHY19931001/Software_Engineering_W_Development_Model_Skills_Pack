/**
 * 分块规划纯逻辑（w-model-dev/scripts/logic/plan-chunks-logic.ts）
 *
 * 分块规划纯逻辑，自 plan-chunks.ts 拆分（审计修复 P5b：logic/ 层零 IO）。
 * 仅包含纯函数与数据类型，零 import node:fs、零 process/console 引用；
 * 所有 IO（读路径、读文件、目录遍历、参数解析、输出、退出码）在 cli/plan-chunks.ts 入口层。
 *
 * 对应 w-model-dev/references/ingestion-chunk.md。
 * 编排者（O）以只读方式调用 cli/plan-chunks.ts，脚本不写任何文件，仅 stdout 输出 JSON 分块计划。
 */
export interface Chunk {
  id: string;
  path: string;
  kind: 'file' | 'dir' | 'section';
  tokens: number;
}

export interface PlanOutput {
  chunks: Chunk[];
  totalChunks: number;
  strategy: 'file-split' | 'dir-tree' | 'single';
  phase: number;
  nodeType: string;
}

const CHUNK_TOKEN_DIVISOR = 4;

/** token 估算：UTF-8 字节数 / 4（CJK 每字约 3 字节 ≈ 0.75 token/字符串；近似，实现可调） */
export function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / CHUNK_TOKEN_DIVISOR);
}

/** 按 markdown 标题（#1-#6）切分节；围栏代码块（``` / ~~~）内的 # 行不切分 */
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

/** 按行切块（overlap 5 行），每块 token ≤ maxTokens（单行超长除外：该行单独成块可超限） */
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
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(slice),
    });
    idx++;
    const keep = buf.slice(-OVERLAP);
    buf = [...keep];
    bufBytes = keep.reduce((a, l) => a + Buffer.byteLength(l, 'utf8') + 1, 0);
  };
  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
    if (bufBytes + lineBytes > maxTokens * CHUNK_TOKEN_DIVISOR && buf.length > 0) flush();
    buf.push(line);
    bufBytes += lineBytes;
  }
  if (buf.length > 0) flush();
  return chunks;
}

/** 按标题切块：优先按节聚合（≤ maxTokens），单节超限则按行二次切分 */
export function splitMarkdownByHeaders(
  content: string,
  maxTokens: number,
  filePath: string,
  chunkIdPrefix: string,
): Chunk[] {
  const sections = splitMarkdownSections(content);
  const chunks: Chunk[] = [];
  let current = '';
  let idx = 1;
  for (const sec of sections) {
    if (estimateTokens(current + sec) > maxTokens && current.length > 0) {
      chunks.push({
        id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
        path: filePath,
        kind: 'section',
        tokens: estimateTokens(current),
      });
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
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(current),
    });
  }
  return chunks;
}

/**
 * 给定 file 内容产块（纯逻辑，cli 层读文件后调用）：
 * token ≤ maxTokens → 单块 kind=file；超限 → .md/.markdown 按标题切，否则按行切。
 * isMarkdown 由调用方传入（cli 依据文件后缀决定），默认按 filePath 后缀推断。
 */
export function planChunksFromContent(
  content: string,
  filePath: string,
  maxTokens: number,
  chunkIdPrefix: string,
  isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown'),
): Chunk[] {
  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) {
    return [{ id: `${chunkIdPrefix}-001`, path: filePath, kind: 'file', tokens }];
  }
  return isMarkdown
    ? splitMarkdownByHeaders(content, maxTokens, filePath, chunkIdPrefix)
    : splitByLines(content, maxTokens, filePath, chunkIdPrefix);
}
