/**
 * 门禁校验纯逻辑（Gate Logic）—— 技能包内门禁脚本的单点事实源
 *
 * 对应 SSoT §10.5「工件质量门」：
 *   - checkArtifactGate：工件质量门（RTM 覆盖率 100% 且四级测试全部通过）
 *
 * 设计原则：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块，
 *      保证技能包（w-model-dev/）可独立分发给 TRAE / Claude 等 Agent。
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用。
 *   3. 单点事实：所有「工件质量门是否通过」的判定均委托至此，避免逻辑漂移。
 *
 * 调用方：
 *   - CLI 脚本 check-artifact-gate.ts（供 Agent 直接执行）
 *
 * 注意：技能演化（SkillOpt / darwin-skill）相关的「技能验证门」已从技能包中移除。
 * 技能本身不再包含演化机制与轨迹分析，演化由外部工具完成：
 *   - skillopt（微软 SkillOpt）
 *   - https://github.com/alchaincyf/darwin-skill
 */

// ==================== 自包含类型形状 ====================
//
// 刻意只保留门禁判定所需字段。

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
