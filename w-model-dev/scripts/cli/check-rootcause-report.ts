#!/usr/bin/env tsx
/**
 * RootCauseReport 校验脚本（Root Cause Report Checker）
 *
 * 对应 spec §4 RootCauseReport Schema。
 * 供 G 子代理在 R 产出 RootCauseReport JSON 后立即调用，
 * 防止 R 子代理输出漂移导致 S-fix 拿到不合规根因报告。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-rootcause-report.ts <report.json>
 *
 * 参数：
 *   report.json  R 子代理产出的 RootCauseReport JSON 文件路径
 *   --json       机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（reasons 列出具体原因，R 必须按原因重新产出）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 ROOTCAUSE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、<report.json>
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import * as path from 'node:path';

import { checkRootCauseReport, type RootCauseReportShape } from '../logic/root-cause-logic.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag } from '../lib/parse-args.js';
import { printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <report.json>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-rootcause-report.ts <report.json>',
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(file);
  const parsed = await readJsonOrExit(file);

  const result = checkRootCauseReport(parsed);
  const meta = (parsed as RootCauseReportShape)?.meta;
  const exitCode1 = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'rootcause',
        passed: result.passed,
        reasons: result.reasons,
        violations: buildViolationDistribution(result.reasons.length),
        durationMs: Date.now() - startTime,
      },
      exitCode1,
    );
    process.exitCode = exitCode1;
    return;
  }

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

  console.log(
    'ROOTCAUSE_JSON ' +
      JSON.stringify({
        type: 'rootcause',
        passed: result.passed,
        exitCode: exitCode1,
        reasonCount: result.reasons.length,
      }),
  );

  process.exit(exitCode1);
}

runMain(main);
