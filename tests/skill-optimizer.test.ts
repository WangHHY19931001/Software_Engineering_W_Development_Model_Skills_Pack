/**
 * SkillOptimizer 单元测试
 *
 * 覆盖：
 *   - Rollout → Reflect → Edit → Gate 训练循环
 *   - 失败 minibatch 触发演化
 *   - 验证门：skillLift <= 0 拒绝候选
 *   - 受保护区域过滤
 *   - editBudget 约束
 *   - extractFailedSubCriteria 工具函数
 */

import { describe, it, expect } from '@jest/globals';
import { SkillOptimizer, extractFailedSubCriteria, type RolloutExecutor, type GateEvaluator } from '../src/evolution/skill-optimizer.js';
import { MockLLMClient } from '../src/core/llm-client.js';
import { DEFAULT_META_SKILL_CONFIG } from '../src/core/meta-skill-config.js';
import type { RolloutEvidence, SkillEvolutionConfig, VerificationResult } from '../src/types/index.js';

/** 构造一个返回固定 evidence 的 rollout 执行器 */
function makeRolloutExecutor(evidence: RolloutEvidence): RolloutExecutor {
  return {
    async run(_taskId, _metaSkill) {
      return { ...evidence, timestamp: new Date().toISOString() };
    },
  };
}

/** 构造一个返回固定 skillLift 的 gate 评估器 */
function makeGateEvaluator(skillLift: number): GateEvaluator {
  return {
    async evaluate(_candidate, heldOutTaskIds) {
      return {
        skillLift,
        perTaskResults: heldOutTaskIds.map(id => ({ taskId: id, baselineMetric: 0.5, candidateMetric: 0.5 + skillLift })),
      };
    },
  };
}

/** 构造一个 optimizer LLM，返回指定的编辑 JSON */
function makeOptimizerLLM(editsJson: string): MockLLMClient {
  const client = new MockLLMClient({ model: 'mock' });
  // 覆盖 generate 方法返回指定 JSON
  (client as unknown as { generate: unknown }).generate = async () => ({
    text: editsJson,
    logits: undefined,
    supportsLogits: false,
  });
  return client;
}

function makeConfig(overrides: Partial<SkillEvolutionConfig> = {}): SkillEvolutionConfig {
  return {
    epochs: 1,
    batchSize: 2,
    editBudget: 500,
    validationGateEnabled: true,
    protectedRegions: [
      { id: 'src/types/index.ts', reason: '类型契约' },
      { id: '核心约束', reason: 'W 模型不可变骨架' },
    ],
    heldOutTaskIds: ['heldout-001', 'heldout-002'],
    optimizerLLM: { model: 'mock' },
    ...overrides,
  };
}

const failingEvidence: RolloutEvidence = {
  timestamp: new Date().toISOString(),
  taskId: 'train-1',
  qualityGatePassed: false,
  rtmCoverage: 50,
  phaseRollbacks: 2,
  verificationScores: [],
  failedSubCriteria: ['completeness', 'clarity'],
};

const successEvidence: RolloutEvidence = {
  timestamp: new Date().toISOString(),
  taskId: 'train-2',
  qualityGatePassed: true,
  rtmCoverage: 100,
  phaseRollbacks: 0,
  verificationScores: [],
  failedSubCriteria: [],
};

describe('SkillOptimizer.train', () => {
  it('无失败样本时不演化', async () => {
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM('[]'),
      rolloutExecutor: makeRolloutExecutor(successEvidence),
      gateEvaluator: makeGateEvaluator(0.5),
    });

    const result = await optimizer.train();
    expect(result.updated).toBe(false);
    expect(result.gateResults).toHaveLength(0);
  });

  it('验证门拒绝 skillLift <= 0 的候选', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'requirement.completeness.weight',
        content: '0.30',
        rationale: '提升完整性权重',
        budgetCost: 4,
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(-0.2), // 负 lift
    });

    const result = await optimizer.train();
    expect(result.updated).toBe(false);
    expect(result.gateResults).toHaveLength(1);
    expect(result.gateResults[0].accepted).toBe(false);
    expect(result.gateResults[0].rejectionReason).toContain('未严格大于 0');
  });

  it('验证门接受 skillLift > 0 的候选并更新配置', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'requirement.completeness.weight',
        content: '0.30',
        rationale: '提升完整性权重',
        budgetCost: 4,
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(0.3), // 正 lift
    });

    const result = await optimizer.train();
    expect(result.updated).toBe(true);
    expect(result.gateResults[0].accepted).toBe(true);
    // 配置已被更新：completeness 权重从 0.25 → 0.30
    expect(result.finalConfig.phases.requirement.subCriteria[0].weight).toBeCloseTo(0.30);
  });

  it('受保护区域的编辑被过滤', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/types/index.ts', // 受保护
        anchor: 'Project',
        content: 'hacked',
        rationale: '试图破坏类型',
        budgetCost: 1,
      },
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'requirement.repeatedTimes',
        content: '7',
        rationale: '增加评估次数',
        budgetCost: 1,
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(0.1),
    });

    const result = await optimizer.train();
    expect(result.updated).toBe(true);
    // repeatedTimes 已更新为 7
    expect(result.finalConfig.phases.requirement.repeatedTimes).toBe(7);
  });

  it('editBudget 超限时跳过该编辑', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'requirement.repeatedTimes',
        content: '7',
        rationale: '增加评估次数',
        budgetCost: 600, // 超过 budget 500
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig({ editBudget: 500 }),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(0.1),
    });

    const result = await optimizer.train();
    // 编辑被跳过，配置未变（repeatedTimes 仍为 5）
    expect(result.finalConfig.phases.requirement.repeatedTimes).toBe(5);
  });

  it('validationGateEnabled=false 时强制接受候选', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'design.varianceThreshold',
        content: '0.15',
        rationale: '放宽方差阈值',
        budgetCost: 4,
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig({ validationGateEnabled: false }),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(-1), // 即使负 lift 也接受
    });

    const result = await optimizer.train();
    expect(result.updated).toBe(true);
    expect(result.finalConfig.phases.design.varianceThreshold).toBeCloseTo(0.15);
  });

  it('训练日志记录各阶段', async () => {
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM('[]'),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(0.1),
    });

    const result = await optimizer.train();
    const phases = result.logs.map(l => l.phase);
    expect(phases).toContain('rollout');
    expect(phases).toContain('reflect');
  });
});

describe('extractFailedSubCriteria', () => {
  it('提取低于阈值的子标准', () => {
    const result: VerificationResult = {
      finalScore: 10,
      confidence: 0.8,
      qualityLevel: 'poor',
      subScores: { completeness: 8, clarity: 15, consistency: 11 },
    };
    const failed = extractFailedSubCriteria(result);
    expect(failed).toContain('completeness');
    expect(failed).toContain('consistency');
    expect(failed).not.toContain('clarity');
  });

  it('无 subScores 时返回空数组', () => {
    const result: VerificationResult = {
      finalScore: 15,
      confidence: 0.9,
      qualityLevel: 'good',
      subScores: {},
    };
    expect(extractFailedSubCriteria(result)).toEqual([]);
  });
});

describe('cloneMetaSkillConfig 在演化中的隔离性', () => {
  it('演化不污染 DEFAULT_META_SKILL_CONFIG', async () => {
    const editsJson = JSON.stringify([
      {
        op: 'replace',
        targetFile: 'src/core/meta-skill-config.ts',
        anchor: 'requirement.completeness.weight',
        content: '0.50',
        rationale: '测试隔离性',
        budgetCost: 4,
      },
    ]);
    const optimizer = new SkillOptimizer({
      config: makeConfig(),
      optimizerLLM: makeOptimizerLLM(editsJson),
      rolloutExecutor: makeRolloutExecutor(failingEvidence),
      gateEvaluator: makeGateEvaluator(0.5),
    });

    await optimizer.train();
    // 默认配置未被污染
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement.subCriteria[0].weight).toBeCloseTo(0.25);
  });
});
