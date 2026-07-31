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
 *   w-model-dev/scripts/samples/bdd/*.json+*.feature  BDD manifest + features 样本（含 5 valid + 5 bad）
 *   w-model-dev/scripts/samples/coverage/*.json   覆盖分析样本（四维·维度4，10 条）
 *   w-model-dev/scripts/samples/exemption/*.json  豁免审批样本（四维·豁免，7 条）
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
import { validateBySchema } from './schema-loader.js';
import { checkArtifactGate } from './gate-logic.js';
import { checkRequirementGraph } from './graph-logic.js';
import { checkTlaModel } from './tla-logic.js';
import { checkBudget } from './budget-logic.js';
import { checkRunLog } from './run-log-logic.js';
import { checkMaturity } from './maturity-logic.js';
import { checkCheckpoint } from './checkpoint-logic.js';
import { checkRequirementCoverage, type CoverageCheckOptions } from './coverage-logic.js';
import { checkExemption } from './exemption-logic.js';
import { checkSignatureChain } from './signature-chain-logic.js';
import { checkArchiveIntegrity } from './archive-integrity-logic.js';
import { checkDesignContractConsistency } from './design-contract-logic.js';
import { createRequire } from 'node:module';
import type * as TsType from 'typescript';
import {
  checkCodeTlaConsistency,
  extractCodeStateTransfers,
  type CodeTlaConsistencyInput,
  type CodeFile,
} from './code-tla-logic.js';
import { checkRootCauseReport } from './root-cause-logic.js';
import {
  checkBddModel,
  parseFeatureHeader,
  parseBackgroundStateMachine,
  type BddManifest,
  type BddCheckInput,
  type ScenarioPathCheck,
  type TlaSpecSnapshot,
} from './bdd-logic.js';
import { checkPreventiveReview, type PreventiveReview } from './preventive-review-logic.js';
import { checkTlaBddSync } from './tla-bdd-sync-logic.js';
import { checkRoleDispatch } from './check-role-dispatch.js';
import { checkStateMachineConsistency } from './check-state-machine-consistency.js';
import { checkCodegraphQueries } from './check-codegraph-queries.js';
import { checkOpsxArtifacts } from './check-opsx-artifacts.js';
import { checkOpenspecArchive } from './check-openspec-archive.js';
import { checkUatPathMappingContent } from './check-artifact-gate.js';

const ts = createRequire(import.meta.url)('typescript') as typeof TsType;

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
  /** P1.1 阶段级校验选项：传入时按对应 phase 校验，未传时默认 phase=8（终检） */
  phaseOption?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
    expectedReasonPatterns: [/\[schema\].*ranking/],
    description: 'ranking.k=2.5 非整数，应被 schema type:integer 前置校验拦截',
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
    expectedReasonPatterns: [/\[schema\].*varianceThreshold/],
    description: 'meta.varianceThreshold 缺失，应被 schema required 前置校验拦截',
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
    description: 'passed=false 与 qualityLevel=B 不一致（B 级应 passed=true）',
  },
  {
    file: 'bad-reviewed-at.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*reviewedAt/],
    description: 'reviewedAt 不是有效时间，应被 schema format:date-time 前置校验拦截',
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
  // -------------------- P2.4/P2.5/P3.10 verifier 标准化校验（第 9 轮） --------------------
  {
    file: 'bad-targetkind.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*targetKind/],
    description: 'P2.5 targetKind=testcase 已废弃，应被 schema enum 前置校验拦截',
  },
  {
    file: 'bad-subcriteria-name.json',
    expectedPassed: false,
    expectedReasonPatterns: [/应为.*fake-criterion/],
    description: 'P2.4 subCriteria 名称 fake-criterion 不在 test 标准集合内，应被命名校验拦截',
  },
  {
    file: 'bad-rawscores-constant.json',
    expectedPassed: false,
    expectedReasonPatterns: [/rawScores 全同/],
    description: 'P3.10 coverage 维度 rawScores 全同 [0.90,0.90,0.90]，应被防漂移规则 1 拦截',
  },
  {
    file: 'bad-summary-too-short.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*summary/],
    description: 'summary 长度 < 50 字符，应被 schema minLength:50 前置校验拦截',
  },
  {
    file: 'bad-evidence-empty.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence.*缺具体引用.*R12/],
    description: 'evidence 缺具体引用，应被 R12 校验拦截（sig-002）',
  },
  {
    file: 'bad-single-axis-low.json',
    expectedPassed: false,
    expectedReasonPatterns: [/completeness.*0\.65.*0\.7(?!\d).*单轴下限/],
    description: 'R13 单轴下限：completeness=0.65<0.70 加权平均达 A 级（0.86）但单轴失败，应 passed=false（反模式 #41）',
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
    expectedReasonPatterns: [/\[schema\].*executionSummary/],
    description: 'RTM 缺 executionSummary，应被 schema required 前置校验拦截（[schema] 前缀）',
  },
  // -------------------- P1.1 阶段级校验（第 9 轮） --------------------
  {
    file: 'valid-phase6.json',
    expectedPassed: true,
    phaseOption: 6,
    description: 'P1.1 phase=6 合法：unit+integration 通过，system/acceptance pending 合理跳过',
  },
  {
    file: 'bad-phase6-pending-system.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/REQ-001.*integrationTest/],
    description: 'P1.1 phase=6 REQ 缺 integrationTest 字段应失败',
  },
  {
    file: 'bad-phase5-missing-codemodule.json',
    expectedPassed: false,
    phaseOption: 5,
    expectedReasonPatterns: [/REQ-001.*codeModule/],
    description: 'P1.1 phase=5 REQ 缺 codeModule 应失败',
  },
  {
    file: 'bad-phase5-missing-codemodule.json',
    expectedPassed: false,
    phaseOption: 8,
    expectedReasonPatterns: [/REQ-001.*codeModule/],
    description: 'P1.1 phase=5 bad 样本在 phase=8 终检也应失败',
  },
  {
    file: 'valid-phase6.json',
    expectedPassed: false,
    phaseOption: 8,
    expectedReasonPatterns: [/待执行/],
    description: 'P1.1 phase=6 合法场景在 phase=8 终检应失败（system/acceptance pending）',
  },
  {
    file: 'valid-phase6.json',
    expectedPassed: false,
    description: 'P1.1 未传 phaseOption 默认 phase=8（向后兼容，valid-phase6 应因 pending 失败）',
  },
  // -------------------- §10J RTM 增量校验修正（第 22 轮） --------------------
  {
    file: 'valid-phase1.json',
    expectedPassed: true,
    phaseOption: 1,
    description: '§10J phase=1 REQ 行 acceptanceTest 非空 + NFR 行豁免，应通过',
  },
  {
    file: 'bad-phase1-missing-acceptance-test.json',
    expectedPassed: false,
    phaseOption: 1,
    expectedReasonPatterns: [/REQ-001.*acceptanceTest/],
    description: '§10J phase=1 REQ 行 acceptanceTest 为空，应被增量校验拦截',
  },
  // -------------------- 第24轮 P0 RTM coverageStatus 校验 --------------------
  {
    file: 'bad-rtm-coverage-below-100.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100/],
    description: 'RTM coveragePercent=66% < 100%，应被覆盖率门禁拦截（约束 #18）',
  },
  {
    file: 'bad-rtm-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/coverageStatus.*不一致/],
    description: 'RTM coverageStatus="100%" 但 coveragePercent=66%，应被 coverageStatus 一致性校验拦截',
  },
  // -------------------- 第24轮 P2 NFR 双值校验 --------------------
  {
    file: 'bad-nfr-missing-dual-fields.json',
    expectedPassed: false,
    expectedReasonPatterns: [/NFR 行 NFR-001 缺 targetValue 与 testThreshold/],
    description: 'NFR-001 行缺 targetValue + testThreshold 双字段，应被 NFR 双值校验拦截',
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
  // -------------------- 四维识别·维度1/3：13 个 phase=1 纯 REQ 图样本（第 20 轮） --------------------
  {
    file: 'valid-req-hierarchy.json',
    phase: 1,
    expectedPassed: true,
    description: '四维·维度1：phase=1 纯 REQ 层级树（4 层 parent + level + reqGroup），应通过 R1-R4',
  },
  {
    file: 'valid-multi-group.json',
    phase: 1,
    expectedPassed: true,
    description: '四维·维度1：phase=1 纯 REQ 多 group（2 个 level=1 根 + collaborates-with），应通过多 group 模式',
  },
  {
    file: 'valid-cross-cuts-nfr.json',
    phase: 1,
    expectedPassed: true,
    description: '四维·维度3：phase=1 纯 REQ 图含 NFR/CON 横切节点（cross-cuts 边），NFR/CON 不参与 R1-R4',
  },
  {
    file: 'valid-cross-logic.json',
    phase: 1,
    expectedPassed: true,
    description: '四维·维度3：phase=1 纯 REQ 图含 depends-on/precedes/conflicts-with（对称）+ cross-cuts，应通过 R5/R6',
  },
  {
    file: 'valid-small-project-exemption.json',
    phase: 1,
    expectedPassed: true,
    description: '四维·维度1：phase=1 小项目纯 REQ 图（REQ 总数<5），R4 不强制 level=1 group',
  },
  {
    file: 'bad-req-hierarchy-orphan.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/orphan/],
    description: '四维·维度1：REQ-003 level=3 缺 parent 入边，应被 R2 orphan 校验拦截',
  },
  {
    file: 'bad-req-hierarchy-multi-parent.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/multiParent|父唯一性/],
    description: '四维·维度1：REQ-003 有两条 parent 入边，应被 R2 父唯一性校验拦截',
  },
  {
    file: 'bad-level-not-monotonic.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R3 level 单调/],
    description: '四维·维度1：REQ-001(1)→REQ-002(3) 跳级，应被 R3 level 单调校验拦截',
  },
  {
    file: 'bad-missing-level.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R1-R4.*level/],
    description: '四维·维度1：REQ 节点缺 level 字段，应被 R1-R4 强制必填校验拦截',
  },
  {
    file: 'bad-no-req-group.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R4.*REQ-group/],
    description: '四维·维度1：REQ 总数≥5 但无 level=1 REQ，应被 R4 REQ-group 非空校验拦截',
  },
  {
    file: 'bad-depends-on-cycle.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R5.*depends-on.*环/],
    description: '四维·维度3：depends-on 子图有环（REQ-002→REQ-003→REQ-002），应被 R5 依赖无环校验拦截',
  },
  {
    file: 'bad-precedes-cycle.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R5.*precedes.*环/],
    description: '四维·维度3：precedes 子图有环（REQ-002→REQ-003→REQ-002），应被 R5 时序无环校验拦截',
  },
  {
    file: 'bad-cross-logic.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R6.*cross-cuts.*目标类型|conflicts-with.*对称/],
    description: '四维·维度3：cross-cuts 目标 SD-001 非 REQ + conflicts-with 单向，应被 R6 横切边校验拦截',
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
  {
    file: 'bad-checkrounds-phase-summary.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/R13.*checkRounds\[0\] 含禁止字段 phaseSummary.*phase 级摘要字段/],
    description: 'checkRounds 元素含 phaseSummary 字段（phase 级摘要），应被 R13 schema 校验拦截（第 16 轮 P1.1）',
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
    expectedReasonPatterns: [/\[schema\].*budgetBurnRate/],
    description: 'killSwitch.budgetBurnRate=1.5 超出 [0,1]，应被 schema maximum:1 前置校验拦截',
  },
  {
    file: 'rootcause-valid.json',
    expectedPassed: true,
    description: '含 rootcauseParallelBudget 且所有轮次均在限额内，应通过 R4-A 校验',
  },
  {
    file: 'rootcause-over-budget.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R4-A.*maxTokensPerPersona/, /R4-A.*总 tokens.*maxTotalTokensPerRound/],
    description: 'R4-A：persona tokens 超 maxTokensPerPersona + 总 tokens 超 maxTotalTokensPerRound',
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
  /** 传给 checkMaturity 的 options（可选，默认不传） */
  options?: { completedPhases?: number };
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
    expectedReasonPatterns: [/\[schema\].*level/],
    description: 'level=L5 超出 L0/L1/L2/L3，应被 schema enum 前置校验拦截',
  },
  {
    file: 'bad-r3-cycle-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R3.*8 阶段.*1 完整周期.*completedCycles=0/],
    options: { completedPhases: 8 },
    description: 'P2.1 R3 单位修正：completedPhases=8（1 完整周期）但 completedCycles=0，应触发 R3 违规',
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
  { file: 'bad-r2-chain-length.json', expectedPassed: false, expectedReasonPatterns: [/\[schema\].*rootCauseChain/], description: 'R2 chain 仅 1 步（schema minItems:2 前置拦截）' },
  { file: 'bad-r3-falsifiability.json', expectedPassed: false, expectedReasonPatterns: [/falsifiabilityCheck.*若.*则/], description: 'R3 无若...则句式' },
  { file: 'bad-r4-fix-recommendation.json', expectedPassed: false, expectedReasonPatterns: [/fixRecommendation.*rationale/], description: 'R4 缺 rationale' },
  { file: 'bad-r5-prevention.json', expectedPassed: false, expectedReasonPatterns: [/prevention.*owner/], description: 'R5 缺 owner' },
  { file: 'bad-r6-upstream-defect.json', expectedPassed: false, expectedReasonPatterns: [/upstreamDefect.*upstreamPhase/], description: 'R6 present=true 缺 upstreamPhase' },
  { file: 'bad-r7-quality-level.json', expectedPassed: false, expectedReasonPatterns: [/qualityLevel.*passed.*一致/], description: 'R7 qualityLevel=C 但 passed=true' },
  { file: 'bad-r8-report-id.json', expectedPassed: false, expectedReasonPatterns: [/reportId.*格式/], description: 'R8 reportId 含下划线' },
  { file: 'bad-r9-partial-missing.json', expectedPassed: false, expectedReasonPatterns: [/partialReports.*非空/], description: 'R9 多角度缺 partialReports' },
  { file: 'bad-r10-reality-confidence.json', expectedPassed: false, expectedReasonPatterns: [/reality-checker.*confidence/], description: 'R10 reality-checker confidence=0.3' },
];

// -------------------- Preventive Review（第22轮新增） --------------------

interface PreventiveReviewCase {
  /** 样本文件名（相对 samples/preventive-review/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const PREVENTIVE_REVIEW_CASES: PreventiveReviewCase[] = [
  {
    file: 'valid-completeness.json',
    expectedPassed: false, // 单份报告不齐 → checkPreventiveReview 返回 false
    description: 'R3 完整性报告合规（但其他维度缺失，整体 passed=false）',
  },
  {
    file: 'bad-missing-evidence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence/],
    description: 'R3 报告缺失 evidence 字段（schema 校验失败 + 其他维度缺失）',
  },
];

// -------------------- TLA+/BDD Sync（第22轮新增） --------------------

interface TlaBddSyncCase {
  /** 样本文件名（相对 samples/tla-bdd-sync/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 用例说明 */
  description: string;
}

const TLA_BDD_SYNC_CASES: TlaBddSyncCase[] = [
  { file: 'valid.json', expectedPassed: true, description: 'TLA+/BDD 一致' },
  { file: 'bad-transition-mismatch.json', expectedPassed: false, description: 'TLA+/BDD 转移不一致' },
];

// -------------------- 第24轮 P0 角色分派完整性校验 --------------------

interface RoleDispatchCase {
  file: string;
  r3Enabled: boolean;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const ROLE_DISPATCH_CASES: RoleDispatchCase[] = [
  {
    file: 'bad-missing-V-role.jsonl',
    r3Enabled: false,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=V/],
    description: '阶段 1 缺 role=V 评审记录，应被角色分派校验拦截（约束 #19）',
  },
  {
    file: 'bad-missing-G-role.jsonl',
    r3Enabled: false,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=G/],
    description: '阶段 1 缺 role=G 门禁记录，应被角色分派校验拦截（约束 #19）',
  },
  {
    file: 'bad-missing-R-role.jsonl',
    r3Enabled: true,
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=R/],
    description: 'R3 启用但阶段 1 仅有 1 条 R3 记录（缺 reliability/security），应被拦截',
  },
];

// -------------------- 第24轮 P1 状态机一致性校验 --------------------

interface StateMachineCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const STATE_MACHINE_CASES: StateMachineCase[] = [
  {
    file: 'bad-missing-transition.json',
    expectedPassed: false,
    expectedReasonPatterns: [/代码状态机缺转移/],
    description: '设计文档有 draft→published 但代码缺，应被一致性校验拦截',
  },
  {
    file: 'bad-extra-transition.json',
    expectedPassed: false,
    expectedReasonPatterns: [/代码状态机多转移|代码状态机多状态/],
    description: '代码有 archived→deleted 但设计文档缺，应被一致性校验拦截',
  },
  {
    file: 'valid-consistent.json',
    expectedPassed: true,
    description: '设计文档与代码状态机完全一致，应通过',
  },
];

// -------------------- 第25轮 codegraph/opsx 校验 --------------------

interface CodegraphQueryCase {
  sampleDir: string;  // samples/ 下的子目录路径（作为 projectRoot）
  phase: number;
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

const CODEGRAPH_QUERY_CASES: CodegraphQueryCase[] = [
  {
    sampleDir: 'codegraph-queries/valid-phase5',
    phase: 5,
    expectedPassed: true,
    description: '有效的 codegraph 查询落盘（含 querySymbol/callers/callees/timestamp），应通过',
  },
  {
    sampleDir: 'codegraph-queries/bad-empty',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/无 phase5-\*\.json 查询文件/],
    description: 'codegraph-queries 目录存在但无 phase5-*.json 文件，应未通过',
  },
  {
    sampleDir: 'codegraph-queries/bad-missing-field',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/缺 callers\[\] 字段|缺 callees\[\] 字段/],
    description: '查询文件缺 callers/callees 字段，应未通过',
  },
];

interface OpsxArtifactCase {
  sampleDir: string;
  phase: number;
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

const OPSX_ARTIFACT_CASES: OpsxArtifactCase[] = [
  {
    sampleDir: 'opsx-artifacts/valid-phase5',
    phase: 5,
    expectedPassed: true,
    description: 'opsx 制品齐全（proposal/design/tasks/tickets/specs）+ R3×9 + V×3，应通过',
  },
  {
    sampleDir: 'opsx-artifacts/bad-missing-tickets',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/tickets\.md 缺失/],
    description: 'opsx 变更目录缺 tickets.md（反模式 #40），应未通过',
  },
];

interface OpenspecArchiveCase {
  sampleDir: string;
  phase: number;
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

const OPENSPEC_ARCHIVE_CASES: OpenspecArchiveCase[] = [
  {
    sampleDir: 'openspec-archive/valid',
    phase: 5,
    expectedPassed: true,
    description: 'openspec 归档目录含完整制品（proposal/design/tasks/specs），应通过',
  },
  {
    sampleDir: 'openspec-archive/bad-no-archive',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/archive\/ 目录不存在/],
    description: 'openspec/changes/archive/ 不存在（opsx:archive 未执行），应未通过',
  },
];

interface UatPathMappingCase {
  sampleDir: string; // samples/uat-path-mapping/<dir>/docs/uat-path-mapping.md
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

const UAT_PATH_MAPPING_CASES: UatPathMappingCase[] = [
  {
    sampleDir: 'uat-path-mapping/valid-phase5',
    expectedPassed: true,
    description: 'B4 阶段5回填完整（实际路径非占位符 + mappingType 合法），应通过',
  },
  {
    sampleDir: 'uat-path-mapping/bad-empty-table',
    expectedPassed: false,
    expectedViolationPatterns: [/无有效映射行/],
    description: 'B4 空表（仅表头无数据行）应报"无有效映射行"，不静默通过',
  },
  {
    sampleDir: 'uat-path-mapping/bad-malformed-row',
    expectedPassed: false,
    expectedViolationPatterns: [/行畸形/],
    description: 'B4 畸形行（单元格数 < 4）应记录 violation，不静默跳行',
  },
  {
    sampleDir: 'uat-path-mapping/bad-empty-cell',
    expectedPassed: false,
    expectedViolationPatterns: [/含空单元格/],
    description: 'B4 畸形行（空单元格）应记录 violation，不静默跳行',
  },
  {
    sampleDir: 'uat-path-mapping/bad-unbackfilled',
    expectedPassed: false,
    expectedViolationPatterns: [/未回填/],
    description: 'B5 终检语义（checkUatPathMappingContent 供阶段5/终检共用）下含未回填行应失败',
  },
];

// -------------------- BDD（Task 5：10 样本，2 valid + 8 bad） --------------------

interface BddCase {
  /** manifest 文件名（相对 samples/bdd/） */
  manifestFile: string;
  /** feature 文件名列表（相对 samples/bdd/） */
  featureFiles: string[];
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 exitCode（0=通过, 1=校验失败, 2=schema/输入错误） */
  expectedExitCode: 0 | 1 | 2;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
  /** 校验阶段 */
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** 注入的 TLA+ 快照（用于 D4 等价性校验） */
  tlaSnapshots?: TlaSpecSnapshot[];
  /** 注入的 RTM 行（用于 D7 RTM 映射校验） */
  rtmRows?: Array<{ reqId: string; acceptanceTest: string | null; systemTest: string | null; integrationTest: string | null; unitTest: string | null }>;
  /** 注入的 cucumber 报告（用于 D5 step 绑定校验，phase >= 5） */
  cucumberReport?: { undefinedCount: number; pendingCount: number; failedCount: number };
}

const BDD_CASES: BddCase[] = [
  // -------------------- 2 valid 样本（L1 + L2） --------------------
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['valid-l1.feature'],
    expectedPassed: true,
    expectedExitCode: 0,
    phase: 1,
    description: '完整合法的 L1 features + manifest：头标注完整 + 状态机七要素齐全 + scenario 路径合法',
  },
  {
    manifestFile: 'valid-l2-manifest.json',
    featureFiles: ['valid-l2.feature'],
    expectedPassed: true,
    expectedExitCode: 0,
    phase: 2,
    description: '完整合法的 L2 features + manifest：parent 指向 L1 + 状态机七要素齐全',
  },
  // -------------------- 8 bad 样本（覆盖 D1/D3/D4/D5/D6/D7 + schema） --------------------
  {
    manifestFile: 'bad-schema.manifest.json',
    featureFiles: ['valid-l1.feature'],
    expectedPassed: false,
    expectedExitCode: 2,
    expectedReasonPatterns: [/\[schema\].*basePath/],
    phase: 1,
    description: 'manifest 缺 basePath 字段，应被 schema required 前置校验拦截（exitCode=2）',
  },
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['bad-missing-header.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/missing required field @tla-spec/],
    phase: 1,
    description: 'feature 头标注缺 @tla-spec，应被 parseFeatureHeader 头标注完整性校验拦截',
  },
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['bad-incomplete-state-machine.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/@rejecting-states missing/],
    phase: 1,
    description: 'Background 缺 @rejecting-states，应被 D3 状态机七要素完整性校验拦截',
  },
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['bad-invalid-transition.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/transition from "Unknown" not in @states/],
    phase: 1,
    description: '转移表 From=Unknown 不在 @states 中，应被 D3 转移表校验拦截',
  },
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['bad-scenario-path.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/no transition from "Unauthenticated" on event "logout"/],
    phase: 1,
    description: 'scenario When=logout 但转移表无此 From+Event，应被 D6 路径合法性校验拦截',
  },
  {
    manifestFile: 'bad-tla-mismatch.manifest.json',
    featureFiles: ['valid-l1.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/state set mismatch/],
    phase: 1,
    description: 'BDD 状态集与 TLA+ 快照不一致，应被 D4 等价性校验拦截',
    tlaSnapshots: [
      {
        specId: 'L1-blog_system',
        states: ['LoggedOut', 'LoggedIn'],
        initialState: 'LoggedOut',
        transitions: [{ from: 'LoggedOut', event: 'login', to: 'LoggedIn' }],
        invariants: ['LoggedIn => sessionValid'],
      },
    ],
  },
  {
    manifestFile: 'bad-no-rtm-mapping.manifest.json',
    featureFiles: ['valid-l1.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/feature id not in RTM row/],
    phase: 1,
    description: 'feature id 未登记在 RTM test 字段中，应被 D7 RTM 映射校验拦截',
    rtmRows: [
      { reqId: 'REQ-001', acceptanceTest: null, systemTest: null, integrationTest: null, unitTest: null },
    ],
  },
  {
    manifestFile: 'valid-manifest.json',
    featureFiles: ['bad-step-unbound.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/undefined steps/],
    phase: 5,
    description: 'feature 含未绑定 step（注入 cucumberReport.undefinedCount=1），应被 D5 step 绑定校验拦截',
    cucumberReport: { undefinedCount: 1, pendingCount: 0, failedCount: 0 },
  },
];

// -------------------- Coverage（四维·维度4：10 样本，5 valid + 5 bad） --------------------

interface CoverageCase {
  /** 样本文件名（相对 samples/coverage/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 透传给 checkRequirementCoverage 的 options */
  options?: CoverageCheckOptions;
  /** 用例说明 */
  description: string;
}

const COVERAGE_CASES: CoverageCase[] = [
  // -------------------- 5 valid 样本 --------------------
  {
    file: 'valid-full-coverage.json',
    expectedPassed: true,
    description: '四维·维度4：完整覆盖（4 维度均 100% + REQ/NFR/CON 三类 + happy/error/boundary 三类）',
  },
  {
    file: 'valid-minimal-coverage.json',
    expectedPassed: true,
    description: '四维·维度4：最小合规覆盖（每维度仅 1 项 covered，metrics 重算一致）',
  },
  {
    file: 'valid-metrics-recalc.json',
    expectedPassed: true,
    description: '四维·维度4：metrics 100% 与重算一致（C10 通过）',
  },
  {
    file: 'valid-cross-cuts-consistent.json',
    expectedPassed: true,
    options: { graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }] },
    description: '四维·维度4：crossCuts 与 graph.json cross-cuts 边集一致（C7 通过）',
  },
  {
    file: 'valid-out-of-scope-declared.json',
    expectedPassed: true,
    description: '四维·维度4：NFR/CON 不适用但 status=covered + gapDescription 声明',
  },
  // -------------------- 5 bad 样本 --------------------
  {
    file: 'bad-empty-stakeholder.json',
    expectedPassed: false,
    expectedReasonPatterns: [/C1 stakeholders/],
    description: '四维·维度4：stakeholders 数组为空，应被 C1 校验拦截',
  },
  {
    file: 'bad-missing-scenario-type.json',
    expectedPassed: false,
    expectedReasonPatterns: [/C4.*boundary/],
    description: '四维·维度4：scenarios 缺 boundary 类型，应被 C4 场景类型校验拦截',
  },
  {
    file: 'bad-coverage-below-threshold.json',
    expectedPassed: false,
    expectedReasonPatterns: [/C8.*stakeholder.*< 100/],
    description: '四维·维度4：stakeholder 覆盖率 50% < 100%，应被 C8 阈值校验拦截',
  },
  {
    file: 'bad-partial-not-resolved.json',
    expectedPassed: false,
    expectedReasonPatterns: [/C8.*partial/],
    description: '四维·维度4：存在 partial 项未补齐，应被 C8 100% 阈值校验拦截',
  },
  {
    file: 'bad-cross-cuts-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/C7.*coverage.*graph/],
    options: { graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }] },
    description: '四维·维度4：coverage 有 NFR-001→REQ-002 但 graph.json 无，应被 C7 双向校验拦截',
  },
];

// -------------------- Exemption（四维·豁免审批：7 样本，2 valid + 5 bad） --------------------

interface ExemptionCase {
  /** 样本文件名（相对 samples/exemption/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const EXEMPTION_CASES: ExemptionCase[] = [
  // -------------------- 2 valid 样本（S→R→V→人类 全 approve） --------------------
  {
    file: 'valid-full-approval.json',
    expectedPassed: true,
    description: '四维·豁免：完整 S→R→V→人类 四阶段 approve（E1-E8 全通过）',
  },
  {
    file: 'valid-coverage-exemption.json',
    expectedPassed: true,
    description: '四维·豁免：coverage-missing-declared 类型豁免（NFR 不适用声明）',
  },
  // -------------------- 5 bad 样本（覆盖 E4-E8 各阶段失败） --------------------
  {
    file: 'bad-s-self-approve.json',
    expectedPassed: false,
    expectedReasonPatterns: [/E4 review.*缺失|E7 verification.*缺失|E8 humanDecision.*缺失/],
    description: '四维·豁免：S 自行批准（缺 R/V/人类三阶段），应被 E4/E7/E8 拦截',
  },
  {
    file: 'bad-r-template-review.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*rootCauseAnalysis.*30/],
    description: '四维·豁免：R rootCauseAnalysis 模板化（<30 字符），schema minLength:30 前置拦截（E6 与 schema 冗余）',
  },
  {
    file: 'bad-v-not-verified.json',
    expectedPassed: false,
    expectedReasonPatterns: [/E7.*verified.*false/],
    description: '四维·豁免：V 校验未通过（verified=false），应被 E7 拦截',
  },
  {
    file: 'bad-no-human.json',
    expectedPassed: false,
    expectedReasonPatterns: [/E8 humanDecision.*缺失/],
    description: '四维·豁免：缺人类确认阶段，应被 E8 拦截',
  },
  {
    file: 'bad-r-reject.json',
    expectedPassed: false,
    expectedReasonPatterns: [/E5.*reviewDecision.*reject/],
    description: '四维·豁免：R 审查拒绝（reviewDecision=reject），应被 E5 拦截',
  },
];

// -------------------- DesignContract --------------------

interface DesignContractCase {
  /** 样本文件名（相对 samples/design-contract/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const DESIGN_CONTRACT_CASES: DesignContractCase[] = [
  {
    file: 'valid-consistent.json',
    expectedPassed: true,
    description: '路径/参数/状态码/字段全部一致，应通过',
  },
  {
    file: 'bad-path-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D1\]/],
    description: 'UAT 路径映射实际路径在路由定义中不存在，应被 D1 拦截',
  },
  {
    file: 'bad-param-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D2\]/],
    description: '验收测试使用 limit 但路由定义使用 pageSize，应被 D2 拦截',
  },
  {
    file: 'bad-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[D3\]/],
    description: '验收测试预期 204 但路由实际返回 200，应被 D3 拦截',
  },
];

// -------------------- SignatureChain（[21.0.0] 签名链：12 样本，1 valid + 11 bad） --------------------

interface SignatureChainCase {
  /** 样本文件名（相对 samples/signature-chain/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 rulesFailed 中至少包含以下每个值（全部包含才算通过） */
  expectedRulesFailed?: string[];
  /** 用例说明 */
  description: string;
}

const SIGNATURE_CHAIN_CASES: SignatureChainCase[] = [
  { file: 'valid-all-roles.jsonl', expectedPassed: true, description: '签名链：阶段 1 完整 9 角色 + 用户确认 checkpoint（R1-R10 全通过）' },
  { file: 'bad-missing-V.jsonl', expectedPassed: false, expectedRulesFailed: ['R1'], description: '签名链：缺 V 角色，R1 失败' },
  { file: 'bad-broken-chain.jsonl', expectedPassed: false, expectedRulesFailed: ['R2'], description: '签名链：prevSigHash 不匹配，R2 失败' },
  { file: 'bad-backdated.jsonl', expectedPassed: false, expectedRulesFailed: ['R3'], description: '签名链：时间戳非单调，R3 失败' },
  { file: 'bad-O-produce.jsonl', expectedPassed: false, expectedRulesFailed: ['R4'], description: '签名链：非法角色 X，R4 失败' },
  { file: 'bad-O-self-sign.jsonl', expectedPassed: false, expectedRulesFailed: ['R5'], description: '签名链：O 代签 checkpoint，R5 失败' },
  { file: 'bad-tampered-hash.jsonl', expectedPassed: false, expectedRulesFailed: ['R6'], description: '签名链：sigHash 篡改，R6 失败' },
  { file: 'bad-dangling-source.jsonl', expectedPassed: false, expectedRulesFailed: ['R7'], description: '签名链：悬空来源，R7 失败' },
  { file: 'bad-missing-artifact.jsonl', expectedPassed: false, expectedRulesFailed: ['R8'], description: '签名链：缺失产物，R8 失败' },
  { file: 'bad-S-consumes-G.jsonl', expectedPassed: false, expectedRulesFailed: ['R9'], description: '签名链：S 越权消费 G，R9 失败' },
  { file: 'bad-R-consumes-S.jsonl', expectedPassed: false, expectedRulesFailed: ['R9'], description: '签名链：R 越权消费 S，R9 失败' },
  { file: 'bad-O-bypass-G.jsonl', expectedPassed: false, expectedRulesFailed: ['R10'], description: '签名链：O checkpoint 绕过 G，R10 失败' },
];

// -------------------- ArchiveIntegrity（[21.0.0] 归档完整性：4 样本，1 valid + 3 bad） --------------------

interface ArchiveIntegrityCase {
  /** 样本文件名（相对 samples/archive-integrity/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 missingFiles 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const ARCHIVE_INTEGRITY_CASES: ArchiveIntegrityCase[] = [
  { file: 'valid-full.json', expectedPassed: true, description: '归档完整性：全阶段强制文件齐全' },
  { file: 'bad-missing-phase1-docs.json', expectedPassed: false, expectedReasonPatterns: [/requirements\.md/], description: '归档完整性：缺 phase-1 文档' },
  { file: 'bad-missing-signature-chain.json', expectedPassed: false, expectedReasonPatterns: [/signature-chain\.jsonl/], description: '归档完整性：缺 signature-chain.jsonl' },
  { file: 'bad-missing-gate-logs.json', expectedPassed: false, expectedReasonPatterns: [/gate-logs\//], description: '归档完整性：缺 gate-logs/ 目录' },
];

// -------------------- Schema 前置校验（借鉴 drawio-skill/styles/schema.json） --------------------

interface SchemaCase {
  /** 样本文件名（相对 samples/schema/） */
  file: string;
  /** schema 名（schema-loader 自动注册的 basename，无 .schema.json 后缀） */
  schema: string;
  /** 期望 schema 校验是否通过 */
  expectedValid: boolean;
  /** 期望 errorMessages 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedErrorPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const SCHEMA_CASES: SchemaCase[] = [
  // -------------------- verifier-output schema（基线 3 条） --------------------
  {
    file: 'bad-additional-props.json',
    schema: 'verifier-output',
    expectedValid: false,
    expectedErrorPatterns: [/additionalProperties/],
    description: '未知字段 unknownExtraField 应被 additionalProperties:false 拦截',
  },
  {
    file: 'bad-missing-required.json',
    schema: 'verifier-output',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: '缺失 passed / meta 必填字段应被 required 拦截',
  },
  {
    file: 'bad-wrong-type.json',
    schema: 'verifier-output',
    expectedValid: false,
    expectedErrorPatterns: [/type/],
    description: 'compositeScore 为字符串应被 type:number 拦截',
  },
  // -------------------- 借鉴点 2：12 份 schema 各加一条用例（Task 3） --------------------
  {
    file: 'bad-budget-additional-props.json',
    schema: 'budget',
    expectedValid: false,
    expectedErrorPatterns: [/additionalProperties/],
    description: 'budget 顶层未知字段 unknownBudgetField 应被 additionalProperties:false 拦截',
  },
  {
    file: 'bad-checkpoint-log-missing-required.json',
    schema: 'checkpoint-log',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'checkpoint-log 缺 runId 必填字段应被 required 拦截',
  },
  {
    file: 'bad-code-tla-manifest-wrong-type.json',
    schema: 'code-tla-manifest',
    expectedValid: false,
    expectedErrorPatterns: [/type/],
    description: 'code-tla-manifest manifest.specs 为字符串应被 type:array 拦截',
  },
  {
    file: 'bad-event-ingress-missing-required.json',
    schema: 'event-ingress',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'event-ingress 缺 eventId 必填字段应被 required 拦截',
  },
  {
    file: 'bad-graph-additional-props.json',
    schema: 'graph',
    expectedValid: false,
    expectedErrorPatterns: [/additionalProperties/],
    description: 'graph node 未知字段 unknownNodeField 应被 additionalProperties:false 拦截',
  },
  {
    file: 'bad-hill-climbing-report-missing-required.json',
    schema: 'hill-climbing-report',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'hill-climbing-report 缺 reportId 必填字段应被 required 拦截',
  },
  {
    file: 'bad-maturity-wrong-type.json',
    schema: 'maturity',
    expectedValid: false,
    expectedErrorPatterns: [/enum/],
    description: 'maturity level=L5-INVALID-ENUM 应被 enum 拦截',
  },
  {
    file: 'bad-project-missing-required.json',
    schema: 'project',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'project 缺 id 必填字段应被 required 拦截',
  },
  {
    file: 'bad-rootcause-report-additional-props.json',
    schema: 'rootcause-report',
    expectedValid: false,
    expectedErrorPatterns: [/additionalProperties/],
    description: 'rootcause-report 顶层未知字段 unknownReportField 应被 additionalProperties:false 拦截',
  },
  {
    file: 'bad-rtm-wrong-type.json',
    schema: 'rtm',
    expectedValid: false,
    expectedErrorPatterns: [/type/],
    description: 'rtm currentPhase 为字符串应被 type:integer 拦截',
  },
  {
    file: 'bad-run-log-missing-required.json',
    schema: 'run-log',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'run-log 缺 timestamp 必填字段应被 required 拦截',
  },
  {
    file: 'bad-tla-manifest-additional-props.json',
    schema: 'tla-manifest',
    expectedValid: false,
    expectedErrorPatterns: [/additionalProperties/],
    description: 'tla-manifest 顶层未知字段 unknownManifestField 应被 additionalProperties:false 拦截',
  },
  // -------------------- 四维识别·coverage schema（第 20 轮） --------------------
  {
    file: 'bad-coverage-missing-required.json',
    schema: 'coverage',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'coverage 缺 metrics 必填字段应被 required 拦截',
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
    // P1.1 阶段级校验：传入 phaseOption 时按对应 phase 校验
    const r = c.phaseOption
      ? checkArtifactGate(parsed as never, { phaseOption: c.phaseOption })
      : checkArtifactGate(parsed as never);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    const phaseTag = c.phaseOption ? `[p${c.phaseOption}]` : '';
    results.push({
      name: `gate/${c.file}${phaseTag}`,
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
    const r = checkMaturity(parsed, c.options);

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
  // [21.0.0] R3 强化：valid 样本须提供 checkpointLog（含用户确认记录）
  const validCheckpointLog = new Map<string, string>([
    ['1', '用户确认：放行进入阶段 2（user-id: alice）'],
    ['2', '用户确认：放行进入阶段 3（user-id: alice）'],
  ]);
  for (const c of CHECKPOINT_CASES) {
    const abs = path.join(samplesDir, 'checkpoint', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonl(raw);
    const r = checkCheckpoint(parsed, { checkpointLog: c.expectedPassed ? validCheckpointLog : undefined });

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

async function runPreventiveReviewCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of PREVENTIVE_REVIEW_CASES) {
    const abs = path.join(samplesDir, 'preventive-review', c.file);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const review = JSON.parse(raw) as PreventiveReview;
      // 单份样本 → 注入到 reviews 字典，其他维度为 null
      const reviews: Record<string, PreventiveReview | null> = {
        completeness: null,
        reliability: null,
        security: null,
        [review.dimension]: review,
      };
      const r = checkPreventiveReview(reviews, review.phase);
      const details: string[] = [];
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed && c.expectedReasonPatterns) {
        details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
      }
      results.push({
        name: `preventive-review/${c.file}`,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name: `preventive-review/${c.file}`,
        passed: false,
        description: c.description,
        details: [`  - ${(err as Error).message}`],
      });
    }
  }
  return results;
}

async function runTlaBddSyncCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of TLA_BDD_SYNC_CASES) {
    const abs = path.join(samplesDir, 'tla-bdd-sync', c.file);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const data = JSON.parse(raw) as { tlaContent: string; featureContent: string };
      const r = checkTlaBddSync(data.tlaContent, data.featureContent);
      const details: string[] = [];
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      results.push({
        name: `tla-bdd-sync/${c.file}`,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name: `tla-bdd-sync/${c.file}`,
        passed: false,
        description: c.description,
        details: [`  - ${(err as Error).message}`],
      });
    }
  }
  return results;
}

async function runRoleDispatchCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ROLE_DISPATCH_CASES) {
    const abs = path.join(samplesDir, 'run-log', c.file);
    const name = `run-log/${c.file}`;
    const details: string[] = [];
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const entries = raw.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => JSON.parse(l) as Record<string, unknown>);
      const r = checkRoleDispatch(entries as Parameters<typeof checkRoleDispatch>[0], c.r3Enabled);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runStateMachineCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of STATE_MACHINE_CASES) {
    const abs = path.join(samplesDir, 'state-machine', c.file);
    const name = `state-machine/${c.file}`;
    const details: string[] = [];
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const parsed = JSON.parse(raw) as Parameters<typeof checkStateMachineConsistency>[0];
      const r = checkStateMachineConsistency(parsed);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runCodegraphQueryCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODEGRAPH_QUERY_CASES) {
    const projectRoot = path.join(samplesDir, c.sampleDir);
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const r = checkCodegraphQueries(projectRoot, c.phase);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.violations, c.expectedViolationPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runOpsxArtifactCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of OPSX_ARTIFACT_CASES) {
    const projectRoot = path.join(samplesDir, c.sampleDir);
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const r = checkOpsxArtifacts(projectRoot, c.phase);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.violations, c.expectedViolationPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runOpenspecArchiveCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of OPENSPEC_ARCHIVE_CASES) {
    const projectRoot = path.join(samplesDir, c.sampleDir);
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const r = checkOpenspecArchive(projectRoot, c.phase);
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(r.violations, c.expectedViolationPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runUatPathMappingCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of UAT_PATH_MAPPING_CASES) {
    const mdPath = path.join(samplesDir, c.sampleDir, 'docs', 'uat-path-mapping.md');
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const content = await fs.readFile(mdPath, 'utf-8');
      const violations = checkUatPathMappingContent(content);
      const passed = violations.length === 0;
      if (passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${passed}`);
      }
      if (!c.expectedPassed) {
        details.push(...matchReasonPatterns(violations, c.expectedViolationPatterns));
      }
      results.push({
        name,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

// -------------------- BDD scenario 解析辅助（与 check-bdd-model.ts 同构） --------------------

function extractBddStateFromStep(body: string, pattern: RegExp): string | null {
  const m = body.match(pattern);
  return m ? m[1]! : null;
}

function extractBddEventsFromWhen(body: string): string[] {
  const events: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:When|And)\s+.+?\b(\w+)\s*$/);
    if (m) events.push(m[1]!);
  }
  return events;
}

function extractBddInvariantsFromThen(body: string): string[] {
  const invs: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:Then|And)\s+不变式\s+"(.+?)"\s+应成立/);
    if (m) invs.push(m[1]!);
  }
  return invs;
}

async function runBddCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const bddSamplesDir = path.join(samplesDir, 'bdd');

  for (const c of BDD_CASES) {
    const manifestPath = path.join(bddSamplesDir, c.manifestFile);
    const name = `bdd/${c.manifestFile}`;
    const details: string[] = [];

    let manifest: BddManifest;
    try {
      const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestRaw) as BddManifest;
    } catch (e) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 无法读取 manifest: ${(e as Error).message}`],
      });
      continue;
    }

    // 解析 features 文件（头标注 + Background 状态机 + scenarios）
    const parsedFeatures: BddCheckInput['parsedFeatures'] = [];
    const headerViolations: string[] = [];
    for (const ff of c.featureFiles) {
      try {
        const featurePath = path.join(bddSamplesDir, ff);
        const content = await fs.readFile(featurePath, 'utf-8');
        const { header, violations: hdrViolations } = parseFeatureHeader(content);
        headerViolations.push(...hdrViolations);

        const bgMatch = content.match(/Background:\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/);
        const bgContent = bgMatch ? bgMatch[1]! : '';
        const { sm } = parseBackgroundStateMachine(bgContent);

        // 提取 scenarios（与 check-bdd-model.ts 同构）
        const scenarios: ScenarioPathCheck[] = [];
        const scenarioRegex = /Scenario:\s*(.+?)\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/g;
        let m: RegExpExecArray | null;
        while ((m = scenarioRegex.exec(content)) !== null) {
          const sName = m[1]!.trim();
          const body = m[2]!;
          const startState = extractBddStateFromStep(body, /Given.*?"(\w+)"/);
          const events = extractBddEventsFromWhen(body);
          const expectedEndState = extractBddStateFromStep(body, /Then.*?"(\w+)"/);
          const invariantAssertions = extractBddInvariantsFromThen(body);
          scenarios.push({ scenarioName: sName, startState, events, expectedEndState, invariantAssertions });
        }

        // 找到 manifest 中对应 feature 的 id
        const featureId = manifest.features.find(f => f.filePath.endsWith(ff))?.id ?? manifest.features[0]?.id ?? '';
        parsedFeatures.push({
          featureId,
          header,
          stateMachine: sm,
          scenarios,
        });
      } catch (e) {
        details.push(`  - 无法读取 feature ${ff}: ${(e as Error).message}`);
      }
    }

    const result = checkBddModel({
      manifest,
      phase: c.phase,
      parsedFeatures,
      tlaSnapshots: c.tlaSnapshots,
      rtmRows: c.rtmRows,
      cucumberReport: c.cucumberReport,
    });

    // 合并 header 解析违反 + checkBddModel 违反（CLI 也应如此聚合）
    const allViolations = [...headerViolations, ...result.violations];
    const actualPassed = allViolations.length === 0;
    // exitCode：schema 失败为 2；有违反为 1；无违反为 0
    const actualExitCode: 0 | 1 | 2 = result.exitCode === 2 ? 2 : (allViolations.length > 0 ? 1 : 0);

    if (actualPassed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    }
    if (actualExitCode !== c.expectedExitCode) {
      details.push(`  - 期望 exitCode=${c.expectedExitCode}，实际 exitCode=${actualExitCode}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(allViolations, c.expectedReasonPatterns));
    }

    results.push({
      name,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runCoverageCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of COVERAGE_CASES) {
    const abs = path.join(samplesDir, 'coverage', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkRequirementCoverage(parsed, c.options);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }

    results.push({
      name: `coverage/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runExemptionCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of EXEMPTION_CASES) {
    const abs = path.join(samplesDir, 'exemption', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkExemption(parsed);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }

    results.push({
      name: `exemption/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runDesignContractCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const tc of DESIGN_CONTRACT_CASES) {
    const filePath = path.join(samplesDir, 'design-contract', tc.file);
    const name = `design-contract/${tc.file}`;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const input = JSON.parse(content);
      const result = checkDesignContractConsistency(input);
      const passed = result.passed === tc.expectedPassed &&
        (!tc.expectedReasonPatterns || tc.expectedReasonPatterns.every(
          (pat) => result.reasons.some((r) => pat.test(r)),
        ));
      results.push({
        name,
        passed,
        description: tc.description,
        details: passed ? [] : [
          `  expectedPassed=${tc.expectedPassed}, actual passed=${result.passed}`,
          `  reasons: ${result.reasons.join('; ')}`,
        ],
      });
    } catch (err) {
      results.push({
        name,
        passed: false,
        description: tc.description,
        details: [`  异常: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

async function runSignatureChainCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of SIGNATURE_CHAIN_CASES) {
    const abs = path.join(samplesDir, 'signature-chain', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const entries = raw.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
    // R8 需 existingPaths；仅 bad-missing-artifact 样本传空集触发 R8，其余样本跳过 R8
    const existingPaths = c.file === 'bad-missing-artifact.jsonl' ? new Set<string>() : undefined;
    const r = checkSignatureChain(entries, { phase: 1, existingPaths });

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed && c.expectedRulesFailed) {
      for (const rf of c.expectedRulesFailed) {
        if (!r.rulesFailed.includes(rf)) {
          details.push(`  - 未匹配期望 rulesFailed=${rf}（实际 rulesFailed=${JSON.stringify(r.rulesFailed)}，violations=${JSON.stringify(r.violations)}）`);
        }
      }
    }

    results.push({
      name: `signature-chain/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runArchiveIntegrityCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ARCHIVE_INTEGRITY_CASES) {
    const abs = path.join(samplesDir, 'archive-integrity', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const contents = new Set<string>(JSON.parse(raw));
    const r = checkArchiveIntegrity(contents);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed && c.expectedReasonPatterns) {
      for (const p of c.expectedReasonPatterns) {
        const matched = r.missingFiles.some(m => p.test(m));
        if (!matched) {
          details.push(`  - 未匹配期望缺失模式 ${p}（实际 missingFiles=${JSON.stringify(r.missingFiles)}）`);
        }
      }
    }

    results.push({
      name: `archive-integrity/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runSchemaCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of SCHEMA_CASES) {
    const abs = path.join(samplesDir, 'schema', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = validateBySchema(c.schema, parsed);

    const details: string[] = [];
    if (r.valid !== c.expectedValid) {
      details.push(`  - 期望 valid=${c.expectedValid}，实际 valid=${r.valid}`);
    }
    if (!c.expectedValid && c.expectedErrorPatterns) {
      for (const p of c.expectedErrorPatterns) {
        const matched = r.errorMessages.some(m => p.test(m));
        if (!matched) {
          details.push(`  - 未匹配期望错误模式 ${p}（实际 errorMessages=${JSON.stringify(r.errorMessages)}）`);
        }
      }
    }

    results.push({
      name: `schema/${c.schema}/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// -------------------- Metadata（借鉴点 4：版本号双写一致性） --------------------

async function runMetadataCheck(skillRoot: string): Promise<CaseResult[]> {
  const skill = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf-8');
  const meta = JSON.parse(await fs.readFile(path.join(skillRoot, 'skill-metadata.json'), 'utf-8')) as { version: string };
  const versionMatch = skill.match(/^version:\s*(.+)$/m);
  const skillVersion = versionMatch?.[1]?.trim();
  const details: string[] = [];
  if (skillVersion === undefined) {
    details.push('  - SKILL.md frontmatter 缺 version 字段');
  } else if (skillVersion !== meta.version) {
    details.push(`  - 版本不一致: SKILL.md=${skillVersion}, metadata=${meta.version}`);
  }
  return [{
    name: 'metadata/version-consistency',
    passed: details.length === 0,
    description: 'SKILL.md frontmatter version 与 skill-metadata.json 一致',
    details: details.length > 0 ? details : undefined,
  }];
}

// ==================== 入口 ====================

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const samplesDir = path.join(here, 'samples');
  const skillRoot = path.join(here, '..');

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
  console.log(`Schema 用例    : ${SCHEMA_CASES.length}`);
  console.log(`BDD 用例       : ${BDD_CASES.length}`);
  console.log(`Coverage 用例  : ${COVERAGE_CASES.length}`);
  console.log(`Exemption 用例 : ${EXEMPTION_CASES.length}`);
  console.log(`SignatureChain 用例 : ${SIGNATURE_CHAIN_CASES.length}`);
  console.log(`ArchiveIntegrity 用例: ${ARCHIVE_INTEGRITY_CASES.length}`);
  console.log(`Metadata 用例  : 1`);
  console.log(`PreventiveReview 用例: ${PREVENTIVE_REVIEW_CASES.length}`);
  console.log(`TlaBddSync 用例: ${TLA_BDD_SYNC_CASES.length}`);
  console.log(`RoleDispatch 用例 : ${ROLE_DISPATCH_CASES.length}`);
  console.log(`StateMachine 用例 : ${STATE_MACHINE_CASES.length}`);
  console.log(`CodegraphQuery 用例 : ${CODEGRAPH_QUERY_CASES.length}`);
  console.log(`OpsxArtifact 用例 : ${OPSX_ARTIFACT_CASES.length}`);
  console.log(`OpenspecArchive 用例 : ${OPENSPEC_ARCHIVE_CASES.length}`);
  console.log(`UatPathMapping 用例 : ${UAT_PATH_MAPPING_CASES.length}`);
  console.log('─'.repeat(60));

  const [
    verifierResults, gateResults, graphResults, tlaResults,
    budgetResults, runLogResults, maturityResults, checkpointResults,
    codeTlaResults, rootcauseResults, schemaResults, bddResults,
    coverageResults, exemptionResults, signatureChainResults, archiveIntegrityResults, metadataResults,
    designContractResults, preventiveReviewResults, tlaBddSyncResults, roleDispatchResults,
    stateMachineResults,
    codegraphQueryResults, opsxArtifactResults, openspecArchiveResults,
    uatPathMappingResults,
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
    runSchemaCases(samplesDir),
    runBddCases(samplesDir),
    runCoverageCases(samplesDir),
    runExemptionCases(samplesDir),
    runSignatureChainCases(samplesDir),
    runArchiveIntegrityCases(samplesDir),
    runMetadataCheck(skillRoot),
    runDesignContractCases(samplesDir),
    runPreventiveReviewCases(samplesDir),
    runTlaBddSyncCases(samplesDir),
    runRoleDispatchCases(samplesDir),
    runStateMachineCases(samplesDir),
    runCodegraphQueryCases(samplesDir),
    runOpsxArtifactCases(samplesDir),
    runOpenspecArchiveCases(samplesDir),
    runUatPathMappingCases(samplesDir),
  ]);
  const all = [
    ...verifierResults, ...gateResults, ...graphResults, ...tlaResults,
    ...budgetResults, ...runLogResults, ...maturityResults, ...checkpointResults,
    ...codeTlaResults, ...rootcauseResults, ...schemaResults, ...bddResults,
    ...coverageResults, ...exemptionResults, ...signatureChainResults, ...archiveIntegrityResults, ...metadataResults,
    ...designContractResults, ...preventiveReviewResults, ...tlaBddSyncResults, ...roleDispatchResults,
    ...stateMachineResults,
    ...codegraphQueryResults, ...opsxArtifactResults, ...openspecArchiveResults,
    ...uatPathMappingResults,
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
