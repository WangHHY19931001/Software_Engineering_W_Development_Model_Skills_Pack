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
  type GraphShape,
} from './graph-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]');
    process.exit(2);
  }

  // 解析 --phase
  let phase: number | undefined;
  const phaseArg = process.argv.slice(3).find(a => a.startsWith('--phase='));
  if (phaseArg) {
    phase = Number.parseInt(phaseArg.split('=')[1], 10);
    if (![1, 2, 3, 4].includes(phase)) {
      console.error(`✗ --phase 必须为 1-4，实际: ${phase}`);
      process.exit(2);
    }
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const effectivePhase = phase ?? (parsed as GraphShape)?.currentPhase ?? 1;
  if (!phase && ![1, 2, 3, 4].includes(effectivePhase)) {
    console.error(`✗ 无法确定 phase：未传 --phase 且 graph.currentPhase=${effectivePhase} 无效`);
    process.exit(2);
  }

  const result = checkRequirementGraph(parsed, effectivePhase);

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

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  console.log('─'.repeat(60));
  console.log('GRAPH_JSON ' + JSON.stringify({
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
    violations: result.violations,
    converged: result.passed,
  }));

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('图谱校验脚本异常:', err);
  process.exit(2);
});
