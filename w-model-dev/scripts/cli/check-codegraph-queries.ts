#!/usr/bin/env tsx
/**
 * codegraph 查询落盘校验脚本（Codegraph Queries Checker）
 *
 * 对应约束 #20 + 反模式 #38：阶段 5-8 任何代码/测试文件修改前，
 * S-coding 须先调用 codegraph_explore 查询并落盘到
 * `.w-model/codegraph-queries/<phase>-<ticket>-<symbol>.json`。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts <project-root> --phase <5|6|7|8>
 *
 * 退出码：
 *   0  所有修改都有对应 codegraph 查询落盘
 *   1  存在未查询的修改（命中反模式 #38）
 *   2  输入错误
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

interface CodegraphQuery {
  querySymbol: string;
  callers?: unknown[];
  callees?: unknown[];
  blastRadius?: unknown;
  queryTimestamp: string;
}

interface CheckResult {
  passed: boolean;
  violations: string[];
  queryCount: number;
}

/**
 * 校验 codegraph 查询落盘纯逻辑（可被 self-test import）
 * @param projectRoot 项目根目录
 * @param phase 阶段号 5-8
 */
export function checkCodegraphQueries(projectRoot: string, phase: number): CheckResult {
  const violations: string[] = [];
  const queriesDir = path.join(projectRoot, '.w-model', 'codegraph-queries');

  // 查询目录存在性
  if (!existsSync(queriesDir)) {
    violations.push(
      `阶段 ${phase}：.w-model/codegraph-queries/ 目录不存在（约束 #20：阶段 5-8 代码修改须先落盘 codegraph 查询）`,
    );
    return { passed: false, violations, queryCount: 0 };
  }

  // 收集该阶段的查询文件
  const prefix = `phase${phase}-`;
  const files = readdirSync(queriesDir).filter(f => f.startsWith(prefix) && f.endsWith('.json'));

  if (files.length === 0) {
    violations.push(
      `阶段 ${phase}：.w-model/codegraph-queries/ 下无 phase${phase}-*.json 查询文件（约束 #20）`,
    );
    return { passed: false, violations, queryCount: 0 };
  }

  // 校验每个查询文件的字段完整性
  let validCount = 0;
  for (const f of files) {
    const fp = path.join(queriesDir, f);
    let raw: string;
    try {
      raw = readFileSync(fp, 'utf-8');
    } catch {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    if (!raw) {
      violations.push(`${f}：文件读取失败或为空`);
      continue;
    }
    try {
      const q = parseJsonSafe(raw) as CodegraphQuery;
      if (!q.querySymbol || typeof q.querySymbol !== 'string') {
        violations.push(`${f}：缺 querySymbol 字段`);
        continue;
      }
      if (!q.queryTimestamp || typeof q.queryTimestamp !== 'string') {
        violations.push(`${f}：缺 queryTimestamp 字段`);
        continue;
      }
      if (!Array.isArray(q.callers)) {
        violations.push(`${f}：缺 callers[] 字段`);
        continue;
      }
      if (!Array.isArray(q.callees)) {
        violations.push(`${f}：缺 callees[] 字段`);
        continue;
      }
      if (q.blastRadius === undefined || q.blastRadius === null || typeof q.blastRadius !== 'number') {
        violations.push(`${f}：缺 blastRadius 字段（查询结果影响半径，须为 number）`);
        continue;
      }
      validCount++;
    } catch {
      violations.push(`${f}：非合法 JSON`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    queryCount: validCount,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  // 统一 --phase 校验（lib/parse-phase.ts，5-8；支持 --phase N 与 --phase=N）
  const hasPhaseFlag = process.argv.includes('--phase') || process.argv.some(a => a.startsWith('--phase='));
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });

  if (!file || !hasPhaseFlag) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-codegraph-queries.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  if (!existsSync(file) || !statSync(file).isDirectory()) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      message: '项目根路径不存在或不是目录',
      file: path.resolve(file),
      exitCode: 2,
    });
    return;
  }
  if (phaseParsed === undefined) {
    // 复刻原分支语义：空格形态数字越界 → '参数非法 --phase=N'；非数字 / 缺值 / 等号形态 → '参数缺失'
    const phaseIdx = args.indexOf('--phase');
    const phaseRaw = phaseIdx >= 0 ? args[phaseIdx + 1] : undefined;
    if (phaseRaw !== undefined && /^\d+$/.test(phaseRaw)) {
      exitWithError({
        category: 'ARG_INVALID',
        message: `参数非法 --phase=${phaseRaw}`,
        detail: '须为 5-8 的整数',
        exitCode: 2,
      });
      return;
    }
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-codegraph-queries.ts <project-root> --phase <5|6|7|8>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);
  const result = checkCodegraphQueries(abs, phase);

  console.log('═'.repeat(60));
  console.log('codegraph 查询落盘校验（Codegraph Queries Checker）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`有效查询数    : ${result.queryCount}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因（反模式 #38）：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport('CODEGRAPH_QUERIES', {
    type: 'codegraph-queries',
    passed: result.passed,
    phase,
    queryCount: result.queryCount,
    violations: result.violations,
  }, result.passed ? 0 : 1);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
