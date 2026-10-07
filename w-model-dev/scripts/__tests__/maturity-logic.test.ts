/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(tmpDir, ...) 路径由测试自生成，非用户输入） */
/**
 * maturity-logic.test.ts —— 成熟度校验（R1-R8）单元测试
 *
 * 覆盖 maturity-logic.ts 中 checkMaturity 函数：
 *   - 合法 MaturityConfig 通过
 *   - schema 前置校验（缺 required 字段 → [schema] 违规，防反模式 #28）
 *   - R4 history / leveledUpAt 早于 project.createdAt
 *   - R5 O 系列失败模式命中达 streak 阈值 → 降级评估提醒
 *   - R5 真值通道（D-7）：只统计 run-log 的 `operationalFailureModes` 字段，note 中的 O1..O6
 *     字样（含评审规则编号同名情形，如 O3 既是运维失败模式也是 Verifier 扣分规则）按引用处理，
 *     仅作非阻断诊断；未提供 --run-log 时诊断「R5 未生效」而非静默跳过
 *   - R5 读路径枚举守卫（G3-18）：过滤非 O1~O6 取值（`'O9'`/拼写错误/非字符串）并出非阻断诊断；
 *     `uniqueItems` 与「存在即累加数组长度」口径不变（`['O3','O3']` 仍计 2）
 *   - CLI 三态（真实 tsx 子进程 + 真实临时 run-log）：仅引用 → exit 0 + 诊断 /
 *     字段标注 3 次 → exit 1 + R5 违规 / 未提供 --run-log → exit 0 + 诊断
 *   - A4（43.0.0）R6 history 链一致性：from == 上一条 to / to > from（严格）/ 末条 to 不低于当前 level（降级合法）
 *     + 决策3（43.1.0）首条 from == L0（完整升级链须自 L0 起步；存量 L1→L2 切片链不再合法）
 *     （原 R3 completedCycles 周期校验随 unlockConditions 死字段删除而退役，规则号不回收）
 *   - A14（43.1.0）R7 project.status 转移合法性（judge 单点复用）
 *   - 决策2（43.1.0）R8 降级须 human 授权：降级形态（level < history 末条 to）经 CLI 装载签名链
 *     注入 maturityApprovalOk 后判定（无授权 → blocking；logic 保持纯函数接缝）
 *   - 修复轮 1（R-B7-7）R8 授权**降级专属绑定**：CLI 以 `requireAction='downgrade-approve'` 判定——
 *     升级流程所落的 `role=human / targetKind=maturity` 人签条目（action='approve' /
 *     'upgrade-approve'）不构成降级授权（否则升级条目天然满足 R8）；不传 requireAction 时
 *     verifyMaturityApproval 口径不变（check-artifact-gate 豁免消费零漂移）
 *   - 修复轮 1 签名链装载容错：合法 JSON 但非对象的整行（`null` / 数组）跳过而非 `[UNEXPECTED]` exit 2
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildR5Diagnostics,
  collectLexicalMentions,
  countOperationalFailures,
  summarizeOperationalFailures,
} from '../cli/check-maturity.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import { runSync } from '../lib/run-sync.js';
import { judgeProjectStatusTransition } from '../logic/gate-logic.js';
import { checkMaturity, type MaturityConfig } from '../logic/maturity-logic.js';
import { computeSigHash, verifyMaturityApproval, type SignatureChainEntry } from '../logic/signature-chain-logic.js';

function validMaturity(): MaturityConfig {
  return {
    schemaVersion: '1.0',
    projectId: 'test-project',
    level: 'L1',
    leveledUpAt: '2026-08-01T00:00:00Z',
    history: [
      {
        from: 'L0',
        to: 'L1',
        at: '2026-08-01T00:00:00Z',
        reason: '稳定运行 1 完整周期',
      },
    ],
    downgradeTriggers: { operationalFailureStreak: 3, userRequested: false },
  };
}

describe('checkMaturity', () => {
  it('合法 MaturityConfig → passed=true 且零违规', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('schema 前置校验：缺 projectId → [schema] 违规（防反模式 #28）', () => {
    const rest = { ...validMaturity() } as Record<string, unknown>;
    delete rest['projectId'];
    const r = checkMaturity(rest);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R4：history 条目早于 project.createdAt → 时序违规', () => {
    const r = checkMaturity(validMaturity(), {
      projectCreatedAt: '2026-08-15T00:00:00Z',
    });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R4') && v.includes('project.createdAt'))).toBe(true);
  });

  it('R5：O 系列失败模式命中达 streak 阈值 → 降级评估违规', () => {
    const r = checkMaturity(validMaturity(), { operationalFailureCount: 3 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R5') && v.includes('降级评估'))).toBe(true);
  });
});

// ==================== A4（43.0.0）R6 history 链一致性 ====================

/**
 * A4 销账（批次 6 任务 8）：maturity.level 此前由被门禁者自写即可关闭 TLA+/BDD 门禁，
 * history 无链校验。R6 四判定（审计裁定，决策日志 rounds-48；第三判定经批次 6 修复轮 1 放宽；
 * 第四判定为批次 7 决策 #3，43.1.0）：
 *   1. from == 上一条 to（首条无前驱，其起点由第四判定单独约束）；
 *   2. to > from（LEVEL_ORDER 严格比较；降级走审批链，history 只承载升级链）；
 *   3. 末条 to 不低于当前 level（降级后 level 低于末条合法——A4 起豁免须 human 审批链，
 *      降级不再构成绕过面，R6 只锁「level 高于链末条」的伪造升级；空历史 + level≠L0 亦违规）；
 *   4. 首条 from == L0（决策 #3，43.1.0）：完整升级链须自 L0 起步——存量 L1→L2 切片链不再合法
 *      （迁移 = e2e 装配器 maturity.json 前插 L0→L1）。
 */
describe('A4 maturity 钥匙收紧（R6 history 链）', () => {
  const mkHistory = (
    rows: Array<[from: 'L0' | 'L1' | 'L2' | 'L3', to: 'L0' | 'L1' | 'L2' | 'L3']>,
  ): MaturityConfig['history'] =>
    rows.map(([from, to], i) => ({
      from,
      to,
      at: `2026-08-0${i + 1}T00:00:00Z`,
      reason: `升级 ${from}→${to}`,
    }));

  it('R6：history 链断裂（from ≠ 上一条 to）→ 违规', () => {
    const m = {
      ...validMaturity(),
      level: 'L2',
      history: mkHistory([
        ['L0', 'L1'],
        ['L0', 'L2'],
      ]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R6:'))).toBe(true);
    expect(r.violations.join()).toContain('上一条');
  });

  it('R6：末条 to 低于当前 level（level 虚高，伪造升级）→ 违规', () => {
    const m = {
      ...validMaturity(),
      level: 'L2',
      history: mkHistory([['L0', 'L1']]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R6:'))).toBe(true);
    expect(r.violations.join()).toContain('当前 level');
  });

  it('R6：降级形态（升级链至 L2 后 level=L0，末条高于 level）→ R6 零违规（只锁伪造升级；降级授权由 R8 独立承担）', () => {
    const m = {
      ...validMaturity(),
      level: 'L0',
      history: mkHistory([
        ['L0', 'L1'],
        ['L1', 'L2'],
      ]),
    };
    // 决策 #2（43.1.0）：R6 第三判定仍不锁降级形态，但降级须 human 授权（R8）——
    // 注入授权通过结果后 R6 侧零违规；未注入的 R8 blocking 由「决策2a」用例锁定。
    const r = checkMaturity(m, { maturityApprovalOk: true });
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('R6：from == to（L0→L0 非升级占位条目）→ 违规（history 只承载升级链）', () => {
    const m = {
      ...validMaturity(),
      level: 'L0',
      history: mkHistory([['L0', 'L0']]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R6:') && v.includes('须严格高于 from'))).toBe(true);
  });

  it('R6：降级形态（to < from）→ 违规（降级走 human 审批链，不记 history）', () => {
    const m = {
      ...validMaturity(),
      level: 'L1',
      history: mkHistory([
        ['L0', 'L1'],
        ['L1', 'L0'],
      ]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R6:') && v.includes('须严格高于 from'))).toBe(true);
  });

  it('R6：空历史 + level≠L0 → 违规；空历史 + level=L0（初始态）→ 合法', () => {
    const l1 = checkMaturity({ ...validMaturity(), level: 'L1', history: [] });
    expect(l1.passed).toBe(false);
    expect(l1.violations.some((v) => v.startsWith('R6:'))).toBe(true);
    const l0 = checkMaturity({ ...validMaturity(), level: 'L0', history: [] });
    expect(l0.passed).toBe(true);
  });

  it('R6：合法升级链（L0→L1→L2 且 level=L2）→ 零违规', () => {
    const m = {
      ...validMaturity(),
      level: 'L2',
      history: mkHistory([
        ['L0', 'L1'],
        ['L1', 'L2'],
      ]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('决策3：history 首条 from≠L0 → R6 违规「完整升级链须自 L0 起步」', () => {
    const m = {
      ...validMaturity(),
      level: 'L2',
      history: mkHistory([['L1', 'L2']]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('R6:') && v.includes('完整升级链须自 L0 起步'))).toBe(true);
  });

  it('决策3b：首条 from==L0 的切片链（L0→L1→L2）→ 零违规（迁移后形态）', () => {
    const m = {
      ...validMaturity(),
      level: 'L2',
      history: mkHistory([
        ['L0', 'L1'],
        ['L1', 'L2'],
      ]),
    };
    const r = checkMaturity(m);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});

/**
 * 可见性与死分支清理（F-G2-04/05，audit-fixes task 5；43.0.0 A4 随动）：
 *   - 原 R3（completedCycles 周期换算）随 unlockConditions 死字段删除而退役（R3 规则号不回收）；
 *     「R3 未校验」warning 通道一并移除，warnings 保持零值语义
 *   - R1 死分支删除：schema required 前置拦截缺失字段，逻辑层不再重复报「schema 不完整」
 */
describe('checkMaturity 可见性与死分支清理', () => {
  it('A4：unlockConditions/R3 退役后，未提供 --project 不再出 warning（warnings 为空）', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('R1 死分支已删除：缺 level 由 schema required 前置拦截 → [schema]（F-G2-05）', () => {
    const m = validMaturity() as unknown as Record<string, unknown>;
    delete m['level'];
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });
});

// ==================== R5 真值通道（D-7） ====================

/** run-log 记录最小形状（仅 R5 统计所需字段；schema 完备性由 check-run-log 负责） */
const mkEntry = (patch: Record<string, unknown>): Record<string, unknown> => ({
  phase: 1,
  action: 'gate',
  role: 'G',
  outcome: 'success',
  timestamp: '2026-09-25T10:00:00.000Z',
  ...patch,
});

/**
 * R5 用例的成熟度模型：以 validMaturity() 为底（schema 前置校验要求全 required 字段在场），
 * 覆写 level 与降级阈值 streak——故 mkMaturity(3) 的 R5 判据为「命中 ≥ 3」。
 * history 同步覆写为 L0→L1→L2 升级链（A4 R6：level 不得高于末条 history.to，降级后低于末条合法，43.0.0）。
 */
const mkMaturity = (streak: number): MaturityConfig => ({
  ...validMaturity(),
  level: 'L2',
  history: [
    {
      from: 'L0',
      to: 'L1',
      at: '2026-08-01T00:00:00Z',
      reason: '稳定运行 1 完整周期',
    },
    {
      from: 'L1',
      to: 'L2',
      at: '2026-08-02T00:00:00Z',
      reason: '第二个完整周期完成',
    },
  ],
  downgradeTriggers: {
    ...validMaturity().downgradeTriggers,
    operationalFailureStreak: streak,
  },
});

describe('R5 真值通道：只统计 operationalFailureModes 字段（D-7）', () => {
  it('R5 只统计 operationalFailureModes 字段，词法命中不改判', () => {
    const rows = [mkEntry({ note: '拦截 #9：R5 O_PATTERN 与 VerifierOutput O3 命名冲突' })];
    expect(countOperationalFailures(rows)).toBe(0);
    expect(
      checkMaturity(mkMaturity(3), {
        operationalFailureCount: countOperationalFailures(rows),
      }).passed,
    ).toBe(true);
  });

  it('R5 计数口径·计次行（3 态：标注 3 次违规 / 多枚举数组累加 / 重复值长度口径）', () => {
    for (const { caseName, rows, expectedCount, expectViolation, schemaChecks } of [
      {
        caseName: 'operationalFailureModes 标注 3 次 → R5 违规',
        rows: [1, 2, 3].map(() => mkEntry({ operationalFailureModes: ['O3'] })),
        expectedCount: 3,
        expectViolation: true,
        schemaChecks: false,
      },
      {
        caseName: '同记录多枚举值按数组长度累加；非数组形态与词法命中均不计入（向后兼容）',
        rows: [
          mkEntry({ operationalFailureModes: ['O1', 'O4'] }),
          mkEntry({ operationalFailureModes: 'O3' }),
          mkEntry({ note: 'O5 命中字样仅为引用' }),
          mkEntry({}),
        ],
        expectedCount: 2,
        expectViolation: false,
        schemaChecks: false,
      },
      {
        caseName: '重复值：schema uniqueItems 拒收，计数按数组长度（每项至多一次由 schema 强制）',
        rows: [],
        expectedCount: 2,
        expectViolation: false,
        schemaChecks: true,
      },
    ]) {
      let countedRows = rows;
      if (schemaChecks) {
        const duplicate = JSON.parse(runLogEntry('r5-dup-mode', { operationalFailureModes: ['O3', 'O3'] })) as Record<
          string,
          unknown
        >;
        const single = JSON.parse(runLogEntry('r5-single-mode', { operationalFailureModes: ['O3'] })) as Record<
          string,
          unknown
        >;
        expect(validateBySchema('run-log', duplicate).valid, `${caseName}: 重复值被 uniqueItems 拒收`).toBe(false);
        expect(validateBySchema('run-log', single).valid, `${caseName}: 对照单值形态合法`).toBe(true);
        countedRows = [duplicate];
      }
      expect(countOperationalFailures(countedRows), `${caseName}: 计数口径`).toBe(expectedCount);
      if (expectViolation) {
        const r = checkMaturity(mkMaturity(3), {
          operationalFailureCount: expectedCount,
        });
        expect(r.passed, `${caseName}: 应触发 R5 违规`).toBe(false);
        expect(r.violations.join(), `${caseName}: 违规文案`).toMatch(/R5: O 系列失败模式命中 3 次/);
      }
    }
  });

  it('R5 计数口径·不计行（空标注不计次）', () => {
    const rows = [mkEntry({ operationalFailureModes: [] })];
    expect(countOperationalFailures(rows), '空数组: 计数 0').toBe(0);
  });

  it('collectLexicalMentions：按命中次数返回 runId（引用位置可追溯），缺 runId 用占位符', () => {
    const rows = [
      mkEntry({
        runId: 'p1-G-verifier-10',
        note: 'O3 既是运维失败模式也是评审规则编号',
      }),
      mkEntry({ runId: 'p2-V-rootcause-02c', note: 'O3 与 O4 引用' }),
      mkEntry({ runId: 'p3-G-ok', note: '无失败模式字样' }),
      mkEntry({ note: 'O1 引用但记录缺 runId' }),
    ];
    expect(collectLexicalMentions(rows)).toEqual([
      'p1-G-verifier-10',
      'p2-V-rootcause-02c',
      'p2-V-rootcause-02c',
      '<无 runId>',
    ]);
  });
});

describe('R5 诊断通道：未接线可见化与词法降级（D-7）', () => {
  it('未提供 --run-log → 诊断「R5 未生效」；非阻断（退出码语义不变）', () => {
    const diagnostics = buildR5Diagnostics(false, []);
    expect(diagnostics).toEqual(['R5 未生效：未提供 --run-log（O 系列失败模式未校验）']);
    const r = checkMaturity(mkMaturity(3), {
      operationalFailureCount: 0,
      diagnostics,
    });
    expect(r.passed).toBe(true);
    expect(r.diagnostics).toEqual(diagnostics);
  });

  it('词法命中 → 诊断含命中数与去重 runId 列表，且不改判', () => {
    const rows = [
      mkEntry({ runId: 'p1-G-verifier-10', note: 'O3 引用' }),
      mkEntry({ runId: 'p7-V-finalize-02b', note: 'O3 与 O4 引用' }),
    ];
    const diagnostics = buildR5Diagnostics(true, collectLexicalMentions(rows));
    expect(diagnostics).toEqual([
      '疑似引用 3 处（含规则编号引用，非运维失败）；若确为运维失败请在记录中以 operationalFailureModes 标注：p1-G-verifier-10, p7-V-finalize-02b',
    ]);
    const r = checkMaturity(mkMaturity(3), {
      operationalFailureCount: countOperationalFailures(rows),
      diagnostics,
    });
    expect(r.passed).toBe(true);
    expect(r.diagnostics).toEqual(diagnostics);
  });

  it('diagnostics 与 warnings 并存：互不影响，且不改判', () => {
    const r = checkMaturity(mkMaturity(3), {
      diagnostics: ['R5 未生效：未提供 --run-log（O 系列失败模式未校验）'],
    });
    expect(r.warnings).toEqual([]);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.passed).toBe(true);
  });

  it('未传 options → diagnostics 为空数组（既有调用方零回归）', () => {
    expect(checkMaturity(validMaturity()).diagnostics).toEqual([]);
  });
});

// ==================== CLI 三态（D-7 端到端） ====================

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli');

/** 合法 maturity.json（形状照抄 samples/maturity/valid.json；43.0.0 A4：unlockConditions 死字段已删除） */
const VALID_MATURITY =
  '{"schemaVersion":"1.0","projectId":"smoke","level":"L1","leveledUpAt":"2026-07-23T18:00:00Z","history":[{"at":"2026-07-23T18:00:00Z","from":"L0","to":"L1","reason":"3 阶段稳定完成"}],"downgradeTriggers":{"operationalFailureStreak":3,"userRequested":false}}';

const runLogEntry = (runId: string, patch: Record<string, unknown>): string =>
  JSON.stringify({
    runId,
    timestamp: '2026-09-25T10:00:00.000Z',
    phase: 1,
    phaseName: '需求分析',
    action: 'gate',
    role: 'G',
    duration_s: 1,
    tokens: 10,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: 0,
    outcome: 'success',
    ...patch,
  });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maturity-r5-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<string> {
  const p = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
  return p;
}

/** 摘取单行 MATURITY_JSON 摘要（供断言机器通道字段） */
function maturitySummary(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('MATURITY_JSON '));
  expect(line, 'stdout 缺 MATURITY_JSON 摘要行').toBeDefined();
  return JSON.parse(line!.slice('MATURITY_JSON '.length)) as Record<string, unknown>;
}

describe('check-maturity CLI：--run-log 三态（D-7 端到端，真实子进程 + 真实临时 run-log）', () => {
  it('CLI 诊断三态（3 态：仅引用 / 标注 3 次违规 / 未提供 --run-log）', async () => {
    for (const {
      caseName,
      runLogContent,
      expectedExit,
      stdoutIncludes,
      expectPassed,
      expectDiagnosticsLength,
      expectDiagnosticsEquals,
    } of [
      {
        caseName: '仅引用（note 含 O3 字样，共 17 处）→ 不再误判 R5',
        runLogContent: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
          .map((i) =>
            runLogEntry(`p${i}-G-verifier-${i}`, {
              note: 'O3 既是运维失败模式也是评审规则编号',
            }),
          )
          .join('\n'),
        expectedExit: 0,
        stdoutIncludes: ['疑似引用 17 处（含规则编号引用，非运维失败）', 'operationalFailureModes 标注：'],
        expectPassed: true,
        expectDiagnosticsLength: 1,
        expectDiagnosticsEquals: undefined as string[] | undefined,
      },
      {
        caseName: 'operationalFailureModes 标注 3 次 → exit 1 + R5 违规',
        runLogContent: [1, 2, 3].map((i) => runLogEntry(`p1-G-${i}`, { operationalFailureModes: ['O3'] })).join('\n'),
        expectedExit: 1,
        stdoutIncludes: ['R5: O 系列失败模式命中 3 次'],
        expectPassed: false,
        expectDiagnosticsLength: undefined as number | undefined,
        expectDiagnosticsEquals: undefined,
      },
      {
        caseName: '未提供 --run-log → exit 0 + 「R5 未生效」诊断（隐性规避通道可见化）',
        runLogContent: null,
        expectedExit: 0,
        stdoutIncludes: ['R5 未生效：未提供 --run-log（O 系列失败模式未校验）'],
        expectPassed: undefined as boolean | undefined,
        expectDiagnosticsLength: undefined,
        expectDiagnosticsEquals: ['R5 未生效：未提供 --run-log（O 系列失败模式未校验）'],
      },
    ]) {
      const maturity = await write('maturity.json', VALID_MATURITY);
      const args = [path.join(cliDir, 'check-maturity.ts'), maturity];
      if (runLogContent !== null) {
        args.push(`--run-log=${await write('run-log.jsonl', runLogContent)}`);
      }
      const r = runSync(process.execPath, [tsxCli, ...args]);
      expect(r.status, `${caseName}: 退出码`).toBe(expectedExit);
      for (const marker of stdoutIncludes) {
        expect(r.stdout, `${caseName}: stdout 应含「${marker}」`).toContain(marker);
      }
      const summary = maturitySummary(r.stdout ?? '');
      if (expectPassed !== undefined) {
        expect(summary['passed'], `${caseName}: summary.passed`).toBe(expectPassed);
      }
      if (expectDiagnosticsLength !== undefined) {
        expect(summary['diagnostics'], `${caseName}: diagnostics 条数`).toHaveLength(expectDiagnosticsLength);
      }
      if (expectDiagnosticsEquals !== undefined) {
        expect(summary['diagnostics'], `${caseName}: diagnostics 逐字`).toEqual(expectDiagnosticsEquals);
      }
    }
  });
});

// ==================== 批次 8 rider：--rollback-approved 单独给出的非阻断诊断（批次 7 T9 Minor②） ====================

describe('check-maturity CLI：--rollback-approved 单独给出（无 --prev-status）→ 非阻断诊断', () => {
  const DIAGNOSTIC = '--rollback-approved 已置位但未提供 --prev-status：R7 场景 5 回退转移判定未生效';

  it('单独置位 → exit 0 + 诊断显式登记（堵「置位即以为生效」隐性规避通道）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const r = runSync(process.execPath, [
      tsxCli,
      path.join(cliDir, 'check-maturity.ts'),
      maturity,
      '--rollback-approved',
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(DIAGNOSTIC);
  });

  it('未置位 → 不出该诊断（零回归守卫）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturity]);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(DIAGNOSTIC);
  });
});

// ==================== R5 三态补强（G2-1） ====================

/**
 * 补三条廉价断言（live-run-findings Task 4 延后项，G2-1）：
 *   1. diagnostics 通道透传——含 `--json` 机器通道（此前只断言人类可读段与 MATURITY_JSON 摘要）；
 *   2. `operationalFailureModes: []`（空标注）→ 不计次；
 *   3. 重复值形态的计数口径。实现为「存在即累加数组长度」（`cli/check-maturity.ts:99-106`），
 *      「每条记录内同一取值至多出现一次」由 `run-log.schema.json` 的 `uniqueItems` 前置强制
 *      （重复值记录 schema 不合法，不进入合规 run-log）——故计数层不去重，断言按实现口径写。
 */
describe('R5 三态补强（G2-1）', () => {
  it('R5 诊断经 --json 输出透传（diagnostics 通道）', async () => {
    // 逻辑层：diagnostics 由 options 注入后逐字回传（通道名以 maturity-logic.ts 现状为准）
    const logic = checkMaturity(mkMaturity(3), {
      operationalFailureCount: 0,
      diagnostics: ['R5 未生效：未提供 --run-log'],
    });
    expect(logic.diagnostics).toContain('R5 未生效：未提供 --run-log');
    // CLI 层：--json 单行报告透传 diagnostics（非阻断，passed 仍为 true）
    const maturity = await write('maturity.json', VALID_MATURITY);
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturity, '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse((r.stdout ?? '').trim()) as {
      passed: boolean;
      diagnostics?: string[];
    };
    expect(parsed.passed).toBe(true);
    expect(parsed.diagnostics).toContain('R5 未生效：未提供 --run-log（O 系列失败模式未校验）');
  });
});

// ==================== R5 读路径枚举守卫（G3-18，任务 4 审查增补） ====================

/**
 * 上批延后项「R5 计数不校验 enum/uniqueItems（schema 声明与读取路径不同门）」：schema 只管写入侧，
 * CLI 直读 run-log.jsonl 无 schema 前置校验，故读取路径再过滤一次非 O1~O6 取值并出非阻断诊断。
 * **语义边界（不得越界）**：`uniqueItems` 与「存在即累加数组长度」口径不变——`['O3','O3']` 仍计 2
 * （由上方 G2-1 用例锁定），本守卫只处理非 enum 取值（如 `'O9'`、拼写错误、非字符串）。
 */
describe('R5 读路径枚举守卫（G3-18）', () => {
  it("非 enum 取值 ['O9'] → 计数 0（不计入 R5 判定）+ 诊断行含「非 O1~O6」", () => {
    const rows = [mkEntry({ operationalFailureModes: ['O9'] })];
    const summary = summarizeOperationalFailures(rows);
    expect(summary).toEqual({ count: 0, ignoredCount: 1 });
    expect(countOperationalFailures(rows)).toBe(0); // 越界取值不进 R5 判定
    // 诊断经 buildR5Diagnostics 第三参并入（CLI 与 self-test 共用同一文案源），非阻断
    const diagnostics = buildR5Diagnostics(true, [], summary.ignoredCount);
    expect(diagnostics.some((d) => d.includes('非 O1~O6'))).toBe(true);
    expect(diagnostics).toContain('1 项非 O1~O6 取值已忽略（schema 应拒绝；读取路径防御）');
    // R5 判定不受影响：命中数 0 < streak 3 → passed（非阻断）
    const r = checkMaturity(mkMaturity(3), {
      operationalFailureCount: summary.count,
      diagnostics,
    });
    expect(r.passed).toBe(true);
    expect(r.diagnostics).toContain('1 项非 O1~O6 取值已忽略（schema 应拒绝；读取路径防御）');
  });

  it("拼写错误 / 非字符串取值同样被过滤（'O7' / 'o3' / 7 / null），合法值照常累加", () => {
    const rows = [
      mkEntry({ operationalFailureModes: ['O1', 'O7'] }),
      mkEntry({ operationalFailureModes: ['o3'] }),
      mkEntry({ operationalFailureModes: [7] }),
      mkEntry({ operationalFailureModes: [null, 'O6'] }),
    ];
    expect(summarizeOperationalFailures(rows)).toEqual({
      count: 2,
      ignoredCount: 4,
    });
  });

  it("锁定 schema 语义未被本守卫改变：['O3','O3'] → 计数 2（长度口径，不去重）+ 零诊断", () => {
    const rows = [mkEntry({ operationalFailureModes: ['O3', 'O3'] })];
    expect(countOperationalFailures(rows)).toBe(2); // 与 G2-1 已绿用例同口径（不得改为去重计数）
    expect(summarizeOperationalFailures(rows)).toEqual({
      count: 2,
      ignoredCount: 0,
    });
    expect(buildR5Diagnostics(true, [], 0)).toEqual([]); // 无越界取值 → 零输出
  });

  it('CLI 端到端：run-log 含非 enum 取值 → exit 0 + 诊断（schema 非法输入在读取路径被防御）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    // 该行 schema 不合法（O9 不在 enum 内），但 CLI 直读 JSONL 无 schema 前置校验 → 走读取路径守卫
    const rows = [runLogEntry('p1-G-non-enum', { operationalFailureModes: ['O9'] })].join('\n');
    const runLog = await write('run-log.jsonl', rows);
    const r = runSync(process.execPath, [
      tsxCli,
      path.join(cliDir, 'check-maturity.ts'),
      maturity,
      `--run-log=${runLog}`,
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('1 项非 O1~O6 取值已忽略（schema 应拒绝；读取路径防御）');
    expect(maturitySummary(r.stdout ?? '')['passed']).toBe(true);
  });
});

// ==================== A14：project.status 转移合法性（R7，43.1.0） ====================
describe('A14：project.status 转移合法性校验（judge 单点 + checkMaturity R7 接线）', () => {
  it('A14a：project.status 非法转移（如 需求分析→编码）→ 违规', () => {
    // R7 接线：prev + current 同时提供时执行转移校验；跳步前移（需求分析→编码）非法
    const r = checkMaturity(validMaturity(), {
      projectStatus: '编码',
      prevProjectStatus: '需求分析',
    });
    expect(r.passed, '需求分析→编码（跳 4 级）须违规').toBe(false);
    expect(
      r.violations.some((v) => v.includes('R7') && v.includes('需求分析') && v.includes('编码')),
      '违规须点名 R7 与前后状态',
    ).toBe(true);

    // judge 判据口径：合法 = 前向链下一步 ∪ 场景 5 用户批准回退 ∪ 终态「项目完成」
    expect(judgeProjectStatusTransition('需求分析', '系统设计').legal, '前向链下一步合法').toBe(true);
    expect(judgeProjectStatusTransition('验收测试', '项目完成').legal, '进入终态「项目完成」合法').toBe(true);
    expect(
      judgeProjectStatusTransition('系统设计', '需求分析', { userApprovedRollback: true }).legal,
      '场景 5 用户批准回退合法',
    ).toBe(true);
    expect(judgeProjectStatusTransition('系统设计', '需求分析').legal, '无用户批准的回退非法').toBe(false);
    expect(judgeProjectStatusTransition('项目完成', '编码').legal, '终态「项目完成」不可迁出').toBe(false);
    expect(judgeProjectStatusTransition('编码', '项目完成').legal, '跳步到终态仍属跳步，非法').toBe(false);
    // 终态单点消费（终审顺手修）：PROJECT_STATUS_COMPLETED 走显式终态分支——迁出仅批准回退合法，
    // 且拒绝理由点名终态（此前依赖「index+1 越界」隐式事实，状态表增补即静默放开）。
    const terminalExit = judgeProjectStatusTransition('项目完成', '验收测试');
    expect(terminalExit.legal, '终态迁出无批准非法').toBe(false);
    expect(terminalExit.reason, '拒绝理由须点名终态（显式终态判据，非回退通用文案）').toContain('不可迁出');
    expect(
      judgeProjectStatusTransition('项目完成', '验收测试', { userApprovedRollback: true }).legal,
      '终态经场景 5 用户批准回退仍合法（既有语义不回归）',
    ).toBe(true);

    // 仅提供 current（无 prev）→ 不做转移判定（无历史可比，不发明历史机制）
    const rNoPrev = checkMaturity(validMaturity(), { projectStatus: '编码' });
    expect(rNoPrev.passed).toBe(true);
    expect(rNoPrev.violations.some((v) => v.includes('R7'))).toBe(false);
  });
});

// ==================== 决策 #2（43.1.0）：降级须 human 授权（R8，批次 7 任务 11） ====================

/**
 * 决策 2（2026-10-07 用户定案）：「除非 human 明确授权否则不允许降级」——降级与升级对称走签名链审批。
 * 让号说明（裁定 R-B7-6）：T9 已占用 R7（project.status 转移校验），本规则编号 **R8**（规则号不回收）。
 *
 * R6 第三判定允许「level 低于 history 末条 to」的降级形态（只锁伪造升级）；R8 把该形态收紧为
 * **须 role=human / targetKind=maturity 审批链**：CLI 装载 `.w-model/signature-chain.jsonl`（与
 * maturity.json 同目录）后经 verifyMaturityApproval 判定，把 ok 注入 `options.maturityApprovalOk`
 * （logic 保持纯函数、不读盘——与 gate-logic.evaluateTlaBddWaiver 同款接缝）。
 * 修复轮 1（R-B7-7）后判定另带 `requireAction='downgrade-approve'`（降级专属绑定，见下方专节）。
 */

/** R8 降级形态 fixture：升级链 L0→L1→L2（链一致）+ level 回落 L0/L1（R6 第三判定允许的合法形态） */
function downgradeMaturity(level: 'L0' | 'L1' = 'L0'): MaturityConfig {
  return {
    ...validMaturity(),
    level,
    leveledUpAt: '2026-08-02T00:00:00Z',
    history: [
      { from: 'L0', to: 'L1', at: '2026-08-01T00:00:00Z', reason: '稳定运行 1 完整周期' },
      { from: 'L1', to: 'L2', at: '2026-08-02T00:00:00Z', reason: '稳定运行 2 完整周期' },
    ],
  };
}

/** R8 human 审批条目构造器（v3 sigHash 真值重算；形态与 gate-logic.test.ts 的 A4 构造器同源） */
function humanMaturityApprovalEntry(over?: {
  artifacts?: string[];
  signedAt?: string;
  /** 审批动作（默认降级专属值；修复轮 1 负例用它注入升级条目的 action） */
  action?: string;
}): SignatureChainEntry {
  const base: Omit<SignatureChainEntry, 'sigHash'> = {
    sigId: 'wm1-r001-human',
    phase: 1,
    role: 'human',
    action: over?.action ?? 'downgrade-approve',
    targetKind: 'maturity',
    runId: 'wm1-r001',
    artifacts: over?.artifacts ?? ['.w-model/maturity.json'],
    prevSigId: 'genesis',
    prevSigHash: '0',
    // 默认晚于链末条 at（2026-08-02T00:00:00Z）——满足「审批不早于最近一次 level 变更」子判定
    signedAt: over?.signedAt ?? '2026-08-03T00:00:00.000Z',
    signer: 'user-wangh',
    inputProvenance: {
      sourceSigIds: [],
      sourceArtifacts: [],
      transformDescription: '用户确认降级（human 审批链）',
    },
    sigHashAlgo: 'v3',
  };
  return { ...base, sigHash: computeSigHash(base) };
}

/** R8 判定口径（与 `cli/check-maturity.ts` 主流程逐字一致：requireAction = 降级专属 action） */
const R8_REQUIRE_ACTION = 'downgrade-approve';

describe('决策2（43.1.0）：降级须 human 授权（R8）', () => {
  it('决策2a：level < 末条 to（降级形态）且无有效 human 审批链 → R8 blocking', () => {
    const m = downgradeMaturity();
    // 零审批链 → verifyMaturityApproval 判定 ok:false（CLI 缺链 / 空链 / 坏链一律注入 false）
    expect(verifyMaturityApproval([], m, { requireAction: R8_REQUIRE_ACTION }).ok, '零审批链判定须为 ok:false').toBe(
      false,
    );
    // 未注入（logic 纯函数默认无授权）→ R8 blocking
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(
      r.violations.some((v) => v.startsWith('R8:') && v.includes('role=human') && v.includes('L2')),
      '违规须点名 R8、human 授权与降级链末条 to',
    ).toBe(true);
    // R6 不报（降级后 level 低于末条属 R6 第三判定合法形态）——R8 是降级的唯一拦截面
    expect(r.violations.some((v) => v.startsWith('R6:'))).toBe(false);
    // 显式注入 false（CLI 装载到坏链 / 签名不符的等价形态）同样 blocking
    const rExplicit = checkMaturity(m, { maturityApprovalOk: false });
    expect(rExplicit.passed).toBe(false);
    expect(rExplicit.violations.some((v) => v.startsWith('R8:'))).toBe(true);
  });

  it('决策2b：降级形态 + 有效审批链（verifyMaturityApproval 通过）→ 零违规', () => {
    const m = downgradeMaturity();
    const verdict = verifyMaturityApproval([humanMaturityApprovalEntry()], m, { requireAction: R8_REQUIRE_ACTION });
    expect(verdict.ok, '降级专属条目（v3 重算 + 绑定 maturity.json + 不早于末条变更）须通过').toBe(true);
    const r = checkMaturity(m, { maturityApprovalOk: verdict.ok });
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('决策2c：升级形态不受 R8 影响（既有 R6 用例零漂移）', () => {
    // 升级形态（末条 to == 当前 level）：未注入审批结果 → 零违规
    const upgraded: MaturityConfig = {
      ...validMaturity(),
      level: 'L2',
      history: [
        { from: 'L0', to: 'L1', at: '2026-08-01T00:00:00Z', reason: '升级 L0→L1' },
        { from: 'L1', to: 'L2', at: '2026-08-02T00:00:00Z', reason: '升级 L1→L2' },
      ],
    };
    expect(checkMaturity(upgraded).passed).toBe(true);
    // 即便显式注入「无审批」（false），升级形态也不触发 R8（R8 只锁降级形态）
    const injected = checkMaturity(upgraded, { maturityApprovalOk: false });
    expect(injected.passed).toBe(true);
    expect(injected.violations.some((v) => v.startsWith('R8:'))).toBe(false);
  });
});

// ==================== 修复轮 1（R-B7-7）：R8 授权降级专属绑定 ====================

/**
 * 修复轮 1 安全审查实跑复现的绕过：R8 此前只要求链中存在任意一条
 * `role=human ∧ targetKind=maturity ∧ v3 重算通过 ∧ artifacts 含 maturity.json ∧
 * signedAt ≥ history 末条 at` 的条目，**没有任何字段把条目绑定到「本次降级」**。
 * 而按 operational-recovery.md 的固定流程，**每次升级**都会落这样一条人签条目（其 signedAt
 * 必然 ≥ 末条 history `at`）——于是「升级审批」条目天然满足 R8：
 * `level=L0 < last.to=L2` + 仅一条 `action='approve'`（真实升级样本口径）/ `'upgrade-approve'`
 * 的升级条目 → check-maturity exit 0（复现记录见任务 11 报告）。
 *
 * 控制者裁定 R-B7-7：授权须**降级专属绑定**——`verifyMaturityApproval` 增可选
 * `requireAction`（提供时 action 须严格相等），check-maturity R8 传 `'downgrade-approve'`。
 */
describe("修复轮 1（R-B7-7）：R8 授权降级专属绑定（requireAction='downgrade-approve'）", () => {
  it("负例：升级审批条目（action='approve' / 'upgrade-approve'）**不**满足 R8 → blocking", () => {
    const m = downgradeMaturity();
    for (const upgradeAction of ['approve', 'upgrade-approve'] as const) {
      // 条目其余字段（role/targetKind/sigHash/artifacts/signedAt）全部满足旧判据——只有 action 不是降级专属值
      const chain = [humanMaturityApprovalEntry({ action: upgradeAction })];
      expect(
        verifyMaturityApproval(chain, m, { requireAction: R8_REQUIRE_ACTION }).ok,
        `升级条目 action=${upgradeAction} 不得构成降级授权`,
      ).toBe(false);
      const r = checkMaturity(m, { maturityApprovalOk: false });
      expect(r.passed, `升级条目 action=${upgradeAction} 下 checkMaturity 须 blocking`).toBe(false);
      expect(r.violations.some((v) => v.startsWith('R8:'))).toBe(true);
    }
    // 拒绝理由点名降级专属 action（审计可分辨「缺条目」与「条目非降级专属」）
    const verdict = verifyMaturityApproval([humanMaturityApprovalEntry({ action: 'upgrade-approve' })], m, {
      requireAction: R8_REQUIRE_ACTION,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain(R8_REQUIRE_ACTION);
  });

  it("正例：降级专属条目（action='downgrade-approve'）→ R8 零违规（与决策2b 同形）", () => {
    const m = downgradeMaturity();
    const chain = [humanMaturityApprovalEntry()];
    expect(chain[0]!.action).toBe(R8_REQUIRE_ACTION);
    const verdict = verifyMaturityApproval(chain, m, { requireAction: R8_REQUIRE_ACTION });
    expect(verdict.ok).toBe(true);
    expect(checkMaturity(m, { maturityApprovalOk: verdict.ok }).violations).toHaveLength(0);
  });

  it('零漂移：不传 requireAction 时口径不变——升级审批条目仍通过（check-artifact-gate 既有豁免消费）', () => {
    const m = downgradeMaturity();
    for (const upgradeAction of ['approve', 'upgrade-approve'] as const) {
      expect(
        verifyMaturityApproval([humanMaturityApprovalEntry({ action: upgradeAction })], m),
        `不传 requireAction 时 action=${upgradeAction} 与既有口径一致（gate 豁免消费零漂移）`,
      ).toEqual({ ok: true });
    }
    // 旧口径的拒绝面不变（坏签 / 非 human / 未绑定 maturity.json / 早签）
    expect(verifyMaturityApproval([], m).ok).toBe(false);
  });
});

// ==================== 修复轮 1：签名链装载容错（非对象行） ====================

/**
 * 修复轮 1 次要 1：loader 此前只跳过 JSON 解析失败的行；**合法 JSON 但非对象**的整行
 * （整行 `null`）会进 entries → `signature-chain-logic` 读 `e.role` 抛 TypeError →
 * exit 2 `[UNEXPECTED]`（审查者实跑复现；同一缺陷 check-artifact-gate 的 loader 亦然）。
 * 修后非对象行跳过：判定收敛到本有的「无有效授权」fail-closed（降级 → R8 blocking exit 1）。
 */
describe('修复轮 1：签名链装载容错（合法 JSON 非对象行跳过，不 crash）', () => {
  it('CLI 端到端：链含 null / 数组 / 坏行 + 一条合法降级条目 → 非对象行跳过、合法条目仍生效 → exit 0', async () => {
    const validRaw = await fs.readFile(path.join(cliDir, '../samples/maturity/with-approval/maturity.json'), 'utf-8');
    const maturityFile = await write('.w-model/maturity.json', validRaw);
    const chain =
      ['null', '[]', '42', '"scalar"', '{bad json', JSON.stringify(humanMaturityApprovalEntry())].join('\n') + '\n';
    await write('.w-model/signature-chain.jsonl', chain);
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturityFile]);
    expect(r.status, `非对象行须跳过而合法条目生效 → exit 0；stdout=${r.stdout}`).toBe(0);
    expect(maturitySummary(r.stdout ?? '')['passed']).toBe(true);
  });

  it('CLI 端到端：链**只有** null 行 → 跳过为空链 → R8 blocking（exit 1，非 [UNEXPECTED] exit 2）', async () => {
    const validRaw = await fs.readFile(path.join(cliDir, '../samples/maturity/with-approval/maturity.json'), 'utf-8');
    const maturityFile = await write('.w-model/maturity.json', validRaw);
    await write('.w-model/signature-chain.jsonl', 'null\n');
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturityFile]);
    expect(r.status, `null 行不得 crash 为 exit 2；stdout=${r.stdout}`).toBe(1);
    expect(r.stdout).toContain('R8:');
    expect(r.stdout).not.toContain('UNEXPECTED');
    expect(maturitySummary(r.stdout ?? '')['passed']).toBe(false);
  });
});

// ==================== check-maturity CLI：R8 装载签名链 ====================

describe('check-maturity CLI：R8 装载签名链（真实子进程 + maturity.json 同目录 signature-chain.jsonl）', () => {
  const samplesDir = path.resolve(cliDir, '../samples');
  const checkMaturityCli = path.join(cliDir, 'check-maturity.ts');

  it('CLI 端到端：降级形态无链 → exit 1 + R8；样本目录（maturity.json + 同名目录签名链）→ exit 0', async () => {
    // (1) 无链（samples/maturity/ 无 signature-chain.jsonl）：装载 → 空链 → R8 blocking
    const noChain = runSync(process.execPath, [
      tsxCli,
      checkMaturityCli,
      path.join(samplesDir, 'maturity', 'bad-downgrade-without-approval.json'),
    ]);
    expect(noChain.status, `无链降级须 exit 1；stdout=${noChain.stdout}`).toBe(1);
    expect(noChain.stdout).toContain('R8:');
    expect(maturitySummary(noChain.stdout ?? '')['passed']).toBe(false);

    // (2) 正向样本目录自洽：samples/maturity/with-approval/ 内 maturity.json + signature-chain.jsonl
    //     （真实 v3 sigHash、action='downgrade-approve'）——CLI 直接在该目录跑通（名与实相符）
    const sampleDir = runSync(process.execPath, [
      tsxCli,
      checkMaturityCli,
      path.join(samplesDir, 'maturity', 'with-approval', 'maturity.json'),
    ]);
    expect(sampleDir.status, `样本目录须自洽 exit 0；stdout=${sampleDir.stdout}`).toBe(0);
    expect(maturitySummary(sampleDir.stdout ?? '')['passed']).toBe(true);
    expect(sampleDir.stdout).not.toContain('R8:');
    expect(sampleDir.stdout).toContain('（条目 1）');

    // (3) 真机部署形态：正向样本复制到临时 .w-model/ + 同目录落降级审批条目（绑定 maturity.json）→ exit 0
    const validRaw = await fs.readFile(path.join(samplesDir, 'maturity', 'with-approval', 'maturity.json'), 'utf-8');
    const maturityFile = await write('.w-model/maturity.json', validRaw);
    await write('.w-model/signature-chain.jsonl', JSON.stringify(humanMaturityApprovalEntry()) + '\n');
    const withChain = runSync(process.execPath, [tsxCli, checkMaturityCli, maturityFile]);
    expect(withChain.status, `配链降级须 exit 0；stdout=${withChain.stdout}`).toBe(0);
    expect(maturitySummary(withChain.stdout ?? '')['passed']).toBe(true);
    expect(withChain.stdout).not.toContain('R8:');

    // (4) 修复轮 1 复现钉死（CLI 级）：链中只放升级审批条目（action='upgrade-approve'，
    //     sigHash 按 v3 真值重算、其余字段全部满足旧判据）→ 降级形态必须 blocking（exit 1 + R8）
    const bypassFile = await write('.w-model-bypass/maturity.json', validRaw);
    await write(
      '.w-model-bypass/signature-chain.jsonl',
      JSON.stringify(humanMaturityApprovalEntry({ action: 'upgrade-approve' })) + '\n',
    );
    const bypass = runSync(process.execPath, [tsxCli, checkMaturityCli, bypassFile]);
    expect(bypass.status, `升级审批条目不得洗白降级（修复轮 1 复现场景）→ exit 1；stdout=${bypass.stdout}`).toBe(1);
    expect(bypass.stdout).toContain('R8:');
    expect(maturitySummary(bypass.stdout ?? '')['passed']).toBe(false);
  });
});
