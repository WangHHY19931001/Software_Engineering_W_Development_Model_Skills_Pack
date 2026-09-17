#!/usr/bin/env tsx
/**
 * 规则层覆盖口径门禁（B）：对 coverage/coverage-final.json 按 logic+lib 白名单分母重算
 * statements/branches/functions/lines 并强制阈值。独立于 vitest 全分母阈值（第 12 项）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-coverage-scope.ts \
 *     --report <coverage-final.json> --min-statements <n> --min-branches <n> \
 *     --min-functions <n> --min-lines <n>
 *
 * 退出码：0 = 达标（stdout 单行 COVERAGE_SCOPE_JSON）；1 = 阈值不达（COVERAGE_SCOPE_JSON.passed=false）；
 * 2 = 输入错误（未知/重复/缺值/非有限数值 flag、报告缺失/非法 JSON/白名单零命中 → ERROR_JSON）。
 */
import { readFileSync } from 'node:fs';

import {
  computeCoverageScope,
  CoverageScopeFormatError,
  type CoverageScopeThresholds,
} from '../logic/coverage-scope-logic.js';
import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';

const VALUE_FLAGS = ['report', 'min-statements', 'min-branches', 'min-functions', 'min-lines'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

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

function parseArgs(argv: readonly string[]): Record<ValueFlag, string> {
  const out = {} as Record<ValueFlag, string>;
  for (let i = 0; i < argv.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i 为受控循环下标（0..argv.length-1），非数字键注入
    const token = argv[i]!;
    const eq = token.indexOf('=');
    const name = eq > 0 ? token.slice(2, eq) : token.startsWith('--') ? token.slice(2) : undefined;
    if (name === undefined || !(VALUE_FLAGS as readonly string[]).includes(name)) {
      argInvalid('未知 flag', token);
    }
    const value = eq > 0 ? token.slice(eq + 1) : argv[++i];
    if (value === undefined || value.startsWith('--')) argInvalid(`flag --${name} 缺值`);
    // eslint-disable-next-line security/detect-object-injection -- name 已受 VALUE_FLAGS.includes 白名单校验，受控键
    if (out[name as ValueFlag] !== undefined) argInvalid('重复的值 flag', `--${name}`);
    // eslint-disable-next-line security/detect-object-injection -- 同上，白名单受控键写入
    out[name as ValueFlag] = value;
  }
  for (const f of VALUE_FLAGS) {
    // eslint-disable-next-line security/detect-object-injection -- f 取自 VALUE_FLAGS 常量元组，受控键
    if (out[f] === undefined) argInvalid('缺少必需 flag', `--${f}`);
  }
  return out;
}

function toThresholds(args: Record<ValueFlag, string>): CoverageScopeThresholds {
  const num = (flag: ValueFlag): number => {
    // eslint-disable-next-line security/detect-object-injection -- flag 为 ValueFlag 字面量联合，受控键
    const n = Number(args[flag]);
    if (!Number.isFinite(n) || n < 0) {
      // eslint-disable-next-line security/detect-object-injection -- 同上，受控键（错误详情回显）
      argInvalid('阈值必须为非负有限数值', `--${flag} ${args[flag]}`);
    }
    return n;
  };
  return {
    statements: num('min-statements'),
    branches: num('min-branches'),
    functions: num('min-functions'),
    lines: num('min-lines'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const thresholds = toThresholds(args);
  let raw: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 报告路径为调用方显式传入的 --report 值，只读打开
    raw = readFileSync(args.report, 'utf8');
  } catch {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: 'coverage 报告不存在或不可读',
      exitCode: 2,
      file: args.report,
      detail: '先跑 npx vitest run --coverage --config config/vitest.config.ts 生成 coverage/coverage-final.json',
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
      message: 'coverage 报告不是合法 JSON',
      exitCode: 2,
      file: args.report,
    });
    throw new HandledCliError();
  }
  let report;
  try {
    report = computeCoverageScope(parsed, thresholds);
  } catch (e) {
    if (e instanceof CoverageScopeFormatError) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: e.message,
        exitCode: 2,
        file: args.report,
      });
      throw new HandledCliError();
    }
    throw e;
  }
  if (report.fileCount === 0) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: '白名单零命中：报告中没有任何 logic/lib 文件（include 前缀失配或报告为空）',
      exitCode: 2,
      file: args.report,
    });
    throw new HandledCliError();
  }
  console.log(`COVERAGE_SCOPE_JSON ${JSON.stringify({ ...report, thresholds })}`);
  if (!report.passed) process.exitCode = 1;
}

// 统一入口（lib/run-main.ts）：main().catch 统一为 UNEXPECTED + exit 2；exitWithError 已完成输出则静默退出
runMain(main);
