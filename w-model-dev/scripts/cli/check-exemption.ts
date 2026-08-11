#!/usr/bin/env tsx
/**
 * 豁免审批校验脚本（Exemption Checker）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-exemption.ts <exemption.json>
 *
 * 参数：
 *   exemption.json   exemption.json 文件路径
 *   --json           机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  校验通过（S→R→V→人类四阶段完整）
 *   1  校验失败（阶段缺失或校验未通过）
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 EXEMPTION_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、<exemption.json>
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */
import { checkExemption } from '../logic/exemption-logic.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const file = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <exemption.json>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-exemption.ts <exemption.json>',
      exitCode: 2,
    });
    return;
  }

  const parsed = await readJsonOrExit(file);

  const result = checkExemption(parsed);
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport({
      type: 'exemption',
      passed: result.passed,
      reasons: result.violations,
      violations: buildViolationDistribution(result.violations.length),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return;
  }

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
  }, exitCode);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
