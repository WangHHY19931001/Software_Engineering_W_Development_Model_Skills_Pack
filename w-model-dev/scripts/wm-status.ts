#!/usr/bin/env tsx
/**
 * /wm status 状态快照脚本（wm-status.ts）
 *
 * 供编排者（O）只读查询项目状态：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 /
 * 最近动作 / 确定性下一步建议。不修改任何数据。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/wm-status.ts [project-dir] [--json]
 *
 * 参数：
 *   project-dir  项目目录（默认当前工作目录），从 <dir>/.w-model/ 读取状态文件
 *   --json       输出单行 StatusReport JSON（供 O 展示证据或机器消费）
 *
 * 退出码：
 *   0  正常（含「项目未初始化」——查询命令语义）
 *   2  输入错误（project.json / rtm.json 非法 JSON，转 operational-recovery）
 *
 * 设计：docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md §3.1
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  buildStatusReport,
  type RtmLike,
  type RunLogLike,
  type StatusReport,
} from './wm-status-logic.js';
import { readJsonlOptional } from './lib/read-json-or-exit.js';
import { exitWithError } from './lib/cli-error.js';
import { parseJsonSafe } from './lib/safe-json.js';

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

  // 未初始化 → exit 0（查询命令语义；保留原样：不加类别前缀、不输出 ERROR_JSON）
  let projectRaw: string;
  try {
    projectRaw = await fs.readFile(projectFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 项目未初始化：未找到 ${projectFile}`);
      process.exit(0);
    }
    throw err;
  }
  let project: { status: string; updatedAt?: string };
  try {
    project = parseJsonSafe(projectRaw) as { status: string; updatedAt?: string };
  } catch (err) {
    exitWithError({
      category: 'FILE_PARSE',
      message: '文件解析失败（非合法 JSON）（转 operational-recovery，不猜测状态）',
      file: projectFile,
      exitCode: 2,
    });
    return;
  }
  if (project === null || typeof project !== 'object' || Array.isArray(project)) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      message: '文件解析失败（非对象）（转 operational-recovery，不猜测状态）',
      file: projectFile,
      exitCode: 2,
    });
    return;
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
        message: err instanceof SyntaxError
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

  // 归一化 status（JSON 来源可能为任意类型，防 StatusReport.status 类型承诺破坏）
  const report: StatusReport = buildStatusReport(
    {
      status: typeof project.status === 'string' ? project.status : '',
      updatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : undefined,
    },
    rtm,
    runLog,
  );

  if (json) {
    console.log(JSON.stringify(report));
    process.exit(0);
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
    console.log(`RTM 覆盖率    : ${report.rtmCoverage.covered}/${report.rtmCoverage.total}（${report.rtmCoverage.percent}%）`);
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
  process.exit(0);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
