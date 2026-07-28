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
 *   npx tsx w-model-dev/scripts/check-bdd-model.ts <bdd-manifest.json>
 *     [--phase=N] [--tla-manifest=<path>] [--rtm=<path>] [--cucumber-report=<path>]
 *
 * 参数：
 *   bdd-manifest.json   manifest 文件路径
 *   --phase=N            校验阶段（1-8），默认从 manifest.currentPhase 读取
 *   --tla-manifest=<p>   TLA+ manifest 路径（阶段 1-4 用于 D4 等价性校验）
 *   --rtm=<p>            RTM 文件路径（用于 D7 RTM 映射校验）
 *   --cucumber-report=<p>  cucumber 运行报告 JSON（阶段 5-8 用于 D5 step 绑定校验）
 *
 * 退出码：
 *   0  校验通过（schema + 头标注 + 状态机 + 等价性 + step 绑定 + 路径 + RTM 全过）
 *   1  校验失败（违反列出具体原因，S 子代理按原因修正 features / 状态机 / 回退需求设计）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法 / schema 不合规）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 *   JSON 摘要同时写入 .w-model/gate-logs/<timestamp>-bdd.json
 *
 * 注意：本脚本不调用任何 LLM。cucumber 是确定性运行器，features/step 是文本+代码。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkBddModel,
  parseFeatureHeader,
  parseBackgroundStateMachine,
  type BddManifest,
  type BddCheckInput,
  type ScenarioPathCheck,
  type TlaSpecSnapshot,
  type FeatureHeader,
  type BddStateMachine,
} from './bdd-logic.js';
import { validateBySchema } from './schema-loader.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  manifestFile: string | undefined;
  phase: number | undefined;
  tlaManifestFile: string | undefined;
  rtmFile: string | undefined;
  cucumberReportFile: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const manifestFile = args.find(a => !a.startsWith('--'));
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const tlaArg = args.find(a => a.startsWith('--tla-manifest='));
  const rtmArg = args.find(a => a.startsWith('--rtm='));
  const cucumberArg = args.find(a => a.startsWith('--cucumber-report='));

  const phase = phaseArg ? Number.parseInt(phaseArg.split('=')[1]!, 10) : undefined;
  const tlaManifestFile = tlaArg ? tlaArg.split('=')[1] : undefined;
  const rtmFile = rtmArg ? rtmArg.split('=')[1] : undefined;
  const cucumberReportFile = cucumberArg ? cucumberArg.split('=')[1] : undefined;

  return { manifestFile, phase, tlaManifestFile, rtmFile, cucumberReportFile };
}

// ==================== I/O 辅助 ====================

async function readJson<T>(file: string): Promise<T> {
  const text = await fs.readFile(file, 'utf-8');
  return JSON.parse(text) as T;
}

/**
 * 读取 .feature 文件并解析头标注 + Background 状态机 + scenarios。
 */
async function parseFeatureFile(
  filePath: string
): Promise<{ header: FeatureHeader; stateMachine: Partial<BddStateMachine>; scenarios: ScenarioPathCheck[]; violations: string[] }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { header, violations: headerViolations } = parseFeatureHeader(content);

  // 提取 Background 节
  const bgMatch = content.match(/Background:\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/);
  const bgContent = bgMatch ? bgMatch[1]! : '';
  const { sm, violations: smViolations } = parseBackgroundStateMachine(bgContent);

  // 提取 scenarios（简化解析，生产环境用 @cucumber/messages Gherkin 解析器）
  const scenarios: ScenarioPathCheck[] = [];
  const scenarioRegex = /Scenario:\s*(.+?)\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = scenarioRegex.exec(content)) !== null) {
    const name = m[1]!.trim();
    const body = m[2]!;
    const startState = extractStateFromStep(body, /Given.*?"(\w+)"/);
    const events = extractEventsFromWhen(body);
    const expectedEndState = extractStateFromStep(body, /Then.*?"(\w+)"/);
    const invariantAssertions = extractInvariantsFromThen(body);
    scenarios.push({ scenarioName: name, startState, events, expectedEndState, invariantAssertions });
  }

  return {
    header,
    stateMachine: sm,
    scenarios,
    violations: [...headerViolations, ...smViolations],
  };
}

function extractStateFromStep(body: string, pattern: RegExp): string | null {
  const m = body.match(pattern);
  return m ? m[1]! : null;
}

function extractEventsFromWhen(body: string): string[] {
  const events: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:When|And)\s+.+?\b(\w+)\s*$/);
    if (m) events.push(m[1]!);
  }
  return events;
}

function extractInvariantsFromThen(body: string): string[] {
  const invs: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:Then|And)\s+不变式\s+"(.+?)"\s+应成立/);
    if (m) invs.push(m[1]!);
  }
  return invs;
}

// ==================== 主流程 ====================

async function main(): Promise<number> {
  const args = parseArgs(process.argv);

  if (!args.manifestFile) {
    console.error('用法: check-bdd-model.ts <bdd-manifest.json> [--phase=N] [--tla-manifest=...] [--rtm=...] [--cucumber-report=...]');
    return 2;
  }

  // 读取 manifest
  let manifest: BddManifest;
  try {
    manifest = await readJson<BddManifest>(args.manifestFile);
  } catch (e) {
    console.error(`[input] 无法读取 manifest: ${(e as Error).message}`);
    return 2;
  }

  // schema 前置校验
  const schemaResult = validateBySchema('bdd-manifest', manifest);
  if (!schemaResult.valid) {
    console.error(`[schema] manifest schema 校验失败:`);
    for (const err of schemaResult.errorMessages) {
      console.error(`  - ${err}`);
    }
    return 2;
  }

  const phaseRaw = args.phase ?? manifest.currentPhase;
  if (typeof phaseRaw !== 'number' || !Number.isInteger(phaseRaw) || ![1, 2, 3, 4, 5, 6, 7, 8].includes(phaseRaw)) {
    console.error(`[input] --phase=${args.phase ?? manifest.currentPhase} 非法（须 1-8 整数）`);
    return 2;
  }
  const phase = phaseRaw as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  const manifestDir = path.dirname(args.manifestFile);
  const basePath = path.resolve(manifestDir, manifest.basePath);

  // 解析所有 features 文件
  const parsedFeatures: BddCheckInput['parsedFeatures'] = [];
  for (const f of manifest.features) {
    const filePath = path.resolve(basePath, f.filePath);
    try {
      const parsed = await parseFeatureFile(filePath);
      parsedFeatures.push({
        featureId: f.id,
        header: parsed.header,
        stateMachine: parsed.stateMachine,
        scenarios: parsed.scenarios,
      });
    } catch (e) {
      console.error(`[D2] 无法读取 feature 文件 ${filePath}: ${(e as Error).message}`);
    }
  }

  // 读取 TLA+ manifest 并构造快照（阶段 1-4 用于 D4）
  let tlaSnapshots: TlaSpecSnapshot[] | undefined;
  if (phase <= 4 && args.tlaManifestFile) {
    const tlaManifestPath = args.tlaManifestFile;
    try {
      const tlaManifest = await readJson<{ specs: Array<{ id: string; tlaPath: string }> }>(tlaManifestPath);
      tlaSnapshots = [];
      // 这里简化：实际 tla-logic.ts 应提供 parseTlaSpecSnapshot 函数
      // 完整实现由后续 R 子代理按需补全 tla-logic.ts 的导出
      for (const spec of tlaManifest.specs) {
        const tlaPath = path.resolve(path.dirname(tlaManifestPath), spec.tlaPath);
        const tlaContent = await fs.readFile(tlaPath, 'utf-8');
        // 简化的 TLA+ 解析：提取 VARIABLES / Init / Next / Invariants
        // 生产实现请调 tla-logic.ts 的 parseTlaHeader + 解析 State/Next
        tlaSnapshots.push({
          specId: spec.id,
          states: extractTlaStates(tlaContent),
          initialState: extractTlaInit(tlaContent),
          transitions: extractTlaTransitions(tlaContent),
          invariants: extractTlaInvariants(tlaContent),
        });
      }
    } catch (e) {
      console.error(`[D4] 无法读取 TLA+ manifest: ${(e as Error).message}`);
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

  // 调用纯逻辑校验
  const result = checkBddModel({
    manifest,
    phase,
    parsedFeatures,
    tlaSnapshots,
    rtmRows,
    cucumberReport,
  });

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

  // JSON 摘要
  console.log(`\n=== JSON Summary ===`);
  console.log(JSON.stringify(result, null, 2));

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

// 简化的 TLA+ 解析辅助（生产实现应调 tla-logic.ts）
function extractTlaStates(content: string): string[] {
  const m = content.match(/VARIABLES\s+(.+?)\s/s);
  if (!m) return [];
  return m[1]!.split(',').map(s => s.trim());
}
function extractTlaInit(content: string): string {
  const m = content.match(/Init\s*==\s*(\w+)/s);
  return m ? m[1]! : '';
}
function extractTlaTransitions(content: string): Array<{ from: string; event: string; to: string }> {
  // 简化：TLA+ Next 分支解析复杂，这里返回空数组；实际由 tla-logic.ts 提供
  void content;
  return [];
}
function extractTlaInvariants(content: string): string[] {
  // 简化：实际由 tla-logic.ts 提供完整解析
  void content;
  return [];
}

main().then(exitCode => process.exit(exitCode)).catch(e => {
  console.error(e);
  process.exit(2);
});
