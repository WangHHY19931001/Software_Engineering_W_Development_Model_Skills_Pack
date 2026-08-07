#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { checkIcebergSweep, type IcebergSweepReport } from './iceberg-sweep-logic.js';
import { exitWithError } from './lib/cli-error.js';
import { parseJsonSafe } from './lib/safe-json.js';

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
    return parseJsonSafe<IcebergSweepReport>(content);
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reportPathArg = args.find(a => !a.startsWith('--'));
  const autoTrigger = args.includes('--auto-trigger');
  const runLogArg = args.find(a => a.startsWith('--run-log='));

  if (!reportPathArg) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '缺少 <report.json> 参数',
      detail: '用法: check-iceberg-sweep.ts <report.json> [--auto-trigger --run-log=<run-log.jsonl>]',
      exitCode: 2,
    });
    return;
  }

  // --auto-trigger 模式：本脚本校验对象是单份报告，reportPathArg 即报告路径；
  // run-log 用于交叉核对报告 phase 与 run-log 中最近 checkpoint phase 一致（R3）。
  if (autoTrigger) {
    if (!runLogArg) {
      exitWithError({
        category: 'ARG_INVALID',
        message: '参数缺失 --run-log=<run-log.jsonl>',
        detail: '用法: check-iceberg-sweep.ts <report.json> --auto-trigger --run-log=<run-log.jsonl>',
        exitCode: 2,
      });
      return;
    }
  }

  const report = await readReport(reportPathArg);
  // 报告读取失败路径已通过 exitWithError 设置 exitCode，此处直接返回避免继续执行
  if (!report || typeof report !== 'object' || report.reportId === undefined) {
    return;
  }

  const result = checkIcebergSweep(report);

  const output = {
    ...ICEBERG_JSON,
    exitCode: result.passed ? 0 : 1,
    passed: result.passed,
    reasons: result.reasons,
    reportSummary: result.reportSummary,
  };

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
