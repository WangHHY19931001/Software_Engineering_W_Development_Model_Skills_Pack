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

import { promises as fs, existsSync } from 'node:fs';
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
    const expectedEndState = extractLastStateFromThen(body);
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

/**
 * 从 scenario body 中提取最后一个 Then 步骤声明的状态。
 * 多 When-Then 场景中，期望终态应为最后一个 Then 声明的状态，而非第一个。
 */
function extractLastStateFromThen(body: string): string | null {
  const matches = [...body.matchAll(/Then.*?"(\w+)"/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1]![1]!;
}

function extractEventsFromWhen(body: string): string[] {
  const events: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    // 只从 When 步骤提取事件名（不在 And 步骤中提取，因为 And 可能用于 Then 的延续）
    // 事件名是行末括号中的英文单词，如 (CreateComment)，或行末最后一个英文单词
    // 支持两种格式：
    //   1. When 已认证用户对文章发表评论 (CreateComment) → CreateComment
    //   2. When 用户提交有效的注册信息 (Register) → Register
    const m = line.match(/^\s*When\s+.+?\b(\w+)\s*\)?\s*$/);
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
      const parsed = await parseFeatureFile(resolved);
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

// ==================== TLA+ 快照解析辅助 ====================
//
// 从 .tla 文件内容中提取状态机快照（states / initialState / transitions / invariants），
// 供 D4 BDD↔TLA+ 等价性校验使用。
//
// 解析约定（与本项目所有 .tla 文件一致）：
//   - 状态变量：在 TypeInvariant 中以 `var \in {"s1", "s2", ...}` 声明（区别于计数器 `var \in Nat`）
//   - 初始状态：在 Init 中以 `var = "Value"` 赋值
//   - 转移：每个 Action 定义中 `var = "From"` (或 `var \in {...}`) + `var' = "To"`
//   - 不变式：`var = "State" => condition` 格式，归一化为 `State => condition`

/**
 * 提取 TLA+ 规格中的状态变量名（第一个在 TypeInvariant 中以 \in {"..."} 声明的变量）。
 */
/**
 * 提取 TLA+ 规格中枚举状态数最多的状态变量名。
 * 当规格有多个带枚举值的状态变量时（如 L1 的 systemState 和 userState），
 * 选择状态数最多的那个（通常是 BDD 对应的用户行为状态变量）。
 */
function extractStateVarName(content: string): string | null {
  const typeDefMatch = content.match(/\b(?:TypeOK|TypeInvariant|Invariants)\s*==/);
  if (!typeDefMatch) return null;
  const typeInvStart = typeDefMatch.index!;
  const afterTypeInv = content.slice(typeInvStart);
  const bodyOffset = typeDefMatch[0].length;
  const endMatch = afterTypeInv.slice(bodyOffset).match(/\n\w+\s*==|\n====/);
  const typeInvBody = endMatch ? afterTypeInv.slice(0, endMatch.index! + bodyOffset) : afterTypeInv;

  const varPattern = /(\w+)\s*\\in\s*\{((?:"[^"]+"\s*,?\s*)+)\}/g;
  let bestVar: string | null = null;
  let maxCount = 0;
  let match: RegExpExecArray | null;
  while ((match = varPattern.exec(typeInvBody)) !== null) {
    const valMatches = match[2]!.match(/"([^"]+)"/g);
    const count = valMatches ? valMatches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      bestVar = match[1]!;
    }
  }
  return bestVar;
}

/**
 * 提取 TLA+ 规格中的所有状态值（从 TypeInvariant 的 \in {"s1", "s2", ...} 中解析）。
 */
function extractTlaStates(content: string): string[] {
  const states: string[] = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return states;
  const typeDefMatch = content.match(/\b(?:TypeOK|TypeInvariant|Invariants)\s*==/);
  if (!typeDefMatch) return states;
  const typeInvStart = typeDefMatch.index!;
  const afterTypeInv = content.slice(typeInvStart);
  const bodyOffset = typeDefMatch[0].length;
  const endMatch = afterTypeInv.slice(bodyOffset).match(/\n\w+\s*==|\n====/);
  const typeInvBody = endMatch ? afterTypeInv.slice(0, endMatch.index! + bodyOffset) : afterTypeInv;

  // 仅匹配第一个状态变量的 \in {"val1", "val2", ...}（不匹配 \in Nat）
  // 通过 stateVar 名称定位：stateVar \in { ... }
  const stateVarPattern = new RegExp('\\b' + stateVar + '\\s*\\\\in\\s*\\{((?:"[^"]+"\\s*,?\\s*)+)\\}');
  const m = stateVarPattern.exec(typeInvBody);
  if (m) {
    const valMatches = m[1]!.match(/"([^"]+)"/g);
    if (valMatches) {
      for (const v of valMatches) {
        const val = v.slice(1, -1);
        if (!states.includes(val)) states.push(val);
      }
    }
  }
  return states;
}

/**
 * 提取 TLA+ 规格的初始状态值（从 Init 中解析状态变量的赋值）。
 */
function extractTlaInit(content: string): string {
  const stateVar = extractStateVarName(content);
  if (!stateVar) return '';

  const initStart = content.indexOf('Init ==');
  if (initStart === -1) return '';
  const afterInit = content.slice(initStart);
  const endMatch = afterInit.slice(8).match(/\n\w+\s*==|\n====/);
  const initBody = endMatch ? afterInit.slice(0, endMatch.index! + 8) : afterInit;

  // 匹配 stateVar = "Value"（不匹配 stateVar' = ...）
  const m = initBody.match(new RegExp(stateVar + '\\s*=\\s*"([^"]+)"'));
  return m ? m[1]! : '';
}

/**
 * 提取 TLA+ 规格的转移列表（从各 Action 定义中解析 from→to，事件名转 camelCase）。
 * 处理 `var \in {"s1", "s2"}` 形式的多 from-state 展开。
 */
function extractTlaTransitions(content: string): Array<{ from: string; event: string; to: string }> {
  const transitions: Array<{ from: string; event: string; to: string }> = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return transitions;

  // 从 Next == 中提取 action 名称列表
  const nextStart = content.indexOf('Next ==');
  if (nextStart === -1) return transitions;
  const afterNext = content.slice(nextStart);
  const specStart = afterNext.indexOf('Spec ==');
  const nextBody = specStart > 0 ? afterNext.slice(0, specStart) : afterNext;
  // 匹配 \/ ActionName 或 \/ \E var \in set : ActionName(args)
  // 注意：JS 正则中 \E 不是转义序列，需用 \\E 匹配字面反斜杠+E
  const actionNames = [...nextBody.matchAll(/\\\/\s*(?:\\E[^:]+:\s*)?(\w+)/g)].map(m => m[1]!);

  for (const actionName of actionNames) {
    // 定位 action 定义体（支持 ActionName == 和 ActionName(params) == 两种形式）
    const defRegex = new RegExp('\\b' + actionName + '\\s*(?:\\([^)]*\\))?\\s*==');
    const defMatch = defRegex.exec(content);
    if (!defMatch) continue;
    const afterDef = content.slice(defMatch.index + defMatch[0].length);
    const endMatch = afterDef.match(/\n\w+\s*==|\n====/);
    const actionBody = endMatch ? afterDef.slice(0, endMatch.index) : afterDef;

    // 提取 to-state: stateVar' = "Value"
    const toRegex = new RegExp(stateVar + "'\\s*=\\s*\"([^\"]+)\"");
    const toMatch = actionBody.match(toRegex);
    if (!toMatch) continue;

    const toState = toMatch[1]!;
    // 事件名：PascalCase → camelCase
    const event = actionName.charAt(0).toLowerCase() + actionName.slice(1);

    // 提取 from-state: stateVar = "Value" 或 stateVar \in {"s1", "s2", ...}
    const fromSingleRegex = new RegExp(stateVar + '\\s*=\\s*"([^"]+)"');
    const fromSingleMatch = actionBody.match(fromSingleRegex);
    if (fromSingleMatch) {
      transitions.push({ from: fromSingleMatch[1]!, event, to: toState });
    } else {
      const fromSetRegex = new RegExp(stateVar + '\\s*\\\\in\\s*\\{((?:"[^"]+"\\s*,?\\s*)+)\\}');
      const fromSetMatch = actionBody.match(fromSetRegex);
      if (fromSetMatch) {
        const fromStates = fromSetMatch[1]!.match(/"([^"]+)"/g)!;
        for (const fs of fromStates) {
          transitions.push({ from: fs.slice(1, -1), event, to: toState });
        }
      }
    }
  }

  return transitions;
}

/**
 * 提取 TLA+ 规格的不变式列表（归一化 `var = "State" => cond` 为 `State => cond`）。
 */
function extractTlaInvariants(content: string): string[] {
  const invariants: string[] = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return invariants;

  // 匹配 stateVar = "State" => condition（不匹配 stateVar' = ...）
  const invRegex = new RegExp(
    stateVar + '\\s*=\\s*"([^"]+)"\\s*=>\\s*([^\\n]+)',
    'g'
  );

  const matches = [...content.matchAll(invRegex)];
  for (const m of matches) {
    const stateValue = m[1]!;
    const condition = m[2]!.trim();
    invariants.push(`${stateValue} => ${condition}`);
  }

  return invariants;
}

main().then(exitCode => process.exit(exitCode)).catch(e => {
  console.error(e);
  process.exit(2);
});
