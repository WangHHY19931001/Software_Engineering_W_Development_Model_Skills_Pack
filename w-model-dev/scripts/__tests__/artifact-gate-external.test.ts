/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(root, ...) 路径由测试自生成，非用户输入） */
/**
 * artifact-gate-external.test.ts —— artifact gate 外部校验聚合 + externalChecks 死字段清理
 *
 * 覆盖（2026-09-04 audit-gate-closure task 1，Slice A + B 前置）：
 *   E1  aggregateExternalChecks：codegraph + opsx violations 并入 reasons，passed 联动
 *       （codegraph/opsx 失败不得被 RTM 通过掩盖——本层与 RTM 解耦验证）
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
  });
}

function opsxTree(root: string, changeName: string): void {
  mkdirSync(join(root, 'openspec', 'changes', changeName), { recursive: true });
  for (const art of ['proposal.md', 'design.md', 'tasks.md', 'tickets.md']) {
    writeFileSync(join(root, 'openspec', 'changes', changeName, art), `# ${art}\n`);
  }
  mkdirSync(join(root, 'openspec', 'changes', changeName, 'specs'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'changes', changeName, 'specs', 'x.md'), '# x\n');
  mkdirSync(join(root, '.w-model', 'r3-reviews'), { recursive: true });
  mkdirSync(join(root, '.w-model', 'v-reviews'), { recursive: true });
  for (const stage of ['explore', 'propose', 'coding']) {
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
  opsxTree(root, 'phase5-demo');
  return { root };
}

describe('aggregateExternalChecks（artifact gate 外部校验聚合）', () => {
  it('E1: codegraph+opsx 全通过 → aggregate passed，无 reasons', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    expect(r).toMatchObject({ passed: true, reasons: [] });
    expect(r.summary.codegraph.passed).toBe(true);
    expect(r.summary.opsx.passed).toBe(true);
  });

  it('E1b: codegraph 覆盖缺失不被 opsx/RTM 通过掩盖 → aggregate failed + 逐文件 reason', () => {
    const { root } = fullPassProject();
    // 变更里新增 src/forgotten.ts 但无查询覆盖它
    const scope = makeScope({ changedFiles: ['src/main.ts', 'src/forgotten.ts'] });
    const r = aggregateExternalChecks(root, 5, { scope, scopeViolations: [] });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((v) => v.includes('src/forgotten.ts'))).toBe(true);
    expect(r.summary.codegraph.passed).toBe(false);
    expect(r.summary.codegraph.violationCount).toBeGreaterThan(0);
    expect(r.summary.codegraph.requiredFileCount).toBe(2);
    expect(r.summary.codegraph.coveredFileCount).toBe(1);
  });

  it('E1c: opsx 缺 tickets.md 不被 codegraph 通过掩盖 → aggregate failed', () => {
    const root = makeTmpDir();
    mkdirSync(join(root, '.w-model', 'codegraph-queries'), { recursive: true });
    writeFileSync(
      join(root, '.w-model', 'codegraph-queries', 'phase5-a.json'),
      queryJson('phase5-demo', ['src/main.ts']),
    );
    opsxTree(root, 'phase5-demo');
    rmSync(join(root, 'openspec', 'changes', 'phase5-demo', 'tickets.md'), { force: true });
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((v) => v.includes('tickets.md 缺失'))).toBe(true);
    expect(r.summary.opsx.passed).toBe(false);
    expect(r.summary.opsx.violationCount).toBeGreaterThan(0);
  });

  it('E2: scope 为 null → 两 checker fail-closed（须提供变更上下文）且 summary 标记未提供', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: null, scopeViolations: [] });
    expect(r.passed).toBe(false);
    expect(r.summary.codegraph.passed).toBe(false);
    expect(r.summary.opsx.passed).toBe(false);
    // scope 缺失分支：provided=false、changeId=null（不再用空串占位）
    expect(r.summary.codegraph.provided).toBe(false);
    expect(r.summary.opsx.provided).toBe(false);
    expect(r.summary.codegraph.changeId).toBeNull();
    expect(r.summary.opsx.changeId).toBeNull();
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

  it('E3b: scope 已提供但 Git 绑定失败（scopeProvidedButFailed）不得输出"未提供 --scope"误导消息', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, {
      scope: null,
      scopeViolations: ['change-scope: headRef 过期（scope.headRef 不等于当前 HEAD）'],
      scopeProvidedButFailed: true,
    });
    expect(r.passed).toBe(false);
    // 真实原因（scopeViolations）在
    expect(r.reasons.some((v) => v.includes('headRef 过期'))).toBe(true);
    // 不得出现与事实不符的"未提供 --scope"文案（纠正动作应指向更新过期 scope 而非补 scope 文件）
    expect(r.reasons.some((v) => v.includes('未提供 --scope'))).toBe(false);
    // summary 计数归零（未进入 strict 校验）
    expect(r.summary.codegraph.violationCount).toBe(0);
    expect(r.summary.opsx.violationCount).toBe(0);
    // 控制组：未提供 scope 且未给 scopeProvidedButFailed 标志时仍输出"未提供"消息（既有语义）
    const r2 = aggregateExternalChecks(root, 5, { scope: null, scopeViolations: [] });
    expect(r2.reasons.some((v) => v.includes('未提供 --scope'))).toBe(true);
  });

  it('E3c: scope 已提供但 Git 绑定失败 → summary 标记 provided=true + 尝试绑定的 changeId（D1 语义）', () => {
    const { root } = fullPassProject();
    const attemptedChangeId = 'phase5-reviewfix';
    const r = aggregateExternalChecks(root, 5, {
      scope: null,
      scopeViolations: ['change-scope: headRef 过期（scope.headRef 不等于当前 HEAD）'],
      scopeProvidedButFailed: true,
      attemptedChangeId,
    });
    expect(r.passed).toBe(false);
    // 真实原因（scopeViolations）以 [scope] 前缀进 reasons
    expect(r.reasons.some((v) => v.startsWith('[scope]') && v.includes('headRef 过期'))).toBe(true);
    // 不得出现与事实不符的"未提供 --scope"误导文案（纠正动作应指向更新过期 scope）
    expect(r.reasons.some((v) => v.includes('未提供 --scope'))).toBe(false);
    // D1 语义：provided=true 含「提供后被 Git 绑定拒绝」；changeId 为尝试绑定的 change
    expect(r.summary.codegraph.provided).toBe(true);
    expect(r.summary.codegraph.changeId).toBe(attemptedChangeId);
    expect(r.summary.codegraph.passed).toBe(false);
    expect(r.summary.opsx.provided).toBe(true);
    expect(r.summary.opsx.changeId).toBe(attemptedChangeId);
    expect(r.summary.opsx.passed).toBe(false);
    // violationCount 保持既有 [scope] 语义：计数归零（未进入 strict 校验）
    expect(r.summary.codegraph.violationCount).toBe(0);
    expect(r.summary.opsx.violationCount).toBe(0);
  });

  it('E4: summary 携带 changeId 与相对路径计数', () => {
    const { root } = fullPassProject();
    const r = aggregateExternalChecks(root, 5, { scope: makeScope(), scopeViolations: [] });
    expect(r.summary.codegraph.changeId).toBe('phase5-demo');
    expect(r.summary.opsx.changeId).toBe('phase5-demo');
    // scope 已提供分支：provided=true
    expect(r.summary.codegraph.provided).toBe(true);
    expect(r.summary.opsx.provided).toBe(true);
    expect(typeof r.summary.codegraph.coveredFileCount).toBe('number');
  });

  it('E5/E6: gate-logic externalChecks 死字段清理 + 其余行为不变', () => {
    // 合法 RTM（phase=5 只要求 unitTest 层）
    const matrix: RTMMatrixShape = {
      rows: [
        {
          requirementId: 'REQ-001',
          description: '用户注册',
          designDoc: 'SD-001',
          codeModule: 'SD-001:src/user.ts',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
          coverageStatus: '100%',
        },
      ],
      executionSummary: {
        unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 100 },
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
          codeModule: 'SD-001:src/user.ts',
          unitTest: 'UT-001',
          integrationTest: '',
          systemTest: '',
          acceptanceTest: 'UAT-001',
          coverageStatus: '100%',
        },
      ],
      executionSummary: {
        unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 100 },
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
