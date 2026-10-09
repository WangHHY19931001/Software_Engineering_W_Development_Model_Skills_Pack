#!/usr/bin/env tsx
/**
 * M1 复杂度度量只读脚本（wm-complexity-report.ts）
 *
 * 批次五五机制之首（43.5.0）：把 w-model-dev 技能包的复杂度面量化为可棘轮收敛的度量。
 * 度量 references/scripts 各文件行数、反模式/硬约束计数、人格适配计数、沉积标记计数，
 * 产出基线快照供任务 3 的 check-complexity-budget.ts（棘轮预算门禁）消费。
 * 只读既有数据，不新增检测信号语义，不调用任何 LLM。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-complexity-report.ts [skill-root] [--json] [--save-baseline=<path>]
 *   参数：
 *     skill-root        可选，被度量的 w-model-dev 根目录（默认 = 本脚本所在技能根）
 *     --json            只输出单行 COMPLEXITY_REPORT_JSON（同字节确定、不含 generatedAt）
 *     --save-baseline=  把报告写入指定路径（JSON 缩进 2 空格，供基线入库）
 *
 * 退出码：
 *   0  度量成功（stdout 单行 COMPLEXITY_REPORT_JSON；exit 0/2 契约，无 exit 1）
 *   2  输入错误：未知/重复/缺值 flag → ARG_INVALID；根目录不存在 → FILE_NOT_FOUND；
 *       目录结构缺失 / 采集输入畸形 → STRUCTURE_INVALID；基线写入失败 → FILE_READ
 *       （stdout 单行 ERROR_JSON，stderr 人类可读）
 *
 * 设计：docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md §3（M1）
 * 采集器在 lib/complexity-collect.ts（FC-6），逻辑在 logic/complexity-logic.ts（零 fs）。
 */

import { writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectComplexityMeasurement, ComplexityCollectError } from '../lib/complexity-collect.js';
import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import {
  ComplexityFormatError,
  computeComplexityReport,
  type ComplexityMeasurement,
  type ComplexityReport,
} from '../logic/complexity-logic.js';

/** 确定性 JSON 载荷（不含 generatedAt——同字节可复现，基线/门禁共享此形状） */
interface DeterministicReport {
  referencesFiles: ComplexityMeasurement['referencesFiles'];
  scriptFiles: ComplexityMeasurement['scriptFiles'];
  antiPatternCount: number;
  hardConstraintCount: number;
  personaAdaptedCount: number;
  personaTotal: number;
  sedimentCount: number;
  oversizedReferences: ComplexityReport['oversizedReferences'];
  oversizedScripts: ComplexityReport['oversizedScripts'];
}

function toDeterministicReport(m: ComplexityMeasurement, r: ComplexityReport): DeterministicReport {
  return {
    referencesFiles: m.referencesFiles,
    scriptFiles: m.scriptFiles,
    antiPatternCount: m.antiPatternCount,
    hardConstraintCount: m.hardConstraintCount,
    personaAdaptedCount: m.personaAdaptedCount,
    personaTotal: m.personaTotal,
    sedimentCount: m.sedimentCount,
    oversizedReferences: r.oversizedReferences,
    oversizedScripts: r.oversizedScripts,
  };
}

function defaultSkillRoot(): string {
  // cli/ 的上一级上一级 = w-model-dev 技能根
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

interface ParsedArgs {
  skillRoot: string;
  json: boolean;
  saveBaseline: string | undefined;
}

function argInvalid(message: string, detail?: string): never {
  exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message, exitCode: 2, detail });
  throw new HandledCliError();
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  let json = false;
  let saveBaseline: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i 为受控循环下标（0..argv.length-1），非数字键注入
    const token = argv[i]!;
    // eslint-disable-next-line security/detect-possible-timing-attacks -- 与固定字面量 '--json' 的相等比较，非秘密比较（无时序侧信道）
    if (token === '--json') {
      if (json) argInvalid('重复的 flag', '--json');
      json = true;
      continue;
    }
    if (token.startsWith('--save-baseline=')) {
      if (saveBaseline !== undefined) argInvalid('重复的 flag', '--save-baseline');
      const value = token.slice('--save-baseline='.length);
      if (value === '') argInvalid('flag --save-baseline 缺值');
      saveBaseline = value;
      continue;
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks -- 与固定字面量 '--save-baseline' 的相等比较，非秘密比较（无时序侧信道）
    if (token === '--save-baseline') {
      if (saveBaseline !== undefined) argInvalid('重复的 flag', '--save-baseline');
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) argInvalid('flag --save-baseline 缺值');
      saveBaseline = value;
      continue;
    }
    if (token.startsWith('--')) argInvalid('未知 flag', token);
    positional.push(token);
  }
  if (positional.length > 1) argInvalid('多余的位置参数', positional.slice(1).join(' '));
  return { skillRoot: positional[0] ?? defaultSkillRoot(), json, saveBaseline };
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

  let report: ComplexityReport;
  try {
    report = computeComplexityReport(m);
  } catch (e) {
    if (e instanceof ComplexityFormatError) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: e.message,
        exitCode: 2,
        file: args.skillRoot,
      });
      throw new HandledCliError();
    }
    throw e;
  }

  const det = toDeterministicReport(m, report);
  if (args.saveBaseline !== undefined) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 基线路径为调用方显式传入的 --save-baseline 值，仅写本参数指定文件
      writeFileSync(args.saveBaseline, `${JSON.stringify(det, null, 2)}\n`, 'utf8');
    } catch (err) {
      exitWithError({
        category: 'FILE_READ',
        rule: 'P0-2',
        message: '基线写入失败',
        exitCode: 2,
        file: args.saveBaseline,
        detail: err instanceof Error ? err.message : String(err),
      });
      throw new HandledCliError();
    }
  }

  const jsonLine = `COMPLEXITY_REPORT_JSON ${JSON.stringify(det)}`;
  if (args.json) {
    console.log(jsonLine);
    process.exitCode = 0;
    return;
  }

  console.log('═'.repeat(60));
  console.log('M1 复杂度度量报告（wm-complexity-report）');
  console.log('═'.repeat(60));
  console.log(`生成时间     : ${report.generatedAt}`);
  console.log(`references   : ${m.referencesFiles.length} 个 .md`);
  console.log(`scripts      : ${m.scriptFiles.length} 个 .ts`);
  console.log(`反模式数     : ${m.antiPatternCount}`);
  console.log(`硬约束数     : ${m.hardConstraintCount}`);
  console.log(`人格适配     : ${m.personaAdaptedCount}/${m.personaTotal}`);
  console.log(`沉积标记     : ${m.sedimentCount}`);
  console.log(`超 1200 行 references（${report.oversizedReferences.length} 个）: `);
  for (const f of report.oversizedReferences) console.log(`  - ${f.path} (${f.lines})`);
  if (report.oversizedReferences.length === 0) console.log('  （无）');
  console.log(`超 1200 行 scripts（${report.oversizedScripts.length} 个）: `);
  for (const f of report.oversizedScripts) console.log(`  - ${f.path} (${f.lines})`);
  if (report.oversizedScripts.length === 0) console.log('  （无）');
  if (args.saveBaseline !== undefined) console.log(`基线已写入   : ${args.saveBaseline}`);
  console.log('─'.repeat(60));
  console.log(jsonLine);
  process.exitCode = 0;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
