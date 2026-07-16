/**
 * LLMVerifierEngine 单元测试
 *
 * 覆盖：
 *   - logits 路径：期望值计算
 *   - fallback 路径：text-parse / discrete / throw
 *   - getScoreDistribution 单点 fallback
 *   - 数值稳定性（log-softmax）
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LLMVerifierEngine } from '../src/core/scoring-engine.js';
import { MockLLMClient } from '../src/core/llm-client.js';
import type { VerifierConfig } from '../src/types/index.js';

function makeConfig(overrides: Partial<VerifierConfig> = {}): VerifierConfig {
  return {
    llm: { model: 'mock' },
    temperature: 0.3,
    fallbackStrategy: 'text-parse',
    ...overrides,
  };
}

describe('LLMVerifierEngine - logits 路径', () => {
  it('应正确计算 logits 期望值（数值稳定的 log-softmax）', async () => {
    // 构造 logits：A=0, B=10（B 对应分数 2，权重更大）
    // 期望分数接近 2（因为 B 的 logit 远大于 A）
    const logits: number[][] = [[]];
    const labels = 'ABCDEFGHIJKLMNOPQRST'.split('');
    for (let i = 0; i < 20; i++) {
      logits[0][i] = i === 1 ? 10 : 0; // B（idx=1）logit=10，其余 0
    }

    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: true,
      mockLogits: logits,
      scoreLabel: 'B',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', { foo: 1 });

    expect(score).toBeGreaterThan(1.5);
    expect(score).toBeLessThan(2.5);
    expect(engine.getFallbackCount()).toBe(0);
  });

  it('应正确处理极端 logits（数值稳定，不溢出）', async () => {
    const logits: number[][] = [[]];
    for (let i = 0; i < 20; i++) {
      logits[0][i] = i === 19 ? 1000 : 0; // T（idx=19）logit=1000
    }
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: true,
      mockLogits: logits,
      scoreLabel: 'T',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', {});
    expect(score).toBeCloseTo(20, 1);
  });
});

describe('LLMVerifierEngine - fallback text-parse', () => {
  it('字母 B 应解析为分数 2', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'B',
    });
    const engine = new LLMVerifierEngine(makeConfig({ fallbackStrategy: 'text-parse' }), client);
    const score = await engine.computeContinuousScore('test', {});
    // text-parse 会加扰动，但围绕 2 浮动
    expect(score).toBeGreaterThanOrEqual(1.5);
    expect(score).toBeLessThanOrEqual(2.5);
    expect(engine.getFallbackCount()).toBe(1);
  });

  it('字母 T 应解析为分数 20', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'T',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', {});
    expect(score).toBeGreaterThanOrEqual(19.5);
    expect(score).toBeLessThanOrEqual(20);
  });

  it('数字 15 应解析为分数 15', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: '15',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', {});
    expect(score).toBeGreaterThanOrEqual(14.5);
    expect(score).toBeLessThanOrEqual(15.5);
  });

  it('超出范围的数字（如 85）应按比例缩放', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: '85',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', {});
    // 85/100 * 20 = 17
    expect(score).toBeGreaterThanOrEqual(16.5);
    expect(score).toBeLessThanOrEqual(17.5);
  });

  it('解析失败时返回中位分数（10.5）', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'invalid',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const score = await engine.computeContinuousScore('test', {});
    expect(score).toBeGreaterThanOrEqual(10);
    expect(score).toBeLessThanOrEqual(11);
  });

  it('同一响应的扰动应稳定（确定性）', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'B',
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const s1 = await engine.computeContinuousScore('test', {});
    const s2 = await engine.computeContinuousScore('test', {});
    expect(s1).toBe(s2);
  });
});

describe('LLMVerifierEngine - fallback discrete', () => {
  it('discrete 模式应返回整数分数', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'B',
    });
    const engine = new LLMVerifierEngine(makeConfig({ fallbackStrategy: 'discrete' }), client);
    const score = await engine.computeContinuousScore('test', {});
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBe(2);
  });
});

describe('LLMVerifierEngine - fallback throw', () => {
  it('throw 模式应在无 logits 时抛错', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'B',
    });
    const engine = new LLMVerifierEngine(makeConfig({ fallbackStrategy: 'throw' }), client);
    await expect(engine.computeContinuousScore('test', {})).rejects.toThrow(
      /不支持 logits/
    );
  });
});

describe('LLMVerifierEngine - getScoreDistribution', () => {
  it('fallback 时返回单点分布', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      scoreLabel: 'J', // 对应分数 10
    });
    const engine = new LLMVerifierEngine(makeConfig(), client);
    const dist = await engine.getScoreDistribution('test', {});
    expect(dist.size).toBe(1);
    const [score, prob] = Array.from(dist.entries())[0];
    expect(score).toBeGreaterThanOrEqual(9.5);
    expect(prob).toBe(1);
  });

  it('logits 可用时返回完整分布', async () => {
    const logits: number[][] = [[]];
    for (let i = 0; i < 20; i++) {
      logits[0][i] = i === 19 ? 1000 : 0; // T（idx=19）logit=1000
    }
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: true,
      mockLogits: logits,
      scoreLabel: 'T',
    });
    const engine = new LLMVerifierEngine(makeConfig({ fallbackStrategy: 'throw' }), client);
    const dist = await engine.getScoreDistribution('test', {});
    expect(dist.size).toBeGreaterThan(0);
    expect(dist.has(20)).toBe(true);
  });
});

describe('LLMVerifierEngine - 未注入客户端', () => {
  it('不传 llmClient 时调用 generate 应抛错', async () => {
    const engine = new LLMVerifierEngine(makeConfig());
    await expect(engine.computeContinuousScore('test', {})).rejects.toThrow(
      /未注入 LLM 客户端/
    );
  });
});
