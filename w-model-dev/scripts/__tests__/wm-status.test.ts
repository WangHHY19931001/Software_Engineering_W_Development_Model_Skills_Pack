/**
 * wm-status.ts CLI 层单元测试（子进程模式）
 *
 * 覆盖：正常人类可读 / --json 结构 / 未初始化(exit 0) / project.json 非法·非对象·数组(exit 2) /
 *       rtm.json 非法(exit 2) / rtm 缺失降级 / run-log 缺失降级 / run-log 坏行跳过 /
 *       status 非字符串归一化 / 仅 project 的降级组合。
 *
 * 子进程说明：CLI 脚本 main() 顶层执行并调用 process.exit，无法直接 import 测试；
 * 采用 spawnSync(process.execPath, [tsx/cli, 脚本, ...]) 运行真实进程断言退出码与输出。
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/wm-status.ts');

const PROJECT_JSON =
  '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';
const RTM_JSON =
  '{"rows":[{"requirementId":"R1","coverageStatus":"100%"},{"requirementId":"R2","coverageStatus":"部分"}],"executionSummary":{"unitTest":{"total":10,"passed":9,"failed":1,"pending":0},"integrationTest":{"total":5,"passed":5,"failed":0,"pending":0},"systemTest":{"total":3,"passed":3,"failed":0,"pending":0},"acceptanceTest":{"total":8,"passed":8,"failed":0,"pending":0}}}';
const RUN_LOG_JSONL =
  '{"runId":"a","timestamp":"t1","phase":5,"action":"produce","role":"S","outcome":"success","gateExitCode":null}\n' +
  '{"runId":"b","timestamp":"t2","phase":5,"action":"gate","role":"G","outcome":"success","gateExitCode":0}\n';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-status-cli-'));
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

/** 运行 wm-status 子进程 */
function run(...args: string[]): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, SCRIPT, tmpDir, ...args], { encoding: 'utf-8' });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('wm-status CLI（正常路径）', () => {
  it('完整夹具人类可读输出：含 6 项内容 + STATUS_JSON 标记，exit 0', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('项目状态      : 编码');
    expect(r.stdout).toContain('当前阶段      : 5 / 8');
    expect(r.stdout).toContain('完成进度      : 4/8（50%）');
    expect(r.stdout).toContain('RTM 覆盖率    : 1/2（50%）');
    expect(r.stdout).toContain('单元 9/10');
    expect(r.stdout).toContain('最近动作');
    expect(r.stdout).toContain('下一步建议');
    expect(r.stdout).toContain('STATUS_JSON ');
  });

  it('--json 输出单行 StatusReport，结构完整', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = run('--json');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      phase: number;
      completedPhases: number;
      progress: string;
      status: string;
      updatedAt: string;
      rtmCoverage: { covered: number; total: number; percent: number } | null;
      testSummary: unknown;
      recentActions: unknown[];
      nextSteps: string[];
    };
    expect(parsed.phase).toBe(5);
    expect(parsed.completedPhases).toBe(4);
    expect(parsed.progress).toBe('4/8（50%）');
    expect(parsed.status).toBe('编码');
    expect(parsed.updatedAt).toBe('2026-08-05T01:00:00Z');
    expect(parsed.rtmCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(parsed.testSummary).not.toBeNull();
    expect(parsed.recentActions).toHaveLength(2);
    expect(parsed.recentActions[0]).toMatchObject({ action: 'produce', role: 'S' });
    expect(parsed.nextSteps.length).toBeGreaterThan(0);
  });
});

describe('wm-status CLI（异常分支）', () => {
  it('未初始化（无 .w-model/project.json）→ exit 0，提示项目未初始化', async () => {
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('项目未初始化');
  });

  it('project.json 非法 JSON → exit 2', async () => {
    await writeWModel('project.json', '{bad json');
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('文件解析失败');
    expect(r.stderr).toContain('operational-recovery');
  });

  it('project.json 为 null（合法 JSON 非对象）→ exit 2', async () => {
    await writeWModel('project.json', 'null');
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('非对象');
  });

  it('project.json 为数组 → exit 2（非对象守卫拦截）', async () => {
    await writeWModel('project.json', '[1,2,3]');
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('非对象');
  });

  it('rtm.json 非法 JSON → exit 2（可读输入损坏不得猜测状态）', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', '{bad');
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('文件解析失败');
  });
});

describe('wm-status CLI（边界与降级）', () => {
  it('rtm.json 缺失 → exit 0，人类可读降级文案「缺失或格式不符」', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('未生成（.w-model/rtm.json 缺失或格式不符）');
    expect(r.stdout).toContain('无汇总（.w-model/rtm.json 缺失或格式不符）');
  });

  it('run-log.jsonl 缺失 → exit 0，最近动作降级为空', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('无（.w-model/run-log.jsonl 缺失或为空）');
  });

  it('run-log.jsonl 含坏行 → exit 0，坏行跳过不崩溃（stderr 警告）', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel(
      'run-log.jsonl',
      '{"runId":"a","phase":5,"action":"produce","role":"S","outcome":"success"}\n{broken json line}\n',
    );
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('非合法 JSON');
    expect(r.stdout).toContain('最近动作');
  });

  it('status 为数字（非字符串）→ exit 0，归一化为未知状态 fallback', async () => {
    await writeWModel('project.json', '{"id":"x","status":123,"updatedAt":"t"}');
    const r = run('--json');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as { status: string; nextSteps: string[] };
    expect(parsed.status).toBe('');
    expect(parsed.nextSteps[0]).toContain('状态未知');
  });

  it('仅 project.json（rtm 与 run-log 全缺）→ exit 0，全降级组合不崩溃', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    const r = run('--json');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      rtmCoverage: unknown;
      testSummary: unknown;
      recentActions: unknown[];
    };
    expect(parsed.rtmCoverage).toBeNull();
    expect(parsed.testSummary).toBeNull();
    expect(parsed.recentActions).toEqual([]);
  });
});
