import { describe, it, expect } from '@jest/globals';
import { RubricGenerator } from '../src/core/rubric-generator.js';
import { MockLLMClient } from '../src/core/llm-client.js';
import type { LLMClient, LLMResponse, LLMGenerateOptions } from '../src/types/index.js';

/** 返回固定 JSON 的 mock client，用于测试生成路径 */
class FixedJsonClient implements LLMClient {
  public callCount = 0;
  constructor(private readonly json: string) {}
  async generate(_prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    this.callCount++;
    return { text: this.json, supportsLogits: false };
  }
}

/** 抛错的 mock client，用于测试 fallback 路径 */
class ThrowingClient implements LLMClient {
  async generate(): Promise<LLMResponse> {
    throw new Error('LLM unavailable');
  }
}

const RUBRIC_JSON = JSON.stringify({
  dimensions: [
    {
      id: 'completeness',
      description: '需求描述完整性',
      scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)',
      weight: 0.3,
      minThreshold: 10,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
    {
      id: 'clarity',
      description: '验收标准清晰度',
      scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)',
      weight: 0.3,
      minThreshold: 10,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
    {
      id: 'feasibility',
      description: '技术可行性',
      scoringPrompt: '评估需求的技术实现可行性(1-20分)',
      weight: 0.4,
      minThreshold: 8,
      levelDescriptors: ['差', '较差', '一般', '良好', '优秀'],
    },
  ],
});

describe('RubricGenerator', () => {
  it('generates adaptive subCriteria from LLM JSON', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.subCriteria).toHaveLength(3);
    expect(result.subCriteria[0].taskAdaptive).toBe(true);
    expect(result.fallback).toBe(false);
    // 权重归一化到 1
    const totalWeight = result.subCriteria.reduce((s, c) => s + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
    // minThreshold 保留
    expect(result.subCriteria[2].minThreshold).toBe(8);
  });

  it('caches rubric by (type, taskDescription) — no repeat LLM call', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: true });
    await gen.generate('requirement', '用户登录功能');
    await gen.generate('requirement', '用户登录功能');

    expect(client.callCount).toBe(1);
  });

  it('does not cache when cache=false', async () => {
    const client = new FixedJsonClient(RUBRIC_JSON);
    const gen = new RubricGenerator({ llm: client, dimensions: 3, minThresholdDefault: 8, cache: false });
    await gen.generate('requirement', '用户登录功能');
    await gen.generate('requirement', '用户登录功能');

    expect(client.callCount).toBe(2);
  });

  it('falls back to hardcoded subCriteria on LLM failure', async () => {
    const client = new ThrowingClient();
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.fallback).toBe(true);
    expect(result.subCriteria.length).toBeGreaterThan(0);
    // 硬编码 subCriteria 不带 taskAdaptive
    expect(result.subCriteria.every(c => c.taskAdaptive !== true)).toBe(true);
  });

  it('falls back on invalid JSON', async () => {
    const client = new FixedJsonClient('not valid json {{{');
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });
    const result = await gen.generate('requirement', '用户登录功能');

    expect(result.fallback).toBe(true);
    expect(result.subCriteria.length).toBeGreaterThan(0);
  });

  it('provides hardcoded rubrics for design and testcase types', async () => {
    const client = new ThrowingClient();
    const gen = new RubricGenerator({ llm: client, dimensions: 5, minThresholdDefault: 8, cache: true });

    const designResult = await gen.generate('design', '微服务架构');
    expect(designResult.subCriteria.some(c => c.id.includes('arch') || c.id.includes('interface'))).toBe(true);

    const tcResult = await gen.generate('testcase', '边界测试');
    expect(tcResult.subCriteria.some(c => c.id.includes('coverage') || c.id.includes('boundary'))).toBe(true);
  });
});
