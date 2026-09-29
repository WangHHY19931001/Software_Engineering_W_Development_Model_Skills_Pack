/**
 * coverage-logic.test.ts —— C1-C10 覆盖分析校验单元测试
 *
 * 覆盖 coverage-logic.ts 中四维·维度4 的覆盖矩阵规则：
 *   C1  stakeholders 非空
 *   C3  scenarios 非空
 *   C4  scenarios 含 happy/error/boundary 三类
 *   C5  requirementTypes 含 REQ/NFR/CON 三类
 *   C7  crossCuts 与 graphCrossCuts 双向一致
 *   C8  metrics 4 项均 = 100%（不允许 partial）
 *   C9  status=missing 须在 Out of Scope 声明（无 outOfScope → warning；有 → fail）
 *   C10 metrics 重算一致性
 *   豁免  exemptions 跳过对应规则
 *   全通过 4 张矩阵完整 + 100% → passed=true
 *
 * 同质用例已按「循环内多断言 + 逐行具名消息」聚合（wave 3 第 B 批）。
 */

import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, afterEach } from 'vitest';

import { checkRequirementCoverage, type CoverageShape } from '../logic/coverage-logic.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

/** 构造一份全通过的合法 CoverageShape（4 张矩阵完整 + 100% 覆盖率） */
function makeValidCoverage(): CoverageShape {
  return {
    stakeholders: [{ id: 'SH-001', role: '终端用户', relatedReqs: ['REQ-001'], status: 'covered' }],
    scenarios: [
      {
        id: 'SC-001',
        description: '正常注册',
        steps: ['提交'],
        relatedReqs: ['REQ-001'],
        status: 'covered',
        scenarioType: 'happy',
      },
      {
        id: 'SC-002',
        description: '邮箱错误',
        steps: ['提交'],
        relatedReqs: ['REQ-001'],
        status: 'covered',
        scenarioType: 'error',
      },
      {
        id: 'SC-003',
        description: '长度边界',
        steps: ['提交'],
        relatedReqs: ['REQ-001'],
        status: 'covered',
        scenarioType: 'boundary',
      },
    ],
    requirementTypes: [
      { type: 'REQ', reqIds: ['REQ-001'], status: 'covered' },
      { type: 'NFR', reqIds: ['NFR-001'], status: 'covered' },
      { type: 'CON', reqIds: ['CON-001'], status: 'covered' },
    ],
    crossCuts: [{ nfrConId: 'NFR-001', governedReqs: ['REQ-001'], status: 'covered' }],
    metrics: { stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 },
  };
}

describe('C1-C10 覆盖分析校验', () => {
  // ==================== C1/C3/C4/C5 缺失矩阵（6 态） ====================
  describe('C1-C5 缺失矩阵', () => {
    it('维度缺失矩阵（6 态：C1/C3 空数组 + C4/C5 类型缺失）应逐态 fail', () => {
      const rows: readonly [
        string,
        string,
        (c: CoverageShape) => void,
        keyof CoverageShape['metrics'],
        string | null,
      ][] = [
        [
          'C1: stakeholders 数组为空（空集视作 100% 匹配重算）',
          'C1',
          (c) => {
            c.stakeholders = [];
          },
          'stakeholder',
          null,
        ],
        [
          'C3: scenarios 数组为空（空集视作 100% 匹配重算）',
          'C3',
          (c) => {
            c.scenarios = [];
          },
          'scenario',
          null,
        ],
        [
          'C4: 缺 error 场景类型',
          'C4',
          (c) => {
            c.scenarios = c.scenarios.filter((s) => s.scenarioType !== 'error');
          },
          'scenario',
          'error',
        ],
        [
          'C4: 缺 boundary 场景类型',
          'C4',
          (c) => {
            c.scenarios = c.scenarios.filter((s) => s.scenarioType !== 'boundary');
          },
          'scenario',
          'boundary',
        ],
        [
          'C5: 缺 NFR 类型',
          'C5',
          (c) => {
            c.requirementTypes = c.requirementTypes.filter((r) => r.type !== 'NFR');
          },
          'requirementType',
          'NFR',
        ],
        [
          'C5: 缺 CON 类型',
          'C5',
          (c) => {
            c.requirementTypes = c.requirementTypes.filter((r) => r.type !== 'CON');
          },
          'requirementType',
          'CON',
        ],
      ];
      for (const [name, rule, mutate, metricKey, token] of rows) {
        const coverage = makeValidCoverage();
        mutate(coverage);
        // eslint-disable-next-line security/detect-object-injection -- metricKey 为用例内字面量行表枚举的 metrics 闭集键（keyof metrics），非用户输入
        coverage.metrics[metricKey] = 100; // 缺失/空集重算仍为 100，匹配重算避免 C10 噪声
        const result = checkRequirementCoverage(coverage);
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => (token === null ? v.includes(rule) : v.includes(rule) && v.includes(token))),
          `${name} 应报 ${rule}${token ? ` 且点名 ${token}` : ''}`,
        ).toBe(true);
      }
    });
  });

  // ==================== C7: crossCuts 与 graphCrossCuts 一致 ====================
  describe('C7: crossCuts 与 graphCrossCuts 双向一致', () => {
    it('C7 违规行（2 态：coverage 有 graph 无 / graph 有 coverage 无）应 fail', () => {
      const rows: readonly [string, ((c: CoverageShape) => void) | null, { from: string; to: string }[], string][] = [
        ['coverage 有但 graph 无的 cross-cuts 边', null, [], 'coverage 有但'],
        [
          'graph 有但 coverage 无的 cross-cuts 边',
          (c) => {
            c.crossCuts = []; // coverage 无 cross-cuts
            c.metrics.crossCut = 0; // 匹配重算
          },
          [{ from: 'NFR-001', to: 'REQ-001' }],
          'graph.json 有但',
        ],
      ];
      for (const [name, mutate, graphCrossCuts, marker] of rows) {
        const coverage = makeValidCoverage();
        if (mutate) mutate(coverage);
        const result = checkRequirementCoverage(coverage, { graphCrossCuts });
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => v.includes('C7') && v.includes(marker)),
          `${name} 应报 C7（${marker}）`,
        ).toBe(true);
      }
    });

    it('C7: 双向一致时无违规', () => {
      const coverage = makeValidCoverage();
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
      });
      expect(result.violations.some((v) => v.includes('C7'))).toBe(false);
    });
  });

  // ==================== C7b: 无 --graph 时空矩阵 fail-closed / 非空降级 ====================
  describe('C7b: 未提供 --graph 时的 fail-closed 语义', () => {
    it('C7b 两态（crossCuts 空 → blocking / 非空 → warning 降级）', () => {
      const rows: readonly [string, CoverageShape['crossCuts'], boolean][] = [
        ['crossCuts 为空且未提供 --graph → blocking', [], true],
        [
          'crossCuts 非空且无 --graph → warning + skippedRules 标记，不 blocking',
          [{ nfrConId: 'NFR-001', governedReqs: ['REQ-001'], status: 'covered' }], // 条目形状对照 samples/coverage/valid-cross-cuts-consistent.json 既有条目
          false,
        ],
      ];
      for (const [name, crossCuts, blocking] of rows) {
        const r = checkRequirementCoverage({ ...makeValidCoverage(), crossCuts }, {}); // 无 graphCrossCuts
        if (blocking) {
          expect(
            r.violations.some((v) => v.startsWith('C7b')),
            `${name} 应报 C7b`,
          ).toBe(true);
          expect(r.passed, `${name} 应 fail`).toBe(false);
        } else {
          expect(r.violations, `${name} 不应有 violation`).toEqual([]);
          expect(
            r.warnings.some((w) => w.includes('C7')),
            `${name} 应有 C7 warning`,
          ).toBe(true);
          expect(r.skippedRules, `${name} 应标记 skippedRules 含 C7`).toContain('C7');
        }
      }
    });
  });

  // ==================== C8: metrics 4 项均 = 100% ====================
  describe('C8/C10 计量不一致', () => {
    it('C8 行（2 态：metrics<100 / partial 项）应 fail', () => {
      const rows: readonly [string, number, string][] = [
        ['metrics.stakeholder < 100', 75, 'stakeholder'],
        ['存在 partial 项应 fail（即使 metrics=100，此处 75 匹配重算隔离 C10）', 75, 'partial'],
      ];
      for (const [name, stakeholderMetric, token] of rows) {
        const coverage = makeValidCoverage();
        coverage.stakeholders = [
          { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
          { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
        ];
        coverage.metrics.stakeholder = stakeholderMetric; // (1 + 0.5) / 2 * 100 = 75，匹配重算
        const result = checkRequirementCoverage(coverage);
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => v.includes('C8') && v.includes(token)),
          `${name} 应报 C8 且点名 ${token}`,
        ).toBe(true);
      }
    });

    it('C10 行（2 态：stakeholder / scenario 声明与重算不一致）应 fail', () => {
      const rows: readonly [string, keyof CoverageShape['metrics'], number, string][] = [
        ['metrics.stakeholder 与重算不一致（全 covered 重算 100，声明 90）', 'stakeholder', 90, 'stakeholder'],
        ['metrics.scenario 与重算不一致（重算 100，声明 80）', 'scenario', 80, 'scenario'],
      ];
      for (const [name, metricKey, value, token] of rows) {
        const coverage = makeValidCoverage();
        // eslint-disable-next-line security/detect-object-injection -- metricKey 为用例内字面量行表枚举的 metrics 闭集键（keyof metrics），非用户输入
        coverage.metrics[metricKey] = value;
        const result = checkRequirementCoverage(coverage);
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => v.includes('C10') && v.includes(token)),
          `${name} 应报 C10 且点名 ${token}`,
        ).toBe(true);
      }
    });
  });

  // ==================== C9: status=missing 声明 ====================
  describe('C9: status=missing 须在 Out of Scope 声明', () => {
    it('C9 三态（无 outOfScope → warning / 未声明 → fail / 已声明 → 无违规）', () => {
      const rows: readonly [string, string[] | undefined, 'warning' | 'fail' | 'clean'][] = [
        ['status=missing 无 outOfScope → warning（不 fail）', undefined, 'warning'],
        ['status=missing 有 outOfScope 但未声明 SH-002 → fail', ['SH-OTHER'], 'fail'],
        ['status=missing 有 outOfScope 且已声明 SH-002 → 无违规', ['SH-002'], 'clean'],
      ];
      for (const [name, outOfScope, kind] of rows) {
        const coverage = makeValidCoverage();
        coverage.stakeholders = [
          { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
          { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'missing' },
        ];
        coverage.metrics.stakeholder = 50; // (1 + 0) / 2 * 100 = 50
        const result = checkRequirementCoverage(coverage, { outOfScope });
        if (kind === 'warning') {
          expect(
            result.warnings.some((w) => w.includes('C9')),
            `${name} 应有 C9 warning`,
          ).toBe(true);
          expect(
            result.violations.some((v) => v.includes('C9')),
            `${name} 不应有 C9 violation`,
          ).toBe(false);
        } else if (kind === 'fail') {
          expect(result.passed, `${name} 应 fail`).toBe(false);
          expect(
            result.violations.some((v) => v.includes('C9') && v.includes('SH-002')),
            `${name} 应报 C9 且点名 SH-002`,
          ).toBe(true);
        } else {
          expect(
            result.violations.some((v) => v.includes('C9')),
            `${name} 不应报 C9`,
          ).toBe(false);
        }
      }
    });

    it('C8/C9: requirementType status=missing 的 missingIds 取 reqIds 具体 ID（NFR-001）非类别名', () => {
      const coverage = makeValidCoverage();
      coverage.requirementTypes = [
        { type: 'REQ', reqIds: ['REQ-001'], status: 'covered' },
        { type: 'NFR', reqIds: ['NFR-001'], status: 'missing' },
        { type: 'CON', reqIds: ['CON-001'], status: 'covered' },
      ];
      coverage.metrics.requirementType = 50; // (1 + 0) / 2 * 100 = 50
      const result = checkRequirementCoverage(coverage, {
        outOfScope: ['SH-OTHER'],
      });
      expect(result.passed).toBe(false);
      const c9Violations = result.violations.filter((v) => v.includes('C9')).join(' ');
      expect(c9Violations).toContain('NFR-001');
    });
  });

  // ==================== 豁免：exemptions 跳过对应规则 ====================
  describe('豁免: exemptions 跳过对应规则', () => {
    it('豁免跳过（2 态：C8 partial / C1 空数组）→ 不报对应规则', () => {
      const rows: readonly [string, (c: CoverageShape) => void, number, string][] = [
        [
          '豁免 C8: partial 项 + metrics<100 被跳过 → 不报 C8',
          (c) => {
            c.stakeholders = [
              { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
              { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
            ];
          },
          75, // recalc=75，匹配重算
          'C8',
        ],
        [
          '豁免 C1: stakeholders 空被跳过 → 不报 C1（空集视作 100% 匹配重算）',
          (c) => {
            c.stakeholders = [];
          },
          100,
          'C1',
        ],
      ];
      for (const [name, mutate, stakeholderMetric, rule] of rows) {
        const coverage = makeValidCoverage();
        mutate(coverage);
        coverage.metrics.stakeholder = stakeholderMetric;
        const result = checkRequirementCoverage(coverage, { exemptions: [rule] });
        expect(
          result.violations.some((v) => v.includes(rule)),
          `${name} 不应报 ${rule}`,
        ).toBe(false);
        expect(result.exemptionsApplied, `${name} 应登记 exemptionsApplied 含 ${rule}`).toContain(rule);
      }
    });
  });

  // ==================== 完整通过 ====================
  describe('完整通过', () => {
    it('4 张矩阵完整 + 100% 覆盖率 → passed=true', () => {
      const coverage = makeValidCoverage();
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
      });
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.metrics).toEqual({ stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 });
    });
  });
});

// ==================== C7 OOS 形状校验（CLI 层 exit 2） ====================
describe('C7: OOS 形状校验 (CLI exit 2)', () => {
  const scriptPath = 'w-model-dev/scripts/cli/check-requirement-coverage.ts';
  let tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  function makeTmpDir(): string {
    const d = mkdtempSync(join(tmpdir(), 'coverage-c7-test-'));
    tmpDirs.push(d);
    return d;
  }

  function writeValidCoverage(dir: string): string {
    const p = join(dir, 'coverage.json');
    writeFileSync(
      p,
      JSON.stringify({
        stakeholders: [{ id: 'SH-001', role: '终端用户', relatedReqs: ['REQ-001'], status: 'covered' }],
        scenarios: [
          {
            id: 'SC-001',
            description: '正常',
            steps: ['x'],
            relatedReqs: ['REQ-001'],
            status: 'covered',
            scenarioType: 'happy',
          },
          {
            id: 'SC-002',
            description: '错误',
            steps: ['x'],
            relatedReqs: ['REQ-001'],
            status: 'covered',
            scenarioType: 'error',
          },
          {
            id: 'SC-003',
            description: '边界',
            steps: ['x'],
            relatedReqs: ['REQ-001'],
            status: 'covered',
            scenarioType: 'boundary',
          },
        ],
        requirementTypes: [
          { type: 'REQ', reqIds: ['REQ-001'], status: 'covered' },
          { type: 'NFR', reqIds: ['NFR-001'], status: 'covered' },
          { type: 'CON', reqIds: ['CON-001'], status: 'covered' },
        ],
        crossCuts: [{ nfrConId: 'NFR-001', governedReqs: ['REQ-001'], status: 'covered' }],
        metrics: { stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 },
      }),
    );
    return p;
  }

  it('C7: OOS 文件形状（3 态：缺 items / 非数组 → exit 2；合法数组 → exit 0）', () => {
    const rows: readonly [string, Record<string, unknown>, number][] = [
      ['OOS 文件无 items 字段', { something: 'else' }, 2],
      ['OOS 文件 items 非数组', { items: 'not-an-array' }, 2],
      ['OOS 文件合法（items 是数组）', { items: ['SH-OTHER'] }, 0],
    ];
    for (const [name, oosContent, expectedStatus] of rows) {
      // 每迭代自备 fixture（临时目录独立，避免一次失败污染后续迭代定位）
      const dir = makeTmpDir();
      const coveragePath = writeValidCoverage(dir);
      const oosPath = join(dir, 'outOfScope.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- oosPath 拼装自本测试 makeTmpDir() 临时目录，oosContent 为行表字面量 fixture，非用户输入
      writeFileSync(oosPath, JSON.stringify(oosContent));

      const r = runSync(process.execPath, [tsxCli, scriptPath, coveragePath, `--out-of-scope=${oosPath}`], {
        timeout: 15_000,
        windowsHide: true,
      });
      if (expectedStatus === 2) {
        if (r.status !== 0) {
          expect(r.status, `${name} 应 exit 2`).toBe(2);
        } else {
          expect.fail(`${name}: should have exited with code 2`);
        }
      } else {
        expect(r.status, `${name} 应 exit 0（不抛异常）`).toBe(expectedStatus);
      }
    }
  }, 60_000);
});

// ==================== 空集维度显式化（vacuously true 不得静默当成真实 100%） ====================
describe('空集维度可见性', () => {
  it('四维均有条目 → vacuousDimensions 为空且无空集警告', () => {
    const r = checkRequirementCoverage(makeValidCoverage(), {
      graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
    });
    expect(r.vacuousDimensions).toEqual([]);
    expect(r.warnings.some((w) => w.includes('空集维度'))).toBe(false);
  });

  it('空集行（2 态：单维空集 / 多维一次报全）→ 记入 vacuousDimensions 并发警告', () => {
    const rows: readonly [string, (c: CoverageShape) => void, string[] | undefined, string[], boolean][] = [
      [
        'crossCuts 为空且 graph 亦无 cross-cuts 边',
        (c) => {
          // 空集重算 100%（既有的 vacuous 语义不改），故 metrics 仍填 100 以隔离 C10
          c.crossCuts = [];
          c.metrics.crossCut = 100;
        },
        undefined,
        ['crossCut'],
        true,
      ],
      [
        '多个空集维度一次报全（stakeholders 空会被 C1 拦下，用豁免放行 C1/C10 以隔离出空集维度集合）',
        (c) => {
          c.crossCuts = [];
          c.stakeholders = [];
        },
        ['C1', 'C10'],
        ['stakeholder', 'crossCut'],
        false,
      ],
    ];
    for (const [name, mutate, exemptions, expectedVacuous, expectWarning] of rows) {
      const coverage = makeValidCoverage();
      mutate(coverage);
      const r = checkRequirementCoverage(coverage, { graphCrossCuts: [], exemptions });
      expect(r.vacuousDimensions, `${name} 应记入 vacuousDimensions`).toEqual(expectedVacuous);
      if (expectWarning) {
        expect(
          r.warnings.some((w) => w.includes('空集维度') && w.includes('vacuously true')),
          `${name} 应发空集维度警告`,
        ).toBe(true);
        // 不改判：空集维度不升级为 violation（非空约束由 C1/C3/C5/C7b 各自处置）
        expect(r.passed, `${name} 空集维度不应升级为 violation`).toBe(true);
      }
    }
  });
});
