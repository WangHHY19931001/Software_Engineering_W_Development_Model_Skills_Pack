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
  it('R1 正例（A5 顺序化）：budget.updatedAt 不早于 project.updatedAt（已复核）→ passed', async () => {
    const b = await loadBudgetSample('valid.json');
    // valid.json updatedAt=2026-07-23T18:00:00Z ≥ projectUpdatedAt → 顺序化判据合法（相等/晚于均合法）
    const r = checkBudget(b, { projectUpdatedAt: '2026-07-10T00:00:00Z', budgetCreatedAt: '2026-07-01T00:00:00Z' });
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('R1 反例（A5 顺序化）：updatedAt 停滞（== createdAt）且早于 project.updatedAt → 违规（预算未随项目演进复核）', async () => {
    const b = await loadBudgetSample('bad-stale.json');
    const r = checkBudget(b, { projectUpdatedAt: '2026-07-23T18:00:00Z', budgetCreatedAt: '2026-07-01T00:00:00Z' });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R1') && v.includes('预算未随项目演进复核'))).toBe(true);
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

  it('R5 killSwitch 路径（3 态：低于阈值不触发 / consecutiveReworks 触发 / tlaReworks 触发）', async () => {
    const rows: readonly [string, { reworkCount?: number; tlaReworkCount?: number }, boolean, string | null][] = [
      ['reworkCount 低于阈值', { reworkCount: 2, tlaReworkCount: 2 }, false, null],
      ['reworkCount 达 consecutiveReworks 阈值', { reworkCount: 3 }, true, 'killSwitch 应触发'],
      ['tlaReworkCount 达 tlaReworks 阈值', { tlaReworkCount: 3 }, true, 'TLA+ 返工'],
    ];
    for (const [name, reworks, expectTrigger, token] of rows) {
      const b = await loadBudgetSample('valid.json');
      const r = checkBudget(b, reworks);
      if (expectTrigger) {
        expect(r.passed, `${name} 应 fail`).toBe(false);
        expect(
          r.violations.some((v) => v.includes(token!)),
          `${name} 应报 ${token}`,
        ).toBe(true);
      } else {
        expect(r.passed, `${name} 应通过`).toBe(true);
        expect(
          r.violations.some((v) => v.includes('killSwitch 应触发')),
          `${name} 不应报 killSwitch 应触发`,
        ).toBe(false);
      }
    }
  });
});

/**
 * countReworks（CLI 侧 run-log 返工统计口径，D-4a）
 *
 * 背景：真实 8 阶段调测的 run-log 中 action='rework' 一条都没有——返工以
 * fix 与 outcome='fail'/'rework' 落盘（批次 6 A15：rework/emergency-fix 死词已删除），旧口径（只认 action==='rework'）
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

  it('批次 6 A15：action=rework/emergency-fix 死词不经 action 判据计入，outcome 判据不变', () => {
    const entries = [
      // 'a' 经 outcome='fail' 计入（outcome 判据）；'b' outcome='success' 且 action 为死词 → 不计入
      { runId: 'a', phase: 5, action: 'rework', role: 'S', outcome: 'fail' },
      { runId: 'b', phase: 5, action: 'emergency-fix', role: 'S', outcome: 'success' },
      { runId: 'c', phase: 5, action: 'gate', role: 'G', outcome: 'success' },
      { runId: 'd', phase: 5, action: 'review', role: 'V', outcome: 'success' },
    ];
    const s = countReworks(entries, 5);
    expect(s.reworkCount).toBe(1); // 仅 a（outcome 判据）；b 的 action 死词不再计入
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
      perPhase: { maxTokens: 100 },
      project: { maxTokensTotal: 1000 },
      onExceed: 'pause',
      killSwitch: { consecutiveReworks: 3, budgetBurnRate: 0.9, tlaReworks: 3 },
    };
  }

  it('R6/R5-b 触发矩阵（4 态：阶段超限 / 总超限 / burnRate 告警 / 严格>边界）', () => {
    const rows: readonly [string, { phase: number; total: number }, RegExp | null, RegExp | null, boolean, boolean][] =
      [
        [
          'R6：阶段 tokens 超 perPhase.maxTokens → blocking',
          { phase: 150, total: 150 },
          /R6.*阶段 tokens 150.*maxTokens 100/,
          null,
          false,
          true,
        ],
        [
          'R6：总 tokens 超 project.maxTokensTotal → blocking',
          { phase: 0, total: 1200 },
          /R6.*总 tokens 1200.*maxTokensTotal 1000/,
          null,
          false,
          true,
        ],
        [
          'R5-b：阶段消耗 ≥ budgetBurnRate × maxTokens → killSwitch 告警（文案前缀 R5-b：，不与既有 R5 文案混同）',
          { phase: 95, total: 95 },
          null,
          /^R5-b：killSwitch 应触发（阶段消耗占比 0\.95 >= budgetBurnRate 0\.9）$/,
          false,
          true,
        ],
        [
          'R6 边界：阶段 tokens 恰等于 maxTokens 不报 R6（严格 >），但仍达 burnRate 阈值 → 告警',
          { phase: 100, total: 100 },
          null,
          /^R5-b：killSwitch 应触发（阶段消耗占比/,
          true,
          false,
        ],
      ];
    for (const [name, tokensUsed, r6Pattern, r5bPattern, assertNoR6, expectBlocking] of rows) {
      const r = checkBudget(tinyBudget(), { tokensUsed });
      if (r6Pattern) {
        expect(
          r.violations.some((v) => r6Pattern.test(v)),
          `${name} 应报 ${r6Pattern}`,
        ).toBe(true);
      } else {
        expect(
          r.violations.some((v) => r5bPattern!.test(v)),
          `${name} 应报 R5-b 文案（${r5bPattern}）`,
        ).toBe(true);
      }
      if (assertNoR6) {
        expect(
          r.violations.some((v) => /R6/.test(v)),
          `${name} 不应报 R6（严格 >）`,
        ).toBe(false);
      }
      if (expectBlocking) {
        expect(r.passed, `${name} 应 blocking`).toBe(false);
      }
    }
  });

  it('R5/R5-b 文案并存（2 态：R5 逐字不变 / R5 与 R5-b 并存各自可归属）', () => {
    const rows: readonly [
      string,
      { reworkCount: number; tlaReworkCount?: number; tokensUsed?: { phase: number; total: number } },
      string[],
      boolean,
    ][] = [
      [
        'R5 既有文案逐字不变（D-4b 只新增 R5-b/R6，不改 R5 返工/TLA 触发文案）',
        { reworkCount: 3, tlaReworkCount: 3 },
        ['killSwitch 应触发（返工 3 >= 3）但未告警', 'killSwitch 应触发（TLA+ 返工 3 >= 3）但未告警'],
        false,
      ],
      [
        'R5（返工）与 R5-b（用量）并存时各自可归属，新增文案不遮蔽既有文案',
        { reworkCount: 3, tokensUsed: { phase: 95, total: 95 } },
        ['killSwitch 应触发（返工 3 >= 3）但未告警'],
        true,
      ],
    ];
    for (const [name, opts, expectedTexts, assertR5bSingle] of rows) {
      const r = checkBudget(tinyBudget(), opts);
      for (const text of expectedTexts) {
        expect(r.violations, `${name} 应含「${text}」`).toContain(text);
      }
      if (assertR5bSingle) {
        expect(
          r.violations.filter((v) => v.startsWith('R5-b：')),
          `${name} R5-b 文案应恰 1 条`,
        ).toHaveLength(1);
      }
    }
  });

  it('守卫/边界族·不触发行（5 态：未提供 / maxTokens=0-R5b 退化 / NaN / total 边界 / burnRate 缺失）', () => {
    const rows: readonly [
      string,
      ((b: BudgetConfig) => void) | null,
      { phase: number; total: number } | undefined,
      RegExp,
      ((r: ReturnType<typeof checkBudget>) => void) | null,
    ][] = [
      [
        '未提供 tokensUsed → 不触发 R6/R5-b（向后兼容：行为一字不变）',
        null,
        undefined,
        /^R6|^R5-b/,
        (r) => {
          expect(r.passed, '未提供 tokensUsed 应通过').toBe(true);
          expect(
            r.violations.filter((v) => /R6|阶段消耗占比/.test(v)),
            '未提供 tokensUsed 不应报 R6/阶段消耗占比',
          ).toHaveLength(0);
        },
      ],
      [
        'R5-b：perPhase.maxTokens=0（阈值退化为恒真）→ R5-b 不触发且输出无 Infinity/NaN（正数守卫，R6 照常触发）',
        (b) => {
          b.perPhase.maxTokens = 0;
        },
        { phase: 5, total: 5 },
        /^R5-b/,
        (r) => {
          expect(
            r.violations.some((v) => /Infinity|NaN/.test(v)),
            'maxTokens=0 不应输出 Infinity/NaN',
          ).toBe(false);
        },
      ],
      [
        'R6/R5-b：tokensUsed 为 NaN（phase/total 均 NaN）→ 视同未提供：不触发且不抛错（非法输入防御）',
        null,
        { phase: Number.NaN, total: Number.NaN },
        /^R6|^R5-b/,
        (r) => {
          expect(r.passed, 'NaN tokensUsed 应视同未提供（passed=true）').toBe(true);
          // 与「未提供 tokensUsed」逐字段对齐（跳过路径等价：不产生额外 violation，也不新增 warning）
          expect(r, 'NaN tokensUsed 应与未提供 tokensUsed 结果逐字段等价').toEqual(checkBudget(tinyBudget()));
        },
      ],
      [
        'R6 边界：total 恰等于 maxTokensTotal → R6 不触发（严格 >，2026-09-22 打磨钉死）',
        null,
        { phase: 0, total: 1000 },
        /^R6|^R5-b/,
        (r) => {
          expect(
            r.violations.some((v) => /^R5-b/.test(v)),
            'total 边界不应报 R5-b',
          ).toBe(false);
        },
      ],
      [
        'R5-b：killSwitch.budgetBurnRate 缺失 → R5-b 不触发（typeof 守卫，不因字段缺失误报）',
        (b) => {
          delete (b.killSwitch as Partial<BudgetConfig['killSwitch']>).budgetBurnRate;
        },
        { phase: 95, total: 95 },
        /^R6|^R5-b/,
        (r) => {
          expect(
            r.violations.some((v) => /R6/.test(v)),
            'burnRate 缺失不应连带报 R6',
          ).toBe(false);
        },
      ],
    ];
    for (const [name, mutate, tokensUsed, absentPattern, extra] of rows) {
      const b = tinyBudget();
      if (mutate) mutate(b);
      if (tokensUsed !== undefined && Number.isNaN(tokensUsed.phase)) {
        expect(() => checkBudget(b, { tokensUsed }), `${name} 不应抛错`).not.toThrow();
      }
      const r = checkBudget(b, tokensUsed !== undefined ? { tokensUsed } : {});
      expect(
        r.violations.filter((v) => absentPattern.test(v)),
        `${name} 不应触发（${absentPattern}）`,
      ).toHaveLength(0);
      if (extra) extra(r);
    }
  });

  it('守卫/边界族·触发行（1 态：perPhase.maxTokens=0 仍触发 R6 但文案省略百分比段）', () => {
    const b = tinyBudget();
    b.perPhase.maxTokens = 0;
    const r = checkBudget(b, { tokensUsed: { phase: 5, total: 5 } });
    const r6 = r.violations.filter((v) => v.startsWith('R6'));
    expect(
      r6.some((v) => v.includes('阶段 tokens 5 > perPhase.maxTokens 0')),
      'maxTokens=0 应触发 R6 超限文案',
    ).toBe(true);
    expect(
      r6.some((v) => /NaN|Infinity/.test(v)),
      'R6 文案不应含 NaN/Infinity（除零守卫）',
    ).toBe(false);
    expect(
      r6.some((v) => v.includes('%')),
      'R6 文案应省略百分比段（除零守卫）',
    ).toBe(false);
  });
});

/**
 * R1 顺序化（43.0.0 A5）+ 三死字段退役
 *
 * - R1 时效性改为顺序比较：budget.updatedAt 早于 project.updatedAt → 违规（预算未随项目演进复核），
 *   相等合法；时间戳经 Date 解析为毫秒比较（禁字符串比较），任一端不可解析 → 跳过子判定 + 非阻断诊断。
 * - perPhase.maxSubagentSpawns / perPhase.maxReworkRounds / project.maxTokensPerSession 三个
 *   零消费死字段删除（毁弃存量）：旧数据携带这些字段 → additionalProperties:false 拒绝。
 */
function makeBudget(
  overrides: {
    createdAt?: string;
    updatedAt?: string;
    perPhase?: Record<string, unknown>;
    project?: Record<string, unknown>;
  } = {},
): BudgetConfig {
  return {
    schemaVersion: '1.0',
    projectId: 'a5-budget',
    createdAt: overrides.createdAt ?? '2026-10-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-10-05T00:00:00Z',
    perPhase: { maxTokens: 100, ...(overrides.perPhase ?? {}) } as BudgetConfig['perPhase'],
    project: { maxTokensTotal: 1000, ...(overrides.project ?? {}) } as BudgetConfig['project'],
    onExceed: 'pause',
    killSwitch: { consecutiveReworks: 3, budgetBurnRate: 0.9, tlaReworks: 3 },
  };
}

describe('R1 顺序化（43.0.0 A5）：budget.updatedAt vs project.updatedAt', () => {
  const opts = (projectUpdatedAt: string) => ({ projectUpdatedAt, budgetCreatedAt: '2026-10-01T00:00:00Z' });

  it('R1 四态（早于→违规 / 相等→合法 / 晚于→合法）', () => {
    const rows: readonly [string, string, string, boolean][] = [
      [
        'budget.updatedAt 早于 project.updatedAt → R1 违规（预算未随项目演进复核）',
        '2026-10-01T00:00:00Z',
        '2026-10-05T00:00:00Z',
        true,
      ],
      [
        'budget.updatedAt 相等 project.updatedAt → 合法（相等不再违规）',
        '2026-10-05T00:00:00Z',
        '2026-10-05T00:00:00Z',
        false,
      ],
      ['budget.updatedAt 晚于 project.updatedAt → 合法', '2026-10-06T00:00:00Z', '2026-10-05T00:00:00Z', false],
    ];
    for (const [name, updatedAt, projectUpdatedAt, expectViolation] of rows) {
      const r = checkBudget(makeBudget({ updatedAt }), opts(projectUpdatedAt));
      expect(
        r.violations.some((v) => v.startsWith('R1')),
        `${name}：R1 判定不符`,
      ).toBe(expectViolation);
      if (expectViolation) {
        expect(r.passed, `${name} 应 blocking`).toBe(false);
        expect(
          r.violations.some((v) => v.includes('预算未随项目演进复核')),
          `${name} 应含挑明文案`,
        ).toBe(true);
      } else {
        expect(r.passed, `${name} 应通过`).toBe(true);
      }
    }
  });

  it('R1 不可解析守卫：任一端不可解析 → 跳过子判定（无 R1 违规）+ 非阻断诊断（跳过不等于通过）', () => {
    const r = checkBudget(makeBudget({ updatedAt: '2026-10-01T00:00:00Z' }), {
      projectUpdatedAt: 'not-a-date',
      budgetCreatedAt: '2026-10-01T00:00:00Z',
    });
    expect(r.violations.some((v) => v.startsWith('R1'))).toBe(false);
    expect(r.passed).toBe(true);
    expect(r.warnings.some((w) => w.includes('R1') && w.includes('不可解析'))).toBe(true);
  });

  it('A5 简报原例：updatedAt==createdAt 停滞且 project.updatedAt 已推进 → R1 违规', () => {
    const r = checkBudget(
      makeBudget({ createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }),
      opts('2026-10-05T00:00:00Z'),
    );
    expect(r.violations.some((v) => v.startsWith('R1'))).toBe(true);
  });
});

describe('A5：三死字段退役（43.0.0，毁弃存量）', () => {
  it('三死字段出现于 budget.json → [schema] 违规（additionalProperties 拒绝，3 态）', () => {
    const rows: readonly [string, Record<string, unknown>, string][] = [
      ['perPhase.maxSubagentSpawns', { perPhase: { maxTokens: 100, maxSubagentSpawns: 30 } }, 'maxSubagentSpawns'],
      ['perPhase.maxReworkRounds', { perPhase: { maxTokens: 100, maxReworkRounds: 3 } }, 'maxReworkRounds'],
      [
        'project.maxTokensPerSession',
        { project: { maxTokensTotal: 1000, maxTokensPerSession: 1000 } },
        'maxTokensPerSession',
      ],
    ];
    for (const [name, patch, field] of rows) {
      const b = { ...(makeBudget() as unknown as Record<string, unknown>), ...patch };
      const r = checkBudget(b);
      expect(r.passed, `${name} 应 fail`).toBe(false);
      expect(
        r.violations.some((v) => v.startsWith('[schema]') && v.includes(field)),
        `${name} 应报 [schema] ${field}`,
      ).toBe(true);
    }
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
 * countSuspectedDuplicateGroups（N-6 上界口径诊断，G2-2 直测 + 任务 8/G3-7 键守卫翻转 + G3-15 归账精确化）
 *
 * 语义（`cli/check-budget.ts` 现实现）：分组键 = `parentDispatchId|timestamp|tokens|duration_s`，
 * 计入判据 = 「非空字符串 timestamp + **有限正数** tokens + `duration_s` 为 number」。
 * 任务 8 已实施 G3-7 键守卫（tokens=0 与缺 duration_s 的噪声键不再入组，两条现状锁定断言翻转为 0）
 * 与 G3-15 归账精确化（`parentDispatchId` 在场且非空时以该字段入键——同 parent 的 R3 多条归账
 * 不再互计为疑似重复；键全同 = 同一 parent 下又一次完全相同的归账，仍计组）。
 */
describe('countSuspectedDuplicateGroups 疑似重复归账分组口径（N-6，G2-2）', () => {
  const dup = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    runId: 'r',
    timestamp: '2026-09-20T00:00:00.000Z',
    tokens: 100,
    duration_s: 5,
    ...patch,
  });

  it('分组基本口径（4 态：两条 / 三条 / 三向分量不同 / 双键累计）', () => {
    const rows: readonly [string, Record<string, unknown>[], number][] = [
      ['同 (timestamp, tokens, duration_s) 两条', [{ runId: 'a' }, { runId: 'b' }], 1],
      ['同键三条 → 仍计 1 组（组数 ≠ 条数）', [{ runId: 'a' }, { runId: 'b' }, { runId: 'c' }], 1],
      [
        '键的任一分量不同即不同组（timestamp / tokens / duration_s 三向）',
        [
          { runId: 'a' },
          { runId: 'b', timestamp: '2026-09-20T00:00:00.001Z' },
          { runId: 'c', tokens: 101 },
          { runId: 'd', duration_s: 6 },
        ],
        0,
      ],
      [
        '两个不同键各重复两条 → 2 组（组数逐键累计）',
        [{ runId: 'a' }, { runId: 'b' }, { runId: 'c', tokens: 200 }, { runId: 'd', tokens: 200 }],
        2,
      ],
    ];
    for (const [name, patches, expected] of rows) {
      expect(countSuspectedDuplicateGroups(patches.map((patch) => dup(patch))), `${name} 应计 ${expected} 组`).toBe(
        expected,
      );
    }
  });

  it('【任务 8（G3-7）键守卫】坏键不计组（5 态：tokens=0 / 缺 duration_s / duration_s 非 number / 坏 timestamp / 坏 tokens）', () => {
    const rows: readonly [string, Record<string, unknown>[]][] = [
      // 守卫前：tokens=0 通过「有限非负数」判据并入组；G3-7 要求 tokens 须为有限正数 → 噪声键不入组。
      [
        'tokens: 0 不计组（键守卫：须有限正数）',
        [
          { runId: 'a', tokens: 0 },
          { runId: 'b', tokens: 0 },
        ],
      ],
      // 守卫前：键取 String(undefined)='undefined'，两条同形记录并为一组；G3-7 要求 duration_s 须为 number。
      [
        'duration_s 缺字段不计组（键守卫：须为 number）',
        [
          { runId: 'a', duration_s: undefined },
          { runId: 'b', duration_s: undefined },
        ],
      ],
      [
        'duration_s 非 number（字符串 / null）亦不计组（键守卫生效面与缺字段同口径）',
        [
          { runId: 'a', duration_s: '5' },
          { runId: 'b', duration_s: '5' },
          { runId: 'c', duration_s: null },
          { runId: 'd', duration_s: null },
        ],
      ],
      [
        '缺 timestamp / 非字符串 timestamp 不计组（既有判据，任务 8 不变）',
        [
          { runId: 'a', timestamp: undefined },
          { runId: 'b', timestamp: undefined },
          { runId: 'c', timestamp: '' },
          { runId: 'd', timestamp: '' },
          { runId: 'e', timestamp: 123 },
          { runId: 'f', timestamp: 123 },
        ],
      ],
      [
        '坏 tokens（负数 / NaN / Infinity / 字符串 / 缺字段）不计组（与 sumTokens 的「有限非负」口径在此故意不同）',
        [
          { runId: 'a', tokens: -1 },
          { runId: 'b', tokens: -1 },
          { runId: 'c', tokens: Number.NaN },
          { runId: 'd', tokens: Number.NaN },
          { runId: 'e', tokens: Number.POSITIVE_INFINITY },
          { runId: 'f', tokens: Number.POSITIVE_INFINITY },
          { runId: 'g', tokens: '100' },
          { runId: 'h', tokens: '100' },
          { runId: 'i', tokens: undefined },
          { runId: 'j', tokens: undefined },
        ],
      ],
    ];
    for (const [name, patches] of rows) {
      expect(countSuspectedDuplicateGroups(patches.map((patch) => dup(patch))), `${name} 应计 0 组`).toBe(0);
    }
  });

  it('【任务 8（G3-15）】parentDispatchId 归账精确化（4 态：同 parent 不互计 / 异 parent 不合并 / 键全同仍计 / 空串按缺字段）', () => {
    const rows: readonly [string, Record<string, unknown>[], number][] = [
      [
        // 归账形态对齐 data-models.md「R3 三条目归账约定」：主条目记整次分派消耗，两条附属条目按维度各记
        // 自己的实际消耗并以 parentDispatchId 指向主条目 runId → 三个键互异 → 0 组（G3-15 要修的
        // 「同一分派的约定内多归账被误报为疑似重复」）。
        '主条目 + 2 条同 parentDispatchId 的 R3 归账（各自实际消耗）→ 0 组（不互计）',
        [
          { runId: 'p5-R-r3-01', tokens: 1200, duration_s: 30 },
          { runId: 'p5-R-r3-02', tokens: 300, duration_s: 12, parentDispatchId: 'p5-R-r3-01' },
          { runId: 'p5-R-r3-03', tokens: 150, duration_s: 8, parentDispatchId: 'p5-R-r3-01' },
        ],
        0,
      ],
      [
        '不同 parentDispatchId 的同键条目分组互不合并 → 0 组',
        [{ runId: 'a', parentDispatchId: 'pA' }, { runId: 'b', parentDispatchId: 'pB' }, { runId: 'c' }],
        0,
      ],
      [
        // 约定内归账只解释「主条目 + 附属条目」的键差异；同一 parent 下又一次完全相同的归账仍属可疑。
        '同 parentDispatchId 且键全同仍计组（parent 不豁免完全相同的归账）',
        [
          { runId: 'a', parentDispatchId: 'pA' },
          { runId: 'b', parentDispatchId: 'pA' },
        ],
        1,
      ],
      [
        'parentDispatchId 空串/非字符串按缺字段处理（legacy 判定不变）',
        [
          { runId: 'a', parentDispatchId: '' },
          { runId: 'b', parentDispatchId: 123 },
          { runId: 'c', parentDispatchId: undefined },
        ],
        1, // 三条键前缀均为空串 → 同一键 3 条 → 1 组（字段引入前同判定）
      ],
    ];
    for (const [name, patches, expected] of rows) {
      expect(countSuspectedDuplicateGroups(patches.map((patch) => dup(patch))), `${name} 应计 ${expected} 组`).toBe(
        expected,
      );
    }
  });

  it('空输入 → 0 组', () => {
    expect(countSuspectedDuplicateGroups([])).toBe(0);
  });
});
