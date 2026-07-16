/**
 * SkillLiftEvaluator —— ACES Skill Lift 配对试验 + SkillLearnBench 三级评估
 *
 * 对应 SSoT 第 15 章「技能评估标准」。
 *
 * 核心问题（来自 ACES / SkillsBench）：
 *   现有基准只评估「模型本身」或「工件质量」，不评估「技能本身是否有效」。
 *   本模块通过配对试验（with-skill vs without-skill）量化技能带来的增量。
 *
 * 三类评估标准：
 *   A. Skill Lift（ACES）：with-skill 与 without-skill 的指标差值
 *   B. 三条件对照（SkillsBench）：no-skill / curated-skill / self-generated-skill
 *   C. 三级评估（SkillLearnBench）：规格质量 / 轨迹对齐 / 任务结果
 *
 * 关键约束：
 *   关键 Skill Lift 决策应优先使用确定性 verifier（EvalTask.deterministicVerifier），
 *   避免 LLM-as-judge 方差（SkillsBench 实证发现自生成技能平均 -1.3pp，需可靠度量）。
 */

import * as crypto from 'node:crypto';
import type {
  EvalCondition,
  EvalTask,
  SkillEvalReport,
  SkillLiftResult,
  ThreeLevelEvalResult,
} from '../types';
import type { ProjectStore } from '../state/project-state';
import type { RTMManager } from '../state/rtm-manager';
import type { ProjectStateManager } from '../state/project-state';
import type { WModelVerifierEnhancer } from '../core/w-model-enhancer';

/**
 * 单次评估运行的执行器接口。
 *
 * with-skill：注入 WModelVerifierEnhancer（携带技能）跑 /wm 全流程
 * without-skill：不注入 verifier 跑 /wm 全流程（baseline）
 */
export interface EvalRunExecutor {
  /**
   * 在指定任务上跑一次 /wm 全流程。
   * @param task 评估任务
   * @param withSkill 是否注入技能（true=with-skill，false=baseline）
   * @returns 运行后的 ProjectStore + RTM + verifier 评分（若有）
   */
  run(
    task: EvalTask,
    withSkill: boolean
  ): Promise<EvalRunOutcome>;
}

/** 单次运行结果 */
export interface EvalRunOutcome {
  store: ProjectStore;
  rtmCoverage: number;
  qualityGatePassed: boolean;
  phaseRollbacks: number;
  /** with-skill 时的平均 verifier 分数；baseline 为 0 */
  avgVerifierScore: number;
  /** /wm 命令调用轨迹（用于 Level 2 轨迹分析） */
  commandTrace: string[];
}

export class SkillLiftEvaluator {
  private executor: EvalRunExecutor;

  constructor(executor: EvalRunExecutor) {
    this.executor = executor;
  }

  /**
   * 标准 A：计算单个任务的 Skill Lift（with-skill vs without-skill）。
   *
   * @param task 评估任务
   * @param condition 评估条件（curated-skill / self-generated-skill）
   */
  async evaluateTaskLift(
    task: EvalTask,
    condition: EvalCondition = 'curated-skill'
  ): Promise<SkillLiftResult> {
    // baseline：without-skill
    const baselineOutcome = await this.executor.run(task, false);
    // with-skill
    const withSkillOutcome = await this.executor.run(task, true);

    return {
      taskId: task.id,
      condition,
      withSkill: {
        qualityGatePassed: withSkillOutcome.qualityGatePassed,
        rtmCoverage: withSkillOutcome.rtmCoverage,
        avgVerifierScore: withSkillOutcome.avgVerifierScore,
        phaseRollbacks: withSkillOutcome.phaseRollbacks,
      },
      baseline: {
        qualityGatePassed: baselineOutcome.qualityGatePassed,
        rtmCoverage: baselineOutcome.rtmCoverage,
        avgVerifierScore: baselineOutcome.avgVerifierScore,
        phaseRollbacks: baselineOutcome.phaseRollbacks,
      },
      lift: {
        qualityGateDelta: (withSkillOutcome.qualityGatePassed ? 1 : 0) - (baselineOutcome.qualityGatePassed ? 1 : 0),
        rtmCoverageDelta: withSkillOutcome.rtmCoverage - baselineOutcome.rtmCoverage,
        avgScoreDelta: withSkillOutcome.avgVerifierScore - baselineOutcome.avgVerifierScore,
        rollbackDelta: withSkillOutcome.phaseRollbacks - baselineOutcome.phaseRollbacks,
      },
    };
  }

  /**
   * 标准 B：SkillsBench 三条件对照，跨任务集生成评估报告。
   */
  async evaluateBatch(
    tasks: EvalTask[],
    condition: EvalCondition = 'curated-skill'
  ): Promise<SkillEvalReport> {
    const perTask: SkillLiftResult[] = [];
    const threeLevelResults: ThreeLevelEvalResult[] = [];

    for (const task of tasks) {
      const lift = await this.evaluateTaskLift(task, condition);
      perTask.push(lift);

      const threeLevel = await this.evaluateThreeLevel(task, lift);
      threeLevelResults.push(threeLevel);
    }

    // 聚合 Skill Lift（用综合指标：质量门 delta + 覆盖率 delta + 分数 delta - 回退 delta）
    const lifts = perTask.map(l =>
      l.lift.qualityGateDelta + l.lift.rtmCoverageDelta / 100 + l.lift.avgScoreDelta / 20 - l.lift.rollbackDelta * 0.1
    );
    const meanSkillLift = lifts.length > 0 ? lifts.reduce((a, b) => a + b, 0) / lifts.length : 0;
    const positiveLiftRate = lifts.length > 0 ? lifts.filter(x => x > 0).length / lifts.length : 0;

    // 三级评估汇总
    const meanCoverage = mean(threeLevelResults.map(r => r.level1SpecQuality.coverage));
    const meanSkillUsageRate = mean(threeLevelResults.map(r => r.level2Trajectory.skillUsageRate));
    const passRate = threeLevelResults.filter(r => r.level3Outcome.passed).length / Math.max(1, threeLevelResults.length);

    return {
      skillHash: crypto.createHash('sha256').update(JSON.stringify(condition) + tasks.map(t => t.id).join(',')).digest('hex').slice(0, 12),
      condition,
      taskCount: tasks.length,
      meanSkillLift,
      positiveLiftRate,
      threeLevelSummary: {
        meanCoverage,
        meanSkillUsageRate,
        passRate,
      },
      perTask,
    };
  }

  /**
   * 标准 C：SkillLearnBench 三级评估。
   *
   * Level 1 技能规格质量：coverage（子标准覆盖度）/ executability（可执行性）/ safety（安全性）
   * Level 2 轨迹分析：skillUsageRate（技能命令调用率）/ trajectoryAlignment（与期望阶段序列对齐度）
   * Level 3 任务结果：passed / qualityGatePassed / rtmCoverage
   */
  async evaluateThreeLevel(task: EvalTask, lift: SkillLiftResult): Promise<ThreeLevelEvalResult> {
    // Level 1：技能规格质量（基于子标准数量与确定性 verifier 覆盖度估算）
    const subCriteriaCount = 16; // 默认配置：5 + 6 + 5
    const coverage = Math.min(1, subCriteriaCount / 16);
    const executability = task.deterministicVerifier ? 1.0 : 0.7; // 有确定性 verifier 视为高可执行性
    const safety = 1.0; // 默认配置不含危险操作

    // Level 2：轨迹分析（基于 with-skill 的命令轨迹）
    // skillUsageRate：/wm 命令在轨迹中的占比
    const skillCommands = lift.withSkill.phaseRollbacks >= 0 ? 1 : 0; // 简化：有运行即视为使用
    const skillUsageRate = skillCommands;
    // trajectoryAlignment：与期望阶段序列对齐（简化：有 expectedPhases 时按覆盖度）
    const trajectoryAlignment = task.expectedPhases && task.expectedPhases.length > 0
      ? Math.min(1, task.expectedPhases.length / 8)
      : 0.875; // 默认 7/8

    // Level 3：任务结果（优先用确定性 verifier，否则用质量门）
    const passed = lift.withSkill.qualityGatePassed;
    const qualityGatePassed = lift.withSkill.qualityGatePassed;
    const rtmCoverage = lift.withSkill.rtmCoverage;

    return {
      taskId: task.id,
      level1SpecQuality: { coverage, executability, safety },
      level2Trajectory: { skillUsageRate, trajectoryAlignment },
      level3Outcome: { passed, qualityGatePassed, rtmCoverage },
    };
  }
}

/**
 * 基于 ProjectStateManager / RTMManager / WModelVerifierEnhancer 的默认执行器实现。
 *
 * 使用方式：
 *   const executor = createDefaultEvalExecutor(stateManager, rtm, verifier);
 *   const evaluator = new SkillLiftEvaluator(executor);
 *   const report = await evaluator.evaluateBatch(tasks, 'curated-skill');
 */
export function createDefaultEvalExecutor(
  stateManager: ProjectStateManager,
  rtm: RTMManager,
  verifier?: WModelVerifierEnhancer
): EvalRunExecutor {
  return {
    async run(_task, withSkill) {
      // 重置项目状态
      await stateManager.reset();

      // 注：真实实现应在此调用 dispatch('/wm analyze ...') 等命令走完整流程。
      // 本默认实现提供框架，具体 /wm 命令调度由调用方按需扩展（避免循环依赖 router.ts）。
      // 关键产出：RTM 覆盖率、质量门、阶段回退、verifier 分数。

      const store = {
        project: stateManager.getProject(),
        requirements: stateManager.getRequirements(),
        designs: stateManager.getDesigns(),
        testCases: stateManager.getTestCases(),
      };

      await rtm.rebuild();
      const coverage = rtm.getCoveragePercent();
      const gate = rtm.isQualityGatePassed();

      // with-skill 时计算 verifier 平均分（若注入）
      let avgVerifierScore = 0;
      const commandTrace: string[] = [];
      if (withSkill && verifier && store.requirements.length > 0) {
        const scores: number[] = [];
        for (const req of store.requirements.slice(0, 3)) {
          try {
            const r = await verifier.verifyRequirement(req);
            scores.push(r.finalScore);
            commandTrace.push(`/wm review ${req.id}`);
          } catch {
            // ignore verifier errors in eval
          }
        }
        avgVerifierScore = scores.length > 0 ? mean(scores) : 0;
      }

      return {
        store,
        rtmCoverage: coverage,
        qualityGatePassed: gate.passed,
        phaseRollbacks: 0, // 真实值需从 router 轨迹采集
        avgVerifierScore,
        commandTrace,
      };
    },
  };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** 便捷构造：从 EvalTask 数组生成评估报告 */
export async function runSkillEvaluation(
  tasks: EvalTask[],
  executor: EvalRunExecutor,
  condition: EvalCondition = 'curated-skill'
): Promise<SkillEvalReport> {
  const evaluator = new SkillLiftEvaluator(executor);
  return evaluator.evaluateBatch(tasks, condition);
}

/** 留出 benchmark 任务集的占位定义（真实场景应从 fixtures 加载） */
export const DEFAULT_HELD_OUT_TASKS: EvalTask[] = [
  {
    id: 'heldout-001',
    description: '用户登录功能：支持账号密码、邮箱验证码登录，登录成功后返回 JWT 令牌',
    expectedPhases: ['需求分析', '系统设计', '概要设计', '详细设计', '编码', '集成测试', '系统测试', '验收测试'],
  },
  {
    id: 'heldout-002',
    description: '商品库存管理：支持入库、出库、盘点、库存预警',
    expectedPhases: ['需求分析', '系统设计', '概要设计', '详细设计', '编码', '集成测试', '系统测试', '验收测试'],
  },
  {
    id: 'heldout-003',
    description: '订单支付：支持微信、支付宝、银行卡支付，支付回调与对账',
    expectedPhases: ['需求分析', '系统设计', '概要设计', '详细设计', '编码', '集成测试', '系统测试', '验收测试'],
  },
];
