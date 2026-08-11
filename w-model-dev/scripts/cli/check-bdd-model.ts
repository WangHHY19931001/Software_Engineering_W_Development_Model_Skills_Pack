#!/usr/bin/env tsx
/**
 * BDD 模型校验脚本（BDD Model Checker）
 *
 * 对应 docs/superpowers/specs/2026-07-27-bdd-modeling-and-acceptance-fixture-design.md。
 * 供 G 子代理在阶段 1-8 收敛循环中调用，校验 bdd-manifest.json 的：
 *   features 头标注 + 状态机七要素 + BDD↔TLA+ 等价性 + step 绑定
 *   + scenario 路径合法性 + RTM 映射。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-bdd-model.ts <bdd-manifest.json>
 *     [--phase=N] [--tla-manifest=<path>] [--rtm=<path>] [--cucumber-report=<path>] [--graph=<graph.json>]
 *
 * 参数：
 *   bdd-manifest.json   manifest 文件路径
 *   --phase=N            校验阶段（1-8），默认从 manifest.currentPhase 读取
 *   --tla-manifest=<p>   TLA+ manifest 路径（阶段 1-4 用于 D4 等价性校验）
 *   --rtm=<p>            RTM 文件路径（用于 D7 RTM 映射校验）
 *   --cucumber-report=<p>  cucumber 运行报告 JSON（阶段 5-8 用于 D5 step 绑定校验）
 *   --graph=<p>          graph.json 路径（phase>=2 时强制必填，提取 type=SD 节点供 D8 SD Coverage 校验）
 *   --json               机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse），不写 gate-logs
 *
 * 退出码：
 *   0  校验通过（schema + 头标注 + 状态机 + 等价性 + step 绑定 + 路径 + RTM 全过）
 *   1  校验失败（违反列出具体原因，S 子代理按原因修正 features / 状态机 / 回退需求设计）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法 / schema 不合规）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 BDD_JSON 摘要，便于 Agent 正则截取）
 *   JSON 摘要同时写入 .w-model/gate-logs/<timestamp>-bdd.json（--json 模式不写）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase=N、--tla-manifest=、--rtm=、--cucumber-report=、--graph=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * 注意：本脚本不调用任何 LLM。cucumber 是确定性运行器，features/step 是文本+代码。
 *
 * @module
 */

import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import { PHASES, type Phase } from '../lib/constants.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import {
  checkBddModel,
  parseFeatureFile,
  parseTlaSpecSnapshot,
  type BddManifest,
  type BddCheckInput,
  type TlaSpecSnapshot,
} from '../logic/bdd-logic.js';
import { loadAndValidate } from '../lib/load-and-validate.js';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  manifestFile: string | undefined;
  phase: number | undefined;
  /** --phase 原始值（用于显式传了但非法的 ARG_INVALID 消息） */
  phaseStr: string | undefined;
  tlaManifestFile: string | undefined;
  rtmFile: string | undefined;
  cucumberReportFile: string | undefined;
  graphFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const manifestFile = args.find(a => !a.startsWith('--'));
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const tlaArg = args.find(a => a.startsWith('--tla-manifest='));
  const rtmArg = args.find(a => a.startsWith('--rtm='));
  const cucumberArg = args.find(a => a.startsWith('--cucumber-report='));
  const graphArg = args.find(a => a.startsWith('--graph='));

  // 统一 --phase 校验（lib/parse-phase.ts，1-8）；显式传了但非法由 main 统一 ARG_INVALID
  const phase = phaseArg ? parsePhaseArg(argv, { min: 1, max: 8 })?.phase : undefined;
  const phaseStr = phaseArg ? phaseArg.split('=')[1] : undefined;
  const tlaManifestFile = tlaArg ? tlaArg.split('=')[1] : undefined;
  const rtmFile = rtmArg ? rtmArg.split('=')[1] : undefined;
  const cucumberReportFile = cucumberArg ? cucumberArg.split('=')[1] : undefined;
  const graphFile = graphArg ? graphArg.split('=')[1] : undefined;

  return { manifestFile, phase, phaseStr, tlaManifestFile, rtmFile, cucumberReportFile, graphFile };
}

// ==================== I/O 辅助 ====================

async function readJson<T>(file: string): Promise<T> {
  const text = await fs.readFile(file, 'utf-8');
  return parseJsonSafe(text) as T;
}

/**
 * 多路径查找 feature 文件（第22轮 P2-6 修正）。
 * 依次尝试：basePath + filePath → .w-model/ + filePath → .w-model/bdd/ + filePath → projectDir + filePath
 * 返回第一个存在的路径，都不存在返回 null
 */
function resolveFeatureFile(basePath: string, filePath: string, projectDir: string): string | null {
  const candidates = [
    path.resolve(basePath, filePath),
    path.resolve(projectDir, '.w-model', filePath),
    path.resolve(projectDir, '.w-model', 'bdd', filePath),
    path.resolve(projectDir, filePath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * 读取 .feature 文件并解析头标注 + Background 状态机 + scenarios。
 * 解析逻辑已收敛至 bdd-logic.ts 的 parseFeatureFile（纯函数，此处只负责读文件）。
 */
async function readFeatureFile(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  return parseFeatureFile(content);
}

// ==================== 主流程 ====================

async function main(): Promise<number> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计、不写 gate-logs）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const args = parseArgs(process.argv);

  if (!args.manifestFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <bdd-manifest.json>',
      detail: '用法: check-bdd-model.ts <bdd-manifest.json> [--phase=N] [--tla-manifest=...] [--rtm=...] [--cucumber-report=...]',
      exitCode: 2,
    });
    return 2;
  }

  // 读取 manifest + schema 前置校验（C1 统一封装：FILE_NOT_FOUND / FILE_PARSE / STRUCTURE_INVALID → exit 2 + ERROR_JSON）
  let manifest: BddManifest;
  try {
    manifest = await loadAndValidate<BddManifest>(args.manifestFile, 'bdd-manifest');
  } catch {
    // ERROR_JSON 已由 loadAndValidate 统一输出，此处仅终止流程
    return 2;
  }

  // 显式传了 --phase 但非法（非数字 / 越界）→ 复刻原消息（parseInt 结果，非数字时为 NaN）
  if (args.phaseStr !== undefined && args.phase === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `参数非法 --phase=${Number.parseInt(args.phaseStr, 10)}`,
      detail: '须为 1-8 整数',
      exitCode: 2,
    });
    return 2;
  }

  const phaseRaw = args.phase ?? manifest.currentPhase;
  if (typeof phaseRaw !== 'number' || !Number.isInteger(phaseRaw) || !PHASES.includes(phaseRaw as Phase)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `参数非法 --phase=${args.phase ?? manifest.currentPhase}`,
      detail: '须为 1-8 整数',
      exitCode: 2,
    });
    return 2;
  }
  const phase = phaseRaw as Phase;

  // --graph phase>=2 强制（设计文档 §3.3.7）
  if (phase >= 2 && !args.graphFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 --graph=<graph.json>（phase>=2 强制）',
      detail: '用法: check-bdd-model.ts <bdd-manifest.json> --phase=N --graph=.w-model/ingestion/graph.json',
      exitCode: 2,
    });
    return 2;
  }

  const manifestDir = path.resolve(path.dirname(args.manifestFile));
  // 项目根目录 = manifest 所在目录的父目录（约定：manifest 在 .w-model/ 下）
  const projectDir = path.resolve(manifestDir, '..');
  const basePath = manifest.basePath
    ? path.resolve(projectDir, manifest.basePath)
    : manifestDir; // basePath 缺失时回退到 manifest 所在目录

  // 解析所有 features 文件
  const parsedFeatures: BddCheckInput['parsedFeatures'] = [];
  for (const f of manifest.features) {
    const resolved = resolveFeatureFile(basePath, f.filePath, projectDir);
    if (!resolved) {
      console.error(`[D2] feature 文件不存在：${f.filePath}（已尝试 basePath / .w-model/ / .w-model/bdd/ / projectDir）`);
      continue;
    }
    try {
      const parsed = await readFeatureFile(resolved);
      parsedFeatures.push({
        featureId: f.id,
        header: parsed.header,
        stateMachine: parsed.stateMachine,
        scenarios: parsed.scenarios,
      });
    } catch (e) {
      console.error(`[D2] 无法读取 feature 文件 ${resolved}: ${(e as Error).message}`);
    }
  }

  // 读取 TLA+ manifest 并构造快照（阶段 1-4 用于 D4）
  let tlaSnapshots: TlaSpecSnapshot[] | undefined;
  if (phase <= 4) {
    if (args.tlaManifestFile) {
      const tlaManifestPath = args.tlaManifestFile;
      try {
        const tlaManifest = await readJson<{ basePath?: string; specs: Array<{ id: string; tlaPath: string }> }>(tlaManifestPath);
        tlaSnapshots = [];
        // tlaPath 相对 basePath（相对 manifest 所在目录）解析，与 check-tla-model.ts P1.1 路径基准一致（tla-plus-guide §2.1）
        const tlaBase = path.resolve(path.dirname(tlaManifestPath), tlaManifest.basePath ?? '');
        for (const spec of tlaManifest.specs) {
          const tlaPath = path.resolve(tlaBase, spec.tlaPath);
          const tlaContent = await fs.readFile(tlaPath, 'utf-8');
          // 快照解析已收敛至 bdd-logic.ts 的 parseTlaSpecSnapshot（纯函数）
          tlaSnapshots.push(parseTlaSpecSnapshot(tlaContent, spec.id));
        }
      } catch (e) {
        console.error(`[D4] 无法读取 TLA+ manifest: ${(e as Error).message}`);
      }
    } else {
      console.error('提示：未提供 --tla-manifest，跳过 D4 TLA+ 等价校验');
    }
  }

  // 读取 RTM（用于 D7）
  // RTM 标准结构见 gate-logic.ts 的 RTMMatrixShape：{ rows: [{ requirementId, ... }] }
  let rtmRows: BddCheckInput['rtmRows'] | undefined;
  if (args.rtmFile) {
    try {
      const rtm = await readJson<{ rows: Array<{ requirementId: string; acceptanceTest: string | null; systemTest: string | null; integrationTest: string | null; unitTest: string | null }> }>(args.rtmFile);
      rtmRows = rtm.rows.map(r => ({
        reqId: r.requirementId,
        acceptanceTest: r.acceptanceTest,
        systemTest: r.systemTest,
        integrationTest: r.integrationTest,
        unitTest: r.unitTest,
      }));
    } catch (e) {
      console.error(`[D7] 无法读取 RTM: ${(e as Error).message}`);
    }
  }

  // 读取 cucumber 报告（阶段 5-8 用于 D5）
  let cucumberReport: BddCheckInput['cucumberReport'] | undefined;
  if (phase >= 5 && args.cucumberReportFile) {
    try {
      const report = await readJson<{ elements?: Array<{ steps?: Array<{ result?: { status?: string } }> }> }>(args.cucumberReportFile);
      let undefinedCount = 0, pendingCount = 0, failedCount = 0;
      for (const el of report.elements ?? []) {
        for (const step of el.steps ?? []) {
          if (step.result?.status === 'undefined') undefinedCount++;
          if (step.result?.status === 'pending') pendingCount++;
          if (step.result?.status === 'failed') failedCount++;
        }
      }
      cucumberReport = { undefinedCount, pendingCount, failedCount };
    } catch (e) {
      console.error(`[D5] 无法读取 cucumber 报告: ${(e as Error).message}`);
    }
  }

  // 提取 graph SD 节点（供 D8 SD Coverage 交叉校验）
  let graphSdNodes: string[] | undefined;
  if (args.graphFile) {
    try {
      const g = await readJson<{ nodes?: Array<{ id: string; type: string }> }>(args.graphFile);
      if (Array.isArray(g.nodes)) {
        graphSdNodes = g.nodes.filter(n => n.type === 'SD').map(n => n.id);
      }
    } catch (e) {
      console.error(`[D8] 无法读取 graph 文件: ${(e as Error).message}`);
    }
  }

  // 调用纯逻辑校验
  const result = checkBddModel({
    manifest,
    phase,
    parsedFeatures,
    tlaSnapshots,
    rtmRows,
    cucumberReport,
    graphSdNodes,
  });
  const exitCode = result.exitCode;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    const allViolations = [
      ...result.dimensions.headerCompleteness,
      ...result.dimensions.stateMachineCompleteness,
      ...result.dimensions.tlaEquivalence,
      ...result.dimensions.stepBinding,
      ...result.dimensions.scenarioPathValidity,
      ...result.dimensions.rtmMapping,
      ...result.dimensions.sdCoverage,
    ];
    printJsonReport({
      type: 'bdd',
      passed: result.passed,
      reasons: allViolations,
      violations: buildViolationDistribution(allViolations.length),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return exitCode;
  }

  // 输出报告
  console.log(`\n=== BDD Model Check Report (phase ${phase}) ===`);
  console.log(`Passed: ${result.passed}`);
  console.log(`ExitCode: ${result.exitCode}`);
  console.log(`Summary: ${result.summary}`);
  console.log(`\n--- D1 Header Completeness: ${result.dimensions.headerCompleteness.length} violations`);
  for (const v of result.dimensions.headerCompleteness) console.log(`  - ${v}`);
  console.log(`\n--- D3 State Machine Completeness: ${result.dimensions.stateMachineCompleteness.length} violations`);
  for (const v of result.dimensions.stateMachineCompleteness) console.log(`  - ${v}`);
  console.log(`\n--- D4 TLA+ Equivalence: ${result.dimensions.tlaEquivalence.length} violations`);
  for (const v of result.dimensions.tlaEquivalence) console.log(`  - ${v}`);
  console.log(`\n--- D5 Step Binding: ${result.dimensions.stepBinding.length} violations`);
  for (const v of result.dimensions.stepBinding) console.log(`  - ${v}`);
  console.log(`\n--- D6 Scenario Path Validity: ${result.dimensions.scenarioPathValidity.length} violations`);
  for (const v of result.dimensions.scenarioPathValidity) console.log(`  - ${v}`);
  console.log(`\n--- D7 RTM Mapping: ${result.dimensions.rtmMapping.length} violations`);
  for (const v of result.dimensions.rtmMapping) console.log(`  - ${v}`);
  console.log(`\n--- D8 SD Coverage: ${result.dimensions.sdCoverage.length} violations`);
  for (const v of result.dimensions.sdCoverage) console.log(`  - ${v}`);

  // JSON 摘要
  console.log(`\n=== JSON Summary ===`);
  const summary = { type: 'bdd', passed: result.passed, exitCode: result.exitCode, summary: result.summary };
  console.log('BDD_JSON ' + JSON.stringify(summary));

  // 写入 gate-logs（失败不污染退出码）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.resolve(manifestDir, '..', '.w-model', 'gate-logs');
  try {
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(path.join(logDir, `${timestamp}-bdd.json`), JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`[gate-logs] 写入失败（不影响校验结果）: ${(e as Error).message}`);
  }

  return result.exitCode;
}

main().then(exitCode => {
  // 错误路径已由 exitWithError 设置 process.exitCode（非 undefined）→ 让 Node 自然退出，避免 process.exit 截断 ERROR_JSON
  if (process.exitCode === undefined) {
    process.exit(exitCode);
  }
}).catch(e => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: e instanceof Error ? e.message : String(e),
    exitCode: 2,
  });
});
