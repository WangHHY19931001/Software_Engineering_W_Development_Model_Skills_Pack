/**
 * M1 复杂度度量逻辑（logic/complexity-logic.ts）单元测试。
 *
 * 纯函数、数据注入、零 fs import（unit-parallel project，无子进程 spawn，不需登记
 * SUBPROCESS_TEST_FILES）。覆盖：
 *   - computeComplexityReport：正常 / 超限（1200 行）分桶 / 1200 行边界不超限 / 空输入
 *     fail-closed 抛 ComplexityFormatError（仿 CoverageScopeFormatError）；
 *   - countPersonaAdaption：marker 命中计数、恰好 2 个 marker 的适配边界、重复命中不重复计数；
 *   - checkComplexityBudget：单文件行数上限（含异常表缺席 / 异常表豁免）、反模式 / 硬约束 /
 *     人格适配 / 沉积四类 cap 的 violations 文案逐条带实测值与 cap。
 */

import { describe, expect, it } from 'vitest';

import {
  checkComplexityBudget,
  COMPLEXITY_DEFAULT_MAX_LINES,
  ComplexityFormatError,
  computeComplexityReport,
  countPersonaAdaption,
  parseBudgetCaps,
  PERSONA_ADAPTION_MARKERS,
  type BudgetCaps,
  type ComplexityMeasurement,
} from '../logic/complexity-logic.js';

function measurement(overrides?: Partial<ComplexityMeasurement>): ComplexityMeasurement {
  return {
    referencesFiles: [],
    scriptFiles: [],
    antiPatternCount: 0,
    hardConstraintCount: 0,
    personaAdaptedCount: 0,
    personaTotal: 36,
    sedimentCount: 0,
    ...overrides,
  };
}

function caps(overrides?: Partial<BudgetCaps>): BudgetCaps {
  return {
    referencesDefaultMaxLines: COMPLEXITY_DEFAULT_MAX_LINES,
    referencesExceptions: {},
    scriptsDefaultMaxLines: COMPLEXITY_DEFAULT_MAX_LINES,
    scriptsExceptions: {},
    antiPatternMaxCount: 48,
    hardConstraintMaxCount: 14,
    personaAdaptedMinCount: 0,
    sedimentMaxCount: 0,
    ...overrides,
  };
}

describe('computeComplexityReport', () => {
  it('正常输入：不超限文件分桶为空，m 原样透传，generatedAt 为字符串', () => {
    const m = measurement({
      referencesFiles: [
        { path: 'references/graph-guide.md', lines: 800 },
        { path: 'references/bdd.md', lines: 500 },
      ],
      scriptFiles: [{ path: 'scripts/logic/gate-logic.ts', lines: 900 }],
      antiPatternCount: 48,
      hardConstraintCount: 14,
      personaAdaptedCount: 30,
      personaTotal: 36,
      sedimentCount: 3,
    });
    const r = computeComplexityReport(m);
    expect(r.oversizedReferences).toEqual([]);
    expect(r.oversizedScripts).toEqual([]);
    expect(r.m).toBe(m);
    expect(typeof r.generatedAt).toBe('string');
    expect(r.generatedAt.length).toBeGreaterThan(0);
  });

  it('超限输入：超过 1200 行的 references / scripts 各自进分桶，1200 行整不超限', () => {
    const m = measurement({
      referencesFiles: [
        { path: 'references/tla-plus.md', lines: 2471 },
        { path: 'references/command-reference.md', lines: 1200 },
      ],
      scriptFiles: [
        { path: 'scripts/cli/check-samples-coverage.ts', lines: 1182 },
        { path: 'scripts/cli/self-test.ts', lines: 5600 },
      ],
    });
    const r = computeComplexityReport(m);
    expect(r.oversizedReferences).toEqual([{ path: 'references/tla-plus.md', lines: 2471 }]);
    expect(r.oversizedScripts).toEqual([{ path: 'scripts/cli/self-test.ts', lines: 5600 }]);
  });

  it('空输入 fail-closed：null / undefined / 数组 / 缺数组字段均抛 ComplexityFormatError', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 故意注入非法输入测试 fail-closed 守卫
    for (const bad of [null, undefined, [], {}] as any[]) {
      expect(() => computeComplexityReport(bad)).toThrow(ComplexityFormatError);
    }
  });

  it('FileLines 条目缺 path 或 lines 抛 ComplexityFormatError', () => {
    const m = measurement({
      referencesFiles: [{ path: 'references/x.md', lines: 1 }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 故意注入非 FileLines 条目
    const bad = measurement({ scriptFiles: [{ path: 1, lines: 'x' } as any] });
    expect(() => computeComplexityReport(bad)).toThrow(ComplexityFormatError);
    expect(() => computeComplexityReport(m)).not.toThrow();
  });
});

describe('countPersonaAdaption', () => {
  it('正文不含任何 marker 计数为 0', () => {
    expect(countPersonaAdaption('这是一段与 W 模型制品无关的正文')).toBe(0);
  });

  it('恰好命中 1 个 marker 计数为 1', () => {
    expect(countPersonaAdaption('本人格负责维护 run-log 登记')).toBe(1);
  });

  it('恰好命中 2 个 marker 计数为 2（适配边界 ≥2）', () => {
    expect(countPersonaAdaption('本人格消费 .w-model 状态并回填 RTM 追溯')).toBe(2);
  });

  it('全部 marker 命中计数为 PERSONA_ADAPTION_MARKERS.length', () => {
    const all = PERSONA_ADAPTION_MARKERS.join(' ');
    expect(countPersonaAdaption(all)).toBe(PERSONA_ADAPTION_MARKERS.length);
  });

  it('同一 marker 重复出现只计一次', () => {
    expect(countPersonaAdaption('.w-model 与 .w-model 重复提及')).toBe(1);
  });
});

describe('checkComplexityBudget', () => {
  it('全部维度在 cap 内 passed=true 且 violations 为空', () => {
    const r = checkComplexityBudget(
      measurement({
        referencesFiles: [{ path: 'references/a.md', lines: 10 }],
        scriptFiles: [{ path: 'scripts/cli/b.ts', lines: 10 }],
        antiPatternCount: 48,
        hardConstraintCount: 14,
        personaAdaptedCount: 30,
        sedimentCount: 0,
      }),
      caps(),
    );
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('恰好等于 cap：行数恰达默认上限 / 异常 cap 均 passed（棘轮边界不越线）', () => {
    const r = checkComplexityBudget(
      measurement({
        referencesFiles: [{ path: 'references/a.md', lines: COMPLEXITY_DEFAULT_MAX_LINES }],
        scriptFiles: [{ path: 'scripts/cli/self-test.ts', lines: 6000 }],
        antiPatternCount: 48,
        hardConstraintCount: 14,
        personaAdaptedCount: 4,
        sedimentCount: 10,
      }),
      caps({
        scriptsExceptions: { 'scripts/cli/self-test.ts': 6000 },
        personaAdaptedMinCount: 4,
        sedimentMaxCount: 10,
      }),
    );
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('超 1 行：超过 cap 恰一行即 violation，文案同时含实测线与 cap 数值', () => {
    const r = checkComplexityBudget(
      measurement({
        referencesFiles: [{ path: 'references/a.md', lines: COMPLEXITY_DEFAULT_MAX_LINES + 1 }],
      }),
      caps(),
    );
    expect(r.passed).toBe(false);
    expect(r.violations).toContain(
      `references/a.md ${COMPLEXITY_DEFAULT_MAX_LINES + 1} > cap ${COMPLEXITY_DEFAULT_MAX_LINES}`,
    );
  });

  it('references 文件超默认上限且不在异常表 → violation 带实测值与 cap', () => {
    const r = checkComplexityBudget(
      measurement({
        referencesFiles: [{ path: 'references/tla-plus.md', lines: 2471 }],
      }),
      caps({ referencesDefaultMaxLines: COMPLEXITY_DEFAULT_MAX_LINES }),
    );
    expect(r.passed).toBe(false);
    expect(r.violations).toContain('references/tla-plus.md 2471 > cap 1200');
  });

  it('references 异常表缺席：文件不在 exceptions 也超 default → violation；在异常表内按异常 cap 豁免', () => {
    const m = measurement({
      referencesFiles: [
        { path: 'references/tla-plus.md', lines: 2471 },
        { path: 'references/command-reference.md', lines: 2471 },
      ],
    });
    const withException = caps({
      referencesExceptions: { 'references/tla-plus.md': 3000 },
    });
    const r = checkComplexityBudget(m, withException);
    expect(r.passed).toBe(false);
    expect(r.violations).toContain('references/command-reference.md 2471 > cap 1200');
    expect(r.violations).not.toContain('references/tla-plus.md 2471 > cap 3000');
    expect(r.violations).not.toContain('references/tla-plus.md 2471 > cap 1200');
    expect(r.violations.filter((v) => v.startsWith('references/command-reference.md')).length).toBe(1);
  });

  it('scripts 文件超上限按 scriptsExceptions 生效', () => {
    const r = checkComplexityBudget(
      measurement({
        scriptFiles: [{ path: 'scripts/cli/self-test.ts', lines: 5600 }],
      }),
      caps({ scriptsExceptions: { 'scripts/cli/self-test.ts': 6000 } }),
    );
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);

    const r2 = checkComplexityBudget(
      measurement({
        scriptFiles: [{ path: 'scripts/cli/self-test.ts', lines: 5600 }],
      }),
      caps(),
    );
    expect(r2.passed).toBe(false);
    expect(r2.violations).toContain('scripts/cli/self-test.ts 5600 > cap 1200');
  });

  it('反模式计数超上限 → violation', () => {
    const r = checkComplexityBudget(measurement({ antiPatternCount: 49 }), caps({ antiPatternMaxCount: 48 }));
    expect(r.violations).toContain('antiPatternCount 49 > cap 48');
    expect(r.passed).toBe(false);
  });

  it('硬约束计数超上限 → violation', () => {
    const r = checkComplexityBudget(measurement({ hardConstraintCount: 15 }), caps({ hardConstraintMaxCount: 14 }));
    expect(r.violations).toContain('hardConstraintCount 15 > cap 14');
    expect(r.passed).toBe(false);
  });

  it('人格适配计数低于下限 → violation', () => {
    const r = checkComplexityBudget(measurement({ personaAdaptedCount: 29 }), caps({ personaAdaptedMinCount: 30 }));
    expect(r.violations).toContain('personaAdaptedCount 29 < cap 30');
    expect(r.passed).toBe(false);
  });

  it('沉积标记计数超上限 → violation', () => {
    const r = checkComplexityBudget(measurement({ sedimentCount: 11 }), caps({ sedimentMaxCount: 10 }));
    expect(r.violations).toContain('sedimentCount 11 > cap 10');
    expect(r.passed).toBe(false);
  });

  it('多维度同时超限 violations 逐条累计', () => {
    const r = checkComplexityBudget(
      measurement({
        referencesFiles: [{ path: 'references/a.md', lines: 1300 }],
        antiPatternCount: 60,
        sedimentCount: 5,
      }),
      caps({ antiPatternMaxCount: 48, sedimentMaxCount: 0 }),
    );
    expect(r.passed).toBe(false);
    expect(r.violations).toHaveLength(3);
  });
});

describe('parseBudgetCaps', () => {
  it('合法 caps（含 schemaVersion/description 额外顶层键）解析为 BudgetCaps', () => {
    const raw = {
      schemaVersion: '1.0',
      description: '棘轮语义',
      referencesDefaultMaxLines: 1200,
      referencesExceptions: { 'references/tla-plus.md': 2472 },
      scriptsDefaultMaxLines: 1200,
      scriptsExceptions: { 'scripts/cli/self-test.ts': 5766 },
      antiPatternMaxCount: 48,
      hardConstraintMaxCount: 14,
      personaAdaptedMinCount: 4,
      sedimentMaxCount: 46,
    };
    const c = parseBudgetCaps(raw);
    expect(c.referencesDefaultMaxLines).toBe(1200);
    expect(c.referencesExceptions['references/tla-plus.md']).toBe(2472);
    expect(c.scriptsExceptions['scripts/cli/self-test.ts']).toBe(5766);
    expect(c.personaAdaptedMinCount).toBe(4);
  });

  it('缺必填数值字段 / 缺异常表 / 非对象输入均抛 ComplexityFormatError', () => {
    const valid = {
      referencesDefaultMaxLines: 1200,
      referencesExceptions: {},
      scriptsDefaultMaxLines: 1200,
      scriptsExceptions: {},
      antiPatternMaxCount: 48,
      hardConstraintMaxCount: 14,
      personaAdaptedMinCount: 4,
      sedimentMaxCount: 46,
    };
    const { sedimentMaxCount: _drop, ...missingField } = valid;
    void _drop;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 故意注入非法 caps 输入测试 fail-closed 守卫
    for (const bad of [null, undefined, [], 'x', missingField, { ...valid, referencesExceptions: 'nope' }] as any[]) {
      expect(() => parseBudgetCaps(bad)).toThrow(ComplexityFormatError);
    }
  });
});
