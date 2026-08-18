#!/usr/bin/env tsx
/**
 * 覆盖分析校验脚本（Requirement Coverage Checker）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts <coverage.json> \
 *     [--graph=<graph.json>] [--out-of-scope=<outOfScope.json>] [--exemptions=<granted.json>]
 *
 * 参数：
 *   coverage.json       coverage.json 文件路径
 *   --graph             graph.json 路径（可选，用于 C7 cross-cuts 一致性校验）
 *   --out-of-scope      outOfScope.json 路径（可选，提供时 C9 升级为 fail）
 *   --exemptions        granted.json 路径（可选，已批准豁免跳过对应规则）
 *   --json              机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 COVERAGE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--graph=、--out-of-scope=、--exemptions=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */
import * as path from 'node:path';

import { checkRequirementCoverage } from '../logic/coverage-logic.js';
import type { GraphShape } from '../logic/graph-logic.js';
import { readJsonOrExit, readJsonClassified } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <coverage.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts <coverage.json> [--graph=<graph.json>] [--out-of-scope=<outOfScope.json>] [--exemptions=<granted.json>]',
      exitCode: 2,
    });
    return;
  }

  // 解析可选参数
  const getArg = (prefix: string): string | undefined => {
    const arg = process.argv.slice(3).find((a) => a.startsWith(prefix));
    return arg?.split('=')[1];
  };

  const graphPath = getArg('--graph=');
  const outOfScopePath = getArg('--out-of-scope=');
  const exemptionsPath = getArg('--exemptions=');

  // 读取 coverage.json
  const parsed = await readJsonOrExit(file);

  // 读取 graph.json（可选）
  let graphCrossCuts: Array<{ from: string; to: string }> | undefined;
  if (graphPath) {
    const graphParsed = await readJsonClassified<GraphShape>(graphPath);
    graphCrossCuts = graphParsed.edges.filter((e) => e.type === 'cross-cuts').map((e) => ({ from: e.from, to: e.to }));
  }

  // 读取 outOfScope.json（可选）
  let outOfScope: string[] | undefined;
  if (outOfScopePath) {
    const oosParsed = await readJsonClassified<{ items?: unknown }>(outOfScopePath);
    if (!oosParsed || !Array.isArray(oosParsed.items)) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: '结构不符（缺 items 数组）',
        file: path.resolve(outOfScopePath),
        exitCode: 2,
      });
      return;
    }
    outOfScope = (oosParsed as { items: string[] }).items;
  }

  // 读取 exemptions.json（可选）
  let exemptions: string[] | undefined;
  if (exemptionsPath) {
    const exemptParsed = await readJsonClassified<{ grantedExemptions?: Array<{ ruleId: string }> }>(exemptionsPath);
    exemptions = exemptParsed.grantedExemptions?.map((g) => g.ruleId);
  }

  // 执行校验
  const result = checkRequirementCoverage(parsed, {
    graphCrossCuts,
    outOfScope,
    exemptions,
  });
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'requirement-coverage',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('覆盖分析校验报告');
  console.log('═'.repeat(60));
  console.log(`结果: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(
    `覆盖率指标: stakeholder=${result.metrics.stakeholder}% scenario=${result.metrics.scenario}% requirementType=${result.metrics.requirementType}% crossCut=${result.metrics.crossCut}%`,
  );
  if (result.exemptionsApplied.length > 0) {
    console.log(`已应用豁免: ${result.exemptionsApplied.join(', ')}`);
  }
  if (result.violations.length > 0) {
    console.log('─'.repeat(60));
    console.log('违规项:');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('─'.repeat(60));
    console.log('警告项:');
    for (const w of result.warnings) {
      console.log(`  - ${w}`);
    }
  }

  // JSON 摘要
  printGateReport(
    'COVERAGE',
    {
      type: 'requirement-coverage',
      passed: result.passed,
      metrics: result.metrics,
      exemptionsApplied: result.exemptionsApplied,
      violations: result.violations,
      warnings: result.warnings,
    },
    exitCode,
  );
}

runMain(main);
