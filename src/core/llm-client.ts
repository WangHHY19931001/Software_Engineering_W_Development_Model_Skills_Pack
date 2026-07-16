/**
 * LLM 客户端抽象与实现
 *
 * 设计目标：
 * 1. 解耦 verifier 引擎与具体 LLM SDK（OpenAI / Anthropic / 本地推理 / Mock）
 * 2. 明确标记是否支持 logits，触发上层 fallback 机制
 * 3. 提供 MockLLMClient，便于离线 / 单元测试
 *
 * 注意：本文件不强制依赖任何具体 SDK，运行时按需注入实现。
 */

import type {
  LLMClient,
  LLMClientConfig,
  LLMGenerateOptions,
  LLMResponse,
} from '../types';

/**
 * 抽象基类：提供通用配置与日志能力，具体 generate 由子类实现。
 */
export abstract class BaseLLMClient implements LLMClient {
  protected config: LLMClientConfig;
  /** 原生支持 logits？默认 false（多数商用 API 不返回 logits） */
  protected readonly supportsLogits: boolean;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.supportsLogits = config.supportsLogits ?? false;
  }

  abstract generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;

  /** 工具方法：构造空 logits 响应（fallback 用） */
  protected textOnlyResponse(text: string): LLMResponse {
    return { text, logits: undefined, supportsLogits: false };
  }
}

/**
 * MockLLMClient：用于测试与离线演示。
 *
 * 行为：
 * - 若提供了 `scoreLabel`，则返回该标签作为文本（用于 fallback 路径测试）
 * - 若 `supportsLogits=true` 且提供了 `mockLogits`，则返回 logits
 * - 否则按 prompt 关键字返回预设文本
 */
export class MockLLMClient extends BaseLLMClient {
  private mockLogits?: number[][];
  private scoreLabel?: string;
  private callCount = 0;

  constructor(config: LLMClientConfig & {
    mockLogits?: number[][];
    scoreLabel?: string;
  }) {
    super({
      ...config,
      supportsLogits: config.supportsLogits ?? !!config.mockLogits,
    });
    this.mockLogits = config.mockLogits;
    this.scoreLabel = config.scoreLabel;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    this.callCount++;

    // 1. 若支持 logits 且有 mock 数据，优先返回 logits（用于测试 logits 路径）
    if (this.supportsLogits && this.mockLogits && options?.returnLogits) {
      return {
        text: this.scoreLabel ?? 'A',
        logits: this.mockLogits,
        supportsLogits: true,
      };
    }

    // 2. 显式 label（用于测试 fallback 路径）
    if (this.scoreLabel) {
      return this.textOnlyResponse(this.scoreLabel);
    }

    // 3. 默认按 prompt 关键字返回一个中等评分（字母 'J' 对应 10 分）
    const text = prompt.includes('比较')
      ? '比较结果：方案 A 评分 15 分'
      : 'J';
    return this.textOnlyResponse(text);
  }

  /** 测试辅助：获取调用次数 */
  getCallCount(): number {
    return this.callCount;
  }
}

/**
 * 简单的 HTTP-based LLM 客户端骨架。
 *
 * 适用于自部署推理服务（如 vLLM / TGI），通常可返回 logits。
 * 真实使用时按对应服务 API 填充 fetch 逻辑。
 */
export class HttpLLMClient extends BaseLLMClient {
  async generate(_prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.config.baseURL) {
      throw new Error('HttpLLMClient 需要 baseURL');
    }
    // 骨架：实际实现按服务 API 调整
    throw new Error(
      `HttpLLMClient.generate 未实现：请在生产环境注入具体实现 (baseURL=${this.config.baseURL})`
    );
  }
}

/**
 * 工厂函数：根据配置创建合适的 LLM 客户端
 */
export function createLLMClient(config: LLMClientConfig): LLMClient {
  // 优先按 baseURL 判断
  if (config.baseURL) {
    return new HttpLLMClient(config);
  }
  // 默认走 Mock（便于开箱即用、CI 环境）
  return new MockLLMClient(config);
}
