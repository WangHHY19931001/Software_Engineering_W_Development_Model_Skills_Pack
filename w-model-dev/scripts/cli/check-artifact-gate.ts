#!/usr/bin/env tsx
/**
 * 工件质量门校验脚本（Artifact Gate Checker）
 *
 * 对应 SSoT §10.5「工件质量门」。供 AI Agent 在验收测试阶段直接调用，判定 W 模型产出物是否满足放行条件。
 * 用法：npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir]
 * 退出码：0 通过；1 未通过（reasons 列出具体原因）；2 输入错误（RTM 不存在 / 格式非法）
 * 资产读取与校验已拆分至 artifact-gate-assets.ts / uat-path-mapping.ts（Task A1），本文件仅保留
 * 参数解析、资产装配、gate-logic 调用、结果合并与报告输出。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkArtifactGate,
  type PhaseOption,
  type RTMMatrixShape,
} from '../logic/gate-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { printGateReport } from '../lib/gate-report.js';
import { parsePhaseArg as parsePhaseArgLib } from '../lib/parse-phase.js';
import {
  discoverGraphAsset,
  readBddManifest,
  readTlaManifest,
  runModelChecks,
} from './artifact-gate-assets.js';
import { collectUatMappingViolations } from './uat-path-mapping.js';
export { checkUatPathMappingContent } from './uat-path-mapping.js'; // self-test 兼容：B4/B5 内容校验保持从本入口导出

const RTM_RELATIVE_PATH = path.join('.w-model', 'rtm.json');
const MANIFEST_RELATIVE_PATH = path.join('.w-model', 'tla-manifest.json');
const BDD_MANIFEST_RELATIVE_PATH = path.join('.w-model', 'bdd-manifest.json');

// ==================== --phase 参数解析（P1.1） ====================
/**
 * 解析 --phase=N 或 --phase N 参数（lib/parse-phase.ts 统一校验，范围 1-8），
 * 兼容历史短参数 -p。
 * 返回 undefined 表示未传（默认终检 phase=8，向后兼容）。
 * 非法值（非 1-8）退出码 2（保留原 ARG_INVALID 消息）。
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
  // lib 统一解析（--phase=N / --phase N）
  const res = parsePhaseArgLib(argv, { min: 1, max: 8 });
  if (res !== undefined) return res.phase as PhaseOption;
  // 兼容历史短参数 -p（lib 不识别；值合法即采用，非法报错）
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-p') {
      const next = argv[i + 1] ?? '';
      const val = strictPhase(next);
      if (val === undefined) {
        exitWithError({
          category: 'ARG_INVALID',
          rule: 'P0-1',
          message: `参数非法 --phase=${next}`,
          detail: '须为 1-8 的整数',
          exitCode: 2,
        });
      }
      return val;
    }
  }
  // 显式传了 --phase 但非法（lib 返回 undefined）→ 保留原 ARG_INVALID 报错
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phase') {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --phase=${argv[i + 1] ?? ''}`,
        detail: '须为 1-8 的整数',
        exitCode: 2,
      });
      return undefined;
    }
    const eqMatch = arg?.match(/^--phase=(.+)$/);
    if (eqMatch) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --phase=${eqMatch[1] ?? ''}`,
        detail: '须为 1-8 的整数',
        exitCode: 2,
      });
      return undefined;
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
  // 第 37 轮：--spec-dir=<dir>（phase=1 需求规格独立产物目录，含 requirement-spec.md + 6 独立文件）
  // 全量 argv 扫描（与 parsePhaseArg 一致），避免 --spec-dir 出现在任意位置被静默忽略（false-pass 方向）
  const specDirArg = process.argv.find(a => a.startsWith('--spec-dir='));
  const specDir = specDirArg?.split('=')[1] ?? undefined;
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
        rule: 'P0-2',
        message: '文件不存在（请先执行 /wm 走完 W 模型阶段再校验）',
        file: rtmFile,
        exitCode: 2,
      });
      return;
    }
    throw err;
  }

  let matrix: RTMMatrixShape;
  try {
    matrix = parseJsonSafe(raw) as RTMMatrixShape;
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
  const { graph, graphSource } = await discoverGraphAsset(ingestionDir);

  // 2. 检查 tla-manifest.json 存在性 + specs 非空
  const manifestFile = path.resolve(projectDir, MANIFEST_RELATIVE_PATH);
  const manifestExists = await readTlaManifest(manifestFile);

  // ==================== BDD 资产读取（spec §13.2 #18） ====================
  // 与 TLA+ manifest 校验对称：检查 bdd-manifest.json 存在性 + schema + features 文件存在性
  // + stateMachines 七要素非空（states/acceptingStates/transitions/invariants）。
  // 阶段 4 后才要求 bdd-manifest.json 存在（阶段 1-3 可能还未创建）。
  const bddManifestFile = path.resolve(projectDir, BDD_MANIFEST_RELATIVE_PATH);
  const effectivePhase: PhaseOption = phaseOption ?? 8;
  const { bddViolations, bddManifestExists } = await readBddManifest(bddManifestFile, projectDir, effectivePhase);

  // 调用纯逻辑校验（传入 graph + manifestExists + phaseOption + specDir，启用 TLA+ 资产校验与阶段分层）
  const result = checkArtifactGate(matrix, { graph, manifestExists, phaseOption, specDir });

  // ==================== 终检调用 TLA+/BDD model 校验（设计文档 §3.3.8） ====================
  // phase>=2 时，终检调用 check-tla-model.ts + check-bdd-model.ts，传递 --graph + --phase
  const graphPath = graphSource ? path.join(ingestionDir, graphSource) : '';
  const modelCheckViolations = runModelChecks({
    manifestExists,
    effectivePhase,
    graphPath,
    manifestFile,
    bddManifestExists,
    bddManifestFile,
  });

  // uat-path-mapping 校验违反（计入终检结果，B4/B5：解析严格化 + 阶段5/终检均校验）
  const uatMappingViolations = await collectUatMappingViolations(projectDir, phaseOption);

  // 合并 uat-path-mapping + BDD 资产校验违反到终检结果（BDD 校验在 CLI 层完成，gate-logic 不感知 BDD）
  const allReasons = [...result.reasons, ...uatMappingViolations, ...bddViolations, ...modelCheckViolations];
  const overallPassed =
    result.passed && uatMappingViolations.length === 0 && bddViolations.length === 0 && modelCheckViolations.length === 0;

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
  console.log(`Model 校验    : ${modelCheckViolations.length === 0 ? '✓ TLA+/BDD model 校验通过' : `✗ ${modelCheckViolations.length} 条违反`}`);
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
  printGateReport('GATE', {
    type: 'artifact',
    passed: overallPassed,
    coveragePercent: result.coveragePercent,
    unitCoveragePercent: result.unitCoveragePercent,
    missingItems: result.missingItems,
    reasons: allReasons,
    bddManifestExists,
  }, overallPassed ? 0 : 1);
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
