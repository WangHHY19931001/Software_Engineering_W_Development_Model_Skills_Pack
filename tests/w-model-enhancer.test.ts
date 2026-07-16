/**
 * WModelVerifierEnhancer 单元测试
 *
 * 覆盖：
 *   - verifyRequirement / verifyDesign / verifyTestCaseQuality 三维度验证
 *   - rankTestCasesByPriority PPT 排序
 *   - score 单次评分
 *   - determineQualityLevel 静态方法
 *   - getEngine 暴露底层引擎
 */

import { describe, it, expect } from '@jest/globals';
import { WModelVerifierEnhancer } from '../src/core/w-model-enhancer.js';
import { MockLLMClient } from '../src/core/llm-client.js';
import { RubricGenerator } from '../src/core/rubric-generator.js';
import type { VerifierConfig, Requirement, Design, TestCase, LLMClient, LLMResponse, LLMGenerateOptions } from '../src/types/index.js';

function makeVerifier(overrides: Partial<VerifierConfig> = {}, clientOpts: { supportsLogits?: boolean; scoreLabel?: string; mockLogits?: number[][] } = {}): WModelVerifierEnhancer {
  const config: VerifierConfig = {
    llm: { model: 'mock' },
    temperature: 0.3,
    fallbackStrategy: 'text-parse',
    pptRanking: { enabled: true, defaultPivotCount: 3 },
    ...overrides,
  };
  const client = new MockLLMClient({
    model: 'mock',
    supportsLogits: clientOpts.supportsLogits ?? false,
    scoreLabel: clientOpts.scoreLabel,
    mockLogits: clientOpts.mockLogits,
  });
  return new WModelVerifierEnhancer(config, client);
}

const sampleReq: Requirement = {
  id: 'REQ-001',
  projectId: 'P1',
  title: '用户登录',
  description: '系统应支持账号密码登录',
  type: '功能需求',
  priority: '高',
  acceptanceCriteria: ['输入正确凭证成功登录', '错误凭证提示错误'],
  testCases: [],
  status: '待开发',
};

const sampleDesign: Design = {
  id: 'DESIGN-001',
  projectId: 'P1',
  type: '系统设计',
  content: '分层架构',
  diagrams: [],
  testCases: [],
  createdAt: new Date().toISOString(),
};

const sampleTC: TestCase = {
  id: 'UT-001',
  projectId: 'P1',
  type: '单元测试',
  title: '登录测试',
  description: '验证登录逻辑',
  steps: ['输入用户名', '输入密码', '点击登录'],
  expectedResult: '登录成功',
  status: '待执行',
  priority: '高',
};

describe('WModelVerifierEnhancer - verifyRequirement', () => {
  it('应返回完整验证结果（含子标准分数）', async () => {
    const v = makeVerifier({}, { scoreLabel: 'N' }); // N 对应 14 分
    const result = await v.verifyRequirement(sampleReq);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.subScores).toHaveProperty('completeness');
    expect(result.subScores).toHaveProperty('clarity');
    expect(result.subScores).toHaveProperty('consistency');
    expect(result.subScores).toHaveProperty('traceability');
    expect(result.subScores).toHaveProperty('feasibility');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(['excellent', 'good', 'acceptable', 'poor', 'unacceptable']).toContain(result.qualityLevel);
  });

  it('logits 路径应正常工作', async () => {
    // 构造 logits：M（idx=12, 分数=13）权重最大
    const logits: number[][] = [[]];
    for (let i = 0; i < 20; i++) {
      logits[0][i] = i === 12 ? 100 : 0;
    }
    const v = makeVerifier(
      { fallbackStrategy: 'throw' }, // 强制要求 logits 路径
      { supportsLogits: true, mockLogits: logits }
    );
    const result = await v.verifyRequirement(sampleReq);
    expect(result.finalScore).toBeCloseTo(13, 0);
  });
});

describe('WModelVerifierEnhancer - verifyDesign', () => {
  it('应返回 6 个子标准分数', async () => {
    const v = makeVerifier({}, { scoreLabel: 'P' }); // P 对应 16 分
    const result = await v.verifyDesign(sampleDesign);
    expect(result.subScores).toHaveProperty('arch-clarity');
    expect(result.subScores).toHaveProperty('interface-completeness');
    expect(result.subScores).toHaveProperty('scalability');
    expect(result.subScores).toHaveProperty('performance');
    expect(result.subScores).toHaveProperty('security');
    expect(result.subScores).toHaveProperty('testability');
    expect(result.qualityLevel).toBe('good');
  });
});

describe('WModelVerifierEnhancer - verifyTestCaseQuality', () => {
  it('应返回 5 个子标准分数', async () => {
    const v = makeVerifier({}, { scoreLabel: 'Q' }); // Q 对应 17 分
    const result = await v.verifyTestCaseQuality(sampleTC);
    expect(result.subScores).toHaveProperty('coverage');
    expect(result.subScores).toHaveProperty('boundary-handling');
    expect(result.subScores).toHaveProperty('exception-handling');
    expect(result.subScores).toHaveProperty('clarity');
    expect(result.subScores).toHaveProperty('maintainability');
  });
});

describe('WModelVerifierEnhancer - rankTestCasesByPriority', () => {
  it('应返回排序结果', async () => {
    const v = makeVerifier({}, { scoreLabel: 'J' });
    const tcs: TestCase[] = [
      { ...sampleTC, id: 'UT-001' },
      { ...sampleTC, id: 'UT-002' },
      { ...sampleTC, id: 'UT-003' },
    ];
    const ranking = await v.rankTestCasesByPriority(tcs);
    expect(ranking.ranking).toHaveLength(3);
    expect(ranking.totalComparisons).toBeGreaterThan(0);
    expect(ranking.complexity).toContain('O(N');
  });

  it('空列表返回空结果', async () => {
    const v = makeVerifier({}, { scoreLabel: 'J' });
    const ranking = await v.rankTestCasesByPriority([]);
    expect(ranking.ranking).toHaveLength(0);
  });

  it('未配置 pptRanking 时使用默认 pivotCount=5', async () => {
    // 不传 pptRanking 配置
    const config: VerifierConfig = {
      llm: { model: 'mock' },
      fallbackStrategy: 'text-parse',
    };
    const v = new WModelVerifierEnhancer(config, new MockLLMClient({ model: 'mock', scoreLabel: 'J' }));
    const tcs: TestCase[] = [
      { ...sampleTC, id: 'UT-001' },
      { ...sampleTC, id: 'UT-002' },
      { ...sampleTC, id: 'UT-003' },
      { ...sampleTC, id: 'UT-004' },
      { ...sampleTC, id: 'UT-005' },
      { ...sampleTC, id: 'UT-006' },
    ];
    const ranking = await v.rankTestCasesByPriority(tcs);
    // 默认 pivotCount=5
    expect(ranking.complexity).toBe('O(N * 5)');
  });
});

describe('WModelVerifierEnhancer - score', () => {
  it('单次评分应返回数字', async () => {
    const v = makeVerifier({}, { scoreLabel: 'T' }); // 满分
    const score = await v.score({ foo: 'bar' }, '评估内容质量');
    expect(score).toBeGreaterThan(15);
    expect(score).toBeLessThanOrEqual(20);
  });
});

describe('WModelVerifierEnhancer - determineQualityLevel (static)', () => {
  it('静态方法应正常工作', () => {
    expect(WModelVerifierEnhancer.determineQualityLevel(20)).toBe('excellent');
    expect(WModelVerifierEnhancer.determineQualityLevel(15)).toBe('good');
    expect(WModelVerifierEnhancer.determineQualityLevel(11)).toBe('acceptable');
    expect(WModelVerifierEnhancer.determineQualityLevel(7)).toBe('poor');
    expect(WModelVerifierEnhancer.determineQualityLevel(3)).toBe('unacceptable');
  });
});

describe('WModelVerifierEnhancer - getEngine', () => {
  it('应暴露底层引擎', () => {
    const v = makeVerifier({}, { scoreLabel: 'J' });
    const engine = v.getEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.computeContinuousScore).toBe('function');
  });
});

describe('WModelVerifierEnhancer - 无 LLMClient 构造', () => {
  it('不传 llmClient 时应使用默认 MockLLMClient', async () => {
    const config: VerifierConfig = {
      llm: { model: 'mock' },
      fallbackStrategy: 'text-parse',
    };
    // 不传第二个参数，走 new LLMVerifierEngine(config) 分支
    const v = new WModelVerifierEnhancer(config);
    const engine = v.getEngine();
    expect(engine).toBeDefined();
    // 默认 MockLLMClient 无 scoreLabel，返回 'J'（中等评分）
    const score = await v.score({ foo: 'bar' }, '评估');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(20);
  });

  it('无 llmClient 时 verifyRequirement 仍可工作', async () => {
    const config: VerifierConfig = {
      llm: { model: 'mock' },
      fallbackStrategy: 'text-parse',
    };
    const v = new WModelVerifierEnhancer(config);
    const result = await v.verifyRequirement(sampleReq);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.qualityLevel).toBeDefined();
  });
});

class FixedJsonClient implements LLMClient {
  constructor(private readonly json: string) {}
  async generate(_prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    return { text: this.json, supportsLogits: false };
  }
}

const ADAPTIVE_RUBRIC_JSON = JSON.stringify({
  dimensions: [
    { id: 'adaptive-completeness', description: '完整性', scoringPrompt: '完整性(1-20)', weight: 0.5, minThreshold: 10 },
    { id: 'adaptive-clarity', description: '清晰度', scoringPrompt: '清晰度(1-20)', weight: 0.5, minThreshold: 10 },
  ],
});

describe('WModelVerifierEnhancer - adaptive rubric', () => {
  it('uses hardcoded rubric when adaptive disabled (default)', async () => {
    const config = {
      llm: { model: 'mock' },
      // no rubric.adaptive → defaults to off
    };
    const enhancer = new WModelVerifierEnhancer(config);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req);
    // 硬编码 subCriteria 含 'completeness'（非 'adaptive-completeness'）
    expect(result.subScores).toHaveProperty('completeness');
    expect(result.subScores).not.toHaveProperty('adaptive-completeness');
    expect(result.rubricFallback).toBeUndefined(); // adaptive off, no fallback flag
  });

  it('uses RubricGenerator when adaptive enabled', async () => {
    const client = new FixedJsonClient(ADAPTIVE_RUBRIC_JSON);
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 2, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req, '用户登录功能');
    expect(result.subScores).toHaveProperty('adaptive-completeness');
    expect(result.rubricFallback).toBe(false);
    expect(result.reliability).toBeDefined();
    expect(result.dimensionFlags).toBeDefined();
    expect(result.deploymentGate).toBeDefined();
  });

  it('falls back to hardcoded when RubricGenerator fails', async () => {
    // rubric 生成调用（prompt 含"rubric 生成器"）抛错；评分调用正常返回默认文本
    const client = new (class implements LLMClient {
      async generate(prompt: string): Promise<LLMResponse> {
        if (prompt.includes('rubric 生成器')) {
          throw new Error('LLM down');
        }
        return { text: 'J', supportsLogits: false };
      }
    })();
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 5, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const req = {
      id: 'r1', projectId: 'p1', title: '登录', description: 'desc',
      type: '功能需求', priority: '高', acceptanceCriteria: ['ac1'],
      testCases: [], status: '待开发',
    };
    const result = await enhancer.verifyRequirement(req, '用户登录功能');
    expect(result.subScores).toHaveProperty('completeness');
    expect(result.rubricFallback).toBe(true);
  });

  it('verifyDesign and verifyTestCase also support adaptive', async () => {
    const client = new FixedJsonClient(ADAPTIVE_RUBRIC_JSON);
    const config = {
      llm: { model: 'mock' },
      rubric: {
        adaptive: true, dimensions: 2, alphaThreshold: 0.8,
        minThresholdDefault: 8, hardGate: false, cache: true,
      },
    };
    const enhancer = new WModelVerifierEnhancer(config, client);
    const design = {
      id: 'd1', projectId: 'p1', type: '系统设计' as const,
      content: 'c', diagrams: [], testCases: [], createdAt: '2026-01-01',
    };
    const dResult = await enhancer.verifyDesign(design, '微服务架构');
    expect(dResult.subScores).toHaveProperty('adaptive-completeness');

    const tc = {
      id: 't1', projectId: 'p1', type: '单元测试' as const, title: 't',
      description: 'd', steps: ['s1'], expectedResult: 'e',
      status: '待执行' as const, priority: '高' as const,
    };
    const tResult = await enhancer.verifyTestCaseQuality(tc, '边界测试');
    expect(tResult.subScores).toHaveProperty('adaptive-completeness');
  });
});
