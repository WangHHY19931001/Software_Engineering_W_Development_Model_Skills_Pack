/**
 * 门禁校验纯逻辑（Gate Logic）—— 技能包内门禁脚本的单点事实源
 *
 * 对应 SSoT §10.5「两类质量门」：
 *   - checkArtifactGate：工件质量门（RTM 覆盖率 100% 且四级测试全部通过）
 *   - checkSkillGate   ：技能验证门（留出集 meanSkillLift > 0，严格正提升）
 *
 * 设计原则：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import src/，
 *      保证技能包（w-model-dev/）可独立分发给 TRAE / Claude 等 Agent。
 *   2. 纯函数：无 I/O、无副作用，便于 src/ 反向复用、便于测试。
 *   3. 单点事实：src/state/rtm-manager.ts 与 src/evolution/skill-optimizer.ts
 *      的门禁判定均委托至此，避免逻辑重复漂移。
 *
 * 调用方：
 *   - CLI 脚本 check-artifact-gate.ts / check-skill-gate.ts（供 Agent 直接执行）
 *   - src/ 编程式 API（RTMManager.isQualityGatePassed / SkillOptimizer.evaluateGate）
 */

// ==================== 自包含类型形状 ====================
//
// 刻意只保留门禁判定所需字段；结构上与 src/types 的 RTMMatrix / SkillEvalReport
// 兼容（src/ 的完整类型可直接传入，多余字段被结构性类型忽略）。

export interface RTMMatrixShape {
  rows: Array<{
    requirementId: string;
    coverageStatus: '100%' | '部分' | '待覆盖';
  }>;
  executionSummary: {
    unitTest: TestSummaryShape;
    integrationTest: TestSummaryShape;
    systemTest: TestSummaryShape;
    acceptanceTest: TestSummaryShape;
  };
}

export interface TestSummaryShape {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  coverage: number;
}

export interface SkillEvalReportShape {
  /** 留出集上的平均 Skill Lift（候选 - 基线） */
  meanSkillLift: number;
  /** 正向 lift 任务占比（0-1） */
  positiveLiftRate: number;
  /** 评估任务数 */
  taskCount: number;
  /** 评估条件（no-skill / curated-skill / self-generated-skill） */
  condition?: string;
}

// ==================== 工件质量门（Artifact Gate） ====================

export interface ArtifactGateResult {
  passed: boolean;
  reasons: string[];
  /** 整体 RTM 覆盖率（需求维度，0-100） */
  coveragePercent: number;
}

/**
 * 工件质量门：RTM 覆盖率 100% 且四级测试（单元 / 集成 / 系统 / 验收）全部通过。
 *
 * 判定规则（与 SSoT §10.5 一致）：
 *   - 覆盖率 < 100% → 失败，reason 记录当前覆盖率
 *   - 任一测试类型 total=0 → 失败（无用例）
 *   - 任一测试类型 failed>0 → 失败
 *   - 任一测试类型 pending>0 → 失败（存在待执行用例）
 *   - 全部满足 → 通过
 *
 * 关键约束（SSoT §10.5）：本门禁的有效性依赖 `/wm test` 真实回填结果，
 * 不得自动标记测试通过。
 */
export function checkArtifactGate(
  matrix: RTMMatrixShape | null | undefined,
): ArtifactGateResult {
  if (!matrix) {
    return { passed: false, reasons: ['RTM 未初始化'], coveragePercent: 0 };
  }

  const reasons: string[] = [];

  // 覆盖率（需求维度）
  const total = matrix.rows.length;
  const covered = matrix.rows.filter(r => r.coverageStatus === '100%').length;
  const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 0;

  if (coveragePercent < 100) {
    reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  }

  // 四级测试执行状态
  const types: Array<{ name: string; s: TestSummaryShape }> = [
    { name: '单元测试', s: matrix.executionSummary.unitTest },
    { name: '集成测试', s: matrix.executionSummary.integrationTest },
    { name: '系统测试', s: matrix.executionSummary.systemTest },
    { name: '验收测试', s: matrix.executionSummary.acceptanceTest },
  ];

  for (const { name, s } of types) {
    if (s.total === 0) {
      reasons.push(`${name}: 无用例`);
    } else if (s.failed > 0) {
      reasons.push(`${name}: ${s.failed} 个失败`);
    } else if (s.pending > 0) {
      reasons.push(`${name}: ${s.pending} 个待执行`);
    }
  }

  return { passed: reasons.length === 0, reasons, coveragePercent };
}

// ==================== 技能验证门（Skill Validation Gate） ====================

/**
 * 技能验证门的最小输入形状。
 *
 * 刻意只要求 `meanSkillLift`：判定本身只依赖该字段。完整的
 * `SkillEvalReportShape`（含 positiveLiftRate / taskCount）结构上满足本类型，
 * 可直接传入；编程式调用方（如 SkillOptimizer.evaluateGate）仅有 skillLift
 * 数值时也可构造 `{ meanSkillLift }` 传入。
 */
export interface SkillGateInput {
  meanSkillLift: number;
}

export interface SkillGateResult {
  /** 是否通过（严格正提升才通过） */
  accepted: boolean;
  /** 通过 / 拒绝原因（人类可读） */
  reason: string;
  /** 留出集平均 Skill Lift */
  skillLift: number;
}

/**
 * 技能验证门：候选技能在留出集上的 meanSkillLift 必须**严格大于 0** 才被采纳。
 *
 * 关键约束（SSoT §14.5，SkillsBench 实证）：
 *   - 模型自生成技能平均 -1.3pp，必须搭配验证门才能采纳候选
 *   - `<= 0` 的候选被拒绝并记录原因，当前配置保留不变
 *   - 生产环境 `validationGateEnabled` 必须为 true
 *
 * @param report 只需提供 `meanSkillLift`；完整的 SkillEvalReportShape 亦可直接传入
 */
export function checkSkillGate(
  report: SkillGateInput | null | undefined,
): SkillGateResult {
  if (!report) {
    return { accepted: false, reason: '评估报告缺失', skillLift: 0 };
  }

  const skillLift = report.meanSkillLift;
  const accepted = skillLift > 0;

  return {
    accepted,
    skillLift,
    reason: accepted
      ? `通过：meanSkillLift=${skillLift.toFixed(3)} > 0`
      : `拒绝：meanSkillLift=${skillLift.toFixed(3)} 未严格大于 0`,
  };
}
