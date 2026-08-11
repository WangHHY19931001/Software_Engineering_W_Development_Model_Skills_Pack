#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { checkIcebergSweep, type IcebergSweepReport } from '../logic/iceberg-sweep-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

const ICEBERG_JSON = {
  script: 'check-iceberg-sweep.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reportSummary: null as {
    reportId: string;
    triggerType: string;
    icebergRound: number;
    newFindingsCount: number;
    passed: boolean;
  } | null,
};

async function readReport(reportPath: string): Promise<IcebergSweepReport> {
  const abs = path.resolve(reportPath);
  let content: string;
  try {
    content = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在',
        file: abs,
        exitCode: 2,
      });
      process.exitCode = 2;
      return null as unknown as IcebergSweepReport;
    }
    throw err;
  }
  try {
    const parsed = parseJsonSafe<unknown>(content);
    if (typeof parsed !== 'object' || parsed === null) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: '报告不是 JSON 对象',
        file: abs,
        exitCode: 2,
      });
      process.exitCode = 2;
      return null as unknown as IcebergSweepReport;
    }
    return parsed as IcebergSweepReport;
  } catch (err) {
    exitWithError({
      category: 'FILE_PARSE',
      message: '报告 JSON 解析失败',
      file: abs,
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
    process.exitCode = 2;
    return null as unknown as IcebergSweepReport;
  }
}

/** 从 run-log 推断最近一次 checkpoint success 的阶段（--auto-trigger 模式 R3 交叉核对依据） */
async function inferPhaseFromRunLog(runLogPath: string): Promise<number> {
  const abs = path.resolve(runLogPath);
  try {
    await fs.access(abs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在',
        file: abs,
        exitCode: 2,
      });
      process.exitCode = 2;
      return 0;
    }
    throw err;
  }
  const entries = await readJsonlOrExit(abs, 'run-log');
  let lastPhase = 0;
  for (const entryRaw of entries) {
    const entry = entryRaw as { phase?: number; action?: string; outcome?: string } | null;
    if (typeof entry !== 'object' || entry === null) continue;
    if (typeof entry.phase === 'number' && entry.action === 'checkpoint' && entry.outcome === 'success') {
      lastPhase = entry.phase;
    }
  }
  if (lastPhase < 1 || lastPhase > 8) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '无法从 run-log 推断当前阶段',
      detail: `最后 checkpoint phase=${lastPhase}（须为 1-8）`,
      exitCode: 2,
    });
    process.exitCode = 2;
  }
  return lastPhase;
}

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读 JSON 摘要与 gate-logs 写入）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const reportPathArg = args.find(a => !a.startsWith('--'));
  const autoTrigger = args.includes('--auto-trigger');
  const runLogArg = args.find(a => a.startsWith('--run-log='));

  if (!reportPathArg) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '缺少 <report.json> 参数',
      detail: '用法: check-iceberg-sweep.ts <report.json> [--auto-trigger --run-log=<run-log.jsonl>]',
      exitCode: 2,
    });
    return;
  }

  const report = await readReport(reportPathArg);
  // 报告读取失败路径已通过 exitWithError 设置 exitCode，此处直接返回避免继续执行
  if (!report || typeof report !== 'object') {
    return;
  }

  const result = checkIcebergSweep(report);
  const reasons = [...result.reasons];

  // R3: --auto-trigger 模式交叉核对 report.phase 与 run-log 最近 checkpoint phase 一致
  if (autoTrigger) {
    if (!runLogArg) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '参数缺失 --run-log=<run-log.jsonl>',
        detail: '用法: check-iceberg-sweep.ts <report.json> --auto-trigger --run-log=<run-log.jsonl>',
        exitCode: 2,
      });
      return;
    }
    const expectedPhase = await inferPhaseFromRunLog(runLogArg.split('=')[1]!);
    // inferPhaseFromRunLog 失败路径已 exit 2，此处 expectedPhase 合法
    // 报告 phase 为字符串（如 phase3-outline），run-log phase 为数字 1-8，按 phase<N>- 前缀比较
    if (!report.phase.startsWith(`phase${expectedPhase}-`)) {
      reasons.push(`phase 不一致：报告 phase=${report.phase}，run-log 最近 checkpoint phase=${expectedPhase}`);
    }
    console.error(`[auto-trigger] 从 run-log 推断 phase=${expectedPhase}，报告 phase=${report.phase}`);
  }

  const passed = reasons.length === 0 && result.passed;
  const output = {
    ...ICEBERG_JSON,
    exitCode: passed ? 0 : 1,
    passed,
    reasons,
    reportSummary: result.reportSummary,
  };

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport({
      type: 'iceberg-sweep',
      passed,
      reasons,
      violations: buildViolationDistribution(reasons.length),
      durationMs: Date.now() - startTime,
    }, output.exitCode);
    process.exitCode = output.exitCode;
    return;
  }

  console.log('ICEBERG_JSON ' + JSON.stringify(output));

  // 写入 gate-logs（与 check-preventive-review.ts 一致，写入失败不阻塞）
  const gateLogsDir = path.resolve('.w-model', 'gate-logs');
  try {
    await fs.mkdir(gateLogsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(
      path.resolve(gateLogsDir, `${timestamp}-iceberg-sweep.json`),
      JSON.stringify(output, null, 2),
    );
  } catch {
    // gate-logs 写入失败不阻塞
  }

  process.exit(output.exitCode);
}

main().catch(err => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
