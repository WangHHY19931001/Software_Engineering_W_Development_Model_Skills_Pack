#!/usr/bin/env tsx
/**
 * 工件质量门校验脚本（Artifact Gate Checker）
 *
 * 对应 SSoT §10.5「工件质量门」。供 AI Agent 在验收测试阶段直接调用，
 * 判定 W 模型产出物是否满足放行条件。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
 *
 * 参数：
 *   project-dir  项目根目录（默认：当前工作目录）
 *
 * 读取：
 *   <project-dir>/.w-model/rtm.json   （由 Agent 在执行 /wm 命令时维护）
 *
 * 退出码：
 *   0  质量门通过（RTM 需求覆盖率 100% 且四级测试全部通过）
 *   1  质量门未通过（reasons 列出具体原因）
 *   2  输入错误（RTM 文件不存在 / 格式非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkArtifactGate,
  checkUatPathMappingBackfill,
  type GateGraph,
  type PhaseOption,
  type RTMMatrixShape,
  type UatPathMappingRow,
} from './gate-logic.js';
import { validateBySchema } from './schema-loader.js';
import { exitWithError } from './lib/cli-error.js';

const RTM_RELATIVE_PATH = path.join('.w-model', 'rtm.json');
const MANIFEST_RELATIVE_PATH = path.join('.w-model', 'tla-manifest.json');
const BDD_MANIFEST_RELATIVE_PATH = path.join('.w-model', 'bdd-manifest.json');

/**
 * 从 uat-path-mapping.md 内容解析映射行（round28 G-B B4：严格解析）。
 * 格式：| UAT-001 | POST /api/posts | POST /api/posts | 直接 | ... |
 *
 * 严格化规则：
 * - 表头校验：数据行首列必须为 `UAT-` 前缀（`UAT-\d+`）；表头行 / 分隔行 / 其它表格行一律忽略。
 * - 数据行格式不符（单元格数 < 4 或前 4 列含空单元格）→ 记录 violation，不静默跳行。
 * - 文件非空但解析不出任何映射行 → violation「uat-path-mapping 无有效映射行」。
 */
export interface UatPathMappingParseResult {
  rows: UatPathMappingRow[];
  violations: string[];
}

export function parseUatPathMappingFromContent(content: string): UatPathMappingParseResult {
  const rows: UatPathMappingRow[] = [];
  const violations: string[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (line === '' || !line.startsWith('|')) continue; // 非表格行（标题 / 说明段落）
    let cells = line.split('|').map((c) => c.trim());
    cells = cells.slice(1); // 去掉行首 '|' 前的空串
    if (cells.length > 0 && cells[cells.length - 1] === '') {
      cells = cells.slice(0, -1); // 去掉行尾 '|' 产生的空串
    }
    const firstCol = cells[0] ?? '';
    // 表头校验：首列必须为 UAT- 前缀（表头 / 分隔行 / 其它表格一律忽略）
    if (!/^UAT-\d+$/.test(firstCol)) continue;
    const lineNo = i + 1;
    // 数据行格式校验：单元格数须 ≥4
    if (cells.length < 4) {
      violations.push(`uat-path-mapping 第${lineNo}行畸形（单元格数 ${cells.length}，须 ≥4）`);
      continue;
    }
    const actualPath = cells[2] ?? '';
    const mappingType = cells[3] ?? '';
    // 前 4 列（uatId/设计路径/实际路径/映射类型）任一为空 → 畸形
    if (cells[1] === '' || actualPath === '' || mappingType === '') {
      violations.push(`uat-path-mapping 第${lineNo}行畸形（含空单元格）`);
      continue;
    }
    rows.push({ uatId: firstCol, actualPath, mappingType });
  }
  if (rows.length === 0 && content.trim() !== '') {
    violations.push('uat-path-mapping 无有效映射行');
  }
  return { rows, violations };
}

/**
 * uat-path-mapping 内容综合校验（B4 严格解析 + 回填校验）。
 * 供 check-artifact-gate CLI 阶段 5 / 终检与 self-test 共用。
 */
export function checkUatPathMappingContent(content: string): string[] {
  const { rows, violations } = parseUatPathMappingFromContent(content);
  return [...violations, ...checkUatPathMappingBackfill(rows)];
}

// ==================== --phase 参数解析（P1.1） ====================
/**
 * 解析 --phase=N 或 --phase N 参数。
 * 返回 undefined 表示未传（默认终检 phase=8，向后兼容）。
 * 非法值（非 1-8）退出码 2。
 */
function parsePhaseArg(argv: string[]): PhaseOption | undefined {
  // B6（round28 G-B）：严格整数校验——字符串全数字 + Number.isInteger，
  // 拒绝 "5abc" / "3.7" 这类 parseInt 会部分解析的非法输入
  const strictPhase = (s: string): PhaseOption | undefined => {
    if (!/^\d+$/.test(s)) return undefined;
    const val = Number(s);
    if (!Number.isInteger(val) || val < 1 || val > 8) return undefined;
    return val as PhaseOption;
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '--phase' || arg === '-p') {
      const next = argv[i + 1] ?? '';
      const val = strictPhase(next);
      if (val === undefined) {
        exitWithError({
          category: 'ARG_INVALID',
          message: `参数非法 --phase=${next}`,
          detail: '须为 1-8 的整数',
          exitCode: 2,
        });
      }
      return val;
    }
    const eqMatch = arg.match(/^--phase=(.+)$/);
    if (eqMatch) {
      const val = strictPhase(eqMatch[1] ?? '');
      if (val === undefined) {
        exitWithError({
          category: 'ARG_INVALID',
          message: `参数非法 --phase=${eqMatch[1] ?? ''}`,
          detail: '须为 1-8 的整数',
          exitCode: 2,
        });
      }
      return val;
    }
  }
  return undefined;
}

/**
 * 解析位置参数：第一个不以 -- 开头的参数为 project-dir。
 * 兼容 --phase=N 出现在任意位置的场景。
 */
function parseProjectDir(argv: string[]): string {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith('--')) {
      // 跳过 --phase N 形式的值
      if ((arg === '--phase' || arg === '-p') && i + 1 < argv.length) {
        i++;
      }
      continue;
    }
    return arg;
  }
  return process.cwd();
}

async function main(): Promise<void> {
  const phaseOption = parsePhaseArg(process.argv);
  if (process.exitCode !== undefined) return; // --phase 非法已由 exitWithError 报告（ARG_INVALID），终止主流程
  const projectDir = parseProjectDir(process.argv);
  const rtmFile = path.resolve(projectDir, RTM_RELATIVE_PATH);

  let raw: string;
  try {
    raw = await fs.readFile(rtmFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        message: '文件不存在',
        file: rtmFile,
        detail: '请先在项目内执行 /wm 命令走完 W 模型阶段以生成 .w-model/rtm.json',
        exitCode: 2,
      });
      return;
    }
    throw err;
  }

  let matrix: RTMMatrixShape;
  try {
    matrix = JSON.parse(raw) as RTMMatrixShape;
  } catch {
    exitWithError({
      category: 'FILE_PARSE',
      message: '文件解析失败（非合法 JSON）',
      file: rtmFile,
      exitCode: 2,
    });
    return;
  }

  // ==================== TLA+ 资产读取（spec §3.4.4） ====================
  // P2.6 graph 资产自动发现：按优先级查找 .w-model/ingestion/ 下的 graph 资产
  const ingestionDir = path.resolve(projectDir, '.w-model', 'ingestion');
  const graphCandidates = [
    path.join(ingestionDir, 'graph.json'),
    path.join(ingestionDir, 'consolidated-phase4.json'),
    path.join(ingestionDir, 'consolidated-phase3.json'),
    path.join(ingestionDir, 'consolidated-phase2.json'),
    path.join(ingestionDir, 'consolidated-phase1.json'),
  ];
  let graph: GateGraph | undefined;
  let graphSource = '';
  for (const candidate of graphCandidates) {
    try {
      const graphRaw = await fs.readFile(candidate, 'utf-8');
      const graphParsed = JSON.parse(graphRaw) as GateGraph;
      if (graphParsed && Array.isArray(graphParsed.nodes)) {
        graph = graphParsed;
        graphSource = path.basename(candidate);
        break;
      }
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        console.error(`⚠ ${path.basename(candidate)} 读取失败（忽略）: ${e.message}`);
      }
    }
  }

  // 2. 检查 tla-manifest.json 存在性 + specs 非空
  const manifestFile = path.resolve(projectDir, MANIFEST_RELATIVE_PATH);
  let manifestExists = false;
  try {
    const manifestRaw = await fs.readFile(manifestFile, 'utf-8');
    const manifestParsed = JSON.parse(manifestRaw) as { specs?: unknown[] };
    if (manifestParsed && Array.isArray(manifestParsed.specs) && manifestParsed.specs.length > 0) {
      manifestExists = true;
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.error(`⚠ tla-manifest.json 读取失败（忽略，按不存在处理）: ${e.message}`);
    }
    // ENOENT 或解析失败 → manifestExists 保持 false
  }

  // ==================== BDD 资产读取（spec §13.2 #18） ====================
  // 与 TLA+ manifest 校验对称：检查 bdd-manifest.json 存在性 + schema + features 文件存在性
  // + stateMachines 七要素非空（states/acceptingStates/transitions/invariants）。
  // 阶段 4 后才要求 bdd-manifest.json 存在（阶段 1-3 可能还未创建）。
  const bddManifestFile = path.resolve(projectDir, BDD_MANIFEST_RELATIVE_PATH);
  const bddViolations: string[] = [];
  let bddManifestExists = false;
  const effectivePhase: PhaseOption = phaseOption ?? 8;
  try {
    const bddRaw = await fs.readFile(bddManifestFile, 'utf-8');
    const bddManifestParsed = JSON.parse(bddRaw) as unknown;
    bddManifestExists = true;
    const bddSchemaResult = validateBySchema('bdd-manifest', bddManifestParsed);
    if (!bddSchemaResult.valid) {
      bddViolations.push(`[artifact:bdd] manifest schema failed: ${bddSchemaResult.errorMessages.join('; ')}`);
    } else {
      const bddManifest = bddManifestParsed as {
        basePath: string;
        features: Array<{ filePath: string }>;
        stateMachines: Array<{
          id: string;
          states: string[];
          acceptingStates: string[];
          transitions: unknown[];
          invariants: string[];
        }>;
      };
      // 检查 features 文件存在
      const bddBasePath = path.resolve(projectDir, bddManifest.basePath);
      for (const f of bddManifest.features ?? []) {
        const fp = path.resolve(bddBasePath, f.filePath);
        try {
          await fs.access(fp);
        } catch {
          bddViolations.push(`[artifact:bdd] feature file missing: ${f.filePath}`);
        }
      }
      // 检查 stateMachines 七要素非空
      for (const sm of bddManifest.stateMachines ?? []) {
        if (!sm.states?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no states`);
        if (!sm.acceptingStates?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no accepting states`);
        if (!sm.transitions?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no transitions`);
        if (!sm.invariants?.length) bddViolations.push(`[artifact:bdd] SM "${sm.id}" has no invariants`);
      }
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.error(`⚠ bdd-manifest.json 读取失败（忽略，按不存在处理）: ${e.message}`);
    }
    // ENOENT 或解析失败 → bddManifestExists 保持 false
  }
  if (!bddManifestExists && effectivePhase >= 4) {
    // 阶段 4 后必须有 BDD manifest
    bddViolations.push('[artifact:bdd] .w-model/bdd-manifest.json missing (required after phase 4)');
  }

  // 调用纯逻辑校验（传入 graph + manifestExists + phaseOption，启用 TLA+ 资产校验与阶段分层）
  const result = checkArtifactGate(matrix, { graph, manifestExists, phaseOption });

  // uat-path-mapping 校验违反（计入终检结果，B4/B5：解析严格化 + 阶段5/终检均校验）
  const uatMappingViolations: string[] = [];

  // P0-1: phase=1 校验 docs/uat-path-mapping.md 存在性
  if (phaseOption === 1) {
    const uatMappingPath = path.resolve(projectDir, 'docs', 'uat-path-mapping.md');
    try {
      await fs.access(uatMappingPath);
    } catch {
      uatMappingViolations.push('P0-1 校验失败：docs/uat-path-mapping.md 不存在，阶段1须产出该文件（见 phase-1-requirements.md §输出）');
    }
  }

  // P0-1: phase=5 / 终检（B5：无 --phase 终检默认 phase 8 也校验）校验 uat-path-mapping 回填
  if (phaseOption === 5 || phaseOption === undefined) {
    const uatMappingPath = path.resolve(projectDir, 'docs', 'uat-path-mapping.md');
    try {
      const content = await fs.readFile(uatMappingPath, 'utf-8');
      uatMappingViolations.push(...checkUatPathMappingContent(content));
    } catch {
      uatMappingViolations.push('P0-1 校验失败：docs/uat-path-mapping.md 不存在或无法读取');
    }
  }

  // 合并 uat-path-mapping + BDD 资产校验违反到终检结果（BDD 校验在 CLI 层完成，gate-logic 不感知 BDD）
  const allReasons = [...result.reasons, ...uatMappingViolations, ...bddViolations];
  const overallPassed =
    result.passed && uatMappingViolations.length === 0 && bddViolations.length === 0;

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('工件质量门校验（Artifact Gate）');
  console.log('═'.repeat(60));
  console.log(`项目目录      : ${projectDir}`);
  console.log(`RTM 文件      : ${rtmFile}`);
  console.log(`校验阶段      : phase=${phaseOption ?? 8}${phaseOption ? '（阶段级）' : '（终检，默认）'}`);
  console.log(`RTM 覆盖率    : ${result.coveragePercent}%`);
  console.log(`单元覆盖率    : ${result.unitCoveragePercent}%`);
  console.log(`TLA+ 资产     : ${manifestExists ? '✓ manifest 存在且 specs 非空' : '✗ manifest 缺失或 specs 为空'}`);
  console.log(`BDD 资产      : ${bddManifestExists ? '✓ bdd-manifest.json 存在且 schema 通过' : '✗ bdd-manifest.json 缺失或 schema 失败'}`);
  console.log(`graph 资产    : ${graph ? `✓ ${graphSource}（${graph.nodes.length} 节点）` : '⚠ 未发现任何 graph 资产'}`);
  console.log(`校验结果      : ${overallPassed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (overallPassed) {
    console.log('所有放行条件均满足：RTM 需求覆盖率 100% 且四级测试全部通过（含 BDD 资产校验）。');
  } else {
    console.log('未通过原因：');
    for (const r of allReasons) {
      console.log(`  - ${r}`);
    }
  }

  // 末尾 JSON 摘要（供 Agent 程序解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = overallPassed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('GATE_JSON ' + JSON.stringify({
    type: 'artifact',
    passed: overallPassed,
    exitCode,
    coveragePercent: result.coveragePercent,
    unitCoveragePercent: result.unitCoveragePercent,
    missingItems: result.missingItems,
    reasons: allReasons,
    bddManifestExists,
  }));

  process.exit(exitCode);
}

// isMain 守卫：仅直接执行时运行 main，被 self-test 等 import 时不触发
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
