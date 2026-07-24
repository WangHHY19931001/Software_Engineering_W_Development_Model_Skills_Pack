/**
 * budget-logic.ts 单元测试 —— R4-A 多角度 R token 预算规则
 *
 * 覆盖：
 *   - R4-A：每轮 persona 数 ≤ maxPersonasPerRound
 *   - R4-A：每个 persona tokens ≤ maxTokensPerPersona
 *   - R4-A：每轮总 tokens ≤ maxTotalTokensPerRound
 *   - 向后兼容：未配置 rootcauseParallelBudget 时不校验
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBudget, checkRootcauseBudget, type BudgetConfig } from '../budget-logic.js';

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
    expect(result.violations.some(r => /R4-A.*总 tokens.*maxTotalTokensPerRound/.test(r))).toBe(true);
  });

  it('单个 persona tokens 超限时失败', async () => {
    const b = await loadBudgetSample('rootcause-over-budget.json');
    const result = checkBudget(b);
    expect(result.violations.some(r => /R4-A.*persona.*tokens.*maxTokensPerPersona/.test(r))).toBe(true);
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
