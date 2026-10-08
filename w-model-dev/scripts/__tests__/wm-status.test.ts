/* eslint-disable security/detect-non-literal-fs-filename -- mkdtemp 临时目录写 .w-model fixture（path.join(tmpDir,...)），仓库零写入 */
/**
 * wm-status.ts CLI 层单元测试（进程内模式）
 *
 * 覆盖：正常人类可读 / --json 结构 / 未初始化(exit 0) / project.json 非法·缺必填字段·非对象·数组·枚举越界(exit 2，F-G4-14 读取侧 schema 校验) /
 *       rtm.json 非法(exit 2) / rtm 缺失降级 / run-log 缺失降级 / run-log 坏行跳过 / 仅 project 的降级组合。
 *
 * 进程内说明：经 helpers/cli-invoker.ts 调用导出的 main(argv)（runMain 的 VITEST 守卫
 * 阻止 import 自执行）；真实子进程保真由 cli-subprocess-smoke.test.ts 承载。
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { invokeCli } from './helpers/cli-invoker.js';

const PROJECT_JSON =
  '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';
const RTM_JSON =
  '{"rows":[{"requirementId":"R1","description":"d","designDoc":"docs/x.md#1","codeModule":"SD-001:src/a.ts:L1","unitTest":"TC-UNIT-001","acceptanceTest":"docs/y.md#UAT-001","coverageStatus":"100%"},{"requirementId":"R2","description":"d","designDoc":"docs/x.md#2","coverageStatus":"部分"}],"executionSummary":{"unitTest":{"total":10,"passed":9,"failed":1,"pending":0},"integrationTest":{"total":5,"passed":5,"failed":0,"pending":0},"systemTest":{"total":3,"passed":3,"failed":0,"pending":0},"acceptanceTest":{"total":8,"passed":8,"failed":0,"pending":0}}}';
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

/** 进程内调用 wm-status（argv[0] = 项目根，CLI 不依赖 cwd；模块路径相对 helpers/cli-invoker.ts 解析） */
async function run(...args: string[]): Promise<{ code: number | undefined; stdout: string; stderr: string }> {
  const r = await invokeCli('../../cli/wm-status.js', [tmpDir, ...args]);
  return { code: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

describe('wm-status CLI（正常路径）', () => {
  it('完整夹具人类可读输出：含 6 项内容 + STATUS_JSON 标记，exit 0', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = await run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('项目状态      : 编码');
    expect(r.stdout).toContain('当前阶段      : 5 / 8');
    expect(r.stdout).toContain('完成进度      : 4/8（50%）');
    expect(r.stdout).toContain('RTM 覆盖率（按追溯字段重算）: 1/2（50%）');
    expect(r.stdout).toContain('单元 9/10');
    expect(r.stdout).toContain('最近动作');
    expect(r.stdout).toContain('下一步建议');
    expect(r.stdout).toContain('STATUS_JSON ');
  });

  it('--json 输出单行 StatusReport，结构完整', async () => {
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', RTM_JSON);
    await writeWModel('run-log.jsonl', RUN_LOG_JSONL);
    const r = await run('--json');
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
    expect(parsed.recentActions[0]).toMatchObject({
      action: 'produce',
      role: 'S',
    });
    expect(parsed.nextSteps.length).toBeGreaterThan(0);
  });

  // 试点期的保真对照用例已删除：对照职责由 cli-subprocess-smoke.test.ts 的
  // 「wm-status 真实子进程冒烟」条目承载（Wave 2 推广，Task 9）。
});

describe('wm-status CLI（异常分支）', () => {
  it('未初始化（无 .w-model/project.json）→ exit 0，提示项目未初始化', async () => {
    const r = await run();
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('项目未初始化');
  });

  it('project.json 非法 JSON → exit 2（FILE_PARSE）', async () => {
    await writeWModel('project.json', '{bad json');
    const r = await run();
    expect(r.code, '非法 JSON: 应 exit 2').toBe(2);
    expect(r.stderr, '非法 JSON: 应含「文件解析失败」').toContain('文件解析失败');
    expect(r.stdout, '非法 JSON: 应含 ERROR_JSON').toContain('ERROR_JSON ');
  });

  it('project.json schema STRUCTURE_INVALID（4 态：null / 数组 / 缺必填 / 枚举越界，F-G4-14）', async () => {
    for (const [caseName, content, args, extraStderr] of [
      ['null（合法 JSON 非对象）', 'null', [], '文件结构不符'],
      ['数组输入', '[1,2,3]', [], undefined],
      ['缺必填字段（schema 不符 → exit 2，不再降级猜测）', '{"id":"x"}', [], undefined],
      [
        'status 枚举越界（schema required/enum 前置排除）',
        '{"id":"x","status":123,"updatedAt":"t"}',
        ['--json'],
        undefined,
      ],
    ] as const) {
      await writeWModel('project.json', content);
      const r = await run(...args);
      expect(r.code, `${caseName}: 应 exit 2`).toBe(2);
      expect(r.stderr, `${caseName}: 应含 STRUCTURE_INVALID`).toContain('STRUCTURE_INVALID');
      expect(r.stdout, `${caseName}: 应含 ERROR_JSON`).toContain('ERROR_JSON ');
      if (extraStderr) {
        expect(r.stderr, `${caseName}: 应含「${extraStderr}」`).toContain(extraStderr);
      }
    }
  });
});

describe('wm-status CLI（边界与降级）', () => {
  it('降级路径族（5 态：rtm 非法 / rtm 缺失 / run-log 缺失 / run-log 坏行 / 仅 project 全缺）', async () => {
    // 态 1：rtm.json 非法 JSON → exit 2（可读输入损坏不得猜测状态）
    await writeWModel('project.json', PROJECT_JSON);
    await writeWModel('rtm.json', '{bad');
    let r = await run();
    expect(r.code, 'rtm 非法 JSON: 应 exit 2').toBe(2);
    expect(r.stderr, 'rtm 非法 JSON: 应含「文件解析失败」').toContain('文件解析失败');

    // 态 2：rtm.json 缺失 → exit 0，人类可读降级文案
    await fs.rm(path.join(tmpDir, '.w-model', 'rtm.json'), { force: true });
    r = await run();
    expect(r.code, 'rtm 缺失: 应 exit 0').toBe(0);
    expect(r.stdout, 'rtm 缺失: 应含覆盖率降级文案').toContain('未生成（.w-model/rtm.json 缺失或格式不符）');
    expect(r.stdout, 'rtm 缺失: 应含汇总降级文案').toContain('无汇总（.w-model/rtm.json 缺失或格式不符）');

    // 态 3：run-log.jsonl 缺失 → exit 0，最近动作降级为空
    await writeWModel('rtm.json', RTM_JSON);
    await fs.rm(path.join(tmpDir, '.w-model', 'run-log.jsonl'), { force: true });
    r = await run();
    expect(r.code, 'run-log 缺失: 应 exit 0').toBe(0);
    expect(r.stdout, 'run-log 缺失: 应含最近动作降级文案').toContain('无（.w-model/run-log.jsonl 缺失或为空）');

    // 态 4：run-log.jsonl 含坏行 → exit 0，坏行跳过不崩溃（stderr 警告）
    await writeWModel(
      'run-log.jsonl',
      '{"runId":"a","phase":5,"action":"produce","role":"S","outcome":"success"}\n{broken json line}\n',
    );
    r = await run();
    expect(r.code, 'run-log 坏行: 应 exit 0').toBe(0);
    expect(r.stderr, 'run-log 坏行: 应含非合法 JSON 警告').toContain('非合法 JSON');
    expect(r.stdout, 'run-log 坏行: 应仍输出最近动作').toContain('最近动作');

    // 态 5：仅 project.json（rtm 与 run-log 全缺）→ exit 0，全降级组合不崩溃
    await fs.rm(path.join(tmpDir, '.w-model', 'rtm.json'), { force: true });
    await fs.rm(path.join(tmpDir, '.w-model', 'run-log.jsonl'), { force: true });
    r = await run('--json');
    expect(r.code, '仅 project: 应 exit 0').toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      rtmCoverage: unknown;
      testSummary: unknown;
      recentActions: unknown[];
    };
    expect(parsed.rtmCoverage, '仅 project: rtmCoverage 应为 null').toBeNull();
    expect(parsed.testSummary, '仅 project: testSummary 应为 null').toBeNull();
    expect(parsed.recentActions, '仅 project: recentActions 应为空').toEqual([]);
  });
});
