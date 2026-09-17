#!/usr/bin/env tsx
/**
 * /wm status 状态快照脚本（wm-status.ts）
 *
 * 供编排者（O）只读查询项目状态：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 /
 * 最近动作 / 确定性下一步建议。不修改任何数据。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-status.ts [project-dir] [--json]
 *
 * 参数：
 *   project-dir  项目目录（默认当前工作目录），从 <dir>/.w-model/ 读取状态文件
 *   --json       输出单行 StatusReport JSON（供 O 展示证据或机器消费）
 *
 * 退出码：
 *   0  正常（含「项目未初始化」——查询命令语义）
 *   2  输入错误（project.json 非法 JSON / project.schema.json 校验不符（STRUCTURE_INVALID）/ rtm.json 非法 JSON，转 operational-recovery）
 *
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.1
 * project.json 读取校验（F-G4-14）：只读查询同样 fail-closed——合法 JSON 但缺必填字段 /
 * 枚举越界 / 多未知字段（project.schema.json additionalProperties:false）→ exit 2，
 * 不猜测状态；ENOENT 仍视为「未初始化」exit 0。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { buildStatusReport, type RtmLike, type RunLogLike, type StatusReport } from '../logic/wm-status-logic.js';
import { readJsonlOptional } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { loadAndValidate, LOAD_AND_VALIDATE_SENTINEL_PREFIX } from '../lib/load-and-validate.js';

interface ParsedArgs {
  projectDir: string;
  json: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  return { projectDir: positional[0] ?? process.cwd(), json };
}

async function main(): Promise<void> {
  const { projectDir, json } = parseArgs(process.argv);
  const wmodelDir = path.join(projectDir, '.w-model');
  const projectFile = path.join(wmodelDir, 'project.json');
  const rtmFile = path.join(wmodelDir, 'rtm.json');
  const runLogFile = path.join(wmodelDir, 'run-log.jsonl');

  // 未初始化 → exit 0（查询命令语义；保留原样：不加类别前缀、不输出 ERROR_JSON）。
  // 先用 access 预探测 ENOENT（loadAndValidate 对 ENOENT 走 FILE_NOT_FOUND exit 2，语义不同）
  try {
    await fs.access(projectFile);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      // 未初始化不是错误（exit 0），但 --json 模式必须给出机器可读对象：
      // 空 stdout 会让调用方无法区分「未初始化」与「正常空报告」。
      if (json) {
        console.log(
          JSON.stringify({
            type: 'status',
            initialized: false,
            projectFile,
            message: '项目未初始化（未找到 project.json）',
          }),
        );
      } else {
        console.error(`✗ 项目未初始化：未找到 ${projectFile}`);
      }
      process.exitCode = 0;
      return;
    }
    throw err;
  }
  // F-G4-14：读取侧经 project.schema.json 校验（只读查询同样 fail-closed，输出 ERROR_JSON）。
  // 非法 JSON → FILE_PARSE / schema 不符（缺必填字段、枚举越界、未知字段、非对象）→ STRUCTURE_INVALID，
  // 均 exit 2（原「非对象守卫」「status 非字符串归一化」分支被 schema required/enum/type 前置排除）
  let project: { status: string; updatedAt?: string };
  try {
    project = await loadAndValidate<{ status: string; updatedAt?: string }>(projectFile, 'project');
  } catch (err) {
    if (err instanceof Error && err.message.startsWith(LOAD_AND_VALIDATE_SENTINEL_PREFIX)) return;
    throw err;
  }

  // rtm.json 可选：缺失降级 null；损坏 → exit 2（输入错误）
  let rtm: RtmLike | null = null;
  try {
    const raw = await fs.readFile(rtmFile, 'utf-8');
    rtm = parseJsonSafe(raw) as RtmLike;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      exitWithError({
        category: err instanceof SyntaxError ? 'FILE_PARSE' : 'FILE_READ',
        rule: err instanceof SyntaxError ? 'P0-3' : 'P0-3',
        message:
          err instanceof SyntaxError
            ? '文件解析失败（非合法 JSON）（转 operational-recovery，不猜测状态）'
            : '文件读取失败（转 operational-recovery，不猜测状态）',
        file: rtmFile,
        detail: err instanceof SyntaxError ? undefined : (e.code ?? '未知错误'),
        exitCode: 2,
      });
      return;
    }
  }

  // run-log.jsonl 可选：缺失降级空数组（readJsonlOptional ENOENT→[]，坏行 warn+skip 同 readJsonlOrExit）
  const runLog = (await readJsonlOptional(runLogFile, 'run-log')) as RunLogLike[];

  // 归一化 status（schema 校验后 status 必为 9 态枚举字符串；此处仅透传）
  const report: StatusReport = buildStatusReport(
    {
      status: project.status,
      updatedAt: project.updatedAt,
    },
    rtm,
    runLog,
  );

  if (json) {
    console.log(JSON.stringify(report));
    process.exitCode = 0;
    return;
  }

  // 人类可读
  console.log('═'.repeat(60));
  console.log('/wm status（项目状态快照）');
  console.log('═'.repeat(60));
  console.log(`项目状态      : ${report.status}`);
  console.log(`当前阶段      : ${report.phase} / 8`);
  console.log(`完成进度      : ${report.progress}`);
  console.log(`updatedAt     : ${report.updatedAt}`);
  if (report.rtmCoverage) {
    console.log(
      `RTM 覆盖率    : ${report.rtmCoverage.covered}/${report.rtmCoverage.total}（${report.rtmCoverage.percent}%）`,
    );
  } else {
    console.log('RTM 覆盖率    : 未生成（.w-model/rtm.json 缺失或格式不符）');
  }
  if (report.testSummary) {
    const fmt = (t: { total: number; passed: number; failed: number; pending: number }, label: string) =>
      `${label} ${t.passed}/${t.total}（failed=${t.failed}, pending=${t.pending}）`;
    console.log('四级测试      :');
    console.log(`  ${fmt(report.testSummary.unit, '单元')}`);
    console.log(`  ${fmt(report.testSummary.integration, '集成')}`);
    console.log(`  ${fmt(report.testSummary.system, '系统')}`);
    console.log(`  ${fmt(report.testSummary.acceptance, '验收')}`);
  } else {
    console.log('四级测试      : 无汇总（.w-model/rtm.json 缺失或格式不符）');
  }
  if (report.recentActions.length > 0) {
    console.log('最近动作      :');
    for (const a of report.recentActions) {
      console.log(
        `  [${a.phase ?? '-'}] ${a.action} · ${a.role} · ${a.outcome}` +
          `${typeof a.gateExitCode === 'number' ? ` · exit=${a.gateExitCode}` : ''} · ${a.timestamp}`,
      );
    }
  } else {
    console.log('最近动作      : 无（.w-model/run-log.jsonl 缺失或为空）');
  }
  console.log('下一步建议    :');
  for (const s of report.nextSteps) {
    console.log(`  - ${s}`);
  }
  console.log('─'.repeat(60));
  console.log('STATUS_JSON ' + JSON.stringify(report));
  process.exitCode = 0;
}

runMain(main);
