#!/usr/bin/env tsx
/**
 * 图谱校验脚本（Requirement Graph Checker）
 *
 * 对应 w-model-dev/references/graph-guide.md 图谱模型。
 * 供 G 子代理在 ingestion 收敛循环中调用，校验 graph.json / consolidated.json 的
 * 连通性、单根、父唯一性和阶段递进追溯。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4] [--spec-dir=<dir>]
 *
 * 用法（R9/R10）：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> --phase=2 --spec-dir=docs/phase2-design
 *     --spec-dir  Phase 2 时按 *-system-design.md / *-traceability-matrix.md / *-uml-modeling.md 匹配
 *
 * 用法（R11/R12）：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> --phase=3 --spec-dir=docs/phase3-outline
 *     --spec-dir  Phase 3 时按 *-interface-design.md / *-traceability-matrix.md / *-uml-modeling.md 匹配
 *
 * 用法（R13/R14）：
 *   npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> --phase=4 --spec-dir=docs/phase4-detailed
 *     --spec-dir  Phase 4 时按 *-detailed-design.md / *-traceability-matrix.md / *-class-design.md / *-data-model.md 匹配
 *
 * 参数：
 *   graph.json   graph.json 或 consolidated.json 文件路径
 *   --phase      校验阶段（1-4），控制追溯项数量，默认从 graph.currentPhase 读取
 *   --spec-dir   需求规格独立产物目录（含 requirement-spec.md / traceability-matrix.md / uml-modeling.md），
 *                启用 R7 追踪矩阵一致性 + R8 UML mermaid 块配平校验（不传则行为完全不变）
 *   --rtm        RTM 文件路径（R6 扩展：阶段 4 验收用例 ↔ 需求覆盖交叉核对）
 *   --exemptions 豁免文件路径（存在时跳过对应豁免规则，与 check-exemption.ts granted.json 口径一致）
 *   --json       机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过（连通 + 单根 + 父唯一 + 阶段追溯完整）
 *   1  校验失败（reasons 列出具体原因，A 子代理按原因补漏）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 GRAPH_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase=1|2|3|4、--spec-dir=、--rtm=、--exemptions=
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import * as path from 'node:path';

import {
  checkDesignSpecEnhance,
  checkDetailedSpecEnhance,
  checkOutlineSpecEnhance,
  checkRequirementGraph,
  checkRequirementSpecEnhance,
  extractRefTargets,
  recalculatePassed,
  type DesignSpecEnhanceViolations,
  type DetailedSpecEnhanceViolations,
  type GraphShape,
  type OutlineSpecEnhanceViolations,
  type RequirementSpecEnhanceViolations,
  type SignatureChainEntryLike,
} from '../logic/graph-logic.js';
import { readJsonOrExit, readJsonClassified } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg, phaseFlagPresent } from '../lib/parse-phase.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { existsSync, readFileSync } from 'node:fs';

/**
 * 解析锚点路径的基准项目根。
 *
 * 锚点按仓库/项目约定写作**项目根相对路径**（conventions.md 列定位约定），而
 * graph.json 通常位于 `<project>/.w-model/graph.json`——故基准不能简单取 graph.json
 * 所在目录。解析规则：从 graph.json 所在目录向上至多 8 层，取第一个含 `.w-model/`
 * 或 `.git/` 的目录为项目根；都不命中则退回 graph.json 所在目录（样本 fixture 场景）。
 */
function resolveAnchorBaseDir(graphAbsPath: string): string {
  let dir = path.dirname(graphAbsPath);
  const start = dir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, '.w-model')) || existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * 构造 R15c/R15e 的外部证据注入面（CLI 层唯一读盘点；logic 层保持纯函数）。
 *
 * - existingAnchorPaths：对图中每个节点的 evidenceAnchor 取 `:` 之前的 path 部分，
 *   以项目根（见 resolveAnchorBaseDir）为基准按正斜杠相对路径解析，逐个 existsSync
 *   判定后收集。仅收集**存在**的 path，R15c 以「不在集合中」判缺失。
 * - signatureChainEntries：项目根 `.w-model/signature-chain.jsonl`；文件不存在
 *   （阶段 1 早期）→ 返回 undefined → R15e 跳过，符合规格 §5「签名链未完整时不得误红」。
 */
function buildGraphExternalEvidence(
  graph: GraphShape,
  graphAbsPath: string,
): { existingAnchorPaths: Set<string>; signatureChainEntries?: SignatureChainEntryLike[] } {
  const baseDir = resolveAnchorBaseDir(graphAbsPath);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const existingAnchorPaths = new Set<string>();
  for (const n of nodes) {
    const anchor = n?.evidenceAnchor;
    if (typeof anchor !== 'string' || anchor.trim() === '') continue;
    const anchorPath = anchor.split(':')[0];
    if (!anchorPath) continue;
    if (existsSync(path.resolve(baseDir, anchorPath))) existingAnchorPaths.add(anchorPath);
  }

  const chainPath = path.join(baseDir, '.w-model', 'signature-chain.jsonl');
  if (!existsSync(chainPath)) return { existingAnchorPaths };
  let raw: string;
  try {
    raw = readFileSync(chainPath, 'utf-8');
  } catch {
    return { existingAnchorPaths };
  }
  const entries: SignatureChainEntryLike[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsedLine = JSON.parse(trimmed) as SignatureChainEntryLike;
      if (parsedLine && typeof parsedLine === 'object') entries.push(parsedLine);
    } catch {
      // 单行不可解析：跳过该行（签名链完整性由 check-signature-chain.ts 单独把关，
      // 本处不重复其职责，避免把格式问题误报成 R15e）
    }
  }
  return { existingAnchorPaths, signatureChainEntries: entries };
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <graph.json>',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]',
      exitCode: 2,
    });
    return;
  }

  // 解析 --phase（lib/parse-phase.ts 统一校验：--phase=N / --phase N，范围 1-4；重复即错）
  // D3/I-4：门控改 phaseFlagPresent（形态无关）——空格形态非法值同样 ARG_INVALID，不再静默降级
  let phase: number | undefined;
  const hasPhaseFlag = phaseFlagPresent(process.argv);
  const phaseParsed = parsePhaseArg(process.argv, { min: 1, max: 4 });
  if (phaseParsed !== undefined) {
    phase = phaseParsed.phase;
  } else if (hasPhaseFlag) {
    // 显式传了 --phase 但非法（非数字 / 越界 / 缺值）→ 保留原 ARG_INVALID 消息与退出码
    const eqRaw = parseFlagValue(process.argv, 'phase');
    const spaceIdx = process.argv.indexOf('--phase');
    const phaseRaw = eqRaw ?? (spaceIdx >= 0 ? process.argv[spaceIdx + 1] : undefined);
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `参数非法 --phase=${phaseRaw ?? ''}`,
      detail: '须为 1-4 的整数',
      exitCode: 2,
    });
    return;
  }

  // 解析 --rtm（可选，用于 R6 cross-cuts 源类型校验）
  const rtmArg = parseFlagValue(process.argv.slice(3), 'rtm');
  let rtmRows: Array<{ requirementId: string; type: string }> | undefined;
  if (rtmArg) {
    const rtmPath = rtmArg;
    if (rtmPath) {
      const rtmParsed = await readJsonClassified<{ rows?: Array<{ requirementId: string; type: string }> }>(rtmPath);
      rtmRows = rtmParsed.rows;
    }
  }

  // 解析 --exemptions（可选，用于跳过已批准豁免的规则）
  const exemptArg = parseFlagValue(process.argv.slice(3), 'exemptions');
  let exemptedRules: string[] | undefined;
  if (exemptArg) {
    const exemptPath = exemptArg;
    if (exemptPath) {
      const exemptParsed = await readJsonClassified<{ grantedExemptions?: Array<{ ruleId: string }> }>(exemptPath);
      exemptedRules = exemptParsed.grantedExemptions?.map((g) => g.ruleId);
    }
  }

  // 解析 --spec-dir（R7/R8 + R9/R10 + R11/R12）
  // 注意：parsed 须在 spec-dir 块之前读取（phase=3 分支需从 graph.json SD 节点提取 SD 集合）
  const abs = path.resolve(file);
  const parsed = await readJsonOrExit(file);
  const specDirArg = parseFlagValue(process.argv.slice(3), 'spec-dir');
  let specEnhanceViolations: RequirementSpecEnhanceViolations | undefined;
  let designEnhanceViolations: DesignSpecEnhanceViolations | undefined;
  let outlineEnhanceViolations: OutlineSpecEnhanceViolations | undefined;
  let detailedEnhanceViolations: DetailedSpecEnhanceViolations | undefined;
  if (specDirArg) {
    const specDir = specDirArg;
    if (specDir) {
      const fs = await import('node:fs');
      const readdirSync = (d: string): string[] => {
        try {
          return fs.readdirSync(d);
        } catch {
          return [];
        }
      };
      const readOrEmpty = (p: string): string => {
        try {
          return fs.readFileSync(p, 'utf-8');
        } catch {
          return '';
        }
      };
      if (phase === 2 || phase === 3 || phase === 4) {
        // Phase 2/3/4 module 前缀 glob 匹配（每类恰 1 个文件）
        const mainSuffix =
          phase === 2 ? '-system-design.md' : phase === 3 ? '-interface-design.md' : '-detailed-design.md';
        const mainFile = readdirSync(specDir).find((f) => f.endsWith(mainSuffix));
        const traceFile = readdirSync(specDir).find((f) => f.endsWith('-traceability-matrix.md'));
        const umlFile = readdirSync(specDir).find((f) => f.endsWith('-uml-modeling.md'));
        // Phase 4 无独立 uml-modeling.md：R14 源 = class-design.md + data-model.md 合并
        const classFile = readdirSync(specDir).find((f) => f.endsWith('-class-design.md'));
        const dataModelFile = readdirSync(specDir).find((f) => f.endsWith('-data-model.md'));
        const umlContent =
          phase === 4
            ? `${classFile ? readOrEmpty(path.join(specDir, classFile)) : ''}\n${dataModelFile ? readOrEmpty(path.join(specDir, dataModelFile)) : ''}`
            : umlFile
              ? readOrEmpty(path.join(specDir, umlFile))
              : '';
        const traceContent = traceFile ? readOrEmpty(path.join(specDir, traceFile)) : '';
        if (phase === 2) {
          designEnhanceViolations = checkDesignSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            rtmRows ? new Set(rtmRows.map((r) => r.requirementId)) : undefined,
          );
        } else if (phase === 3) {
          const sdIds = Array.isArray((parsed as GraphShape)?.nodes)
            ? new Set((parsed as GraphShape).nodes.filter((n) => n.type === 'SD').map((n) => n.id))
            : undefined;
          outlineEnhanceViolations = checkOutlineSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            sdIds,
          );
        } else {
          // phase=4：INTF 集合从 graph.json INTF 节点提取
          const intfIds = Array.isArray((parsed as GraphShape)?.nodes)
            ? new Set((parsed as GraphShape).nodes.filter((n) => n.type === 'INTF').map((n) => n.id))
            : undefined;
          detailedEnhanceViolations = checkDetailedSpecEnhance(
            traceContent,
            mainFile ? readOrEmpty(path.join(specDir, mainFile)) : '',
            umlContent,
            intfIds,
          );
        }
        // 引用块完整性：主文档引用块指向的 6 文件须存在（以主文档 module 前缀核对）
        const pushRefError = (rule: 'r9' | 'r11' | 'r13', msg: string): void => {
          if (rule === 'r9') designEnhanceViolations?.r9.push(msg);
          else if (rule === 'r11') outlineEnhanceViolations?.r11.push(msg);
          else detailedEnhanceViolations?.r13.push(msg);
        };
        if (mainFile) {
          const module = mainFile.slice(0, -mainSuffix.length);
          const subRefs =
            phase === 2
              ? [
                  'system-architecture',
                  'glossary',
                  'traceability-matrix',
                  'behavior-spec',
                  'discipline-dod',
                  'uml-modeling',
                ]
              : phase === 3
                ? [
                    'interface-contract',
                    'glossary',
                    'traceability-matrix',
                    'behavior-spec',
                    'discipline-dod',
                    'uml-modeling',
                  ]
                : ['class-design', 'data-model', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod'];
          for (const sub of subRefs) {
            if (!fs.existsSync(path.join(specDir, `${module}-${sub}.md`))) {
              pushRefError(
                phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13',
                `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} 引用块断裂：主文档引用 ${module}-${sub}.md 但文件不存在`,
              );
            }
          }
          if (readdirSync(specDir).filter((f) => f.endsWith(mainSuffix)).length !== 1) {
            pushRefError(
              phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13',
              `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} module 前缀匹配失败：主文档须恰 1 个 *${mainSuffix}`,
            );
          }
        } else {
          pushRefError(
            phase === 2 ? 'r9' : phase === 3 ? 'r11' : 'r13',
            `R${phase === 2 ? 9 : phase === 3 ? 11 : 13} module 前缀匹配失败：未找到 *${mainSuffix} 主文档`,
          );
        }
      } else {
        // Phase 1 固定文件名（保留既有行为）
        const specContent = readOrEmpty(path.join(specDir, 'requirement-spec.md'));
        const traceContent = readOrEmpty(path.join(specDir, 'traceability-matrix.md'));
        const umlContent = readOrEmpty(path.join(specDir, 'uml-modeling.md'));
        const rtmIds = rtmRows ? new Set(rtmRows.map((r) => r.requirementId)) : undefined;
        specEnhanceViolations = checkRequirementSpecEnhance(traceContent, specContent, umlContent, rtmIds);
        for (const ref of extractRefTargets(specContent)) {
          if (!fs.existsSync(path.join(specDir, ref))) {
            specEnhanceViolations.r7.push(`R7 引用块断裂：主规格引用 ${ref} 但文件不存在`);
          }
        }
      }
    }
  }

  const effectivePhase = phase ?? (parsed as GraphShape)?.currentPhase ?? 1;
  if (!phase && ![1, 2, 3, 4].includes(effectivePhase)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '无法确定 phase',
      detail: `未传 --phase 且 graph.currentPhase=${effectivePhase} 无效（须为 1-4）`,
      exitCode: 2,
    });
    return;
  }

  // R15c/R15e 外部证据注入：logic 层为纯函数（无 I/O），由本 CLI 读盘后注入。
  //   R15c：锚点 path 部分是否真实存在（相对项目根解析，以 graph.json 所在目录为基准）
  //   R15e：signature-chain.jsonl 是否存在引用该节点 id 的 V review 环
  //         文件不存在（阶段 1 早期）→ 不注入 → R15e 跳过，不误红。
  const externalEvidence = buildGraphExternalEvidence(parsed as GraphShape, abs);

  const result = checkRequirementGraph(parsed, effectivePhase, externalEvidence);

  // R6 扩展：cross-cuts 源类型 RTM 关联校验（若提供 --rtm）
  if (rtmRows && result.crossLogic) {
    const nfrConIds = new Set(rtmRows.filter((r) => r.type === 'NFR' || r.type === 'CON').map((r) => r.requirementId));
    let rtmR6Added = false;
    for (const edge of (parsed as GraphShape).edges) {
      if (edge.type === 'cross-cuts' && !nfrConIds.has(edge.from)) {
        result.crossLogic.crossCutsSourceTypeViolations.push(
          `${edge.from}→${edge.to}（源 ${edge.from} 非 NFR/CON 行）`,
        );
        result.violations.push(`R6 cross-cuts 源类型校验失败：${edge.from} 非 NFR/CON 行`);
        rtmR6Added = true;
      }
    }
    if (rtmR6Added) {
      // 重算 passed（与 graph-logic.ts 汇总逻辑一致）
      const isPureReqGraph =
        Array.isArray((parsed as GraphShape)?.nodes) &&
        (parsed as GraphShape).nodes.length > 0 &&
        (parsed as GraphShape).nodes.every((n) => n.type === 'REQ');
      recalculatePassed(result, effectivePhase === 1 && isPureReqGraph);
    }
  }

  // 应用豁免：跳过已批准豁免的规则
  if (exemptedRules) {
    const beforeLen = result.violations.length;
    result.violations = result.violations.filter((v) => {
      for (const rule of exemptedRules!) {
        if (v.startsWith(`${rule} `) || v.startsWith(`[${rule}]`) || v.startsWith(`${rule}-`)) return false;
      }
      return true;
    });
    if (result.violations.length < beforeLen) {
      const isPureReqGraph =
        Array.isArray((parsed as GraphShape)?.nodes) &&
        (parsed as GraphShape).nodes.length > 0 &&
        (parsed as GraphShape).nodes.every((n) => n.type === 'REQ');
      recalculatePassed(result, effectivePhase === 1 && isPureReqGraph);
    }
  }

  // 合并 R7/R8 需求规格产物校验违规（须在 recalculatePassed 之前纳入 result.violations，
  // 且 R7/R8 违规必须参与 passed 判定）
  if (specEnhanceViolations) {
    for (const msg of specEnhanceViolations.r7) result.violations.push(msg);
    for (const msg of specEnhanceViolations.r8) result.violations.push(msg);
    // checkRequirementGraph 不感知 R7/R8，重算 passed（与 graph-logic.ts 汇总逻辑一致）
    const isPureReqGraph =
      Array.isArray((parsed as GraphShape)?.nodes) &&
      (parsed as GraphShape).nodes.length > 0 &&
      (parsed as GraphShape).nodes.every((n) => n.type === 'REQ');
    recalculatePassed(result, effectivePhase === 1 && isPureReqGraph);
  }

  // 合并 R9/R10 Phase 2 设计规格产物校验违规（须在 recalculatePassed 之前纳入 result.violations）
  if (designEnhanceViolations) {
    for (const msg of designEnhanceViolations.r9) result.violations.push(msg);
    for (const msg of designEnhanceViolations.r10) result.violations.push(msg);
    // phase=2 图非纯 REQ 图，recalculatePassed 第二参传 false 即非多根模式
    recalculatePassed(result, false);
  }

  // 合并 R11/R12 Phase 3 概要设计产物校验违规（须在 recalculatePassed 之前纳入 result.violations）
  if (outlineEnhanceViolations) {
    for (const msg of outlineEnhanceViolations.r11) result.violations.push(msg);
    for (const msg of outlineEnhanceViolations.r12) result.violations.push(msg);
    // phase=3 图非纯 REQ 图，recalculatePassed 第二参传 false 即非多根模式
    recalculatePassed(result, false);
  }

  // 合并 R13/R14 Phase 4 详细设计产物校验违规（须在 recalculatePassed 之前纳入 result.violations）
  if (detailedEnhanceViolations) {
    for (const msg of detailedEnhanceViolations.r13) result.violations.push(msg);
    for (const msg of detailedEnhanceViolations.r14) result.violations.push(msg);
    recalculatePassed(result, false);
  }
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'requirement-graph',
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

  console.log('═'.repeat(60));
  console.log('图谱校验（Requirement Graph Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`校验阶段      : ${result.phase}`);
  console.log(`节点总数      : ${result.totalNodes}`);
  console.log(`边总数        : ${result.totalEdges}`);
  console.log(`连通分量      : ${result.connectedComponents}`);
  console.log(`孤立节点      : ${result.isolatedNodes.length === 0 ? '无' : result.isolatedNodes.join(', ')}`);
  console.log(`根节点        : ${result.roots.length === 0 ? '无' : result.roots.join(', ')}`);
  console.log(`orphan        : ${result.orphans.length === 0 ? '无' : result.orphans.join(', ')}`);
  console.log(`multiParent   : ${result.multiParent.length === 0 ? '无' : result.multiParent.join(', ')}`);
  console.log(
    `追溯违反      : SD_without_implements=${result.traceabilityViolations.SD_without_implements}, INTF_without_defines=${result.traceabilityViolations.INTF_without_defines}, DD_without_realizes=${result.traceabilityViolations.DD_without_realizes}`,
  );
  console.log(
    `信息流违反    : blackHoles=[${result.dataflowViolations.blackHoles.join(', ')}], miracles=[${result.dataflowViolations.miracles.join(', ')}], deadModules=[${result.dataflowViolations.deadModules.join(', ')}]`,
  );
  console.log(
    `边界完整性    : EXT-IN=${result.boundary.extIn}, EXT-OUT=${result.boundary.extOut}, complete=${result.boundary.complete}`,
  );
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('图谱结构符合 graph-guide.md：连通 + 单根 + 父唯一 + 阶段追溯完整。');
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('A 子代理须按上述原因补漏（reworkHints 指向具体 chunkId），详见：');
    console.log('  w-model-dev/references/ingestion-cross.md');
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log('─'.repeat(60));
    console.log('警告：');
    for (const w of result.warnings) {
      console.log(`  - ${w}`);
    }
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exitCode 一致（门禁防伪造三层机制之一）
  printGateReport(
    'GRAPH',
    {
      type: 'requirement-graph',
      passed: result.passed,
      phase: result.phase,
      totalNodes: result.totalNodes,
      totalEdges: result.totalEdges,
      connectedComponents: result.connectedComponents,
      isolatedNodes: result.isolatedNodes,
      roots: result.roots,
      orphans: result.orphans,
      multiParent: result.multiParent,
      traceabilityViolations: result.traceabilityViolations,
      dataflowViolations: result.dataflowViolations,
      boundary: result.boundary,
      reqHierarchy: result.reqHierarchy,
      crossLogic: result.crossLogic,
      exemptionsApplied: exemptedRules ?? [],
      violations: result.violations,
      warnings: result.warnings ?? [],
      converged: result.passed,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

runMain(main);
