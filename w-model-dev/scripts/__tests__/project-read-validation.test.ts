/**
 * project.json 读取侧 schema 校验统一测试（F-G4-14，audit-fixes task 6）
 *
 * 覆盖三处 project.json 读取入口（check-budget / check-maturity / wm-status）统一走
 * loadAndValidate(file, 'project') 后的 fail-closed 语义：
 *   - 缺必填字段（原 warn-and-skip exit 0）→ STRUCTURE_INVALID exit 2（RED 反转证据）
 *   - 合法 project → 正常业务路径（budget R1 / maturity R3/R4 使用字段值）
 *   -「合法 project + 缺 updatedAt」场景已被 schema required 前置排除，不可能再出现
 *
 * 子进程说明：CLI 脚本 main() 顶层执行并设置 process.exitCode，无法直接 import 测试；
 * 采用 runSync(process.execPath, [tsx/cli, 脚本, ...]) 运行真实进程断言退出码与输出。
 * budget/maturity 主输入形状照抄 samples/budget/valid.json 与 samples/maturity/valid.json
 * （不新增样本，避免 samples 覆盖矩阵联动）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli');

/** 合法 project.json（project.schema.json 全 required 字段齐备） */
const VALID_PROJECT =
  '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';

/** 合法 budget.json（形状照抄 samples/budget/valid.json） */
const VALID_BUDGET =
  '{"schemaVersion":"1.0","projectId":"smoke","createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-23T18:00:00Z","perPhase":{"maxTokens":200000,"maxSubagentSpawns":10,"maxReworkRounds":3},"project":{"maxTokensTotal":2000000,"maxTokensPerSession":500000},"onExceed":"pause","killSwitch":{"consecutiveReworks":3,"budgetBurnRate":0.9,"tlaReworks":3}}';

/** 合法 maturity.json（形状照抄 samples/maturity/valid.json） */
const VALID_MATURITY =
  '{"schemaVersion":"1.0","projectId":"smoke","level":"L1","leveledUpAt":"2026-07-23T18:00:00Z","unlockConditions":{"stableDays":30,"completedCycles":3,"attemptCapRate":0.85,"misjudgeRate":0.05,"operationalFailures":0},"history":[{"at":"2026-07-23T18:00:00Z","from":"L0","to":"L1","reason":"3 阶段稳定完成"}],"downgradeTriggers":{"operationalFailureStreak":3,"budgetBurnRateExceeded":3,"checkpointRejectionStreak":2,"userRequested":false}}';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-read-validation-'));
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

function runCli(script: string, args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = runSync(process.execPath, [tsxCli, path.join(cliDir, script), ...args]);
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('project.json 读取侧 schema 校验（F-G4-14：三入口统一 fail-closed）', () => {
  it('check-budget：--project 缺必填字段（无 updatedAt）→ exit 2 STRUCTURE_INVALID（原 warn-and-skip exit 0 场景反转）', async () => {
    const budget = await write('budget.json', VALID_BUDGET);
    const project = await write('project.json', '{"id":"smoke","name":"Smoke"}');
    const r = runCli('check-budget.ts', [budget, `--project=${project}`]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('STRUCTURE_INVALID');
    expect(r.stdout).toContain('ERROR_JSON ');
  });

  it('check-budget：合法 project → 正常业务路径（exit 0，R1 使用 projectUpdatedAt）', async () => {
    const budget = await write('budget.json', VALID_BUDGET);
    const project = await write('project.json', VALID_PROJECT);
    const r = runCli('check-budget.ts', [budget, `--project=${project}`]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('BUDGET_JSON');
  });

  it('check-maturity：--project 缺必填字段（无 status/createdAt）→ exit 2 STRUCTURE_INVALID（原 warn-and-skip 场景反转）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const project = await write('project.json', '{"id":"smoke"}');
    const r = runCli('check-maturity.ts', [maturity, `--project=${project}`]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('STRUCTURE_INVALID');
    expect(r.stdout).toContain('ERROR_JSON ');
  });

  it('check-maturity：合法 project → 正常业务路径（exit 0，R3/R4 使用 status/createdAt）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const project = await write('project.json', VALID_PROJECT);
    const r = runCli('check-maturity.ts', [maturity, `--project=${project}`]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('MATURITY_JSON');
  });

  it('wm-status：project.json 缺必填字段 → exit 2 STRUCTURE_INVALID（只读查询同样 fail-closed）', async () => {
    await write(path.join('.w-model', 'project.json'), '{"id":"smoke","name":"Smoke"}');
    const r = runCli('wm-status.ts', [tmpDir]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('STRUCTURE_INVALID');
    expect(r.stdout).toContain('ERROR_JSON ');
  });
});
