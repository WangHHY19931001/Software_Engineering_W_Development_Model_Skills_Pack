#!/usr/bin/env tsx
/**
 * 图谱校验脚本（Requirement Graph Checker）
 *
 * 对应 w-model-dev/references/graph-guide.md 图谱模型。
 * 供 G 子代理在 ingestion 收敛循环中调用，校验 graph.json / consolidated.json 的
 * 连通性、单根、父唯一性和阶段递进追溯。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]
 *
 * 参数：
 *   graph.json   graph.json 或 consolidated.json 文件路径
 *   --phase      校验阶段（1-4），控制追溯项数量，默认从 graph.currentPhase 读取
 *
 * 退出码：
 *   0  校验通过（连通 + 单根 + 父唯一 + 阶段追溯完整）
 *   1  校验失败（reasons 列出具体原因，A 子代理按原因补漏）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkRequirementGraph,
  recalculatePassed,
  type GraphShape,
} from './graph-logic.js';
import { readJsonOrExit } from './lib/read-json-or-exit.js';
import { exitWithError } from './lib/cli-error.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 <graph.json>',
      detail: '用法: npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]',
      exitCode: 2,
    });
    return;
  }

  // 解析 --phase
  let phase: number | undefined;
  const phaseArg = process.argv.slice(3).find(a => a.startsWith('--phase='));
  if (phaseArg) {
    const phaseStr = phaseArg.split('=')[1];
    if (phaseStr !== undefined) {
      if (!/^\d+$/.test(phaseStr)) {
        exitWithError({
          category: 'ARG_INVALID',
          message: `参数非法 --phase=${phaseStr}`,
          detail: '须为 1-4 的整数',
          exitCode: 2,
        });
        return;
      }
      phase = Number.parseInt(phaseStr, 10);
    }
    if (phase === undefined || ![1, 2, 3, 4].includes(phase)) {
      exitWithError({
        category: 'ARG_INVALID',
        message: `参数非法 --phase=${phase}`,
        detail: '须为 1-4 的整数',
        exitCode: 2,
      });
      return;
    }
  }

  // 解析 --rtm（可选，用于 R6 cross-cuts 源类型校验）
  const rtmArg = process.argv.slice(3).find(a => a.startsWith('--rtm='));
  let rtmRows: Array<{ requirementId: string; type: string }> | undefined;
  if (rtmArg) {
    const rtmPath = rtmArg.split('=')[1];
    if (rtmPath) {
      try {
        const rtmRaw = await fs.readFile(path.resolve(rtmPath), 'utf-8');
        const rtmParsed = JSON.parse(rtmRaw) as { rows?: Array<{ requirementId: string; type: string }> };
        rtmRows = rtmParsed.rows;
      } catch (err) {
        if (err instanceof SyntaxError) {
          exitWithError({
            category: 'FILE_PARSE',
            message: '文件解析失败（非合法 JSON）',
            exitCode: 2,
            file: path.resolve(rtmPath),
          });
        } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          exitWithError({
            category: 'FILE_NOT_FOUND',
            message: '文件不存在',
            exitCode: 2,
            file: path.resolve(rtmPath),
          });
        } else {
          exitWithError({
            category: 'FILE_READ',
            message: '文件读取失败',
            exitCode: 2,
            file: path.resolve(rtmPath),
            detail: (err as NodeJS.ErrnoException).code ?? '未知错误',
          });
        }
        return;
      }
    }
  }

  // 解析 --exemptions（可选，用于跳过已批准豁免的规则）
  const exemptArg = process.argv.slice(3).find(a => a.startsWith('--exemptions='));
  let exemptedRules: string[] | undefined;
  if (exemptArg) {
    const exemptPath = exemptArg.split('=')[1];
    if (exemptPath) {
      try {
        const exemptRaw = await fs.readFile(path.resolve(exemptPath), 'utf-8');
        const exemptParsed = JSON.parse(exemptRaw) as { grantedExemptions?: Array<{ ruleId: string }> };
        exemptedRules = exemptParsed.grantedExemptions?.map(g => g.ruleId);
      } catch (err) {
        if (err instanceof SyntaxError) {
          exitWithError({
            category: 'FILE_PARSE',
            message: '文件解析失败（非合法 JSON）',
            exitCode: 2,
            file: path.resolve(exemptPath),
          });
        } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          exitWithError({
            category: 'FILE_NOT_FOUND',
            message: '文件不存在',
            exitCode: 2,
            file: path.resolve(exemptPath),
          });
        } else {
          exitWithError({
            category: 'FILE_READ',
            message: '文件读取失败',
            exitCode: 2,
            file: path.resolve(exemptPath),
            detail: (err as NodeJS.ErrnoException).code ?? '未知错误',
          });
        }
        return;
      }
    }
  }

  const abs = path.resolve(file);
  const parsed = await readJsonOrExit(file);

  const effectivePhase = phase ?? (parsed as GraphShape)?.currentPhase ?? 1;
  if (!phase && ![1, 2, 3, 4].includes(effectivePhase)) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '无法确定 phase',
      detail: `未传 --phase 且 graph.currentPhase=${effectivePhase} 无效（须为 1-4）`,
      exitCode: 2,
    });
    return;
  }

  const result = checkRequirementGraph(parsed, effectivePhase);

  // R6 扩展：cross-cuts 源类型 RTM 关联校验（若提供 --rtm）
  if (rtmRows && result.crossLogic) {
    const nfrConIds = new Set(rtmRows.filter(r => r.type === 'NFR' || r.type === 'CON').map(r => r.requirementId));
    let rtmR6Added = false;
    for (const edge of (parsed as GraphShape).edges) {
      if (edge.type === 'cross-cuts' && !nfrConIds.has(edge.from)) {
        result.crossLogic.crossCutsSourceTypeViolations.push(`${edge.from}→${edge.to}（源 ${edge.from} 非 NFR/CON 行）`);
        result.violations.push(`R6 cross-cuts 源类型校验失败：${edge.from} 非 NFR/CON 行`);
        rtmR6Added = true;
      }
    }
    if (rtmR6Added) {
      // 重算 passed（与 graph-logic.ts 汇总逻辑一致）
      const isPureReqGraph = (parsed as GraphShape).nodes.length > 0 && (parsed as GraphShape).nodes.every(n => n.type === 'REQ');
      recalculatePassed(result, effectivePhase === 1 && isPureReqGraph);
    }
  }

  // 应用豁免：跳过已批准豁免的规则
  if (exemptedRules) {
    const beforeLen = result.violations.length;
    result.violations = result.violations.filter(v => {
      for (const rule of exemptedRules!) {
        if (v.startsWith(`${rule} `) || v.startsWith(`[${rule}]`) || v.startsWith(`${rule}-`)) return false;
      }
      return true;
    });
    if (result.violations.length < beforeLen) {
      const isPureReqGraph = (parsed as GraphShape).nodes.length > 0 && (parsed as GraphShape).nodes.every(n => n.type === 'REQ');
      recalculatePassed(result, effectivePhase === 1 && isPureReqGraph);
    }
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
  console.log(`追溯违反      : SD_without_implements=${result.traceabilityViolations.SD_without_implements}, INTF_without_defines=${result.traceabilityViolations.INTF_without_defines}, DD_without_realizes=${result.traceabilityViolations.DD_without_realizes}`);
  console.log(`信息流违反    : blackHoles=[${result.dataflowViolations.blackHoles.join(', ')}], miracles=[${result.dataflowViolations.miracles.join(', ')}], deadModules=[${result.dataflowViolations.deadModules.join(', ')}]`);
  console.log(`边界完整性    : EXT-IN=${result.boundary.extIn}, EXT-OUT=${result.boundary.extOut}, complete=${result.boundary.complete}`);
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
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log('GRAPH_JSON ' + JSON.stringify({
    type: 'requirement-graph',
    passed: result.passed,
    exitCode,
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
  }));

  process.exit(exitCode);
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
