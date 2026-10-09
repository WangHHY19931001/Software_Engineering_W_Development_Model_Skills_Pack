/**
 * M1 复杂度采集器（lib/complexity-collect.ts）单元测试（真实 fs fixture，无子进程 → unit-parallel）。
 *
 * 覆盖：references/scripts 收集与 path 形态、行数（`\n` 切分口径）、__tests__ 天然排除、
 * 反模式主表行数与 `## #N` 硬约束数、人格适配阈值（恰好 2 个 marker 计入）、
 * 沉积标记行级计数、缺根/缺结构/缺主表头 fail-closed。
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectComplexityMeasurement,
  ComplexityCollectError,
  countAntiPatternTableRows,
  countHardConstraintHeadings,
  countLines,
} from '../lib/complexity-collect.js';

const temporaryDirectories: string[] = [];

async function fixtureRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'complexity-collect-'));
  temporaryDirectories.push(dir);
  const write = async (rel: string, content: string): Promise<void> => {
    const file = path.join(dir, rel);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture 均建在测试拥有的 mkdtemp 根下
    await fs.mkdir(path.dirname(file), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture 均建在测试拥有的 mkdtemp 根下
    await fs.writeFile(file, content, 'utf8');
  };
  await write('references/a.md', 'line1\nline2\n');
  await write('references/b.md', '整行含已删除标记\nline2\nline3\nline4\n');
  await write(
    'references/hard-constraints.md',
    [
      '## #1 测试设计前置',
      '## #2 阶段门放行',
      '### 约束 #1-a 子节（不计入）',
      '## 反模式（节标题不计入 ## #N）',
      '### 反模式清单',
      '| # | 反模式 | 危害 | 正确做法 |',
      '| 1 | 跳过阶段门 | 缺陷后移 | 走完评审 |',
      '| 2 | 测试后置 | 坏 | 前置 |',
      '| 3 | 估门禁 | 坏 | 以退出码为准 |',
    ].join('\n'),
  );
  await write('scripts/cli/one.ts', 'a\nb\nc\n');
  await write('scripts/logic/two.ts', 'x\n');
  // __tests__ 与 samples 不在 SCRIPT_LAYERS 内，天然排除
  await write('scripts/__tests__/ignored.test.ts', 'should not be counted\n');
  await write('scripts/samples/ignored.ts', 'should not be counted\n');
  // 人格：p1 命中 2 个 marker（.w-model + RTM），p2 命中 1 个，p3 命中 0 个
  await write('subagent/p1.md', '本 agent 消费 .w-model 并回填 RTM\n');
  await write('subagent/p2.md', '涉及 run-log 登记\n');
  await write('subagent/p3.md', '与制品无关\n');
  return dir;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('countLines', () => {
  it('按 \\n 切分的段数计数', () => {
    expect(countLines('a\nb\nc')).toBe(3);
    expect(countLines('a\nb\nc\n')).toBe(4);
    expect(countLines('')).toBe(1);
  });
});

describe('countHardConstraintHeadings / countAntiPatternTableRows', () => {
  it('`## #N` 标题计数，`### 约束 #N-*` 子节不计入', () => {
    const text = '## #1 甲\n## #2 乙\n### 约束 #1-a 子节\n## 代码健康\n';
    expect(countHardConstraintHeadings(text)).toBe(2);
  });

  it('反模式主表行数只在「### 反模式清单」节内计数', () => {
    const text = [
      '## 前文',
      '### 反模式清单',
      '| # | 反模式 | 危害 | 正确做法 |',
      '| 1 | 甲 | 坏 | 好 |',
      '| 2 | 乙 | 坏 | 好 |',
      '### 下一节',
      '| 99 | 不应计入 | x | y |',
    ].join('\n');
    expect(countAntiPatternTableRows(text)).toBe(2);
  });

  it('主表头缺失 fail-closed 抛 ComplexityCollectError(STRUCTURE_INVALID)', () => {
    expect(() => countAntiPatternTableRows('## 无主表\n| 1 | x | y | z |')).toThrow(ComplexityCollectError);
  });
});

describe('collectComplexityMeasurement', () => {
  it('完整采集：path 形态 / 行数 / 反模式 / 硬约束 / 人格适配 / 沉积', async () => {
    const root = await fixtureRoot();
    const m = collectComplexityMeasurement(root);
    // references：a.md（'line1\nline2\n' 切分 = 3 段）+ b.md（= 5 段）+ hard-constraints.md（= 9 段）
    expect(m.referencesFiles.map((f) => f.path)).toEqual([
      'references/a.md',
      'references/b.md',
      'references/hard-constraints.md',
    ]);
    expect(m.referencesFiles.find((f) => f.path === 'references/a.md')?.lines).toBe(3);
    expect(m.referencesFiles.find((f) => f.path === 'references/b.md')?.lines).toBe(5);
    // scripts：cli/one.ts（'a\nb\nc\n' = 4 段）+ logic/two.ts（= 2 段）；__tests__/samples 排除
    expect(m.scriptFiles.map((f) => f.path)).toEqual(['scripts/cli/one.ts', 'scripts/logic/two.ts']);
    expect(m.scriptFiles.find((f) => f.path === 'scripts/cli/one.ts')?.lines).toBe(4);
    expect(m.scriptFiles.find((f) => f.path === 'scripts/logic/two.ts')?.lines).toBe(2);
    expect(m.antiPatternCount).toBe(3);
    expect(m.hardConstraintCount).toBe(2);
    expect(m.personaTotal).toBe(3);
    expect(m.personaAdaptedCount).toBe(1); // 仅 p1 命中 ≥2 个 marker
    expect(m.sedimentCount).toBe(1); // 仅 b.md 含「已删除」
  });

  it('缺 w-model-dev 根 → ComplexityCollectError(FILE_NOT_FOUND)', async () => {
    const root = path.join(os.tmpdir(), 'complexity-collect-missing-root');
    expect(() => collectComplexityMeasurement(root)).toThrow(ComplexityCollectError);
    try {
      collectComplexityMeasurement(root);
    } catch (err) {
      expect((err as ComplexityCollectError).category).toBe('FILE_NOT_FOUND');
      return;
    }
    throw new Error('应抛 FILE_NOT_FOUND');
  });

  it('缺 references 子目录 → ComplexityCollectError(STRUCTURE_INVALID)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'complexity-collect-no-refs-'));
    temporaryDirectories.push(dir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture 建在测试拥有的 mkdtemp 根下
    await fs.mkdir(path.join(dir, 'scripts'), { recursive: true });
    try {
      collectComplexityMeasurement(dir);
    } catch (err) {
      expect((err as ComplexityCollectError).category).toBe('STRUCTURE_INVALID');
      return;
    }
    throw new Error('应抛 STRUCTURE_INVALID');
  });
});
