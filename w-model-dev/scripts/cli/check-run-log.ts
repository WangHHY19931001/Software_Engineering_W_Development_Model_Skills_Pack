#!/usr/bin/env tsx
/**
 * 运行日志校验脚本（Run-Log Checker）
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.2。
 * 供 O 子代理在阶段推进前调用，校验运行日志完整性、tokens 合规、返工一致、
 * O 越权检测、exitCode 防伪交叉校验、append-only 时序、轨迹模板（R1-R8）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>] [--json]
 *
 * 参数：
 *   run-log.jsonl        run-log.jsonl 文件路径
 *   --gate-logs=<dir>    gate-logs 目录路径（可选，R5/R6 交叉校验）
 *   --tla-manifest=<path> tla-manifest.json 路径（可选，R3 返工一致性校验）
 *   --json               机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 RUN_LOG_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--gate-logs=、--tla-manifest=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import {
  checkRunLog,
  inspectGateLogContent,
  buildGateLogKeys,
  type RunLogLifecycleStatus,
} from '../logic/run-log-logic.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import { readJsonlOrExitDetailed } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  runLogFile: string | undefined;
  gateLogsDir: string | undefined;
  gateLogsExplicit: boolean;
  gateLogsInvalid: boolean;
  tlaManifestFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const runLogFile = args.find((a) => !a.startsWith('--'));
  const gateLogsPrefix = '--gate-logs=';
  let gateLogsDir: string | undefined;
  let gateLogsExplicit = false;
  let gateLogsInvalid = false;
  for (const arg of args) {
    if (arg !== '--gate-logs' && !arg.startsWith(gateLogsPrefix)) continue;
    gateLogsExplicit = true;
    const value = arg === '--gate-logs' ? '' : arg.slice(gateLogsPrefix.length);
    if (value.trim() === '') {
      gateLogsInvalid = true;
    } else if (gateLogsDir === undefined) {
      gateLogsDir = value;
    }
  }
  const tlaManifestFile = parseFlagValue(args, 'tla-manifest');
  return { runLogFile, gateLogsDir, gateLogsExplicit, gateLogsInvalid, tlaManifestFile };
}

// ==================== gate-logs 加载 ====================

/**
 * 加载 gate-logs 目录下全部文件，构建 Map。
 *
 * gateLogPath 匹配策略：run-log 条目的 gateLogPath 可能是相对路径或文件名。
 * 构建 Map 时同时存 basename、绝对路径、相对 cwd 路径作为 key（三索引），
 * 对路径做双向斜杠归一化（正↔反），兼容 Windows/Unix 路径差异。
 */
interface GateLogsResult {
  map: Map<string, { exitCode?: number; content: string }>;
  fileCount: number;
  violations: string[];
}

async function loadGateLogs(gateLogsDir: string): Promise<GateLogsResult> {
  const dirAbs = path.resolve(gateLogsDir);
  let files: string[];
  try {
    files = await fs.readdir(dirAbs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const category = e.code === 'ENOENT' ? '输入错误' : '证据违规';
    return {
      map: new Map(),
      fileCount: 0,
      violations: [`R6: gate-logs 目录读取失败（${category}）: ${dirAbs}（${e.code ?? e.message}）`],
    };
  }

  const map = new Map<string, { exitCode?: number; content: string }>();
  const violations: string[] = [];
  let fileCount = 0;
  for (const file of files) {
    fileCount++;
    const fileAbs = path.join(dirAbs, file);
    try {
      const content = await fs.readFile(fileAbs, 'utf-8');
      let parsed: unknown;
      try {
        parsed = parseJsonSafe(content);
      } catch {
        // Explicit --gate-logs is a schema-bound evidence input. Legacy
        // *_JSON extraction remains available to direct logic consumers, but
        // a non-JSON file must not silently pass the CLI reader.
        violations.push(`R6: gate-log ${fileAbs} JSON 解析失败`);
        violations.push(`R6: gate-log ${fileAbs} 未提取到合法 exitCode`);
        continue;
      }
      const inspected = inspectGateLogContent(content);
      let schemaValid = false;
      if (!inspected.rootJson || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        violations.push(`R6: gate-log ${fileAbs} 根 JSON 必须为 object`);
      } else {
        const schemaResult = validateBySchema('gate-log', parsed);
        schemaValid = schemaResult.valid;
        if (!schemaResult.valid) {
          for (const message of schemaResult.errorMessages) {
            violations.push(`R6: gate-log ${fileAbs} [schema] ${message}`);
          }
        }
      }
      for (const violation of inspected.violations) violations.push(`R6: gate-log ${fileAbs} ${violation}`);
      if (inspected.exitCode === undefined) {
        violations.push(`R6: gate-log ${fileAbs} 未提取到合法 exitCode`);
      }
      if (schemaValid && inspected.violations.length === 0 && inspected.exitCode !== undefined) {
        const data = { exitCode: inspected.exitCode, content };
        const keys = buildGateLogKeys(fileAbs, process.cwd());
        for (const k of keys) map.set(k, data);
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      violations.push(`R6: gate-log 文件读取失败: ${fileAbs}（${e.code ?? e.message}）`);
    }
  }
  return { map, fileCount, violations };
}

// ==================== tla-manifest 加载 ====================

/**
 * 读取 tla-manifest.json，提取 checkRounds 数组长度（TLA+ 返工轮数）。
 * tla-manifest.checkRounds 是数组（见 tla-logic.ts TlaManifest.checkRounds），
 * 其长度应与 run-log 中 action=rework 记录数一致。
 */
async function loadTlaCheckRounds(tlaManifestFile: string): Promise<number | undefined> {
  const abs = path.resolve(tlaManifestFile);
  try {
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = parseJsonSafe(raw) as { checkRounds?: unknown };
    if (Array.isArray(parsed.checkRounds)) {
      return parsed.checkRounds.length;
    }
    console.error(`⚠ tla-manifest 未含有效 checkRounds 数组，跳过 R3 返工一致性校验: ${abs}`);
    return undefined;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    console.error(`⚠ tla-manifest 文件读取失败，跳过 R3 返工一致性校验: ${abs}（${e.code ?? e.message}）`);
    return undefined;
  }
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const { runLogFile, gateLogsDir, gateLogsExplicit, gateLogsInvalid, tlaManifestFile } = parseArgs(process.argv);

  if (!runLogFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <run-log.jsonl>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>]',
      exitCode: 2,
    });
    return;
  }

  if (gateLogsExplicit && (gateLogsInvalid || !gateLogsDir)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-2',
      message: '--gate-logs 需要非空目录路径（使用 --gate-logs=<dir>）',
      detail: '收到空值或缺失值',
      exitCode: 2,
    });
    return;
  }

  const runLogAbs = path.resolve(runLogFile);

  // 读 run-log.jsonl（ENOENT → exit(2)；坏行保留 parseErrors，避免部分历史被当成完整输入）
  const parsedRunLog = await readJsonlOrExitDetailed(runLogAbs, 'run-log');
  const entries = parsedRunLog.entries;

  // 可选输入：--gate-logs；一旦显式传入，读取/schema/协议错误均为 blocking violation。
  let gateLogs: Map<string, { exitCode?: number; content: string }> | undefined;
  let gateLogFileCount = 0;
  let gateLogViolations: string[] = [];
  if (gateLogsDir) {
    const loaded = await loadGateLogs(gateLogsDir);
    gateLogs = loaded.map;
    gateLogFileCount = loaded.fileCount;
    gateLogViolations = loaded.violations;
  }

  // 可选输入：--tla-manifest（读失败只警告不 exit）
  let tlaCheckRounds: number | undefined;
  if (tlaManifestFile) {
    tlaCheckRounds = await loadTlaCheckRounds(tlaManifestFile);
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkRunLog(entries, { tlaCheckRounds, gateLogs });
  const allViolations = [...gateLogViolations, ...result.violations];
  const passed = allViolations.length === 0;
  const diagnostics = [
    ...(result.diagnostics ?? []),
    ...parsedRunLog.parseErrors.map((error) => `PARSE_INCOMPLETE: line ${error.line} ${error.message}; deferred`),
  ];
  const exitCode = passed ? 0 : 1;
  const lifecycleStatus: RunLogLifecycleStatus =
    passed && diagnostics.length === 0 ? 'CLOSED_UNDER_CURRENT_RULES' : 'NOT_CLOSED_NOT_PROVEN';
  const statusNote =
    passed && diagnostics.length > 0
      ? 'exit 0 仅表示当前规则未产生 blocking diagnostics；不等于 lifecycle closed 或阶段放行。'
      : undefined;
  const summary = {
    type: 'run-log',
    passed,
    reasons: allViolations,
    violations: buildViolationDistribution(allViolations.length),
    lifecycleStatus,
    ...(statusNote ? { statusNote } : {}),
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
    durationMs: Date.now() - startTime,
  };

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(summary, exitCode);
    process.exitCode = exitCode;
    return;
  }

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('运行日志校验（Run-Log Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件        : ${runLogAbs}`);
  console.log(`条目数          : ${entries.length}`);
  console.log(`--gate-logs     : ${gateLogsDir ?? '未提供'}${gateLogs ? `（已加载 ${gateLogFileCount} 个文件）` : ''}`);
  console.log(
    `--tla-manifest  : ${tlaManifestFile ?? '未提供'}${tlaCheckRounds !== undefined ? `（checkRounds=${tlaCheckRounds}）` : ''}`,
  );
  console.log(`校验结果        : ${passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log(`生命周期状态    : ${lifecycleStatus}`);
  console.log('─'.repeat(60));

  if (passed) {
    console.log(
      '运行日志符合 data-models.md RunLogEntry schema：动作完整 + tokens 合规 + 返工一致 + 无 O 越权 + exitCode 一致 + append-only + 轨迹符合。',
    );
  } else {
    console.log('未通过原因：');
    for (const r of allViolations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log(
      'O 子代理须按上述原因处置（补全动作记录 / 修正 tokens / 对齐返工计数 / 补 acknowledgedDecisions / 停止越权 / 修正 exitCode / 恢复 append-only / 对齐理想轨迹，详见 w-model-dev/references/operational-recovery.md §5.2）',
    );
  }
  if (diagnostics.length > 0) {
    console.log('生命周期诊断（非阻断）：');
    for (const diagnostic of diagnostics) console.log(`  - ${diagnostic}`);
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  printGateReport('RUN_LOG', summary, exitCode);
  process.exitCode = exitCode;
  return;
}

runMain(main);
