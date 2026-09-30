/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(root, ...) 路径由测试自生成，非用户输入） */
/**
 * artifact-gate-external.test.ts —— artifact gate 外部校验聚合 + externalChecks 死字段清理
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A + B 前置；2026-09-21 superpowers
 * 替换 opsx 批次 1：阶段 5-8 外部聚合第二 checker 由 checkOpsxArtifactsStrict 切至
 * checkCodingPlan——键 external.opsx → external.codingPlan、violations 前缀 [opsx] →
 * [coding-plan]，changesNames 语义保持 [scope.changeId]）：
 *   E1  aggregateExternalChecks：codegraph + coding-plan violations 并入 reasons，passed 联动
 *       （codegraph/coding-plan 失败不得被 RTM 通过掩盖——本层与 RTM 解耦验证）
 *   E2  scope 为 null（未提供）→ 两 checker 各产生变更上下文 violation（fail-closed）
 *   E3  scopeViolations（Git 绑定失败等）并入 reasons
 *   E4  summary 携带两 checker passed/violations 计数与相对路径计数
 *   E5  gate-logic externalChecks 三字段/类型删除：checkArtifactGate 结果不再含
 *       codegraphQueriesValid/opsxArtifactsValid/openspecArchived 死字段
 *   E6  checkArtifactGate 纯逻辑其余行为不变（合法 RTM 仍 passed=true）
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { aggregateExternalChecks } from '../cli/check-artifact-gate.js';
import type { ChangeScope } from '../lib/change-scope.js';
import { checkArtifactGate, type RTMMatrixShape } from '../logic/gate-logic.js';

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-ext-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响断言
    }
  }
});

function makeScope(overrides: Partial<ChangeScope> = {}): ChangeScope {
  return {
    changeId: 'phase5-demo',
    phase: 5,
    baseRef: 'base',
    headRef: 'head',
    scopeCreatedAt: '2026-09-04T00:00:00Z',
    changedFiles: ['src/main.ts'],
    ...overrides,
  };
}

function queryJson(changeId: string, targetFiles: string[]): string {
  return JSON.stringify({
    querySymbol: 'Sym',
    callers: ['A'],
    callees: ['B'],
    blastRadius: 1,
    queryTimestamp: '2026-09-03T00:00:00Z',
    changeId,
    targetFiles,
    // D-6（2026-09-25）：临时项目树无 .codegraph/ 索引 → 须显式降级声明，否则记录不合法
    evidenceKind: 'artifact',
    degradationReason: '临时项目树无 .codegraph/ 索引（codegraph CLI 未初始化），以制品级查询记录替代',
    alternativeEvidence: [{ command: 'codegraph query Sym', evidencePath: '.w-model/codegraph-queries/probe.log' }],
  });
}

/**
 * 构造通过 coding-plan 门的制品树（契约对齐 samples/coding-plan/valid-phase5）：
 * R1 plan（目标节 + 任务节 + 逐任务验证命令行）/ R3 账本 + complete 覆盖 /
 * R4 三件套非空 + review diff / R5 审查产物（stage 词表 plan/execute/finalize）。
 */
function codingPlanTree(root: string, changeId: string): void {
  const plansDir = join(root, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  writeFileSync(
    join(plansDir, `${changeId}.plan.md`),
    [
      `# ${changeId} 编码计划`,
      '',
      '## 目标',
      '',
      '测试夹具：目标节 + 两个任务节 + 逐任务验证命令行。',
      '',
      '## Task 1: 实现示例模块',
      '',
      '验证：npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts',
      '',
      '## Task 2: 接线 CLI 壳',
      '',
      'Verify: npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/artifact-gate-external.test.ts',
      '',
    ].join('\n'),
  );
  const ledgerDir = join(root, '.superpowers', 'sdd', `${changeId}.plan`);
  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(
    join(ledgerDir, 'progress.md'),
    [`# SDD ledger — plan: docs/plans/${changeId}.plan.md`, '', 'Task 1: complete', 'Task 2: complete', ''].join('\n'),
  );
  for (const n of [1, 2]) {
    writeFileSync(join(ledgerDir, `task-${n}-brief.md`), `# task ${n} brief\n`);
    writeFileSync(join(ledgerDir, `task-${n}-report.md`), `# task ${n} report\n`);
  }
  writeFileSync(join(ledgerDir, 'review-abc1234.diff'), 'diff --git a/src/main.ts b/src/main.ts\n');
  mkdirSync(join(root, '.w-model', 'r3-reviews'), { recursive: true });
  mkdirSync(join(root, '.w-model', 'v-reviews'), { recursive: true });
  for (const stage of ['plan', 'execute', 'finalize']) {
    for (const dim of ['completeness', 'reliability', 'security']) {
      writeFileSync(join(root, '.w-model', 'r3-reviews', `phase5-${stage}-${dim}.md`), `# r3\n`);
    }
    writeFileSync(join(root, '.w-model', 'v-reviews', `phase5-${stage}.md`), `# v\n`);
  }
}

function fullPassProject(): { root: string } {
  const root = makeTmpDir();
  mkdirSync(join(root, '.w-model', 'codegraph-queries'), { recursive: true });
  writeFileSync(
    join(root, '.w-model', 'codegraph-queries', 'phase5-a.json'),
    queryJson('phase5-demo', ['src/main.ts']),
  );
  codingPlanTree(root, 'phase5-demo');
  return { root };
}

describe('aggregateExternalChecks（artifact gate 外部校验聚合）', () => {
  it('E1: codegraph+coding-plan 全通过 → aggregate passed，无 reasons', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    expect(r).toMatchObject({ passed: true, reasons: [] });
    expect(r.summary.codegraph.passed).toBe(true);
    expect(r.summary.codingPlan.passed).toBe(true);
  });

  it('E1b/E1c 掩盖负例对（2 态：codegraph 覆盖缺失 / coding-plan 缺账本）不得被另一 checker 或 RTM 通过掩盖 → aggregate failed', () => {
    const rows: Array<{
      name: string;
      prepare: () => { root: string };
      options: Parameters<typeof aggregateExternalChecks>[2];
      check: (r: ReturnType<typeof aggregateExternalChecks>) => void;
    }> = [
      {
        name: 'E1b：codegraph 覆盖缺失不被 coding-plan/RTM 通过掩盖',
        prepare: () => fullPassProject(),
        options: { scope: makeScope({ changedFiles: ['src/main.ts', 'src/forgotten.ts'] }), scopeViolations: [] },
        check: (r) => {
          expect(r.passed, 'E1b aggregate 应 failed').toBe(false);
          expect(
            r.reasons.some((v) => v.includes('src/forgotten.ts')),
            'E1b 逐文件 reason 具名',
          ).toBe(true);
          expect(r.summary.codegraph.passed, 'E1b codegraph 应 failed').toBe(false);
          expect(r.summary.codegraph.violationCount, 'E1b codegraph 违规计数 > 0').toBeGreaterThan(0);
          expect(r.summary.codegraph.requiredFileCount, 'E1b 须覆盖 2 文件').toBe(2);
          expect(r.summary.codegraph.coveredFileCount, 'E1b 实覆盖 1 文件').toBe(1);
        },
      },
      {
        name: 'E1c：coding-plan 缺账本不被 codegraph 通过掩盖',
        prepare: () => {
          const root = makeTmpDir();
          mkdirSync(join(root, '.w-model', 'codegraph-queries'), { recursive: true });
          writeFileSync(
            join(root, '.w-model', 'codegraph-queries', 'phase5-a.json'),
            queryJson('phase5-demo', ['src/main.ts']),
          );
          codingPlanTree(root, 'phase5-demo');
          rmSync(join(root, '.superpowers', 'sdd', 'phase5-demo.plan', 'progress.md'), { force: true });
          return { root };
        },
        options: { scope: makeScope(), scopeViolations: [] },
        check: (r) => {
          expect(r.passed, 'E1c aggregate 应 failed').toBe(false);
          expect(
            r.reasons.some((v) => v.includes('progress.md 缺失')),
            'E1c 账本缺失 reason 具名',
          ).toBe(true);
          expect(r.summary.codingPlan.passed, 'E1c coding-plan 应 failed').toBe(false);
          expect(r.summary.codingPlan.violationCount, 'E1c coding-plan 违规计数 > 0').toBeGreaterThan(0);
        },
      },
    ];
    for (const row of rows) {
      const { root } = row.prepare();
      const r = aggregateExternalChecks(root, 5, row.options);
      row.check(r);
    }
  });

  it('E2: scope 为 null → 两 checker fail-closed（须提供变更上下文）且 summary 标记未提供', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: null, scopeViolations: [] });
    expect(r.passed).toBe(false);
    expect(r.summary.codegraph.passed).toBe(false);
    expect(r.summary.codingPlan.passed).toBe(false);
    // scope 缺失分支：provided=false、changeId=null（不再用空串占位）
    expect(r.summary.codegraph.provided).toBe(false);
    expect(r.summary.codingPlan.provided).toBe(false);
    expect(r.summary.codegraph.changeId).toBeNull();
    expect(r.summary.codingPlan.changeId).toBeNull();
    // coding-plan 维度违规前缀与 fail-closed 文案（反模式 #39/#40 保留）
    expect(r.reasons.some((v) => v.startsWith('[coding-plan]') && v.includes('未提供 --scope'))).toBe(true);
    expect(r.reasons.some((v) => v.includes('反模式 #39/#40'))).toBe(true);
    expect(r.reasons.some((v) => /--scope|ChangeScope/.test(v))).toBe(true);
  });

  it('E3: scopeViolations（如 Git 绑定失败）并入 reasons', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, {
      scope: makeScope(),
      scopeViolations: ['change-scope: headRef 过期（scope 与当前 HEAD 不符）'],
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((v) => v.includes('headRef 过期'))).toBe(true);
  });

  it('E3b/E3c Git 绑定失败对（2 态：scopeProvidedButFailed 不得误导「未提供 --scope」/ D1 语义 provided=true + attemptedChangeId）', () => {
    // 公共负例输入：scope 已提供但 Git 绑定失败（headRef 过期）
    const failedBinding: {
      scope: null;
      scopeViolations: string[];
      scopeProvidedButFailed: true;
    } = {
      scope: null,
      scopeViolations: ['change-scope: headRef 过期（scope.headRef 不等于当前 HEAD）'],
      scopeProvidedButFailed: true,
    };
    const rows: Array<{ name: string; check: () => void }> = [
      {
        name: 'E3b：不得输出「未提供 --scope」误导消息',
        check: () => {
          const { root } = fullPassProject();
          const r = aggregateExternalChecks(root, 5, { ...failedBinding });
          expect(r.passed, 'E3b aggregate 应 failed').toBe(false);
          // 真实原因（scopeViolations）在
          expect(
            r.reasons.some((v) => v.includes('headRef 过期')),
            'E3b 真实原因在 reasons',
          ).toBe(true);
          // 不得出现与事实不符的"未提供 --scope"文案（纠正动作应指向更新过期 scope 而非补 scope 文件）
          expect(
            r.reasons.some((v) => v.includes('未提供 --scope')),
            'E3b 不得出现误导「未提供 --scope」文案',
          ).toBe(false);
          // summary 计数归零（未进入 strict 校验）
          expect(r.summary.codegraph.violationCount, 'E3b codegraph violationCount 归零').toBe(0);
          expect(r.summary.codingPlan.violationCount, 'E3b codingPlan violationCount 归零').toBe(0);
          // 控制组：未提供 scope 且未给 scopeProvidedButFailed 标志时仍输出"未提供"消息（既有语义）
          const r2 = aggregateExternalChecks(root, 5, { scope: null, scopeViolations: [] });
          expect(
            r2.reasons.some((v) => v.includes('未提供 --scope')),
            'E3b 控制组保留「未提供」消息',
          ).toBe(true);
        },
      },
      {
        name: 'E3c：summary 标记 provided=true + 尝试绑定的 changeId（D1 语义）',
        check: () => {
          const { root } = fullPassProject();
          const attemptedChangeId = 'phase5-reviewfix';
          const r = aggregateExternalChecks(root, 5, { ...failedBinding, attemptedChangeId });
          expect(r.passed, 'E3c aggregate 应 failed').toBe(false);
          // 真实原因（scopeViolations）以 [scope] 前缀进 reasons
          expect(
            r.reasons.some((v) => v.startsWith('[scope]') && v.includes('headRef 过期')),
            'E3c 真实原因以 [scope] 前缀进 reasons',
          ).toBe(true);
          // 不得出现与事实不符的"未提供 --scope"误导文案（纠正动作应指向更新过期 scope）
          expect(
            r.reasons.some((v) => v.includes('未提供 --scope')),
            'E3c 不得出现误导文案',
          ).toBe(false);
          // D1 语义：provided=true 含「提供后被 Git 绑定拒绝」；changeId 为尝试绑定的 change
          expect(r.summary.codegraph.provided, 'E3c codegraph provided=true').toBe(true);
          expect(r.summary.codegraph.changeId, 'E3c codegraph changeId=attemptedChangeId').toBe(attemptedChangeId);
          expect(r.summary.codegraph.passed, 'E3c codegraph passed=false').toBe(false);
          expect(r.summary.codingPlan.provided, 'E3c codingPlan provided=true').toBe(true);
          expect(r.summary.codingPlan.changeId, 'E3c codingPlan changeId=attemptedChangeId').toBe(attemptedChangeId);
          expect(r.summary.codingPlan.passed, 'E3c codingPlan passed=false').toBe(false);
          // violationCount 保持既有 [scope] 语义：计数归零（未进入 strict 校验）
          expect(r.summary.codegraph.violationCount, 'E3c codegraph violationCount 归零').toBe(0);
          expect(r.summary.codingPlan.violationCount, 'E3c codingPlan violationCount 归零').toBe(0);
        },
      },
    ];
    for (const row of rows) row.check();
  });

  it('E4: summary 携带 changeId 与相对路径计数', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    expect(r.summary.codegraph.changeId).toBe('phase5-demo');
    expect(r.summary.codingPlan.changeId).toBe('phase5-demo');
    // scope 已提供分支：provided=true
    expect(r.summary.codegraph.provided).toBe(true);
    expect(r.summary.codingPlan.provided).toBe(true);
    // 断言可证伪的关系而非类型：本 fixture 下须覆盖全集（2026-09-17 审查修复）。
    expect(r.summary.codegraph.requiredFileCount).toBeGreaterThan(0);
    expect(r.summary.codegraph.coveredFileCount).toBe(r.summary.codegraph.requiredFileCount);
  });

  it('E4b: external.codingPlan 键存在（external.opsx 键删除）且 changesNames 恒为 [scope.changeId]', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    // 新键存在 + 旧键删除（键名是消费方契约，防拼写漂移）
    expect(Object.prototype.hasOwnProperty.call(r.summary, 'codingPlan')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(r.summary, 'opsx')).toBe(false);
    // strict 绑定语义：changesNames 恒为 scope.changeId（人类可读行「制品目录」与 GATE_JSON 消费该字段）
    expect(r.summary.codingPlan.changesNames).toEqual(['phase5-demo']);
    // 控制组：scope 缺失分支 changesNames 归空数组（不占位）
    const r2 = aggregateExternalChecks(root, 5, { scope: null, scopeViolations: [] });
    expect(r2.summary.codingPlan.changesNames).toEqual([]);
  });

  it('E5/E6: gate-logic externalChecks 死字段清理 + 其余行为不变', () => {
    // 合法 RTM（phase=5 只要求 unitTest 层）
    const matrix: RTMMatrixShape = {
      rows: [
        {
          requirementId: 'REQ-001',
          description: '用户注册',
          designDoc: 'SD-001',
          codeModule: 'SD-001:src/user.ts:L1',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
          coverageStatus: '100%',
        },
      ],
      executionSummary: {
        // M07 E4：phase 5 阶段内 unitTest total>0 须携带合法 evidence（fixture 无 lastUpdated
        // → 保守按 cutoff 后处理，不吸收；补 evidence 而非改时间戳）
        unitTest: {
          total: 1,
          passed: 1,
          failed: 0,
          pending: 0,
          coverage: 100,
          evidence: { command: 'npx vitest run', exitCode: 0, observedAt: '2026-09-15T10:00:00.000Z' },
        },
        integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      },
    };
    const result = checkArtifactGate(matrix, { phaseOption: 5 });
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
    for (const dead of ['codegraphQueriesValid', 'opsxArtifactsValid', 'openspecArchived']) {
      expect(Object.prototype.hasOwnProperty.call(result, dead), dead).toBe(false);
    }
  });

  it('E5b: 传入历史 externalChecks 形状也不会被读取（类型已删除，运行时同忽略）', () => {
    const matrix: RTMMatrixShape = {
      rows: [
        {
          requirementId: 'REQ-001',
          description: '用户注册',
          designDoc: 'SD-001',
          codeModule: 'SD-001:src/user.ts:L1',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
          coverageStatus: '100%',
        },
      ],
      executionSummary: {
        // M07 E4：phase 5 阶段内 unitTest total>0 须携带合法 evidence（fixture 无 lastUpdated
        // → 保守按 cutoff 后处理，不吸收；补 evidence 而非改时间戳）
        unitTest: {
          total: 1,
          passed: 1,
          failed: 0,
          pending: 0,
          coverage: 100,
          evidence: { command: 'npx vitest run', exitCode: 0, observedAt: '2026-09-15T10:00:00.000Z' },
        },
        integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      },
    };
    const options = {
      phaseOption: 5 as const,
      externalChecks: { codegraphQueriesValid: true, opsxArtifactsValid: true, openspecArchived: true },
    } as unknown as Parameters<typeof checkArtifactGate>[1];
    const result = checkArtifactGate(matrix, options);
    expect(result.passed).toBe(true);
    for (const dead of ['codegraphQueriesValid', 'opsxArtifactsValid', 'openspecArchived']) {
      expect(Object.prototype.hasOwnProperty.call(result, dead), dead).toBe(false);
    }
  });
});
