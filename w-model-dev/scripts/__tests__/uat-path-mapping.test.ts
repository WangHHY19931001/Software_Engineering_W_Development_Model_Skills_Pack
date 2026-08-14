/**
 * uat-path-mapping.test.ts —— lib/uat-path-mapping.ts 解析与校验单元测试
 *
 * 覆盖：
 *   - parseUatPathMappingFromContent：合法表解析 / 畸形行（单元格数 <4）/ 空单元格 / 无有效映射行
 *   - checkUatPathMappingContent：严格解析 + 回填校验（未回填 / mappingType 非法）
 *   - collectUatMappingViolations：phase=1 存在性（P0-1）/ phase=5 与终检回填 / 其他阶段不校验
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  parseUatPathMappingFromContent,
  checkUatPathMappingContent,
  collectUatMappingViolations,
} from '../lib/uat-path-mapping.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uat-map-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const VALID_TABLE = [
  '| UAT ID | 验收用例路径 | 实际代码路径 | 映射类型 | 说明 |',
  '|---|---|---|---|---|',
  '| UAT-001 | POST /api/posts | POST /api/posts | 直接 | 同路径 |',
  '| UAT-002 | GET /api/posts/:id | GET /api/articles/:id | 等价 | 语义等价 |',
].join('\n');

describe('parseUatPathMappingFromContent', () => {
  it('合法表格解析为 rows（uatId/actualPath/mappingType）且零 violation', () => {
    const r = parseUatPathMappingFromContent(VALID_TABLE);
    expect(r.violations).toHaveLength(0);
    expect(r.rows).toEqual([
      { uatId: 'UAT-001', actualPath: 'POST /api/posts', mappingType: '直接' },
      { uatId: 'UAT-002', actualPath: 'GET /api/articles/:id', mappingType: '等价' },
    ]);
  });

  it('单元格数 <4 的畸形行 → violation（不静默跳行）', () => {
    const content = `| UAT ID | a | b | c |\n|---|---|---|---|\n| UAT-003 | x | y |\n`;
    const r = parseUatPathMappingFromContent(content);
    expect(r.violations.some((v) => v.includes('畸形') && v.includes('单元格数 3'))).toBe(true);
    expect(r.rows).toHaveLength(0);
  });

  it('前 4 列含空单元格 → violation', () => {
    const content = `| UAT ID | a | b | c | d |\n|---|---|---|---|---|\n| UAT-004 | | y | 直接 | z |\n`;
    const r = parseUatPathMappingFromContent(content);
    expect(r.violations.some((v) => v.includes('含空单元格'))).toBe(true);
    expect(r.rows).toHaveLength(0);
  });

  it('非空但无有效映射行 → 「无有效映射行」violation', () => {
    const r = parseUatPathMappingFromContent('# 只有标题，无表格数据');
    expect(r.violations).toEqual(['uat-path-mapping 无有效映射行']);
  });
});

describe('checkUatPathMappingContent', () => {
  it('合法且回填完整 → 零 violation', () => {
    expect(checkUatPathMappingContent(VALID_TABLE)).toHaveLength(0);
  });

  it('actualPath 为待回填占位符 → 「未回填」violation', () => {
    const content = '| UAT ID | a | b | c | d |\n|---|---|---|---|---|\n| UAT-005 | x | _待阶段5回填_ | 直接 | z |';
    const v = checkUatPathMappingContent(content);
    expect(v.some((m) => m.includes('未回填') && m.includes('UAT-005'))).toBe(true);
  });

  it('mappingType 非法 → violation 且含合法值提示', () => {
    const content = '| UAT ID | a | b | c | d |\n|---|---|---|---|---|\n| UAT-006 | x | y | 错误 | z |';
    const v = checkUatPathMappingContent(content);
    expect(
      v.some((m) => m.includes('mappingType 非法') && m.includes('UAT-006') && m.includes('["直接", "等价", "替代"]')),
    ).toBe(true);
  });
});

describe('collectUatMappingViolations', () => {
  it('phase=1 且 docs/uat-path-mapping.md 不存在 → P0-1 存在性 violation', async () => {
    const v = await collectUatMappingViolations(tmpDir, 1);
    expect(v.some((m) => m.includes('P0-1 校验失败') && m.includes('不存在'))).toBe(true);
  });

  it('phase=1 且文件存在 → 零 violation（存在性校验）', async () => {
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'uat-path-mapping.md'), VALID_TABLE, 'utf-8');
    const v = await collectUatMappingViolations(tmpDir, 1);
    expect(v).toHaveLength(0);
  });

  it('phase=5 读取并回填校验（合法内容 → 零 violation）', async () => {
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'uat-path-mapping.md'), VALID_TABLE, 'utf-8');
    const v = await collectUatMappingViolations(tmpDir, 5);
    expect(v).toHaveLength(0);
  });

  it('phase=5 文件缺失 → 「不存在或无法读取」violation', async () => {
    const v = await collectUatMappingViolations(tmpDir, 5);
    expect(v.some((m) => m.includes('P0-1 校验失败') && m.includes('不存在或无法读取'))).toBe(true);
  });

  it('终检（phaseOption=undefined）同样走回填校验', async () => {
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'uat-path-mapping.md'), VALID_TABLE, 'utf-8');
    const v = await collectUatMappingViolations(tmpDir, undefined);
    expect(v).toHaveLength(0);
  });

  it('其他阶段（phase=3）不校验 → 零 violation', async () => {
    const v = await collectUatMappingViolations(tmpDir, 3);
    expect(v).toHaveLength(0);
  });
});
