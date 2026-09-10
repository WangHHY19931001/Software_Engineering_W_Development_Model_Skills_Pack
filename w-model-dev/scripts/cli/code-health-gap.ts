#!/usr/bin/env tsx
/* eslint-disable security/detect-object-injection -- Flag names and dimension keys are fixed literal members of the CLI/contract tables; no caller-controlled key reaches an object lookup. */
/**
 * Phase 2 gap matrix CLI（只读生成 + 校验）
 *
 * 从七维度发现输入（requirement / public-contract / branch / error / security / concurrency /
 * platform）生成 gap matrix，并复用 Task 1 的 `validateGapMatrix` 做逐行与矩阵级校验。coverage 只作
 * 信号：`coverageAuthorization` 恒为 `false`，`coverageSignal.lines === 1` 不能授权跳过任何一维。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/code-health-gap.ts --matrix <file> [--validate]
 *
 * 输入文档（`--matrix` 指向的 JSON）支持两种形态：
 *   { "kind": "discovery", "ledger": {...}, "discovery": { requirements: [...], ... } }
 *   { "kind": "matrix",    "ledger": {...}, "rows": [ ...GapRow ] }
 * 无 `kind` 时按 `rows` / `discovery` 字段自动判别。
 *
 * 退出码：
 *   0  matrix 通过 validateGapMatrix（七维度完整，行字段合法）
 *   1  校验失败（缺维度 / 行字段非法 / RED-GREEN 证据非法），reasons 在 GAP_JSON 中列出
 *   2  输入错误（未知 flag、缺失/重复 flag、文件不存在或非法 JSON、文档结构非法）→ ERROR_JSON
 *
 * 本脚本只读：只读取 `--matrix` 输入，matrix 仅输出到 stdout，不写工作树。
 */

import * as path from 'node:path';

import type { CodeHealthLedger, CommandEvidence, GapDiscoveryInput, GapRow } from '../logic/code-health-contract.js';
import { GAP_DIMENSIONS, findGaps } from '../logic/code-health-gap-logic.js';
import { validateGapMatrix, validateRedGreenEvidence } from '../logic/code-health-ledger-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

const VALUE_FLAGS = ['matrix'] as const;
const BOOLEAN_FLAGS = ['validate'] as const;

class GapArgumentError extends Error {}

interface ParsedGapArgs {
  matrix: string;
  validate: boolean;
}

function parseGapArgs(argv: readonly string[]): ParsedGapArgs {
  const values: Record<string, string> = {};
  const flags: Record<string, boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) {
      throw new GapArgumentError(`unexpected positional argument: ${argument}`);
    }
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if ((BOOLEAN_FLAGS as readonly string[]).includes(name)) {
      if (equals !== -1) throw new GapArgumentError(`flag --${name} does not take a value`);
      if (flags[name] === true) throw new GapArgumentError(`duplicate flag: --${name}`);
      flags[name] = true;
      continue;
    }
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new GapArgumentError(`unknown flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new GapArgumentError(`missing value for --${name}`);
      }
      value = next;
      index += 1;
    }
    if (value === '') throw new GapArgumentError(`missing value for --${name}`);
    if (values[name] !== undefined) throw new GapArgumentError(`duplicate flag: --${name}`);
    values[name] = value;
  }
  const matrix = values.matrix;
  if (matrix === undefined) {
    throw new GapArgumentError('missing required flag: --matrix <file>');
  }
  return { matrix, validate: flags.validate === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolve the input document into gap rows without ever writing to the worktree. */
function resolveRows(document: Record<string, unknown>): GapRow[] {
  if (Array.isArray(document.rows)) return document.rows as GapRow[];
  if (isRecord(document.discovery)) return findGaps(document.discovery as unknown as GapDiscoveryInput).rows;
  const discovery: Record<string, unknown> = {};
  for (const dimension of GAP_DIMENSIONS) {
    if (Object.prototype.hasOwnProperty.call(document, dimension.key)) {
      discovery[dimension.key] = document[dimension.key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(document, 'coverageSignal')) {
    discovery.coverageSignal = document.coverageSignal;
  }
  return findGaps(discovery as unknown as GapDiscoveryInput).rows;
}

function emitSummary(payload: Record<string, unknown>): void {
  console.log(`GAP_JSON ${JSON.stringify(payload)}`);
}

async function main(): Promise<void> {
  let parsed: ParsedGapArgs;
  try {
    parsed = parseGapArgs(process.argv.slice(2));
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail: 'usage: code-health-gap.ts --matrix <file> [--validate]',
      exitCode: 2,
    });
    return;
  }

  const document = await readJsonOrExit<unknown>(parsed.matrix);
  if (!isRecord(document)) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P2-1',
      message: 'gap matrix 输入必须是对象（{kind, ledgers, discovery|rows}）',
      file: path.resolve(parsed.matrix),
      exitCode: 2,
    });
    return;
  }

  const ledger = document.ledger;
  const reasons: string[] = [];
  let rows: GapRow[] = [];
  try {
    if (document.kind === 'red-green' && isRecord(document.gap) && Array.isArray(document.results)) {
      // G-1: the ledger (campaign authority) — not the fixture's self-declared scope — anchors the
      // candidate; the validator cross-checks the harness declaration against this record.
      reasons.push(
        ...validateRedGreenEvidence(
          document.gap as unknown as GapRow,
          document.results as CommandEvidence[],
          (ledger ?? {}) as unknown as CodeHealthLedger,
        ),
      );
    } else {
      rows = resolveRows(document);
      reasons.push(...validateGapMatrix({ rows }, (ledger ?? {}) as unknown as CodeHealthLedger));
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  }

  console.log('─'.repeat(60));
  console.log('Code Health Phase 2（七维度 gap matrix，只读生成）');
  console.log('─'.repeat(60));
  console.log(`输入文件      : ${path.resolve(parsed.matrix)}`);
  console.log(`gap 行数      : ${rows.length}`);
  console.log(`coverage      : signal-only（coverageAuthorization=false）`);

  if (reasons.length > 0) {
    for (const reason of reasons) console.log(`✗ [gap-matrix] ${reason}`);
    console.log('MATRIX_JSON ' + JSON.stringify({ rows }));
    emitSummary({
      type: 'code-health-gap',
      exitCode: 1,
      rowCount: rows.length,
      coverageAuthorization: false,
      coverageIsSignalOnly: true,
      violations: reasons,
    });
    process.exitCode = 1;
    return;
  }

  const kinds = [...new Set(rows.map((row) => row.kind))];
  console.log(`维度          : ${kinds.join(', ')}`);
  console.log('✓ 七维度 gap matrix 校验通过');
  console.log('MATRIX_JSON ' + JSON.stringify({ rows }));
  emitSummary({
    type: 'code-health-gap',
    exitCode: 0,
    rowCount: rows.length,
    kinds,
    coverageAuthorization: false,
    coverageIsSignalOnly: true,
    violations: [],
  });
  process.exitCode = 0;
}

runMain(main);
