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
 * OpenAI 兼容客户端（覆盖 OpenAI / Azure OpenAI / DeepSeek / Moonshot / 通义等）。
 *
 * 实现说明：
 * - 使用全局 fetch（Node 18+ 原生支持），无外部 SDK 依赖。
 * - 多数商用 OpenAI 兼容接口不返回 token-level logits，因此 supportsLogits 默认 false，
 *   上层 LLMVerifierEngine 会自动走 fallback（text-parse）路径。
 * - 若 baseURL 指向自部署 vLLM/TGI 且返回 top_logprobs，可设 supportsLogits=true。
 *
 * 配置：
 * - baseURL：例如 https://api.openai.com/v1（默认）
 * - apiKey：Bearer token
 * - model：模型名
 */
export class OpenAICompatibleLLMClient extends BaseLLMClient {
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(config: LLMClientConfig) {
    super({
      ...config,
      supportsLogits: config.supportsLogits ?? false,
    });
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.apiKey = config.apiKey ?? '';
    if (!this.apiKey) {
      throw new Error('OpenAICompatibleLLMClient 需要 apiKey（或设置 OPENAI_API_KEY）');
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const url = `${this.baseURL.replace(/\/$/, '')}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens,
    };

    // 若要求 logits 且客户端声明支持，附加 logprobs（OpenAI 风格）
    if (options?.returnLogits && this.supportsLogits) {
      body.logprobs = true;
      body.top_logprobs = 20;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OpenAI 兼容接口请求失败 ${resp.status}: ${errText}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{
        message?: { content?: string };
        logprobs?: {
          content?: Array<{ token: string; logprob: number; bytes?: number[] }>;
        };
      }>;
    };

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? '';

    // 解析 logprobs → number[][]（每 token 一组 logits，这里只填对应 token 的 logprob）
    // 注意：OpenAI logprobs 是已采样 token 的对数概率，并非完整词表 logits。
    //       上层引擎会从中提取评分标签对应的 logprob，近似连续评分。
    let logits: number[][] | undefined;
    if (this.supportsLogits && choice?.logprobs?.content) {
      // 简化：把每个 token 的 logprob 包成单元素数组，引擎会按标签匹配
      logits = choice.logprobs.content.map(lp => [lp.logprob]);
    }

    return {
      text,
      logits,
      supportsLogits: this.supportsLogits && !!logits,
    };
  }
}

/**
 * Anthropic Claude 客户端。
 *
 * 实现说明：
 * - 使用 Messages API（/v1/messages）。
 * - Anthropic API 不返回 token-level logits，supportsLogits 恒为 false，
 *   上层走 text-parse fallback（让模型输出字母 A-T）。
 *
 * 配置：
 * - baseURL：默认 https://api.anthropic.com
 * - apiKey：x-api-key 头
 * - model：例如 claude-3-5-sonnet-20241022
 */
export class AnthropicLLMClient extends BaseLLMClient {
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(config: LLMClientConfig) {
    super({ ...config, supportsLogits: false });
    this.baseURL = config.baseURL ?? 'https://api.anthropic.com';
    this.apiKey = config.apiKey ?? '';
    if (!this.apiKey) {
      throw new Error('AnthropicLLMClient 需要 apiKey（或设置 ANTHROPIC_API_KEY）');
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const url = `${this.baseURL.replace(/\/$/, '')}/v1/messages`;
    const body = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Anthropic 接口请求失败 ${resp.status}: ${errText}`);
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find(c => c.type === 'text')?.text ?? '';

    // Anthropic 不返回 logits，明确标记 supportsLogits=false
    return this.textOnlyResponse(text);
  }
}

/**
 * 工厂函数：根据配置创建合适的 LLM 客户端
 *
 * 选择策略：
 *   - model === 'mock'：MockLLMClient（测试 / CI / 离线）
 *   - model 以 'claude' 开头：AnthropicLLMClient
 *   - model 以 'gpt' / 'deepseek' / 'qwen' / 'kimi' / 'moonshot' 开头：OpenAICompatibleLLMClient
 *   - 显式 provider 字段优先
 */
export function createLLMClient(config: LLMClientConfig & {
  provider?: 'openai' | 'anthropic' | 'http' | 'mock';
}): LLMClient {
  const provider = config.provider
    ?? (config.model === 'mock' ? 'mock'
      : /^claude/i.test(config.model) ? 'anthropic'
      : /^(gpt|deepseek|qwen|kimi|moonshot|glm)/i.test(config.model) ? 'openai'
      : config.baseURL ? 'http'
      : 'mock');

  switch (provider) {
    case 'mock':
      return new MockLLMClient(config);
    case 'anthropic':
      return new AnthropicLLMClient(config);
    case 'openai':
      return new OpenAICompatibleLLMClient(config);
    case 'http':
      return new HttpLLMClient(config);
    default:
      return new MockLLMClient(config);
  }
}
