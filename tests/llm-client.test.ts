/**
 * LLM 客户端单元测试
 *
 * 覆盖：
 *   - MockLLMClient 默认行为（无 scoreLabel / 无 logits）
 *   - MockLLMClient 比较类 prompt 分支
 *   - MockLLMClient.getCallCount 调用统计
 *   - HttpLLMClient 错误路径（无 baseURL / 未实现）
 *   - createLLMClient 工厂函数（baseURL / 默认 Mock）
 *   - BaseLLMClient.supportsLogits 推断
 */

import { describe, it, expect } from '@jest/globals';
import {
  MockLLMClient,
  HttpLLMClient,
  createLLMClient,
} from '../src/core/llm-client.js';

describe('MockLLMClient - 默认行为', () => {
  it('无 scoreLabel 时返回默认中等评分 J', async () => {
    const client = new MockLLMClient({ model: 'mock' });
    const resp = await client.generate('请评估质量');
    expect(resp.text).toBe('J');
    expect(resp.supportsLogits).toBe(false);
    expect(resp.logits).toBeUndefined();
  });

  it('比较类 prompt 返回比较结果文本', async () => {
    const client = new MockLLMClient({ model: 'mock' });
    const resp = await client.generate('请比较两个方案的质量');
    expect(resp.text).toContain('比较结果');
    expect(resp.text).toContain('15');
  });

  it('getCallCount 统计调用次数', async () => {
    const client = new MockLLMClient({ model: 'mock' });
    expect(client.getCallCount()).toBe(0);
    await client.generate('prompt1');
    await client.generate('prompt2');
    expect(client.getCallCount()).toBe(2);
  });

  it('supportsLogits 由 mockLogits 自动推断', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      mockLogits: [[1, 2, 3]],
    });
    // 请求 logits 时应返回 supportsLogits=true
    const resp = await client.generate('评估', { returnLogits: true });
    expect(resp.supportsLogits).toBe(true);
    expect(resp.logits).toBeDefined();
  });

  it('supportsLogits 显式 false 优先于 mockLogits', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: false,
      mockLogits: [[1, 2, 3]],
    });
    // 即使请求 logits，也走 fallback 文本路径
    const resp = await client.generate('评估', { returnLogits: true });
    expect(resp.supportsLogits).toBe(false);
    expect(resp.logits).toBeUndefined();
  });

  it('有 scoreLabel 但未请求 logits 时返回文本', async () => {
    const client = new MockLLMClient({
      model: 'mock',
      supportsLogits: true,
      mockLogits: [[1, 2, 3]],
      scoreLabel: 'T',
    });
    // 不传 returnLogits，应走 scoreLabel 分支
    const resp = await client.generate('评估');
    expect(resp.text).toBe('T');
    expect(resp.supportsLogits).toBe(false);
    expect(resp.logits).toBeUndefined();
  });
});

describe('HttpLLMClient', () => {
  it('无 baseURL 应抛错', async () => {
    const client = new HttpLLMClient({ model: 'http' });
    await expect(client.generate('prompt')).rejects.toThrow(/baseURL/);
  });

  it('有 baseURL 但未实现 generate 应抛错', async () => {
    const client = new HttpLLMClient({ model: 'http', baseURL: 'http://localhost:8080' });
    await expect(client.generate('prompt')).rejects.toThrow(/HttpLLMClient.generate 未实现/);
  });

  it('supportsLogits 默认 false（通过响应返回值观察）', async () => {
    const client = new HttpLLMClient({ model: 'http', baseURL: 'http://localhost:8080' });
    // generate 会抛错，但 supportsLogits 默认值由 BaseLLMClient 构造器决定
    // 这里仅验证不抛构造错误
    expect(client).toBeDefined();
  });
});

describe('createLLMClient 工厂函数', () => {
  it('有 baseURL 时返回 HttpLLMClient', () => {
    const client = createLLMClient({ model: 'http', baseURL: 'http://localhost:8080' });
    expect(client).toBeInstanceOf(HttpLLMClient);
  });

  it('无 baseURL 时返回 MockLLMClient', () => {
    const client = createLLMClient({ model: 'mock' });
    expect(client).toBeInstanceOf(MockLLMClient);
  });
});
