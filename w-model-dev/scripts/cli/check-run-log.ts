#!/usr/bin/env tsx
/**
 * 运行日志校验脚本（Run-Log Checker）
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.2。
 * 供 O 子代理在阶段推进前调用，校验运行日志完整性、tokens 合规、返工一致、
 * O 越权检测、exitCode 防伪交叉校验、append-only 时序、轨迹模板、跨轮次评审一致、
 * revertEvidence 回滚证伪、闭环五脚本齐备（R1-R11）。
 * 摘要 JSON 的 r10 字段 = R10 revertEvidence 维度计数（checked/missing）；
 * r11 字段 = R11 闭环五脚本核验计数（checkedGates/missing，仅在该 run-log 存在 checkpoint 放行时出现）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-run-log.ts <run-log.jsonl> [--gate-logs=<dir>] [--tla-manifest=<path>] [--json]
 *
 * 参数：
 *   run-log.jsonl        run-log.jsonl 文件路径
 *   --gate-logs=<dir>    gate-logs 目录路径（覆盖参数；缺省自动解析 run-log 同目录约定路径 gate-logs/，
 *                        R6 交叉校验无条件执行——批次 6 A3 后半）
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
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--gate-logs=（覆盖参数，缺省 run-log 同目录 gate-logs/）、--tla-manifest=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * R6 交叉校验默认化（批次 6 A3 后半）：不传 --gate-logs 时默认解析 run-log 同目录 `gate-logs/`，
 * 对每条「gateLogPath 已设且 gateExitCode 为 number」的记录（与 logic 层 R6 交叉校验前置一致）逐条核验：
 *   - gate-logs 目录整体缺失 → 一条汇总 blocking（无此类记录时不触发）；
 *   - 记录引用文件缺失/不可读 → blocking `gate-log 文件缺失：X`（gateLogPath 相对 run-log 所在目录解析，绝对路径原样）；
 *   - gate-log JSON 顶层 exitCode !== 记录 gateExitCode → blocking `gate-log exitCode 与记录不符：X`。
 * 显式传 --gate-logs 时保留旧整目录装载语义（schema 校验 + R5 扫描 + logic 层交叉校验），作为覆盖参数。
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
import { isDirectInvocation } from '../lib/is-main.js';
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
  return {
    runLogFile,
    gateLogsDir,
    gateLogsExplicit,
    gateLogsInvalid,
    tlaManifestFile,
  };
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

// ==================== R6 默认交叉校验（批次 6 A3 后半） ====================

/**
 * R6 交叉校验默认化的逐条核验（默认模式：未显式传 --gate-logs 时执行）。
 *
 * 与 logic 层 R6 交叉校验前置一致：仅核验「gateLogPath 已设（非空白）且 gateExitCode 为 number」
 * 的记录——gateExitCode 未回填的记录由 R6 回填规则另行拦截，不在此重复报告（保持既有失败点不漂移）。
 *
 * 判定口径（控制者裁定）：
 *   - gateLogPath 相对路径以 run-log 文件所在目录为基准解析；绝对路径原样；
 *   - 「缺失」= 文件不存在或不可读；
 *   - 「不符」= gate-log JSON 顶层 exitCode !== 记录.gateExitCode（含无法提取合法顶层 exitCode 的 fail-closed 归入）。
 * 目录整体缺失（或不可读）时不逐条展开，产出一条汇总 blocking；不存在相关记录时整体不触发。
 */
async function verifyGateLogEvidence(
  runLogAbs: string,
  gateLogsDirAbs: string,
  entries: readonly unknown[],
): Promise<string[]> {
  const relevant = entries.filter(
    (e): e is { gateLogPath: string; gateExitCode: number } =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as { gateLogPath?: unknown }).gateLogPath === 'string' &&
      ((e as { gateLogPath?: unknown }).gateLogPath as string).trim() !== '' &&
      typeof (e as { gateExitCode?: unknown }).gateExitCode === 'number',
  );
  if (relevant.length === 0) return [];

  // 目录整体缺失/不可读 → 一条汇总 blocking（不逐条展开；无相关记录时上面已提前返回，不触发）
  try {
    await fs.readdir(gateLogsDirAbs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const code = e.code ?? e.message;
    const suffix = code === 'ENOENT' ? '' : `（读取失败 ${code}）`;
    return [
      `R6: gate-logs 目录缺失：${gateLogsDirAbs}（${relevant.length} 条带 gateLogPath 的 gate 记录无法交叉验证）${suffix}`,
    ];
  }

  const violations: string[] = [];
  const runLogDir = path.dirname(runLogAbs);
  for (const e of relevant) {
    const gateLogPath = e.gateLogPath.trim();
    const fileAbs = path.isAbsolute(gateLogPath) ? gateLogPath : path.resolve(runLogDir, gateLogPath);
    let content: string;
    try {
      content = await fs.readFile(fileAbs, 'utf-8');
    } catch (err) {
      const fe = err as NodeJS.ErrnoException;
      violations.push(`R6: gate-log 文件缺失：${gateLogPath}（${fileAbs}；${fe.code ?? fe.message}）`);
      continue;
    }
    // 顶层 exitCode 提取：仅认「JSON object 顶层 exitCode 为 number」；无法提取按不符 fail-closed
    let fileExitCode: number | undefined;
    try {
      const parsed = parseJsonSafe(content) as { exitCode?: unknown } | undefined;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.exitCode === 'number') {
        fileExitCode = parsed.exitCode;
      }
    } catch {
      /* 非 JSON gate-log → 保持 undefined，按不符处置 */
    }
    if (fileExitCode === undefined) {
      violations.push(`R6: gate-log exitCode 与记录不符：${gateLogPath}（gate-log 未提取到合法顶层 exitCode）`);
    } else if (fileExitCode !== e.gateExitCode) {
      violations.push(
        `R6: gate-log exitCode 与记录不符：${gateLogPath}（记录 gateExitCode=${e.gateExitCode}，gate-log exitCode=${fileExitCode}）`,
      );
    }
  }
  return violations;
}

// ==================== tla-manifest 加载 ====================

/**
 * 读取 tla-manifest.json，提取 checkRounds 数组长度（TLA+ 返工轮数）。
 * tla-manifest.checkRounds 是数组（见 tla-logic.ts TlaManifest.checkRounds），
 * 其长度应与 run-log 中 TLA 返工 fix 记录数一致（批次 6 A15：rework 死词已删除，返工事件载体为 fix；
 * 按 phase 过滤且仅统计 target/note 含 TLA 的条目，比对逻辑见 run-log-logic.ts R3）。
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
  // 批次 6 A3 后半：--gate-logs 降级为覆盖参数；缺省自动解析 run-log 同目录约定路径 gate-logs/，
  // R6 交叉校验无条件执行（默认模式走 verifyGateLogEvidence 逐条核验）。
  const gateLogsDirResolved = gateLogsDir ? path.resolve(gateLogsDir) : path.join(path.dirname(runLogAbs), 'gate-logs');

  // 读 run-log.jsonl（ENOENT → exit(2)；坏行保留 parseErrors，避免部分历史被当成完整输入）
  const parsedRunLog = await readJsonlOrExitDetailed(runLogAbs, 'run-log');
  const entries = parsedRunLog.entries;

  // 显式覆盖输入：--gate-logs=<dir>；一旦显式传入，保留旧整目录装载语义——
  // 读取/schema/协议错误均为 blocking violation，并激活 R5 扫描与 logic 层 R6 交叉校验。
  let gateLogs: Map<string, { exitCode?: number; content: string }> | undefined;
  let gateLogFileCount = 0;
  let gateLogViolations: string[] = [];
  if (gateLogsExplicit) {
    const loaded = await loadGateLogs(gateLogsDirResolved);
    gateLogs = loaded.map;
    gateLogFileCount = loaded.fileCount;
    gateLogViolations = loaded.violations;
  } else {
    // 默认模式：不整目录装载（无 schema/R5 语义放大），仅对带 gateLogPath 的 gate 记录逐条核验证据文件
    gateLogViolations = await verifyGateLogEvidence(runLogAbs, gateLogsDirResolved, entries);
  }

  // 可选输入：--tla-manifest（读失败只警告不 exit）
  let tlaCheckRounds: number | undefined;
  if (tlaManifestFile) {
    tlaCheckRounds = await loadTlaCheckRounds(tlaManifestFile);
  }

  // 构建 options 并调用纯逻辑校验
  const result = checkRunLog(entries, {
    tlaCheckRounds,
    gateLogs,
  });
  // 审计修复（task 3）：parseErrors 从纯 diagnostics 并入 blocking violations——
  // 坏行使输入不完整（可能丢失证据），空/空白/malformed-only/valid+malformed 一律 exit 1。
  // 消息保留 PARSE_INCOMPLETE 前缀以便与 lifecycle diagnostics 区分。
  const allViolations = [
    ...gateLogViolations,
    ...result.violations,
    ...parsedRunLog.parseErrors.map(
      (error) =>
        `PARSE_INCOMPLETE: line ${error.line} ${error.message}; blocking（坏行使 run-log 输入不完整，fail-closed）`,
    ),
  ];
  const passed = allViolations.length === 0;
  // parseErrors 已作为 blocking violations 列出（展示于 reasons / 人类可读原因）；
  // diagnostics 仅保留纯逻辑层的非阻断诊断（pending-pre-approval 等；历史 legacy 吸收诊断已随批次 6 A3/C14 删除）
  const diagnostics = [...(result.diagnostics ?? [])];
  const exitCode = passed ? 0 : 1;
  const lifecycleStatus: RunLogLifecycleStatus =
    passed && diagnostics.length === 0 ? 'CLOSED_UNDER_CURRENT_RULES' : 'NOT_CLOSED_NOT_PROVEN';
  const statusNote =
    passed && diagnostics.length > 0
      ? 'exit 0 仅表示当前规则未产生 blocking diagnostics；不等于 lifecycle closed 或阶段放行。'
      : undefined;
  // 性能计量（人类可读路径保留；机器通道 --json 不携带，见下）
  const durationMs = Date.now() - startTime;
  const summary = {
    type: 'run-log',
    passed,
    reasons: allViolations,
    violations: buildViolationDistribution(allViolations.length),
    lifecycleStatus,
    ...(statusNote ? { statusNote } : {}),
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
    ...(result.revertEvidence ? { r10: result.revertEvidence } : {}),
    ...(result.closure ? { r11: result.closure } : {}),
  };

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置。
  // D3（2026-09-18）：机器通道不携带 durationMs——该值每次运行不同（同输入三次 175/209/221ms），
  // 进入 --json 即破坏「同输入同字节复现」；判定字段（passed/reasons/violations/r10/r11/exitCode）
  // 保持不变。人类可读路径的 RUN_LOG_JSON 摘要按规格保留该字段；A17（43.3.0）口径：
  // durationMs 为非确定运行时字段，机器通道 --json 不携带；人类通道经 printGateReport 尾参数
  // 置于摘要尾部（exitCode 之后、`...summary` 展开后置尾），确定字段序保持稳定（见文件末尾调用）。
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
  console.log(
    `gate-logs 目录  : ${gateLogsDirResolved}${gateLogsExplicit ? '（--gate-logs 显式覆盖' : '（默认：run-log 同目录 gate-logs/'}${gateLogs ? `，已加载 ${gateLogFileCount} 个文件）` : '）'}`,
  );
  console.log(
    `--tla-manifest  : ${tlaManifestFile ?? '未提供'}${tlaCheckRounds !== undefined ? `（checkRounds=${tlaCheckRounds}）` : ''}`,
  );
  console.log(`校验结果        : ${passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log(`生命周期状态    : ${lifecycleStatus}`);
  console.log('─'.repeat(60));

  if (passed) {
    // R11 只在存在 checkpoint 放行时核验（result.closure 随之出现）；无放行的
    // run-log（fix 变体 / blocked checkpoint）不得声称「闭环五脚本齐备」——
    // 否则是与实际核验范围不符的误导性通过语。
    const closureNote = result.closure ? '闭环五脚本齐备' : '闭环五脚本：不适用（无 checkpoint 放行）';
    console.log(
      `运行日志符合 data-models.md RunLogEntry schema：动作完整 + tokens 合规 + 返工一致 + 无 O 越权 + exitCode 一致 + append-only + 轨迹符合 + ${closureNote}。`,
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
  // durationMs 仅在此人类可读通道出现（D3：机器通道 --json 已剔除该非确定性字段）；
  // A17：非确定运行时字段经 printGateReport 尾参数置于摘要尾部（exitCode 之后），确定字段序稳定
  printGateReport('RUN_LOG', summary, exitCode, { durationMs });
  process.exitCode = exitCode;
  return;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
