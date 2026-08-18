#!/usr/bin/env tsx
/**
 * Checkpoint 校验脚本（Checkpoint Checker）
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.4。
 * 供 O 子代理在阶段推进前调用，校验 run-log 中 checkpoint 类记录的决策非空、
 * 内容具体、用户确认存在、决策与阶段匹配、跨阶段证据一致。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-checkpoint.ts <run-log.jsonl> --checkpoint-log=<dir>
 *
 * 参数：
 *   run-log.jsonl          run-log.jsonl 文件路径
 *   --checkpoint-log=<dir> checkpoint-log 目录路径（强制，R3 用户确认存在校验）
 *                         目录下按 phase 命名的文件（如 phase-1.txt / 1.txt / checkpoint-1.md）
 *                         内容即用户确认原文，key=phase
 *   --json                机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 CHECKPOINT_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--checkpoint-log=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { checkCheckpoint } from '../logic/checkpoint-logic.js';
import { readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  runLogFile: string | undefined;
  checkpointLogDir: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const runLogFile = args.find((a) => !a.startsWith('--'));
  const checkpointLogArg = args.find((a) => a.startsWith('--checkpoint-log='));
  const checkpointLogDir = checkpointLogArg ? checkpointLogArg.slice('--checkpoint-log='.length) : undefined;
  return { runLogFile, checkpointLogDir };
}

// ==================== checkpoint-log 加载 ====================

/**
 * 加载 checkpoint-log 目录下的用户确认记录，构建 Map。
 * key = phase（如 "1"/"2"），value = 用户确认原文。
 *
 * 文件命名约定：匹配 phase-N 模式（phase-1.txt / checkpoint-1.md / 1.log 等），
 *              提取 N 作为 phase key。
 *
 * 容错：目录读取失败只警告不 exit；单文件读取失败只警告；
 *       未匹配到任何 phase 文件则返回 undefined（跳过 R3）。
 */
async function loadCheckpointLog(checkpointLogDir: string): Promise<Map<string, string> | undefined> {
  const dirAbs = path.resolve(checkpointLogDir);
  let files: string[];
  try {
    files = await fs.readdir(dirAbs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    console.error(`⚠ checkpoint-log 目录读取失败，跳过 R3 用户确认校验: ${dirAbs}（${e.code ?? e.message}）`);
    return undefined;
  }

  const map = new Map<string, string>();
  // 匹配 phase-N 模式：phase-1.txt / checkpoint-1.md / 1.log 等
  const phasePattern = /(?:phase-|checkpoint-)?(\d+)\.(?:txt|md|log)$/;
  for (const file of files) {
    const match = file.match(phasePattern);
    if (!match) continue;
    const phaseNum = parseInt(match[1]!, 10);
    if (isNaN(phaseNum)) continue;
    const phase = String(phaseNum);
    const fileAbs = path.join(dirAbs, file);
    try {
      const content = await fs.readFile(fileAbs, 'utf-8');
      if (phase) map.set(phase, content);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(`⚠ checkpoint-log 文件读取失败，已跳过: ${fileAbs}（${e.code ?? e.message}）`);
    }
  }
  if (map.size === 0) {
    console.error(`⚠ checkpoint-log 目录未匹配到 phase-N 文件，跳过 R3 用户确认校验: ${dirAbs}`);
    return undefined;
  }
  return map;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const { runLogFile, checkpointLogDir } = parseArgs(process.argv);

  if (!runLogFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <run-log.jsonl>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-checkpoint.ts <run-log.jsonl> --checkpoint-log=<dir>',
      exitCode: 2,
    });
    return;
  }

  if (!checkpointLogDir) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 --checkpoint-log=<dir>（R3 强化，强制）',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-checkpoint.ts <run-log.jsonl> --checkpoint-log=<dir>',
      exitCode: 2,
    });
    return;
  }

  const runLogAbs = path.resolve(runLogFile);

  // 读 run-log.jsonl（ENOENT → exit(2)；单行非法 JSON 仅警告不 exit）
  const entries = await readJsonlOrExit(runLogAbs, 'run-log');

  // 强制输入：--checkpoint-log（读失败只警告不 exit，但 R3 逻辑会报违规）
  let checkpointLog: Map<string, string> | undefined;
  let checkpointLogFileCount = 0;
  if (checkpointLogDir) {
    const result = await loadCheckpointLog(checkpointLogDir);
    if (result) {
      checkpointLog = result;
      checkpointLogFileCount = result.size;
    }
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkCheckpoint(entries, { checkpointLog });
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'checkpoint',
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

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('Checkpoint 校验（Checkpoint Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件          : ${runLogAbs}`);
  console.log(`条目数            : ${entries.length}`);
  console.log(
    `--checkpoint-log  : ${checkpointLogDir ?? '未提供'}${checkpointLog ? `（已加载 ${checkpointLogFileCount} 个 phase 确认文件）` : ''}`,
  );
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('checkpoint 记录符合规范：决策非空 + 内容具体 + 用户确认存在 + 决策与阶段匹配 + 跨阶段证据一致。');
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log(
      'O 子代理须按上述原因处置（补 acknowledgedDecisions / 具化决策 / 补用户确认 / 对齐阶段主题 / 显式回退修正），详见：',
    );
    console.log('  docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.4');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  printGateReport(
    'CHECKPOINT',
    {
      type: 'checkpoint',
      passed: result.passed,
      violations: result.violations,
    },
    exitCode,
  );
}

runMain(main);
