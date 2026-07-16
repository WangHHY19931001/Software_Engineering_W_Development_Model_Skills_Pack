/**
 * SkillLiftEvaluator 单元测试
 *
 * 覆盖：
 *   - evaluateTaskLift：with-skill vs without-skill 配对差值
 *   - evaluateBatch：跨任务集聚合 + 三级评估
 *   - Skill Lift 方向性（正 / 负 / 零）
 */

import { describe, it, expect } from '@jest/globals';
import { SkillLiftEvaluator, type EvalRunExecutor, type EvalRunOutcome } from '../src/eval/skill-lift.js';
import type { EvalTask, ProjectStore } from '../src/types/index.js';

function makeOutcome(overrides: Partial<EvalRunOutcome> = {}): EvalRunOutcome {
  return {
    store: { project: { id: 'P1', name: 't', description: '', status: '需求分析', techStack: { frontend: [], backend: [], database: [], others: [] }, createdAt: '', updatedAt: '' }, requirements: [], designs: [], testCases: [] } as ProjectStore,
    rtmCoverage: 100,
    qualityGatePassed: true,
    phaseRollbacks: 0,
    avgVerifierScore: 15,
    commandTrace: [],
    ...overrides,
  };
}

/** 构造执行器：withSkill=true 返回 withOutcome，false 返回 baselineOutcome */
function makeExecutor(withOutcome: EvalRunOutcome, baselineOutcome: EvalRunOutcome): EvalRunExecutor {
  return {
    async run(_task, withSkill) {
      return withSkill ? { ...withOutcome } : { ...baselineOutcome };
    },
  };
}

const sampleTask: EvalTask = {
  id: 'task-001',
  description: '测试任务',
  expectedPhases: ['需求分析', '系统设计', '编码', '验收测试'],
};

describe('SkillLiftEvaluator.evaluateTaskLift', () => {
  it('with-skill 优于 baseline 时 lift 为正', async () => {
    const evaluator = new SkillLiftEvaluator(makeExecutor(
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 100, avgVerifierScore: 16, phaseRollbacks: 0 }),
      makeOutcome({ qualityGatePassed: false, rtmCoverage: 60, avgVerifierScore: 0, phaseRollbacks: 2 }),
    ));

    const lift = await evaluator.evaluateTaskLift(sampleTask);
    expect(lift.lift.qualityGateDelta).toBe(1);
    expect(lift.lift.rtmCoverageDelta).toBe(40);
    expect(lift.lift.avgScoreDelta).toBe(16);
    expect(lift.lift.rollbackDelta).toBe(-2);
  });

  it('with-skill 劣于 baseline 时 lift 为负', async () => {
    const evaluator = new SkillLiftEvaluator(makeExecutor(
      makeOutcome({ qualityGatePassed: false, rtmCoverage: 40, avgVerifierScore: 8, phaseRollbacks: 3 }),
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 100, avgVerifierScore: 0, phaseRollbacks: 0 }),
    ));

    const lift = await evaluator.evaluateTaskLift(sampleTask);
    expect(lift.lift.qualityGateDelta).toBe(-1);
    expect(lift.lift.rtmCoverageDelta).toBe(-60);
    expect(lift.lift.rollbackDelta).toBe(3);
  });

  it('两边相等时 lift 为 0', async () => {
    const evaluator = new SkillLiftEvaluator(makeExecutor(
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 80, avgVerifierScore: 12, phaseRollbacks: 1 }),
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 80, avgVerifierScore: 12, phaseRollbacks: 1 }),
    ));

    const lift = await evaluator.evaluateTaskLift(sampleTask);
    expect(lift.lift.qualityGateDelta).toBe(0);
    expect(lift.lift.rtmCoverageDelta).toBe(0);
  });
});

describe('SkillLiftEvaluator.evaluateBatch', () => {
  it('聚合多任务 Skill Lift', async () => {
    const evaluator = new SkillLiftEvaluator(makeExecutor(
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 100, avgVerifierScore: 16, phaseRollbacks: 0 }),
      makeOutcome({ qualityGatePassed: false, rtmCoverage: 50, avgVerifierScore: 0, phaseRollbacks: 2 }),
    ));

    const report = await evaluator.evaluateBatch([sampleTask, { ...sampleTask, id: 'task-002' }], 'curated-skill');
    expect(report.taskCount).toBe(2);
    expect(report.meanSkillLift).toBeGreaterThan(0);
    expect(report.positiveLiftRate).toBe(1);
    expect(report.threeLevelSummary.passRate).toBe(1);
  });

  it('三级评估包含 Level 1/2/3 字段', async () => {
    const evaluator = new SkillLiftEvaluator(makeExecutor(
      makeOutcome({ qualityGatePassed: true, rtmCoverage: 100, avgVerifierScore: 16, phaseRollbacks: 0 }),
      makeOutcome({ qualityGatePassed: false, rtmCoverage: 50, avgVerifierScore: 0, phaseRollbacks: 2 }),
    ));

    const lift = await evaluator.evaluateTaskLift(sampleTask);
    const threeLevel = await evaluator.evaluateThreeLevel(sampleTask, lift);
    expect(threeLevel.level1SpecQuality.coverage).toBeGreaterThan(0);
    expect(threeLevel.level1SpecQuality.coverage).toBeLessThanOrEqual(1);
    expect(threeLevel.level2Trajectory.skillUsageRate).toBeGreaterThanOrEqual(0);
    expect(threeLevel.level3Outcome.passed).toBe(true);
  });
});

describe('DEFAULT_HELD_OUT_TASKS', () => {
  it('包含 3 个留出任务', async () => {
    const { DEFAULT_HELD_OUT_TASKS } = await import('../src/eval/skill-lift.js');
    expect(DEFAULT_HELD_OUT_TASKS).toHaveLength(3);
    expect(DEFAULT_HELD_OUT_TASKS[0].id).toBe('heldout-001');
  });
});
