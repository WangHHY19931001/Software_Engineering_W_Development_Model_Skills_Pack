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
 *   npx tsx w-model-dev/scripts/cli/self-test.ts
 *
 * 退出码：
 *   0  所有样本的校验结果与期望一致
 *   1  至少一个样本不匹配
 *
 * 样本目录约定（samples/<area>/；子目录与 `*_CASES` 用例数组的数量以 samples/README.md 覆盖矩阵与运行输出为准）：
 *   verifier / gate / graph / tla / code-tla / bdd / coverage / exemption / budget /
 *   run-log / maturity / checkpoint / rootcause / preventive-review / iceberg /
 *   tla-bdd-sync / state-machine / design-contract / signature-chain /
 *   archive-integrity / schema / code-health / codegraph-queries /
 *   uat-path-mapping 等（tla-e2e 为需 Java 的手动 fixture，豁免）
 *
 * 注意：self-test 是纯逻辑回归基线，**不依赖 Java/jar**。TLA+ 的 SANY/TLC 端到端测试
 *   在 samples/tla-e2e/ 下提供 fixture，需 Java 才能跑（见该目录 README）。
 *
 * 新增校验项后，请同时：
 *   1. 增加能触发该校验项的样本（通过 / 失败各一条）
 *   2. 在 SAMPLES 表中声明期望结果
 */

import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import type * as TsType from 'typescript';

import { checkVerifierOutput } from '../logic/verifier-logic.js';
import { verifyReviewedArtifacts } from '../lib/reviewed-artifacts.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import { checkArtifactGate, checkPhaseSpecStructure, type GateGraph } from '../logic/gate-logic.js';
import {
  checkDetailedSpecEnhance,
  checkDesignSpecEnhance,
  checkOutlineSpecEnhance,
  checkRequirementGraph,
  checkRequirementSpecEnhance,
} from '../logic/graph-logic.js';
import { checkTlaModel } from '../logic/tla-logic.js';
import { checkBudget } from '../logic/budget-logic.js';
import { checkRunLog } from '../logic/run-log-logic.js';
import { planAppend, planCorrection, type AppendOptions, type RunLogRecord } from '../logic/run-log-append-logic.js';
import { checkMaturity } from '../logic/maturity-logic.js';
import { checkCheckpoint } from '../logic/checkpoint-logic.js';
import { checkRequirementCoverage, type CoverageCheckOptions } from '../logic/coverage-logic.js';
import { computeCoverageScope, type CoverageScopeThresholds } from '../logic/coverage-scope-logic.js';
import { checkExemption } from '../logic/exemption-logic.js';
import { checkSignatureChain } from '../logic/signature-chain-logic.js';
import { checkArchiveIntegrity, type ArchiveIntegrityManifest } from '../logic/archive-integrity-logic.js';
import { checkDesignContractConsistency, type DesignContractCheckInput } from '../logic/design-contract-logic.js';
import {
  checkCodeTlaConsistency,
  extractCodeStateTransfers,
  type CodeTlaConsistencyInput,
  type CodeFile,
} from '../logic/code-tla-logic.js';
import { checkRootCauseReport } from '../logic/root-cause-logic.js';
import {
  checkBddModel,
  parseFeatureFile,
  type BddManifest,
  type BddCheckInput,
  type TlaSpecSnapshot,
} from '../logic/bdd-logic.js';
import { checkPreventiveReview, type PreventiveReview } from '../logic/preventive-review-logic.js';
import { checkIcebergSweep, type IcebergSweepReport, type IcebergView } from '../logic/iceberg-sweep-logic.js';
import { checkTlaBddSync } from '../logic/tla-bdd-sync-logic.js';
import { checkRoleDispatch } from '../logic/role-dispatch-logic.js';
import { checkStateMachineConsistency } from '../logic/state-machine-logic.js';
import {
  buildStaticInventory,
  checkFalsePositiveGuards,
  classifyScenario,
  mergeDynamicTrace,
  type Phase1Scenario,
} from '../logic/code-health-phase1-logic.js';
import type {
  AbstractionProposal,
  ApprovalDecision,
  CodeHealthCandidate,
  CodeHealthLedger,
  CommandEvidence,
  DuplicateCluster,
  DuplicateInput,
  FalsePositiveContext,
  GapDiscoveryInput,
  GapRow,
  Phase1CandidateLead,
  RevisionIdentity,
  RollbackPlan,
} from '../logic/code-health-contract.js';
import { findGaps } from '../logic/code-health-gap-logic.js';
import {
  clusterDuplicates,
  proveAbstraction,
  type DuplicateClusterAuthority,
} from '../logic/code-health-duplicate-logic.js';
import { evaluateTestInventory } from '../logic/code-health-test-logic.js';
import {
  applyApproved,
  executeRollback,
  validateGapMatrix,
  validateRedGreenEvidence,
} from '../logic/code-health-ledger-logic.js';
import { checkCodingPlan } from '../logic/coding-plan-logic.js';
import { nodeCodingPlanFs } from '../lib/coding-plan-fs.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { runSync } from '../lib/run-sync.js';

import { checkCodegraphQueries } from './check-codegraph-queries.js';
// 预算疑似重复归账样本（N-6/G3-7/G3-15）：复用 check-budget.ts 导出的分组计数函数，
// 使样本口径与 CLI 诊断单点一致（该文件尾部有 isDirectInvocation 入口守卫，import 不触发 main）
import { countSuspectedDuplicateGroups } from './check-budget.js';
// R5 真值通道样本（D-7）：复用 check-maturity.ts 导出的计数/词法收集/诊断组装三函数，
// 使 self-test 的样本口径与 CLI 接线单点一致（该文件尾部有 isDirectInvocation 入口守卫，import 不触发 main）
import { buildR5Diagnostics, collectLexicalMentions, countOperationalFailures } from './check-maturity.js';
import { checkUatPathMappingContent } from './check-artifact-gate.js';
// checkpoint-log loader 样本（C14/D3）：复用 check-checkpoint.ts 导出的目录加载器，
// 使 canonical 形态 / 歧义 fail-closed 的样本口径与 CLI 接线单点一致
// （该文件尾部有 isDirectInvocation 入口守卫，import 不触发 main）
import { loadCheckpointLog } from './check-checkpoint.js';

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
  /** SD→codeModule 映射校验（phase >= 5 + graph 存在时触发 checkSdToCodeModuleMapping） */
  graph?: GateGraph;
  /**
   * 配套产物文件（相对 samples/gate/），仅供 check-samples-coverage 引用登记（未被引用即在盘悬空 → exit 1）；
   * 不作为门禁运行输入。当前用于 M07 E2 的原始测试输出产物 test-evidence-output.txt。
   */
  auxFiles?: string[];
  /**
   * S18 票据内容 fixture（相对 samples/gate/，`.md`）。runGateCases 读取其文本作为
   * `checkArtifactGate({ ticketsText })` 输入；同时被 check-samples-coverage 登记为已引用
   * （`ticketsFile` 与 `file` / `auxFiles` 同为覆盖矩阵的可识别引用字段）。
   */
  ticketsFile?: string;
  /** 批次1 SDMAP-3/4：手写注入表（path→总行数）；缺省不注入 → sdAnchorCheck=skipped */
  srcLineCounts?: Record<string, number>;
  /**
   * A4（43.0.0）：配套 maturity.json（相对 samples/gate/，目录组合 fixture）。
   * 声明时 runGateCases 读取并与 signatureChainFile 一起传入 checkArtifactGate（豁免判定输入）；
   * 同时被 check-samples-coverage 登记为已引用。
   */
  maturityFile?: string;
  /** A4（43.0.0）：配套 signature-chain.jsonl（相对 samples/gate/）；缺省 → 空链（不豁免形态） */
  signatureChainFile?: string;
}

const VERIFIER_CASES: VerifierCase[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 VerifierOutput，应通过所有校验',
  },
  {
    file: 'persona-code-reviewer.json',
    expectedPassed: true,
    description: 'code-reviewer Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-test-engineer.json',
    expectedPassed: true,
    description: 'test-engineer Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-security-auditor.json',
    expectedPassed: true,
    description: 'security-auditor Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-performance-auditor.json',
    expectedPassed: true,
    description: 'performance-auditor Persona 的当前 Schema 可执行样例，应通过全部校验',
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
  // -------------------- P2.4/P2.5/P3.10 verifier 标准化校验 --------------------
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
    description:
      'R13 单轴下限：completeness=0.65<0.70 加权平均达 A 级（0.86）但单轴失败，应 passed=false（反模式 #41）',
  },
  // -------------------- D-10：V 产物形态负样本 --------------------
  {
    file: 'bad-arithmetic-sequence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/完美等差.*公差 0\.01/, /真实离散/],
    description:
      'D-10① text-parse 下 completeness rawScores [0.97,0.96,0.98] 为 0.01 完美等差，文案须含真实离散改进指引',
  },
  {
    file: 'bad-resolution-floor.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R18.*completeness.*分布坍缩/],
    description:
      'D-10③ completeness rawScores [0.9001,0.9002,0.9] 非全等但方差 6.67e-9 < 1e-6，应被 R18 分辨力下限拦截',
  },
  {
    file: 'bad-evidence-double-l.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence 格式不符.*双 L 非法/, /L51-L53=/],
    description:
      'D-10② evidence 逐条为双 L 区间形态（path:L51-L53=…），须报「格式不符（须 path:Lnn=stmt 或 path:§sec=stmt；行号区间合法写法 path:L51-53=stmt，双 L 非法）」而非「空泛声明，O3 命中」',
  },
  // -------------------- rootcause targetKind（§7.5） --------------------
  {
    file: 'valid-rootcause.json',
    expectedPassed: true,
    description: 'targetKind=rootcause 合法 VerifierOutput（§7.5 子标准集合 + 权重），应通过全部校验',
  },
  {
    file: 'valid-windows-evidence.json',
    expectedPassed: true,
    description:
      'C11 Windows 路径 evidence 正例（反斜杠 src\\mod\\a.ts:L3= + 盘符前缀 D:\\proj\\rootcause.json:L1-5=，子标准集合同 valid-rootcause），应通过 evidence 格式与 R12 校验',
  },
  {
    file: 'bad-rootcause-subcriteria.json',
    expectedPassed: false,
    expectedReasonPatterns: [/subCriteria.*name 应为/],
    description: 'targetKind=rootcause 但误用 test 集合子标准，应被 §7.5 子标准集合校验拦截',
  },
  // -------------------- A2 R19：reviewedArtifacts 评审对象绑定（批次 6 任务 4） --------------------
  {
    file: 'bad-r19-evidence-not-registered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 evidence 引用未在 reviewedArtifacts 登记/],
    description:
      'A2 R19：分数自洽 + evidence 格式合法的 VerifierOutput 引用未登记产物路径（伪造 V 产物与 S 产物零绑定穿透面），应被 R19 唯一拦截',
  },
  {
    file: 'bad-r19-artifact-hash-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 评审对象哈希不符/],
    description:
      'A2 R19：登记项 sha256 首字符被篡改（仍 64 位十六进制，logic 格式过），CLI 读盘哈希复核应唯一拦截（产物已变，旧评审不成立）',
  },
  {
    file: 'bad-r19-line-out-of-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 evidence 行号越界/],
    description:
      'A2 R19：evidence 引用已登记产物但行号 99999 越界（行数表由 lib/reviewed-artifacts 读盘注入 VerifierDeps），应被 R19 唯一拦截',
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
  // -------------------- P1.1 阶段级校验 --------------------
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
    expectedReasonPatterns: [/系统测试: 8 个待执行/, /验收测试: 6 个待执行/],
    description: 'P1.1 未传 phaseOption 默认 phase=8（向后兼容，valid-phase6 应因 pending 失败）',
  },
  // -------------------- §10J RTM 增量校验修正 --------------------
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
  // -------------------- A4 maturity 豁免收紧（43.0.0，批次 6 任务 8） --------------------
  {
    file: 'valid-maturity-waiver-with-approval/rtm.json',
    expectedPassed: true,
    phaseOption: 1,
    maturityFile: 'valid-maturity-waiver-with-approval/maturity.json',
    signatureChainFile: 'valid-maturity-waiver-with-approval/signature-chain.jsonl',
    auxFiles: [
      'valid-maturity-waiver-with-approval/maturity.json',
      'valid-maturity-waiver-with-approval/signature-chain.jsonl',
    ],
    description:
      'A4 L1 + 合法 human 审批链（role=human / targetKind=maturity / v3 重算一致 / 绑定 maturity.json / 不早于末次变更）→ TLA+/BDD 豁免生效（tlaBddWaived=true），其余门禁照跑全绿',
  },
  {
    file: 'bad-maturity-waiver-missing-approval/rtm.json',
    expectedPassed: false,
    phaseOption: 1,
    maturityFile: 'bad-maturity-waiver-missing-approval/maturity.json',
    signatureChainFile: 'bad-maturity-waiver-missing-approval/signature-chain.jsonl',
    auxFiles: [
      'bad-maturity-waiver-missing-approval/maturity.json',
      'bad-maturity-waiver-missing-approval/signature-chain.jsonl',
    ],
    expectedReasonPatterns: [/maturity 豁免被拒绝：缺少 role=human \/ targetKind=maturity 的审批条目/],
    description:
      'A4 L1 审批条目缺 human role（role=S 伪装、v3 签名合法）→ 豁免被拒绝（fail-closed）， maturity.level 自写不再关门禁',
  },
  // -------------------- P0 RTM coverageStatus 校验 --------------------
  {
    file: 'bad-rtm-coverage-below-100.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100/],
    description: 'RTM coveragePercent=66% < 100%，应被覆盖率门禁拦截（约束 #3）',
  },
  {
    file: 'bad-rtm-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/coverageStatus.*不一致/],
    description: 'RTM coverageStatus="100%" 但 coveragePercent=66%，应被 coverageStatus 一致性校验拦截',
  },
  // -------------------- P2 NFR 双值校验 --------------------
  {
    file: 'bad-nfr-missing-dual-fields.json',
    expectedPassed: false,
    expectedReasonPatterns: [/NFR 行 NFR-001 缺 targetValue 与 testThreshold/],
    description: 'NFR-001 行缺 targetValue + testThreshold 双字段，应被 NFR 双值校验拦截',
  },
  // -------------------- G-B SD 数字层级映射 --------------------
  {
    file: 'valid-sd-numeric-levels.json',
    expectedPassed: true,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] },
    description:
      'SD 数字层级 id（SD-5.2.1）经 checkSdToCodeModuleMapping 识别为数字层级，命中 codeModule 前缀映射应通过',
  },
  // -------------------- 批次1 SDMAP 负向样本（SDMAP-1/2/5 与 SDMAP-3/4 注入面） --------------------
  {
    file: 'bad-sdmap-mapping.json',
    expectedPassed: false,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-2.2', type: 'SD' }] },
    expectedReasonPatterns: [/SDMAP-1/, /SDMAP-2/, /codeModule 格式错误/],
    description: '批次1：图→RTM 缺映射 + 幽灵 SD 前缀 + 格式不符',
  },
  {
    file: 'bad-sdmap-anchor.json',
    expectedPassed: false,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-2.1', type: 'SD' }] },
    srcLineCounts: { 'src/real.ts': 3 },
    expectedReasonPatterns: [/SDMAP-3/, /SDMAP-4/],
    description: '批次1：路径不存在 + 锚点行号越界（注入面）',
  },
  // -------------------- 孤儿样本（check-samples-coverage 引用登记） --------------------
  {
    file: 'bad-phase5-codemodule-format.json',
    expectedPassed: false,
    phaseOption: 5,
    expectedReasonPatterns: [/codeModule 格式错误/],
    description: 'phase5 终检：REQ 行 codeModule 缺 SD 前缀（"src/auth/login.ts"），应被 SD→codeModule 格式校验拦截',
  },
  // -------------------- M07 测试证据（E1-E4 样本级正反夹具，D-2 批准单元） --------------------
  // 正例带 rawOutputPath + 真实 rawOutputSha256（指向同目录 test-evidence-output.txt），
  // 由 runGateCases 透传 projectRoot（samples/gate/）走通 E2 哈希核验端到端。
  {
    file: 'valid-test-evidence.json',
    expectedPassed: true,
    phaseOption: 6,
    auxFiles: ['test-evidence-output.txt'],
    description: 'M07 E2 端到端：四级全绿 + 各层 evidence，unitTest 携 rawOutput 对（真实 sha256）→ 通过',
  },
  {
    file: 'bad-test-evidence-hash-mismatch.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E2[\s\S]*SHA-256[\s\S]*不符/],
    description: 'M07 E2：声明 rawOutputSha256 与产物实际 SHA-256 不符，应被哈希核验拦截',
  },
  {
    file: 'bad-test-evidence-exitcode-mismatch.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E3[\s\S]*记录 failed=1[\s\S]*exitCode=0/],
    description: 'M07 E3 RED 绑定：failed=1 却记 exitCode=0（有失败必来自非零退出），应被结果一致性拦截',
  },
  {
    file: 'bad-test-evidence-unpaired-output.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E1[\s\S]*必须成对出现（当前只有 rawOutputPath）/],
    description: 'M07 E1 配对：只有 rawOutputPath 缺 rawOutputSha256，应被配对校验拦截',
  },
  {
    file: 'bad-test-evidence-missing.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E4[\s\S]*单元测试[\s\S]*缺 evidence/],
    description: 'M07 E4：lastUpdated 缺失（保守按 cutoff 后）且单元测试层 total>0 无 evidence，应被存在性校验拦截',
  },
  {
    file: 'valid-test-evidence-legacy.json',
    expectedPassed: true,
    phaseOption: 6,
    description: 'M07 E4 legacy 吸收：lastUpdated 早于 cutoff 且阶段内层无 evidence → 非阻断通过（legacy 标注）',
  },
  {
    file: 'valid-rtm.json',
    ticketsFile: 'tickets-valid.md',
    expectedPassed: true,
    description:
      'S18 正例：票据含符号级契约（接口签名 / 状态转移）与验收标准、零占位符 → --tickets 不引入任何阻断（tickets 计数全 0）',
  },
  {
    file: 'valid-rtm.json',
    ticketsFile: 'tickets-bad-content.md',
    expectedPassed: false,
    expectedReasonPatterns: [
      /票据内容校验失败：票据 01「待补登录」placeholder "TODO"/,
      /票据 01「待补登录」vague-imperative/,
      /票据 01「待补登录」test-without-signature/,
      /票据 01「待补登录」undefined-symbol `AuditLogWriter\.write`/,
      /票据 02「与任务 01 类似」similar-to-task/,
      /票据 02「与任务 01 类似」Buildability：只给路径/,
    ],
    description:
      'S18 反例：占位短语 TODO / 无具体动作祈使 / 要求写测试无符号 / 类似任务 N / 引用未定义符号 / 只给路径不给符号 → 逐条被黑名单与 Buildability 拦截',
  },
];

interface GraphCase {
  file: string;
  phase: number;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  expectedWarningPatterns?: RegExp[];
  description: string;
  /**
   * 注入 R15c 所需的 existingAnchorPaths（以技能包真实仓库根解析锚点 path）。
   * 仅锚点存在性反例需要——其余用例保持无注入（纯逻辑层语义），
   * 避免所有既有 fixture 因路径解析差异被误伤。
   */
  injectAnchorPaths?: boolean;
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
    file: 'bad-round-exceeded.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/轮次上限校验失败.*round > 5.*phase1\/round6/],
    description: 'analysisRounds 含 round=6 > MAX_GRAPH_ROUNDS(5)，应被轮次上限校验拦截（防无限返工循环）',
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
  // -------------------- 四维识别·维度1/3：phase=1 纯 REQ 图样本 --------------------
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
  {
    file: 'valid-warnings.json',
    phase: 1,
    expectedPassed: true,
    expectedWarningPatterns: [/边数下限警告/],
    description: '4 REQ 节点 3 parent 边（边数 < 节点×3），应通过但触发边数下限警告',
  },
  {
    file: 'valid-evidence-anchor.json',
    phase: 1,
    expectedPassed: true,
    description: 'REQ 节点带合法 evidenceAnchor（path:§section=statement），应通过 R15',
  },
  {
    file: 'bad-evidence-anchor.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R15 evidenceAnchor 格式校验失败/],
    description: 'REQ 节点 evidenceAnchor 无定位（"登录需要密码"），应被 R15 拦截',
  },
  {
    file: 'bad-evidence-anchor-missing.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R15a evidenceAnchor 缺失/],
    description: 'R15a：节点缺 evidenceAnchor（必填），应被锚点必填校验拦截（不再"未声明不阻断"）',
  },
  {
    file: 'bad-evidence-status-invalid.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R15b evidenceStatus 非法/],
    description: 'R15b：evidenceStatus="maybe" 非 confirmed|pending，应被状态枚举校验拦截',
  },
  {
    file: 'bad-evidence-path-missing.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/R15c 证据路径不存在/],
    injectAnchorPaths: true,
    description: 'R15c：evidenceAnchor 指向不存在的路径 nonexistent/does-not-exist.md，应被存在性校验拦截',
  },
  // -------------------- 阶段 2-4 图谱正例（F-5 / G4-4）--------------------
  // 补齐阶段 2/3/4 的**正例**形态：既有样本只有阶段 1 正例 + 阶段 2/3/4 各一条负例，
  // 阶段 2-4 的合法图在反向（门禁过严误红）方向没有回归基线。三份样本按各阶段结构
  // 与规模下限构造（边数 ≥ 节点数 × 3、语义来源占比 100%），实测零 violations 零 warnings。
  {
    file: 'valid-phase2.json',
    phase: 2,
    expectedPassed: true,
    description:
      '[p2] 阶段 2 正例：唯一 REQ 根 + SD 全覆盖 implements 追溯 + EXT-IN/EXT-OUT 边界 + 信息流闭合（死模块清零），8 节点 / 25 边，应通过连通/单根/父唯一/层级单调/追溯/信息流全部判据',
  },
  {
    file: 'valid-phase3.json',
    phase: 3,
    expectedPassed: true,
    description:
      '[p3] 阶段 3 正例：接口层 INTF 全覆盖 defines 入边（SD→INTF）+ parent 层级 REQ→SD→INTF 相邻层单调 + 边界与信息流闭合，10 节点 / 33 边，应通过阶段 3 全部判据',
  },
  {
    file: 'valid-phase4.json',
    phase: 4,
    expectedPassed: true,
    description:
      '[p4] 阶段 4 正例：详细设计层 DD 全覆盖 realizes 出边（DD→INTF）+ 四层 parent 追溯（REQ→SD→INTF→DD）+ 边界与信息流闭合，11 节点 / 36 边，应通过阶段 4 零违反（放行进编码的前置）',
  },
];

// ==================== R7/R8 需求规格产物校验 ====================
// 样本为 markdown 纯文本字段（traceabilityMatrix/specContent/umlModeling），
// 由 runSpecEnhanceCases 读取并喂给 checkRequirementSpecEnhance（纯函数）。

interface SpecEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const SPEC_ENHANCE_CASES: SpecEnhanceCase[] = [
  {
    file: 'valid-spec-enhance.json',
    expectedPassed: true,
    description: 'R7/R8 通过：追踪矩阵字段合法 + mermaid 配平',
  },
  {
    file: 'bad-spec-r7.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R7 需求号格式失败/, /R7 候选落点§ 引用失败/, /R7 验收关联失败/],
    description: 'R7 失败：候选落点§ 非法 + 验收关联缺 UAT/§',
  },
  {
    file: 'bad-spec-r8.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R8 UML mermaid 块配平失败/],
    description: 'R8 失败：mermaid 块未配平',
  },
  {
    file: 'bad-spec-missing-section4.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R7 追踪矩阵一致性失败：主规格缺 §4 层级树节/],
    description: 'R7 失败：主规格缺 §4 层级树节',
  },
];

// ==================== Phase 1 需求规格结构校验 ====================
// 样本字段（specContent/refFiles/dodContent）由 runSpecStructureCases
// 用内存 fs stub 喂给 checkPhaseSpecStructure(1, ...)（注入式 fs；phase=1 不需要 readdirSync）。

interface SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const SPEC_STRUCTURE_CASES: SpecStructureCase[] = [
  {
    file: 'valid-requirement-spec-structure.json',
    expectedPassed: true,
    description: '结构校验通过：7 引用块 + SSOT 头 + DoD 9 项',
  },
  {
    file: 'bad-refs-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/引用文件不存在 uml-modeling.md/],
    description: '结构校验失败：引用文件缺失',
  },
  {
    file: 'bad-ssot-header.json',
    expectedPassed: false,
    expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/],
    description: '结构校验失败：SSOT 头缺声明',
  },
  {
    file: 'bad-dod-incomplete.json',
    expectedPassed: false,
    expectedReasonPatterns: [/DoD 清单仅 5 项/],
    description: '结构校验失败：DoD 清单 < 8',
  },
];

// ==================== Phase 1 §8 拒绝登记结构校验（M08） ====================
// **内联用例（零新增 fixture 文件）**：只改 §8 段，其余 7 引用块 + §0 SSOT 头四项 +
// DoD 9 项由 runner 统一补齐 —— 因此 expectedBucketCounts 里 refs/ssot/dod 恒为 0
// 就等价于断言「新校验不误伤其他桶」（恰好报该违规）。
//
// 边界：门禁**只校验登记结构**（节 / 表格 / 列 / 键唯一 / 状态枚举 / 回链非空）。
// 「概念相似度」由阶段 1 入口读取动作以语义匹配承担，确定性脚本不校验语义。

/** §8 之前的主规格前缀（7 引用块 + §0 SSOT 头四项），所有内联用例共用。 */
const OOS_SPEC_PREFIX =
  '> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n' +
  '> 系统上下文详见 [x](./system-context.md)\n' +
  '> 术语表详见 [x](./glossary.md)\n' +
  '> 需求追踪矩阵详见 [x](./traceability-matrix.md)\n' +
  '> 行为规格模型详见 [x](./behavior-spec.md)\n' +
  '> Phase 1 工程纪律与 DoD 详见 [x](./discipline-dod.md)\n' +
  '> UML 需求建模详见 [x](./uml-modeling.md)\n' +
  '> 研制要求详见 [x](./development-requirements.md)\n';

const OOS_TABLE_HEADER = '| conceptKey | 拒绝理由 | Prior requests | 状态 | 来源 |\n| --- | --- | --- | --- | --- |';

interface SpecStructureOutOfScopeCase {
  name: string;
  /** 只提供 §8 段正文；`undefined` = 故意整节缺失（判定 (a)）。 */
  section?: string;
  expectedBucketCounts: {
    refs: number;
    ssot: number;
    dod: number;
    outOfScope: number;
  };
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const SPEC_STRUCTURE_OUT_OF_SCOPE_CASES: SpecStructureOutOfScopeCase[] = [
  {
    name: 'spec-structure/oos-valid-register',
    section:
      `${OOS_TABLE_HEADER}\n` +
      '| dark-mode | 主题切换与既有品牌规范冲突 | REQ-101, REQ-205 | rejected | 阶段1 |\n' +
      '| offline-queue | 离线队列超出本期部署边界（→ REQ-118） | - | reconsidered | 阶段1 |\n',
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 0 },
    description: '§8 合规表格：五列齐全 + rejected/reconsidered 两态 + 显式 `-` 回链 → 无违规',
  },
  {
    name: 'spec-structure/oos-sentinel-only',
    section: `${OOS_TABLE_HEADER}\n| - | 本阶段无排除项（显式「无」） | - | - | - |\n`,
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 0 },
    description: '§8 仅含 `conceptKey = -` 哨兵行（模板的「无」形态）→ 豁免状态枚举与 Prior requests 校验，无违规',
  },
  {
    name: 'spec-structure/oos-section-missing',
    section: undefined,
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 Out of Scope 节缺失/],
    description: '判定 (a)：§8 节缺失（「无」也须显式声明）',
  },
  {
    name: 'spec-structure/oos-legacy-prose',
    section: '- {{out-of-scope 项}}\n- {{Brownfield 不动的历史模块}}\n',
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 无固定列表格/],
    description: '判定 (b)：§8 为旧模板散文形态（含 `- {{`）且无表格 → 迁移指引',
  },
  {
    name: 'spec-structure/oos-header-missing-column',
    section:
      '| conceptKey | 拒绝理由 | Prior requests | 来源 |\n| --- | --- | --- | --- |\n' +
      '| dark-mode | 主题切换与既有品牌规范冲突 | REQ-101 | 阶段1 |\n',
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 表格表头缺列：状态/],
    description: '判定 (c)：表头缺列（缺「状态」）；缺失列不叠加派生违规 → 恰好 1 条',
  },
  {
    name: 'spec-structure/oos-duplicate-concept-key',
    section:
      `${OOS_TABLE_HEADER}\n` +
      '| dark-mode | 主题切换与既有品牌规范冲突 | REQ-101 | rejected | 阶段1 |\n' +
      '| dark-mode | 换个说法的同一概念 | REQ-205 | rejected | 阶段2 |\n',
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 表格 conceptKey 重复：dark-mode/],
    description: '判定 (c)：conceptKey 重复（须一概念一行）',
  },
  {
    name: 'spec-structure/oos-status-invalid',
    section: `${OOS_TABLE_HEADER}\n| dark-mode | 主题切换与既有品牌规范冲突 | REQ-101 | 已完成 | 阶段1 |\n`,
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 表格第 1 行状态非法："已完成"/],
    description: '判定 (c)：状态 ∉ {rejected, reconsidered}',
  },
  {
    name: 'spec-structure/oos-prior-requests-blank',
    section: `${OOS_TABLE_HEADER}\n| dark-mode | 主题切换与既有品牌规范冲突 |  | rejected | 阶段1 |\n`,
    expectedBucketCounts: { refs: 0, ssot: 0, dod: 0, outOfScope: 1 },
    expectedReasonPatterns: [/§8 表格第 1 行 Prior requests 为空/],
    description: '判定 (c)：Prior requests 留白（须为回链列表或显式 `-`）',
  },
];

// ==================== Phase 2 系统设计增强 ====================

interface DesignEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const DESIGN_ENHANCE_CASES: DesignEnhanceCase[] = [
  {
    file: 'valid-design-enhance.json',
    expectedPassed: true,
    description: 'R9/R10 通过：SD 字段合法 + mermaid 配平',
  },
  {
    file: 'bad-design-r9.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R9 SD 编号格式失败/, /R9 设计落点§ 引用失败/],
    description: 'R9 失败：SD 编号非法 + 落点§ 非模块 ID',
  },
  {
    file: 'bad-design-r10.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R10 UML mermaid 块配平失败/],
    description: 'R10 失败：mermaid 块未配平',
  },
  {
    file: 'bad-design-missing-section3.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R9 追踪矩阵一致性失败：主文档缺 §3 模块划分节/],
    description: 'R9 失败：主文档缺 §3 模块划分节',
  },
];

interface Phase2SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const PHASE2_SPEC_STRUCTURE_CASES: Phase2SpecStructureCase[] = [
  {
    file: 'valid-phase2-spec-structure.json',
    expectedPassed: true,
    description: 'Phase 2 结构校验通过：6 引用块 + SSOT 头 + DoD 9 项',
  },
  {
    file: 'bad-phase2-refs-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/引用文件不存在 blog-system-uml-modeling.md/],
    description: 'Phase 2 结构校验失败：引用文件缺失',
  },
  {
    file: 'bad-phase2-ssot-header.json',
    expectedPassed: false,
    expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/],
    description: 'Phase 2 结构校验失败：SSOT 头缺声明',
  },
  {
    file: 'bad-phase2-dod-incomplete.json',
    expectedPassed: false,
    expectedReasonPatterns: [/DoD 清单仅 5 项/],
    description: 'Phase 2 结构校验失败：DoD 清单 < 8',
  },
];

// ==================== Phase 3 概要设计增强 ====================

interface OutlineEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const OUTLINE_ENHANCE_CASES: OutlineEnhanceCase[] = [
  {
    file: 'valid-outline-enhance.json',
    expectedPassed: true,
    description: 'R11/R12 通过：INTF 字段合法 + mermaid 配平',
  },
  {
    file: 'bad-outline-r11.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R11 INTF 编号格式失败/, /R11 设计落点§ 引用失败/],
    description: 'R11 失败：INTF 编号非法 + 落点§ 非法',
  },
  {
    file: 'bad-outline-r12.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R12 UML mermaid 块配平失败/],
    description: 'R12 失败：mermaid 块未配平',
  },
  {
    file: 'bad-outline-missing-section2.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R11 追踪矩阵一致性失败：主文档缺 §2 接口定义节/],
    description: 'R11 失败：主文档缺 §2 接口定义节',
  },
];

interface Phase3SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const PHASE3_SPEC_STRUCTURE_CASES: Phase3SpecStructureCase[] = [
  {
    file: 'valid-phase3-spec-structure.json',
    expectedPassed: true,
    description: 'Phase 3 结构校验通过：6 引用块 + SSOT 头 + DoD 8 项',
  },
  {
    file: 'bad-phase3-refs-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/引用文件不存在 blog-system-uml-modeling.md/],
    description: 'Phase 3 结构校验失败：引用文件缺失',
  },
  {
    file: 'bad-phase3-ssot-header.json',
    expectedPassed: false,
    expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/],
    description: 'Phase 3 结构校验失败：SSOT 头缺声明',
  },
  {
    file: 'bad-phase3-dod-incomplete.json',
    expectedPassed: false,
    expectedReasonPatterns: [/DoD 清单仅 5 项/],
    description: 'Phase 3 结构校验失败：DoD 清单 < 8',
  },
];

// ==================== Phase 4 详细设计增强 ====================

interface DetailedEnhanceCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const DETAILED_ENHANCE_CASES: DetailedEnhanceCase[] = [
  {
    file: 'valid-detailed-enhance.json',
    expectedPassed: true,
    description: 'R13/R14 通过：DD 字段合法 + class/data mermaid 配平',
  },
  {
    file: 'bad-detailed-r13.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R13 DD 编号格式失败/, /R13 设计落点§ 引用失败/],
    description: 'R13 失败：DD 编号非法 + 落点§ 非法',
  },
  {
    file: 'bad-detailed-r14.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R14 UML mermaid 块配平失败/],
    description: 'R14 失败：mermaid 块未配平',
  },
  {
    file: 'bad-detailed-missing-section1.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R13 追踪矩阵一致性失败：主文档缺 §1 类设计节/],
    description: 'R13 失败：主文档缺 §1 类设计节',
  },
];

interface Phase4SpecStructureCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const PHASE4_SPEC_STRUCTURE_CASES: Phase4SpecStructureCase[] = [
  {
    file: 'valid-phase4-spec-structure.json',
    expectedPassed: true,
    description: 'Phase 4 结构校验通过：6 引用块 + SSOT 头 + DoD 8 项',
  },
  {
    file: 'bad-phase4-refs-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/引用文件不存在 blog-system-class-design.md/],
    description: 'Phase 4 结构校验失败：引用文件缺失',
  },
  {
    file: 'bad-phase4-ssot-header.json',
    expectedPassed: false,
    expectedReasonPatterns: [/§0 SSOT 头缺「自身校验」/],
    description: 'Phase 4 结构校验失败：SSOT 头缺声明',
  },
  {
    file: 'bad-phase4-dod-incomplete.json',
    expectedPassed: false,
    expectedReasonPatterns: [/DoD 清单仅 5 项/],
    description: 'Phase 4 结构校验失败：DoD 清单 < 8',
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
    expectedReasonPatterns: [
      /声明 sibling="tla\/L2-article\.tla".*tla\/L2-article\.tla\.siblings 未包含 tla\/L2-auth\.tla/,
    ],
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
    expectedReasonPatterns: [/\[schema\].*checkRounds\/0.*additionalProperties/],
    description:
      'checkRounds 元素含 phaseSummary 字段（phase 级摘要），应被 schema additionalProperties:false 前置拦截（F-G4-13 收紧；此前由 R13 拦截）',
  },
  // -------------------- 孤儿样本（check-samples-coverage 引用登记） --------------------
  {
    file: 'bad-coverage-uncovered-sd.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/SD 节点未被任何 TLA\+ spec 覆盖/],
    description: '部分 SD 节点（SD-002/SD-003）未被任何 TLA+ spec 覆盖，应被覆盖完整性校验拦截',
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
    expectedReasonPatterns: [/预算未随项目演进复核/],
    options: {
      projectUpdatedAt: '2026-07-23T18:00:00Z',
      budgetCreatedAt: '2026-07-01T00:00:00Z',
    },
    description: 'updatedAt 早于 project.updatedAt（预算未随项目演进复核），应被 R1 时效性（43.0.0 A5 顺序化）校验拦截',
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
    description: '3 阶段各含 chunk/cross/gate/checkpoint + 每阶段闭环五脚本，append-only 且 checkpoint tokens>0',
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
    file: 'bad-ordering.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R8.*轨迹顺序倒置.*V\(review\).*S/],
    description: 'V(review) 先于 S(produce) 出现（评审在产出前），应被 R8-4 轨迹顺序链校验拦截',
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
  // ---- E5: R1 阶段 5-8 分档（produce/review 替代 chunk/cross） ----
  {
    file: 'phase5-valid.jsonl',
    expectedPassed: true,
    description: '阶段 5 含 produce/review/gate/checkpoint，R1 分档通过（不要求 chunk/cross）',
  },
  {
    file: 'phase5-missing-produce.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R1.*缺 produce/],
    description: '阶段 5 缺 produce 动作，应被 R1 阶段分档校验拦截',
  },
  // ---- E7: gateLogPath 存在但 gateExitCode 未回填 ----
  {
    file: 'bad-gateExitCode-null.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R6.*gateLogPath.*gateExitCode/],
    description: 'gate 条目 gateLogPath 已设但 gateExitCode 为 null，应被 R6 拦截',
  },
  // ---- A-3d: 跨轮次评审标准漂移 ----
  {
    file: 'bad-review-level-drift.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R9 跨轮次评审不一致/, /article-service\.ts[\s\S]*2 档/, /CHECKPOINT/],
    description:
      '同一产物两次 review qualityLevel 为 A→C（跨 2 档）→ R9 标准偏移，走高成熟度 CHECKPOINT 交人裁定（不走 R）',
  },
  // ---- E8: rootcause 之后中间夹普通 review 不误报 ----
  {
    file: 'rootcause-intermediate-review.jsonl',
    expectedPassed: true,
    description: 'rootcause→普通review→review(targetKind=rootcause)→fix，R7 按 targetKind 定位不误报',
  },
  // ---- E9: 1 fix 可覆盖多份 R 报告（去重映射） ----
  {
    file: 'rootcause-multi-fix.jsonl',
    expectedPassed: true,
    description: '1 fix（basedOnReport="RC-1; RC-2"）覆盖 2 份 R 报告，去重映射应通过',
  },
  {
    file: 'rootcause-multi-uncovered.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R3.*rootcause.*RC-phase5-1-02.*无对应 fix/],
    description: '2 份 R 报告但仅 1 份有 fix，RC-phase5-1-02 未覆盖应被 R3 拦截',
  },
  // ---- audit-fixes task 4（I-6）: review 族 passed=false 强制非空 reworkHints ----
  {
    file: 'review-false-no-hints-post-cutoff.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/\[rework-hints\].*passed=false.*reworkHints/],
    description:
      'review passed=false 无 reworkHints，应被 [rework-hints] 规则拦截（历史 cutoff 吸收路径已删除：任意时间戳一律 blocking）',
  },
  // ---- P2-B（S27 / AC-8）: R10 revertEvidence 回滚证伪协议 ----
  {
    file: 'bad-fix-missing-revert-evidence.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R10.*revertEvidence/],
    description: 'fix 缺 revertEvidence，应被 R10 拦截（严格模式：无时间戳豁免，与 timestamp 早晚无关）',
  },
  // ---- J1: R11 闭环五脚本机器核验（约束 #11；触发域=checkpoint 放行） ----
  {
    file: 'bad-r11-missing-closure.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R11.*check-maturity\.ts/],
    description: 'R11：阶段 1 缺 check-maturity.ts 闭环记录应被拦截（约束 #11 机器核验）',
  },
  {
    file: 'bad-r11-late-closure.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/R11.*check-budget\.ts/],
    description: 'R11：闭环脚本记录晚于 checkpoint 放行应被拦截（无时间戳豁免）',
  },
];

// -------------------- Budget 疑似重复归账（N-6/G3-7/G3-15：run-log 样本 → countSuspectedDuplicateGroups） --------------------

interface BudgetRunLogCase {
  /** 样本文件名（相对 samples/run-log/，JSONL 格式） */
  file: string;
  /** 期望 check-budget 的疑似重复归账组数（同 (parentDispatchId, timestamp, tokens, duration_s) 出现 >1 次的键数） */
  expectedGroups: number;
  /** 用例说明 */
  description: string;
}

/**
 * 预算疑似重复归账样本（G3-7 键守卫 + G3-15 parentDispatchId 归账精确化）：
 * 只登记「check-budget `countSuspectedDuplicateGroups` 的分组计数」口径，不参与 RUN_LOG_CASES（check-run-log 的
 * R1/R7/R8 等）校验——两条样本是归账形态 fixture，不是完整阶段 run-log。样本须为合法 run-log 单行记录
 * （逐条经 run-log.schema.json 校验，见 runBudgetRunLogCases）。
 */
const BUDGET_RUN_LOG_CASES: BudgetRunLogCase[] = [
  {
    file: 'valid-parent-dispatch.jsonl',
    expectedGroups: 0,
    description:
      '主条目 + 2 条带同 parentDispatchId 的 R3 归账（按维度拆分实际 tokens）→ 疑似重复归账 0 组（G3-15：同 parent 的两条键互异，不互计）',
  },
  {
    file: 'bad-duplicate-groups.jsonl',
    expectedGroups: 1,
    description:
      '同 timestamp/tokens/duration_s 三条且无 parentDispatchId → 疑似重复归账 1 组（组数 ≠ 条数；诊断非阻断，Σtokens 上界口径不变）',
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
  /** 传给 checkMaturity 的 options（可选，默认不传；43.0.0 A4：completedPhases 已随 R3 退役删除） */
  options?: { projectCreatedAt?: string; operationalFailureCount?: number };
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
    file: 'bad-r6-history-chain.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R6: history\[1\] from=L0 与上一条 to=L1 断链/],
    description:
      'A4 R6 history 链一致性：第 2 条 from=L0 与上一条 to=L1 断链（虚高路径：L0 直接跳 L2），应触发 R6 违规（原 bad-r3-cycle-mismatch.json 的 R3 周期用例随 unlockConditions 死字段退役，43.0.0 A4）',
  },
];

// -------------------- Maturity run-log（R5 真值通道，D-7） --------------------

interface MaturityRunLogCase {
  /** 样本文件名（相对 samples/run-log/，JSONL 格式） */
  file: string;
  /** 期望 check-maturity R5 判定是否通过 */
  expectedPassed: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedViolationPatterns?: RegExp[];
  /** 期望非阻断诊断中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedDiagnosticPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

/**
 * R5 真值通道样本（D-7）：喂给 check-maturity 的 `--run-log` 输入（基准成熟度模型取
 * `samples/maturity/valid.json`，其 downgradeTriggers.operationalFailureStreak=3）。
 * 计数与诊断经 check-maturity.ts 导出的三函数（与 CLI 接线单点一致）；CLI 三态的真实子进程
 * 端到端另有 `__tests__/maturity-logic.test.ts` 覆盖。
 * 注意：本数组只登记 R5 判定口径，不参与 RUN_LOG_CASES（check-run-log 的 R1/R7/R8 等）校验。
 */
const MATURITY_RUN_LOG_CASES: MaturityRunLogCase[] = [
  {
    file: 'valid-o3-mention-only.jsonl',
    expectedPassed: true,
    expectedDiagnosticPatterns: [
      /疑似引用 3 处（含规则编号引用，非运维失败）/,
      /operationalFailureModes 标注：p1-G-verifier-16, p3-G-verifier-03/,
    ],
    description: 'note 中 O3/O4 字样共 3 处全为规则编号引用 → R5 不违规（exit 0）+ 非阻断引用诊断',
  },
  {
    file: 'bad-operational-modes-3x.jsonl',
    expectedPassed: false,
    expectedViolationPatterns: [/R5: O 系列失败模式命中 3 次/],
    expectedDiagnosticPatterns: [
      /疑似引用 1 处（含规则编号引用，非运维失败）/,
      /operationalFailureModes 标注：p5-G-maturity-01/,
    ],
    description:
      'operationalFailureModes 字段标注 3 次（真值通道）≥ streak=3 → R5 违规；note 词法仅 1 处引用，证明判据取自字段而非词法（诊断并存且不阻断）',
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

// -------------------- Checkpoint-log loader（C14/D3 canonical 形态） --------------------

interface CheckpointLogLoaderCase {
  /** 样本目录（相对 samples/，目录内为 checkpoint-log 用户确认文件） */
  sampleDir: string;
  /** 期望 loader 结果 kind（loaded / no-phase-match / dir-unreadable / ambiguous） */
  expectedKind: 'loaded' | 'no-phase-match' | 'dir-unreadable' | 'ambiguous';
  /** expectedKind=loaded：期望这些 phase key 的确认原文非空 */
  expectedPhases?: string[];
  /** expectedKind=ambiguous：期望冲突文件名（basename）全部出现在歧义列表 */
  expectedConflictFiles?: string[];
  /** 用例说明 */
  description: string;
}

const CHECKPOINT_LOG_LOADER_CASES: CheckpointLogLoaderCase[] = [
  {
    sampleDir: 'checkpoint-log/valid-phase-1',
    expectedKind: 'loaded',
    expectedPhases: ['1'],
    description:
      'canonical 形态 phase-1.md（含具体技术决策确认原文 + 时间与放行对象要素）加载为 Map["1"]（D3，42.13.0 起）',
  },
  {
    sampleDir: 'checkpoint-log/bad-ambiguous-phase-1',
    expectedKind: 'ambiguous',
    expectedConflictFiles: ['phase-1.md', 'phase-1.txt'],
    description:
      '同 phase 双候选（phase-1.md 与 phase-1.txt 并存）→ ambiguous fail-closed 列出两冲突路径，不再由 readdir 顺序择一胜出（C14）',
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
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 RootCauseReport，应通过所有校验',
  },
  {
    file: 'valid-no-root-cause.json',
    expectedPassed: true,
    description: '调查与缓解证据完整的 noRootCause 合法出口，应通过校验',
  },
  {
    file: 'bad-no-root-cause-missing-investigation.json',
    expectedPassed: false,
    expectedReasonPatterns: [/noRootCause.*investigation/],
    description: 'noRootCause 缺 investigation 调查记录，应被拒绝',
  },
  {
    file: 'bad-r1-missing-fields.json',
    expectedPassed: false,
    expectedReasonPatterns: [/rootCause/],
    description: 'R1 缺 rootCause 字段',
  },
  {
    file: 'bad-r2-chain-length.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*rootCauseChain/],
    description: 'R2 chain 仅 1 步（schema minItems:2 前置拦截）',
  },
  {
    file: 'bad-r3-falsifiability.json',
    expectedPassed: false,
    expectedReasonPatterns: [/falsifiabilityCheck.*若.*则/],
    description: 'R3 无若...则句式',
  },
  {
    file: 'bad-r4-fix-recommendation.json',
    expectedPassed: false,
    expectedReasonPatterns: [/fixRecommendation.*rationale/],
    description: 'R4 缺 rationale',
  },
  {
    file: 'bad-r4-scope-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R4.*scope/],
    description: 'R4 fixRecommendation.scope 双数组均空（缺合规 scope：allowed/forbidden 至少一侧非空）',
  },
  {
    file: 'bad-r5-prevention.json',
    expectedPassed: false,
    expectedReasonPatterns: [/prevention.*owner/],
    description: 'R5 缺 owner',
  },
  {
    file: 'bad-r6-upstream-defect.json',
    expectedPassed: false,
    expectedReasonPatterns: [/upstreamDefect.*upstreamPhase/],
    description: 'R6 present=true 缺 upstreamPhase',
  },
  {
    file: 'bad-r7-quality-level.json',
    expectedPassed: false,
    expectedReasonPatterns: [/qualityLevel.*passed.*一致/],
    description: 'R7 qualityLevel=C 但 passed=true',
  },
  {
    file: 'bad-r8-report-id.json',
    expectedPassed: false,
    expectedReasonPatterns: [/reportId.*格式/],
    description: 'R8 reportId 含下划线',
  },
  {
    file: 'bad-r9-partial-missing.json',
    expectedPassed: false,
    expectedReasonPatterns: [/partialReports.*非空/],
    description: 'R9 多角度缺 partialReports',
  },
  {
    file: 'bad-r10-reality-confidence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/reality-checker.*confidence/],
    description: 'R10 reality-checker confidence=0.3',
  },
  {
    file: 'bad-r10-no-reality-checker.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R10.*缺失 reality checker.*testing-reality-checker.*reality-checker/],
    description:
      'R10 combined 方法 partialReports 缺失 canonical testing-reality-checker（legacy reality-checker fallback）personaSlice（E16）',
  },
  {
    file: 'bad-r11-unknown-persona.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R11.*矩阵外 persona.*engineering-testability/],
    description:
      'R11 多角度 partialReports 含 33 人格库中不存在的 persona（engineering-testability），应被矩阵内校验拦截',
  },
  {
    file: 'bad-r11-category-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R11.*与 rootCause\.category=coding-error 的矩阵行无交集/],
    description: 'R11 自述 category=coding-error 但多角度视角取自 design-flaw 行，与第一键行无交集，应被拦截',
  },
];

// -------------------- Preventive Review --------------------

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
    expectedReasonPatterns: [/R3 报告缺失：reliability 维度报告未找到/, /R3 报告缺失：security 维度报告未找到/],
    description: 'R3 完整性报告合规（但其他维度缺失，整体 passed=false）',
  },
  {
    file: 'bad-missing-evidence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence/],
    description: 'R3 报告缺失 evidence 字段（schema 校验失败 + 其他维度缺失）',
  },
  {
    file: 'bad-passed-false.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed=false/],
    description: 'R3 报告 passed=false 须产生 violation（checker 须读取 passed）',
  },
];

// -------------------- Iceberg Sweep --------------------

interface IcebergCase {
  /** 样本文件名（相对 samples/iceberg/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
  /**
   * 注入三视角"应扫集合"（分母对账 R6-R8 的输入）。
   *
   * 生产路径由 `check-iceberg-sweep.ts` 从项目根的上游已落盘产物实测注入（D7：分母非 R 自报）；
   * 样本目录无 `.w-model/` 上游产物，故样本层用本字段显式提供同形状输入，
   * 与 `GRAPH_CASES.injectAnchorPaths` 同一约定（logic 层不为测试开洞）。
   * 仅视角对账反例需要——其余用例保持无注入，避免既有 fixture 被误伤。
   */
  injectViewSets?: Partial<Record<IcebergView, readonly string[]>>;
}

const ICEBERG_CASES: IcebergCase[] = [
  {
    file: 'valid-full.json',
    expectedPassed: true,
    description: '合法冰山扫掠报告（无新发现，passed=true）',
  },
  {
    file: 'bad-round-out-of-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/icebergRound/],
    description: 'icebergRound=6 越界（R2，maxIcebergRounds=5）',
  },
  {
    file: 'bad-missing-evidence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence/],
    description: 'finding 缺 evidence（R4 可证伪校验失败）',
  },
  {
    file: 'bad-duplicate-finding.json',
    expectedPassed: false,
    expectedReasonPatterns: [/已在上一轮发现/],
    description: 'findingId 与 previousFindings 重复（R3 去重失败）',
  },
  {
    file: 'bad-empty-swept-artifacts.json',
    expectedPassed: false,
    expectedReasonPatterns: [/sweptArtifacts.*minItems/],
    description: 'sweptArtifacts 为空数组（schema minItems=1：空声明使零发现不可对账）',
  },
  {
    file: 'bad-view-disagreement.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R6/, /视角间存在未对账差异/, /视角间存在未对账差异[\s\S]*SD-002/],
    injectViewSets: {
      graph: ['SD-001', 'SD-002'],
      tla: ['SD-001'],
      rtm: ['SD-001', 'SD-002'],
    },
    description: 'graph/rtm 含 SD-002 而 tla 不含，窄池漏 SD 即刻失败（R6[design-sd]，SD 命名空间内差异不豁免）',
  },
  {
    file: 'bad-view-absent-silent.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R7/, /视角缺席未显式声明/, /rtm/],
    injectViewSets: { graph: ['SD-001'], tla: ['SD-001'] },
    description: '阶段 3 在场表含 rtm 但未提供且 absentViews 未声明（R7：禁止静默跳过）',
  },
  {
    file: 'bad-empty-findings-uncovered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R8/, /零发现但 sweptArtifacts 未覆盖收敛集合/],
    injectViewSets: { graph: ['SD-007'], tla: ['SD-007'], rtm: ['SD-007'] },
    description: '三视角收敛于 SD-007 但 sweptArtifacts 未覆盖，newFindings=[] 无法证明扫掠发生（R8）',
  },
  {
    file: 'bad-r6-wide-dd-drift.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R6/, /design-wide/, /graph↔rtm[\s\S]*DD-003/],
    injectViewSets: {
      graph: ['SD-001', 'DD-003'],
      tla: ['SD-001'],
      rtm: ['SD-001'],
    },
    description:
      '宽池 graph↔rtm 的 DD 漂移（DD-003 仅 graph 有）仍被检出（R6[design-wide]：分池只豁免跨命名空间宽度差）',
  },
  {
    file: 'valid-phase5-scope-present.json',
    expectedPassed: true,
    injectViewSets: {
      graph: ['SD-001'],
      tla: ['SD-001'],
      rtm: ['SD-001'],
      scope: ['src/counter.ts'],
    },
    description:
      '阶段 5 scope 视角在盘且为文件路径命名空间：不参与 R6 集合比对与 R8 收敛集，零发现报告可放行（D-1/N-1 分池）',
  },
];

// -------------------- TLA+/BDD Sync --------------------

interface TlaBddSyncCase {
  /** 样本文件名（相对 samples/tla-bdd-sync/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 violations[].description 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

const TLA_BDD_SYNC_CASES: TlaBddSyncCase[] = [
  { file: 'valid.json', expectedPassed: true, description: 'TLA+/BDD 一致' },
  {
    file: 'bad-transition-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/TLA\+ 转移 "Register" 在 BDD 中未找到对应 When 步骤/],
    description: 'TLA+/BDD 转移不一致',
  },
];

// -------------------- P0 角色分派完整性校验 --------------------

interface RoleDispatchCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const ROLE_DISPATCH_CASES: RoleDispatchCase[] = [
  {
    file: 'bad-missing-V-role.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=V/],
    description: '阶段 1 缺 role=V 评审记录，应被角色分派校验拦截（约束 #8）',
  },
  {
    file: 'bad-missing-G-role.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/缺失 role=G/],
    description:
      '阶段 1 缺 role=G 门禁记录，应被角色分派校验拦截（约束 #8）；checkpoint 记 blocked（未放行）——未放行阶段无 R11 闭环义务，该样本只触发角色分派规则',
  },
  {
    file: 'bad-missing-R-role.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/有效 R3 维度记录不足.*缺：reliability\/security/],
    description: '阶段 1 仅有 1 条 R3 记录（缺 reliability/security），R3 无条件强制应被拦截',
  },
  {
    file: 'valid-phase-role.jsonl',
    expectedPassed: true,
    description:
      '阶段 1-4 多角色机制 valid：6 persona 视角分析（矩阵全集）+ consensus + produce 晚于全部 perspective——覆盖/时序/互异三新维度全过（task 3）',
  },
  {
    file: 'bad-phase-role-missing-persona.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/阶段 1 多角色覆盖不足：缺 persona=engineering-algorithm-expert/],
    description:
      '阶段 1 视角分析缺 engineering-algorithm-expert（矩阵 6 缺 1 且未声明 lite），phaseRoleCoverage.missingPersonas 具名拦截（task 3 覆盖维度）',
  },
  {
    file: 'bad-phase-role-timing.jsonl',
    expectedPassed: false,
    expectedReasonPatterns: [/阶段 1 多角色时序违规：produce 记录 runId=btp1 未严格晚于全部 perspective 记录/],
    description:
      '阶段 1 design-ux-architect 视角分析晚于 produce 产出（04:00 > 03:00），时序维度拦截——多角色讨论须先于 S 产出（task 3 时序维度）',
  },
];

// -------------------- P1 状态机一致性校验 --------------------

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

// -------------------- codegraph/opsx 校验 --------------------

interface CodegraphQueryCase {
  sampleDir: string; // samples/ 下的子目录路径（作为 projectRoot）
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
    description:
      '有效的 codegraph 查询落盘（含 querySymbol/callers/callees/blastRadius/timestamp + 显式降级声明），应通过（legacy 无 scope 兼容层样本；strict 覆盖绑定见 check-codegraph-queries.test.ts）',
  },
  {
    sampleDir: 'codegraph-queries/bad-empty',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/无 phase5-\*\.json 查询文件/],
    description: 'codegraph-queries 目录存在但无 phase5-*.json 文件，应未通过（legacy 无 scope 兼容层样本）',
  },
  {
    sampleDir: 'codegraph-queries/bad-missing-field',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/缺 callers\[\] 字段|缺 callees\[\] 字段/],
    description: '查询文件缺 callers/callees 字段，应未通过（legacy 无 scope 兼容层样本）',
  },
  {
    sampleDir: 'codegraph-queries/bad-missing-blastradius',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/缺 blastRadius 字段/],
    description: '查询文件有 callers/callees 但缺 blastRadius 字段，应未通过（legacy 无 scope 兼容层样本）',
  },
  {
    sampleDir: 'codegraph-queries/bad-degraded-without-evidence',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/degradationReason/, /alternativeEvidence/],
    description:
      '无 .codegraph/ 索引却只声明 evidenceKind:artifact（缺 degradationReason/alternativeEvidence），应未通过（D-6：降级须显式且带替代证据）',
  },
  {
    sampleDir: 'codegraph-queries/bad-cli-kind-without-index',
    phase: 5,
    expectedPassed: false,
    expectedViolationPatterns: [/无 \.codegraph\/ 索引时须显式降级/],
    description:
      '无 .codegraph/ 索引却声明 evidenceKind:cli（claim CLI 真实执行），应未通过（D-6：索引不在盘不得声称 CLI 出处）',
  },
];

interface UatPathMappingCase {
  sampleDir: string; // samples/uat-path-mapping/<dir>/docs/uat-path-mapping.md
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

interface CodingPlanCase {
  sampleDir: string;
  phase: number;
  changeId: string;
  expectedPassed: boolean;
  expectedViolationPatterns?: RegExp[];
  description: string;
}

const CODING_PLAN_CASES: CodingPlanCase[] = [
  {
    sampleDir: 'coding-plan/valid-phase5',
    phase: 5,
    changeId: 'phase5-demo',
    expectedPassed: true,
    description:
      '编码计划制品契约全齐（plan 目标节+任务节验证命令 + 账本 complete 覆盖 + 三件套/review diff + R3×9/V×3 plan/execute/finalize），应通过',
  },
  {
    sampleDir: 'coding-plan/bad-missing-ledger',
    phase: 5,
    changeId: 'phase5-demo',
    expectedPassed: false,
    expectedViolationPatterns: [/progress\.md 缺失/],
    description: '执行账本缺失（.superpowers/sdd/<plan-基名>/progress.md 不在盘，R3），应未通过',
  },
  {
    sampleDir: 'coding-plan/bad-task-missing-verify',
    phase: 5,
    changeId: 'phase5-demo',
    expectedPassed: false,
    expectedViolationPatterns: [/缺验证命令行/],
    description: 'Task 2 任务节无「验证：」/「Verify:」验证命令行（R2：每任务节须 ≥1 条），应未通过',
  },
  {
    sampleDir: 'coding-plan/bad-review-empty',
    phase: 5,
    changeId: 'phase5-demo',
    expectedPassed: false,
    expectedViolationPatterns: [/phase5-plan-completeness\.md 为空文件/],
    description:
      'stage 审查产物为 0 字节（R5 内容下限：文件存在但无实质内容；行级证据锚降为非阻断诊断后不在此列），应未通过（2026-09-25 任务 2 / D-2）',
  },
];

const UAT_PATH_MAPPING_CASES: UatPathMappingCase[] = [
  {
    sampleDir: 'uat-path-mapping/valid-phase5',
    expectedPassed: true,
    description: '阶段5回填完整（实际路径非占位符 + mappingType 合法），应通过',
  },
  {
    sampleDir: 'uat-path-mapping/bad-empty-table',
    expectedPassed: false,
    expectedViolationPatterns: [/无有效映射行/],
    description: '空表（仅表头无数据行）应报"无有效映射行"，不静默通过',
  },
  {
    sampleDir: 'uat-path-mapping/bad-malformed-row',
    expectedPassed: false,
    expectedViolationPatterns: [/行畸形/],
    description: '畸形行（单元格数 < 4）应记录 violation，不静默跳行',
  },
  {
    sampleDir: 'uat-path-mapping/bad-empty-cell',
    expectedPassed: false,
    expectedViolationPatterns: [/含空单元格/],
    description: '畸形行（空单元格）应记录 violation，不静默跳行',
  },
  {
    sampleDir: 'uat-path-mapping/bad-unbackfilled',
    expectedPassed: false,
    expectedViolationPatterns: [/未回填/],
    description: '终检语义（checkUatPathMappingContent 供阶段5/终检共用）下含未回填行应失败',
  },
];

// -------------------- BDD（valid + bad 样本） --------------------

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
  rtmRows?: Array<{
    reqId: string;
    acceptanceTest: string | null;
    systemTest: string | null;
    integrationTest: string | null;
    unitTest: string | null;
  }>;
  /** 注入的 cucumber 报告（用于 D5 step 绑定校验，phase >= 5） */
  cucumberReport?: {
    undefinedCount: number;
    pendingCount: number;
    failedCount: number;
  };
}

const BDD_CASES: BddCase[] = [
  // -------------------- valid 样本（L1 + L2） --------------------
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
  // -------------------- bad 样本（覆盖 D1/D3/D4/D5/D6/D7 + schema） --------------------
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
    featureFiles: ['valid-l2.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/state set mismatch/],
    phase: 1,
    description: 'L2 子系统级 BDD 状态集与 TLA+ 快照不一致（L2 不豁免 D4 自动等价），应被 D4 等价性校验拦截',
    tlaSnapshots: [
      {
        specId: 'L2-blog_system_auth',
        states: ['LoggedOut', 'LoggedIn', 'Locked'],
        initialState: 'LoggedOut',
        transitions: [{ from: 'LoggedOut', event: 'login', to: 'LoggedIn' }],
        invariants: ['LoggedIn => sessionValid'],
      },
    ],
  },
  {
    // 该用例的「坏」由 rtmRows 参数注入（manifest 本身与 valid-manifest.json 逐字节相同）：
    // 原先复制出 bad-no-rtm-mapping.manifest.json，使文件名声称的缺陷并不存在于文件中（2026-09-17 审查修复）。
    manifestFile: 'valid-manifest.json',
    featureFiles: ['valid-l1.feature'],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/feature id not in RTM row/],
    phase: 1,
    description: 'feature id 未登记在 RTM test 字段中（由 rtmRows 参数注入），应被 D7 RTM 映射校验拦截',
    rtmRows: [
      {
        reqId: 'REQ-001',
        acceptanceTest: null,
        systemTest: null,
        integrationTest: null,
        unitTest: null,
      },
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
  // -------------------- 孤儿样本（check-samples-coverage 引用登记） --------------------
  {
    manifestFile: 'bad-d8-uncovered-sd.json',
    featureFiles: [],
    expectedPassed: false,
    expectedExitCode: 1,
    expectedReasonPatterns: [/\[D8\]/],
    phase: 2,
    description: '部分 SD 节点（SD-002/SD-003）未被任何 BDD feature 覆盖，应被 D8 覆盖校验拦截',
  },
];

// -------------------- Coverage（四维·维度4：valid + bad 样本） --------------------

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
  // -------------------- valid 样本 --------------------
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
  // -------------------- bad 样本 --------------------
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

// -------------------- Exemption（四维·豁免审批：valid + bad 样本） --------------------

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
  // -------------------- valid 样本（S→R→V→人类 全 approve） --------------------
  {
    file: 'valid-full-approval.json',
    expectedPassed: true,
    description: '四维·豁免：完整 S→R→V→人类 四阶段 approve（E1-E9 全通过）',
  },
  {
    file: 'valid-coverage-exemption.json',
    expectedPassed: true,
    description: '四维·豁免：coverage-missing-declared 类型豁免（NFR 不适用声明）',
  },
  {
    file: 'valid-evidence-anchor-pending.json',
    expectedPassed: true,
    description: '四维·豁免：第 6 类 evidence-anchor-pending（pending 锚点的阶段门合法出口），复用 E1-E9 四阶段审批链',
  },
  // -------------------- bad 样本（覆盖 E4-E8 各阶段失败） --------------------
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
  {
    file: 'bad-route-not-found.json',
    expectedPassed: false,
    expectedReasonPatterns: [/路由 GET \/api\/comments 未在路由定义中找到/],
    description: '验收断言指向的路由在路由定义中不存在，应报 violation（不再静默跳过）',
  },
];

// -------------------- SignatureChain（签名链：valid + bad 样本） --------------------

interface SignatureChainCase {
  /** 样本文件名（相对 samples/signature-chain/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 rulesFailed 中至少包含以下每个值（全部包含才算通过） */
  expectedRulesFailed?: string[];
  /** 校验 phase（默认 1）；设为 undefined 表示不传 phase（archive 模式） */
  phase?: number;
  /** 用例说明 */
  description: string;
}

const SIGNATURE_CHAIN_CASES: SignatureChainCase[] = [
  {
    file: 'valid-all-roles.jsonl',
    expectedPassed: true,
    phase: 1,
    description: '签名链：阶段 1 完整 9 角色 + 用户确认 checkpoint（R1-R10 全通过）',
  },
  {
    file: 'bad-missing-V.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R1'],
    phase: 1,
    description: '签名链：缺 V 角色，R1 失败',
  },
  {
    file: 'bad-broken-chain.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R2'],
    phase: 1,
    description: '签名链：prevSigHash 不匹配，R2 失败',
  },
  {
    file: 'bad-backdated.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R3'],
    phase: 1,
    description: '签名链：时间戳非单调，R3 失败',
  },
  {
    file: 'bad-O-produce.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R1'],
    phase: 1,
    description: '签名链：非法角色 X 被 schema role enum 前置拦截（[schema] 违规 + R1 失败）',
  },
  {
    file: 'bad-O-self-sign.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R5'],
    phase: 1,
    description: '签名链：O 代签 checkpoint，R5 失败',
  },
  {
    file: 'bad-tampered-hash.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R6'],
    phase: 1,
    description: '签名链：sigHash 篡改，R6 失败',
  },
  {
    file: 'bad-dangling-source.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R7'],
    phase: 1,
    description: '签名链：悬空来源，R7 失败',
  },
  {
    file: 'bad-missing-artifact.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R8'],
    phase: 1,
    description: '签名链：缺失产物，R8 失败',
  },
  {
    file: 'bad-S-consumes-G.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R9'],
    phase: 1,
    description: '签名链：S 越权消费 G，R9 失败',
  },
  {
    file: 'bad-R-consumes-S.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R9'],
    phase: 1,
    description: '签名链：R 越权消费 S，R9 失败',
  },
  {
    file: 'bad-O-bypass-G.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R10'],
    phase: 1,
    description: '签名链：O checkpoint 绕过 G，R10 失败',
  },
  // E1: 跨阶段连续链
  // audit-fixes task 4（262 口径等量合并）：本用例与下一用例原为同 fixture 双正例
  // （默认档 + --phase=2 档）；--phase=2 选项路径由 bad-broken-cross-phase.jsonl
  // （phase: 2 → R2 rulesFailed）覆盖，保留默认档正例，删除重复正例条目。
  {
    file: 'valid-continuous-chain.jsonl',
    expectedPassed: true,
    description: '签名链：2 阶段连续链存档模式（R2 跨阶段连续链语义；含 --phase=2 档位由跨阶段断链负例覆盖）',
  },
  {
    file: 'bad-broken-cross-phase.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R2'],
    phase: 2,
    description: '签名链：跨阶段断链（prevSigId 不存在于全链），R2 失败',
  },
  // 43.0.0 sigHash v3（A1 单公式；valid-v2/bad-v2-* 经 codemod 后为 v3 原生数据）
  {
    file: 'valid-v2.jsonl',
    expectedPassed: true,
    phase: 1,
    description: '签名链：v3 单公式全链（sigHashAlgo=v3 + 来源 sha256 齐全），R6 按 v3 重算 + R11 通过',
  },
  {
    file: 'bad-v2-missing-sha256.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R11'],
    phase: 1,
    description: '签名链：来源 sha256 缺失，R11 失败（v3 起全量适用，不再按条目分流）',
  },
  {
    file: 'bad-v2-tampered-sha256.jsonl',
    expectedPassed: false,
    expectedRulesFailed: ['R6'],
    phase: 1,
    description: '签名链：来源 sha256 被篡改但 sigHash 未重算，R6 失败（v3 公式纳入 sha256）',
  },
];

// -------------------- ArchiveIntegrity（归档完整性：valid + bad 样本，含 codingPlanSnapshot 条件项） --------------------

interface ArchiveIntegrityCase {
  /** 样本文件名（相对 samples/archive-integrity/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 missingFiles 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /**
   * 配套归档目录树（相对 samples/；对象形态 fixture 的 progress.md 内容源）。
   * 声明本字段 = 用例经 sampleDir 子树引用登记该树（check-samples-coverage 规则 1）；
   * 仅 valid-coding-plan-snapshot 需要（与 CLI 实读归档账本的生产路径同源），其余 fixture 内嵌自足。
   */
  sampleDir?: string;
  /** 用例说明 */
  description: string;
}

const ARCHIVE_INTEGRITY_CASES: ArchiveIntegrityCase[] = [
  {
    file: 'valid-full.json',
    expectedPassed: true,
    description: '归档完整性：全阶段强制文件齐全',
  },
  {
    file: 'bad-missing-phase1-docs.json',
    expectedPassed: false,
    expectedReasonPatterns: [/requirements\.md/],
    description: '归档完整性：缺 phase-1 文档',
  },
  {
    file: 'bad-missing-signature-chain.json',
    expectedPassed: false,
    expectedReasonPatterns: [/signature-chain\.jsonl/],
    description: '归档完整性：缺 signature-chain.jsonl',
  },
  {
    file: 'bad-missing-gate-logs.json',
    expectedPassed: false,
    expectedReasonPatterns: [/gate-logs\//],
    description: '归档完整性：缺 gate-logs/ 目录',
  },
  {
    file: 'valid-coding-plan-snapshot.json',
    expectedPassed: true,
    sampleDir: 'archive-integrity/valid-coding-plan-snapshot',
    description:
      '归档完整性：codingPlanSnapshot=true 且编码计划归档快照齐备（phase5-demo.plan.md + progress.md + Task 1/2 三件套；账本内容实读配套目录树，与 CLI 生产路径同源），应通过（并入自 check-openspec-archive 退役）',
  },
  {
    file: 'bad-missing-plan-snapshot.json',
    expectedPassed: false,
    expectedReasonPatterns: [/归档计划快照缺失/],
    description:
      '归档完整性：codingPlanSnapshot=true 但归档根缺 phase5-demo.plan.md 计划快照，应未通过（并入自 check-openspec-archive 退役）',
  },
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
  // -------------------- verifier-output schema（基线用例） --------------------
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
  // -------------------- Schema 用例：每份 schema 各加一条前置校验用例 --------------------
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
    file: 'bad-rtm-evidence-wrong-type.json',
    schema: 'rtm',
    expectedValid: false,
    expectedErrorPatterns: [/evidence\/exitCode/, /\[type\]/],
    description: 'rtm testSummary.evidence.exitCode 为字符串应被 type:integer 拦截',
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
  // -------------------- 四维识别·coverage schema --------------------
  {
    file: 'bad-coverage-missing-required.json',
    schema: 'coverage',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'coverage 缺 metrics 必填字段应被 required 拦截',
  },
];

interface CodeHealthCase {
  file: string;
  schema: string;
  expectedValid: boolean;
  expectedErrorPatterns?: RegExp[];
  description: string;
}

const CODE_HEALTH_CASES: CodeHealthCase[] = [
  {
    file: 'valid-campaign.json',
    schema: 'code-health-campaign',
    expectedValid: true,
    description: '合法 campaign manifest',
  },
  {
    file: 'valid-ledger-event.json',
    schema: 'code-health-ledger-event',
    expectedValid: true,
    description: '合法 append-only ledger event',
  },
  {
    file: 'valid-candidate.json',
    schema: 'code-health-candidate',
    expectedValid: true,
    description: 'discovered candidate remains undecided',
  },
  {
    file: 'valid-evidence.json',
    schema: 'code-health-evidence',
    expectedValid: true,
    description: '合法 source-bound evidence package',
  },
  {
    file: 'valid-approval.json',
    schema: 'code-health-approval',
    expectedValid: true,
    description: '合法 human approval scope',
  },
  {
    file: 'valid-archive.json',
    schema: 'code-health-archive',
    expectedValid: true,
    description: '合法 redacted archive record',
  },
  {
    file: 'valid-gap.json',
    schema: 'code-health-gap',
    expectedValid: true,
    description: '合法 test-gap row',
  },
  {
    file: 'valid-test-inventory.json',
    schema: 'code-health-test-inventory',
    expectedValid: true,
    description: '合法 protected test inventory',
  },
  {
    file: 'valid-duplicate-cluster.json',
    schema: 'code-health-duplicate-cluster',
    expectedValid: true,
    description: '合法 duplicate cluster review',
  },
  {
    file: 'bad-missing-candidate-id.json',
    schema: 'code-health-candidate',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'candidate identity is required',
  },
  {
    file: 'bad-candidate-conclusion.json',
    schema: 'code-health-candidate',
    expectedValid: false,
    expectedErrorPatterns: [/const/],
    description: 'discovery cannot carry a conclusion',
  },
  {
    file: 'bad-no-command-hash.json',
    schema: 'code-health-evidence',
    expectedValid: false,
    expectedErrorPatterns: [/required/],
    description: 'command evidence requires a raw output hash',
  },
  {
    file: 'bad-stale-revision.json',
    schema: 'code-health-candidate',
    expectedValid: false,
    expectedErrorPatterns: [/pattern/],
    description: 'stale or malformed revision identity is rejected',
  },
  {
    file: 'bad-approval-scope-mismatch.json',
    schema: 'code-health-approval',
    expectedValid: false,
    expectedErrorPatterns: [/pattern/],
    description: 'approval scope hash must be structurally valid',
  },
  {
    file: 'bad-protected-omission.json',
    schema: 'code-health-test-inventory',
    expectedValid: false,
    expectedErrorPatterns: [/minItems/],
    description: 'protected facts cannot be omitted',
  },
  {
    file: 'bad-missing-archive-redaction.json',
    schema: 'code-health-archive',
    expectedValid: false,
    expectedErrorPatterns: [/const/],
    description: 'archived evidence must be redaction-clean',
  },
  {
    file: 'bad-unavailable-environment-pass.json',
    schema: 'code-health-campaign',
    expectedValid: false,
    expectedErrorPatterns: [/not/],
    description: 'unavailable required environments cannot pass',
  },
];

// -------------------- Phase 1 只读发现（静态 / 动态 / guard） --------------------

interface CodeHealthPhase1StaticCase {
  file: string;
  expectedBlocked: boolean;
  expectedCategories?: string[];
  description: string;
}

interface CodeHealthPhase1Fixture {
  revision: RevisionIdentity;
  files: string[];
  sourceText: Record<string, string>;
  expectedCategories?: string[];
  expectedReferences?: Array<{ kind: string; symbol: string; path: string }>;
  expectedUnavailable?: string[];
  context?: FalsePositiveContext;
  lead?: Phase1CandidateLead;
}

const CODE_HEALTH_PHASE1_STATIC_CASES: CodeHealthPhase1StaticCase[] = [
  {
    file: 'valid.json',
    expectedBlocked: false,
    expectedCategories: ['dynamic-import', 'reflection', 'shell-platform', 'schema-template-rtm', 'test-only-helper'],
    description: '静态 inventory 覆盖动态 import/reflection/shell/schema-template-RTM/test helper',
  },
  {
    file: 'signals.json',
    expectedBlocked: false,
    expectedCategories: [
      'ast-reference',
      'dynamic-import',
      'reflection',
      'shell-platform',
      'schema-template-rtm',
      'test-only-helper',
    ],
    description:
      '静态 inventory 逐信号覆盖：decorator/DI metadata、filesystem discovery、config handler、path/EOL、shell literal、schema/template/migration/graph ID、custom matcher、test double import',
  },
  {
    file: 'blocked.json',
    expectedBlocked: true,
    expectedCategories: [],
    description: '源文件不可读 → lead blocked，绝不产出 dead 结论',
  },
];

interface CodeHealthPhase1GuardCase {
  file: string;
  expectedViolations: 'empty' | 'nonempty';
  expectedClassification?: Phase1CandidateLead['classification'];
  description: string;
}

const CODE_HEALTH_PHASE1_GUARD_CASES: CodeHealthPhase1GuardCase[] = [
  {
    file: 'valid.json',
    expectedViolations: 'empty',
    expectedClassification: 'candidate',
    description: '无 false-positive 机制且 trace 全部 observed/reached → guard 为空，lead 保持 candidate（非 dead）',
  },
  {
    file: 'blocked.json',
    expectedViolations: 'nonempty',
    expectedClassification: 'unknown',
    description: 'false-positive guard 命中（dynamic import/reflection/platform）→ classification=unknown',
  },
];

interface CodeHealthPhase1DynamicCase {
  file: string;
  expectedApplicable: number | 'at-least-one';
  description: string;
}

const CODE_HEALTH_PHASE1_DYNAMIC_CASES: CodeHealthPhase1DynamicCase[] = [
  {
    file: 'valid.json',
    expectedApplicable: 'at-least-one',
    description: 'scenario matrix 结构合法且含声明 supported=false 的环境（保证 unexercisedScenarios 非空）',
  },
  {
    file: 'blocked.json',
    expectedApplicable: 0,
    description: '全部 scenario 声明 supported=false → 无可用环境，候选只能 blocked/unknown，绝不产出 dead 结论',
  },
];

// -------------------- Phase 1 候选审查与删除执行器（apply 四态） --------------------

interface CodeHealthApplyFixture {
  mode: 'dry-run' | 'patch' | 'commit';
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision | null;
}

interface CodeHealthApplyCase {
  file: string;
  expected: 'approval-required' | 'scope-mismatch' | 'patch-proposal' | 'rollback-failure';
  description: string;
}

const CODE_HEALTH_APPLY_CASES: CodeHealthApplyCase[] = [
  {
    file: 'approval-required.json',
    expected: 'approval-required',
    description: '无人类 approval artifact → HUMAN_APPROVAL_REQUIRED，绝不删除',
  },
  {
    file: 'scope-mismatch.json',
    expected: 'scope-mismatch',
    description: 'approval 扩大 files scope → SCOPE_MISMATCH，未知文件 fail-closed',
  },
  {
    file: 'valid-patch.json',
    expected: 'patch-proposal',
    description: 'exact human scope/revision → 受控 .patch proposal + executable rollback plan，不写工作树',
  },
  {
    file: 'rollback-failure.json',
    expected: 'rollback-failure',
    description: 'candidate rollback plan executable=false → executeRollback 返回 false，绝不声称成功',
  },
];

// -------------------- Phase 2 七维度 gap matrix（发现 / 矩阵 / RED-GREEN） --------------------

interface CodeHealthGapFixture {
  kind: 'discovery' | 'matrix' | 'red-green';
  ledger?: CodeHealthLedger;
  discovery?: GapDiscoveryInput;
  rows?: GapRow[];
  gap?: GapRow;
  results?: CommandEvidence[];
}

interface CodeHealthGapCase {
  file: string;
  expectedPassed: boolean;
  /** 仅 discovery 用例：期望发现的维度数（缺维度时由 findGaps fail-closed，取不到行）。 */
  expectedKindCount?: number;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const CODE_HEALTH_GAP_CASES: CodeHealthGapCase[] = [
  {
    file: 'valid-gap.json',
    expectedPassed: true,
    expectedKindCount: 7,
    description: '七维度 discovery 生成完整 matrix 并通过 validateGapMatrix（coverage 仅信号）',
  },
  {
    file: 'missing-security.json',
    expectedPassed: false,
    expectedReasonPatterns: [/security/i],
    description: '缺 security 维度 → findGaps fail-closed，coverage 不能替代该维度',
  },
  {
    file: 'missing-platform.json',
    expectedPassed: false,
    expectedReasonPatterns: [/platform/i],
    description: '缺 platform 维度 → findGaps fail-closed',
  },
  {
    file: 'coverage-only.json',
    expectedPassed: false,
    expectedReasonPatterns: [/coverage|missing|seven/i],
    description: 'coverageSignal.lines=1 且缺维度 → 100% coverage 不授权跳过任何维度',
  },
  {
    file: 'red-not-fail.json',
    expectedPassed: false,
    expectedReasonPatterns: [/redEvidence|RED/i],
    description: 'implemented gap 的 redEvidence exitCode=0 → validateGapMatrix 拒绝非失败 RED',
  },
  {
    file: 'red-unclassified.json',
    expectedPassed: false,
    expectedReasonPatterns: [/redEvidence|classification|assertion/i],
    description: 'RED 非零但缺 codeHealthTddFailureClass 分类 → 手工证据不能冒充真实 RED',
  },
  {
    file: 'redgreen-binding-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/redEvidence|gap|bound/i],
    description: '矩阵行 red/green 证据未绑定到该行 gapId → 拒绝跨 gap 拼装',
  },
  {
    file: 'forged-scope-declaration.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ledger|scope|test artifact|candidate/i],
    description: '矩阵行伪造 implementationArtifact/声明 → 与 ledger candidate scope/tests 不一致被拒',
  },
  {
    file: 'forged-scope-redgreen.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ledger|scope|test artifact|candidate/i],
    description: 'red-green 伪造声明（断言当实现、真实实现当测试）→ 与 ledger 记录不一致被 CLI 拒绝',
  },
  {
    file: 'green-weakening.json',
    expectedPassed: false,
    expectedReasonPatterns: [/same assertion|weakened|assertionHash/i],
    description: 'GREEN 的 assertionHash 与 RED 不同（削弱/改写断言）→ validateRedGreenEvidence 拒绝',
  },
  {
    file: 'infrastructure-red.json',
    expectedPassed: false,
    expectedReasonPatterns: [/unrelated|infrastructure/i],
    description: 'RED 因无关基础设施原因失败（模块缺失/语法错误）→ 不计为 RED',
  },
  {
    file: 'unknown-command.json',
    expectedPassed: false,
    expectedReasonPatterns: [/RED evidence required/i],
    description: 'RED 命令不存在（observation=unavailable, exitCode=null）→ 不计为 RED',
  },
];

interface CodeHealthTestInventoryCase {
  file: string;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const CODE_HEALTH_TEST_CASES: CodeHealthTestInventoryCase[] = [
  {
    file: 'valid-inventory.json',
    expectedPassed: true,
    description: '受保护唯一负向测试被完整登记 → protected facts 与记录分类一致，且作者/年龄仅为 provenance',
  },
  {
    file: 'valid-redundant-removal.json',
    expectedPassed: true,
    description: '等价 survivor + ledger 锚定 scope + 已解释 facts → 允许一次性删除；作者/年龄不参与判定',
  },
  {
    file: 'bad-author-age-deletion.json',
    expectedPassed: false,
    expectedReasonPatterns: [/protected/i],
    description: '作者/年龄诱导删除唯一 protected 测试且无 survivor → 拒删',
  },
  {
    file: 'bad-weaker-oracle.json',
    expectedPassed: false,
    expectedReasonPatterns: [/oracle/i],
    description: 'survivor oracle 更弱 → 等价性证明失败',
  },
  {
    file: 'bad-governance-drift.json',
    expectedPassed: false,
    expectedReasonPatterns: [/pre-push|self-test/i],
    description: '19 项 pre-push 顺序/计数或 self-test facts 漂移未解释 → 阻塞',
  },
  {
    file: 'bad-prepost-regression.json',
    expectedPassed: false,
    expectedReasonPatterns: [/test count/i],
    description: 'pre/post 真实回归未观测到减一 → 阻塞',
  },
  {
    file: 'bad-missing-ledger.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ledger/i],
    description: '移除声明缺 ledger 记录锚定 → 无授权，fail-closed',
  },
  {
    file: 'bad-neutral-unprotected.json',
    expectedPassed: false,
    expectedReasonPatterns: [/non-protected|treated as protected/i],
    description: '中性文本测试仅靠 delete-code ledger 声明 → 未正向建立非保护状态，默认按 protected 拒绝',
  },
];

// -------------------- Phase 4 duplicate cluster / abstraction guard（self-test 回归 fixture） --------------------

interface CodeHealthDuplicateFixture {
  description: string;
  /** The status the pure cluster is expected to reach (never "approved": approval is a human gate). */
  expectedStatus: DuplicateCluster['status'];
  expectAuthorized: boolean;
  candidateId: string;
  input: DuplicateInput;
  authority: DuplicateClusterAuthority;
  review?: {
    equivalenceProof?: DuplicateCluster['equivalenceProof'];
    maintenanceBenefit?: string;
    rollback?: RollbackPlan;
    redaction?: DuplicateCluster['redaction'];
  };
  proposal?: AbstractionProposal;
}

interface CodeHealthDuplicateCase {
  file: string;
  expectedStatus: DuplicateCluster['status'];
  /** 期望 guard 违规至少各匹配一个正则（用于 blocked 用例） */
  expectedViolations: RegExp[];
  expectAuthorized: boolean;
  description: string;
}

const CODE_HEALTH_PHASE4_CASES: CodeHealthDuplicateCase[] = [
  {
    file: 'valid-cluster.json',
    expectedStatus: 'under-review',
    expectedViolations: [],
    expectAuthorized: true,
    description: '两个独立稳定生产调用点 + 完整逐项等价证明 + 可量化维护收益 → guard 放行（仅提案级）',
  },
  {
    file: 'deferred-one-site.json',
    expectedStatus: 'deferred',
    expectedViolations: [],
    expectAuthorized: false,
    description: '仅 1 个稳定生产调用点 → deferred（非批准），绝不授权抽象',
  },
  {
    file: 'bad-test-only.json',
    expectedStatus: 'rejected',
    expectedViolations: [/test-only/i],
    expectAuthorized: false,
    description: 'test-only helper 充当实现 → rejected，test-only 绝不授权',
  },
  {
    file: 'bad-platform-difference.json',
    expectedStatus: 'under-review',
    expectedViolations: [/platform/i],
    expectAuthorized: false,
    description: 'platform-specific 行为差异 → 不授权',
  },
  {
    file: 'bad-error-mismatch.json',
    expectedStatus: 'under-review',
    expectedViolations: [/errors/i],
    expectAuthorized: false,
    description: 'error/retry 逐项差异 → 不授权',
  },
  {
    file: 'bad-security-mismatch.json',
    expectedStatus: 'under-review',
    expectedViolations: [/security/i],
    expectAuthorized: false,
    description: 'security validation-order 差异 → 不授权',
  },
  {
    file: 'bad-lifecycle-mismatch.json',
    expectedStatus: 'under-review',
    expectedViolations: [/lifecycle/i],
    expectAuthorized: false,
    description: 'lifecycle/resource 差异 → 不授权',
  },
  {
    file: 'bad-maintenance-only.json',
    expectedStatus: 'under-review',
    expectedViolations: [/maintenance/i],
    expectAuthorized: false,
    description: '维护收益仅“少几行/更短 diff” → 不构成收益，不授权',
  },
  {
    file: 'bad-generated.json',
    expectedStatus: 'deferred',
    expectedViolations: [],
    expectAuthorized: false,
    description: 'tracked record 标记 generated copy → 排除，绝不计为稳定生产调用点',
  },
  {
    file: 'bad-oneoff.json',
    expectedStatus: 'deferred',
    expectedViolations: [],
    expectAuthorized: false,
    description: 'tracked record 标记 one-off experiment → 排除，绝不授权',
  },
  {
    file: 'bad-deadcopy.json',
    expectedStatus: 'deferred',
    expectedViolations: [],
    expectAuthorized: false,
    description: 'tracked record 标记 dead copy → 排除，绝不授权',
  },
  {
    file: 'bad-prose-views.json',
    expectedStatus: 'deferred',
    expectedViolations: [],
    expectAuthorized: false,
    description: '三个结构视图均为自由文本 → typed 结构证据不足，deferred',
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

function matchReasonPatterns(reasons: string[], patterns: RegExp[] | undefined): string[] {
  if (!patterns || patterns.length === 0) return [];
  const details: string[] = [];
  for (const p of patterns) {
    const matched = reasons.some((r) => p.test(r));
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
    const parsed: unknown = parseJsonSafe(raw);
    // R19（A2，批次 6 任务 4）：样本口径与 CLI 接线单点一致——reviewedArtifacts 读盘复核
    // （存在 / 哈希 / 行数）经 lib/reviewed-artifacts.ts 完成后，行数表注入 logic（行号越界校验），
    // 复核违规并入 reasons 与 passed 判定（照 check-budget / check-maturity 复用导出函数先例）。
    const reviewedRaw = (parsed as { reviewedArtifacts?: unknown } | null)?.reviewedArtifacts;
    const artifactCheck = verifyReviewedArtifacts(reviewedRaw, path.dirname(abs));
    const r = checkVerifierOutput(parsed, {
      lineCountsByPath: artifactCheck.lineCountsByPath,
    });
    const reasons = [...r.reasons, ...artifactCheck.reasons];
    const passed = r.passed && artifactCheck.reasons.length === 0;

    const details: string[] = [];
    if (passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(reasons, c.expectedReasonPatterns));
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
    const parsed: unknown = parseJsonSafe(raw);
    const options: Record<string, unknown> = {};
    if (c.phaseOption) options.phaseOption = c.phaseOption;
    if (c.graph) options.graph = c.graph;
    // M07 E2：evidence.rawOutputPath 以「项目根」解析。样本级夹具的项目根即 samples/gate/，
    // 透传后 valid-test-evidence.json 的同目录产物可走通哈希核验端到端（不传则 E2 fail-closed）。
    options.projectRoot = path.join(samplesDir, 'gate');
    // S18：票据内容 fixture 文本作为纯函数输入（未声明 ticketsFile 的用例不触发票据校验）
    if (c.ticketsFile) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库固定路径（samples/gate/ 下的用例声明 fixture），仅只读
      options.ticketsText = await fs.readFile(path.join(samplesDir, 'gate', c.ticketsFile), 'utf-8');
    }
    // 批次1 SDMAP-3/4：用例声明的注入表转 ReadonlyMap 传给纯函数（缺省 undefined → sdAnchorCheck=skipped，与 CLI 生产路径注入态区分）
    options.srcLineCounts = c.srcLineCounts ? new Map(Object.entries(c.srcLineCounts)) : undefined;
    // A4：目录组合 fixture 的 maturity.json + signature-chain.jsonl 作为豁免判定输入
    // （链文件逐行 JSON 解析，坏行跳过——与 CLI loadSignatureChainIfExists 同口径）
    if (c.maturityFile) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库固定路径（samples/gate/ 下的用例声明 fixture），仅只读
      options.maturity = JSON.parse(await fs.readFile(path.join(samplesDir, 'gate', c.maturityFile), 'utf-8')) as never;
    }
    if (c.signatureChainFile) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库固定路径（samples/gate/ 下的用例声明 fixture），仅只读
      const chainRaw = await fs.readFile(path.join(samplesDir, 'gate', c.signatureChainFile), 'utf-8');
      options.signatureChain = chainRaw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as never);
    }
    const r = checkArtifactGate(parsed as never, Object.keys(options).length > 0 ? (options as never) : undefined);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
    }

    const phaseTag = c.phaseOption ? `[p${c.phaseOption}]` : '';
    const ticketsTag = c.ticketsFile ? `+${c.ticketsFile}` : '';
    results.push({
      name: `gate/${c.file}${phaseTag}${ticketsTag}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

/**
 * 收集图谱中真实存在的锚点 path（供 R15c 注入）。
 * 与 check-requirement-graph.ts CLI 同口径：取 `:` 之前的 path 部分，以仓库根解析。
 */
function collectExistingAnchorPaths(graph: unknown, repoRoot: string): Set<string> {
  const existing = new Set<string>();
  const nodes = (graph as { nodes?: unknown })?.nodes;
  if (!Array.isArray(nodes)) return existing;
  for (const n of nodes) {
    const anchor = (n as { evidenceAnchor?: unknown })?.evidenceAnchor;
    if (typeof anchor !== 'string' || anchor.trim() === '') continue;
    const anchorPath = anchor.split(':')[0];
    if (!anchorPath) continue;
    if (existsSync(path.resolve(repoRoot, anchorPath))) existing.add(anchorPath);
  }
  return existing;
}

async function runGraphCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  // R15c 存在性校验的真实仓库根（logic 层不做 I/O，由本处按需注入）
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  for (const c of GRAPH_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonSafe(raw);
    const externalEvidence = c.injectAnchorPaths
      ? { existingAnchorPaths: collectExistingAnchorPaths(parsed, repoRoot) }
      : undefined;
    const r = checkRequirementGraph(parsed, c.phase, externalEvidence);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }
    if (c.expectedWarningPatterns && c.expectedWarningPatterns.length > 0) {
      const warnings = (r as { warnings?: string[] }).warnings ?? [];
      details.push(...matchReasonPatterns(warnings, c.expectedWarningPatterns));
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

// ==================== R7/R8 需求规格产物校验 runner ====================

async function runSpecEnhanceCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of SPEC_ENHANCE_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      traceabilityMatrix: string;
      umlModeling: string;
      specContent: string;
    };
    const v = checkRequirementSpecEnhance(parsed.traceabilityMatrix, parsed.specContent, parsed.umlModeling);
    const violations = [...v.r7, ...v.r8];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// ==================== Phase 1 需求规格结构校验 runner ====================
// 内存 fs stub：键用 path.join 构造，与 checkPhaseSpecStructure 内部 path.join 一致
//（Windows 下分隔符为反斜杠，避免模板字符串正斜杠导致 existsSync 查不到）。

async function runSpecStructureCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of SPEC_STRUCTURE_CASES) {
    const abs = path.join(samplesDir, 'gate', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      specContent: string;
      refFiles: string[];
      dodContent: string;
    };
    const files: Record<string, string> = {};
    const dir = 'docs/phase1-requirements';
    files[path.join(dir, 'requirement-spec.md')] = parsed.specContent;
    for (const f of parsed.refFiles) files[path.join(dir, f)] = '';
    files[path.join(dir, 'discipline-dod.md')] = parsed.dodContent;
    const fsStub = {
      readFileSync(p: string): string {
        return files[p] ?? '';
      },
      existsSync(p: string): boolean {
        return p in files;
      },
    };
    const v = checkPhaseSpecStructure(1, dir, fsStub);
    const violations = [...v.refs, ...v.ssot, ...v.dod, ...v.outOfScope];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `gate/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// 内存 fs stub（内联用例）：键用 path.join 构造，与 checkPhaseSpecStructure
// 内部 path.join 一致（Windows 反斜杠）。§8 之前的 7 引用块 + §0 四项 + DoD 9 项
// 由本 runner 统一补齐，使 §8 成为唯一变量。
const OOS_REF_FILES = [
  'system-context.md',
  'glossary.md',
  'traceability-matrix.md',
  'behavior-spec.md',
  'discipline-dod.md',
  'uml-modeling.md',
  'development-requirements.md',
];

async function runSpecStructureOutOfScopeCases(): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const dir = 'docs/phase1-requirements';
  for (const c of SPEC_STRUCTURE_OUT_OF_SCOPE_CASES) {
    const files: Record<string, string> = {};
    files[path.join(dir, 'requirement-spec.md')] =
      OOS_SPEC_PREFIX + (c.section === undefined ? '' : `## 8. Out of Scope\n\n${c.section}\n`);
    for (const f of OOS_REF_FILES) files[path.join(dir, f)] = '';
    files[path.join(dir, 'discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const fsStub = {
      readFileSync(p: string): string {
        return files[p] ?? '';
      },
      existsSync(p: string): boolean {
        return p in files;
      },
    };
    const v = checkPhaseSpecStructure(1, dir, fsStub);
    const violations = [...v.refs, ...v.ssot, ...v.dod, ...v.outOfScope];
    const actualCounts = {
      refs: v.refs.length,
      ssot: v.ssot.length,
      dod: v.dod.length,
      outOfScope: v.outOfScope.length,
    };
    const details: string[] = [];
    // 各桶计数逐一比对：既锁定「恰好报该违规」，也证明未误伤其他桶
    // （逐字段显式比较，不用 `obj[key]` —— 动态属性访问会触发 security/detect-object-injection）
    const expected = c.expectedBucketCounts;
    const mismatchedBuckets: string[] = [];
    if (expected.refs !== actualCounts.refs) mismatchedBuckets.push('refs');
    if (expected.ssot !== actualCounts.ssot) mismatchedBuckets.push('ssot');
    if (expected.dod !== actualCounts.dod) mismatchedBuckets.push('dod');
    if (expected.outOfScope !== actualCounts.outOfScope) mismatchedBuckets.push('outOfScope');
    if (mismatchedBuckets.length > 0) {
      details.push(
        `  - 期望各桶违规数 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actualCounts)}（不符桶：${mismatchedBuckets.join('、')}）`,
      );
    }
    if (mismatchedBuckets.length > 0 || c.expectedBucketCounts.outOfScope > 0) {
      details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    }
    results.push({
      name: c.name,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// ==================== Phase 2 系统设计增强 runner ====================

async function runDesignEnhanceCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of DESIGN_ENHANCE_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      traceabilityMatrix: string;
      umlModeling: string;
      designDocContent: string;
    };
    const v = checkDesignSpecEnhance(parsed.traceabilityMatrix, parsed.designDocContent, parsed.umlModeling);
    const violations = [...v.r9, ...v.r10];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// 内存 fs stub：键用 path.join 构造，与 checkPhaseSpecStructure 内部 path.join 一致
async function runPhase2SpecStructureCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of PHASE2_SPEC_STRUCTURE_CASES) {
    const abs = path.join(samplesDir, 'gate', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      mainDoc: string;
      specContent: string;
      refFiles: string[];
      dodContent: string;
    };
    const files: Record<string, string> = {};
    const dir = path.join('docs', 'phase2-design');
    files[path.join(dir, parsed.mainDoc)] = parsed.specContent;
    for (const f of parsed.refFiles) files[path.join(dir, f)] = '';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = parsed.dodContent;
    const fsStub = {
      readFileSync(p: string): string {
        return files[p] ?? '';
      },
      existsSync(p: string): boolean {
        return p in files;
      },
      readdirSync(p: string): string[] {
        return Object.keys(files)
          .filter((k) => k.startsWith(`${p}${path.sep}`))
          .map((k) => k.split(path.sep).pop()!);
      },
    };
    const v = checkPhaseSpecStructure(2, dir, fsStub);
    const violations = [...v.refs, ...v.ssot, ...v.dod];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `gate/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// ==================== Phase 3 概要设计增强 runner ====================

async function runOutlineEnhanceCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of OUTLINE_ENHANCE_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      traceabilityMatrix: string;
      umlModeling: string;
      designDocContent: string;
    };
    const v = checkOutlineSpecEnhance(parsed.traceabilityMatrix, parsed.designDocContent, parsed.umlModeling);
    const violations = [...v.r11, ...v.r12];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runPhase3SpecStructureCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of PHASE3_SPEC_STRUCTURE_CASES) {
    const abs = path.join(samplesDir, 'gate', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      mainDoc: string;
      specContent: string;
      refFiles: string[];
      dodContent: string;
    };
    const files: Record<string, string> = {};
    const dir = path.join('docs', 'phase3-outline');
    files[path.join(dir, parsed.mainDoc)] = parsed.specContent;
    for (const f of parsed.refFiles) files[path.join(dir, f)] = '';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = parsed.dodContent;
    const fsStub = {
      readFileSync(p: string): string {
        return files[p] ?? '';
      },
      existsSync(p: string): boolean {
        return p in files;
      },
      readdirSync(p: string): string[] {
        return Object.keys(files)
          .filter((k) => k.startsWith(`${p}${path.sep}`))
          .map((k) => k.split(path.sep).pop()!);
      },
    };
    const v = checkPhaseSpecStructure(3, dir, fsStub);
    const violations = [...v.refs, ...v.ssot, ...v.dod];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `gate/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// ==================== Phase 4 详细设计增强 runner ====================

async function runDetailedEnhanceCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of DETAILED_ENHANCE_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      traceabilityMatrix: string;
      umlModeling: string;
      designDocContent: string;
    };
    const v = checkDetailedSpecEnhance(parsed.traceabilityMatrix, parsed.designDocContent, parsed.umlModeling);
    const violations = [...v.r13, ...v.r14];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runPhase4SpecStructureCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of PHASE4_SPEC_STRUCTURE_CASES) {
    const abs = path.join(samplesDir, 'gate', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = JSON.parse(raw) as {
      mainDoc: string;
      specContent: string;
      refFiles: string[];
      dodContent: string;
    };
    const files: Record<string, string> = {};
    const dir = path.join('docs', 'phase4-detailed');
    files[path.join(dir, parsed.mainDoc)] = parsed.specContent;
    for (const f of parsed.refFiles) files[path.join(dir, f)] = '';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = parsed.dodContent;
    const fsStub = {
      readFileSync(p: string): string {
        return files[p] ?? '';
      },
      existsSync(p: string): boolean {
        return p in files;
      },
      readdirSync(p: string): string[] {
        return Object.keys(files)
          .filter((k) => k.startsWith(`${p}${path.sep}`))
          .map((k) => k.split(path.sep).pop()!);
      },
    };
    const v = checkPhaseSpecStructure(4, dir, fsStub);
    const violations = [...v.refs, ...v.ssot, ...v.dod];
    const actualPassed = violations.length === 0;
    const details: string[] = [];
    if (actualPassed !== c.expectedPassed)
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${actualPassed}`);
    if (!c.expectedPassed) details.push(...matchReasonPatterns(violations, c.expectedReasonPatterns));
    results.push({
      name: `gate/${c.file}`,
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
    const parsed: unknown = parseJsonSafe(raw);
    const r = checkTlaModel(parsed, c.phase);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
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
    .filter((l) => l.trim() !== '')
    .map((l) => parseJsonSafe(l));
}

async function runBudgetCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of BUDGET_CASES) {
    const abs = path.join(samplesDir, 'budget', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonSafe(raw);
    const r = checkBudget(parsed, c.options);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
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
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
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

/**
 * Budget 疑似重复归账样本（G3-7/G3-15）：逐行解析 → 逐条 run-log schema 校验（样本须是合法记录形态）→
 * 断言 `countSuspectedDuplicateGroups` 的组数（check-budget 导出的同一函数，与 CLI 诊断单点同源）。
 */
async function runBudgetRunLogCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of BUDGET_RUN_LOG_CASES) {
    const abs = path.join(samplesDir, 'run-log', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim() !== '');
    const entries = lines.map((l) => parseJsonSafe(l));

    const details: string[] = [];
    lines.forEach((line, index) => {
      const schemaResult = validateBySchema('run-log', parseJsonSafe(line));
      if (!schemaResult.valid) {
        details.push(`  - 第 ${index + 1} 行不是合法 run-log 记录：${schemaResult.errorMessages.join('; ')}`);
      }
    });
    const groups = countSuspectedDuplicateGroups(entries);
    if (groups !== c.expectedGroups) {
      details.push(`  - 期望疑似重复归账 ${c.expectedGroups} 组，实际 ${groups} 组`);
    }

    results.push({
      name: `run-log/${c.file}（budget 疑似组）`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// -------------------- RunLog append（D-5①/N-5 追加器纯逻辑，内联用例不落 fixture） --------------------

interface RunLogAppendCase {
  /** 用例说明 */
  description: string;
  /** 既有记录（历史行；追加器必须保持其逐字段不变——禁止回溯改写） */
  existing: RunLogRecord[];
  /** 待追加记录 */
  incoming: RunLogRecord[];
  /** planAppend / planCorrection 选项（now 固定注入，不依赖墙钟） */
  options: AppendOptions;
  /** 期望 accepted */
  expectedAccepted: boolean;
  /** 期望 violations 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedViolationPatterns?: RegExp[];
  /** 期望 diagnostics 中至少一条匹配以下每个正则 */
  expectedDiagnosticPatterns?: RegExp[];
  /** 期望末条新记录 note 匹配以下每个正则 */
  expectedNotePatterns?: RegExp[];
  /** 更正用例：--correct 的 runId（存在时走 planCorrection） */
  correctRunId?: string;
  /** 更正用例的 patch */
  patch?: RunLogRecord;
}

/** 追加器内联用例的基准记录：缺 timestamp 时由追加器按严格递增契约填充 */
function appendCaseRecord(patch: Partial<RunLogRecord> = {}): RunLogRecord {
  return {
    runId: 'a',
    phase: 1,
    phaseName: '需求分析',
    action: 'produce',
    role: 'S',
    duration_s: 1,
    tokens: 10,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    ...patch,
  };
}

const APPEND_CASE_NOW = '2026-01-05T00:00:00.000Z';

const RUN_LOG_APPEND_CASES: RunLogAppendCase[] = [
  {
    description: 'now 派生：与末条同毫秒时步进 +1ms 且 diagnostics 明示「时钟调整 +Nms」（绝不静默）',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: APPEND_CASE_NOW })],
    incoming: [appendCaseRecord({ runId: 'n1' })],
    options: { now: APPEND_CASE_NOW },
    expectedAccepted: true,
    expectedDiagnosticPatterns: [/时钟调整 \+\d+ms/],
    expectedNotePatterns: [/clock-adjust:auto\+\d+ms/],
  },
  {
    description: '显式时间戳倒退（≤ 末条时间）即拒绝，violation 含「时间戳不递增」',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: APPEND_CASE_NOW })],
    incoming: [appendCaseRecord({ runId: 'n1', timestamp: '2026-01-04T23:59:59.000Z' })],
    options: { now: APPEND_CASE_NOW },
    expectedAccepted: false,
    expectedViolationPatterns: [/时间戳不递增/],
  },
  {
    description: '--timestamp 注入成功：生效时间戳取注入值且 note 留 clock-injected 痕迹',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: '2026-01-04T00:00:00.000Z' })],
    incoming: [appendCaseRecord({ runId: 'n1' })],
    options: { now: APPEND_CASE_NOW, timestamp: '2026-01-04T12:00:00.000Z' },
    expectedAccepted: true,
    expectedNotePatterns: [/clock-injected:2026-01-04T12:00:00\.000Z/],
  },
  {
    description: '--allow-clock-adjust 显式声明小步进：步进到末条 +1ms 且 note 留 clock-adjust 理由',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: APPEND_CASE_NOW })],
    incoming: [appendCaseRecord({ runId: 'n1', timestamp: '2026-01-04T00:00:00.000Z' })],
    options: { now: APPEND_CASE_NOW, allowClockAdjust: 'live-run-replay' },
    expectedAccepted: true,
    expectedDiagnosticPatterns: [/时钟调整 \+\d+ms/],
    expectedNotePatterns: [/clock-adjust:live-run-replay/],
  },
  {
    description: '批内三条 now 派生逐条 +1ms 严格递增（同毫秒不再产生并列时间戳）',
    existing: [],
    incoming: [appendCaseRecord({ runId: 'n1' }), appendCaseRecord({ runId: 'n2' }), appendCaseRecord({ runId: 'n3' })],
    options: { now: APPEND_CASE_NOW },
    expectedAccepted: true,
    expectedDiagnosticPatterns: [/时钟调整 \+1ms/],
  },
  {
    description: '重复 runId 拒绝（禁止以追加方式覆盖既有记录身份）',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: APPEND_CASE_NOW })],
    incoming: [appendCaseRecord({ runId: 'h1' })],
    options: { now: APPEND_CASE_NOW },
    expectedAccepted: false,
    expectedViolationPatterns: [/runId=h1 与既有记录重复/],
  },
  {
    description: '空载荷拒绝（追加器不接受「无记录」的空追加）',
    existing: [],
    incoming: [],
    options: { now: APPEND_CASE_NOW },
    expectedAccepted: false,
    expectedViolationPatterns: [/待追加记录为空/],
  },
  {
    description: '--correct 只新增更正记录（note 含 correction-of:<runId>），历史行逐字段不变',
    existing: [
      appendCaseRecord({
        runId: 'h1',
        timestamp: APPEND_CASE_NOW,
        note: '错值 4',
      }),
    ],
    incoming: [],
    options: { now: '2026-01-05T00:01:00.000Z' },
    correctRunId: 'h1',
    patch: { note: '更正为 5' },
    expectedAccepted: true,
    expectedNotePatterns: [/更正为 5 correction-of:h1/],
  },
  {
    description: '--correct 引用不存在的 runId 拒绝（调用方按输入错误 exit 2 处理）',
    existing: [appendCaseRecord({ runId: 'h1', timestamp: APPEND_CASE_NOW })],
    incoming: [],
    options: { now: APPEND_CASE_NOW },
    correctRunId: 'nope',
    patch: { note: '更正' },
    expectedAccepted: false,
    expectedViolationPatterns: [/runId=nope 不在 run-log 内/],
  },
];

/**
 * RunLog append 内联用例（D-5①/N-5 追加器纯逻辑，无 fixture、无 IO）。
 * 断言：accepted 一致 / 拒绝时 violations 匹配 / 诊断与 note 痕迹匹配 /
 * 放行时（历史 + 新增）时间戳严格递增 / 历史行逐字段与入参相等（追加器不得回溯改写历史）。
 */
function runRunLogAppendCases(): CaseResult[] {
  const results: CaseResult[] = [];
  for (const c of RUN_LOG_APPEND_CASES) {
    const details: string[] = [];
    const plan =
      c.correctRunId !== undefined
        ? planCorrection(c.existing, c.correctRunId, c.patch ?? {}, c.options)
        : planAppend(c.existing, c.incoming, c.options);
    if (plan.accepted !== c.expectedAccepted) {
      details.push(
        `  - 期望 accepted=${c.expectedAccepted}，实际 accepted=${plan.accepted}（violations: ${plan.violations.join('；')}）`,
      );
    }
    if (!c.expectedAccepted) {
      details.push(...matchReasonPatterns(plan.violations, c.expectedViolationPatterns));
    }
    if (c.expectedDiagnosticPatterns !== undefined) {
      details.push(...matchReasonPatterns(plan.diagnostics, c.expectedDiagnosticPatterns));
    }
    if (c.expectedAccepted) {
      const appended = plan.entries.slice(plan.entries.length - plan.appended);
      if (c.expectedNotePatterns !== undefined) {
        const lastNote = appended.length > 0 ? String(appended.at(-1)!.note ?? '') : '';
        details.push(...matchReasonPatterns([lastNote], c.expectedNotePatterns));
      }
      const stamps = plan.entries.map((entry) => Date.parse(String(entry.timestamp)));
      for (let index = 1; index < stamps.length; index++) {
        // eslint-disable-next-line security/detect-object-injection -- index 为本地数组循环计数（非外部输入），stamps 为同函数内的数值列表
        if (!(stamps[index]! > stamps[index - 1]!)) {
          details.push(`  - 第 ${index + 1} 行时间戳未严格递增（append-only 契约违反）`);
        }
      }
    }
    for (const [index, history] of c.existing.entries()) {
      // eslint-disable-next-line security/detect-object-injection -- index 为本地用例数组循环计数（非外部输入），plan.entries 为同函数内的计划结果
      if (JSON.stringify(plan.entries[index]) !== JSON.stringify(history)) {
        details.push(`  - 历史行 ${index + 1} 被改写（追加器必须保持历史行逐字段不变）`);
      }
    }
    results.push({
      name: `run-log-append/${c.description}`,
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
    const parsed: unknown = parseJsonSafe(raw);
    const r = checkMaturity(parsed, c.options);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
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

/**
 * R5 真值通道样本（D-7）：run-log fixture × check-maturity 逻辑层 + CLI 导出的计数/诊断函数。
 * 判定口径与 `cli/check-maturity.ts` 主流程一致：operationalFailureCount 只来自
 * countOperationalFailures（operationalFailureModes 字段），词法命中只进 diagnostics。
 */
async function runMaturityRunLogCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  // 基准成熟度模型：samples/maturity/valid.json（L1，streak=3）；schema 前置校验要求全 required 字段
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- samples/maturity/valid.json 为仓库内受控 fixture（基准成熟度模型），只读
  const baseMaturity = parseJsonSafe(await fs.readFile(path.join(samplesDir, 'maturity', 'valid.json'), 'utf-8'));
  for (const c of MATURITY_RUN_LOG_CASES) {
    const abs = path.join(samplesDir, 'run-log', c.file);
    const name = `maturity-run-log/${c.file}`;
    const details: string[] = [];
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const entries: unknown[] = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => parseJsonSafe(l) as unknown);
      const diagnostics = buildR5Diagnostics(true, collectLexicalMentions(entries));
      const r = checkMaturity(baseMaturity, {
        operationalFailureCount: countOperationalFailures(entries),
        diagnostics,
      });
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      details.push(...matchReasonPatterns(r.violations, c.expectedViolationPatterns));
      details.push(...matchReasonPatterns(r.diagnostics, c.expectedDiagnosticPatterns));
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

async function runCheckpointCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  // valid 样本须提供 checkpointLog（含用户确认记录）
  const validCheckpointLog = new Map<string, string>([
    ['1', '用户确认：放行进入阶段 2（user-id: alice）'],
    ['2', '用户确认：放行进入阶段 3（user-id: alice）'],
  ]);
  for (const c of CHECKPOINT_CASES) {
    const abs = path.join(samplesDir, 'checkpoint', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonl(raw);
    const r = checkCheckpoint(parsed, {
      checkpointLog: c.expectedPassed ? validCheckpointLog : undefined,
    });

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
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

/** checkpoint-log loader 样本（C14/D3）：直接驱动 cli/check-checkpoint.ts 的 loadCheckpointLog。 */
async function runCheckpointLogLoaderCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CHECKPOINT_LOG_LOADER_CASES) {
    const dir = path.join(samplesDir, c.sampleDir);
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const outcome = await loadCheckpointLog(dir);
      if (outcome.kind !== c.expectedKind) {
        details.push(`  - 期望 kind=${c.expectedKind}，实际 kind=${outcome.kind}`);
      } else if (outcome.kind === 'loaded') {
        for (const p of c.expectedPhases ?? []) {
          const content = outcome.map.get(p);
          if (content === undefined || content.trim() === '') {
            details.push(`  - 期望 phase ${p} 的用户确认原文非空`);
          }
        }
      } else if (outcome.kind === 'ambiguous') {
        const basenames = outcome.files.map((f) => path.basename(f));
        for (const conflict of c.expectedConflictFiles ?? []) {
          if (!basenames.includes(conflict)) {
            details.push(`  - 期望冲突文件 ${conflict} 出现在歧义列表（实际: ${basenames.join(', ')}）`);
          }
        }
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

async function runCodeTlaCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_TLA_CASES) {
    const abs = path.join(samplesDir, 'code-tla', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed = parseJsonSafe(raw) as {
      manifest: CodeTlaConsistencyInput['manifest'];
      graph: CodeTlaConsistencyInput['graph'];
      rtm: CodeTlaConsistencyInput['rtm'];
      codeSources: Array<{ path: string; content: string }>;
    };

    // 将代码源文本解析为 CodeFile（含 AST + 抽取的 assignments/conditionals/assertions）
    const codeFiles: CodeFile[] = (parsed.codeSources ?? []).map((cs) => {
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
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed) {
      const violationMessages = r.violations.map((v) => v.message);
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
    const parsed: unknown = parseJsonSafe(raw);
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
      const review = parseJsonSafe(raw) as PreventiveReview;
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

async function runIcebergCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of ICEBERG_CASES) {
    const abs = path.join(samplesDir, 'iceberg', c.file);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const report = parseJsonSafe(raw) as IcebergSweepReport;
      // 三视角分母对账输入：样本层显式提供（生产路径由 check-iceberg-sweep.ts 从上游产物实测注入）
      const r = checkIcebergSweep(report, c.injectViewSets ? { viewSets: c.injectViewSets } : undefined);
      const details: string[] = [];
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed && c.expectedReasonPatterns) {
        details.push(...matchReasonPatterns(r.reasons, c.expectedReasonPatterns));
      }
      results.push({
        name: `iceberg/${c.file}`,
        passed: details.length === 0,
        description: c.description,
        details: details.length > 0 ? details : undefined,
      });
    } catch (err) {
      results.push({
        name: `iceberg/${c.file}`,
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
      const data = parseJsonSafe(raw) as {
        tlaContent: string;
        featureContent: string;
      };
      const r = checkTlaBddSync(data.tlaContent, data.featureContent);
      const details: string[] = [];
      if (r.passed !== c.expectedPassed) {
        details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
      }
      if (!c.expectedPassed && c.expectedReasonPatterns) {
        details.push(
          ...matchReasonPatterns(
            r.violations.map((v) => v.description),
            c.expectedReasonPatterns,
          ),
        );
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
      const entries = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => parseJsonSafe(l) as Record<string, unknown>);
      const r = checkRoleDispatch(entries as Parameters<typeof checkRoleDispatch>[0]);
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
      const parsed = parseJsonSafe(raw) as Parameters<typeof checkStateMachineConsistency>[0];
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

async function runCodingPlanCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODING_PLAN_CASES) {
    const projectRoot = path.join(samplesDir, c.sampleDir);
    const name = `${c.sampleDir}`;
    const details: string[] = [];
    try {
      const r = checkCodingPlan(projectRoot, c.phase, c.changeId, nodeCodingPlanFs);
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

// -------------------- BDD 用例（解析收敛至 bdd-logic.ts 的 parseFeatureFile） --------------------

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
      manifest = parseJsonSafe(manifestRaw) as BddManifest;
    } catch (e) {
      results.push({
        name,
        passed: false,
        description: c.description,
        details: [`  - 无法读取 manifest: ${(e as Error).message}`],
      });
      continue;
    }

    // 解析 features 文件（头标注 + Background 状态机 + scenarios；解析收敛至 bdd-logic.parseFeatureFile）
    const parsedFeatures: BddCheckInput['parsedFeatures'] = [];
    const headerViolations: string[] = [];
    for (const ff of c.featureFiles) {
      try {
        const featurePath = path.join(bddSamplesDir, ff);
        const content = await fs.readFile(featurePath, 'utf-8');
        const parsed = parseFeatureFile(content);
        headerViolations.push(...parsed.violations);

        // 找到 manifest 中对应 feature 的 id
        const featureId = manifest.features.find((f) => f.filePath.endsWith(ff))?.id ?? manifest.features[0]?.id ?? '';
        parsedFeatures.push({
          featureId,
          header: parsed.header,
          stateMachine: parsed.stateMachine,
          scenarios: parsed.scenarios,
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
    const actualExitCode: 0 | 1 | 2 = result.exitCode === 2 ? 2 : allViolations.length > 0 ? 1 : 0;

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
    const parsed: unknown = parseJsonSafe(raw);
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

// -------------------- CoverageScope（规则层覆盖口径：logic+lib 白名单分母，纯函数直测不 spawn） --------------------

interface CoverageScopeCase {
  /** 样本文件名（相对 samples/coverage-scope/） */
  file: string;
  /** 透传给 computeCoverageScope 的四指标阈值 */
  thresholds: CoverageScopeThresholds;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望白名单命中文件数（简报步骤 6：fileCount===2） */
  expectedFileCount?: number;
  /** 期望四指标合计 pct（写死样本构造值，防 logic 口径静默漂移） */
  expectedTotals?: CoverageScopeThresholds;
  /** 期望 failures 条数（缺省不校验） */
  expectedFailureCount?: number;
  /** 用例说明 */
  description: string;
}

const COVERAGE_SCOPE_CASES: CoverageScopeCase[] = [
  {
    file: 'valid.json',
    thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    expectedPassed: true,
    expectedFileCount: 2,
    expectedTotals: { statements: 75, branches: 50, functions: 100, lines: 75 },
    description:
      'valid 样本 thresholds 全 0：passed=true、fileCount=2、合计 pct=75/50/100/75（小写盘符+正斜杠与大写盘符+反斜杠各一）',
  },
  {
    file: 'valid.json',
    thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    expectedPassed: false,
    // 严格小于比较（coverage-scope-logic.ts）：functions 合计恰为 100 不低于阈值，故 4 指标中 3 条 failure
    expectedFailureCount: 3,
    description: 'valid 样本 thresholds 全 100：passed=false 且 failures 逐指标列出（functions=100 不低于阈值不计入）',
  },
];

async function runCoverageScopeCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const coverageScopeSamplesDir = path.join(samplesDir, 'coverage-scope');
  for (const c of COVERAGE_SCOPE_CASES) {
    const abs = path.join(coverageScopeSamplesDir, c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 样本路径由 samples/coverage-scope/ 与用例数组 file 字段拼出（仓库内受控 fixture）
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonSafe(raw);
    const r = computeCoverageScope(parsed, c.thresholds);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (c.expectedFileCount !== undefined && r.fileCount !== c.expectedFileCount) {
      details.push(`  - 期望 fileCount=${c.expectedFileCount}，实际 fileCount=${r.fileCount}`);
    }
    if (c.expectedTotals !== undefined) {
      const t = r.totals;
      const mismatch = (Object.keys(c.expectedTotals) as Array<keyof CoverageScopeThresholds>).filter(
        // eslint-disable-next-line security/detect-object-injection -- k 为 CoverageScopeThresholds 键字面量联合（Object.keys 类型收窄），两侧均受控对象
        (k) => t[k] !== c.expectedTotals![k],
      );
      if (mismatch.length > 0) {
        details.push(
          `  - 期望 totals=${JSON.stringify(c.expectedTotals)}，实际 totals=${JSON.stringify(t)}（${mismatch.join('/')} 不符）`,
        );
      }
    }
    if (c.expectedFailureCount !== undefined && r.failures.length !== c.expectedFailureCount) {
      details.push(
        `  - 期望 failures=${c.expectedFailureCount} 条，实际 ${r.failures.length} 条（${JSON.stringify(r.failures)}）`,
      );
    }

    results.push({
      name: `coverage-scope/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// -------------------- DesignFog（设计期迷雾登记册：spawn check-design-fog CLI 子进程，断言 exit code + FOG_JSON violations 规则集） --------------------

interface DesignFogCase {
  /** 样本文件名（相对 samples/design-fog/） */
  file: string;
  /** 透传给 check-design-fog 的 --phase（2|3|4） */
  phase: number;
  /** 期望校验是否通过（exit code 0/1 随之断言） */
  expectedPassed: boolean;
  /** 期望 FOG_JSON violations 规则集（通过态缺省不校验且实际须为空） */
  expectedRulesFailed?: string[];
  /** 用例说明 */
  description: string;
}

const DESIGN_FOG_CASES: DesignFogCase[] = [
  {
    file: 'valid-all-terminal.md',
    phase: 2,
    expectedPassed: true,
    description: '全终结迷雾册：exit 0',
  },
  {
    file: 'valid-no-fog-marker.md',
    phase: 2,
    expectedPassed: true,
    description: '合法无雾标记：exit 0',
  },
  {
    file: 'bad-unresolved-fog.md',
    phase: 2,
    expectedPassed: false,
    expectedRulesFailed: ['R4'],
    description: '未终结迷雾项（空/待定）：R4',
  },
  {
    file: 'bad-missing-section.md',
    phase: 2,
    expectedPassed: false,
    expectedRulesFailed: ['R1'],
    description: '缺迷雾登记册节：R1 fail-closed',
  },
  {
    file: 'bad-marker-conflict.md',
    phase: 2,
    expectedPassed: false,
    expectedRulesFailed: ['R5'],
    description: '标记与数据行并存：R5',
  },
];

async function runDesignFogCases(samplesDir: string): Promise<CaseResult[]> {
  // CLI 路径与 tsx runtime 入口均在本目录受控解析（self-test 自身即经 tsx 运行，node_modules 恒在）
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const designFogCli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-design-fog.ts');
  const results: CaseResult[] = [];
  for (const c of DESIGN_FOG_CASES) {
    const abs = path.join(samplesDir, 'design-fog', c.file);
    const r = runSync(process.execPath, [tsxCli, designFogCli, `--doc=${abs}`, `--phase=${c.phase}`], {
      // tsx 冷启动在满载下可超 runSync 缺省 15s（与 design-fog-cli.test.ts / check-coverage-scope.test.ts 同理由取 60s）
      timeout: 60_000,
    });
    const expectedExit = c.expectedPassed ? 0 : 1;
    const jsonLine = (r.stdout ?? '').split(/\r?\n/).find((l) => l.startsWith('FOG_JSON '));

    const details: string[] = [];
    if ((r.status ?? -1) !== expectedExit) {
      details.push(
        `  - 期望 exit code=${expectedExit}，实际 ${r.status ?? -1}（stderr=${(r.stderr ?? '').trim().slice(0, 200)}）`,
      );
    }
    if (jsonLine === undefined) {
      details.push('  - stdout 未含 FOG_JSON 行');
    } else {
      let fog: { passed?: unknown; violations?: unknown } | null = null;
      try {
        fog = parseJsonSafe(jsonLine.slice('FOG_JSON '.length));
      } catch {
        details.push(`  - FOG_JSON 行不可解析：${jsonLine.slice(0, 200)}`);
      }
      if (fog !== null) {
        if (fog.passed !== c.expectedPassed) {
          details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${JSON.stringify(fog.passed)}`);
        }
        const rules = Array.isArray(fog.violations)
          ? (fog.violations as Array<{ rule?: unknown }>).map((v) => String(v?.rule ?? '')).sort()
          : [];
        if (c.expectedRulesFailed !== undefined) {
          const expected = [...c.expectedRulesFailed].sort();
          if (rules.join(',') !== expected.join(',')) {
            details.push(
              `  - 期望 violations 规则集=${JSON.stringify(expected)}，实际 ${JSON.stringify(rules)}（${jsonLine.slice(0, 240)}）`,
            );
          }
        } else if (rules.length > 0) {
          details.push(`  - 期望无违规，实际 violations 规则集=${JSON.stringify(rules)}`);
        }
      }
    }

    results.push({
      name: `design-fog/${c.file}`,
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
    const parsed: unknown = parseJsonSafe(raw);
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
      const input = parseJsonSafe<DesignContractCheckInput>(content);
      const result = checkDesignContractConsistency(input);
      const passed =
        result.passed === tc.expectedPassed &&
        (!tc.expectedReasonPatterns ||
          tc.expectedReasonPatterns.every((pat) => result.reasons.some((r) => pat.test(r))));
      results.push({
        name,
        passed,
        description: tc.description,
        details: passed
          ? []
          : [
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
    const entries = raw
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => parseJsonSafe(l));
    // R8 需 existingPaths；仅 bad-missing-artifact 样本传空集触发 R8，其余样本跳过 R8
    const existingPaths = c.file === 'bad-missing-artifact.jsonl' ? new Set<string>() : undefined;
    const phase = c.phase;
    const r = checkSignatureChain(entries, { phase, existingPaths });

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed && c.expectedRulesFailed) {
      for (const rf of c.expectedRulesFailed) {
        if (!r.rulesFailed.includes(rf)) {
          details.push(
            `  - 未匹配期望 rulesFailed=${rf}（实际 rulesFailed=${JSON.stringify(r.rulesFailed)}，violations=${JSON.stringify(r.violations)}）`,
          );
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
    const parsed: unknown = parseJsonSafe(raw);
    let contents: Set<string>;
    let manifest: ArchiveIntegrityManifest | undefined;
    if (Array.isArray(parsed)) {
      // 既有数组形态：归档内容路径清单，manifest 全缺省（零行为变化）
      contents = new Set(parsed as string[]);
    } else {
      // 对象形态：manifest 条件项 + contents 路径清单（codingPlanSnapshot 并入自 check-openspec-archive 退役）
      const m = parsed as {
        codingPlanSnapshot?: boolean;
        changeId?: string;
        progressMd?: string;
        contents?: string[];
      };
      contents = new Set(m.contents ?? []);
      let progressMdContent = m.progressMd;
      if (progressMdContent === undefined && c.sampleDir !== undefined) {
        // 配套归档目录树实读 progress.md（与 CLI deriveArchiveIntegrityManifest + 实读账本的生产路径同源）
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- samplesDir/c.sampleDir 均为受控常量拼接的 fixture 路径
          progressMdContent = await fs.readFile(path.join(samplesDir, c.sampleDir, 'progress.md'), 'utf-8');
        } catch {
          // 树内账本缺失 → 留空，由清单校验 fail-closed 报违规
        }
      }
      manifest = {
        codingPlanSnapshot: m.codingPlanSnapshot,
        changeId: m.changeId,
        progressMdContent,
      };
    }
    const r = checkArchiveIntegrity(contents, undefined, manifest);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(`  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`);
    }
    if (!c.expectedPassed && c.expectedReasonPatterns) {
      for (const p of c.expectedReasonPatterns) {
        const matched = r.missingFiles.some((m) => p.test(m));
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
    const parsed: unknown = parseJsonSafe(raw);
    const r = validateBySchema(c.schema, parsed);

    const details: string[] = [];
    if (r.valid !== c.expectedValid) {
      details.push(`  - 期望 valid=${c.expectedValid}，实际 valid=${r.valid}`);
    }
    if (!c.expectedValid && c.expectedErrorPatterns) {
      for (const p of c.expectedErrorPatterns) {
        const matched = r.errorMessages.some((m) => p.test(m));
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

async function runCodeHealthCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_CASES) {
    const abs = path.join(samplesDir, 'code-health', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = parseJsonSafe(raw);
    const r = validateBySchema(c.schema, parsed);
    const details: string[] = [];
    if (r.valid !== c.expectedValid) {
      details.push(`  - 期望 valid=${c.expectedValid}，实际 valid=${r.valid}`);
    }
    if (!c.expectedValid && c.expectedErrorPatterns) {
      details.push(...matchReasonPatterns(r.errorMessages, c.expectedErrorPatterns));
    }
    results.push({
      name: `code-health/${c.schema}/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// -------------------- Phase 1 只读发现执行器 --------------------

async function loadPhase1Fixture(abs: string): Promise<CodeHealthPhase1Fixture> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
  return parseJsonSafe<CodeHealthPhase1Fixture>(await fs.readFile(abs, 'utf-8'));
}

function phase1UnexercisedTrace(revision: RevisionIdentity) {
  return {
    revision,
    scenarios: [
      {
        id: 'unexercised',
        environment: 'ci',
        reached: null,
        observation: 'unavailable' as const,
      },
    ],
    rawTraceSha256: 'd'.repeat(64),
  };
}

async function runCodeHealthPhase1StaticCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_PHASE1_STATIC_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase1/static', c.file);
    const fixture = await loadPhase1Fixture(abs);
    const report = buildStaticInventory({
      files: fixture.files,
      sourceText: fixture.sourceText,
      revision: fixture.revision,
    });
    const leads = mergeDynamicTrace(report, phase1UnexercisedTrace(fixture.revision));
    const details: string[] = [];
    const anyBlocked = leads.some((lead) => lead.status === 'blocked');
    if (anyBlocked !== c.expectedBlocked) {
      details.push(`  - 期望 blocked=${c.expectedBlocked}，实际 ${anyBlocked}（leads=${leads.length}）`);
    }
    for (const category of c.expectedCategories ?? []) {
      if (!report.categories.includes(category)) {
        details.push(`  - 缺 category ${category}（实际 ${report.categories.join(',')}）`);
      }
    }
    for (const expected of fixture.expectedReferences ?? []) {
      const found = report.references.some(
        (reference) =>
          reference.kind === expected.kind && reference.symbol === expected.symbol && reference.path === expected.path,
      );
      if (!found) {
        details.push(`  - 缺 reference ${expected.kind}:${expected.symbol}@${expected.path}`);
      }
    }
    for (const unavailable of fixture.expectedUnavailable ?? []) {
      if (!report.unknowns.includes(unavailable)) {
        details.push(`  - 期望 unavailable ${unavailable}（实际 ${report.unknowns.join(',')}）`);
      }
    }
    results.push({
      name: `code-health/phase1/static/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runCodeHealthPhase1GuardCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_PHASE1_GUARD_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase1/guards', c.file);
    const fixture = await loadPhase1Fixture(abs);
    const details: string[] = [];
    let lead = fixture.lead;
    if (lead === undefined && Array.isArray(fixture.files) && fixture.sourceText !== undefined) {
      const report = buildStaticInventory({
        files: fixture.files,
        sourceText: fixture.sourceText,
        revision: fixture.revision,
      });
      lead = mergeDynamicTrace(report, phase1UnexercisedTrace(fixture.revision))[0];
    }
    if (lead === undefined) {
      details.push('  - 无 candidate lead（静态候选选择可能回归）');
    } else {
      const context = fixture.context as FalsePositiveContext;
      const violations = checkFalsePositiveGuards(lead, context);
      const matched = c.expectedViolations === 'empty' ? violations.length === 0 : violations.length > 0;
      if (!matched) {
        details.push(`  - 期望 guard ${c.expectedViolations}，实际 ${violations.length} 条：${violations.join('; ')}`);
      }
      if (c.expectedClassification !== undefined && lead.classification !== c.expectedClassification) {
        details.push(`  - 期望 classification=${c.expectedClassification}，实际 ${lead.classification}`);
      }
    }
    results.push({
      name: `code-health/phase1/guards/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

async function runCodeHealthPhase1DynamicCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_PHASE1_DYNAMIC_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase1/dynamic', c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
    const fixture = parseJsonSafe<{ scenarios?: Phase1Scenario[] }>(await fs.readFile(abs, 'utf-8'));
    const details: string[] = [];
    const scenarios = fixture.scenarios;
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      details.push('  - scenarios 必须是非空数组');
    } else {
      for (const [index, scenario] of scenarios.entries()) {
        if (
          typeof scenario.id !== 'string' ||
          typeof scenario.environment !== 'string' ||
          typeof scenario.command !== 'string'
        ) {
          details.push(`  - scenario[${index}] 缺 id/environment/command`);
        }
      }
      const applicable = scenarios.filter((scenario) => classifyScenario(scenario, process.platform).applicable).length;
      if (c.expectedApplicable === 'at-least-one') {
        if (applicable < 1) details.push('  - 至少应有一个可在当前 host 运行的 scenario');
        if (!scenarios.some((scenario) => scenario.supported === false)) {
          details.push('  - 应含声明 supported=false 的环境（保证 unexercisedScenarios 非空）');
        }
      } else if (applicable !== c.expectedApplicable) {
        details.push(`  - 期望 applicable=${c.expectedApplicable}，实际 ${applicable}`);
      }
    }
    results.push({
      name: `code-health/phase1/dynamic/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

/** Phase 1 candidate review + deletion executor: the four apply states must stay fail-closed. */
async function runCodeHealthApplyCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_APPLY_CASES) {
    const abs = path.join(samplesDir, 'code-health/apply', c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
    const fixture = parseJsonSafe<CodeHealthApplyFixture>(await fs.readFile(abs, 'utf-8'));
    const details: string[] = [];
    let result: Awaited<ReturnType<typeof applyApproved>> | null = null;
    try {
      result = await applyApproved({
        candidate: fixture.candidate,
        approval: fixture.approval as ApprovalDecision,
        mode: fixture.mode,
        repositoryRoot: '.',
        currentRevision: fixture.candidate.revision,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (c.expected === 'approval-required') {
        if (!/HUMAN_APPROVAL_REQUIRED/.test(message))
          details.push(`  - 期望 HUMAN_APPROVAL_REQUIRED，实际：${message}`);
      } else if (c.expected === 'scope-mismatch') {
        if (!/SCOPE_MISMATCH|scope/i.test(message)) details.push(`  - 期望 scope fail-closed，实际：${message}`);
      } else {
        details.push(`  - 不期望抛错：${message}`);
      }
    }
    if (result !== null) {
      if (c.expected === 'approval-required' || c.expected === 'scope-mismatch') {
        details.push(`  - 期望 fail-closed 拒绝，实际返回 ${result.kind}`);
      } else if (result.kind !== 'patch-proposal') {
        details.push(`  - 期望受控 proposal，实际 ${result.kind}`);
      } else {
        if (!/\.patch$/.test(result.patchPath)) details.push(`  - patchPath 不受控：${result.patchPath}`);
        if (result.applied !== false) details.push('  - proposal 不得声称 applied');
        if (result.rollback?.executable !== true) details.push('  - rollback plan 必须 executable');
      }
    }
    if (c.expected === 'rollback-failure') {
      const executable = await executeRollback(fixture.candidate.rollback);
      if (executable !== false) details.push('  - 非可执行 rollback plan 误报成功');
    }
    results.push({
      name: `code-health/apply/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

/** Phase 2 gap matrix: discovery, matrix, and RED/GREEN evidence must all stay fail-closed. */
async function runCodeHealthGapCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_GAP_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase2', c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
    const fixture = parseJsonSafe<CodeHealthGapFixture>(await fs.readFile(abs, 'utf-8'));
    const details: string[] = [];
    let reasons: string[] = [];
    try {
      if (fixture.kind === 'discovery') {
        const matrix = findGaps(fixture.discovery as GapDiscoveryInput);
        if (matrix.coverageAuthorization !== false) {
          details.push('  - coverageAuthorization 必须恒为 false（coverage 仅信号）');
        }
        if (c.expectedKindCount !== undefined) {
          const kinds = new Set(matrix.rows.map((row) => row.kind));
          if (kinds.size !== c.expectedKindCount) {
            details.push(`  - 期望发现 ${c.expectedKindCount} 个维度，实际 ${kinds.size}（${[...kinds].join(', ')}）`);
          }
        }
        reasons = validateGapMatrix({ rows: matrix.rows }, fixture.ledger as CodeHealthLedger);
      } else if (fixture.kind === 'matrix') {
        reasons = validateGapMatrix({ rows: fixture.rows }, fixture.ledger as CodeHealthLedger);
      } else {
        reasons = validateRedGreenEvidence(
          fixture.gap as GapRow,
          fixture.results as CommandEvidence[],
          fixture.ledger as CodeHealthLedger,
        );
      }
    } catch (error) {
      reasons = [error instanceof Error ? error.message : String(error)];
    }
    const passed = c.expectedPassed ? reasons.length === 0 : reasons.length > 0;
    if (!passed) details.push(`  - 期望 valid=${c.expectedPassed}，实际 reasons=${JSON.stringify(reasons)}`);
    if (!c.expectedPassed && c.expectedReasonPatterns) {
      details.push(...matchReasonPatterns(reasons, c.expectedReasonPatterns));
    }
    results.push({
      name: `code-health/phase2/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

/**
 * Phase 3 protected test inventory: schema validity plus ledger-anchored removal review. A removal
 * claim must carry a computed equivalent survivor and fully explained pre/post facts; author/age never
 * decide.
 */
async function runCodeHealthTestInventoryCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_TEST_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase3', c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
    const document = parseJsonSafe(await fs.readFile(abs, 'utf-8'));
    const wrapped =
      typeof document === 'object' &&
      document !== null &&
      !Array.isArray(document) &&
      typeof (document as Record<string, unknown>).inventory === 'object' &&
      (document as Record<string, unknown>).inventory !== null &&
      !Array.isArray((document as Record<string, unknown>).inventory);
    const record = document as Record<string, unknown>;
    const review = wrapped
      ? { inventory: record.inventory, ledger: record.ledger }
      : { inventory: document as unknown };
    const schema = validateBySchema('code-health-test-inventory', review.inventory);
    const reasons = [...schema.errorMessages, ...evaluateTestInventory(review).violations];
    const details: string[] = [];
    const passed = c.expectedPassed ? reasons.length === 0 : reasons.length > 0;
    if (!passed) details.push(`  - 期望 valid=${c.expectedPassed}，实际 reasons=${JSON.stringify(reasons)}`);
    if (!c.expectedPassed && c.expectedReasonPatterns) {
      details.push(...matchReasonPatterns(reasons, c.expectedReasonPatterns));
    }
    results.push({
      name: `code-health/phase3/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

/**
 * Phase 4 duplicate cluster / abstraction guard: the cluster is recomputed from input + tracked-fact
 * authority, the stable call-site floor (positive `call-site:`/`contract:`/`regression:` facts, no
 * generated/dead/one-off exclusion) and the item-wise semantic proof decide `under-review` vs
 * `deferred`/`rejected`, and un-authorizing inputs (test-only, prose-only views, platform/lifecycle
 * differences, a shorter diff) must never yield an authorization. The IO entry points prove HEAD-tracked
 * provenance; this pure runner exercises the pure semantics only.
 */
async function runCodeHealthPhase4Cases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of CODE_HEALTH_PHASE4_CASES) {
    const abs = path.join(samplesDir, 'code-health/phase4', c.file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs is a self-test-registered fixture beneath samples/
    const fixture = parseJsonSafe<CodeHealthDuplicateFixture>(await fs.readFile(abs, 'utf-8'));
    const details: string[] = [];
    let violations: string[] = [];
    let status: DuplicateCluster['status'] | null = null;
    let authorized = false;
    if (fixture.expectedStatus !== c.expectedStatus) {
      details.push(`  - fixture.expectedStatus=${fixture.expectedStatus} 与用例声明 ${c.expectedStatus} 不一致`);
    }
    try {
      const cluster = clusterDuplicates(fixture.input, fixture.authority);
      status = cluster.status;
      const merged: DuplicateCluster = { ...cluster };
      if (fixture.review?.equivalenceProof !== undefined) merged.equivalenceProof = fixture.review.equivalenceProof;
      if (fixture.review?.maintenanceBenefit !== undefined)
        merged.maintenanceBenefit = fixture.review.maintenanceBenefit;
      if (fixture.review?.rollback !== undefined) merged.rollback = fixture.review.rollback;
      if (fixture.review?.redaction !== undefined) merged.redaction = fixture.review.redaction;
      if (fixture.proposal !== undefined) {
        violations = proveAbstraction(merged, fixture.proposal);
      }
      authorized =
        violations.length === 0 &&
        status === 'under-review' &&
        fixture.review?.equivalenceProof !== undefined &&
        fixture.proposal !== undefined;
    } catch (error) {
      violations = [error instanceof Error ? error.message : String(error)];
    }
    if (status !== c.expectedStatus) {
      details.push(`  - 期望 status=${c.expectedStatus}，实际 ${String(status)}`);
    }
    if (authorized !== c.expectAuthorized) {
      details.push(`  - 期望 authorized=${String(c.expectAuthorized)}，实际 ${String(authorized)}`);
    }
    if (c.expectedViolations.length > 0) details.push(...matchReasonPatterns(violations, c.expectedViolations));
    if (c.expectedViolations.length === 0 && violations.length > 0) {
      details.push(`  - 期望无 guard 违规，实际 ${JSON.stringify(violations)}`);
    }
    results.push({
      name: `code-health/phase4/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}

// -------------------- Metadata（版本号双写一致性） --------------------

async function runMetadataCheck(skillRoot: string): Promise<CaseResult[]> {
  const skill = await fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf-8');
  const meta = parseJsonSafe(await fs.readFile(path.join(skillRoot, 'skill-metadata.json'), 'utf-8')) as {
    version: string;
  };
  const versionMatch = skill.match(/^version:\s*(.+)$/m);
  const skillVersion = versionMatch?.[1]?.trim();
  const details: string[] = [];
  if (skillVersion === undefined) {
    details.push('  - SKILL.md frontmatter 缺 version 字段');
  } else if (skillVersion !== meta.version) {
    details.push(`  - 版本不一致: SKILL.md=${skillVersion}, metadata=${meta.version}`);
  }
  return [
    {
      name: 'metadata/version-consistency',
      passed: details.length === 0,
      description: 'SKILL.md frontmatter version 与 skill-metadata.json 一致',
      details: details.length > 0 ? details : undefined,
    },
  ];
}

// ==================== 入口 ====================

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Tests may provide an isolated samples root; normal CLI use keeps the bundled default.
  const samplesDir = process.env.WM_SELF_TEST_SAMPLES_DIR ?? path.join(here, '..', 'samples');
  const skillRoot = path.join(here, '..', '..');

  console.log('═'.repeat(60));
  console.log('校验逻辑自检（Self-Test）');
  console.log('═'.repeat(60));
  console.log(`样本目录      : ${samplesDir}`);
  console.log(`Verifier 用例 : ${VERIFIER_CASES.length}`);
  console.log(`Gate 用例     : ${GATE_CASES.length}`);
  console.log(`Graph 用例    : ${GRAPH_CASES.length}`);
  console.log(`SpecEnhance 用例 : ${SPEC_ENHANCE_CASES.length}`);
  console.log(`SpecStructure 用例 : ${SPEC_STRUCTURE_CASES.length}`);
  console.log(`SpecStructureOutOfScope 用例（内联，§8 M08）: ${SPEC_STRUCTURE_OUT_OF_SCOPE_CASES.length}`);
  console.log(`DesignEnhance 用例 : ${DESIGN_ENHANCE_CASES.length}`);
  console.log(`Phase2SpecStructure 用例 : ${PHASE2_SPEC_STRUCTURE_CASES.length}`);
  console.log(`OutlineEnhance 用例 : ${OUTLINE_ENHANCE_CASES.length}`);
  console.log(`Phase3SpecStructure 用例 : ${PHASE3_SPEC_STRUCTURE_CASES.length}`);
  console.log(`DetailedEnhance 用例 : ${DETAILED_ENHANCE_CASES.length}`);
  console.log(`Phase4SpecStructure 用例 : ${PHASE4_SPEC_STRUCTURE_CASES.length}`);
  console.log(`TLA 用例      : ${TLA_CASES.length}`);
  console.log(`Budget 用例   : ${BUDGET_CASES.length}`);
  console.log(`RunLog 用例   : ${RUN_LOG_CASES.length}`);
  console.log(`BudgetRunLog 用例 : ${BUDGET_RUN_LOG_CASES.length}`);
  console.log(`Maturity 用例 : ${MATURITY_CASES.length}`);
  console.log(`MaturityRunLog 用例 : ${MATURITY_RUN_LOG_CASES.length}`);
  console.log(`Checkpoint 用例: ${CHECKPOINT_CASES.length}`);
  console.log(`CheckpointLog loader 用例: ${CHECKPOINT_LOG_LOADER_CASES.length}`);
  console.log(`Code-TLA 用例 : ${CODE_TLA_CASES.length}`);
  console.log(`RootCause 用例 : ${ROOTCAUSE_CASES.length}`);
  console.log(`Schema 用例    : ${SCHEMA_CASES.length}`);
  console.log(`CodeHealth 用例: ${CODE_HEALTH_CASES.length}`);
  console.log(`CodeHealth Phase1 静态用例: ${CODE_HEALTH_PHASE1_STATIC_CASES.length}`);
  console.log(`CodeHealth Phase1 Guard 用例: ${CODE_HEALTH_PHASE1_GUARD_CASES.length}`);
  console.log(`CodeHealth Phase1 动态用例: ${CODE_HEALTH_PHASE1_DYNAMIC_CASES.length}`);
  console.log(`CodeHealth Apply 用例: ${CODE_HEALTH_APPLY_CASES.length}`);
  console.log(`CodeHealth Gap 用例: ${CODE_HEALTH_GAP_CASES.length}`);
  console.log(`CodeHealth Phase3 Test 用例: ${CODE_HEALTH_TEST_CASES.length}`);
  console.log(`CodeHealth Phase4 Duplicate 用例: ${CODE_HEALTH_PHASE4_CASES.length}`);
  console.log(`BDD 用例       : ${BDD_CASES.length}`);
  console.log(`Coverage 用例  : ${COVERAGE_CASES.length}`);
  console.log(`CoverageScope 用例 : ${COVERAGE_SCOPE_CASES.length}`);
  console.log(`DesignFog 用例 : ${DESIGN_FOG_CASES.length}`);
  console.log(`Exemption 用例 : ${EXEMPTION_CASES.length}`);
  console.log(`SignatureChain 用例 : ${SIGNATURE_CHAIN_CASES.length}`);
  console.log(`ArchiveIntegrity 用例: ${ARCHIVE_INTEGRITY_CASES.length}`);
  console.log(`Metadata 用例  : 1`);
  console.log(`PreventiveReview 用例: ${PREVENTIVE_REVIEW_CASES.length}`);
  console.log(`IcebergSweep 用例: ${ICEBERG_CASES.length}`);
  console.log(`TlaBddSync 用例: ${TLA_BDD_SYNC_CASES.length}`);
  console.log(`RoleDispatch 用例 : ${ROLE_DISPATCH_CASES.length}`);
  console.log(`StateMachine 用例 : ${STATE_MACHINE_CASES.length}`);
  console.log(`DesignContract 用例 : ${DESIGN_CONTRACT_CASES.length} 条`);
  console.log(`CodegraphQuery 用例 : ${CODEGRAPH_QUERY_CASES.length}`);
  console.log(`CodingPlan 用例 : ${CODING_PLAN_CASES.length}`);
  console.log(`UatPathMapping 用例 : ${UAT_PATH_MAPPING_CASES.length}`);
  console.log('─'.repeat(60));

  const [
    verifierResults,
    gateResults,
    graphResults,
    tlaResults,
    budgetResults,
    runLogResults,
    budgetRunLogResults,
    maturityResults,
    maturityRunLogResults,
    checkpointResults,
    checkpointLogLoaderResults,
    codeTlaResults,
    rootcauseResults,
    schemaResults,
    bddResults,
    coverageResults,
    coverageScopeResults,
    exemptionResults,
    signatureChainResults,
    archiveIntegrityResults,
    metadataResults,
    designContractResults,
    preventiveReviewResults,
    tlaBddSyncResults,
    roleDispatchResults,
    stateMachineResults,
    codegraphQueryResults,
    codingPlanResults,
    uatPathMappingResults,
    icebergResults,
    specEnhanceResults,
    specStructureResults,
    specStructureOutOfScopeResults,
    designEnhanceResults,
    phase2SpecStructureResults,
    outlineEnhanceResults,
    phase3SpecStructureResults,
    detailedEnhanceResults,
    phase4SpecStructureResults,
    codeHealthPhase1StaticResults,
    codeHealthPhase1GuardResults,
    codeHealthPhase1DynamicResults,
    designFogResults,
  ] = await Promise.all([
    runVerifierCases(samplesDir),
    runGateCases(samplesDir),
    runGraphCases(samplesDir),
    runSpecEnhanceCases(samplesDir),
    runSpecStructureCases(samplesDir),
    runSpecStructureOutOfScopeCases(),
    runDesignEnhanceCases(samplesDir),
    runPhase2SpecStructureCases(samplesDir),
    runOutlineEnhanceCases(samplesDir),
    runPhase3SpecStructureCases(samplesDir),
    runDetailedEnhanceCases(samplesDir),
    runPhase4SpecStructureCases(samplesDir),
    runTlaCases(samplesDir),
    runBudgetCases(samplesDir),
    runRunLogCases(samplesDir),
    runBudgetRunLogCases(samplesDir),
    runMaturityCases(samplesDir),
    runMaturityRunLogCases(samplesDir),
    runCheckpointCases(samplesDir),
    runCheckpointLogLoaderCases(samplesDir),
    runCodeTlaCases(samplesDir),
    runRootCauseCases(samplesDir),
    runSchemaCases(samplesDir),
    runBddCases(samplesDir),
    runCoverageCases(samplesDir),
    runCoverageScopeCases(samplesDir),
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
    runCodingPlanCases(samplesDir),
    runUatPathMappingCases(samplesDir),
    runIcebergCases(samplesDir),
    runCodeHealthPhase1StaticCases(samplesDir),
    runCodeHealthPhase1GuardCases(samplesDir),
    runCodeHealthPhase1DynamicCases(samplesDir),
    runDesignFogCases(samplesDir),
  ]);
  const runLogAppendResults = runRunLogAppendCases();
  const codeHealthResults = await runCodeHealthCases(samplesDir);
  const codeHealthApplyResults = await runCodeHealthApplyCases(samplesDir);
  const codeHealthGapResults = await runCodeHealthGapCases(samplesDir);
  const codeHealthTestResults = await runCodeHealthTestInventoryCases(samplesDir);
  const codeHealthPhase4Results = await runCodeHealthPhase4Cases(samplesDir);
  const all = [
    ...verifierResults,
    ...gateResults,
    ...graphResults,
    ...tlaResults,
    ...budgetResults,
    ...runLogResults,
    ...budgetRunLogResults,
    ...runLogAppendResults,
    ...maturityResults,
    ...maturityRunLogResults,
    ...checkpointResults,
    ...checkpointLogLoaderResults,
    ...codeTlaResults,
    ...rootcauseResults,
    ...schemaResults,
    ...codeHealthResults,
    ...bddResults,
    ...coverageResults,
    ...coverageScopeResults,
    ...exemptionResults,
    ...signatureChainResults,
    ...archiveIntegrityResults,
    ...metadataResults,
    ...designContractResults,
    ...preventiveReviewResults,
    ...tlaBddSyncResults,
    ...roleDispatchResults,
    ...stateMachineResults,
    ...codegraphQueryResults,
    ...codingPlanResults,
    ...uatPathMappingResults,
    ...icebergResults,
    ...specEnhanceResults,
    ...specStructureResults,
    ...specStructureOutOfScopeResults,
    ...designEnhanceResults,
    ...phase2SpecStructureResults,
    ...outlineEnhanceResults,
    ...phase3SpecStructureResults,
    ...detailedEnhanceResults,
    ...phase4SpecStructureResults,
    ...codeHealthPhase1StaticResults,
    ...codeHealthPhase1GuardResults,
    ...codeHealthPhase1DynamicResults,
    ...designFogResults,
    ...codeHealthApplyResults,
    ...codeHealthGapResults,
    ...codeHealthTestResults,
    ...codeHealthPhase4Results,
  ];

  const passedCount = all.filter((r) => r.passed).length;
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

  process.exitCode = failedCount === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('Self-Test 异常:', err);
  process.exitCode = 1;
});
