/**
 * plan-chunks.ts 单元测试 —— 分块规划纯逻辑
 *
 * 覆盖：
 *   - estimateTokens：ASCII 字符数/4；CJK 字节数/4（中文 30194 字符 ≥ 10000 tokens 阈值）
 *   - splitMarkdownSections：header+content 正确配对不丢内容；围栏代码块内 # 行不切分
 *   - splitByLines：单节超限按行二次切分（每块 ≤ maxTokens）；overlap 5 行
 *   - planFile 目录递归：含嵌套子目录的树产出完整分块计划
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { estimateTokens, splitMarkdownSections, splitByLines, planFile } from '../logic/plan-chunks.js';

describe('estimateTokens', () => {
  it('ASCII：字符数/4 向上取整', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
    expect(estimateTokens('a'.repeat(101))).toBe(Math.ceil(101 / 4));
  });

  it('CJK：字节数/4（中文 30194 字符 ≥ 10000 tokens 阈值）', () => {
    const cjk = '中文'.repeat(5000);
    expect(estimateTokens(cjk)).toBe(Math.ceil(Buffer.byteLength(cjk, 'utf8') / 4));
    const bigCjk = '中'.repeat(30194);
    expect(estimateTokens(bigCjk)).toBeGreaterThanOrEqual(10000);
  });
});

describe('splitMarkdownSections', () => {
  it('header+content 正确配对且不丢内容', () => {
    const md = '# A\naaa\n# B\nbbb';
    const sections = splitMarkdownSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toBe('# A\naaa');
    expect(sections[1]).toBe('# B\nbbb');
  });

  it('围栏代码块内 # 行不切分', () => {
    const md = '```\n# not header\n```\n# Real\nbody';
    const sections = splitMarkdownSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toBe('```\n# not header\n```');
    expect(sections[1]).toBe('# Real\nbody');
    expect(sections[1]!.startsWith('# Real')).toBe(true);
  });
});

describe('splitByLines', () => {
  it('单节超限按行二次切分，每块 tokens ≤ maxTokens', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line-${String(i).padStart(3, '0')}`);
    const text = lines.join('\n');
    const maxTokens = 100;
    const chunks = splitByLines(text, maxTokens, '/tmp/doc.md', 'chunk-001');
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.kind).toBe('section');
      expect(c.path).toBe('/tmp/doc.md');
      expect(c.tokens).toBeLessThanOrEqual(maxTokens);
    }
    expect(chunks[0]!.id).toBe('chunk-001-001');
  });

  it('单行超长：该行单独成块可超过 maxTokens（其余块仍受限）', () => {
    const long = 'x'.repeat(2000);
    const text = `aaa\n${long}\nbbb`;
    const chunks = splitByLines(text, 100, '/f.md', 'c');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((c) => c.tokens > 100)).toBe(true);
    expect(chunks.filter((c) => c.tokens <= 100).length).toBeGreaterThan(0);
  });
});

describe('planFile', () => {
  let tmpRoot: string;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-chunks-'));
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('目录递归：含嵌套子目录的树产出完整分块计划', async () => {
    const tree = path.join(tmpRoot, 'tree');
    await fs.mkdir(path.join(tree, 'sub', 'nested'), { recursive: true });
    await fs.writeFile(path.join(tree, 'a.md'), '# A\ncontent');
    await fs.writeFile(path.join(tree, 'sub', 'nested', 'b.md'), '# B\ncontent');

    const chunks = await planFile(tree, 8000, 'chunk');
    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.path).sort()).toEqual(
      [path.join(tree, 'a.md'), path.join(tree, 'sub', 'nested', 'b.md')].sort(),
    );
    expect(chunks.every((c) => c.kind === 'file')).toBe(true);
  });

  it('单文件超限：按标题切分产出 section chunks，每块 ≤ maxTokens', async () => {
    const f = path.join(tmpRoot, 'big.md');
    const body = '# H1\n' + Array.from({ length: 200 }, (_, i) => `para-${i}-${'x'.repeat(30)}`).join('\n');
    await fs.writeFile(f, body);

    const chunks = await planFile(f, 100, 'chunk');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.kind === 'section')).toBe(true);
    expect(chunks.every((c) => c.tokens <= 100)).toBe(true);
  });
});
