// w-model-dev/scripts/__tests__/coverage-scope-logic.test.ts
import { describe, expect, it } from 'vitest';

import {
  computeCoverageScope,
  CoverageScopeFormatError,
  type CoverageScopeThresholds,
} from '../logic/coverage-scope-logic.js';

const ZERO: CoverageScopeThresholds = { statements: 0, branches: 0, functions: 0, lines: 0 };

function entry(partial: { s: number[]; f: number[]; b: number[][]; stmtLines: Array<[number, number]> }): unknown {
  const statementMap = Object.fromEntries(
    partial.stmtLines.map(([line], i) => [String(i), { start: { line }, end: { line } }]),
  );
  return {
    s: Object.fromEntries(partial.s.map((v, i) => [String(i), v])),
    f: Object.fromEntries(partial.f.map((v, i) => [String(i), v])),
    b: Object.fromEntries(partial.b.map((arr, i) => [String(i), arr])),
    statementMap,
    branchMap: {},
    fnMap: {},
  };
}

describe('computeCoverageScope', () => {
  it('只统计 logic/lib 路径，cli 与 application 层忽略；指标按 istanbul s/b/f 与 statementMap 行集合计算', () => {
    const report = {
      'D:\\repo\\w-model-dev\\scripts\\logic\\foo-logic.ts': entry({
        s: [1, 0],
        f: [1],
        b: [[1, 0]],
        stmtLines: [
          [10, 10],
          [11, 11],
        ],
      }),
      'D:\\repo\\w-model-dev\\scripts\\lib\\cli-error.ts': entry({ s: [1], f: [0], b: [], stmtLines: [[5, 5]] }),
      'D:\\repo\\w-model-dev\\scripts\\cli\\wm-status.ts': entry({ s: [0], f: [0], b: [], stmtLines: [[1, 1]] }),
    };
    const r = computeCoverageScope(report, ZERO);
    expect(r.fileCount).toBe(2);
    // 顺序=localeCompare 升序（'lib' < 'logic'），保证门禁 JSON 输出跨机器/跨运行逐字节可复现
    expect(r.files.map((f) => f.file)).toEqual(['lib/cli-error.ts', 'logic/foo-logic.ts']);
    // logic 文件排序后位于索引 1：stmts 1/2=50.00；funcs 1/1=100.00；branches 1/2=50.00；lines 1/2=50.00
    expect(r.files[1]).toMatchObject({
      statements: { covered: 1, total: 2, pct: 50 },
      functions: { covered: 1, total: 1, pct: 100 },
      branches: { covered: 1, total: 2, pct: 50 },
      lines: { covered: 1, total: 2, pct: 50 },
    });
    // 合并：stmts 2/3、funcs 1/2、branches 1/2、lines 2/3
    expect(r.totals).toEqual({ statements: 66.67, branches: 50, functions: 50, lines: 66.67 });
  });

  it('阈值不达时 passed=false 且 failures 逐指标列出实际值与阈值', () => {
    const report = {
      'D:/repo/w-model-dev/scripts/logic/foo.ts': entry({
        s: [1, 0],
        f: [1],
        b: [[1]],
        stmtLines: [
          [1, 1],
          [2, 2],
        ],
      }),
    };
    const r = computeCoverageScope(report, { statements: 75, branches: 65, functions: 85, lines: 75 });
    expect(r.passed).toBe(false);
    expect(r.failures.some((m) => m.includes('statements') && m.includes('50') && m.includes('75'))).toBe(true);
  });

  it('缺 s/b/f/statementMap 键或行号非数字 → CoverageScopeFormatError（fail-loud）', () => {
    expect(() => computeCoverageScope({ 'D:/x/w-model-dev/scripts/logic/a.ts': { s: {} } }, ZERO)).toThrow(
      CoverageScopeFormatError,
    );
    expect(() => computeCoverageScope('not-an-object', ZERO)).toThrow(CoverageScopeFormatError);
  });
});
