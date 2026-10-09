#!/usr/bin/env tsx
/**
 * M1 复杂度棘轮预算门禁（check-complexity-budget.ts）
 *
 * 批次五五机制之首的收敛侧（43.5.0）：复用任务 2 的共享采集器
 * （lib/complexity-collect.ts，FC-6 禁止两 CLI 复制采集逻辑）度量复杂度面，
 * 与 eval/complexity-caps.json 的棘轮 caps 比对——任何维度超限即违规（exit 1），
 * 停产要求拆分为小模块 / 走 🔴 CHECKPOINT+decision-log 显式上调（cap 只许下调）。
 * 只读既有数据，不新增检测信号语义，不调用任何 LLM。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-complexity-budget.ts [skill-root] [--caps=<path>]
 *   参数：
 *     skill-root        可选，被度量的 w-model-dev 根目录（默认 = 本脚本所在技能根）
 *     --caps=<path>     caps 文件路径（默认 = 技能根上一级 eval/complexity-caps.json，仓库维护入口）
 *
 * 退出码：
 *   0  全部维度 ≤/≥ cap（stdout 单行 COMPLEXITY_BUDGET_JSON，passed=true）
 *   1  存在违规（stdout 单行 COMPLEXITY_BUDGET_JSON 含 violations 全文，stderr 人类可读 ✗ [BUDGET]）
 *   2  输入错误：未知/重复/缺值 flag → ARG_INVALID；caps 缺失 → FILE_NOT_FOUND；非法 JSON → FILE_PARSE；
 *       结构缺字段 / 采集输入畸形 → STRUCTURE_INVALID（stdout 单行 ERROR_JSON，stderr 人类可读）
 *
 * 设计：docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md §3（M1）
 * 采集器在 lib/complexity-collect.ts（FC-6），逻辑在 logic/complexity-logic.ts（零 fs）。
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectComplexityMeasurement, ComplexityCollectError } from '../lib/complexity-collect.js';
import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import {
  ComplexityFormatError,
  checkComplexityBudget,
  parseBudgetCaps,
  type BudgetCaps,
  type ComplexityMeasurement,
} from '../logic/complexity-logic.js';

function defaultSkillRoot(): string {
  // cli/ 的上一级上一级 = w-model-dev 技能根
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/** 默认 caps = 技能根上一级 eval/complexity-caps.json（仓库维护入口；显式 --caps 可覆盖） */
function defaultCapsPath(): string {
  return path.resolve(defaultSkillRoot(), '..', 'eval', 'complexity-caps.json');
}

interface ParsedArgs {
  skillRoot: string;
  capsPath: string;
}

function argInvalid(message: string, detail?: string): never {
  exitWithError({
    category: 'ARG_INVALID',
    rule: 'P0-1',
    message,
    exitCode: 2,
    detail,
  });
  throw new HandledCliError();
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  let capsPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--caps') {
      if (capsPath !== undefined) argInvalid('重复的 flag', '--caps');
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) argInvalid('flag --caps 缺值');
      capsPath = value;
      continue;
    }
    if (token.startsWith('--caps=')) {
      if (capsPath !== undefined) argInvalid('重复的 flag', '--caps');
      const value = token.slice('--caps='.length);
      if (value === '') argInvalid('flag --caps 缺值');
      capsPath = value;
      continue;
    }
    if (token.startsWith('--')) argInvalid('未知 flag', token);
    positional.push(token);
  }
  if (positional.length > 1) argInvalid('多余的位置参数', positional.slice(1).join(' '));
  return {
    skillRoot: positional[0] ?? defaultSkillRoot(),
    capsPath: capsPath ?? defaultCapsPath(),
  };
}

/** 确定性 JSON 摘要（同字节可复现；violations 全文机器/人类双读） */
function toBudgetJson(
  m: ComplexityMeasurement,
  caps: BudgetCaps,
  violations: string[],
): {
  passed: boolean;
  violations: string[];
  measurement: Record<string, number>;
  caps: Record<string, number>;
} {
  return {
    passed: violations.length === 0,
    violations,
    measurement: {
      referencesFiles: m.referencesFiles.length,
      scriptFiles: m.scriptFiles.length,
      antiPatternCount: m.antiPatternCount,
      hardConstraintCount: m.hardConstraintCount,
      personaAdaptedCount: m.personaAdaptedCount,
      personaTotal: m.personaTotal,
      sedimentCount: m.sedimentCount,
    },
    caps: {
      referencesDefaultMaxLines: caps.referencesDefaultMaxLines,
      referencesExceptions: Object.keys(caps.referencesExceptions).length,
      scriptsDefaultMaxLines: caps.scriptsDefaultMaxLines,
      scriptsExceptions: Object.keys(caps.scriptsExceptions).length,
      antiPatternMaxCount: caps.antiPatternMaxCount,
      hardConstraintMaxCount: caps.hardConstraintMaxCount,
      personaAdaptedMinCount: caps.personaAdaptedMinCount,
      sedimentMaxCount: caps.sedimentMaxCount,
    },
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  let m: ComplexityMeasurement;
  try {
    m = collectComplexityMeasurement(args.skillRoot);
  } catch (err) {
    if (err instanceof ComplexityCollectError) {
      exitWithError({
        category: err.category,
        rule: 'P0-2',
        message: err.message,
        exitCode: 2,
        file: args.skillRoot,
      });
      throw new HandledCliError();
    }
    throw err;
  }

  let raw: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caps 路径为调用方显式传入的 --caps 值或默认仓库维护路径，只读打开
    raw = readFileSync(args.capsPath, 'utf8');
  } catch {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: 'caps 文件不存在或不可读',
      exitCode: 2,
      file: args.capsPath,
      detail: '默认路径为 eval/complexity-caps.json；复查 caps 入库与仓库根定位',
    });
    throw new HandledCliError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    exitWithError({
      category: 'FILE_PARSE',
      rule: 'P0-3',
      message: 'caps 文件不是合法 JSON',
      exitCode: 2,
      file: args.capsPath,
    });
    throw new HandledCliError();
  }

  let caps: BudgetCaps;
  try {
    caps = parseBudgetCaps(parsed);
  } catch (e) {
    if (e instanceof ComplexityFormatError) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: e.message,
        exitCode: 2,
        file: args.capsPath,
      });
      throw new HandledCliError();
    }
    throw e;
  }

  const { violations } = checkComplexityBudget(m, caps);
  const jsonLine = `COMPLEXITY_BUDGET_JSON ${JSON.stringify(toBudgetJson(m, caps, violations))}`;
  console.log(jsonLine);
  if (violations.length > 0) {
    console.error(
      `✗ [BUDGET] 复杂度棘轮预算违规 ${violations.length} 条（cap 只许下调，上调须 🔴 CHECKPOINT+decision-log）：`,
    );
    for (const v of violations) console.error(`  - ${v}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
