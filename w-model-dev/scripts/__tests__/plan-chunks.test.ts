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
  it('token 估算（2 态：ASCII 字符数/4 向上取整 / CJK 字节数/4）', () => {
    // 态 1：ASCII
    expect(estimateTokens(''), 'ASCII 空串 = 0').toBe(0);
    expect(estimateTokens('a'.repeat(100)), 'ASCII 100 字符 = 25').toBe(25);
    expect(estimateTokens('a'.repeat(101)), 'ASCII 101 字符向上取整').toBe(Math.ceil(101 / 4));
    // 态 2：CJK
    const cjk = '中文'.repeat(5000);
    expect(estimateTokens(cjk), 'CJK 按字节数/4').toBe(Math.ceil(Buffer.byteLength(cjk, 'utf8') / 4));
    const bigCjk = '中'.repeat(30194);
    expect(estimateTokens(bigCjk), '中文 30194 字符 ≥ 10000 tokens 阈值').toBeGreaterThanOrEqual(10000);
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
  it('二次切分（2 态：常规受限切分每块 ≤ maxTokens / 单行超长该行单独成块可超限）', () => {
    // 态 1：单节超限按行二次切分，每块 tokens ≤ maxTokens
    const lines = Array.from({ length: 200 }, (_, i) => `line-${String(i).padStart(3, '0')}`);
    const text = lines.join('\n');
    const maxTokens = 100;
    const chunks = splitByLines(text, maxTokens, '/tmp/doc.md', 'chunk-001');
    expect(chunks.length, '受限态应切出多块').toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.kind, `受限态块 ${c.id} kind=section`).toBe('section');
      expect(c.path, `受限态块 ${c.id} path 保真`).toBe('/tmp/doc.md');
      expect(c.tokens, `受限态块 ${c.id} tokens ≤ ${maxTokens}`).toBeLessThanOrEqual(maxTokens);
    }
    expect(chunks[0]!.id, '受限态首块 id').toBe('chunk-001-001');
    // 态 2：单行超长——该行单独成块可超过 maxTokens（其余块仍受限）
    const long = 'x'.repeat(2000);
    const textLong = `aaa\n${long}\nbbb`;
    const chunksLong = splitByLines(textLong, 100, '/f.md', 'c');
    expect(chunksLong.length, '超长态应切出多块').toBeGreaterThan(1);
    expect(
      chunksLong.some((c) => c.tokens > 100),
      '超长态存在超限块',
    ).toBe(true);
    expect(chunksLong.filter((c) => c.tokens <= 100).length, '超长态其余块仍受限').toBeGreaterThan(0);
  });
});

describe('planChunksFromContent', () => {
  it('未超限/超限对照（2 态：未超限整文件单块 kind=file / 超限按标题切分产出 section chunks）', () => {
    // 态 1：未超限——整个文件产出单块 kind=file
    const content = '# A\ncontent';
    const chunks = planChunksFromContent(content, '/tmp/doc.md', 8000, 'chunk', true);
    expect(chunks, '未超限态单块').toHaveLength(1);
    expect(chunks[0]!.kind, '未超限态 kind=file').toBe('file');
    expect(chunks[0]!.id, '未超限态 id').toBe('chunk-001');
    expect(chunks[0]!.path, '未超限态 path 保真').toBe('/tmp/doc.md');
    expect(chunks[0]!.tokens, '未超限态 tokens ≤ 8000').toBeLessThanOrEqual(8000);
    // 态 2：超限 Markdown——按标题切分产出 section chunks，每块 ≤ maxTokens
    const body = '# H1\n' + Array.from({ length: 200 }, (_, i) => `para-${i}-${'x'.repeat(30)}`).join('\n');
    const chunksBig = planChunksFromContent(body, '/tmp/big.md', 100, 'chunk', true);
    expect(chunksBig.length, '超限态切出多块').toBeGreaterThan(1);
    expect(
      chunksBig.every((c) => c.kind === 'section'),
      '超限态全部 kind=section',
    ).toBe(true);
    expect(
      chunksBig.every((c) => c.tokens <= 100),
      '超限态每块 tokens ≤ 100',
    ).toBe(true);
  });
});
