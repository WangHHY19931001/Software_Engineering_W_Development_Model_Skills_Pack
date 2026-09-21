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
 *   - exit 0：未提供 --run-log → R6/R5-b 整体跳过（与新增前行为一字不变）
 *   - exit 0 + stderr「R6 未生效」：提供了 --run-log 但 Σtokens=0（跳过不等于通过）
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

  it('exit 0：--run-log 无有效 tokens（Σtokens=0）→ 跳过但显式告警「R6 未生效」', async () => {
    const runLog = await writeRunLog(['{"phase":5,"action":"gate","role":"G","outcome":"success"}']);
    const r = runCli([BUDGET_SAMPLE, `--run-log=${runLog}`, '--phase=5']);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('R6 未生效');
  });
});
