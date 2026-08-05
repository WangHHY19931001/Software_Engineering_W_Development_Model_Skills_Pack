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
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkRequirementCoverage } from './coverage-logic.js';
import type { GraphShape } from './graph-logic.js';
import { readJsonOrExit } from './lib/read-json-or-exit.js';
import { exitWithError } from './lib/cli-error.js';

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
    try {
      const graphRaw = await fs.readFile(path.resolve(graphPath), 'utf-8');
      const graphParsed = JSON.parse(graphRaw) as GraphShape;
      graphCrossCuts = graphParsed.edges
        .filter(e => e.type === 'cross-cuts')
        .map(e => ({ from: e.from, to: e.to }));
    } catch (err) {
      if (err instanceof SyntaxError) {
        exitWithError({
          category: 'FILE_PARSE',
          message: '文件解析失败（非合法 JSON）',
          exitCode: 2,
          file: path.resolve(graphPath),
        });
      } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          message: '文件不存在',
          exitCode: 2,
          file: path.resolve(graphPath),
        });
      } else {
        exitWithError({
          category: 'FILE_READ',
          message: '文件读取失败',
          exitCode: 2,
          file: path.resolve(graphPath),
          detail: (err as NodeJS.ErrnoException).code ?? '未知错误',
        });
      }
      return;
    }
  }

  // 读取 outOfScope.json（可选）
  let outOfScope: string[] | undefined;
  if (outOfScopePath) {
    try {
      const oosRaw = await fs.readFile(path.resolve(outOfScopePath), 'utf-8');
      const oosParsed = JSON.parse(oosRaw);
      if (!oosParsed || !Array.isArray((oosParsed as { items?: unknown }).items)) {
        exitWithError({
          category: 'STRUCTURE_INVALID',
          message: '结构不符（缺 items 数组）',
          file: path.resolve(outOfScopePath),
          exitCode: 2,
        });
        return;
      }
      outOfScope = (oosParsed as { items: string[] }).items;
    } catch (err) {
      if (err instanceof SyntaxError) {
        exitWithError({
          category: 'FILE_PARSE',
          message: '文件解析失败（非合法 JSON）',
          exitCode: 2,
          file: path.resolve(outOfScopePath),
        });
      } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          message: '文件不存在',
          exitCode: 2,
          file: path.resolve(outOfScopePath),
        });
      } else {
        exitWithError({
          category: 'FILE_READ',
          message: '文件读取失败',
          exitCode: 2,
          file: path.resolve(outOfScopePath),
          detail: (err as NodeJS.ErrnoException).code ?? '未知错误',
        });
      }
      return;
    }
  }

  // 读取 exemptions.json（可选）
  let exemptions: string[] | undefined;
  if (exemptionsPath) {
    try {
      const exemptRaw = await fs.readFile(path.resolve(exemptionsPath), 'utf-8');
      const exemptParsed = JSON.parse(exemptRaw) as { grantedExemptions?: Array<{ ruleId: string }> };
      exemptions = exemptParsed.grantedExemptions?.map(g => g.ruleId);
    } catch (err) {
      if (err instanceof SyntaxError) {
        exitWithError({
          category: 'FILE_PARSE',
          message: '文件解析失败（非合法 JSON）',
          exitCode: 2,
          file: path.resolve(exemptionsPath),
        });
      } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          message: '文件不存在',
          exitCode: 2,
          file: path.resolve(exemptionsPath),
        });
      } else {
        exitWithError({
          category: 'FILE_READ',
          message: '文件读取失败',
          exitCode: 2,
          file: path.resolve(exemptionsPath),
          detail: (err as NodeJS.ErrnoException).code ?? '未知错误',
        });
      }
      return;
    }
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
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('COVERAGE_JSON ' + JSON.stringify({
    type: 'requirement-coverage',
    passed: result.passed,
    exitCode,
    metrics: result.metrics,
    exemptionsApplied: result.exemptionsApplied,
    violations: result.violations,
    warnings: result.warnings,
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
