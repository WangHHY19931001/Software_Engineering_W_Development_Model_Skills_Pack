#!/usr/bin/env tsx
/**
 * 运行日志校验脚本（Run-Log Checker）
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.2。
 * 供 O 子代理在阶段推进前调用，校验运行日志完整性、tokens 合规、返工一致、
 * O 越权检测、exitCode 防伪交叉校验、append-only 时序。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>]
 *
 * 参数：
 *   run-log.jsonl        run-log.jsonl 文件路径
 *   --gate-logs=<dir>    gate-logs 目录路径（可选，R5/R6 交叉校验）
 *   --tla-manifest=<path> tla-manifest.json 路径（可选，R3 返工一致性校验）
 *
 * 退出码：
 *   0  校验通过
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkRunLog } from './run-log-logic.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  runLogFile: string | undefined;
  gateLogsDir: string | undefined;
  tlaManifestFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const runLogFile = args.find(a => !a.startsWith('--'));
  const gateLogsArg = args.find(a => a.startsWith('--gate-logs='));
  const tlaManifestArg = args.find(a => a.startsWith('--tla-manifest='));
  const gateLogsDir = gateLogsArg ? gateLogsArg.slice('--gate-logs='.length) : undefined;
  const tlaManifestFile = tlaManifestArg
    ? tlaManifestArg.slice('--tla-manifest='.length)
    : undefined;
  return { runLogFile, gateLogsDir, tlaManifestFile };
}

// ==================== run-log.jsonl 读取 ====================

/**
 * 读取 run-log.jsonl，每行一个 JSON。
 * 容错：空行跳过，单行非法 JSON 跳过并 console.error 警告（不 exit）。
 */
async function readRunLog(abs: string): Promise<unknown[]> {
  const raw = await fs.readFile(abs, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const entries: unknown[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      console.error(`⚠ run-log 第 ${i + 1} 行非合法 JSON，已跳过: ${abs}`);
    }
  }
  return entries;
}

// ==================== gate-logs 加载 ====================

/**
 * 从 gate-log 内容中提取 exitCode。
 * gate-log 是脚本 stdout 的存档，其中包含一行 `XXX_JSON {...}` 的 JSON 摘要。
 */
function extractExitCode(content: string): number | undefined {
  const patterns = [
    /SCRIPT_JSON\s+(\{.*\})/,
    /GRAPH_JSON\s+(\{.*\})/,
    /VERIFIER_JSON\s+(\{.*\})/,
    /TLA_JSON\s+(\{.*\})/,
    /BUDGET_JSON\s+(\{.*\})/,
    /RUN_LOG_JSON\s+(\{.*\})/,
    /MATURITY_JSON\s+(\{.*\})/,
    /CHECKPOINT_JSON\s+(\{.*\})/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      try {
        const json = JSON.parse(match[1]) as { exitCode?: unknown };
        if (typeof json.exitCode === 'number') return json.exitCode;
      } catch {
        /* 忽略解析失败 */
      }
    }
  }
  return undefined;
}

/**
 * 加载 gate-logs 目录下所有 .log 文件，构建 Map。
 *
 * gateLogPath 匹配策略：run-log 条目的 gateLogPath 可能是相对路径或文件名。
 * 构建 Map 时同时存 basename、绝对路径、相对 cwd 路径作为 key（三索引），
 * 并对含反斜杠的路径额外存正斜杠归一化版本，以兼容 Windows/Unix 路径差异。
 */
interface GateLogsResult {
  map: Map<string, { exitCode?: number; content: string }>;
  fileCount: number;
}

async function loadGateLogs(
  gateLogsDir: string,
): Promise<GateLogsResult | undefined> {
  const dirAbs = path.resolve(gateLogsDir);
  let files: string[];
  try {
    files = await fs.readdir(dirAbs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    console.error(
      `⚠ gate-logs 目录读取失败，跳过 R5/R6 交叉校验: ${dirAbs}（${e.code ?? e.message}）`,
    );
    return undefined;
  }

  const map = new Map<string, { exitCode?: number; content: string }>();
  let fileCount = 0;
  for (const file of files) {
    if (!file.endsWith('.log')) continue;
    fileCount++;
    const fileAbs = path.join(dirAbs, file);
    try {
      const content = await fs.readFile(fileAbs, 'utf-8');
      const exitCode = extractExitCode(content);
      const data = { exitCode, content };
      // 多索引：basename + 绝对路径 + 相对 cwd 路径（含正斜杠归一化）
      const rel = path.relative(process.cwd(), fileAbs);
      const keys = new Set<string>([file, fileAbs, rel]);
      for (const k of [...keys]) {
        keys.add(k.replace(/\\/g, '/'));
      }
      for (const k of keys) {
        map.set(k, data);
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.error(
        `⚠ gate-log 文件读取失败，已跳过: ${fileAbs}（${e.code ?? e.message}）`,
      );
    }
  }
  return { map, fileCount };
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
    const parsed = JSON.parse(raw) as { checkRounds?: unknown };
    if (Array.isArray(parsed.checkRounds)) {
      return parsed.checkRounds.length;
    }
    console.error(
      `⚠ tla-manifest 未含有效 checkRounds 数组，跳过 R3 返工一致性校验: ${abs}`,
    );
    return undefined;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    console.error(
      `⚠ tla-manifest 文件读取失败，跳过 R3 返工一致性校验: ${abs}（${e.code ?? e.message}）`,
    );
    return undefined;
  }
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  const { runLogFile, gateLogsDir, tlaManifestFile } = parseArgs(process.argv);

  if (!runLogFile) {
    console.error(
      '用法: npx tsx w-model-dev/scripts/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>]',
    );
    process.exit(2);
  }

  const runLogAbs = path.resolve(runLogFile);

  // 读 run-log.jsonl（ENOENT → exit(2)；单行非法 JSON 仅警告不 exit）
  let entries: unknown[];
  try {
    entries = await readRunLog(runLogAbs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${runLogAbs}`);
      process.exit(2);
    }
    throw err;
  }

  // 可选输入：--gate-logs（读失败只警告不 exit）
  let gateLogs: Map<string, { exitCode?: number; content: string }> | undefined;
  let gateLogFileCount = 0;
  if (gateLogsDir) {
    const result = await loadGateLogs(gateLogsDir);
    if (result) {
      gateLogs = result.map;
      gateLogFileCount = result.fileCount;
    }
  }

  // 可选输入：--tla-manifest（读失败只警告不 exit）
  let tlaCheckRounds: number | undefined;
  if (tlaManifestFile) {
    tlaCheckRounds = await loadTlaCheckRounds(tlaManifestFile);
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkRunLog(entries, { tlaCheckRounds, gateLogs });

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('运行日志校验（Run-Log Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件        : ${runLogAbs}`);
  console.log(`条目数          : ${entries.length}`);
  console.log(`--gate-logs     : ${gateLogsDir ?? '未提供'}${gateLogs ? `（已加载 ${gateLogFileCount} 个 .log 文件）` : ''}`);
  console.log(`--tla-manifest  : ${tlaManifestFile ?? '未提供'}${tlaCheckRounds !== undefined ? `（checkRounds=${tlaCheckRounds}）` : ''}`);
  console.log(`校验结果        : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('运行日志符合 data-models.md RunLogEntry schema：动作完整 + tokens 合规 + 返工一致 + 无 O 越权 + exitCode 一致 + append-only。');
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('O 子代理须按上述原因处置（补全动作记录 / 修正 tokens / 对齐返工计数 / 补 acknowledgedDecisions / 停止越权 / 修正 exitCode / 恢复 append-only），详见：');
    console.log('  w-model-dev/references/operational-recovery.md §5.2');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log(
    'RUN_LOG_JSON ' +
      JSON.stringify({
        type: 'run-log',
        passed: result.passed,
        exitCode,
        violations: result.violations,
      }),
  );

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('运行日志校验脚本异常:', err);
  process.exit(2);
});
