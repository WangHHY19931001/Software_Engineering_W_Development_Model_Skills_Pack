#!/usr/bin/env tsx
/**
 * 覆盖分析校验脚本（Requirement Coverage Checker）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-requirement-coverage.ts <coverage.json> \
 *     [--graph=<graph.json>] [--out-of-scope=<outOfScope.json>] [--exemptions=<granted.json>]
 *
 * 参数：
 *   coverage.json       coverage.json 文件路径
 *   --graph             graph.json 路径（可选，用于 C7 cross-cuts 一致性校验）
 *   --out-of-scope      outOfScope.json 路径（可选，提供时 C9 升级为 fail）
 *   --exemptions        granted.json 路径（可选，已批准豁免跳过对应规则）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败
 *   2  输入错误
 */
import * as path from 'node:path';
import { checkRequirementCoverage } from '../logic/coverage-logic.js';
import type { GraphShape } from '../logic/graph-logic.js';
import { readJsonOrExit, readJsonClassified } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport } from '../lib/gate-report.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <coverage.json>',
      detail: '用法: npx tsx w-model-dev/scripts/check-requirement-coverage.ts <coverage.json> [--graph=<graph.json>] [--out-of-scope=<outOfScope.json>] [--exemptions=<granted.json>]',
      exitCode: 2,
    });
    return;
  }

  // 解析可选参数
  const getArg = (prefix: string): string | undefined => {
    const arg = process.argv.slice(3).find(a => a.startsWith(prefix));
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
    graphCrossCuts = graphParsed.edges
      .filter(e => e.type === 'cross-cuts')
      .map(e => ({ from: e.from, to: e.to }));
  }

  // 读取 outOfScope.json（可选）
  let outOfScope: string[] | undefined;
  if (outOfScopePath) {
    const oosParsed = await readJsonClassified<{ items?: unknown }>(outOfScopePath);
    if (!oosParsed || !Array.isArray(oosParsed.items)) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
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
    exemptions = exemptParsed.grantedExemptions?.map(g => g.ruleId);
  }

  // 执行校验
  const result = checkRequirementCoverage(parsed, {
    graphCrossCuts,
    outOfScope,
    exemptions,
  });

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('覆盖分析校验报告');
  console.log('═'.repeat(60));
  console.log(`结果: ${result.passed ? '✓ 通过' : '✗ 失败'}`);
  console.log(`覆盖率指标: stakeholder=${result.metrics.stakeholder}% scenario=${result.metrics.scenario}% requirementType=${result.metrics.requirementType}% crossCut=${result.metrics.crossCut}%`);
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
  printGateReport('COVERAGE', {
    type: 'requirement-coverage',
    passed: result.passed,
    metrics: result.metrics,
    exemptionsApplied: result.exemptionsApplied,
    violations: result.violations,
    warnings: result.warnings,
  }, result.passed ? 0 : 1);
}

main().catch((err) => {
  if (process.exitCode !== 0) return; // 已由 readJsonClassified 设置 exitCode，避免覆盖 ERROR_JSON
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
