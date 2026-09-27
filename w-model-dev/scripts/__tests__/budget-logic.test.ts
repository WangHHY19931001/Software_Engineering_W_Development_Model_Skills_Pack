/**
 * budget-logic.ts 单元测试 —— R4-A 多角度 R token 预算规则 + R6 用量实效
 *
 * 覆盖：
 *   - R4-A：每轮 persona 数 ≤ maxPersonasPerRound
 *   - R4-A：每个 persona tokens ≤ maxTokensPerPersona
 *   - R4-A：每轮总 tokens ≤ maxTotalTokensPerRound
 *   - 向后兼容：未配置 rootcauseParallelBudget 时不校验
 *   - R6/R5-b（D-4b）：Σtokens(阶段/总量) 超上限 → blocking；≥ burnRate × maxTokens → killSwitch 告警
 *   - sumTokens：run-log token 累计口径（有限非负数才计入）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { countReworks, countSuspectedDuplicateGroups, sumTokens } from '../cli/check-budget.js';
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
    // R1 的降级说明必须可见（F-G2-04）；该样本未配置 rootcauseParallelBudget，
    // 故 R4-A 的「未校验」说明同样必须可见（2026-09-17 审查修复：checkBudget 原先只透传
    // 子结果的 violations，把 warnings 静默丢弃）。
    expect(r.warnings).toContain('R1 未校验：未提供 --project');
    expect(r.warnings).toContain('R4-A 未校验：未配置 rootcauseParallelBudget（跳过不等于通过）');
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

/**
 * countReworks（CLI 侧 run-log 返工统计口径，D-4a）
 *
 * 背景：真实 8 阶段调测的 run-log 中 action='rework' 一条都没有——返工以
 * fix/emergency-fix 与 outcome='fail'/'rework' 落盘，旧口径（只认 action==='rework'）
 * 使 reworkCount 恒为 0，R5 连续返工护栏（killSwitch）一次都没触发（护栏失灵）。
 */
describe('countReworks 返工计数口径（D-4a）', () => {
  it('返工计数按真实事件（fix/outcome=fail|rework），不再只认 action=rework（D-4a）', () => {
    const entries = [
      { runId: 'a', phase: 3, action: 'fix', role: 'S', outcome: 'success' },
      { runId: 'b', phase: 3, action: 'gate', role: 'G', outcome: 'fail' },
      { runId: 'c', phase: 3, action: 'checkpoint', role: 'O', outcome: 'rework' },
      { runId: 'd', phase: 4, action: 'fix', role: 'S', outcome: 'success' },
    ];
    const s = countReworks(entries, 3);
    expect(s.reworkCount).toBe(3); // a+b+c（phase=3）
  });

  it('legacy action=rework 与 emergency-fix 均计入，且同一记录不重复计数', () => {
    const entries = [
      // 兼容项：旧记录的 action='rework' 仍计入（即使 outcome 也命中，只计一次）
      { runId: 'a', phase: 5, action: 'rework', role: 'S', outcome: 'fail' },
      { runId: 'b', phase: 5, action: 'emergency-fix', role: 'S', outcome: 'success' },
      { runId: 'c', phase: 5, action: 'gate', role: 'G', outcome: 'success' },
      { runId: 'd', phase: 5, action: 'review', role: 'V', outcome: 'success' },
    ];
    const s = countReworks(entries, 5);
    expect(s.reworkCount).toBe(2); // a+b；c/d 无返工语义
  });

  it('tlaReworkCount 只在计入返工的记录里按 note/target 的 TLA 判据统计', () => {
    const entries = [
      { runId: 'a', phase: 6, action: 'fix', role: 'S', outcome: 'success', note: 'TLA+ 不变式回归' },
      { runId: 'b', phase: 6, action: 'gate', role: 'G', outcome: 'fail', target: 'tla-manifest.json' },
      // 非返工记录即使提及 TLA 也不计入（未扩大 tla 判据）
      { runId: 'c', phase: 6, action: 'gate', role: 'G', outcome: 'success', note: 'TLA+ 门禁通过' },
      { runId: 'd', phase: 6, action: 'fix', role: 'S', outcome: 'success' },
    ];
    const s = countReworks(entries, 6);
    expect(s.reworkCount).toBe(3); // a+b+d
    expect(s.tlaReworkCount).toBe(2); // a+b
  });

  it('phase=undefined 时不过滤，统计全部记录（过滤语义不变）', () => {
    const entries = [
      { runId: 'a', phase: 1, action: 'fix', role: 'S', outcome: 'success' },
      { runId: 'b', phase: 2, action: 'gate', role: 'G', outcome: 'fail' },
    ];
    expect(countReworks(entries, undefined).reworkCount).toBe(2);
  });
});

/**
 * R6 用量实效 + R5-b burnRate 预警（D-4b）
 *
 * 背景：预算门禁原先只校验「配置合法性」（时效 / schema / onExceed / killSwitch 合法），
 * 没有任何「实际用量 vs 上限」判定——真实 8 阶段调测消耗 580M subagent tokens，
 * `perPhase.maxTokens` / `project.maxTokensTotal` 形同虚设，门禁全程未红。
 * 本组用例钉死用量实效判定，同时钉死「未提供 tokensUsed 时行为一字不变」（向后兼容硬线）。
 */
describe('R6 用量实效 + R5-b burnRate 预警（D-4b）', () => {
  const T = '2026-09-20T00:00:00Z';

  /** 极小上限预算：用两位数 tokens 即可触发超限，避免大数字噪声 */
  function tinyBudget(): BudgetConfig {
    return {
      schemaVersion: '1.0',
      projectId: 'x',
      createdAt: T,
      updatedAt: T,
      perPhase: { maxTokens: 100, maxSubagentSpawns: 10, maxReworkRounds: 3 },
      project: { maxTokensTotal: 1000, maxTokensPerSession: 1000 },
      onExceed: 'pause',
      killSwitch: { consecutiveReworks: 3, budgetBurnRate: 0.9, tlaReworks: 3 },
    };
  }

  it('R6：阶段 tokens 超 perPhase.maxTokens → blocking', () => {
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: 150, total: 150 } });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /R6.*阶段 tokens 150.*maxTokens 100/.test(v))).toBe(true);
  });

  it('R6：总 tokens 超 project.maxTokensTotal → blocking', () => {
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: 0, total: 1200 } });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => /R6.*总 tokens 1200.*maxTokensTotal 1000/.test(v))).toBe(true);
  });

  it('R5-b：阶段消耗 ≥ budgetBurnRate × maxTokens → killSwitch 告警（文案前缀 R5-b：，不与既有 R5 文案混同）', () => {
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: 95, total: 95 } });
    expect(r.passed).toBe(false);
    expect(
      r.violations.some((v) => /^R5-b：killSwitch 应触发（阶段消耗占比 0\.95 >= budgetBurnRate 0\.9）$/.test(v)),
    ).toBe(true);
  });

  it('R6 边界：阶段 tokens 恰等于 maxTokens 不报 R6（严格 >），但仍达 burnRate 阈值 → 告警', () => {
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: 100, total: 100 } });
    expect(r.violations.some((v) => /R6/.test(v))).toBe(false);
    expect(r.violations.some((v) => /^R5-b：killSwitch 应触发（阶段消耗占比/.test(v))).toBe(true);
  });

  it('R5 既有文案逐字不变（D-4b 只新增 R5-b/R6，不改 R5 返工/TLA 触发文案）', () => {
    const r = checkBudget(tinyBudget(), { reworkCount: 3, tlaReworkCount: 3 });
    expect(r.violations).toContain('killSwitch 应触发（返工 3 >= 3）但未告警');
    expect(r.violations).toContain('killSwitch 应触发（TLA+ 返工 3 >= 3）但未告警');
  });

  it('R5（返工）与 R5-b（用量）并存时各自可归属，新增文案不遮蔽既有文案', () => {
    const r = checkBudget(tinyBudget(), { reworkCount: 3, tokensUsed: { phase: 95, total: 95 } });
    expect(r.violations).toContain('killSwitch 应触发（返工 3 >= 3）但未告警');
    expect(r.violations.filter((v) => v.startsWith('R5-b：'))).toHaveLength(1);
  });

  it('未提供 tokensUsed → 不触发 R6/R5-b（向后兼容：行为一字不变）', () => {
    const r = checkBudget(tinyBudget());
    expect(r.passed).toBe(true);
    expect(r.violations.filter((v) => /R6|阶段消耗占比/.test(v))).toHaveLength(0);
  });

  it('R6：perPhase.maxTokens=0 → 仍触发但文案省略百分比段（不含 NaN/Infinity，除零守卫，2026-09-22 打磨）', () => {
    const b = tinyBudget();
    b.perPhase.maxTokens = 0;
    const r = checkBudget(b, { tokensUsed: { phase: 5, total: 5 } });
    const r6 = r.violations.filter((v) => v.startsWith('R6'));
    expect(r6.some((v) => v.includes('阶段 tokens 5 > perPhase.maxTokens 0'))).toBe(true);
    expect(r6.some((v) => /NaN|Infinity/.test(v))).toBe(false);
    expect(r6.some((v) => v.includes('%'))).toBe(false);
  });

  it('R5-b：perPhase.maxTokens=0（阈值退化为恒真）→ R5-b 不触发且输出无 Infinity/NaN（正数守卫，控制者裁定补修）', () => {
    const b = tinyBudget();
    b.perPhase.maxTokens = 0;
    const r = checkBudget(b, { tokensUsed: { phase: 5, total: 5 } });
    expect(r.violations.some((v) => v.startsWith('R5-b'))).toBe(false);
    expect(r.violations.some((v) => /Infinity|NaN/.test(v))).toBe(false);
  });

  it('R6/R5-b：tokensUsed 为 NaN（phase/total 均 NaN）→ 视同未提供：不触发且不抛错（非法输入防御，2026-09-22 打磨）', () => {
    expect(() => checkBudget(tinyBudget(), { tokensUsed: { phase: Number.NaN, total: Number.NaN } })).not.toThrow();
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: Number.NaN, total: Number.NaN } });
    expect(r.passed).toBe(true);
    expect(r.violations.filter((v) => /^R6|^R5-b/.test(v))).toHaveLength(0);
    // 与「未提供 tokensUsed」逐字段对齐（跳过路径等价：不产生额外 violation，也不新增 warning）
    expect(r).toEqual(checkBudget(tinyBudget()));
  });

  it('R6 边界：total 恰等于 maxTokensTotal → R6 不触发（严格 >，2026-09-22 打磨钉死）', () => {
    const r = checkBudget(tinyBudget(), { tokensUsed: { phase: 0, total: 1000 } });
    expect(r.violations.some((v) => /R6/.test(v))).toBe(false);
    expect(r.violations.some((v) => /^R5-b/.test(v))).toBe(false);
  });

  it('R5-b：killSwitch.budgetBurnRate 缺失 → R5-b 不触发（typeof 守卫，不因字段缺失误报，2026-09-22 打磨钉死）', () => {
    const b = tinyBudget();
    delete (b.killSwitch as Partial<BudgetConfig['killSwitch']>).budgetBurnRate;
    const r = checkBudget(b, { tokensUsed: { phase: 95, total: 95 } });
    expect(r.violations.some((v) => v.startsWith('R5-b'))).toBe(false);
    expect(r.violations.some((v) => /R6/.test(v))).toBe(false);
  });
});

/**
 * sumTokens（CLI 侧 run-log token 累计口径，D-4b）
 *
 * 口径：仅 `typeof tokens === 'number' && Number.isFinite(tokens) && tokens >= 0` 的记录计入——
 * 坏值（NaN / Infinity / 负数 / 字符串 / 缺字段）若不剔除，会使 Σtokens 变 NaN，
 * 而 `NaN > maxTokens` 恒为 false ⇒ R6 静默永不触发（与 D-4a 的「护栏失灵」同型）。
 */
describe('sumTokens token 累计口径（D-4b）', () => {
  it('按阶段累计；total 为全量之和（不受 phase 过滤）', () => {
    const entries = [
      { runId: 'a', phase: 3, tokens: 100 },
      { runId: 'b', phase: 3, tokens: 50.5 },
      { runId: 'c', phase: 4, tokens: 200 },
    ];
    expect(sumTokens(entries, 3)).toEqual({ phase: 150.5, total: 350.5 });
  });

  it('坏值不计入（NaN / Infinity / 负数 / 非数字 / 缺字段），避免 NaN 传播使判定恒假', () => {
    const entries = [
      { runId: 'a', phase: 1, tokens: 10 },
      { runId: 'b', phase: 1, tokens: -5 },
      { runId: 'c', phase: 1, tokens: Number.POSITIVE_INFINITY },
      { runId: 'd', phase: 1, tokens: Number.NaN },
      { runId: 'e', phase: 1, tokens: '30' },
      { runId: 'f', phase: 1 },
      { runId: 'g', phase: 2, tokens: 7 },
    ];
    expect(sumTokens(entries, 1)).toEqual({ phase: 10, total: 17 });
  });

  it('phase=undefined 时不过滤，phase 与 total 口径一致', () => {
    const entries = [
      { runId: 'a', phase: 1, tokens: 1 },
      { runId: 'b', phase: 2, tokens: 2 },
    ];
    expect(sumTokens(entries, undefined)).toEqual({ phase: 3, total: 3 });
  });
});

/**
 * countSuspectedDuplicateGroups（N-6 上界口径诊断，G2-2 直测）
 *
 * 现状语义（`cli/check-budget.ts:193-207`）：分组键 = `timestamp|tokens|String(duration_s)`，
 * 计入判据仅「非空字符串 timestamp + 有限非负 tokens」；`tokens: 0` 与 `duration_s` 缺字段
 * **当前同样入组**（噪声键，非零 tokens 的正常重复归账之外还会把这些误并为疑似组）。
 * 键守卫（tokens 须有限正数 + duration_s 须为 number）与 `parentDispatchId` 精确化归任务 8/G3-7——
 * 故下方两条「噪声键入组」断言按**现状口径**锁定，任务 8 实施守卫后**须同步翻转为 0**
 * （已在测试名与注释中标注翻转点，避免静默漂移）。
 */
describe('countSuspectedDuplicateGroups 疑似重复归账分组口径（N-6，G2-2）', () => {
  const dup = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    runId: 'r',
    timestamp: '2026-09-20T00:00:00.000Z',
    tokens: 100,
    duration_s: 5,
    ...patch,
  });

  it('同 (timestamp, tokens, duration_s) 两条 → 1 组', () => {
    expect(countSuspectedDuplicateGroups([dup({ runId: 'a' }), dup({ runId: 'b' })])).toBe(1);
  });

  it('同键三条 → 仍计 1 组（组数 ≠ 条数）', () => {
    expect(countSuspectedDuplicateGroups([dup({ runId: 'a' }), dup({ runId: 'b' }), dup({ runId: 'c' })])).toBe(1);
  });

  it('键的任一分量不同即不同组（timestamp / tokens / duration_s 三向）→ 0 组', () => {
    expect(
      countSuspectedDuplicateGroups([
        dup({ runId: 'a' }),
        dup({ runId: 'b', timestamp: '2026-09-20T00:00:00.001Z' }),
        dup({ runId: 'c', tokens: 101 }),
        dup({ runId: 'd', duration_s: 6 }),
      ]),
    ).toBe(0);
  });

  it('两个不同键各重复两条 → 2 组（组数逐键累计）', () => {
    expect(
      countSuspectedDuplicateGroups([
        dup({ runId: 'a' }),
        dup({ runId: 'b' }),
        dup({ runId: 'c', tokens: 200 }),
        dup({ runId: 'd', tokens: 200 }),
      ]),
    ).toBe(2);
  });

  it('【现状锁定 / 任务 8（G3-7）翻转点】tokens: 0 当前计入组（键守卫实施后 → 0）', () => {
    // 现状：tokens=0 通过「有限非负数」判据并入组（check-budget.ts:198）；G3-7 要求 tokens 须为
    // **有限正数**才入组 → 任务 8 实施后本断言改为 toBe(0)。
    expect(countSuspectedDuplicateGroups([dup({ runId: 'a', tokens: 0 }), dup({ runId: 'b', tokens: 0 })])).toBe(1);
  });

  it('【现状锁定 / 任务 8（G3-7）翻转点】duration_s 缺字段当前计入组（键守卫实施后 → 0）', () => {
    // 现状：键取 String(undefined)='undefined'，两条同形记录仍并为一组；G3-7 要求 duration_s
    // 须为 number 才入组 → 任务 8 实施后本断言改为 toBe(0)。
    expect(
      countSuspectedDuplicateGroups([
        dup({ runId: 'a', duration_s: undefined }),
        dup({ runId: 'b', duration_s: undefined }),
      ]),
    ).toBe(1);
  });

  it('缺 timestamp / 非字符串 timestamp 不计组（既有判据，任务 8 不变）', () => {
    expect(
      countSuspectedDuplicateGroups([
        dup({ runId: 'a', timestamp: undefined }),
        dup({ runId: 'b', timestamp: undefined }),
        dup({ runId: 'c', timestamp: '' }),
        dup({ runId: 'd', timestamp: '' }),
        dup({ runId: 'e', timestamp: 123 }),
        dup({ runId: 'f', timestamp: 123 }),
      ]),
    ).toBe(0);
  });

  it('坏 tokens（负数 / NaN / Infinity / 字符串 / 缺字段）不计组（sumTokens 同口径）', () => {
    expect(
      countSuspectedDuplicateGroups([
        dup({ runId: 'a', tokens: -1 }),
        dup({ runId: 'b', tokens: -1 }),
        dup({ runId: 'c', tokens: Number.NaN }),
        dup({ runId: 'd', tokens: Number.NaN }),
        dup({ runId: 'e', tokens: Number.POSITIVE_INFINITY }),
        dup({ runId: 'f', tokens: Number.POSITIVE_INFINITY }),
        dup({ runId: 'g', tokens: '100' }),
        dup({ runId: 'h', tokens: '100' }),
        dup({ runId: 'i', tokens: undefined }),
        dup({ runId: 'j', tokens: undefined }),
      ]),
    ).toBe(0);
  });

  it('空输入 → 0 组', () => {
    expect(countSuspectedDuplicateGroups([])).toBe(0);
  });
});
