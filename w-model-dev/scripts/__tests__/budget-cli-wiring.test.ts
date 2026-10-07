/* eslint-disable security/detect-non-literal-fs-filename -- 夹具写在 os.tmpdir() 的 mkdtemp 临时目录内（仓库零写入）；CLI 路径为仓库受控常量 */
/**
 * budget CLI 接线回归锁定（修复分支遗留收口②，superpowers 替换批次 4）。
 *
 * 缺口来源（修复分支最终评审 Important #2）：`check-budget.ts` 的 R6 用量实效（D-4b）
 * 全靠 CLI 侧把 `sumTokens(run-log)` 的结果经 `options.tokensUsed` 递给纯函数；而既有单测
 * （budget-logic.test.ts）直调纯函数、cli-arg-unification/project-read-validation 走的是
 * 不传 `--run-log` 的路径——**把 CLI 里的 `tokensUsed` 传参整行删掉，全量单测仍然全绿**，
 * R6 会在真实门禁里静默失效（perPhase.maxTokens / project.maxTokensTotal 形同虚设）。
 * 本文件用真实子进程把整条接线钉住：删传参 / 改 `--run-log` 解析 → 用例立刻红。
 *
 * 覆盖：
 *   - exit 1：--run-log 含有效 tokens 且阶段累计 > perPhase.maxTokens → stdout 出现 `R6：` 文案
 *   - exit 0：未提供 --run-log → R6/R5-b 整体跳过（与新增前行为一字不变）**且输出未接线诊断**
 *     （D-5②：省略 --run-log 不再等于静默跳过；判据与退出码一字不变，只加非阻断诊断）
 *   - exit 0 + stderr「R6 未生效」：提供了 --run-log 但 Σtokens=0（跳过不等于通过）
 *   - exit 0：同 (timestamp, tokens, duration_s) 多行 → 「疑似重复归账」上界口径诊断（不改退出码）
 *   - --json：未接线诊断进入机器可读摘要（diagnostics 键，非阻断，键仅在非空时出现）
 *   - R7（决策 5，43.2.0）：阶段 ΣsubagentSpawns 超 perPhase.maxSubagentSpawns → exit 1 且含 `R7：`；
 *     estimated=true 记录不计入（删排除即红）；未提供 --phase 时跳过可见化
 *
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'w-model-dev/scripts/cli/check-budget.ts');
// 样本 perPhase.maxTokens=200000 / project.maxTokensTotal=2000000 / budgetBurnRate=0.9
const BUDGET_SAMPLE = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/budget/valid.json');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-budget-cli-r6-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function runCli(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = runSync(process.execPath, [tsxCli, CLI, ...args], { cwd: REPO_ROOT, timeout: 60_000 });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function writeRunLog(lines: string[]): Promise<string> {
  const file = path.join(tmpDir, 'run-log.jsonl');
  await fs.writeFile(file, `${lines.join('\n')}\n`, 'utf-8');
  return file;
}

describe('check-budget CLI R6 用量实效接线（D-4b）', () => {
  it('exit 1：--run-log 阶段 Σtokens 超 perPhase.maxTokens → stdout 出现 R6 文案', async () => {
    const runLog = await writeRunLog([
      '{"phase":5,"action":"gate","role":"G","outcome":"success","tokens":120000}',
      '{"phase":5,"action":"gate","role":"G","outcome":"success","tokens":130000}',
    ]);
    const r = runCli([BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=5']);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('R6：阶段 tokens 250000 > perPhase.maxTokens 200000');
  });

  it('exit 0：未提供 --run-log → R6/R5-b 整体跳过（不接线也不误报）', () => {
    const r = runCli([BUDGET_SAMPLE, '--phase=5']);
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain('R6：');
  });

  it('诊断行（3 态逐条：Σtokens=0 告警「R6 未生效」/ 未提供 run-log 未接线诊断 / 重复归账上界口径诊断）→ exit 0 不改判据', async () => {
    const dup = (runId: string): string =>
      `{"runId":"${runId}","timestamp":"2026-09-19T04:01:00Z","phase":1,"action":"r3-completeness","role":"R","duration_s":30,"tokens":1000,"outcome":"success"}`;
    type CliResult = ReturnType<typeof runCli>;
    const rows: Array<{ name: string; args: () => Promise<string[]>; check: (r: CliResult) => void }> = [
      {
        name: 'Σtokens=0：跳过但显式告警「R6 未生效」（跳过不等于通过）',
        args: async () => {
          const runLog = await writeRunLog(['{"phase":5,"action":"gate","role":"G","outcome":"success"}']);
          return [BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=5'];
        },
        check: (r) => {
          expect(r.code, 'Σtokens=0 行退出码 0').toBe(0);
          expect(r.stderr, 'Σtokens=0 行 stderr 告警「R6 未生效」').toContain('R6 未生效');
        },
      },
      {
        name: '未提供 --run-log：非阻断诊断「R6/R5-b 未生效（未提供 run-log）」',
        args: async () => [BUDGET_SAMPLE, '--phase=8'],
        check: (r) => {
          expect(r.code, '未提供行退出码 0').toBe(0);
          expect(r.stdout + r.stderr, '未提供行应出未接线诊断').toMatch(/R6\/R5-b 未生效（未提供 run-log）/);
        },
      },
      {
        name: '同 (timestamp+tokens+duration_s) 多行：「疑似重复归账」上界口径诊断，退出码不变',
        args: async () => {
          // 3 条同键记录 = 1 组（1000×3 仍远低于样本上限 → 只出诊断，不改退出码）
          const runLog = await writeRunLog([dup('r3-a'), dup('r3-b'), dup('r3-c')]);
          return [BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=1'];
        },
        check: (r) => {
          expect(r.code, '重复归账行退出码 0（诊断不改判据）').toBe(0);
          expect(r.stdout + r.stderr, '重复归账行应报「疑似重复归账 1 组」').toMatch(/疑似重复归账 1 组/);
          expect(r.stdout + r.stderr, '重复归账行应报「Σtokens 为上界口径」').toMatch(/Σtokens 为上界口径/);
        },
      },
    ];
    for (const row of rows) {
      const args = await row.args();
      const r = runCli(args);
      row.check(r);
    }
  }, 180_000);
});

/**
 * R7 子代理分派数实效的 CLI 接线锁定（决策 5，43.2.0）——与 R6 同款缺口形态：判定在纯函数、
 * 聚合在 CLI，若把 `sumSubagentSpawns(...)` 的传参或 `estimated` 排除删掉，本组用例立刻红。
 * 样本 `valid.json` 的 perPhase.maxSubagentSpawns=10（A5 删除前的原值，43.2.0 回归）。
 */
describe('check-budget CLI R7 子代理分派数接线（决策 5，43.2.0）', () => {
  it('exit 1：--run-log 阶段 ΣsubagentSpawns 超 perPhase.maxSubagentSpawns → stdout 出现 R7 文案', async () => {
    const spawn = (n: number, phase = 5): string =>
      `{"phase":${phase},"action":"gate","role":"G","outcome":"success","tokens":0,"duration_s":1,"subagentSpawns":${n}}`;
    // 样本上限 10：同阶段 8+4=12 > 10 → blocking；异阶段 9 不计入（按阶段聚合）
    const runLog = await writeRunLog([spawn(8), spawn(4), spawn(9, 6)]);
    const r = runCli([BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=5']);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('R7：阶段子代理分派数 12 > perPhase.maxSubagentSpawns 10');
  });

  it('exit 0：Σ 未超限（含恰等于上限）；--phase 缺省时 R7 跳过但出可见化警告', async () => {
    const spawn = (n: number): string =>
      `{"phase":5,"action":"gate","role":"G","outcome":"success","tokens":0,"duration_s":1,"subagentSpawns":${n}}`;
    const under = await writeRunLog([spawn(6), spawn(4)]); // 恰等于上限 10 → 严格 > 不触发
    const rUnder = runCli([BUDGET_SAMPLE, `--run-log=${under}`, '--phase=5']);
    expect(rUnder.code).toBe(0);
    expect(rUnder.stdout).not.toContain('R7：');

    const noPhase = await writeRunLog([spawn(999)]);
    const rNoPhase = runCli([BUDGET_SAMPLE, `--run-log=${noPhase}`]);
    expect(rNoPhase.code).toBe(0);
    expect(rNoPhase.stdout, '未提供 --phase：R7 不触发（按阶段口径无定义）').not.toContain('R7：');
    expect(rNoPhase.stdout + rNoPhase.stderr, '跳过必须可见').toMatch(/R7 未校验：未提供 --phase/);
  });

  it('exit 0：estimated=true 记录不计入聚合（决策 5 裁定）——估算值不得占用分派额度', async () => {
    const est = (n: number, estimated: boolean): string =>
      `{"phase":7,"action":"gate","role":"G","outcome":"success","tokens":0,"duration_s":1,"subagentSpawns":${n},"estimated":${estimated}}`;
    // 20(estimated=true, 不计入) + 6(estimated=false, 计入) = 6 ≤ 10 → 通过；
    // 若把 estimated 排除删掉，20+6=26 > 10 → 退出码 1，用例即红（接线钉死）
    const runLog = await writeRunLog([est(20, true), est(6, false)]);
    const r = runCli([BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=7']);
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain('R7：');
    expect(r.stdout, '人类可读摘要应显示 R7 聚合值（6，不含 estimated）').toMatch(/spawns=阶段 6/);
  });

  it('未提供 --run-log → R7 未接线诊断可见（与 R6/R5-b 诊断并存，不改退出码）', () => {
    const r = runCli([BUDGET_SAMPLE, '--phase=5']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('R6/R5-b 未生效（未提供 run-log）');
    expect(r.stdout, 'R7 同样跳过且可见').toMatch(/R7 未生效（未提供 run-log）/);
  });
});

describe('check-budget CLI 未接线可见化与上界口径诊断（D-5② / N-6）', () => {
  it('exit 0：无重复归账（键互异）→ 不出现「疑似重复归账」诊断', async () => {
    const runLog = await writeRunLog([
      '{"runId":"a","timestamp":"2026-09-19T04:01:00Z","phase":1,"action":"gate","role":"G","duration_s":30,"tokens":1000,"outcome":"success"}',
      '{"runId":"b","timestamp":"2026-09-19T04:02:00Z","phase":1,"action":"gate","role":"G","duration_s":31,"tokens":1000,"outcome":"success"}',
    ]);
    const r = runCli([BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=1']);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).not.toMatch(/疑似重复归账/);
  });

  it('--json：未接线诊断进入机器可读摘要（diagnostics 键，exitCode 仍为 0）', () => {
    const r = runCli([BUDGET_SAMPLE, '--phase=8', '--json']);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout.trim()) as { diagnostics?: string[]; exitCode: number };
    expect(report.exitCode).toBe(0);
    expect((report.diagnostics ?? []).some((d) => d.includes('R6/R5-b 未生效（未提供 run-log）'))).toBe(true);
  });
});
