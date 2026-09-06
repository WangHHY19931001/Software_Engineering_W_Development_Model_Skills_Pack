/**
 * budget-logic.ts 单元测试 —— R4-A 多角度 R token 预算规则
 *
 * 覆盖：
 *   - R4-A：每轮 persona 数 ≤ maxPersonasPerRound
 *   - R4-A：每个 persona tokens ≤ maxTokensPerPersona
 *   - R4-A：每轮总 tokens ≤ maxTotalTokensPerRound
 *   - 向后兼容：未配置 rootcauseParallelBudget 时不校验
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkBudget, checkRootcauseBudget, type BudgetConfig } from '../logic/budget-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'budget');

async function loadBudgetSample(file: string): Promise<BudgetConfig> {
  const raw = await fs.readFile(path.join(samplesDir, file), 'utf-8');
  return JSON.parse(raw);
}

describe('R4-A 多角度 R token 预算', () => {
  it('总 tokens 超限时失败', async () => {
    const b = await loadBudgetSample('rootcause-over-budget.json');
    const result = checkBudget(b);
    expect(result.passed).toBe(false);
    expect(result.violations.some((r) => /R4-A.*总 tokens.*maxTotalTokensPerRound/.test(r))).toBe(true);
  });

  it('单个 persona tokens 超限时失败', async () => {
    const b = await loadBudgetSample('rootcause-over-budget.json');
    const result = checkBudget(b);
    expect(result.violations.some((r) => /R4-A.*persona.*tokens.*maxTokensPerPersona/.test(r))).toBe(true);
  });

  it('合规的 rootcause 预算通过校验', async () => {
    const b = await loadBudgetSample('rootcause-valid.json');
    const result = checkBudget(b);
    expect(result.passed).toBe(true);
  });

  it('未配置 rootcauseParallelBudget 时向后兼容（不校验）', async () => {
    const b = await loadBudgetSample('valid.json');
    const result = checkRootcauseBudget(b);
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

/**
 * 逐规则单测（F-G2-06，audit-fixes task 5）：
 *   - R1 时效性（正反例 + context 缺失 warning）
 *   - R2/R4 死分支删除后的 schema 前置钉死（schema required/maximum 拦截）
 *   - R3 onExceed（halt 枚举边界正例 + 非法值 schema 拦截）
 *   - R5 killSwitch 触发检测（rework/tla-rework 正反例）
 * fixture 形状照抄 samples/budget/ 既有文件（不新增样本，避免 samples 覆盖矩阵联动）。
 */
describe('checkBudget 逐规则单测', () => {
  it('R1 正例：提供 --project context 且 updatedAt 已刷新 → passed', async () => {
    const b = await loadBudgetSample('valid.json');
    const r = checkBudget(b, { projectUpdatedAt: '2026-07-24T00:00:00Z', budgetCreatedAt: '2026-07-01T00:00:00Z' });
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('R1 反例：updatedAt 停滞（== createdAt）且项目已推进 → 违规', async () => {
    const b = await loadBudgetSample('bad-stale.json');
    const r = checkBudget(b, { projectUpdatedAt: '2026-07-23T18:00:00Z', budgetCreatedAt: '2026-07-01T00:00:00Z' });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('updatedAt == createdAt'))).toBe(true);
  });

  it('R1 context 缺失（未提供 --project）→ 非阻断 warning，不再静默跳过（F-G2-04）', async () => {
    const b = await loadBudgetSample('bad-stale.json');
    const r = checkBudget(b);
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual(['R1 未校验：未提供 --project']);
  });

  it('R2 死分支已删除：缺 perPhase 由 schema required 前置拦截 → [schema]（F-G2-05）', async () => {
    const b = (await loadBudgetSample('valid.json')) as unknown as Record<string, unknown>;
    delete b['perPhase'];
    const r = checkBudget(b);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R4 死分支已删除：budgetBurnRate=1.5 由 schema maximum 前置拦截 → [schema]（F-G2-05）', async () => {
    const b = await loadBudgetSample('bad-killswitch-triggered.json');
    const r = checkBudget(b);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /\[schema\].*budgetBurnRate/.test(v))).toBe(true);
  });

  it('R3 正例：onExceed=halt（合法枚举值）→ passed', async () => {
    const b = await loadBudgetSample('valid.json');
    b.onExceed = 'halt';
    const r = checkBudget(b);
    expect(r.passed).toBe(true);
  });

  it('R3 反例：onExceed 非法值由 schema enum 前置拦截 → [schema]', async () => {
    const b = await loadBudgetSample('valid.json');
    (b as { onExceed: string }).onExceed = 'explode';
    const r = checkBudget(b);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R5 正例：reworkCount 低于阈值 → passed 且无 killSwitch 违规', async () => {
    const b = await loadBudgetSample('valid.json');
    const r = checkBudget(b, { reworkCount: 2, tlaReworkCount: 2 });
    expect(r.passed).toBe(true);
    expect(r.violations.some((v) => v.includes('killSwitch 应触发'))).toBe(false);
  });

  it('R5 反例：reworkCount 达 consecutiveReworks 阈值 → killSwitch 应触发违规', async () => {
    const b = await loadBudgetSample('valid.json');
    const r = checkBudget(b, { reworkCount: 3 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('killSwitch 应触发'))).toBe(true);
  });

  it('R5 反例：tlaReworkCount 达 tlaReworks 阈值 → killSwitch 应触发违规', async () => {
    const b = await loadBudgetSample('valid.json');
    const r = checkBudget(b, { tlaReworkCount: 3 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('TLA+ 返工'))).toBe(true);
  });
});
