#!/usr/bin/env node
/**
 * 冰山清扫校验脚本（Iceberg Sweep Checker）
 *
 * 校验跨阶段遗留问题（iceberg）清扫报告：遗漏项、回归项与新的遗留项，
 * 并支持 --auto-trigger 从 run-log 交叉核对最近一次 checkpoint 成功阶段。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts <report.json> [--json]
 *   npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts <report.json> --auto-trigger --run-log=<run-log.jsonl> [--json]
 *
 * 参数：
 *   report.json            IcebergSweepReport JSON 文件路径
 *   --auto-trigger         交叉核对模式：从 run-log 推断最近 checkpoint 成功阶段
 *   --run-log=<path>       run-log.jsonl 路径（--auto-trigger 模式必填）
 *   --json                 机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）。默认与 --json 均在输出摘要前尝试写 gate log；写失败通过 gateLogWriteError 反映，不改变主 passed / exitCode；报告结构违规时审计写入降级为 stderr 诊断（gateLogWriteError 不进入摘要，不再产出 GATE_LOG_SCHEMA_INVALID 噪音）
 *
 * 退出码：
 *   0  校验通过（无遗漏 / 回归 / 新增遗留项）
 *   1  校验失败（reasons 列出具体原因）
 *   2  输入错误（参数非法 / 文件不存在 / JSON 解析失败，stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印单行 ICEBERG_JSON 摘要（便于 Agent 正则截取；非 --json 模式无人类可读正文）；默认与 --json 均先尝试写 gate log
 *   gate log 写入失败仅在摘要中增加 gateLogWriteError（并写 stderr 诊断），不改变主 gate result
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--auto-trigger、--run-log=
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * 三视角分母对账（R6-R8）：本脚本从报告所在项目根的上游已落盘产物
 * （`.w-model/ingestion/graph.json` / `.w-model/tla-manifest.json` / `.w-model/rtm.json` /
 * `.w-model/change-scope.json`）按设计 ID 命名空间实测各视角"应扫集合"并注入 logic 层
 * （D7：分母不由 R 声明）。上游产物全缺时不注入 → R6-R8 跳过（阶段早期不误红）。
 *
 * @module
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import {
  checkIcebergSweep,
  deriveViewSets,
  parseIcebergPhase,
  type IcebergCheckExternalEvidence,
  type IcebergSweepReport,
} from '../logic/iceberg-sweep-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { writeGateLog, type GateLogWriteError } from '../lib/gate-log-writer.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { readJsonClassified, readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { buildViolationDistribution } from '../lib/gate-report.js';

const ICEBERG_JSON = {
  script: 'check-iceberg-sweep.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reportSummary: null as {
    reportId: string;
    triggerType: string;
    icebergRound: number;
    newFindingsCount: number;
    passed: boolean;
  } | null,
};

async function readReport(reportPath: string): Promise<IcebergSweepReport | null> {
  const abs = path.resolve(reportPath);
  let parsed: unknown;
  try {
    parsed = await readJsonClassified<unknown>(abs);
  } catch {
    // readJsonClassified 已经 exitWithError 输出 ERROR_JSON（单条）并抛出以中断调用链；
    // 此处捕获防止 main().catch 二次打印，保持 stdout 单条 ERROR_JSON 语义
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: '报告不是 JSON 对象',
      file: abs,
      exitCode: 2,
    });
    return null;
  }
  return parsed as IcebergSweepReport;
}

/** 从 run-log 推断最近一次 checkpoint success 的阶段（--auto-trigger 模式交叉核对依据）；错误路径返回 null（exitCode 已置 2） */
async function inferPhaseFromRunLog(runLogPath: string): Promise<number | null> {
  const abs = path.resolve(runLogPath);
  try {
    await fs.access(abs);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '文件不存在',
        file: abs,
        exitCode: 2,
      });
      return null;
    }
    throw err;
  }
  const entries = await readJsonlOrExit(abs, 'run-log');
  let lastPhase = 0;
  for (const entryRaw of entries) {
    const entry = entryRaw as { phase?: number; action?: string; outcome?: string } | null;
    if (typeof entry !== 'object' || entry === null) continue;
    if (typeof entry.phase === 'number' && entry.action === 'checkpoint' && entry.outcome === 'success') {
      lastPhase = entry.phase;
    }
  }
  if (lastPhase < 1 || lastPhase > 8) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '无法从 run-log 推断当前阶段',
      detail: `最后 checkpoint phase=${lastPhase}（须为 1-8）`,
      exitCode: 2,
    });
    return null;
  }
  return lastPhase;
}

/**
 * 定位项目根（供三视角分母从上游已落盘产物实测）。自报告所在目录向上找 `.w-model/` 或 `.git`。
 * 报告常规落在 `.w-model/iceberg/<id>.json`，故上一级即项目根。
 *
 * **判据已与 `check-requirement-graph.ts` 的 `resolveAnchorBaseDir` 分叉（2026-09-18 起）**：
 * 本函数仍是裸 `existsSync('.w-model')`——**任何** `.w-model/` 目录（含技能运行期只写
 * `gate-logs/` 的 gitignored 残留）都算命中；graph 侧在 D2 修复后收紧为「`.w-model/` 须含
 * 至少一个常规文件」（`isProjectStateWModelDir`），残留不再算根。故二者行为**未对齐**：
 * 本函数对 CWD 相邻残留仍敏感（残留会抢先命中并把基准截断到错误目录）。统一三处项目根解析器
 * （本文件 / check-requirement-graph.ts / check-signature-chain.ts）属后续任务，本轮只如实登记。
 */
function resolveProjectRoot(reportAbsPath: string): string {
  let dir = path.dirname(reportAbsPath);
  const start = dir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, '.w-model')) || existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** 读取 JSON 文件；不存在/不可解析返回 undefined（分母缺失即该视角不在场，交由 R7 显式声明） */
function tryReadJson(fileAbs: string): unknown {
  if (!existsSync(fileAbs)) return undefined;
  try {
    return JSON.parse(readFileSync(fileAbs, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * 读盘构造注入面（CLI 层唯一读盘点；logic 层保持纯函数）。
 * 任一上游产物缺失即该视角键缺席，不合成空集合——空集合与"未读盘"语义不同，
 * 前者会被 R6 当成真的一致从而放行（下一个"空即合规"）。
 */
function buildIcebergExternalEvidence(
  reportAbsPath: string,
  phase: number | undefined,
): IcebergCheckExternalEvidence | undefined {
  if (phase === undefined) return undefined;
  const root = resolveProjectRoot(reportAbsPath);
  const artifacts = {
    graph: tryReadJson(path.join(root, '.w-model', 'ingestion', 'graph.json')),
    tlaManifest: tryReadJson(path.join(root, '.w-model', 'tla-manifest.json')),
    rtm: tryReadJson(path.join(root, '.w-model', 'rtm.json')),
    changeScope: tryReadJson(path.join(root, '.w-model', 'change-scope.json')),
  };
  if (Object.values(artifacts).every((a) => a === undefined)) return undefined;
  const viewSets = deriveViewSets(phase, artifacts);
  return Object.keys(viewSets).length > 0 ? { viewSets } : undefined;
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读 JSON 摘要与 gate-logs 写入）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const reportPathArg = args.find((a) => !a.startsWith('--'));
  const autoTrigger = hasFlag(args, 'auto-trigger');
  const runLogFile = parseFlagValue(args, 'run-log');

  if (!reportPathArg) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '缺少 <report.json> 参数',
      detail: '用法: check-iceberg-sweep.ts <report.json> [--auto-trigger --run-log=<run-log.jsonl>]',
      exitCode: 2,
    });
    return;
  }

  const report = await readReport(reportPathArg);
  // 报告读取失败路径已通过 exitWithError 设置 exitCode，此处直接返回避免继续执行
  if (!report || typeof report !== 'object') {
    return;
  }

  const result = checkIcebergSweep(
    report,
    buildIcebergExternalEvidence(path.resolve(reportPathArg), parseIcebergPhase(report.phase)),
  );
  const reasons = [...result.reasons];

  // 交叉核对：--auto-trigger 模式下校验 report.phase 与 run-log 最近 checkpoint phase 一致（独立于 logic 层 R1-R5 编号体系）
  if (autoTrigger) {
    if (!runLogFile) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '参数缺失 --run-log=<run-log.jsonl>',
        detail: '用法: check-iceberg-sweep.ts <report.json> --auto-trigger --run-log=<run-log.jsonl>',
        exitCode: 2,
      });
      return;
    }
    const expectedPhase = await inferPhaseFromRunLog(runLogFile);
    // inferPhaseFromRunLog 错误路径返回 null（exitCode 已置 2），直接返回避免后续 process.exit 覆盖退出码
    if (expectedPhase === null) {
      return;
    }
    // 报告 phase 为字符串（如 phase3-outline），run-log phase 为数字 1-8，按 phase<N>- 前缀比较
    if (!report.phase.startsWith(`phase${expectedPhase}-`)) {
      reasons.push(`phase 不一致：报告 phase=${report.phase}，run-log 最近 checkpoint phase=${expectedPhase}`);
    }
    console.error(`[auto-trigger] 从 run-log 推断 phase=${expectedPhase}，报告 phase=${report.phase}`);
  }

  const passed = reasons.length === 0 && result.passed;
  const output = {
    ...ICEBERG_JSON,
    exitCode: passed ? 0 : 1,
    passed,
    reasons,
    reportSummary: result.reportSummary,
  };

  const gateLog = await writeGateLog({
    script: 'check-iceberg-sweep.ts',
    exitCode: output.exitCode,
    passed: output.passed,
    reasons: output.reasons,
    reportSummary: {
      ...output.reportSummary,
      exitCode: output.exitCode,
      passed: output.passed,
    },
    stdoutSummary: { exitCode: output.exitCode, passed: output.passed },
  });
  let gateLogWriteError: GateLogWriteError | undefined = gateLog.ok ? undefined : gateLog.error;
  // S10 降级：报告结构违规时 reportSummary 本身不满足 gate-log schema（如非法 triggerType /
  // 越界 icebergRound），审计写入注定失败——不再向 stdout 摘要输出 GATE_LOG_SCHEMA_INVALID 噪音，
  // 改为 stderr 诊断；报告结构合法的运行（含校验失败 exit 1）仍照常写 gate-log 审计足迹。
  if (gateLogWriteError?.code === 'GATE_LOG_SCHEMA_INVALID') {
    console.error(
      '⚠ [gate-log] 报告结构违规（reportSummary 不满足 gate-log schema），跳过审计写入并降级为 stderr 诊断（GATE_LOG_SCHEMA_INVALID 不进入摘要）',
    );
    gateLogWriteError = undefined;
  }

  // --json：写入审计日志后输出机器可读报告，主门禁结果保持不变
  if (jsonMode) {
    console.log(
      JSON.stringify({
        type: 'iceberg-sweep',
        passed,
        reasons,
        violations: buildViolationDistribution(reasons.length),
        durationMs: Date.now() - startTime,
        ...(gateLogWriteError === undefined ? {} : { gateLogWriteError }),
        exitCode: output.exitCode,
      }),
    );
    if (gateLogWriteError !== undefined) console.error(`[gate-log] persistence failed: ${gateLogWriteError.code}`);
    process.exitCode = output.exitCode;
    return;
  }

  const summary = gateLogWriteError === undefined ? output : { ...output, gateLogWriteError };
  console.log('ICEBERG_JSON ' + JSON.stringify(summary));
  if (gateLogWriteError !== undefined) console.error(`[gate-log] persistence failed: ${gateLogWriteError.code}`);

  process.exitCode = output.exitCode;
  return;
}

runMain(main);
