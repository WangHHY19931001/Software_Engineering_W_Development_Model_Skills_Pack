#!/usr/bin/env tsx
/**
 * 校验逻辑自检脚本（Self-Test）—— 端到端验证 gate-logic.ts / verifier-logic.ts / graph-logic.ts / tla-logic.ts / code-tla-logic.ts 的正确性
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
 *   w-model-dev/scripts/samples/code-tla/*.json   代码-TLA+ 一致性样本（含 manifest+graph+rtm+codeSources）
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
import { checkBudget } from './budget-logic.js';
import { checkRunLog } from './run-log-logic.js';
import { checkMaturity } from './maturity-logic.js';
import { checkCheckpoint } from './checkpoint-logic.js';
import * as ts from 'typescript';
import {
  checkCodeTlaConsistency,
  extractCodeStateTransfers,
  type CodeTlaConsistencyInput,
  type CodeFile,
} from './code-tla-logic.js';
import { checkRootCauseReport } from './root-cause-logic.js';

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
  {
    file: 'bad-rawscores-all-same.json',
    expectedPassed: false,
    expectedReasonPatterns: [/rawScores 全同/],
    description: 'completeness 维度 rawScores 全同 [0.95,0.95,0.95]，应被防漂移规则 1 拦截',
  },
  {
    file: 'bad-variance-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/variance.*≠.*重算的方差/],
    description: 'completeness variance=0.001 与重算方差 0.000267 不一致，应被防谎报校验拦截',
  },
  {
    file: 'bad-perturbation-out-of-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/扰动.*> 0\.10/],
    description: 'text-parse 扰动范围 0.45 > 0.10，应被防漂移规则 3 拦截',
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
  {
    file: 'bad-subsystem-orphan.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/orphan/],
    description: 'SD-5.2.2 无 parent 依附，应被 orphan BFS 校验拦截',
  },
  {
    file: 'bad-parent-cycle.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/环/],
    description: 'parent 边构成 REQ-A→REQ-B→REQ-C→REQ-A 环，应被环检测拦截',
  },
  {
    file: 'bad-governance-out-of-scope.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/governs.*源非治理类/],
    description: 'governs 边源 SD-5.2.1 非治理类子系统（governance 标记缺失），应被横切边校验拦截',
  },
  {
    file: 'bad-collaboration-asymmetric.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/collaborates-with.*目标节点不存在/],
    description: 'collaborates-with 目标 SD-5.2.9 不存在，应被横切边校验拦截',
  },
  {
    file: 'valid-multilayer.json',
    phase: 4,
    expectedPassed: true,
    description: 'phase=4 7 层图谱：parent 树 + implements/defines/realizes + governs/collaborates-with/derives 横切边 + 信息流',
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
  {
    file: 'bad-coverage-missing-sd.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/未被任何 TLA\+ spec 覆盖/],
    description: 'manifest.graphSdNodes 含 11 个 SD，但仅 2 个被 spec 覆盖，应被覆盖率校验拦截',
  },
  {
    file: 'bad-cfg-missing-invariant.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/\.cfg 缺失不变式/],
    description: '.cfg 仅含 NoExitTerminal，缺 ArtifactGateConsistency，应被 cfg-tla 一致性校验拦截',
  },
  {
    file: 'bad-cfg-module-declaration.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/\.cfg 含 MODULE 声明/],
    description: '.cfg 含 ---- MODULE L3_xxx ----，应被 cfg 结构校验拦截',
  },
  {
    file: 'bad-invariant-count-mismatch.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/\.cfg 多余不变式/],
    description: '.cfg 含 INV1 INV2 INV3，比 .tla BusinessInvariant 多 INV3，应被 cfg-tla 一致性校验拦截',
  },
  {
    file: 'valid-cfg-consistency.json',
    phase: 2,
    expectedPassed: true,
    description: '.cfg 与 .tla 不变式集合完全一致，应通过 cfg-tla 一致性 + cfg 结构校验',
  },
];

// -------------------- Budget --------------------

interface BudgetCase {
  /** 样本文件名（相对 samples/budget/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 透传给 checkBudget 的 options（如 projectUpdatedAt / budgetCreatedAt） */
  options?: Record<string, unknown>;
  /** 用例说明 */
  description: string;
}

const BUDGET_CASES: BudgetCase[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 BudgetConfig，应通过所有校验',
  },
  {
    file: 'bad-stale.json',
    expectedPassed: false,
    expectedReasonPatterns: [/updatedAt == createdAt/],
    options: {
      projectUpdatedAt: '2026-07-23T18:00:00Z',
      budgetCreatedAt: '2026-07-01T00:00:00Z',
    },
    description: 'updatedAt==createdAt 且项目已推进，应被 R1 时效性校验拦截',
  },
  {
    file: 'bad-killswitch-triggered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/budgetBurnRate 超范围/],
    description: 'killSwitch.budgetBurnRate=1.5 超出 [0,1]，应被 R4 范围校验拦截',
  },
];

// -------------------- RunLog --------------------

interface RunLogCase {
  /** 样本文件名（相对 samples/run-log/，JSONL 格式） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const RUN_LOG_CASES: RunLogCase[] = [
  {
    file: 'valid.jsonl',
    expectedPassed: true,
    description: '3 阶段各含 chunk/cross/gate/checkpoint，append-only 且 checkpoint tokens>0',
  },
  {
    file: 'bad-incomplete.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R1.*缺 chunk/],
    description: '阶段 1 缺 chunk 动作，应被 R1 阶段动作完整性校验拦截',
  },
  {
    file: 'bad-o-overreach.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R2.*tokens=0/],
    description: 'checkpoint success 但 tokens=0，应被 R2 tokens 非负校验拦截',
  },
  {
    file: 'bad-exitcode-mismatch.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R7.*非 append-only/],
    description: 'r1 时间戳 02:00 早于 r2 时间戳 01:00（时间戳倒序），应被 R7 append-only 校验拦截',
  },
  {
    file: 'rootcause-valid.jsonl',
    expectedPassed: true,
    description: '完整 rootcause→review→fix→review→gate 返工闭环，应通过 R1/R3/R6/R7 扩展校验',
  },
  {
    file: 'rootcause-missing-fix.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R3.*rootcause.*fix.*一一对应|basedOnReport.*缺失/, /R7.*rootcause.*fix/],
    description: '有 R 但缺 S-fix 记录，应被 R3 一一对应 + R7 时序校验拦截',
  },
  {
    file: 'rootcause-missing-review.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R3.*V 复审 rootcause.*≠.*R 记录数/, /R7.*rootcause.*review.*targetKind=rootcause/],
    description: '有 R 但缺 V 复审 rootcause 记录，应被 R3 复审数 + R7 时序校验拦截',
  },
];

// -------------------- Maturity --------------------

interface MaturityCase {
  /** 样本文件名（相对 samples/maturity/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const MATURITY_CASES: MaturityCase[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 MaturityConfig（L1），应通过所有校验',
  },
  {
    file: 'bad-stale.json',
    expectedPassed: false,
    expectedReasonPatterns: [/level 非法值.*L5/],
    description: 'level=L5 超出 L0/L1/L2/L3，应被 R2 level 合法性校验拦截',
  },
];

// -------------------- Checkpoint --------------------

interface CheckpointCase {
  /** 样本文件名（相对 samples/checkpoint/，JSONL 格式） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const CHECKPOINT_CASES: CheckpointCase[] = [
  {
    file: 'valid.jsonl',
    expectedPassed: true,
    description: '2 阶段 checkpoint 决策含具体名词（REQ-1.1 / SD-5.2.1）+ 长度合规',
  },
  {
    file: 'bad-empty-decisions.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R1.*acknowledgedDecisions 为空/],
    description: 'cp1 acknowledgedDecisions=[] 空决策放行，应被 R1 校验拦截',
  },
];

// -------------------- Code-TLA Consistency --------------------

interface CodeTlaCase {
  /** 样本文件名（相对 samples/code-tla/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const CODE_TLA_CASES: CodeTlaCase[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '四维度全通过：SD→codeModule 映射 + 代码赋值 + Next 分支对应 + 断言覆盖',
  },
  {
    file: 'bad-sd-no-code-module.json',
    expectedPassed: false,
    expectedReasonPatterns: [/SD-REVIEW 无对应 codeModule/],
    description: 'SD-REVIEW 无对应 codeModule，应被维度1映射校验拦截',
  },
  {
    file: 'bad-no-assignment.json',
    expectedPassed: false,
    expectedReasonPatterns: [/未抽取到任何赋值语句/],
    description: '代码无赋值语句（仅 const + return），应被维度2状态转移校验拦截',
  },
  {
    file: 'bad-next-no-match.json',
    expectedPassed: false,
    expectedReasonPatterns: [/Next 分支.*Register.*无对应函数/],
    description: 'TLA+ Next 含 Register/Login 但代码无对应函数，应被维度3分支对应校验拦截',
  },
  {
    file: 'bad-no-assertion.json',
    expectedPassed: false,
    expectedReasonPatterns: [/未抽取到任何断言/],
    description: 'TLA+ 有 BusinessInvariant 但代码无 assert/invariant/require，应被维度4断言覆盖校验拦截',
  },
];

interface RootCauseCase {
  /** 样本文件名（相对 samples/rootcause/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const ROOTCAUSE_CASES: RootCauseCase[] = [
  { file: 'valid.json', expectedPassed: true, description: '完整、合规的 RootCauseReport，应通过所有校验' },
  { file: 'bad-r1-missing-fields.json', expectedPassed: false, expectedReasonPatterns: [/rootCause/], description: 'R1 缺 rootCause 字段' },
  { file: 'bad-r2-chain-length.json', expectedPassed: false, expectedReasonPatterns: [/rootCauseChain.*长度/], description: 'R2 chain 仅 1 步' },
  { file: 'bad-r3-falsifiability.json', expectedPassed: false, expectedReasonPatterns: [/falsifiabilityCheck.*若.*则/], description: 'R3 无若...则句式' },
  { file: 'bad-r4-fix-recommendation.json', expectedPassed: false, expectedReasonPatterns: [/fixRecommendation.*rationale/], description: 'R4 缺 rationale' },
  { file: 'bad-r5-prevention.json', expectedPassed: false, expectedReasonPatterns: [/prevention.*owner/], description: 'R5 缺 owner' },
  { file: 'bad-r6-upstream-defect.json', expectedPassed: false, expectedReasonPatterns: [/upstreamDefect.*upstreamPhase/], description: 'R6 present=true 缺 upstreamPhase' },
  { file: 'bad-r7-quality-level.json', expectedPassed: false, expectedReasonPatterns: [/qualityLevel.*passed.*一致/], description: 'R7 qualityLevel=C 但 passed=true' },
  { file: 'bad-r8-report-id.json', expectedPassed: false, expectedReasonPatterns: [/reportId.*格式/], description: 'R8 reportId 含下划线' },
  { file: 'bad-r9-partial-missing.json', expectedPassed: false, expectedReasonPatterns: [/partialReports.*非空/], description: 'R9 多角度缺 partialReports' },
  { file: 'bad-r10-reality-confidence.json', expectedPassed: false, expectedReasonPatterns: [/reality-checker.*confidence/], description: 'R10 reality-checker confidence=0.3' },
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

/**
 * JSONL 解析：按行分割，跳过空行，逐行 JSON.parse。
 * 非法 JSON 行会向上抛错（保持样本错误可见性，不静默吞掉）。
 */
function parseJsonl(raw: string): unknown[] {
  return raw
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

async function runBudgetCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of BUDGET_CASES) {
    const abs = path.join(samplesDir, 'budget', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkBudget(parsed, c.options);

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
      name: `budget/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runRunLogCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of RUN_LOG_CASES) {
    const abs = path.join(samplesDir, 'run-log', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonl(raw);
    const r = checkRunLog(parsed);

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
      name: `run-log/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runMaturityCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of MATURITY_CASES) {
    const abs = path.join(samplesDir, 'maturity', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkMaturity(parsed);

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
      name: `maturity/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runCheckpointCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CHECKPOINT_CASES) {
    const abs = path.join(samplesDir, 'checkpoint', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonl(raw);
    const r = checkCheckpoint(parsed);

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
      name: `checkpoint/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runCodeTlaCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_TLA_CASES) {
    const abs = path.join(samplesDir, 'code-tla', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      manifest: CodeTlaConsistencyInput['manifest'];
      graph: CodeTlaConsistencyInput['graph'];
      rtm: CodeTlaConsistencyInput['rtm'];
      codeSources: Array<{ path: string; content: string }>;
    };

    // 将代码源文本解析为 CodeFile（含 AST + 抽取的 assignments/conditionals/assertions）
    const codeFiles: CodeFile[] = (parsed.codeSources ?? []).map(cs => {
      const ast = ts.createSourceFile(cs.path, cs.content, ts.ScriptTarget.ES2022, true);
      return extractCodeStateTransfers(ast, cs.path);
    });

    const input: CodeTlaConsistencyInput = {
      manifest: parsed.manifest,
      graph: parsed.graph,
      rtm: parsed.rtm,
      codeFiles,
    };
    const r = checkCodeTlaConsistency(input);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      const violationMessages = r.violations.map(v => v.message);
      details.push(...matchReasonPatterns(violationMessages, c.expectedReasonPatterns));
    }

    results.push({
      name: `code-tla/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runRootCauseCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ROOTCAUSE_CASES) {
    const abs = path.join(samplesDir, 'rootcause', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkRootCauseReport(parsed);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    results.push({
      name: `rootcause/${c.file}`,
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
  console.log(`Budget 用例   : ${BUDGET_CASES.length}`);
  console.log(`RunLog 用例   : ${RUN_LOG_CASES.length}`);
  console.log(`Maturity 用例 : ${MATURITY_CASES.length}`);
  console.log(`Checkpoint 用例: ${CHECKPOINT_CASES.length}`);
  console.log(`Code-TLA 用例 : ${CODE_TLA_CASES.length}`);
  console.log(`RootCause 用例 : ${ROOTCAUSE_CASES.length}`);
  console.log('─'.repeat(60));

  const [
    verifierResults, gateResults, graphResults, tlaResults,
    budgetResults, runLogResults, maturityResults, checkpointResults,
    codeTlaResults, rootcauseResults,
  ] = await Promise.all([
    runVerifierCases(samplesDir),
    runGateCases(samplesDir),
    runGraphCases(samplesDir),
    runTlaCases(samplesDir),
    runBudgetCases(samplesDir),
    runRunLogCases(samplesDir),
    runMaturityCases(samplesDir),
    runCheckpointCases(samplesDir),
    runCodeTlaCases(samplesDir),
    runRootCauseCases(samplesDir),
  ]);
  const all = [
    ...verifierResults, ...gateResults, ...graphResults, ...tlaResults,
    ...budgetResults, ...runLogResults, ...maturityResults, ...checkpointResults,
    ...codeTlaResults, ...rootcauseResults,
  ];

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
