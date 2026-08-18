/**
 * plan-chunks-logic.ts 单元测试 —— 分块规划纯逻辑
 *
 * 覆盖：
 *   - estimateTokens：ASCII 字符数/4；CJK 字节数/4（中文 30194 字符 ≥ 10000 tokens 阈值）
 *   - splitMarkdownSections：header+content 正确配对不丢内容；围栏代码块内 # 行不切分
 *   - splitByLines：单节超限按行二次切分（每块 ≤ maxTokens）；overlap 5 行
 *   - planChunksFromContent：未超限单块 kind=file；超限按标题切分产出 section chunks
 */

import { describe, it, expect } from 'vitest';

import {
  estimateTokens,
  splitMarkdownSections,
  splitByLines,
  planChunksFromContent,
} from '../logic/plan-chunks-logic.js';

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

describe('planChunksFromContent', () => {
  it('未超限：整个文件产出单块 kind=file', () => {
    const content = '# A\ncontent';
    const chunks = planChunksFromContent(content, '/tmp/doc.md', 8000, 'chunk', true);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.kind).toBe('file');
    expect(chunks[0]!.id).toBe('chunk-001');
    expect(chunks[0]!.path).toBe('/tmp/doc.md');
    expect(chunks[0]!.tokens).toBeLessThanOrEqual(8000);
  });

  it('超限 Markdown：按标题切分产出 section chunks，每块 ≤ maxTokens', () => {
    const body = '# H1\n' + Array.from({ length: 200 }, (_, i) => `para-${i}-${'x'.repeat(30)}`).join('\n');
    const chunks = planChunksFromContent(body, '/tmp/big.md', 100, 'chunk', true);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.kind === 'section')).toBe(true);
    expect(chunks.every((c) => c.tokens <= 100)).toBe(true);
  });
});
