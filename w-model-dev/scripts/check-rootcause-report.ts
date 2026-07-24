#!/usr/bin/env tsx
/**
 * RootCauseReport 校验脚本（Root Cause Report Checker）
 *
 * 对应 spec §4 RootCauseReport Schema。
 * 供 G 子代理在 R 产出 RootCauseReport JSON 后立即调用，
 * 防止 R 子代理输出漂移导致 S-fix 拿到不合规根因报告。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>
 *
 * 参数：
 *   report.json  R 子代理产出的 RootCauseReport JSON 文件路径
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（reasons 列出具体原因，R 必须按原因重新产出）
 *   2  输入错误（文件不存在 / 非法 JSON）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkRootCauseReport, type RootCauseReportShape } from './root-cause-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-rootcause-report.ts <report.json>');
    process.exit(2);
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const result = checkRootCauseReport(parsed);
  const meta = (parsed as RootCauseReportShape)?.meta;

  console.log('═'.repeat(60));
  console.log('RootCauseReport 校验（Root Cause Report Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  if (meta) {
    console.log(`报告 ID       : ${meta.reportId}`);
    console.log(`目标产物      : ${meta.targetArtifact}`);
    console.log(`目标阶段      : ${meta.targetPhase}`);
    console.log(`返工轮次      : ${meta.reworkRound}`);
    console.log(`返工来源      : ${meta.reworkSource}`);
    console.log(`分析方法      : ${meta.method}`);
  }
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(`失败原因数    : ${result.reasons.length}`);
  if (result.reasons.length > 0) {
    console.log('─'.repeat(60));
    for (const reason of result.reasons) {
      console.log(`  • ${reason}`);
    }
  }
  console.log('═'.repeat(60));
  console.log(JSON.stringify({ passed: result.passed, reasonCount: result.reasons.length }));

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('RootCauseReport 校验异常:', err);
  process.exit(1);
});
