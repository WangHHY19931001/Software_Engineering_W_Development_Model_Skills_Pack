#!/usr/bin/env tsx
/**
 * 校验逻辑自检脚本（Self-Test）—— 端到端验证 gate-logic.ts / verifier-logic.ts / graph-logic.ts / tla-logic.ts 的正确性
 *
 * 设计目标：
 *   - 不依赖任何测试框架（无 jest / vitest），仅用 Node 标准库
 *   - 通过 samples/ 目录下的 JSON 样本驱动校验逻辑
 *   - 每个样本声明 expectedPassed + expectedReasonPatterns，匹配失败即整体失败
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/self-test.ts
 *
 * 退出码：
 *   0  所有样本的校验结果与期望一致
 *   1  至少一个样本不匹配
 *
 * 样本目录约定：
 *   w-model-dev/scripts/samples/verifier/*.json   Verifier 输出样本
 *   w-model-dev/scripts/samples/gate/*.json       RTM 矩阵样本
 *   w-model-dev/scripts/samples/graph/*.json      图谱样本
 *   w-model-dev/scripts/samples/tla/*.json        TLA+ manifest 样本（纯逻辑校验，不跑 SANY/TLC）
 *
 * 注意：self-test 是纯逻辑回归基线，**不依赖 Java/jar**。TLA+ 的 SANY/TLC 端到端测试
 *   在 samples/tla-e2e/ 下提供 fixture，需 Java 才能跑（见该目录 README）。
 *
 * 新增校验项后，请同时：
 *   1. 增加能触发该校验项的样本（通过 / 失败各一条）
 *   2. 在 SAMPLES 表中声明期望结果
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVerifierOutput } from './verifier-logic.js';
import { checkArtifactGate } from './gate-logic.js';
import { checkRequirementGraph } from './graph-logic.js';
import { checkTlaModel } from './tla-logic.js';

// ==================== 测试用例定义 ====================

interface VerifierCase {
  /** 样本文件名（相对 samples/verifier/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

interface GateCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const VERIFIER_CASES: VerifierCase[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 VerifierOutput，应通过所有校验',
  },
  {
    file: 'bad-ranking-k.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ranking\.k 必须为整数/],
    description: 'ranking.k=2.5 非整数，应被整数性校验拦截',
  },
  {
    file: 'bad-composite-score.json',
    expectedPassed: false,
    expectedReasonPatterns: [/compositeScore.*Σ\(score\*weight\)/],
    description: 'compositeScore 与 Σ(score*weight) 不一致，应被防漂移校验拦截',
  },
  {
    file: 'bad-quality-level.json',
    expectedPassed: false,
    expectedReasonPatterns: [/qualityLevel.*应映射为/],
    description: 'qualityLevel=C 与综合分数 0.8735（应映射为 A）不一致',
  },
  {
    file: 'bad-variance-threshold.json',
    expectedPassed: false,
    expectedReasonPatterns: [/varianceThreshold 必须在 \[0,0\.1\]/],
    description: 'meta.varianceThreshold 缺失，应判失败（spec §6 必填字段）',
  },
  {
    file: 'bad-variance-drift.json',
    expectedPassed: false,
    expectedReasonPatterns: [/variance.*重算的方差/],
    description: 'variance=0 与 rawScores 重算方差不一致，应被防谎报校验拦截',
  },
  {
    file: 'bad-passed-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed.*与 qualityLevel.*不一致/],
    description: 'passed=true 与 qualityLevel=D 不一致',
  },
  {
    file: 'bad-reviewed-at.json',
    expectedPassed: false,
    expectedReasonPatterns: [/reviewedAt 必须为有效 ISO 8601/],
    description: 'reviewedAt 不是有效时间，应被拒绝',
  },
  {
    file: 'bad-variance-threshold-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/varianceThreshold 必须在 \[0,0\.1\]/],
    description: '方差阈值被放宽到 0.50，应被拒绝',
  },
  {
    file: 'bad-ranking-ordered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ranking\.ordered 不得包含重复候选项/],
    description: '排序结果包含重复候选项，应被拒绝',
  },
];

const GATE_CASES: GateCase[] = [
  {
    file: 'valid-rtm.json',
    expectedPassed: true,
    description: 'RTM 覆盖率 100% 且四级测试全部通过',
  },
  {
    file: 'bad-coverage.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100%/],
    description: 'RTM 存在不完整追溯行，应被覆盖率门禁拦截',
  },
  {
    file: 'bad-count-invariant.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed \+ failed \+ pending 必须等于 total/],
    description: '测试汇总计数不守恒，应阻止假通过',
  },
  {
    file: 'bad-unit-coverage.json',
    expectedPassed: false,
    expectedReasonPatterns: [/单元测试代码覆盖率未达 80%/],
    description: '单元测试代码覆盖率低于 80%，应阻止放行',
  },
  {
    file: 'bad-duplicate-id.json',
    expectedPassed: false,
    expectedReasonPatterns: [/需求 ID 重复/],
    description: 'RTM 存在重复需求 ID，应被结构校验拦截',
  },
  {
    file: 'bad-test-failed.json',
    expectedPassed: false,
    expectedReasonPatterns: [/单元测试: 1 个失败/],
    description: '单元测试 failed>0，应被四级测试门禁拦截',
  },
  {
    file: 'bad-structure.json',
    expectedPassed: false,
    expectedReasonPatterns: [/executionSummary 字段缺失/],
    description: 'RTM 缺 executionSummary，应被结构校验拦截而非抛 TypeError',
  },
];

interface GraphCase {
  file: string;
  phase: number;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const GRAPH_CASES: GraphCase[] = [
  {
    file: 'valid-graph.json',
    phase: 4,
    expectedPassed: true,
    description: 'phase=4 完整图谱：连通 + 单根 + 父唯一 + 全追溯',
  },
  {
    file: 'bad-isolated.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/连通性校验失败/],
    description: '存在孤立节点 REQ-002，应被连通性校验拦截',
  },
  {
    file: 'bad-multi-root.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/多根违反/],
    description: '两个 REQ 根节点（depends-on 不构成 parent），应被单根校验拦截',
  },
  {
    file: 'bad-orphan.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/单根校验失败/, /orphan/],
    description: 'SD-002 无 parent 边且为非 REQ 根候选，应被单根/orphan 校验拦截',
  },
  {
    file: 'bad-multi-parent.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/父唯一性校验失败.*REQ-C/],
    description: 'REQ-C 有两条 parent 入边，应被父唯一性校验拦截',
  },
  {
    file: 'bad-sd-no-implements.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/SD 节点 SD-001 缺少 implements 出边/],
    description: 'phase=2 时 SD 缺 implements，应被追溯校验拦截',
  },
  {
    file: 'bad-intf-no-defines.json',
    phase: 3,
    expectedPassed: false,
    expectedReasonPatterns: [/INTF 节点 INTF-001 缺少 defines 入边/],
    description: 'phase=3 时 INTF 缺 defines，应被追溯校验拦截',
  },
  {
    file: 'bad-dd-no-realizes.json',
    phase: 4,
    expectedPassed: false,
    expectedReasonPatterns: [/DD 节点 DD-001 缺少 realizes 出边/],
    description: 'phase=4 时 DD 缺 realizes，应被追溯校验拦截',
  },
  {
    file: 'bad-blackhole.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/黑洞 REQ-001/],
    description: 'REQ-001 只进不出，应被信息流黑洞校验拦截',
  },
  {
    file: 'bad-miracle.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/奇迹 REQ-001/],
    description: 'REQ-001 只出不进，应被信息流奇迹校验拦截',
  },
  {
    file: 'bad-dead-module.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/死模块 REQ-001/],
    description: 'REQ-001 无信息流经，应被死模块校验拦截',
  },
  {
    file: 'valid-dataflow.json',
    phase: 4,
    expectedPassed: true,
    description: 'phase=4 完整图谱含信息流：无黑洞/奇迹/死模块 + 边界完整',
  },
];

interface TlaCase {
  file: string;
  phase: number;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const TLA_CASES: TlaCase[] = [
  {
    file: 'valid.json',
    phase: 2,
    expectedPassed: true,
    description: 'L1+L2 完整 manifest：单 L1 根 + 双向一致 + 拆解合规 + 声明标志全 true',
  },
  {
    file: 'bad-no-l1-root.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/不存在 L1 根规格/],
    description: '无 L1 根规格（仅 L2 且 parent=null），应被层次校验拦截',
  },
  {
    file: 'bad-multi-l1-root.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/存在 2 个 L1 根规格/],
    description: '两个 L1 根规格（L1-system-a/L1-system-b），应被单根校验拦截',
  },
  {
    file: 'bad-parent-child-mismatch.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/声明 parent="tla\/L1-system\.tla".*parent\.children 未包含 tla\/L2-auth\.tla/],
    description: 'L2-auth 声明 parent=L1-system，但 L1-system.children 为空，应被 parent→child 双向校验拦截',
  },
  {
    file: 'bad-sibling-asymmetric.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/声明 sibling="tla\/L2-article\.tla".*tla\/L2-article\.tla\.siblings 未包含 tla\/L2-auth\.tla/],
    description: 'L2-auth 声明 sibling=L2-article，但 L2-article.siblings 为空，应被 sibling 双向校验拦截',
  },
  {
    file: 'bad-level-not-monotonic.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/level=L3 ≠ parent\(L1-system\) level L1 \+ 1/],
    description: 'L3-auth parent=L1-system 但层级跨级（L1→L3），应被层级单调校验拦截',
  },
  {
    file: 'bad-must-split-violation.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/variableCombination=50000 > 10000.*须 decompositionDecision='split-done'/],
    description: 'variableCombination=50000 > 1w 但 decision=consider-split，应被拆解决策校验拦截',
  },
  {
    file: 'bad-declared-flags.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [
      /syntaxChecked=false/,
      /存在死锁.*deadlockFree=false/,
      /不变式违反.*invariantsHold=false/,
      /L1-system 状态爆炸.*stateExplosion=true/,
    ],
    description: '声明标志全反（syntax/deadlock/invariant/explosion），应同时触发四类违反',
  },
];

// ==================== 测试执行器 ====================

interface CaseResult {
  name: string;
  passed: boolean;
  description: string;
  /** 期望 vs 实际不一致的细节（仅在 passed=false 时填充） */
  details?: string[];
}

function matchReasonPatterns(
  reasons: string[],
  patterns: RegExp[] | undefined,
): string[] {
  if (!patterns || patterns.length === 0) return [];
  const details: string[] = [];
  for (const p of patterns) {
    const matched = reasons.some(r => p.test(r));
    if (!matched) {
      details.push(`  - 未匹配期望原因模式 ${p}（实际 reasons=${JSON.stringify(reasons)}）`);
    }
  }
  return details;
}

async function runVerifierCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of VERIFIER_CASES) {
    const abs = path.join(samplesDir, 'verifier', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkVerifierOutput(parsed);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    results.push({
      name: `verifier/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runGateCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of GATE_CASES) {
    const abs = path.join(samplesDir, 'gate', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkArtifactGate(parsed as never);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    results.push({
      name: `gate/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runGraphCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of GRAPH_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkRequirementGraph(parsed, c.phase);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }

    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runTlaCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of TLA_CASES) {
    const abs = path.join(samplesDir, 'tla', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkTlaModel(parsed, c.phase);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }

    results.push({
      name: `tla/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// ==================== 入口 ====================

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const samplesDir = path.join(here, 'samples');

  console.log('═'.repeat(60));
  console.log('校验逻辑自检（Self-Test）');
  console.log('═'.repeat(60));
  console.log(`样本目录      : ${samplesDir}`);
  console.log(`Verifier 用例 : ${VERIFIER_CASES.length}`);
  console.log(`Gate 用例     : ${GATE_CASES.length}`);
  console.log(`Graph 用例    : ${GRAPH_CASES.length}`);
  console.log(`TLA 用例      : ${TLA_CASES.length}`);
  console.log('─'.repeat(60));

  const [verifierResults, gateResults, graphResults, tlaResults] = await Promise.all([
    runVerifierCases(samplesDir),
    runGateCases(samplesDir),
    runGraphCases(samplesDir),
    runTlaCases(samplesDir),
  ]);
  const all = [...verifierResults, ...gateResults, ...graphResults, ...tlaResults];

  const passedCount = all.filter(r => r.passed).length;
  const failedCount = all.length - passedCount;

  for (const r of all) {
    const tag = r.passed ? '✓' : '✗';
    console.log(`${tag} ${r.name.padEnd(40)} ${r.description}`);
    if (r.details) {
      for (const d of r.details) console.log(d);
    }
  }

  console.log('─'.repeat(60));
  console.log(`总计 ${all.length} 条用例：${passedCount} 通过，${failedCount} 失败`);

  process.exit(failedCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Self-Test 异常:', err);
  process.exit(1);
});
