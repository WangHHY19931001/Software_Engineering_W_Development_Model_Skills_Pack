/**
 * metrics-report.ts CLI 层单元测试（子进程模式）
 *
 * 覆盖：正常人类可读 9 节 / --json 结构 / run-log 缺失(exit 2) / --phase 非法值系列(exit 2) /
 *       budget 缺失降级(null) / budget 非法(exit 2) / --json --out 组合（stdout 纯净 + 文件写入）/
 *       空 run-log 预警 / run-log 坏行跳过。
 *
 * 子进程说明：CLI 脚本 main() 顶层执行并调用 process.exit，无法直接 import 测试；
 * 采用 spawnSync(process.execPath, [tsx/cli, 脚本, ...]) 运行真实进程断言退出码与输出。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/metrics-report.ts');

const RUN_LOG_JSONL =
  '{"phase":1,"action":"produce","role":"S","outcome":"success","tokens":100,"duration_s":10,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T01:00:00Z"}\n' +
  '{"phase":1,"action":"rework","role":"S","outcome":"rework","tokens":50,"duration_s":5,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T02:00:00Z"}\n' +
  '{"phase":2,"action":"gate","role":"G","outcome":"success","tokens":30,"duration_s":3,"subagentSpawns":1,"gateExitCode":0,"timestamp":"2026-08-06T01:00:00Z"}\n';
const BUDGET_JSON =
  '{"projectId":"smoke","project":{"maxTokensTotal":10000},"perPhase":{"maxTokens":1000},"killSwitch":{"consecutiveReworks":3,"budgetBurnRate":0.9},"onExceed":"pause"}';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-metrics-cli-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** 写 .w-model 下文件（自动建目录） */
async function writeWModel(rel: string, content: string): Promise<string> {
  const p = path.join(tmpDir, '.w-model', rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
  return p;
}

/** 运行 metrics-report 子进程 */
function run(...args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, SCRIPT, tmpDir, ...args], { encoding: 'utf-8' });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('metrics-report CLI（正常路径）', () => {
  it('完整夹具人类可读输出：9 节齐全 + METRICS_JSON 标记，exit 0', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    await writeWModel('budget.json', BUDGET_JSON);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('总体          :');
    expect(r.stdout).toContain('阶段汇总');
    expect(r.stdout).toContain('动作分布');
    expect(r.stdout).toContain('角色分布');
    expect(r.stdout).toContain('结果分布');
    expect(r.stdout).toContain('门禁通过率');
    expect(r.stdout).toContain('返工连续段');
    expect(r.stdout).toContain('预算          :');
    // 「预警」节为条件渲染（本夹具无预警不打印），由「空 run-log」用例覆盖
    expect(r.stdout).toContain('METRICS_JSON ');
  });

  it('--json 输出单行完整 MetricsReport，budget 区非 null', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    await writeWModel('budget.json', BUDGET_JSON);
    const r = run('--json');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      meta: { recordCount: number };
      overall: { totalRecords: number; totalTokens: number; reworkRecords: number };
      byPhase: unknown[];
      byAction: Record<string, number>;
      gate: { total: number; passed: number };
      budget: { totalTokens: number; maxTokensTotal: number; onExceed: string } | null;
      warnings: unknown[];
    };
    expect(parsed.meta.recordCount).toBe(3);
    expect(parsed.overall.totalRecords).toBe(3);
    expect(parsed.overall.totalTokens).toBe(180);
    expect(parsed.overall.reworkRecords).toBe(1);
    expect(parsed.byPhase).toHaveLength(2);
    expect(parsed.byAction).toMatchObject({ produce: 1, rework: 1, gate: 1 });
    expect(parsed.gate).toMatchObject({ total: 1, passed: 1 });
    expect(parsed.budget).toMatchObject({ totalTokens: 180, maxTokensTotal: 10000, onExceed: 'pause' });
  });
});

describe('metrics-report CLI（异常分支）', () => {
  it('run-log.jsonl 缺失 → exit 2，提示文件不存在', async () => {
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('文件不存在');
  });

  it('--phase=99（越界）→ exit 2', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--phase=99');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--phase 参数非法');
  });

  it('--phase=1.5（非整数）→ exit 2', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--phase=1.5');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--phase 参数非法');
  });

  it('--phase=abc（非数字）→ exit 2', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--phase=abc');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--phase 参数非法');
  });

  it('--phase=（空值，Number("")=0 → 非法）→ exit 2', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--phase=');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--phase 参数非法');
  });

  it('budget.json 非法 JSON → exit 2', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    await writeWModel('budget.json', '{bad');
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('文件解析失败');
  });
});

describe('metrics-report CLI（边界与降级）', () => {
  it('budget.json 缺失 → exit 0，人类可读「未提供」，--json 的 budget 为 null', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('未提供（.w-model/budget.json 缺失）');
    const rj = run('--json');
    const parsed = JSON.parse(rj.stdout) as { budget: unknown; warnings: string[] };
    expect(parsed.budget).toBeNull();
    expect(parsed.warnings).toContain('budget.json 缺失：预算度量区为 null（仅统计 run-log）');
  });

  it('空 run-log（0 条记录）→ exit 0，预警「run-log 为空」', async () => {
    await writeWModel('run-log.jsonl', '');
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('run-log 为空');
  });

  it('run-log.jsonl 含坏行 → exit 0，坏行跳过（stderr 警告，记录数正确）', async () => {
    await writeWModel('run-log.jsonl', '{"phase":1,"action":"produce","role":"S","outcome":"success","tokens":100}\n{broken json line}\n');
    const r = run('--json');
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('非合法 JSON');
    const parsed = JSON.parse(r.stdout) as { overall: { totalRecords: number } };
    expect(parsed.overall.totalRecords).toBe(1);
  });

  it('--json --out 组合：stdout 为单行纯净 JSON（确认行走 stderr），文件写入成功', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    await writeWModel('budget.json', BUDGET_JSON);
    const outFile = path.join(tmpDir, 'report.json');
    const r = run('--json', `--out=${outFile}`);
    expect(r.code).toBe(0);
    // stdout 必须可整体 JSON.parse（不含「已写入」确认行）
    const parsed = JSON.parse(r.stdout) as { meta: { recordCount: number } };
    expect(parsed.meta.recordCount).toBe(3);
    expect(r.stderr).toContain('度量报告已写入');
    // 文件已写出且内容合法
    const written = JSON.parse(await fs.readFile(outFile, 'utf-8')) as { meta: { recordCount: number } };
    expect(written.meta.recordCount).toBe(3);
  });

  it('--phase 过滤生效：--phase=1 仅含阶段 1 记录', async () => {
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--json', '--phase=1');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as { overall: { totalRecords: number }; byPhase: Array<{ phase: number }> };
    expect(parsed.overall.totalRecords).toBe(2);
    expect(parsed.byPhase).toHaveLength(1);
    expect(parsed.byPhase[0]!.phase).toBe(1);
  });
});
