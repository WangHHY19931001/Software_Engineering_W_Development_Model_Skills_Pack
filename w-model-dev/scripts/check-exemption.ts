#!/usr/bin/env tsx
/**
 * 豁免审批校验脚本（Exemption Checker）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-exemption.ts <exemption.json>
 *
 * 参数：
 *   exemption.json   exemption.json 文件路径
 *
 * 退出码：
 *   0  校验通过（S→R→V→人类四阶段完整）
 *   1  校验失败（阶段缺失或校验未通过）
 *   2  输入错误
 */
import { checkExemption } from './exemption-logic.js';
import { readJsonOrExit } from './lib/read-json-or-exit.js';
import { exitWithError } from './lib/cli-error.js';
import { printGateReport } from './lib/gate-report.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <exemption.json>',
      detail: '用法: npx tsx w-model-dev/scripts/check-exemption.ts <exemption.json>',
      exitCode: 2,
    });
    return;
  }

  const parsed = await readJsonOrExit(file);

  const result = checkExemption(parsed);

  console.log('═'.repeat(60));
  console.log('豁免审批校验报告');
  console.log('═'.repeat(60));
  console.log(`结果: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(`当前阶段: ${result.stage}`);
  if (result.violations.length > 0) {
    console.log('─'.repeat(60));
    console.log('违规项:');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport('EXEMPTION', {
    type: 'exemption',
    passed: result.passed,
    stage: result.stage,
    violations: result.violations,
  }, result.passed ? 0 : 1);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
